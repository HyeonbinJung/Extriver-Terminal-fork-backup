/* ==========================================================================
   MARU Terminal (마루 터미널) — core runtime (global `FE`)
   Screens live in js/screens/*.js and call FE.screen({...}) to register.
   See easy/DEV_GUIDE.md for the full contract.
   ========================================================================== */
(() => {
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cssVar = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const FE = window.FE = { $, $$, esc, cssVar, screens: [], current: null, _timers: new Set() };

/* ---------------- colors ---------------- */
FE.color = {
  accent: "#d97706", cyan: "#0891b2", pos: "#16a34a", neg: "#dc2626", warn: "#ca8a04", info: "#2563eb",
  purple: "#9333ea", magenta: "#c026d3", text: "#e5e5e5", text2: "#808080", text3: "#525252",
  grid: "#1a1a1a", border: "#222222", bg: "#0a0a0a",
};
FE.palette = ["#d97706", "#0891b2", "#16a34a", "#dc2626", "#2563eb", "#ca8a04", "#9333ea", "#c026d3", "#64748b", "#14b8a6"];

/* ---------------- network ---------------- */
let inflight = 0;
FE.api = async (path, body) => {
  inflight++; FE._busy();
  try {
    const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({ error: "서버 응답을 읽지 못했습니다." }));
    if (!r.ok || (d && d.error && Object.keys(d).length === 1)) throw new Error(d.error || r.statusText);
    return d;
  } finally { inflight--; FE._busy(); }
};
FE.qs = obj => Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

/* ---------------- formatting ---------------- */
const nf = (v, d) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
FE.num = (v, d = 2) => v == null || v === "" || isNaN(v) ? "—" : nf(v, d);
FE.int = v => v == null || isNaN(v) ? "—" : nf(Math.round(v), 0);
FE.price = v => { if (v == null || isNaN(v)) return "—"; const a = Math.abs(v); return nf(v, a >= 1000 ? 2 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6); };
FE.pct = (v, d = 2) => v == null || isNaN(v) ? "—" : nf(v * 100, d) + "%";            // fraction → %
FE.spct = (v, d = 2) => v == null || isNaN(v) ? "—" : (v > 0 ? "+" : "") + nf(v * 100, d) + "%";
FE.pctRaw = (v, d = 2) => v == null || isNaN(v) ? "—" : (v > 0 ? "+" : "") + nf(v, d) + "%";  // already in %
FE.chg = (v, d = 2) => v == null || isNaN(v) ? "—" : (v > 0 ? "+" : "") + nf(v, d);
FE.big = (v, d = 2) => {
  if (v == null || isNaN(v)) return "—";
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  for (const [n, u] of [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]]) if (a >= n) return s + nf(a / n, d) + u;
  return s + nf(a, a < 10 ? d : 0);
};
FE.krw = v => { // 조/억/만 단위
  if (v == null || isNaN(v)) return "—";
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  for (const [n, u] of [[1e12, "조"], [1e8, "억"], [1e4, "만"]]) if (a >= n) return s + nf(a / n, 2) + u;
  return s + nf(a, 0);
};
FE.cls = v => v == null || isNaN(v) || v === 0 ? "flat" : v > 0 ? "pos" : "neg";
FE.arrow = v => v == null || isNaN(v) || v === 0 ? "" : v > 0 ? "▲" : "▼";
FE.date = ts => { if (!ts) return "—"; const d = typeof ts === "number" ? new Date(ts < 1e12 ? ts * 1000 : ts) : new Date(ts); return isNaN(d) ? String(ts) : d.toISOString().slice(0, 10); };
FE.ago = ts => {
  const d = typeof ts === "number" ? new Date(ts < 1e12 ? ts * 1000 : ts) : new Date(ts); if (isNaN(d)) return "";
  const s = Math.max(0, (Date.now() - d) / 1000);
  return s < 60 ? Math.round(s) + "s" : s < 3600 ? Math.round(s / 60) + "m" : s < 86400 ? Math.round(s / 3600) + "h" : Math.round(s / 86400) + "d";
};

