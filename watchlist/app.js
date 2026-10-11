(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var MINUS = "−";
  var ET = "America/New_York";
  var state = { items: [], quotes: {}, sort: { key: "symbol", dir: "asc" }, current: null, range: "3M" };
  try { var s = JSON.parse(localStorage.getItem("wl-sort")); if (s && s.key) state.sort = s; } catch (e) {}

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : "#"; }
  function money(n) { return n == null || isNaN(n) ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function signed(n, pre, suf, digits) {
    if (n == null || isNaN(n)) return "—";
    var a = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return (n > 0 ? "+" : n < 0 ? MINUS : "±") + pre + a + suf;
  }
  function dir(n) { return n > 0 ? "up" : n < 0 ? "down" : "flat"; }
  function etTime(ms, withDate) {
    if (!ms) return "—";
    var o = { timeZone: ET, hour: "numeric", minute: "2-digit" };
    if (withDate !== false) { o.month = "short"; o.day = "numeric"; }
    return new Date(ms).toLocaleString("en-US", o) + " ET";
  }
  function dateOnly(s) { var d = new Date(s + "T12:00:00Z"); return isNaN(d) ? s : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 3200); }

  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || "GET", credentials: "same-origin", headers: {} };
    if (opts.body !== undefined) { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(opts.body); }
    return fetch("/api/" + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && path !== "login") { showLogin(); throw new Error("Please sign in."); }
        if (!r.ok) throw new Error(d.error || "Something went wrong (" + r.status + ").");
        return d;
      });
    }, function () { throw new Error("Can't reach the server. Check your connection."); });
  }

  function show(id) {
    ["loginView", "listView", "detailView", "scanView", "ideasView"].forEach(function (v) { $(v).hidden = v !== id; });
    $("logout").hidden = id === "loginView";
    $("tabs").hidden = id === "loginView" || id === "detailView";
    $("tabList").setAttribute("aria-current", id === "listView" ? "page" : "false");
    $("tabScan").setAttribute("aria-current", id === "scanView" ? "page" : "false");
    $("tabIdeas").setAttribute("aria-current", id === "ideasView" ? "page" : "false");
    window.scrollTo(0, 0);
  }

  // ---------- login ----------
  function showLogin() { show("loginView"); setTimeout(function () { $("pw").focus(); }, 50); }
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = $("loginBtn"); btn.disabled = true; btn.textContent = "Signing in…"; $("loginErr").textContent = "";
    api("login", { method: "POST", body: { password: $("pw").value } })
      .then(function () { $("pw").value = ""; boot(); })
      .catch(function (err) { $("loginErr").textContent = err.message; })
      .then(function () { btn.disabled = false; btn.textContent = "Sign in"; });
  });
  $("logout").onclick = function () { api("logout", { method: "POST" }).then(showLogin, showLogin); };

  // ---------- list ----------
  function loadList() {
    $("rows").innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
    $("listMeta").textContent = "";
    return api("watchlist").then(function (d) {
      state.items = d.items || [];
      renderRows();
      return refreshQuotes();
    }).catch(function (err) {
      if (/sign in/i.test(err.message)) return;
      $("rows").innerHTML = '<div class="error-box"><span>Couldn\'t load your watchlist: ' + esc(err.message) + '</span><button class="ghost small" type="button" id="retry">Try again</button></div>';
      $("retry").onclick = loadList;
    });
  }

  function refreshQuotes() {
    if (!state.items.length) return Promise.resolve();
    var syms = state.items.map(function (i) { return i.symbol; }).join(",");
    return api("quotes?symbols=" + encodeURIComponent(syms)).then(function (d) {
      state.quotes = d.quotes || {};
      renderRows();
      if (state.current) renderDetailPrice();
    }).catch(function (err) {
      if (!/sign in/i.test(err.message)) $("listMeta").textContent = "Prices couldn't be updated: " + err.message;
    });
  }

  function metric(item, key) {
    var q = state.quotes[item.symbol] || {};
    if (key === "symbol") return item.symbol;
    if (key === "price") return q.price;
    if (key === "changePct") return q.changePct;
    if (key === "toTarget") return item.target && q.price ? (item.target - q.price) / q.price * 100 : null;
  }

  function renderRows() {
    $("count").textContent = state.items.length ? "· " + state.items.length : "";
    document.querySelectorAll(".sort button").forEach(function (b) {
      var on = b.dataset.sort === state.sort.key;
      b.setAttribute("aria-pressed", on); if (on) b.dataset.dir = state.sort.dir; else delete b.dataset.dir;
    });
    if (!state.items.length) {
      $("rows").innerHTML = '<div class="empty"><strong>Your watchlist is empty</strong>Search above for a company or ticker (like "Apple" or "NVDA") and tap it to add.</div>';
      $("listMeta").textContent = "";
      return;
    }
    var k = state.sort.key, m = state.sort.dir === "asc" ? 1 : -1;
    var list = state.items.slice().sort(function (a, b) {
      var x = metric(a, k), y = metric(b, k);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * m;
    });
    $("rows").innerHTML = list.map(function (it) {
      var q = state.quotes[it.symbol] || {};
      var tg = it.target ? "Target " + money(it.target) + (q.price ? " · " + signed((it.target - q.price) / q.price * 100, "", "% away", 1) : "") : "";
      var chg = q.error ? '<span class="flat">' + esc(q.error) + "</span>"
        : q.price == null ? '<span class="flat">Loading…</span>'
        : '<span class="' + dir(q.change) + '">' + signed(q.change, "$", "", 2) + " (" + signed(q.changePct, "", "%", 2) + ")</span>";
      return '<button class="row" type="button" data-sym="' + esc(it.symbol) + '" aria-label="Open ' + esc(it.symbol) + ", " + esc(it.name) + '">' +
        '<div class="left"><div class="sym">' + esc(it.symbol) + '</div><div class="nm">' + esc(it.name) + "</div></div>" +
        '<div class="px">' + (q.price != null ? money(q.price) : "—") + "</div>" +
        '<div class="chg">' + chg + "</div>" +
        '<div class="tg">' + esc(tg) + "</div></button>";
    }).join("");
    $("rows").querySelectorAll(".row").forEach(function (b) { b.onclick = function () { location.hash = "#/" + b.dataset.sym; }; });
    var times = Object.values(state.quotes).map(function (q) { return q.asOf; }).filter(Boolean);
    var fetched = Object.values(state.quotes).map(function (q) { return q.fetchedAt; }).filter(Boolean);
    $("listMeta").innerHTML = times.length
      ? "Latest prices as of " + esc(etTime(Math.max.apply(null, times))) + " · market time zone: New York (ET) · free data, may be delayed up to 15 min · source: <a href=\"https://finnhub.io\" target=\"_blank\" rel=\"noopener\">Finnhub</a>, fetched " + esc(etTime(Math.max.apply(null, fetched))) + " · refreshes every minute"
      : "";
  }

  document.querySelectorAll(".sort button").forEach(function (b) {
    b.onclick = function () {
      var k = b.dataset.sort;
      state.sort = state.sort.key === k ? { key: k, dir: state.sort.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "symbol" ? "asc" : "desc" };
      try { localStorage.setItem("wl-sort", JSON.stringify(state.sort)); } catch (e) {}
      renderRows();
    };
  });

  // ---------- search ----------
  var q = $("q"), results = $("results"), sel = -1, found = [], timer;
  function closeResults() { results.hidden = true; $("searchBox").setAttribute("aria-expanded", "false"); sel = -1; }
  function renderResults(html) { results.innerHTML = html; results.hidden = false; $("searchBox").setAttribute("aria-expanded", "true"); }
  q.addEventListener("input", function () {
    clearTimeout(timer);
    var term = q.value.trim();
    if (!term) { closeResults(); return; }
    timer = setTimeout(function () {
      renderResults('<li class="info">Searching…</li>');
      api("search?q=" + encodeURIComponent(term)).then(function (d) {
        if (q.value.trim() !== term) return;
        found = d.results || [];
        if (!found.length) { renderResults('<li class="info">No US stocks or ETFs match "' + esc(term) + '".</li>'); return; }
        renderResults(found.map(function (r, i) {
          var have = state.items.some(function (it) { return it.symbol === r.symbol; });
          return '<li role="option" id="opt' + i + '" data-i="' + i + '" aria-selected="false"><span class="sym">' + esc(r.symbol) + '</span><span class="nm">' + esc(r.name) + '</span><span class="add">' + (have ? "Added" : "+ Add") + "</span></li>";
        }).join(""));
        results.querySelectorAll("li[data-i]").forEach(function (li) { li.onclick = function () { add(found[+li.dataset.i]); }; });
      }).catch(function (err) { renderResults('<li class="info">' + esc(err.message) + "</li>"); });
    }, 280);
  });
  q.addEventListener("keydown", function (e) {
    var opts = results.querySelectorAll("li[data-i]");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!opts.length) return; e.preventDefault();
      sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
      opts.forEach(function (o, i) { o.setAttribute("aria-selected", i === sel); });
      q.setAttribute("aria-activedescendant", "opt" + sel);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sel >= 0 && found[sel]) add(found[sel]); else if (found[0]) add(found[0]);
    } else if (e.key === "Escape") closeResults();
  });
  document.addEventListener("click", function (e) { if (!$("searchBox").contains(e.target)) closeResults(); });

  function add(r) {
    if (state.items.some(function (it) { return it.symbol === r.symbol; })) { toast(r.symbol + " is already on your watchlist."); closeResults(); return; }
    renderResults('<li class="info">Adding ' + esc(r.symbol) + "…</li>");
    api("watchlist", { method: "POST", body: { symbol: r.symbol, name: r.name } }).then(function (d) {
      state.items.push(d.item); q.value = ""; closeResults(); renderRows(); refreshQuotes();
      toast("Added " + r.symbol + ". Its first briefing arrives with the next 6:00 AM update.");
    }).catch(function (err) { renderResults('<li class="info">' + esc(err.message) + "</li>"); });
  }

  // ---------- detail ----------
  var chart, series, chartObs;
  var RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];
  $("ranges").innerHTML = RANGES.map(function (r) { return '<button type="button" data-r="' + r + '">' + r + "</button>"; }).join("");
  $("ranges").querySelectorAll("button").forEach(function (b) { b.onclick = function () { state.range = b.dataset.r; loadChart(); }; });
  $("back").onclick = function () { location.hash = ""; };

  function openDetail(sym) {
    var it = state.items.find(function (i) { return i.symbol === sym; });
    if (!it) { location.hash = ""; return; }
    state.current = it;
    show("detailView");
    $("dSym").textContent = it.symbol; $("dName").textContent = it.name + (it.exchange ? " · " + it.exchange : "");
    $("notes").value = it.notes || ""; $("target").value = it.target != null ? it.target : ""; $("saved").textContent = "";
    renderDetailPrice(); loadChart(); loadBriefing();
  }

  function renderDetailPrice() {
    var it = state.current, qq = state.quotes[it.symbol] || {};
    $("dPrice").textContent = qq.price != null ? money(qq.price) : "—";
    $("dChange").innerHTML = qq.price != null ? '<span class="' + dir(qq.change) + '">' + signed(qq.change, "$", "", 2) + " (" + signed(qq.changePct, "", "%", 2) + ") today</span>" : "";
    $("dMeta").innerHTML = qq.asOf ? "As of " + esc(etTime(qq.asOf)) + " · may be delayed up to 15 min · source: <a href=\"https://finnhub.io\" target=\"_blank\" rel=\"noopener\">Finnhub</a>" : "";
    $("toTarget").textContent = it.target && qq.price ? signed((it.target - qq.price) / qq.price * 100, "", "% from current price", 1) : "";
  }

  function ensureChart() {
    if (chart || !window.LightweightCharts) return;
    var LC = window.LightweightCharts;
    chart = LC.createChart($("chart"), {
      autoSize: true,
      layout: { background: { type: "solid", color: "transparent" }, textColor: "#9eabc4", fontFamily: "Inter, system-ui, sans-serif" },
      grid: { vertLines: { color: "rgba(148,170,210,.06)" }, horzLines: { color: "rgba(148,170,210,.08)" } },
      rightPriceScale: { borderColor: "rgba(148,170,210,.14)" },
      timeScale: { borderColor: "rgba(148,170,210,.14)", timeVisible: true },
      crosshair: { mode: 1 },
      handleScroll: { vertTouchDrag: false },
      localization: { priceFormatter: function (p) { return "$" + p.toFixed(2); } },
    });
    series = chart.addSeries(LC.AreaSeries, { lineColor: "#7cb2ff", topColor: "rgba(124,178,255,.28)", bottomColor: "rgba(124,178,255,0)", lineWidth: 2, priceLineVisible: false });
  }

  // Twelve Data returns exchange-local times ("2026-10-09 15:55:00"); show them as ET on the axis
  function toChartTime(t) {
    if (t.length <= 10) return t;
    var p = t.split(/[- :]/).map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4]) / 1000;
  }

  function chartOverlay(html) {
    var o = $("chart").querySelector(".overlay");
    if (!html) { if (o) o.remove(); return; }
    if (!o) { o = document.createElement("div"); o.className = "overlay"; $("chart").appendChild(o); }
    o.innerHTML = html;
  }

  function loadChart() {
    var it = state.current, range = state.range;
    $("ranges").querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.r === range); });
    ensureChart();
    chartOverlay("Loading chart…"); $("chartMeta").textContent = "";
    api("history?symbol=" + encodeURIComponent(it.symbol) + "&range=" + range).then(function (d) {
      if (state.current !== it || state.range !== range) return;
      if (!d.points || !d.points.length) { chartOverlay("No chart data for this range."); series.setData([]); return; }
      var first = d.points[0].c, last = d.points[d.points.length - 1].c, up = last >= first;
      series.applyOptions(up
        ? { lineColor: "#4ade80", topColor: "rgba(74,222,128,.22)", bottomColor: "rgba(74,222,128,0)" }
        : { lineColor: "#ff8a8a", topColor: "rgba(255,138,138,.22)", bottomColor: "rgba(255,138,138,0)" });
      series.setData(d.points.map(function (p) { return { time: toChartTime(p.t), value: p.c }; }));
      chart.applyOptions({ timeScale: { timeVisible: d.interval.indexOf("min") > -1 } });
      chart.timeScale().fitContent();
      chartOverlay("");
      var chg = (last - first) / first * 100;
      $("chartMeta").innerHTML = range + ": <span class=\"" + dir(chg) + "\">" + signed(chg, "", "%", 2) + "</span> · times in ET (New York) · last bar " + esc(d.points[d.points.length - 1].t) +
        " · source: <a href=\"" + esc(safeUrl(d.sourceUrl)) + "\" target=\"_blank\" rel=\"noopener\">Twelve Data</a>, fetched " + esc(etTime(d.fetchedAt)) + (d.stale ? " (older copy — live data unavailable)" : "");
    }).catch(function (err) {
      if (state.current !== it) return;
      chartOverlay(esc(err.message) + '<br><button class="ghost small" type="button" id="chartRetry" style="margin-top:.75rem">Try again</button>');
      var b = $("chartRetry"); if (b) b.onclick = loadChart;
    });
  }

  // notes + target autosave
  var saveTimer;
  function save(field, value) {
    var it = state.current; $("saved").textContent = "Saving…";
    var body = {}; body[field] = value;
    api("watchlist/" + encodeURIComponent(it.symbol), { method: "PATCH", body: body }).then(function (d) {
      Object.assign(it, d.item); $("saved").textContent = "Saved"; renderDetailPrice();
    }).catch(function (err) { $("saved").textContent = "Not saved: " + err.message; });
  }
  $("notes").addEventListener("input", function () { clearTimeout(saveTimer); $("saved").textContent = ""; saveTimer = setTimeout(function () { save("notes", $("notes").value); }, 800); });
  $("target").addEventListener("change", function () { save("target", $("target").value === "" ? null : Number($("target").value)); });
  $("remove").onclick = function () {
    var it = state.current;
    if (!confirm("Remove " + it.symbol + " from your watchlist? Your notes and target for it will be deleted.")) return;
    api("watchlist/" + encodeURIComponent(it.symbol), { method: "DELETE" }).then(function () {
      state.items = state.items.filter(function (i) { return i !== it; }); toast("Removed " + it.symbol + "."); location.hash = "";
    }).catch(function (err) { toast(err.message); });
  };

  // ---------- briefing ----------
  function loadBriefing() {
    var it = state.current, box = $("briefing");
    box.innerHTML = '<h2>Daily briefing</h2><div class="skel" style="height:140px"></div>';
    api("briefing?symbol=" + encodeURIComponent(it.symbol)).then(function (d) {
      if (state.current !== it) return;
      box.innerHTML = d.briefing ? briefingHtml(d.briefing)
        : '<h2>Daily briefing</h2><p class="muted">No briefing yet for ' + esc(it.symbol) + ". A new one is written each trading day at 6:00 AM Pacific, covering the previous session. It will show up here after the next update.</p>";
    }).catch(function (err) {
      if (state.current !== it) return;
      box.innerHTML = '<h2>Daily briefing</h2><div class="error-box"><span>' + esc(err.message) + '</span><button class="ghost small" type="button" id="bRetry">Try again</button></div>';
      $("bRetry").onclick = loadBriefing;
    });
  }

  function briefingHtml(b) {
    var c = b.calculated || {}, s = b.sourced || {}, ai = b.interpretation || {};
    var kv = [
      ["Close", money(c.close)],
      ["Day change", signed(c.changePct, "", "%", 2)],
      ["5-day", signed(c.change5d, "", "%", 1)],
      ["1-month", signed(c.change1m, "", "%", 1)],
      ["Volume vs 20-day avg", c.volumeRatio != null ? c.volumeRatio.toFixed(2) + "×" : "—"],
      ["RSI (14)", c.rsi14 != null ? c.rsi14.toFixed(0) : "—"],
      ["20-day avg", money(c.sma20)],
      ["50-day avg", money(c.sma50)],
      ["200-day avg", money(c.sma200)],
      ["52-week range", c.low52 != null ? money(c.low52) + " – " + money(c.high52) : "—"],
    ];
    var h = '<h2>Daily briefing <small>for the ' + esc(dateOnly(b.trade_date)) + " session</small></h2>";
    h += '<div class="bsec" style="border:0;margin:0;padding:0"><span class="badge b-calc">Calculated</span>' +
      '<p class="muted" style="font-size:.85rem;margin:0 0 .6rem">Math on daily price and volume data. No opinions.</p>' +
      '<dl class="kv">' + kv.map(function (p) { return "<div><dt>" + esc(p[0]) + "</dt><dd>" + esc(p[1]) + "</dd></div>"; }).join("") + "</dl>";
    if (c.signals && c.signals.length) h += '<ul class="signals">' + c.signals.map(function (x) { return "<li><b>" + esc(x.label) + ":</b> " + esc(x.plain) + "</li>"; }).join("") + "</ul>";
    if (c.source) h += '<p class="meta">Price data: <a href="' + esc(safeUrl(c.source.url)) + '" target="_blank" rel="noopener">' + esc(c.source.name) + "</a>, retrieved " + esc(etTime(c.source.fetchedAt)) + "</p>";
    h += "</div>";

    h += '<div class="bsec"><span class="badge b-src">Sourced facts</span>';
    var e = s.earnings;
    h += "<p style=\"margin:0 0 .6rem\"><b>Next earnings:</b> " + (e && e.date ? esc(dateOnly(e.date)) + (e.hour === "bmo" ? " (before market open)" : e.hour === "amc" ? " (after market close)" : "") + (e.epsEstimate != null ? " · EPS estimate $" + esc(e.epsEstimate) : "") : "None scheduled in the next 90 days (per Finnhub)") + "</p>";
    if (s.news && s.news.length) {
      h += '<ul class="news">' + s.news.map(function (n) {
        return '<li><a href="' + esc(safeUrl(n.url)) + '" target="_blank" rel="noopener">' + esc(n.headline) + "</a><span>" + esc(n.source) + " · " + esc(etTime(n.datetime)) + "</span></li>";
      }).join("") + "</ul>";
    } else h += '<p class="muted">No company news in the last 3 days.</p>';
    if (s.source) h += '<p class="meta">News &amp; earnings: <a href="' + esc(safeUrl(s.source.url)) + '" target="_blank" rel="noopener">' + esc(s.source.name) + "</a>, retrieved " + esc(etTime(s.source.fetchedAt)) + "</p>";
    h += "</div>";

    h += '<div class="bsec"><span class="badge b-ai">AI interpretation</span>';
    if (ai.summary) h += "<p style=\"margin:0 0 .5rem\">" + esc(ai.summary) + "</p>";
    if (ai.whatToWatch && ai.whatToWatch.length) h += "<b>What to watch</b><ul class=\"watch\">" + ai.whatToWatch.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul>";
    h += '<p class="disclaimer">Written by ' + esc(ai.author || "an AI assistant") + " on " + esc(etTime(b.generated_at)) + " from the data above. This is an interpretation, not a prediction or financial advice. Signals like RSI and moving averages describe the past and often fail.</p></div>";
    return h;
  }

  // ---------- routing / boot ----------
  function route() {
    if (location.hash === "#/scanner") { state.current = null; show("scanView"); if (window.WLScanner) window.WLScanner.open(); return; }
    if (location.hash === "#/ideas") { state.current = null; show("ideasView"); if (window.WLIdeas) window.WLIdeas.open(); return; }
    var m = location.hash.match(/^#\/([A-Z0-9.\-]{1,12})$/i);
    if (m) openDetail(m[1].toUpperCase());
    else { state.current = null; show("listView"); renderRows(); }
  }
  window.addEventListener("hashchange", function () { if (!$("loginView").hidden) return; route(); });

  // shared with scanner.js
  window.WL = {
    api: api, esc: esc, safeUrl: safeUrl, money: money, signed: signed, dir: dir, etTime: etTime, dateOnly: dateOnly, toast: toast,
    has: function (sym) { return state.items.some(function (i) { return i.symbol === sym; }); },
    add: function (sym, name) {
      return api("watchlist", { method: "POST", body: { symbol: sym, name: name } }).then(function (d) {
        state.items.push(d.item); refreshQuotes(); toast("Added " + sym + " to your watchlist."); return d.item;
      });
    },
  };

  var poll;
  function boot() {
    api("me").then(function () {
      show("listView");
      return loadList().then(route);
    }).catch(function () {});
    clearInterval(poll);
    poll = setInterval(function () { if (!document.hidden && $("loginView").hidden) refreshQuotes(); }, 60000);
  }
  boot();
})();
