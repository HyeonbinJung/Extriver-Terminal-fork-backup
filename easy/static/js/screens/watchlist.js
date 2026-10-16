/* WATCHLIST — 관심종목: 여러 개의 이름 붙은 목록, 실시간 시세 표, 30초 자동 갱신, CSV 내보내기/가져오기.
   Storage (FE.store "watchlists"): { active: "기본", lists: [{ name: "기본", symbols: ["AAPL", ...] }, ...] }
   (research.js · screener.js 도 같은 형식으로 종목을 추가합니다.) */
(() => {
const esc = FE.esc;
const KEY = "watchlists";
const DEFAULT = () => ({ active: "기본", lists: [
  { name: "기본", symbols: ["AAPL", "MSFT", "NVDA", "005930.KS", "000660.KS"] },
  { name: "지수", symbols: ["^GSPC", "^IXIC", "^DJI", "^KS11", "^KQ11", "^N225", "^VIX"] }] });
const load = () => { const d = FE.store.get(KEY, null); return d && Array.isArray(d.lists) && d.lists.length ? d : DEFAULT(); };
const save = d => FE.store.set(KEY, d);
const activeList = d => d.lists.find(l => l.name === d.active) || d.lists[0];
const noDec = s => /\.(KS|KQ|T)$/.test(s);
const fmtPx = (v, s) => v == null ? "—" : noDec(s) ? FE.int(v) : FE.price(v);

if (!document.getElementById("wl-style")) {
  const st = document.createElement("style"); st.id = "wl-style";
  st.textContent = `
  #scr-watchlist .wl-tabs { display:flex; gap:2px; flex-wrap:wrap; }
  #scr-watchlist .wl-tabs button { background:var(--bg-surface); color:var(--text-2); border:1px solid var(--border-med); font:inherit; padding:4px 12px; cursor:pointer; }
  #scr-watchlist .wl-tabs button:hover { color:var(--text); }
  #scr-watchlist .wl-tabs button.on { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:700; }
  #scr-watchlist .wl-tabs button i { font-style:normal; opacity:.7; margin-left:6px; font-size:11px; }
  #scr-watchlist .wl-add { position:relative; display:flex; gap:6px; }
  #scr-watchlist .wl-sug { position:absolute; top:100%; left:0; width:380px; z-index:50; background:var(--bg-raised); border:1px solid var(--border-bright); display:none; }
  #scr-watchlist .wl-sug div { padding:5px 9px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #scr-watchlist .wl-sug div:hover, #scr-watchlist .wl-sug div.sel { background:var(--bg-hover); }
  #scr-watchlist .wl-sug b { color:var(--accent); margin-right:8px; } #scr-watchlist .wl-sug i { color:var(--text-2); font-style:normal; } #scr-watchlist .wl-sug span { color:var(--text-3); margin-left:6px; }
  #scr-watchlist .wl-x { background:none; border:0; color:var(--text-3); cursor:pointer; font:inherit; padding:0 6px; }
  #scr-watchlist .wl-x:hover { color:var(--neg); }
  #scr-watchlist .wl-mv { background:none; border:0; color:var(--text-3); cursor:pointer; font:inherit; padding:0 2px; font-size:11px; }
  #scr-watchlist .wl-mv:hover { color:var(--accent); }
  #scr-watchlist td.flash { animation: wlflash 1s; }
  @keyframes wlflash { from { background:var(--accent-bg); } to { background:transparent; } }`;
  document.head.appendChild(st);
}

let ROOT = null, ROWS = [], SORT = null, LAST = {};

FE.screen({
  id: "watchlist", label: "관심종목", primary: true, order: 6, fkey: "F6", group: "트레이딩",
  desc: "여러 개의 관심종목 목록 · 실시간 시세 · 5일 추이 · 30초 자동 갱신 · CSV 내보내기/가져오기",
  render(el, arg) {
    ROOT = el; SORT = null; ROWS = [];
    const d = load();
    if (arg && d.lists.some(l => l.name === arg)) { d.active = arg; save(d); }
    el.innerHTML = FE.screenHead("WATCHLIST", "관심종목 — 행을 클릭하면 종목 리서치가 열려요",
      `<span class="c-dim" id="wlUpd"></span>
       <label class="chk"><input type="checkbox" id="wlAuto" ${FE.store.get("wl.auto", true) ? "checked" : ""}> 30초 자동 갱신</label>
       <button class="btn" id="wlRefresh">새로고침</button>`) +
      `<div class="row"><div class="wl-tabs" id="wlTabs"></div><span class="spacer"></span>
         <button class="btn muted" id="wlNew">+ 새 목록</button><button class="btn muted" id="wlRen">이름 변경</button><button class="btn muted" id="wlDel">목록 삭제</button>
         <button class="btn muted" id="wlExp">CSV 내보내기</button><button class="btn muted" id="wlImp">CSV 가져오기</button><input type="file" id="wlFile" accept=".csv,text/csv,text/plain" hidden></div>
       <div class="row"><div class="wl-add"><input class="inp" id="wlIn" placeholder="종목 추가: 코드·이름 검색 (예: TSLA, 카카오, 035720.KS)" style="width:360px" autocomplete="off"></div>
         <button class="btn solid" id="wlAdd">추가</button><span class="note">여러 개는 쉼표로 구분 · 예: AAPL, 005930.KS, BTC-USD</span></div>
       <div id="wlStats"></div>
       <div id="wlTbl"></div>
       <div class="note">시세는 Yahoo Finance 지연 시세(최대 15~20분)일 수 있어요. 목록은 이 브라우저(localStorage)에만 저장됩니다. 5일 추이는 1시간 봉 기준.</div>`;
    drawTabs();
    const inp = el.querySelector("#wlIn");
    suggest(inp, s => { addSymbols(s); inp.value = ""; });
    el.querySelector("#wlAdd").onclick = () => { addSymbols(inp.value); inp.value = ""; };
    el.querySelector("#wlRefresh").onclick = () => refresh(true);
    el.querySelector("#wlAuto").onchange = e => FE.store.set("wl.auto", e.target.checked);
    el.querySelector("#wlNew").onclick = () => {
      const n = (prompt("새 관심종목 목록 이름", "새 목록") || "").trim().slice(0, 30); if (!n) return;
      const d2 = load(); if (d2.lists.some(l => l.name === n)) return FE.toast("같은 이름의 목록이 이미 있어요.", true);
      d2.lists.push({ name: n, symbols: [] }); d2.active = n; save(d2); drawTabs(); refresh(true);
    };
    el.querySelector("#wlRen").onclick = () => {
      const d2 = load(), l = activeList(d2); const n = (prompt("목록 이름 변경", l.name) || "").trim().slice(0, 30);
      if (!n || n === l.name) return; if (d2.lists.some(x => x.name === n)) return FE.toast("같은 이름의 목록이 이미 있어요.", true);
      l.name = n; d2.active = n; save(d2); drawTabs();
    };
    el.querySelector("#wlDel").onclick = () => {
      const d2 = load(), l = activeList(d2);
      if (d2.lists.length <= 1) return FE.toast("마지막 목록은 삭제할 수 없어요.", true);
      if (!confirm(`'${l.name}' 목록(${l.symbols.length}종목)을 삭제할까요?`)) return;
      d2.lists = d2.lists.filter(x => x !== l); d2.active = d2.lists[0].name; save(d2); drawTabs(); refresh(true);
    };
    el.querySelector("#wlExp").onclick = exportCsv;
    el.querySelector("#wlImp").onclick = () => el.querySelector("#wlFile").click();
    el.querySelector("#wlFile").onchange = e => importCsv(e.target.files[0]);
    el.querySelector("#wlTbl").addEventListener("click", e => {
      const x = e.target.closest("[data-del]"); if (x) { e.stopPropagation(); return removeSymbol(x.dataset.del); }
      const mv = e.target.closest("[data-mv]"); if (mv) { e.stopPropagation(); return move(mv.dataset.sym, +mv.dataset.mv); }
      const tr = e.target.closest("tr[data-sym]"); if (tr) FE.go("research", tr.dataset.sym);
    });
    refresh(true);
    FE.every(30000, () => { if (ROOT && ROOT.querySelector("#wlAuto")?.checked) refresh(false); });
  },
  leave() { ROOT = null; },
});
FE.command("/wl", "관심종목에 추가 (예: /wl TSLA)", a => { if (a) { const d = load(); const l = activeList(d); a.split(/[,\s]+/).filter(Boolean).forEach(s => { s = s.toUpperCase(); if (!l.symbols.includes(s)) l.symbols.push(s); }); save(d); } FE.go("watchlist"); });

function drawTabs() {
  const d = load();
  ROOT.querySelector("#wlTabs").innerHTML = d.lists.map(l => `<button class="${l.name === activeList(d).name ? "on" : ""}" data-n="${esc(l.name)}">${esc(l.name)}<i>${l.symbols.length}</i></button>`).join("");
  ROOT.querySelector("#wlTabs").onclick = e => { const b = e.target.closest("button"); if (!b) return; const d2 = load(); d2.active = b.dataset.n; save(d2); SORT = null; drawTabs(); refresh(true); };
}

function addSymbols(raw) {
  const syms = String(raw || "").split(/[,\s;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!syms.length) return;
  const bad = syms.filter(s => !/^[A-Z0-9.\-^=]{1,20}$/.test(s));
  if (bad.length) return FE.toast(`종목 코드 형식이 올바르지 않아요: ${bad.join(", ")}`, true);
  const d = load(), l = activeList(d);
  const added = syms.filter(s => !l.symbols.includes(s));
  if (l.symbols.length + added.length > 60) return FE.toast("한 목록에는 최대 60종목까지 넣을 수 있어요.", true);
  l.symbols.push(...added); save(d); drawTabs();
  FE.toast(added.length ? `${added.join(", ")} 추가` : "이미 목록에 있는 종목이에요.");
  refresh(true);
}
function removeSymbol(s) { const d = load(), l = activeList(d); l.symbols = l.symbols.filter(x => x !== s); save(d); ROWS = ROWS.filter(r => r.symbol !== s); drawTabs(); draw(); }
function move(s, dir) {
  const d = load(), l = activeList(d), i = l.symbols.indexOf(s), j = i + dir; if (i < 0 || j < 0 || j >= l.symbols.length) return;
  [l.symbols[i], l.symbols[j]] = [l.symbols[j], l.symbols[i]]; save(d); SORT = null;
  ROWS.sort((a, b) => l.symbols.indexOf(a.symbol) - l.symbols.indexOf(b.symbol)); draw();
}

async function refresh(showLoading) {
  if (!ROOT) return;
  const l = activeList(load()), box = ROOT.querySelector("#wlTbl");
  if (!l.symbols.length) { ROWS = []; ROOT.querySelector("#wlStats").innerHTML = ""; box.innerHTML = FE.panel({ title: esc(l.name), body: `<div class="empty">비어 있는 목록입니다. 위 입력칸에서 종목을 추가하세요.</div>` }); return; }
  if (showLoading && !ROWS.length) FE.loading(box, "시세를 불러오는 중…");
  try {
    const d = await FE.api("/api/quotes?" + FE.qs({ symbols: l.symbols.join(","), names: 1, spark: 1 }));
    let qs = d.quotes;
    const miss = qs.filter(q => q.price == null).map(q => q.symbol);
    if (miss.length) { // batch download sometimes drops symbols → per-symbol fallback
      try { const f = await FE.api("/api/research/quotes?" + FE.qs({ symbols: miss.slice(0, 30).join(",") })); const m = Object.fromEntries(f.quotes.map(q => [q.symbol, q]));
        qs = qs.map(q => q.price == null && m[q.symbol]?.price != null ? { ...m[q.symbol], name: q.name, spark: q.spark } : q); } catch {}
    }
    if (!ROOT || activeList(load()).name !== l.name) return;
    ROWS = qs.map(q => ({ ...q, range: q.high != null && q.low != null && q.high > q.low ? (q.price - q.low) / (q.high - q.low) : null, spark5: (q.spark || []).length ? q.spark[q.spark.length - 1] / q.spark[0] - 1 : null }));
    if (SORT) ROWS.sort(SORT);
    draw(true);
    ROOT.querySelector("#wlUpd").textContent = "갱신 " + new Date().toTimeString().slice(0, 8);
    FE.status(`관심종목 '${l.name}' ${ROWS.length}종목 갱신`);
  } catch (e) { FE.error(box, e); }
}

function draw(flash) {
  if (!ROOT) return;
  const l = activeList(load()), box = ROOT.querySelector("#wlTbl");
  const valid = ROWS.filter(r => r.change_percent != null);
  const up = valid.filter(r => r.change_percent > 0).length, dn = valid.filter(r => r.change_percent < 0).length;
  const avg = valid.length ? valid.reduce((s, r) => s + r.change_percent, 0) / valid.length : null;
  const best = valid.slice().sort((a, b) => b.change_percent - a.change_percent)[0], worst = valid.slice().sort((a, b) => a.change_percent - b.change_percent)[0];
  ROOT.querySelector("#wlStats").innerHTML = FE.stats([
    { l: "종목 수", v: ROWS.length, vcls: "c-white" },
    { l: "상승 / 하락", v: `<span class="pos">${up}</span> <span class="c-dim">/</span> <span class="neg">${dn}</span>` },
    { l: "평균 등락률 (단순 평균)", v: FE.pctRaw(avg), vcls: FE.cls(avg) },
    { l: "최고 상승", v: best ? esc(best.symbol) : "—", vcls: "sm c-white", d: best ? `<span class="${FE.cls(best.change_percent)}">${FE.pctRaw(best.change_percent)}</span>` : "" },
    { l: "최대 하락", v: worst ? esc(worst.symbol) : "—", vcls: "sm c-white", d: worst ? `<span class="${FE.cls(worst.change_percent)}">${FE.pctRaw(worst.change_percent)}</span>` : "" }]);
  const cols = [
    { k: "order", l: "", a: "c", f: (v, r) => `<button class="wl-mv" data-mv="-1" data-sym="${esc(r.symbol)}" title="위로">▲</button><button class="wl-mv" data-mv="1" data-sym="${esc(r.symbol)}" title="아래로">▼</button>` },
    { k: "symbol", l: "종목", a: "l", sort: true, f: v => `<b class="c-orange">${esc(v)}</b>` },
    { k: "name", l: "이름", a: "l", sort: true, f: v => `<span class="c-white">${esc(String(v || "").slice(0, 30))}</span>` },
    { k: "price", l: "현재가", sort: true, f: (v, r) => `<b class="c-white">${fmtPx(v, r.symbol)}</b>` },
    { k: "change", l: "변동", sort: true, f: (v, r) => `<span class="${FE.cls(v)}">${v == null ? "—" : (v > 0 ? "+" : "") + fmtPx(v, r.symbol)}</span>` },
    { k: "change_percent", l: "등락률", sort: true, f: v => `<b class="${FE.cls(v)}">${FE.arrow(v)} ${FE.pctRaw(v)}</b>` },
    { k: "open", l: "시가", sort: true, f: (v, r) => fmtPx(v, r.symbol) },
    { k: "high", l: "고가", sort: true, f: (v, r) => `<span class="pos">${fmtPx(v, r.symbol)}</span>` },
    { k: "low", l: "저가", sort: true, f: (v, r) => `<span class="neg">${fmtPx(v, r.symbol)}</span>` },
    { k: "range", l: "일중 위치", sort: true, tip: "오늘 저가(0%)~고가(100%) 사이에서 현재가 위치", f: v => v == null ? "—" : `<div class="bar-h" style="width:70px;display:inline-block"><i style="width:${(v * 100).toFixed(0)}%"></i></div>` },
    { k: "volume", l: "거래량", sort: true, f: v => v ? FE.big(v) : "—" },
    { k: "spark5", l: "5일 추이", sort: true, f: (v, r) => `<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end">${FE.sparkline(r.spark, 100, 24)}<span class="${FE.cls(v)}" style="min-width:56px">${FE.spct(v, 1)}</span></div>` },
    { k: "x", l: "", a: "c", f: (v, r) => `<button class="wl-x" data-del="${esc(r.symbol)}" title="목록에서 삭제">✕</button>` }];
  box.innerHTML = FE.panel({ title: esc(l.name), sub: `${ROWS.length}종목 · 열 제목 클릭 = 정렬 · ▲▼ = 순서 변경`, flush: true, bodyId: "wlT",
    body: FE.table(cols, ROWS, { rowCls: () => "click", rowAttr: r => `data-sym="${esc(r.symbol)}"`, empty: "종목이 없습니다." }) });
  const t = box.querySelector("#wlT");
  t.querySelectorAll("th[data-sort]").forEach(th => th.onclick = () => {
    const k = th.dataset.sort, dir = t._k === k ? -(t._d || 1) : -1; t._k = k; t._d = dir;
    SORT = (a, b) => { const x = a[k], y = b[k]; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * dir; };
    ROWS.sort(SORT); draw();
  });
  if (flash) {
    t.querySelectorAll("tr[data-sym]").forEach(tr => { const r = ROWS.find(x => x.symbol === tr.dataset.sym); if (r && LAST[r.symbol] != null && LAST[r.symbol] !== r.price) tr.children[3].classList.add("flash"); });
    ROWS.forEach(r => LAST[r.symbol] = r.price);
  }
}

function exportCsv() {
  const l = activeList(load());
  const head = ["symbol", "name", "price", "change", "change_percent", "high", "low", "volume"];
  const lines = [head.join(",")].concat(l.symbols.map(s => { const r = ROWS.find(x => x.symbol === s) || { symbol: s };
    return head.map(h => { const v = r[h] ?? ""; return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v; }).join(","); }));
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `watchlist_${l.name}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  FE.toast(`'${l.name}' ${l.symbols.length}종목을 CSV로 저장했어요.`);
}
async function importCsv(file) {
  if (!file) return;
  const text = (await file.text()).replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const syms = [];
  lines.forEach((ln, i) => { const c = ln.split(",")[0].replace(/"/g, "").trim().toUpperCase(); if (i === 0 && /^(SYMBOL|TICKER|종목|코드)/i.test(c)) return; if (/^[A-Z0-9.\-^=]{1,20}$/.test(c)) syms.push(c); });
  ROOT.querySelector("#wlFile").value = "";
  if (!syms.length) return FE.toast("CSV에서 종목 코드를 찾지 못했어요. 첫 번째 열에 종목 코드가 있어야 해요.", true);
  const name = (prompt(`${syms.length}종목을 찾았어요. 새 목록 이름 (기존 목록 이름을 쓰면 그 목록에 합칩니다)`, file.name.replace(/\.[^.]+$/, "").replace(/^watchlist_/, "")) || "").trim().slice(0, 30);
  if (!name) return;
  const d = load(); let l = d.lists.find(x => x.name === name);
  if (!l) { l = { name, symbols: [] }; d.lists.push(l); }
  syms.forEach(s => { if (!l.symbols.includes(s) && l.symbols.length < 60) l.symbols.push(s); });
  d.active = name; save(d); drawTabs(); refresh(true); FE.toast(`'${name}' 목록에 ${syms.length}종목을 가져왔어요.`);
}

function suggest(inp, onPick) {
  const box = document.createElement("div"); box.className = "wl-sug"; inp.after(box);
  let t, items = [], sel = -1;
  const show = list => { items = list; sel = -1; box.innerHTML = list.map((x, i) => `<div data-i="${i}"><b>${esc(x.symbol)}</b><i>${esc(x.name || "")}</i><span>${esc(x.exchange || "")}</span></div>`).join(""); box.style.display = list.length ? "block" : "none"; };
  inp.addEventListener("input", () => {
    clearTimeout(t); const q = inp.value.trim(); if (q.length < 1 || q.includes(",")) return show([]);
    t = setTimeout(async () => { try { show(((await FE.api("/api/search?q=" + encodeURIComponent(q))).results || []).slice(0, 8)); } catch { show([]); } }, 250);
  });
  inp.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(-1, Math.min(items.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1))); [...box.children].forEach((d, i) => d.classList.toggle("sel", i === sel)); }
    if (e.key === "Enter") { const v = sel >= 0 ? items[sel].symbol : inp.value.trim(); show([]); if (v) onPick(v); }
    if (e.key === "Escape") show([]);
  });
  box.addEventListener("mousedown", e => { const d = e.target.closest("[data-i]"); if (d) { e.preventDefault(); show([]); onPick(items[+d.dataset.i].symbol); } });
  inp.addEventListener("blur", () => setTimeout(() => show([]), 150));
}
})();