/* ---------------- storage (per-browser conveniences) ---------------- */
FE.store = {
  get(k, def) { try { const v = localStorage.getItem("fe." + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem("fe." + k, JSON.stringify(v)); } catch {} },
};

/* ---------------- glossary tooltips ---------------- */
FE.terms = {};
FE.glossary = obj => Object.assign(FE.terms, obj);       // { key: ["제목", "설명"] }
FE.term = (key, label) => `<span class="term" data-term="${esc(key)}">${label ?? esc(FE.terms[key]?.[0] ?? key)}</span>`;
document.addEventListener("mouseover", e => {
  const t = e.target.closest("[data-term],[data-tip]"); if (!t) return;
  const tip = $("#tip"); const d = t.dataset.term ? FE.terms[t.dataset.term] : [t.dataset.tipTitle || "", t.dataset.tip];
  if (!d) return;
  tip.innerHTML = (d[0] ? `<b>${esc(d[0])}</b>` : "") + esc(d[1]); tip.classList.add("show");
  const r = t.getBoundingClientRect(), w = Math.min(340, innerWidth - 20);
  tip.style.left = Math.max(10, Math.min(r.left, innerWidth - w - 10)) + "px";
  const h = tip.offsetHeight; tip.style.top = (r.bottom + 6 + h > innerHeight ? r.top - h - 6 : r.bottom + 6) + "px";
});
document.addEventListener("mouseout", e => { if (e.target.closest("[data-term],[data-tip]")) $("#tip").classList.remove("show"); });

/* ---------------- feedback ---------------- */
FE.toast = (msg, bad = false) => { const t = $("#toast"); t.textContent = msg; t.classList.toggle("bad", bad); t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2800); };
FE.loading = (el, msg = "데이터를 불러오는 중…") => { el.innerHTML = `<div class="loading">${esc(msg)}</div>`; };
FE.error = (el, e) => { el.innerHTML = `<div class="err">⚠ ${esc(e?.message || e)}</div>`; };
FE.status = msg => { const m = $("#sbMsg"); if (m) m.textContent = msg || ""; };
FE._busy = () => { const r = $("#sbReady"); if (!r) return; r.textContent = inflight ? "LOADING" : "READY"; r.className = inflight ? "ready busy" : "ready"; };

/* ---------------- HTML builders ---------------- */
// panel({title, color:"orange|cyan|green|red|blue|yellow|purple|magenta", bar:true, sub, acts, body, flush, cls, id, style})
FE.panel = o => `<section class="panel ${o.cls || ""}" ${o.id ? `id="${o.id}"` : ""} ${o.style ? `style="${o.style}"` : ""}>
  ${o.title != null ? `<header class="panel-h"><span class="t ${o.bar ? "bar" : ""} c-${o.color || "orange"}">${o.title}</span>${o.sub ? `<span class="s">${o.sub}</span>` : ""}${o.acts ? `<div class="acts">${o.acts}</div>` : ""}</header>` : ""}
  <div class="panel-b ${o.flush ? "flush" : ""}" ${o.bodyId ? `id="${o.bodyId}"` : ""}>${o.body ?? ""}</div></section>`;
