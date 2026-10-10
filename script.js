const STATUS = {
  seedling: { label: "seedling", color: "var(--mint)" },
  sprouting: { label: "sprouting", color: "var(--blue)" },
  bloomed: { label: "bloomed", color: "var(--rose)" },
  wilted: { label: "wilted", color: "var(--lilac)" },
};
const projects = window.PROJECTS || [];
const grid = document.getElementById("grid");
const filters = document.getElementById("filters");
let active = "all";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function render() {
  timers.forEach(clearInterval); timers.clear();
  grid.innerHTML = "";
  const list = projects.filter((p) => active === "all" || (p.tags || []).includes(active));
  list.forEach((p, i) => {
    const s = STATUS[p.status] || STATUS.seedling;
    const el = document.createElement(p.url ? "a" : "div");
    el.className = "card" + (p.url ? "" : " card-empty") + (p.slides ? " card-wide" : "");
    if (p.url) el.href = p.url;
    el.style.setProperty("--accent", s.color);
    el.style.animationDelay = i * 70 + "ms";
    const slides = p.slides ? `<div class="slides">${p.slides.map(([src, label], j) =>
      `<figure class="slide${j === 0 ? " on" : ""}"><img src="${esc(src)}" alt="" ${j > 1 ? 'loading="lazy"' : ""} decoding="async"><figcaption>${esc(label)}</figcaption></figure>`).join("")}
      <div class="dots">${p.slides.map((_, j) => `<i${j === 0 ? ' class="on"' : ""}></i>`).join("")}</div></div>` : "";
    el.innerHTML = `${slides}
      <div class="card-icon">${esc(p.emoji || "🌸")}</div>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.description)}</p>
      <div class="card-foot">
        <span class="status">${s.label}</span>
        ${(p.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}
        ${p.url ? '<span class="arrow">→</span>' : ""}
      </div>`;
    grid.appendChild(el);
    if (p.slides) slideshow(el);
  });
  document.getElementById("count").textContent = projects.length + (projects.length === 1 ? " project" : " projects");
}

// crossfade card photos every few seconds; pauses while off-screen or the tab is hidden
const timers = new Set();
function slideshow(card) {
  const figs = card.querySelectorAll(".slide"), dots = card.querySelectorAll(".dots i");
  if (figs.length < 2) return;
  let cur = 0, visible = true;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(card);
  const t = setInterval(() => {
    if (!visible || document.hidden) return;
    figs[cur].classList.remove("on"); dots[cur].classList.remove("on");
    cur = (cur + 1) % figs.length;
    figs[cur].classList.add("on"); dots[cur].classList.add("on");
    const next = figs[(cur + 1) % figs.length].querySelector("img"); next.loading = "eager";
  }, reduceMotion ? 6000 : 3500);
  timers.add(t);
}

function renderFilters() {
  const tags = ["all", ...new Set(projects.flatMap((p) => p.tags || []))];
  filters.innerHTML = "";
  tags.forEach((t) => {
    const b = document.createElement("button");
    b.className = "chip" + (t === active ? " chip-on" : "");
    b.textContent = t === "all" ? "All" : "#" + t;
    b.onclick = () => { active = t; renderFilters(); render(); };
    filters.appendChild(b);
  });
}

// sakura petals
const petalBox = document.getElementById("petals");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function petal() {
  if (reduceMotion || document.hidden) return;
  const p = document.createElement("span");
  p.className = "petal";
  const size = 8 + Math.random() * 8;
  p.style.left = Math.random() * 100 + "vw";
  p.style.width = size + "px";
  p.style.height = size * 0.75 + "px";
  p.style.opacity = 0.55 + Math.random() * 0.4;
  p.style.animationDuration = 9 + Math.random() * 7 + "s";
  petalBox.appendChild(p);
  setTimeout(() => p.remove(), 17000);
}
setInterval(petal, 1100);
function burst(n = 24) { for (let i = 0; i < n; i++) setTimeout(petal, i * 35); }

// stars for night mode
const stars = document.getElementById("stars");
for (let i = 0; i < 70; i++) {
  const s = document.createElement("i");
  s.style.left = Math.random() * 100 + "%";
  s.style.top = Math.random() * 60 + "%";
  s.style.animationDelay = Math.random() * 3 + "s";
  stars.appendChild(s);
}

// surprise me
document.getElementById("surprise").onclick = () => {
  const live = projects.filter((p) => p.url);
  burst(20);
  if (live.length) {
    const pick = live[Math.floor(Math.random() * live.length)];
    setTimeout(() => (location.href = pick.url), 700);
  }
};

// logo spins and scatters petals
let clicks = 0;
const logo = document.getElementById("logo");
logo.onclick = (e) => {
  e.preventDefault();
  clicks++;
  logo.classList.remove("spin"); void logo.offsetWidth; logo.classList.add("spin");
  burst(clicks % 10 === 0 ? 80 : 10);
};

// ↑↑↓↓←→←→BA toggles night sky
const code = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
let pos = 0;
addEventListener("keydown", (e) => {
  pos = e.key === code[pos] ? pos + 1 : e.key === code[0] ? 1 : 0;
  if (pos === code.length) { pos = 0; document.body.classList.toggle("night"); burst(60); }
});

document.getElementById("year").textContent = new Date().getFullYear();
renderFilters();
render();
