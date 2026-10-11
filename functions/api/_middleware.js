import { fail, hasSession, hasBriefingToken } from "./_lib.js";

// Every /api route needs a valid login session, except login itself.
// The daily briefing job (on Mushi's PC) authenticates with BRIEFING_TOKEN instead.
const OPEN = new Set(["/api/login", "/api/logout"]);

export async function onRequest(context) {
  const { request, env, next } = context;
  const path = new URL(request.url).pathname.replace(/\/$/, "");
  if (OPEN.has(path)) return next();
  if (!env.DB) return fail(500, "Database is not configured.");
  if (await hasSession(request, env)) return next();
  if (hasBriefingToken(request, env)) { context.data.job = true; return next(); }
  return fail(401, "Please sign in.");
}
