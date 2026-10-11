import { json, fail, finnhub, cleanSymbol, SYMBOL_RE } from "./_lib.js";

const MAX_TICKERS = 30; // keeps the daily briefing inside the free Twelve Data quota

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT symbol, name, exchange, notes, target, added_at FROM watchlist ORDER BY added_at"
  ).all();
  return json({ items: results });
}

export async function onRequestPost({ request, env, data }) {
  if (data.job) return fail(403, "Not allowed.");
  let body = {};
  try { body = await request.json(); } catch {}
  const symbol = cleanSymbol(body.symbol);
  if (!SYMBOL_RE.test(symbol)) return fail(400, "That doesn't look like a ticker symbol.");
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM watchlist").first();
  if (n >= MAX_TICKERS) return fail(400, `Your watchlist is full (${MAX_TICKERS} max on the free data plan). Remove one first.`);

  // confirm the ticker has a live US quote before saving it
  const q = await finnhub(env, "/quote", { symbol });
  if (q.error) return fail(502, q.error);
  if (!q.t) return fail(404, `No price data found for ${symbol}.`);
  const p = await finnhub(env, "/stock/profile2", { symbol });
  const name = String(body.name || p.name || symbol).slice(0, 120);
  const exchange = String(p.exchange || body.exchange || "").slice(0, 80);

  await env.DB.prepare("INSERT OR IGNORE INTO watchlist (symbol, name, exchange) VALUES (?, ?, ?)").bind(symbol, name, exchange).run();
  const item = await env.DB.prepare("SELECT symbol, name, exchange, notes, target, added_at FROM watchlist WHERE symbol = ?").bind(symbol).first();
  return json({ item }, 201);
}
