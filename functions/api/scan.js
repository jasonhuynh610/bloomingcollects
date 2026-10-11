import { json, fail } from "./_lib.js";

// GET  /api/scan[?date=YYYY-MM-DD] -> saved scanner result (latest by default) + list of available dates
// POST /api/scan (scanner job only) {trade_date, scan}
export async function onRequestGet({ request, env }) {
  const date = new URL(request.url).searchParams.get("date");
  const row = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? await env.DB.prepare("SELECT trade_date, json, created_at FROM scans WHERE trade_date = ?").bind(date).first()
    : await env.DB.prepare("SELECT trade_date, json, created_at FROM scans ORDER BY trade_date DESC LIMIT 1").first();
  const { results } = await env.DB.prepare("SELECT trade_date FROM scans ORDER BY trade_date DESC LIMIT 30").all();
  return json({ scan: row ? { ...JSON.parse(row.json), saved_at: row.created_at } : null, dates: results.map((r) => r.trade_date) });
}

export async function onRequestPost({ request, env, data }) {
  if (!data.job) return fail(403, "Only the scanner job can save scans.");
  let body = {};
  try { body = await request.json(); } catch {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.trade_date || "") || typeof body.scan !== "object") return fail(400, "Need trade_date and scan.");
  await env.DB.prepare("INSERT OR REPLACE INTO scans (trade_date, json) VALUES (?, ?)").bind(body.trade_date, JSON.stringify(body.scan)).run();
  await env.DB.prepare("DELETE FROM scans WHERE trade_date NOT IN (SELECT trade_date FROM scans ORDER BY trade_date DESC LIMIT 90)").run();
  return json({ ok: true });
}
