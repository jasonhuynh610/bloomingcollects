import { json, fail } from "./_lib.js";

// GET  /api/alerts        -> intraday alerts from the last 3 days (newest first)
// POST /api/alerts (job)  -> {alerts:[{id, ts, symbol, kind, ...}]}
export async function onRequestGet({ env }) {
  const since = Date.now() - 3 * 864e5;
  const { results } = await env.DB.prepare("SELECT id, ts, symbol, kind, json FROM alerts WHERE ts > ? ORDER BY ts DESC LIMIT 100").bind(since).all();
  return json({ alerts: results.map((r) => ({ ...JSON.parse(r.json), id: r.id, ts: r.ts, symbol: r.symbol, kind: r.kind })) });
}

export async function onRequestPost({ request, env, data }) {
  if (!data.job) return fail(403, "Not allowed.");
  let body = {};
  try { body = await request.json(); } catch {}
  for (const a of body.alerts || []) {
    if (!a.id || !a.symbol) continue;
    await env.DB.prepare("INSERT OR IGNORE INTO alerts (id, ts, symbol, kind, json) VALUES (?, ?, ?, ?, ?)")
      .bind(String(a.id), Number(a.ts) || Date.now(), a.symbol, String(a.kind || "alert"), JSON.stringify(a)).run();
  }
  await env.DB.prepare("DELETE FROM alerts WHERE ts < ?").bind(Date.now() - 90 * 864e5).run();
  return json({ ok: true });
}
