import { json, fail, checkPassword, makeSession } from "./_lib.js";

const WINDOW_MS = 15 * 60 * 1000, MAX_FAILS = 5;

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  await env.DB.prepare("DELETE FROM login_attempts WHERE at < ?").bind(now - WINDOW_MS).run();
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ?").bind(ip).first();
  if (n >= MAX_FAILS) return fail(429, "Too many attempts. Wait 15 minutes and try again.");

  let body = {};
  try { body = await request.json(); } catch {}
  const password = String(body.password || "");
  if (password && (await checkPassword(password, env.LOGIN_HASH))) {
    await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
    return json({ ok: true }, 200, { "set-cookie": await makeSession(env) });
  }
  await env.DB.prepare("INSERT INTO login_attempts (ip, at) VALUES (?, ?)").bind(ip, now).run();
  return fail(401, "That password isn't right.");
}
