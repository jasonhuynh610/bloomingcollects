import { json, fail, finnhub, cached } from "./_lib.js";

// US stocks and ETFs only (Finnhub free covers US quotes)
const TYPES = new Set(["Common Stock", "ETP", "ETF", "ADR", "REIT"]);

export async function onRequestGet({ request, env }) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 40);
  if (q.length < 1) return json({ results: [] });
  const data = await cached(env, "search:" + q.toLowerCase(), 86400, async () => {
    const r = await finnhub(env, "/search", { q, exchange: "US" });
    if (r.error) return r;
    const results = (r.result || [])
      .filter((x) => TYPES.has(x.type) && !x.symbol.includes(".") && !x.symbol.includes(":"))
      .slice(0, 10)
      .map((x) => ({ symbol: x.symbol, name: x.description, type: x.type }));
    return { results };
  });
  if (data.error) return fail(502, data.error);
  return json(data);
}
