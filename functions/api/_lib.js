// Shared helpers for the watchlist API (Cloudflare Pages Functions).
// Secrets come from env: TWELVEDATA_KEY, FINNHUB_KEY, LOGIN_HASH, SESSION_SECRET, BRIEFING_TOKEN.

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

export const fail = (status, message) => json({ error: message }, status);

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

// constant-time string compare
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// LOGIN_HASH format: pbkdf2$<iterations>$<salt b64>$<hash b64>
export async function checkPassword(password, stored) {
  const [alg, it, salt, hash] = String(stored || "").trim().split("$");
  if (alg !== "pbkdf2" || !hash) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromB64(salt), iterations: Number(it) }, key, 256);
  return safeEqual(btoa(String.fromCharCode(...new Uint8Array(bits))), hash);
}

export const SESSION_COOKIE = "wl_session";
const SESSION_DAYS = 30;

export async function makeSession(env) {
  const payload = b64url(enc.encode(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 864e5 })));
  const sig = await hmac(env.SESSION_SECRET.trim(), payload);
  return `${SESSION_COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export async function hasSession(request, env) {
  const m = (request.headers.get("cookie") || "").match(new RegExp(`${SESSION_COOKIE}=([\\w-]+)\\.([\\w-]+)`));
  if (!m || !env.SESSION_SECRET) return false;
  if (!safeEqual(await hmac(env.SESSION_SECRET.trim(), m[1]), m[2])) return false;
  try {
    const { exp } = JSON.parse(new TextDecoder().decode(fromB64(m[1].replace(/-/g, "+").replace(/_/g, "/") + "===".slice((m[1].length + 3) % 4))));
    return exp > Date.now();
  } catch { return false; }
}

export const clearSession = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function hasBriefingToken(request, env) {
  const h = request.headers.get("authorization") || "";
  return !!env.BRIEFING_TOKEN && safeEqual(h.replace(/^Bearer\s+/i, ""), env.BRIEFING_TOKEN.trim());
}

// D1-backed cache so repeated page loads don't burn free API credits
export async function cached(env, key, ttlSec, fn) {
  const now = Date.now();
  const row = await env.DB.prepare("SELECT json, expires FROM cache WHERE key = ?").bind(key).first();
  if (row && row.expires > now) return { ...JSON.parse(row.json), cached: true };
  const data = await fn();
  if (data && !data.error) {
    await env.DB.prepare("INSERT OR REPLACE INTO cache (key, json, expires) VALUES (?, ?, ?)").bind(key, JSON.stringify(data), now + ttlSec * 1000).run();
  } else if (row) {
    // upstream failed: serve the stale copy rather than nothing
    return { ...JSON.parse(row.json), cached: true, stale: true };
  }
  return data;
}

export const SYMBOL_RE = /^[A-Z0-9.\-]{1,12}$/;
export const cleanSymbol = (s) => String(s || "").trim().toUpperCase();

export async function finnhub(env, path, params = {}) {
  const u = new URL("https://finnhub.io/api/v1" + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("token", env.FINNHUB_KEY.trim());
  const r = await fetch(u, { headers: { accept: "application/json" } });
  if (r.status === 429) return { error: "Finnhub rate limit reached. Try again in a minute." };
  if (!r.ok) return { error: `Finnhub error ${r.status}` };
  return r.json();
}

export async function twelvedata(env, path, params = {}) {
  const u = new URL("https://api.twelvedata.com" + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("apikey", env.TWELVEDATA_KEY.trim());
  const r = await fetch(u, { headers: { accept: "application/json" } });
  const d = await r.json().catch(() => ({}));
  if (d.status === "error" || !r.ok) {
    const limited = d.code === 429 || /credits|limit/i.test(d.message || "");
    return { error: limited ? "Twelve Data free limit reached (8 per minute / 800 per day). Try again shortly." : (d.message || `Twelve Data error ${r.status}`) };
  }
  return d;
}
