import { json, fail, cleanSymbol } from "../_lib.js";

export async function onRequestPatch({ request, env, params, data }) {
  if (data.job) return fail(403, "Not allowed.");
  const symbol = cleanSymbol(params.symbol);
  let body = {};
  try { body = await request.json(); } catch {}
  const row = await env.DB.prepare("SELECT symbol FROM watchlist WHERE symbol = ?").bind(symbol).first();
  if (!row) return fail(404, "That ticker isn't on your watchlist.");

  if ("notes" in body) {
    await env.DB.prepare("UPDATE watchlist SET notes = ? WHERE symbol = ?").bind(String(body.notes ?? "").slice(0, 4000), symbol).run();
  }
  if ("target" in body) {
    const t = body.target === null || body.target === "" ? null : Number(body.target);
    if (t !== null && !(Number.isFinite(t) && t > 0)) return fail(400, "Target price must be a positive number.");
    await env.DB.prepare("UPDATE watchlist SET target = ? WHERE symbol = ?").bind(t, symbol).run();
  }
  const item = await env.DB.prepare("SELECT symbol, name, exchange, notes, target, added_at FROM watchlist WHERE symbol = ?").bind(symbol).first();
  return json({ item });
}

export async function onRequestDelete({ env, params, data }) {
  if (data.job) return fail(403, "Not allowed.");
  const symbol = cleanSymbol(params.symbol);
  await env.DB.prepare("DELETE FROM watchlist WHERE symbol = ?").bind(symbol).run();
  return json({ ok: true });
}
