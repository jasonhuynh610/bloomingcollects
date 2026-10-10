(function () {
  var data = window.TRAVEL || [];
  var journal = document.getElementById("journal");
  var nav = document.getElementById("countryNav");
  var all = [];
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  data.forEach(function (c) {
    if (!c.photos || !c.photos.length) return;
    var a = document.createElement("a");
    a.href = "#" + c.id; a.textContent = c.name; nav.appendChild(a);

    var sec = document.createElement("section");
    sec.className = "country"; sec.id = c.id;
    sec.innerHTML = '<div class="country-head"><h2>' + c.name + (c.native ? '<span class="native">' + c.native + "</span>" : "") +
      '</h2><span class="count">' + c.photos.length + " photographs</span></div>";
    var grid = document.createElement("div"); grid.className = "gallery" + (c.tile ? " dense" : "");
    var lastFeat = -99;
    c.photos.forEach(function (p, i) {
      var idx = all.length;
      all.push({ src: c.dir + p.id + "-lg.webp", alt: c.name + ", photo " + (i + 1) + " of " + c.photos.length });
      // feature a landscape shot roughly every 7 photos
      var feat = p.w > p.h && i - lastFeat >= 7;
      if (feat) lastFeat = i;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "photo" + (feat ? " feature" : "");
      b.style.setProperty("--d", (feat ? 0 : (i % 2) * 0.12) + "s");
      b.style.setProperty("--ar", feat ? (p.w + "/" + p.h) : (c.tile || "3/2"));
      b.setAttribute("aria-label", "Open " + all[idx].alt);
      var img = new Image();
      img.loading = i < 3 ? "eager" : "lazy";
      img.decoding = "async";
      img.alt = all[idx].alt;
      img.sizes = feat ? "(min-width: 900px) 66vw, 100vw" : "(min-width: 900px) 33vw, 50vw";
      img.srcset = c.dir + p.id + "-sm.webp 800w, " + c.dir + p.id + "-lg.webp 2000w";
      img.src = c.dir + p.id + "-sm.webp";
      img.onload = function () { img.classList.add("loaded"); };
      b.appendChild(img);
      b.onclick = function () { open(idx); };
      grid.appendChild(b);
      (c.videos || []).forEach(function (v) { if (v.after === p.id) grid.appendChild(clip(c, v)); });
    });
    sec.appendChild(grid);
    journal.appendChild(sec);
  });

  // autoplaying clip: muted + playsinline so iPhone allows autoplay; tap toggles sound
  function clip(c, v) {
    var w = document.createElement("div"); w.className = "photo clip";
    var vid = document.createElement("video");
    vid.muted = true; vid.loop = true; vid.playsInline = true; vid.autoplay = !reduce;
    vid.setAttribute("muted", ""); vid.setAttribute("playsinline", "");
    vid.preload = "metadata"; vid.poster = c.dir + v.poster; vid.src = c.dir + v.src;
    vid.setAttribute("aria-label", c.name + ", video");
    var snd = document.createElement("button");
    snd.type = "button"; snd.className = "clip-sound"; snd.textContent = "🔇"; snd.setAttribute("aria-label", "Turn sound on");
    snd.onclick = function () {
      vid.muted = !vid.muted; snd.textContent = vid.muted ? "🔇" : "🔊";
      snd.setAttribute("aria-label", vid.muted ? "Turn sound on" : "Turn sound off");
      if (vid.paused) vid.play();
    };
    w.appendChild(vid); w.appendChild(snd);
    if (reduce) vid.controls = true;
    else new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); } else vid.pause(); });
    }, { threshold: 0.25 }).observe(w);
    return w;
  }

  // lightbox
  var lb = document.getElementById("lightbox"), lbImg = document.getElementById("lbImg"), count = document.getElementById("lbCount");
  var cur = 0, lastFocus = null;
  function show(i) {
    lbImg.style.setProperty("--dir", (i > cur ? 30 : -30) + "px");
    cur = (i + all.length) % all.length;
    lbImg.classList.add("swap");
    var next = new Image();
    next.onload = next.onerror = function () { lbImg.src = all[cur].src; lbImg.alt = all[cur].alt; lbImg.classList.remove("swap"); };
    next.src = all[cur].src;
    count.textContent = (cur + 1) + " / " + all.length;
    [cur + 1, cur - 1].forEach(function (j) { var k = (j + all.length) % all.length; new Image().src = all[k].src; });
  }
  function open(i) {
    lastFocus = document.activeElement; document.body.style.overflow = "hidden";
    var thumb = lastFocus && lastFocus.querySelector && lastFocus.querySelector("img");
    lb.hidden = false; show(i);
    if (thumb && !reduce) {
      var r = thumb.getBoundingClientRect(), f = document.createElement("img");
      f.src = thumb.currentSrc || thumb.src; f.className = "fly";
      f.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px";
      document.body.appendChild(f);
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        var vw = innerWidth, vh = innerHeight * 0.8, ar = thumb.naturalWidth / thumb.naturalHeight || 1.5;
        var w = Math.min(vw, vh * ar), h = w / ar;
        f.style.cssText = "left:" + (vw - w) / 2 + "px;top:" + (innerHeight - h) / 2 + "px;width:" + w + "px;height:" + h + "px;opacity:0";
        lb.classList.add("open");
      }); });
      setTimeout(function () { f.remove(); }, 500);
    } else requestAnimationFrame(function () { lb.classList.add("open"); });
    document.getElementById("lbClose").focus();
  }
  function close() { lb.classList.remove("open"); setTimeout(function () { lb.hidden = true; }, 300); document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
  document.getElementById("lbClose").onclick = close;
  document.getElementById("lbPrev").onclick = function (e) { e.stopPropagation(); show(cur - 1); };
  document.getElementById("lbNext").onclick = function (e) { e.stopPropagation(); show(cur + 1); };
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target.id === "lbStage") close(); });
  addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") show(cur + 1);
    else if (e.key === "ArrowLeft") show(cur - 1);
  });
  var sx = 0, sy = 0;
  lb.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(cur + (dx < 0 ? 1 : -1));
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
  }, { passive: true });

  // ---------- motion ----------
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  document.querySelectorAll(".photo, .country-head").forEach(function (el) { reduce ? el.classList.add("in") : io.observe(el); });

  var bar = document.getElementById("progress"), top = document.querySelector(".top"), feats = document.querySelectorAll(".photo.feature img"), ticking = false;
  function onScroll() {
    var h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = "scaleX(" + (h > 0 ? scrollY / h : 0) + ")";
    top.classList.toggle("scrolled", scrollY > 10);
    if (!reduce) feats.forEach(function (img) {
      var r = img.parentNode.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) var lim = r.height * 0.06, v = (r.top + r.height / 2 - innerHeight / 2) * -0.06; img.style.setProperty("--py", Math.max(-lim, Math.min(lim, v)).toFixed(1) + "px");
    });
    ticking = false;
  }
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // soft drifting petals on the cream background
  var cv = document.getElementById("drift"), cx = cv.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2), ps = [];
  function size() { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  size(); addEventListener("resize", size);
  if (!reduce) {
    var n = innerWidth < 700 ? 9 : 16;
    for (var k = 0; k < n; k++) ps.push({ x: Math.random(), y: Math.random(), s: 4 + Math.random() * 5, v: .00025 + Math.random() * .0004, a: Math.random() * 6.28, w: .5 + Math.random() });
    (function loop() {
      cx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach(function (p) {
        p.y += p.v; p.a += .01 * p.w; if (p.y > 1.05) { p.y = -.05; p.x = Math.random(); }
        var x = (p.x + Math.sin(p.a) * .02) * cv.width, y = p.y * cv.height, s = p.s * dpr;
        cx.save(); cx.translate(x, y); cx.rotate(p.a); cx.globalAlpha = .28;
        cx.fillStyle = "#d9a38f"; cx.beginPath(); cx.ellipse(0, 0, s, s * .6, 0, 0, 6.28); cx.fill(); cx.restore();
      });
      if (!document.hidden) requestAnimationFrame(loop); else setTimeout(loop, 500);
    })();
  }

  document.getElementById("year").textContent = new Date().getFullYear();
})();
