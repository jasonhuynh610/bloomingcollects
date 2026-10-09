const STATUS = {
  seedling: { label: "🌱 seedling", color: "var(--mint)" },
  sprouting: { label: "🌿 sprouting", color: "var(--sky)" },
  bloomed: { label: "🌸 bloomed", color: "var(--pink)" },
  wilted: { label: "🥀 wilted", color: "var(--lilac)" },
};
const projects = window.PROJECTS || [];
const grid = document.getElementById("grid");
const filters = document.getElementById("filters");
let active = "all";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function render() {
  grid.innerHTML = "";
  const list = projects.filter((p) => active === "all" || (p.tags || []).includes(active));
  list.forEach((p, i) => {
    const s = STATUS[p.status] || STATUS.seedling;
    const el = document.createElement(p.url ? "a" : "div");
    el.className = "card" + (p.url ? "" : " card-empty");
    if (p.url) el.href = p.url;
    el.style.setProperty("--tilt", (i % 2 ? 1.5 : -1.5) + "deg");
    el.style.setProperty("--accent", s.color);
    el.innerHTML = `
      <div class="card-emoji">${esc(p.emoji || "🌼")}</div>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.description)}</p>
      <div class="card-foot">
        <span class="badge">${s.label}</span>
        ${(p.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}
      </div>`;
    grid.appendChild(el);
  });
  document.getElementById("count").textContent = `(${projects.length} seeds planted)`;
}

function renderFilters() {
  const tags = ["all", ...new Set(projects.flatMap((p) => p.tags || []))];
  filters.innerHTML = "";
  tags.forEach((t) => {
    const b = document.createElement("button");
    b.className = "chip" + (t === active ? " chip-on" : "");
    b.textContent = t === "all" ? "✨ all" : "#" + t;
    b.onclick = () => { active = t; renderFilters(); render(); };
    filters.appendChild(b);
  });
}

// 🌸 falling petals
const petalBox = document.getElementById("petals");
const PETALS = ["🌸", "🌼", "🌷", "🍃", "🌺", "✿"];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function petal() {
  if (reduceMotion) return;
  const p = document.createElement("span");
  p.className = "petal";
  p.textContent = PETALS[Math.floor(Math.random() * PETALS.length)];
  p.style.left = Math.random() * 100 + "vw";
  p.style.fontSize = 14 + Math.random() * 18 + "px";
  p.style.animationDuration = 6 + Math.random() * 6 + "s";
  petalBox.appendChild(p);
  setTimeout(() => p.remove(), 13000);
}
setInterval(petal, 1400);
function burst(n = 30) { for (let i = 0; i < n; i++) setTimeout(petal, i * 40); }

// 🎲 surprise me
document.getElementById("surprise").onclick = () => {
  const live = projects.filter((p) => p.url);
  burst(20);
  if (live.length) {
    const pick = live[Math.floor(Math.random() * live.length)];
    setTimeout(() => (location.href = pick.url), 700);
  }
};

// 🌼 logo spins and drops petals
let clicks = 0;
document.getElementById("logo").onclick = (e) => {
  clicks++;
  e.target.classList.remove("spin"); void e.target.offsetWidth; e.target.classList.add("spin");
  burst(clicks % 10 === 0 ? 80 : 8);
};

// ⬆⬆⬇⬇⬅➡⬅➡BA
const code = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
let pos = 0;
addEventListener("keydown", (e) => {
  pos = e.key === code[pos] ? pos + 1 : e.key === code[0] ? 1 : 0;
  if (pos === code.length) { pos = 0; document.body.classList.toggle("party"); burst(120); }
});

document.getElementById("year").textContent = new Date().getFullYear();
renderFilters();
render();