// kv([[label, value, cls?]])  — cls: "pos"|"neg"|"w"(white)|"c-orange"... ; value is raw HTML
FE.kv = rows => `<div class="kv">${rows.filter(Boolean).map(([l, v, c]) => `<div class="r"><span class="l">${l}</span><span class="v ${c || ""}">${v ?? "—"}</span></div>`).join("")}</div>`;
// stats([{l, v, d, cls, vcls}])
FE.stats = items => `<div class="stats">${items.map(s => `<div class="stat ${s.cls || ""}"><div class="l">${s.l}</div><div class="v ${s.vcls || ""}">${s.v ?? "—"}</div>${s.d != null ? `<div class="d">${s.d}</div>` : ""}</div>`).join("")}</div>`;
// table(cols, rows, {rowAttr: r => 'data-sym=".."', rowCls: r => "click", empty})
//   col: {k, l, a:"l|c|r", f: (v,row)=>html, c: (v,row)=>class, sort:true}
FE.table = (cols, rows, o = {}) => {
  if (!rows || !rows.length) return `<div class="empty">${o.empty || "데이터가 없습니다."}</div>`;
  const th = cols.map(c => `<th class="${c.a || "r"} ${c.sort ? "sort" : ""}" ${c.sort ? `data-sort="${c.k}"` : ""} ${c.tip ? `data-tip="${esc(c.tip)}"` : ""}>${c.l}</th>`).join("");
  const tr = rows.map((r, i) => `<tr class="${o.rowCls ? o.rowCls(r, i) : ""}" ${o.rowAttr ? o.rowAttr(r, i) : ""}>${cols.map(c => {
    const v = c.k in r ? r[c.k] : null; const cell = c.f ? c.f(v, r, i) : esc(v ?? "—");
    return `<td class="${c.a || "r"} ${c.c ? c.c(v, r) : ""}">${cell}</td>`; }).join("")}</tr>`).join("");
  return `<div class="tbl-wrap" ${o.maxH ? `style="max-height:${o.maxH}"` : ""}><table class="tbl ${o.cls || ""}"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
};
// Click-to-sort for a table rendered with FE.table: FE.sortable(container, rows, render)
FE.sortable = (el, rows, rerender) => {
  el.querySelectorAll("th[data-sort]").forEach(th => th.onclick = () => {
    const k = th.dataset.sort, dir = el._sortK === k ? -(el._sortD || 1) : -1; el._sortK = k; el._sortD = dir;
    rows.sort((a, b) => { const x = a[k], y = b[k]; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * dir; });
    rerender(rows);
  });
};
// pills(name, [[value,label]], active) ; FE.onPills(root, name, fn)
FE.pills = (name, items, active) => `<div class="pills" data-pills="${name}">${items.map(([v, l]) => `<button class="pill ${String(v) === String(active) ? "on" : ""}" data-v="${esc(v)}">${l ?? v}</button>`).join("")}</div>`;
FE.onPills = (root, name, fn) => root.querySelectorAll(`[data-pills="${name}"]`).forEach(g => g.addEventListener("click", e => {
  const b = e.target.closest(".pill"); if (!b) return; g.querySelectorAll(".pill").forEach(x => x.classList.toggle("on", x === b)); fn(b.dataset.v);
}));
// subtabs(name, [[id,label]], active) ; FE.onSubtabs(root, name, fn)
FE.subtabs = (name, items, active) => `<nav class="subtabs" data-subtabs="${name}">${items.map(([v, l]) => `<button class="${v === active ? "on" : ""}" data-v="${v}">${l}</button>`).join("")}</nav>`;
FE.onSubtabs = (root, name, fn) => root.querySelectorAll(`[data-subtabs="${name}"]`).forEach(g => g.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); fn(b.dataset.v);
}));
FE.screenHead = (title, sub, right = "") => `<div class="screen-head"><span class="screen-title">${title}</span>${sub ? `<span class="screen-sub">${sub}</span>` : ""}<div class="right">${right}</div></div>`;
FE.field = (label, input) => `<div class="field"><label>${label}</label>${input}</div>`;
FE.sparkline = (vals, w = 90, h = 24, color) => {
  const v = (vals || []).filter(x => x != null && !isNaN(x)); if (v.length < 2) return "";
  const mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(h - 1 - (x - mn) / rg * (h - 2)).toFixed(1)}`).join(" ");
  const c = color || (v[v.length - 1] >= v[0] ? FE.color.pos : FE.color.neg);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="${c}" stroke-width="1.3" points="${pts}"/></svg>`;
};
FE.heat = (v, max = 1, pos = FE.color.pos, neg = FE.color.neg) => { // background for heat cells
  if (v == null || isNaN(v)) return ""; const a = Math.min(1, Math.abs(v) / (max || 1));
  return `background:${v >= 0 ? pos : neg}${Math.round(a * 200 + 20).toString(16).padStart(2, "0")}`;
};

/* ---------------- charts ---------------- */
const charts = new Map();
FE.chart = (canvasOrId, config) => {
  const el = typeof canvasOrId === "string" ? document.getElementById(canvasOrId) : canvasOrId; if (!el) return null;
  charts.get(el)?.destroy();
  const C = window.Chart; C.defaults.color = FE.color.text2; C.defaults.borderColor = FE.color.grid;
  C.defaults.font.family = "Consolas, 'Malgun Gothic', monospace"; C.defaults.font.size = 11;
  const ch = new C(el, config); charts.set(el, ch); return ch;
};
// Common Chart.js options. FE.chartOpts({yFmt: v => v+"%", legend:true, x:{...}, y:{...}})
FE.chartOpts = (o = {}) => ({
  responsive: true, maintainAspectRatio: false, animation: false,
  interaction: { mode: o.mode || "index", intersect: false },
  plugins: {
    legend: { display: !!o.legend, labels: { boxWidth: 10, boxHeight: 10, color: FE.color.text2 } },
    tooltip: { backgroundColor: "#111111", borderColor: FE.color.accent, borderWidth: 1, titleColor: FE.color.accent, bodyColor: FE.color.text, cornerRadius: 0, ...(o.tooltip || {}) },
    ...(o.plugins || {}),
  },
  scales: {
    x: { type: o.xType || "category", grid: { color: FE.color.grid, display: o.xGrid !== false }, ticks: { maxRotation: 0, autoSkipPadding: 24, maxTicksLimit: o.xTicks || 8, ...(o.xFmt ? { callback: function (v) { return o.xFmt(this.getLabelForValue ? this.getLabelForValue(v) : v); } } : {}) }, ...(o.x || {}) },
    y: { position: "right", grid: { color: FE.color.grid }, ticks: { ...(o.yFmt ? { callback: o.yFmt } : {}) }, ...(o.y || {}) },
    ...(o.scales || {}),
  },
});
FE.line = (label, data, color, extra = {}) => ({ label, data, borderColor: color, backgroundColor: color, borderWidth: 1.6, pointRadius: 0, tension: 0, spanGaps: true, ...extra });

// TradingView lightweight-charts price chart.
// FE.priceChart(el, {candles:[{time:'YYYY-MM-DD'|unix, open,high,low,close,volume}], type:'candle'|'line'|'area',
//                    overlays:[{name, color, data:[{time,value}]}], volume:true, height})
FE.priceChart = (el, o) => {
  if (el._lw) { el._lw.remove(); el._ro?.disconnect(); }
  const LW = window.LightweightCharts;
  const chart = LW.createChart(el, {
    width: el.clientWidth, height: o.height || el.clientHeight || 360,
    layout: { background: { type: "solid", color: FE.color.bg }, textColor: FE.color.text2, fontFamily: "Consolas, monospace", fontSize: 11 },
    grid: { vertLines: { color: "#141414" }, horzLines: { color: "#141414" } },
    rightPriceScale: { borderColor: FE.color.border }, timeScale: { borderColor: FE.color.border, timeVisible: !!o.intraday },
    crosshair: { mode: 0 },
  });
  let main;
  if ((o.type || "candle") === "candle") {
    main = chart.addCandlestickSeries({ upColor: FE.color.pos, downColor: FE.color.neg, borderUpColor: FE.color.pos, borderDownColor: FE.color.neg, wickUpColor: FE.color.pos, wickDownColor: FE.color.neg });
    main.setData(o.candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
  } else {
    main = chart.addAreaSeries({ lineColor: FE.color.accent, topColor: "rgba(217,119,6,.25)", bottomColor: "rgba(217,119,6,0)", lineWidth: 2 });
    main.setData(o.candles.map(c => ({ time: c.time, value: c.close })));
  }
  if (o.volume !== false && o.candles.some(c => c.volume)) {
    const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol" });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: .82, bottom: 0 } });
    vol.setData(o.candles.map(c => ({ time: c.time, value: c.volume || 0, color: c.close >= c.open ? "rgba(22,163,74,.35)" : "rgba(220,38,38,.35)" })));
  }
  (o.overlays || []).forEach(ov => {
    const s = chart.addLineSeries({ color: ov.color, lineWidth: ov.width || 1, priceLineVisible: false, lastValueVisible: false, lineStyle: ov.dash ? 2 : 0 });
    s.setData(ov.data.filter(p => p.value != null && !isNaN(p.value)));
  });
  (o.markers && main.setMarkers(o.markers));
  chart.timeScale().fitContent();
  const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth, height: o.height || el.clientHeight || 360 }));
  ro.observe(el); el._lw = chart; el._ro = ro; el._main = main;
  return chart;
};

/* ---------------- screens & routing ---------------- */
// FE.screen({id, label, fkey?, group, primary?:bool, order?, desc, render(root, arg), leave?()})
FE.screen = def => { FE.screens.push(def); };
FE.go = (id, arg) => { const h = "#" + id + (arg ? "/" + encodeURIComponent(arg) : ""); if (location.hash === h) route(); else location.hash = h; };
FE.every = (ms, fn) => { const t = setInterval(() => { if (!document.hidden) fn(); }, ms); FE._timers.add(t); return t; };  // auto-cleared on screen change
function route() {
  const [id, ...rest] = decodeURIComponent(location.hash.slice(1)).split("/");
  const def = FE.screens.find(s => s.id === id) || FE.screens.find(s => s.id === "dashboard") || FE.screens[0];
  if (!def) return;
  FE._timers.forEach(clearInterval); FE._timers.clear();
  if (FE.current?.leave) try { FE.current.leave(); } catch {}
  charts.forEach(c => c.destroy()); charts.clear();
  FE.current = def;
  $$("#tabbar button").forEach(b => b.classList.toggle("active", b.dataset.id === def.id));
  document.title = `${def.label} — 마루 터미널`;
  $("#sbScreen").textContent = def.label;
  const root = $("#workspace"); root.scrollTop = 0;
  root.innerHTML = `<div class="screen" id="scr-${def.id}"></div>`;
  FE.status("");
  try { def.render(root.firstElementChild, rest.join("/") || undefined); } catch (e) { FE.error(root.firstElementChild, e); console.error(e); }
}
window.addEventListener("hashchange", route);

/* ---------------- commands ---------------- */
// FE.command(prefix, label, fn(argString))  e.g. FE.command("/fx", "환율 변환", a => FE.go("forex", a))
FE.commands = [];
FE.command = (prefix, label, fn) => FE.commands.push({ prefix, label, fn });
function runCommand(raw) {
  const s = raw.trim(); if (!s) return;
  const lower = s.toLowerCase();
  const cmd = FE.commands.find(c => lower === c.prefix || lower.startsWith(c.prefix + " "));
  if (cmd) return cmd.fn(s.slice(cmd.prefix.length).trim());
  const scr = FE.screens.find(x => x.id === lower || x.label.toLowerCase() === lower);
  if (scr) return FE.go(scr.id);
  FE.go("research", s.toUpperCase());   // default: treat as a ticker
}

/* ---------------- shell ---------------- */
function buildShell() {
  const prim = FE.screens.filter(s => s.primary).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  $("#tabbar").innerHTML = prim.map(s => `<button data-id="${s.id}" title="${esc(s.desc || "")}${s.fkey ? " (" + s.fkey + ")" : ""}">${esc(s.label)}</button>`).join("");
  $("#tabbar").onclick = e => { const b = e.target.closest("button"); if (b) FE.go(b.dataset.id); };
  const groups = {};
  FE.screens.slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).forEach(s => (groups[s.group || "기타"] ??= []).push(s));
  $("#navMenu").innerHTML = Object.entries(groups).map(([g, list]) => `<div class="mh">${esc(g)}</div>` + list.map(s => `<div class="mi" data-go="${s.id}">${esc(s.label)}<span class="k">${s.fkey || ""}</span></div>`).join("")).join("");
  $("#cmdMenu").innerHTML = `<div class="mh">명령줄 사용법</div><div class="mi" data-cmdhelp="AAPL">AAPL<span class="k">종목 리서치 열기</span></div>` +
    FE.commands.map(c => `<div class="mi" data-cmdhelp="${esc(c.prefix)} ">${esc(c.prefix)}<span class="k">${esc(c.label)}</span></div>`).join("");
  document.addEventListener("click", e => {
    const m = e.target.closest(".menu"); $$(".menu").forEach(x => x !== m && x.classList.remove("open"));
    if (e.target.closest(".menu > button")) m.classList.toggle("open");
    const go = e.target.closest("[data-go]"); if (go) { FE.go(go.dataset.go, go.dataset.arg); $$(".menu").forEach(x => x.classList.remove("open")); }
    const ch = e.target.closest("[data-cmdhelp]"); if (ch) { const i = $("#cmdInput"); i.value = ch.dataset.cmdhelp; i.focus(); $$(".menu").forEach(x => x.classList.remove("open")); }
  });
  // F-keys
  document.addEventListener("keydown", e => {
    if (/^F\d+$/.test(e.key)) { const s = FE.screens.find(x => x.fkey === e.key); if (s) { e.preventDefault(); FE.go(s.id); } }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#cmdInput").focus(); }
  });
  // command bar with symbol suggestions
  const inp = $("#cmdInput"), sug = $("#cmdSug"); let sel = -1, items = [], t;
  const show = list => { items = list; sel = -1; sug.innerHTML = list.map((x, i) => `<div data-i="${i}"><b>${esc(x.symbol)}</b><i>${esc(x.name || x.shortname || "")} ${esc(x.exchange || "")}</i></div>`).join(""); sug.classList.toggle("show", !!list.length); };
  inp.addEventListener("input", () => {
    clearTimeout(t); const q = inp.value.trim(); if (q.length < 2 || q.startsWith("/")) return show([]);
    t = setTimeout(async () => { try { show(((await FE.api("/api/search?q=" + encodeURIComponent(q))).results || []).slice(0, 8)); } catch { show([]); } }, 300);
  });
  inp.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(-1, Math.min(items.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1))); $$("div", sug).forEach((d, i) => d.classList.toggle("sel", i === sel)); }
    if (e.key === "Enter") { const v = sel >= 0 ? items[sel].symbol : inp.value; show([]); inp.value = ""; inp.blur(); runCommand(v); }
    if (e.key === "Escape") { show([]); inp.blur(); }
  });
  sug.addEventListener("mousedown", e => { const d = e.target.closest("[data-i]"); if (d) { e.preventDefault(); const v = items[+d.dataset.i].symbol; show([]); inp.value = ""; runCommand(v); } });
  inp.addEventListener("blur", () => setTimeout(() => show([]), 150));
  // clock
  const tick = () => { const d = new Date(); $("#clock").textContent = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).toUpperCase() + " " + d.toTimeString().slice(0, 8); };
  tick(); setInterval(tick, 1000);
  const t0 = Date.now(); setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $("#sbSession").textContent = [s / 3600, s / 60 % 60, s % 60].map(x => String(Math.floor(x)).padStart(2, "0")).join(":"); }, 1000);
  loadTicker(); setInterval(() => !document.hidden && loadTicker(), 120000);
}
const TICKER = [["^GSPC", "S&P 500"], ["^IXIC", "NASDAQ"], ["^DJI", "DOW"], ["^KS11", "KOSPI"], ["^KQ11", "KOSDAQ"], ["^N225", "NIKKEI"], ["^HSI", "HANG SENG"], ["^FTSE", "FTSE"], ["^GDAXI", "DAX"],
  ["KRW=X", "USD/KRW"], ["EURUSD=X", "EUR/USD"], ["JPY=X", "USD/JPY"], ["GC=F", "GOLD"], ["CL=F", "WTI"], ["^TNX", "US10Y"], ["BTC-USD", "BTC"], ["ETH-USD", "ETH"], ["^VIX", "VIX"]];
async function loadTicker() {
  try {
    const d = await FE.api("/api/quotes?symbols=" + encodeURIComponent(TICKER.map(x => x[0]).join(",")));
    const html = d.quotes.filter(q => q.price != null).map(q => { const n = TICKER.find(x => x[0] === q.symbol)[1];
      return `<span class="t" data-go="research" data-arg="${esc(q.symbol)}"><b>${n}</b>${FE.price(q.price)} <span class="${FE.cls(q.change_percent)}">${FE.arrow(q.change_percent)}${FE.pctRaw(q.change_percent)}</span></span>`; }).join("");
    $("#ticker").innerHTML = `<div class="track">${html}${html}</div>`;
    $("#sbFeed").textContent = "CONNECTED"; $("#sbFeed").className = "pos";
  } catch { $("#sbFeed").textContent = "OFFLINE"; $("#sbFeed").className = "neg"; }
}

FE.start = () => { buildShell(); route(); };
})();
