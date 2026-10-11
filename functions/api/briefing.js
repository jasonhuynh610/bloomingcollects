import { json, fail, cleanSymbol, SYMBOL_RE } from "./_lib.js";

// GET  /api/briefing?symbol=AAPL  -> latest saved briefing (no AI call; it was generated once that morning)
// POST /api/briefing (briefing job only) {symbol, trade_date, briefing}
export async function onRequestGet({ request, env }) {
  const symbol = cleanSymbol(new URL(request.url).searchParams.get("symbol"));
  if (!SYMBOL_RE.test(symbol)) return fail(400, "Bad symbol.");
  const row = await env.DB.prepare(
    "SELECT trade_date, json, created_at FROM briefings WHERE symbol = ? ORDER BY trade_date DESC LIMIT 1"
  ).bind(symbol).first();
  if (!row) return json({ briefing: null });
  return json({ briefing: { ...JSON.parse(row.json), trade_date: row.trade_date, created_at: row.created_at } });
}

export async function onRequestPost({ request, env, data }) {
  if (!data.job) return fail(403, "Only the daily briefing job can save briefings.");
  let body = {};
  try { body = await request.json(); } catch {}
  const symbol = cleanSymbol(body.symbol);
  if (!SYMBOL_RE.test(symbol) || !/^\d{4}-\d{2}-\d{2}$/.test(body.trade_date || "") || typeof body.briefing !== "object") {
    return fail(400, "Need symbol, trade_date (YYYY-MM-DD) and briefing.");
  }
  await env.DB.prepare("INSERT OR REPLACE INTO briefings (symbol, trade_date, json) VALUES (?, ?, ?)")
    .bind(symbol, body.trade_date, JSON.stringify(body.briefing)).run();
  // keep ~60 trading days per symbol
  await env.DB.prepare(
    "DELETE FROM briefings WHERE symbol = ? AND trade_date NOT IN (SELECT trade_date FROM briefings WHERE symbol = ? ORDER BY trade_date DESC LIMIT 60)"
  ).bind(symbol, symbol).run();
  return json({ ok: true });
}
