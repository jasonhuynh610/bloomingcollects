(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var data = null, loading = false;
  try { $("hideCheap").checked = localStorage.getItem("wl-hide-cheap") === "1"; } catch (e) {}

  function fmtVol(n) {
    if (n == null) return "—";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
    return String(n);
  }

  function table(title, sub, list, key) {
    var W = window.WL, e = W.esc;
    if (!list || !list.length) return '<div class="card scan-card"><h2>' + e(title) + '</h2><p class="muted">No stocks matched.</p></div>';
    return '<div class="card scan-card"><h2>' + e(title) + '</h2><p class="muted small">' + e(sub) + "</p>" +
      '<ol class="scan-list">' + list.map(function (r, i) {
        var news = (r.news || []).map(function (n) {
          return '<li><a href="' + e(W.safeUrl(n.url)) + '" target="_blank" rel="noopener">' + e(n.headline) + "</a><span>" + e(n.source) + " · " + e(W.etTime(n.datetime)) + "</span></li>";
        }).join("");
        var watched = W.has(r.symbol);
        return '<li class="scan-row">' +
          '<div class="rank">' + (i + 1) + "</div>" +
          '<div class="who"><div class="sym">' + e(r.symbol) + '</div><div class="nm">' + e(r.name) + "</div></div>" +
          '<div class="px">' + W.money(r.price) + '<div class="' + W.dir(r.changePct) + '">' + W.signed(r.changePct, "", "%", 2) + "</div></div>" +
          '<dl class="stats"><div><dt>Volume</dt><dd' + (key === "volume" ? ' class="hl"' : "") + ">" + fmtVol(r.volume) + "</dd></div>" +
          "<div><dt>Rel. volume</dt><dd" + (key === "rvol" ? ' class="hl"' : "") + ">" + (r.rvol != null ? r.rvol.toFixed(2) + "×" : "—") + "</dd></div>" +
          "<div><dt>20-day avg</dt><dd>" + fmtVol(r.avgVolume20) + "</dd></div></dl>" +
          '<div class="scan-actions">' +
          (news ? '<details><summary>News (' + r.news.length + ")</summary><ul class=\"news\">" + news + "</ul></details>" : '<span class="muted small">No company news in the last 2 days</span>') +
          '<button type="button" class="ghost small watch-btn" data-sym="' + e(r.symbol) + '" data-name="' + e(r.name) + '"' + (watched ? " disabled" : "") + ">" + (watched ? "On watchlist" : "+ Watch") + "</button>" +
          "</div></li>";
      }).join("") + "</ol></div>";
  }

  function render() {
    var W = window.WL, e = W.esc, s = data && data.scan;
    if (!s) {
      $("scanMeta").innerHTML = "";
      $("scanBody").innerHTML = '<div class="empty"><strong>No scan yet</strong>The scanner runs every trading day at 1:30 PM Pacific, after the market closes. The first results will appear here after the next run.</div>';
      $("methodText").innerHTML = "";
      return;
    }
    var cheap = $("hideCheap").checked;
    var src = s.sources.prices;
    $("scanMeta").innerHTML =
      '<span class="pill">End-of-day data · not real-time</span> ' +
      "<span>Session: <b>" + e(W.dateOnly(s.trade_date)) + "</b> (market time zone: New York, ET)</span>" +
      "<span>Scanned " + e(W.etTime(s.generated_at)) + " · " + Number(s.universe).toLocaleString() + " US-listed stocks &amp; ETFs</span>" +
      '<span>Prices &amp; volume: <a href="' + e(W.safeUrl(src.url)) + '" target="_blank" rel="noopener">' + e(src.name) + "</a>, retrieved " + e(W.etTime(src.retrievedAt)) + "</span>" +
      '<span>News: <a href="' + e(W.safeUrl(s.sources.news.url)) + '" target="_blank" rel="noopener">' + e(s.sources.news.name) + "</a>, retrieved " + e(W.etTime(s.sources.news.retrievedAt)) + "</span>" +
      (data.dates && data.dates.length > 1 ? '<label class="past">Past scans <select id="scanDate">' + data.dates.map(function (d) { return '<option value="' + e(d) + '"' + (d === s.trade_date ? " selected" : "") + ">" + e(W.dateOnly(d)) + "</option>"; }).join("") + "</select></label>" : "");
    $("scanBody").innerHTML = '<div class="scan-grid">' +
      table("Top 10 by shares traded", "Most shares changed hands this session" + (cheap ? " (priced $5 and up)." : "."), cheap ? s.lists.volume5 : s.lists.volume, "volume") +
      table("Top 10 by relative volume", "Most unusual volume vs each stock's own 20-day average" + (cheap ? " (priced $5 and up)." : "."), cheap ? s.lists.rvol5 : s.lists.rvol, "rvol") +
      "</div>";
    var m = s.method;
    $("methodText").innerHTML = "<p><b>Relative volume</b>: " + e(m.rvol) + "</p><p>" + e(m.rvolFilters) + "</p>" +
      "<p><b>Intraday scans</b> would compare like-for-like times of day (e.g. volume by 10:00 AM today vs the average volume by 10:00 AM over the past 20 days), because comparing a partial day with full days understates activity. This scan runs after the close, so full days are compared.</p>" +
      "<p><b>Which stocks</b>: " + e(m.universe) + "</p><p>" + e(m.change) + "</p>" +
      "<p>News is matched to each company by name or ticker and may not explain the move. Nothing here is a recommendation.</p>";
    var sel = $("scanDate"); if (sel) sel.onchange = function () { load(sel.value); };
    $("scanBody").querySelectorAll(".watch-btn").forEach(function (b) {
      b.onclick = function () {
        b.disabled = true; b.textContent = "Adding…";
        W.add(b.dataset.sym, b.dataset.name).then(function () { b.textContent = "On watchlist"; }, function (err) { b.disabled = false; b.textContent = "+ Watch"; W.toast(err.message); });
      };
    });
  }

  function load(date) {
    if (loading) return; loading = true;
    $("scanBody").innerHTML = '<div class="skel" style="height:220px"></div>';
    window.WL.api("scan" + (date ? "?date=" + encodeURIComponent(date) : "")).then(function (d) { data = d; render(); })
      .catch(function (err) {
        $("scanBody").innerHTML = '<div class="error-box"><span>Couldn\'t load scanner results: ' + window.WL.esc(err.message) + '</span><button class="ghost small" type="button" id="scanRetry">Try again</button></div>';
        $("scanRetry").onclick = function () { load(date); };
      })
      .then(function () { loading = false; });
  }

  $("hideCheap").onchange = function () {
    try { localStorage.setItem("wl-hide-cheap", $("hideCheap").checked ? "1" : "0"); } catch (e) {}
    render();
  };

  window.WLScanner = { open: function () { if (data) render(); load(data && data.scan ? data.scan.trade_date : null); } };
})();
