import { json, fail, twelvedata, cached, cleanSymbol, SYMBOL_RE } from "./_lib.js";

// chart ranges -> Twelve Data time_series params (1 API credit per request) and cache seconds
const RANGES = {
  "1D": { interval: "5min", outputsize: 78, ttl: 600 },
  "1W": { interval: "30min", outputsize: 65, ttl: 1800 },
  "1M": { interval: "1day", outputsize: 22, ttl: 21600 },
  "3M": { interval: "1day", outputsize: 66, ttl: 21600 },
  "6M": { interval: "1day", outputsize: 130, ttl: 21600 },
  "1Y": { interval: "1day", outputsize: 252, ttl: 21600 },
  "5Y": { interval: "1week", outputsize: 260, ttl: 86400 },
};

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const symbol = cleanSymbol(u.searchParams.get("symbol"));
  const range = u.searchParams.get("range") || "3M";
  const cfg = RANGES[range];
  if (!SYMBOL_RE.test(symbol) || !cfg) return fail(400, "Bad symbol or range.");

  const data = await cached(env, `hist:${symbol}:${range}`, cfg.ttl, async () => {
    const r = await twelvedata(env, "/time_series", { symbol, interval: cfg.interval, outputsize: cfg.outputsize, order: "ASC" });
    if (r.error) return r;
    return {
      symbol, range, interval: cfg.interval,
      timezone: r.meta?.exchange_timezone || "America/New_York",
      points: (r.values || []).map((v) => ({ t: v.datetime, o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +v.volume })),
      fetchedAt: Date.now(), source: "Twelve Data", sourceUrl: `https://twelvedata.com/markets/stock/${symbol}`,
    };
  });
  if (data.error) return fail(502, data.error);
  return json(data);
}
