(function () {
  var data = window.TRAVEL || [];
  var journal = document.getElementById("journal");
  var nav = document.getElementById("countryNav");
  var all = [];

  data.forEach(function (c) {
    if (!c.photos || !c.photos.length) return;
    var a = document.createElement("a");
    a.href = "#" + c.id; a.textContent = c.name; nav.appendChild(a);

    var sec = document.createElement("section");
    sec.className = "country"; sec.id = c.id;
    sec.innerHTML = '<div class="country-head"><h2>' + c.name + (c.native ? '<span class="native">' + c.native + "</span>" : "") +
      '</h2><span class="count">' + c.photos.length + " photographs</span></div>";
    var grid = document.createElement("div"); grid.className = "gallery";
    c.photos.forEach(function (p, i) {
      var idx = all.length;
      all.push({ src: c.dir + p.id + "-lg.webp", alt: c.name + ", photo " + (i + 1) + " of " + c.photos.length });
      var b = document.createElement("button");
      b.type = "button";
      b.className = "photo" + (i % 7 === 0 ? " feature" : "");
      b.style.setProperty("--ar", (i % 7 === 0) ? (p.w + "/" + p.h) : "1");
      b.setAttribute("aria-label", "Open " + all[idx].alt);
      var img = new Image();
      img.loading = i < 3 ? "eager" : "lazy";
      img.decoding = "async";
      img.alt = all[idx].alt;
      img.sizes = i % 7 === 0 ? "(min-width: 900px) 66vw, 100vw" : "(min-width: 900px) 33vw, 50vw";
      img.srcset = c.dir + p.id + "-sm.webp 800w, " + c.dir + p.id + "-lg.webp 2000w";
      img.src = c.dir + p.id + "-sm.webp";
      img.onload = function () { img.classList.add("loaded"); };
      b.appendChild(img);
      b.onclick = function () { open(idx); };
      grid.appendChild(b);
    });
    sec.appendChild(grid);
    journal.appendChild(sec);
  });

  // lightbox
  var lb = document.getElementById("lightbox"), lbImg = document.getElementById("lbImg"), count = document.getElementById("lbCount");
  var cur = 0, lastFocus = null;
  function show(i) {
    cur = (i + all.length) % all.length;
    lbImg.classList.add("swap");
    var next = new Image();
    next.onload = next.onerror = function () { lbImg.src = all[cur].src; lbImg.alt = all[cur].alt; lbImg.classList.remove("swap"); };
    next.src = all[cur].src;
    count.textContent = (cur + 1) + " / " + all.length;
    [cur + 1, cur - 1].forEach(function (j) { var k = (j + all.length) % all.length; new Image().src = all[k].src; });
  }
  function open(i) { lastFocus = document.activeElement; lb.hidden = false; document.body.style.overflow = "hidden"; show(i); document.getElementById("lbClose").focus(); }
  function close() { lb.hidden = true; document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
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

  document.getElementById("year").textContent = new Date().getFullYear();
})();
