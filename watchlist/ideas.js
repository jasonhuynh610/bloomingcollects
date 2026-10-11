(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var data = null, alerts = [], loading = false, charts = {};

  function W() { return window.WL; }
  function e(s) { return W().esc(s); }
  function pctS(x, d) { return x == null ? "—" : W().signed(x, "", "%", d == null ? 1 : d); }
  function badge(status) {
    var cls = status === "Conditional entry" ? "st-go" : status === "Watch" ? "st-watch" : "st-none";
    return '<span class="st ' + cls + '">' + e(status) + "</span>";
  }
  function sideTag(side) { return side === "long" ? '<span class="side long">Long</span>' : side === "short" ? '<span class="side short">Short</span>' : ""; }
  function link(u, t) { return '<a href="' + e(W().safeUrl(u)) + '" target="_blank" rel="noopener">' + e(t) + "</a>"; }

  // the last weekday before today (ignores market holidays; used only to flag stale data)
  function expectedSession() {
    var d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
    return d.toISOString().slice(0, 10);
  }

  function marketHtml(run) {
    var m = run.market || {}, b = m.benchmarks || {}, s = m.sectors || {};
    var reg = m.regime || "unknown";
    var h = '<div class="card"><h2>Market backdrop <small class="muted">session ' + e(W().dateOnly(run.trade_date)) + "</small></h2>" +
      '<p>S&amp;P 500 trend: <span class="regime r-' + e(reg) + '">' + e(reg) + "</span> <span class=\"muted small\">(price vs its 50- and 200-day averages)</span></p>" +
      '<table class="mini"><thead><tr><th></th><th>Close</th><th>1 day</th><th>5 days</th><th>20 days</th></tr></thead><tbody>' +
      ["SPY", "QQQ", "IWM"].filter(function (k) { return b[k]; }).map(function (k) {
        var x = b[k]; return "<tr><th>" + k + "</th><td>" + W().money(x.close) + '</td><td class="' + W().dir(x.chg1d) + '">' + pctS(x.chg1d) + '</td><td class="' + W().dir(x.chg5d) + '">' + pctS(x.chg5d) + '</td><td class="' + W().dir(x.chg20d) + '">' + pctS(x.chg20d) + "</td></tr>";
      }).join("") + "</tbody></table>";
    var secs = Object.keys(s).filter(function (k) { return s[k]; }).sort(function (a, c) { return s[c].chg20d - s[a].chg20d; });
    var max = Math.max.apply(null, secs.map(function (k) { return Math.abs(s[k].chg20d) || 0; }).concat([1]));
    h += '<h3 class="sub">Sectors, last 20 sessions</h3><div class="bars">' + secs.map(function (k) {
      var v = s[k].chg20d, w = Math.abs(v) / max * 50;
      return '<div class="bar-row"><span class="bl">' + e(s[k].name) + ' <span class="muted">' + k + '</span></span><span class="bt"><span class="bf ' + (v >= 0 ? "pos" : "neg") + '" style="' + (v >= 0 ? "left:50%" : "right:50%") + ";width:" + w.toFixed(1) + '%"></span></span><span class="bv ' + W().dir(v) + '">' + pctS(v) + "</span></div>";
    }).join("") + "</div>";
    if (run.ai && run.ai.summary) {
      h += '<div class="bsec"><span class="badge b-ai">AI interpretation</span><p>' + e(run.ai.summary) + "</p>" +
        (run.ai.themes || []).map(function (t) { return '<p class="small"><b>' + e(t.theme) + ":</b> " + e(t.detail) + (t.sources && t.sources.length ? " " + t.sources.slice(0, 3).map(function (u, i) { return link(u, "[" + (i + 1) + "]"); }).join(" ") : "") + "</p>"; }).join("") + "</div>";
    }
    if (run.macroNews && run.macroNews.length) {
      h += '<details class="bsec"><summary><span class="badge b-src">Sourced facts</span> Market &amp; world headlines (' + run.macroNews.length + ')</summary><ul class="news">' +
        run.macroNews.map(function (n) { return "<li>" + link(n.url, n.headline) + "<span>" + e(n.source) + " · " + e(W().etTime(n.datetime)) + "</span></li>"; }).join("") + "</ul></details>";
    }
    return h + "</div>";
  }

  function levelsHtml(i) {
    var t = i.targets || [];
    return '<dl class="levels">' +
      "<div><dt>Entry zone</dt><dd>" + W().money(i.entry.low) + " – " + W().money(i.entry.high) + "</dd></div>" +
      '<div><dt>Stop / invalidation</dt><dd class="down">' + W().money(i.stop.price) + "</dd></div>" +
      t.map(function (x, k) { return '<div><dt>Target ' + (k + 1) + '</dt><dd class="up">' + W().money(x.price) + "</dd></div>"; }).join("") +
      "<div><dt>Reward : risk</dt><dd>" + (i.rr != null ? i.rr.toFixed(1) + " : 1" : "—") + "</dd></div>" +
      "<div><dt>Risk to stop</dt><dd>" + (i.riskPct != null ? i.riskPct.toFixed(1) + "%" : "—") + "</dd></div></dl>";
  }

  function ideaHtml(i) {
    var c = i.calc || {}, q = i.quote;
    var h = '<article class="card idea" id="idea-' + e(i.id) + '">' +
      '<header class="idea-head"><div><div class="idea-sym">' + e(i.symbol) + " " + sideTag(i.side) + '</div><div class="muted small">' + e(i.name) + " · " + e(i.setup) + '</div></div><div class="right">' + badge(i.status) +
      (q ? '<div class="px">' + W().money(q.price) + ' <span class="' + W().dir(q.changePct) + '">' + pctS(q.changePct, 2) + '</span></div><div class="muted tiny">quote ' + e(W().etTime(q.asOf)) + ", may be delayed</div>" : '<div class="muted tiny">no current quote</div>') +
      "</div></header>";
    if (i.side === "none") {
      return h + '<p class="muted">' + e(i.reason || "No setup matched the rules today.") + "</p>" + evidenceHtml(i) + "</article>";
    }
    if (i.statusReason) h += '<p class="note">Status lowered from ' + e(i.statusCalculated) + ": " + e(i.statusReason) + "</p>";
    (i.notes || []).forEach(function (n) { h += '<p class="note">' + e(n) + "</p>"; });
    h += levelsHtml(i) +
      '<p class="small"><b>Entry trigger:</b> ' + e(i.entry.trigger) + "</p>" +
      '<p class="small"><b>Hold / exit:</b> ' + e(i.hold) + " Exit at the stop without exception.</p>" +
      '<p class="small muted">' + e(i.horizon) + " · idea saved " + e(W().etTime(Date.parse((i.created_at || "").replace(" ", "T") + "Z"))) + "</p>" +
      '<button class="ghost small chart-btn" type="button" data-id="' + e(i.id) + '">Show chart with levels</button><div class="idea-chart" id="ch-' + e(i.id) + '" hidden></div>' +
      '<details><summary>How these levels were derived</summary><ul class="small">' +
      "<li><b>Entry:</b> " + e(i.entry.basis) + "</li><li><b>Stop:</b> " + e(i.stop.basis) + "</li>" +
      (i.targets || []).map(function (t, k) { return "<li><b>Target " + (k + 1) + ":</b> " + e(t.basis) + "</li>"; }).join("") +
      "</ul><p class=\"small muted\">" + e(i.levelsExplained || "") + "</p></details>" +
      evidenceHtml(i) + "</article>";
    return h;
  }

  function evidenceHtml(i) {
    var c = i.calc, h = "";
    if (c) {
      h += '<details><summary><span class="badge b-calc">Calculated</span> Trend &amp; indicators</summary><dl class="kv">' +
        [["Trend", c.trend], ["Close (" + c.asOf + ")", W().money(c.close)], ["1 / 5 / 20 days", pctS(c.chg1d) + " / " + pctS(c.chg5d) + " / " + pctS(c.chg20d)],
          ["RSI (14)", c.rsi14 != null ? c.rsi14.toFixed(0) : "—"], ["Rel. volume", c.rvol != null ? c.rvol.toFixed(2) + "×" : "—"],
          ["50 / 200-day avg", W().money(c.sma50) + " / " + (c.sma200 ? W().money(c.sma200) : "—")], ["ATR (14)", W().money(c.atr14) + " (" + (c.atrPct || 0).toFixed(1) + "%)"],
          ["vs S&P 500, 20d", pctS(c.vsSpy20d)], ["Sector " + c.sector + ", 20d", pctS(c.sector20d)], ["vs sector, 20d", pctS(c.vsSector20d)]]
          .map(function (p) { return "<div><dt>" + e(p[0]) + "</dt><dd>" + e(p[1]) + "</dd></div>"; }).join("") + "</dl></details>";
    }
    var news = i.news || [], fil = i.filings || [];
    h += '<details><summary><span class="badge b-src">Sourced facts</span> News, filings, earnings (' + (news.length + fil.length) + ")</summary>" +
      "<p class=\"small\"><b>Next earnings:</b> " + (i.earnings && i.earnings.date ? e(W().dateOnly(i.earnings.date)) + (i.earnings.hour === "bmo" ? " before the open" : i.earnings.hour === "amc" ? " after the close" : "") : "none in the next 90 days (Finnhub)") + "</p>" +
      (fil.length ? '<ul class="news">' + fil.map(function (f) { return "<li>" + link(f.url, "SEC " + f.form + (f.items ? " (items " + f.items + ")" : "") + (f.description ? " · " + f.description : "")) + "<span>EDGAR · filed " + e(W().dateOnly(f.date)) + "</span></li>"; }).join("") + "</ul>" : '<p class="small muted">No material SEC filings in the last 7 days.</p>') +
      (news.length ? '<ul class="news">' + news.map(function (n) { return "<li>" + link(n.url, n.headline) + "<span>" + e(n.source) + " · " + e(W().etTime(n.datetime)) + "</span></li>"; }).join("") + "</ul>" : '<p class="small muted">No company news in the last few days.</p>') +
      "</details>";
    if (i.ai) {
      var al = i.ai.alignment;
      h += '<details open><summary><span class="badge b-ai">AI interpretation</span> News vs. chart</summary>' +
        (i.ai.thesis ? "<p>" + e(i.ai.thesis) + "</p>" : "") +
        (al ? '<p><b>News and price: <span class="al al-' + e(al) + '">' + e(al) + "</span></b> " + e(i.ai.alignmentWhy) + "</p>" : "") +
        (i.ai.pricedIn ? "<p><b>Already priced in?</b> " + e(i.ai.pricedIn) + "</p>" : "") +
        (i.ai.risks && i.ai.risks.length ? "<p><b>Key risks</b></p><ul>" + i.ai.risks.map(function (r) { return "<li>" + e(r) + "</li>"; }).join("") + "</ul>" : "") +
        '<p class="disclaimer">Written by ' + e(i.ai.author) + " from the data above. An interpretation, not a prediction or advice.</p></details>";
    }
    return h;
  }

  function alertsHtml() {
    if (!alerts.length) return '<div class="card"><h2>Intraday alerts</h2><p class="muted">No alerts in the last 3 days. During market hours (6:30 AM–1:00 PM PT) your watchlist and active ideas are checked every 10 minutes.</p></div>';
    return '<div class="card"><h2>Intraday alerts <small class="muted">last 3 days</small></h2><ul class="alerts">' + alerts.map(function (a) {
      return "<li><span class=\"muted tiny\">" + e(W().etTime(a.ts)) + "</span><pre>" + e(a.text) + "</pre></li>";
    }).join("") + '</ul><p class="meta">5-min bars from Twelve Data (free tier; may be delayed). Alerts are calculated, not AI, and checks run about every 10 minutes.</p></div>';
  }

  function recordHtml(rec) {
    var closed = rec.filter(function (r) { return ["target_hit", "stopped", "expired"].indexOf(r.outcome_status) > -1; });
    var wins = closed.filter(function (r) { return r.outcome && r.outcome.R > 0; }).length;
    var avgR = closed.length ? closed.reduce(function (s, r) { return s + (r.outcome ? r.outcome.R || 0 : 0); }, 0) / closed.length : null;
    var label = { open: "Waiting for entry", triggered: "In trade", target_hit: "Target 1 hit", stopped: "Stopped out", expired: "Time limit", not_triggered: "Never entered" };
    var h = '<div class="card"><h2>Track record</h2><p class="small muted">Every Watch / Conditional-entry idea is kept, including losers. Outcomes are checked against daily bars: entry = first session price trades in the zone; if the stop and target are touched the same day it counts as a loss.</p>' +
      '<dl class="kv"><div><dt>Ideas saved</dt><dd>' + rec.length + "</dd></div><div><dt>Closed</dt><dd>" + closed.length + "</dd></div><div><dt>Winners</dt><dd>" + wins + "</dd></div><div><dt>Average R (closed)</dt><dd>" + (avgR == null ? "—" : (avgR >= 0 ? "+" : "−") + Math.abs(avgR).toFixed(2) + "R") + "</dd></div></dl>";
    if (!rec.length) return h + '<p class="muted">No ideas yet.</p></div>';
    h += '<div class="tbl-wrap"><table class="mini rec"><thead><tr><th>Date</th><th>Ticker</th><th>Idea</th><th>Status</th><th>Outcome</th></tr></thead><tbody>' +
      rec.map(function (r) {
        var o = r.outcome || {};
        return "<tr><td>" + e(r.trade_date.slice(5)) + "</td><td>" + e(r.symbol) + "</td><td>" + e(r.side) + " · " + e(r.setup) + "</td><td>" + e(r.status) + "</td><td>" + e(label[r.outcome_status] || r.outcome_status) + (o.R != null ? ' <span class="' + W().dir(o.R) + '">' + (o.R >= 0 ? "+" : "−") + Math.abs(o.R).toFixed(2) + "R</span>" : "") + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
    return h;
  }

  function render() {
    var run = data && data.run;
    if (!run) {
      $("ideasBody").innerHTML = '<div class="empty"><strong>No trade ideas yet</strong>Ideas are generated each trading day at 6:00 AM Pacific.</div>';
      return;
    }
    var stale = run.trade_date < expectedSession();
    var h = "";
    if (stale) h += '<div class="error-box"><span>These ideas are from ' + e(W().dateOnly(run.trade_date)) + ". A newer session should exist, so the data may be stale (the 6 AM job may not have run).</span></div>";
    h += '<p class="meta">Ideas use end-of-day data through ' + e(W().dateOnly(run.trade_date)) + " (New York time). Generated " + e(W().etTime(run.generatedAt)) + ". Sources: " +
      ["prices", "quotes", "news", "filings"].map(function (k) { return run.sources && run.sources[k] ? link(run.sources[k].url, run.sources[k].name) : ""; }).filter(Boolean).join(" · ") + "</p>";
    h += marketHtml(run);
    var setups = (data.ideas || []).filter(function (i) { return i.side !== "none"; });
    var none = (data.ideas || []).filter(function (i) { return i.side === "none"; });
    h += '<h2 class="sec-title">Setups <span class="count">· ' + setups.length + "</span></h2>";
    h += setups.length ? setups.map(ideaHtml).join("") : '<div class="empty">No setups met the rules for this session.</div>';
    if ((data.active || []).length) h += '<h2 class="sec-title">Still in trade (from earlier days)</h2>' + data.active.map(ideaHtml).join("");
    if (none.length) h += '<h2 class="sec-title">Your watchlist: no clear setup</h2>' + none.map(ideaHtml).join("");
    h += alertsHtml() + recordHtml(data.record || []);
    h += '<p class="disclaimer">Not financial advice. Setups are rule-based patterns that often fail, and no outcome is guaranteed. Position-specific hold/sell guidance is only given when you share your holdings. No brokerage is connected and nothing is traded automatically.</p>';
    $("ideasBody").innerHTML = h;
    $("ideasBody").querySelectorAll(".chart-btn").forEach(function (b) { b.onclick = function () { toggleChart(b); }; });
  }

  function toggleChart(btn) {
    var id = btn.dataset.id, box = $("ch-" + id);
    var idea = (data.ideas || []).concat(data.active || []).find(function (i) { return i.id === id; });
    if (!box.hidden) { box.hidden = true; btn.textContent = "Show chart with levels"; return; }
    box.hidden = false; btn.textContent = "Hide chart";
    if (charts[id]) return;
    box.innerHTML = '<div class="muted small" style="padding:1rem">Loading chart…</div>';
    W().api("history?symbol=" + encodeURIComponent(idea.symbol) + "&range=6M").then(function (d) {
      box.innerHTML = "";
      var LC = window.LightweightCharts;
      var ch = LC.createChart(box, { autoSize: true, layout: { background: { type: "solid", color: "transparent" }, textColor: "#9eabc4" }, grid: { vertLines: { color: "rgba(148,170,210,.06)" }, horzLines: { color: "rgba(148,170,210,.08)" } }, rightPriceScale: { borderColor: "rgba(148,170,210,.14)" }, timeScale: { borderColor: "rgba(148,170,210,.14)" }, handleScroll: { vertTouchDrag: false } });
      var s = ch.addSeries(LC.CandlestickSeries, { upColor: "#4ade80", downColor: "#ff8a8a", borderVisible: false, wickUpColor: "#4ade80", wickDownColor: "#ff8a8a" });
      s.setData(d.points.map(function (p) { return { time: p.t, open: p.o, high: p.h, low: p.l, close: p.c }; }));
      var line = function (price, color, title, style) { s.createPriceLine({ price: price, color: color, lineWidth: 2, lineStyle: style || 0, axisLabelVisible: true, title: title }); };
      line(idea.entry.low, "#7cb2ff", "entry", 2); line(idea.entry.high, "#7cb2ff", "entry", 2);
      line(idea.stop.price, "#ff8a8a", "stop");
      (idea.targets || []).forEach(function (t, k) { line(t.price, "#4ade80", "T" + (k + 1), 1); });
      ch.timeScale().fitContent(); charts[id] = ch;
    }).catch(function (err) { box.innerHTML = '<div class="error-box"><span>' + e(err.message) + "</span></div>"; });
  }

  function load() {
    if (loading) return; loading = true;
    if (!data) $("ideasBody").innerHTML = '<div class="skel" style="height:160px"></div><div class="skel" style="height:260px;margin-top:1rem"></div>';
    Promise.all([W().api("ideas"), W().api("alerts").catch(function () { return { alerts: [] }; })]).then(function (r) {
      data = r[0]; alerts = r[1].alerts || []; charts = {}; render();
    }).catch(function (err) {
      $("ideasBody").innerHTML = '<div class="error-box"><span>Couldn\'t load trade ideas: ' + e(err.message) + '</span><button class="ghost small" type="button" id="ideasRetry">Try again</button></div>';
      $("ideasRetry").onclick = load;
    }).then(function () { loading = false; });
  }

  window.WLIdeas = { open: load };
})();
