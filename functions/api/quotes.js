import { json, fail, finnhub, cached, cleanSymbol, SYMBOL_RE } from "./_lib.js";

// Latest quote per symbol from Finnhub (free tier). Cached 60s.
export async function onRequestGet({ request, env }) {
  const symbols = (new URL(request.url).searchParams.get("symbols") || "")
    .split(",").map(cleanSymbol).filter((s) => SYMBOL_RE.test(s)).slice(0, 30);
  if (!symbols.length) return json({ quotes: {} });

  const out = {};
  await Promise.all(symbols.map(async (symbol) => {
    const q = await cached(env, "quote:" + symbol, 60, async () => {
      const r = await finnhub(env, "/quote", { symbol });
      if (r.error) return r;
      if (!r.t) return { error: "No price data" };
      return {
        price: r.c, change: r.d, changePct: r.dp, open: r.o, high: r.h, low: r.l, prevClose: r.pc,
        asOf: r.t * 1000, fetchedAt: Date.now(), source: "Finnhub", sourceUrl: `https://finnhub.io/api/v1/quote?symbol=${symbol}`,
      };
    });
    out[symbol] = q;
  }));
  if (Object.values(out).every((q) => q.error)) return fail(502, Object.values(out)[0].error);
  return json({ quotes: out, marketTimezone: "America/New_York" });
}
