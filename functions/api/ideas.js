import { json, fail } from "./_lib.js";

// GET  /api/ideas            -> latest run (market overview), its ideas, still-active older ideas, and the full track record
// GET  /api/ideas?open=1     -> (job) ideas whose outcome is still being tracked, with full json
// POST /api/ideas            -> (job) {trade_date, run, ideas:[{id, symbol, side, status, ...}]}
// POST /api/ideas?outcomes=1 -> (job) {updates:[{id, outcome_status, outcome}]}
const parse = (r) => ({ ...JSON.parse(r.json), id: r.id, trade_date: r.trade_date, outcome_status: r.outcome_status, outcome: r.outcome ? JSON.parse(r.outcome) : null, created_at: r.created_at });

export async function onRequestGet({ request, env, data }) {
  const u = new URL(request.url);
  if (u.searchParams.get("open")) {
    if (!data.job) return fail(403, "Not allowed.");
    const { results } = await env.DB.prepare("SELECT * FROM ideas WHERE outcome_status IN ('open','triggered') ORDER BY trade_date").all();
    return json({ ideas: results.map(parse) });
  }
  const runRow = await env.DB.prepare("SELECT trade_date, json, created_at FROM idea_runs ORDER BY trade_date DESC LIMIT 1").first();
  const run = runRow ? { ...JSON.parse(runRow.json), trade_date: runRow.trade_date, saved_at: runRow.created_at } : null;
  const latest = run
    ? (await env.DB.prepare("SELECT * FROM ideas WHERE trade_date = ? ORDER BY CASE status WHEN 'Conditional entry' THEN 0 WHEN 'Watch' THEN 1 ELSE 2 END, symbol").bind(run.trade_date).all()).results.map(parse)
    : [];
  const active = run
    ? (await env.DB.prepare("SELECT * FROM ideas WHERE trade_date < ? AND outcome_status = 'triggered' ORDER BY trade_date DESC").bind(run.trade_date).all()).results.map(parse)
    : [];
  const { results: rec } = await env.DB.prepare(
    "SELECT id, trade_date, symbol, side, status, json, outcome_status, outcome, created_at FROM ideas WHERE status != 'No clear setup' ORDER BY trade_date DESC, symbol LIMIT 300"
  ).all();
  const record = rec.map((r) => { const j = JSON.parse(r.json); return { id: r.id, trade_date: r.trade_date, symbol: r.symbol, side: r.side, status: r.status, setup: j.setup, horizon: j.horizon, entry: j.entry, stop: j.stop, targets: j.targets, rr: j.rr, outcome_status: r.outcome_status, outcome: r.outcome ? JSON.parse(r.outcome) : null, created_at: r.created_at }; });
  return json({ run, ideas: latest, active, record });
}

export async function onRequestPost({ request, env, data }) {
  if (!data.job) return fail(403, "Only the trade-ideas job can save ideas.");
  let body = {};
  try { body = await request.json(); } catch {}
  const u = new URL(request.url);
  if (u.searchParams.get("outcomes")) {
    for (const x of body.updates || []) {
      await env.DB.prepare("UPDATE ideas SET outcome_status = ?, outcome = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(String(x.outcome_status), JSON.stringify(x.outcome || null), String(x.id)).run();
    }
    return json({ ok: true, updated: (body.updates || []).length });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.trade_date || "") || !Array.isArray(body.ideas)) return fail(400, "Need trade_date and ideas.");
  if (body.run) await env.DB.prepare("INSERT OR REPLACE INTO idea_runs (trade_date, json) VALUES (?, ?)").bind(body.trade_date, JSON.stringify(body.run)).run();
  for (const i of body.ideas) {
    if (!i.id || !i.symbol) continue;
    // keep the original timestamp and outcome if an idea is re-saved (e.g. AI text added later)
    await env.DB.prepare(
      `INSERT INTO ideas (id, trade_date, symbol, side, status, json, outcome_status) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, json = excluded.json, updated_at = datetime('now')`
    ).bind(i.id, body.trade_date, i.symbol, i.side || "none", i.status || "Watch", JSON.stringify(i), i.status === "No clear setup" ? "n/a" : "open").run();
  }
  return json({ ok: true, saved: body.ideas.length });
}
