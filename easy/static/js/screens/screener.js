/* SCREENER — 스크리너: Yahoo 사전 정의 스크린(yf.screen) + 사용자 조건 스크린(EquityQuery).
   Deep links: #screener/day_gainers   #screener/custom */
(() => {
const esc = FE.esc;
FE.glossary({
  screener: ["스크리너", "조건(시가총액·PER·배당 등)에 맞는 종목만 골라내는 도구. 아이디어를 찾는 출발점이지, 그 자체로 매수 신호는 아니에요."],
  w52chg: ["52주 수익률", "1년 전 가격 대비 현재가 변화율."],
  expense: ["총보수", "펀드·ETF가 1년에 떼어가는 운용 비용 비율."],
});

/* watchlist storage — same format as watchlist.js */
const WL_KEY = "watchlists";
const WL_DEFAULT = () => ({ active: "기본", lists: [
  { name: "기본", symbols: ["AAPL", "MSFT", "NVDA", "005930.KS", "000660.KS"] },
  { name: "지수", symbols: ["^GSPC", "^IXIC", "^DJI", "^KS11", "^KQ11", "^N225", "^VIX"] }] });
const wlLoad = () => { const d = FE.store.get(WL_KEY, null); return d && Array.isArray(d.lists) && d.lists.length ? d : WL_DEFAULT(); };
function wlAdd(syms, listName) {
  const d = wlLoad(); const l = d.lists.find(x => x.name === listName) || d.lists.find(x => x.name === d.active) || d.lists[0];
  const add = syms.filter(s => !l.symbols.includes(s)).slice(0, Math.max(0, 60 - l.symbols.length));
  l.symbols.push(...add); FE.store.set(WL_KEY, d);
  FE.toast(add.length ? `관심종목 '${l.name}'에 ${add.length}종목 추가 (${add.slice(0, 5).join(", ")}${add.length > 5 ? " …" : ""})` : `추가할 새 종목이 없어요 (이미 있거나 목록이 가득 참).`);
}

if (!document.getElementById("sc-style")) {
  const st = document.createElement("style"); st.id = "sc-style";
  st.textContent = `
  #scr-screener .sc-wrap { display:grid; grid-template-columns: 300px minmax(0,1fr); gap:8px; align-items:start; }
  #scr-screener .sc-list .it { padding:7px 12px; border-bottom:1px solid var(--border-dim); cursor:pointer; }
  #scr-screener .sc-list .it:hover { background:var(--bg-hover); }
  #scr-screener .sc-list .it.on { background:var(--accent-bg); border-left:3px solid var(--accent); padding-left:9px; }
  #scr-screener .sc-list .it b { color:var(--text); } #scr-screener .sc-list .it.on b { color:var(--accent); }
  #scr-screener .sc-list .it div { color:var(--text-3); font-size:11.5px; margin-top:2px; line-height:1.4; }
  #scr-screener .sc-list .grp { padding:6px 12px 3px; color:var(--text-3); font-size:11px; font-weight:700; letter-spacing:1px; background:var(--bg-raised); }
  #scr-screener .sc-chk { width:16px; height:16px; accent-color:var(--accent); cursor:pointer; vertical-align:middle; }
  #scr-screener .sc-form .field input, #scr-screener .sc-form .field select { width:100%; }
  #scr-screener .sc-rng { display:flex; gap:4px; align-items:center; } #scr-screener .sc-rng input { width:100%; }
  @media (max-width:1000px) { #scr-screener .sc-wrap { grid-template-columns:1fr; } }`;
  document.head.appendChild(st);
}

let ROOT = null, META = null, ROWS = [], CUR = null, SEL = new Set(), SORT = {};
const noDec = c => c === "KRW" || c === "JPY";
const pxc = (v, c) => v == null ? "—" : noDec(c) ? FE.int(v) : FE.price(v);
const mcap = (v, c) => v == null ? "—" : c === "KRW" ? FE.krw(v) + "원" : FE.big(v) + (c && c !== "USD" ? " " + c : "");

FE.screen({
  id: "screener", label: "스크리너", primary: true, order: 11, group: "리서치",
  desc: "Yahoo 사전 정의 스크린(상승률·거래량·저평가 등)과 조건 검색(지역·섹터·시가총액·PER·배당)",
  async render(el, arg) {
    ROOT = el; SEL = new Set();
    const start = arg || FE.store.get("sc.last", "day_gainers");
    el.innerHTML = FE.screenHead("EQUITY SCREENER", `${FE.term("screener", "스크리너")} — 조건에 맞는 종목 찾기`,
      `<select class="inp" id="scList" title="'관심종목 추가' 버튼이 넣을 목록"></select>
       <button class="btn" id="scAddWl" title="체크한 종목(없으면 화면의 전체 결과)을 관심종목에 추가">+ 관심종목</button>
       <button class="btn muted" id="scCsv">CSV 내보내기</button>`) +
      `<div class="sc-wrap"><div>${FE.panel({ title: "스크린 목록", sub: "YAHOO PREDEFINED", flush: true, bodyId: "scPresets", body: `<div class="loading">불러오는 중…</div>` })}</div>
         <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
           <div id="scCustom"></div>
           <div id="scOut"></div></div></div>`;
    const d = wlLoad();
    el.querySelector("#scList").innerHTML = d.lists.map(l => `<option ${l.name === d.active ? "selected" : ""}>${esc(l.name)}</option>`).join("");
    el.querySelector("#scAddWl").onclick = () => {
      const syms = SEL.size ? [...SEL] : ROWS.map(r => r.symbol);
      if (!syms.length) return FE.toast("추가할 종목이 없어요.", true);
      wlAdd(syms, el.querySelector("#scList").value);
    };
    el.querySelector("#scCsv").onclick = exportCsv;
    try { META ??= await FE.api("/api/screener/presets"); } catch (e) { return FE.error(el.querySelector("#scPresets"), e); }
    if (!ROOT) return;
    const groups = {}; META.presets.forEach(p => (groups[p.kind] ??= []).push(p));
    el.querySelector("#scPresets").innerHTML = `<div class="sc-list"><div class="it ${start === "custom" ? "on" : ""}" data-p="custom"><b>조건 검색 (직접 만들기)</b><div>지역·섹터·시가총액·PER·배당·등락률 조건 조합 — 한국 시장 포함</div></div>` +
      Object.entries(groups).map(([g, list]) => `<div class="grp">${esc(g)}</div>` + list.map(p => `<div class="it ${p.id === start ? "on" : ""}" data-p="${p.id}"><b>${esc(p.name)}</b><div>${esc(p.desc)}</div></div>`).join("")).join("") + `</div>`;
    el.querySelector("#scPresets").onclick = e => { const it = e.target.closest("[data-p]"); if (!it) return; el.querySelectorAll(".sc-list .it").forEach(x => x.classList.toggle("on", x === it)); open(it.dataset.p); };
    el.querySelector("#scOut").addEventListener("click", e => {
      if (e.target.closest(".sc-chk")) { const c = e.target.closest(".sc-chk"); if (c.dataset.all != null) { SEL = c.checked ? new Set(ROWS.map(r => r.symbol)) : new Set(); draw(); } else { c.checked ? SEL.add(c.dataset.s) : SEL.delete(c.dataset.s); updSel(); } e.stopPropagation(); return; }
      const tr = e.target.closest("tr[data-sym]"); if (tr) FE.go("research", tr.dataset.sym);
    });
    open(META.presets.some(p => p.id === start) || start === "custom" ? start : "day_gainers");
  },
  leave() { ROOT = null; },
});
FE.command("/screen", "스크리너 (예: /screen day_gainers)", a => FE.go("screener", a || ""));

function open(id) {
  FE.store.set("sc.last", id); history.replaceState(null, "", "#screener/" + id);
  SEL = new Set();
  const cbox = ROOT.querySelector("#scCustom");
  if (id === "custom") { cbox.innerHTML = customForm(); bindCustom(); runCustom(); }
  else { cbox.innerHTML = ""; runPreset(id); }
}

async function runPreset(id) {
  const out = ROOT.querySelector("#scOut"); FE.loading(out, "Yahoo 스크리너를 실행하는 중…");
  const count = FE.store.get("sc.count", 100);
  try {
    const d = await FE.api("/api/screener/run?" + FE.qs({ preset: id, count }));
    if (!ROOT || FE.store.get("sc.last") !== id) return;
    CUR = { title: d.name, sub: d.desc, total: d.total, kind: d.kind, id };
    ROWS = d.rows; SORT = {}; draw();
  } catch (e) { FE.error(out, e); }
}

function customForm() {
  const f = FE.store.get("sc.custom", { region: "kr", sector: "", mcap_min: "", mcap_max: "", pe_min: "", pe_max: "", pb_max: "", div_min: "", chg_min: "", chg_max: "", roe_min: "", sort: "mcap", asc: false, major: true });
  const opt = (list, v) => list.map(x => `<option value="${x.id}" ${x.id === v ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  const unit = f.region === "kr" ? "억원" : f.region === "us" ? "백만 달러" : "백만 (현지 통화)";
  const inp = (k, ph) => `<input class="inp" name="${k}" value="${esc(f[k] ?? "")}" placeholder="${ph || ""}">`;
  return FE.panel({ title: "조건 검색", sub: "Yahoo EquityQuery · 빈 칸은 조건 없음", bar: true, body: `
    <form class="form sc-form" id="scForm">
      ${FE.field("지역", `<select class="inp" name="region">${opt(META.regions, f.region)}</select>`)}
      ${FE.field("섹터", `<select class="inp" name="sector"><option value="">전체</option>${opt(META.sectors, f.sector)}</select>`)}
      ${FE.field(`${FE.term("mcap", "시가총액")} (<span id="scUnit">${unit}</span>)`, `<div class="sc-rng">${inp("mcap_min", "최소")}~${inp("mcap_max", "최대")}</div>`)}
      ${FE.field(`${FE.term("per", "PER")} (배)`, `<div class="sc-rng">${inp("pe_min", "최소")}~${inp("pe_max", "최대")}</div>`)}
      ${FE.field(`${FE.term("pbr", "PBR")} 최대 (배)`, inp("pb_max", "예: 1"))}
      ${FE.field(`${FE.term("div", "배당수익률")} 최소 (%)`, inp("div_min", "예: 3"))}
      ${FE.field(`${FE.term("roe", "ROE")} 최소 (%)`, inp("roe_min", "예: 10"))}
      ${FE.field("오늘 등락률 (%)", `<div class="sc-rng">${inp("chg_min", "최소")}~${inp("chg_max", "최대")}</div>`)}
      ${FE.field("정렬", `<select class="inp" name="sort">${[["mcap", "시가총액"], ["chg", "등락률"], ["volume", "거래량"], ["pe", "PER"], ["div", "배당수익률"], ["price", "주가"]].map(([v, l]) => `<option value="${v}" ${v === f.sort ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
      ${FE.field("순서", `<select class="inp" name="asc"><option value="0" ${!f.asc ? "selected" : ""}>높은 순</option><option value="1" ${f.asc ? "selected" : ""}>낮은 순</option></select>`)}
      <label class="chk" style="align-self:center"><input type="checkbox" name="major" ${f.major !== false ? "checked" : ""}> 주요 거래소만 (장외 제외)</label>
      <button class="btn solid" type="submit">검색</button>
    </form>
    <div class="row" style="margin-top:8px"><span class="note">빠른 예시:</span>
      <button class="btn muted" data-ex="kr_value">한국 저PBR 대형주</button><button class="btn muted" data-ex="kr_div">한국 고배당</button>
      <button class="btn muted" data-ex="us_div">미국 배당주 (3%+, PER 20 이하)</button><button class="btn muted" data-ex="us_tech">미국 대형 기술주</button>
      <button class="btn muted" data-ex="kr_up">한국 오늘 급등 (+5%)</button></div>` });
}
const EXAMPLES = {
  kr_value: { region: "kr", sector: "", mcap_min: "10000", pb_max: "1", sort: "mcap" },
  kr_div: { region: "kr", sector: "", mcap_min: "5000", div_min: "4", sort: "div" },
  us_div: { region: "us", sector: "", mcap_min: "10000", div_min: "3", pe_min: "0", pe_max: "20", sort: "div" },
  us_tech: { region: "us", sector: "Technology", mcap_min: "100000", sort: "mcap" },
  kr_up: { region: "kr", sector: "", chg_min: "5", sort: "chg" },
};
function bindCustom() {
  const form = ROOT.querySelector("#scForm");
  form.region.onchange = () => { ROOT.querySelector("#scUnit").textContent = form.region.value === "kr" ? "억원" : form.region.value === "us" ? "백만 달러" : "백만 (현지 통화)"; };
  form.addEventListener("submit", e => { e.preventDefault(); saveForm(); runCustom(); });
  ROOT.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => {
    FE.store.set("sc.custom", { mcap_min: "", mcap_max: "", pe_min: "", pe_max: "", pb_max: "", div_min: "", chg_min: "", chg_max: "", roe_min: "", asc: false, major: true, ...EXAMPLES[b.dataset.ex] });
    ROOT.querySelector("#scCustom").innerHTML = customForm(); bindCustom(); runCustom();
  });
}
function saveForm() {
  const form = ROOT.querySelector("#scForm"), f = Object.fromEntries(new FormData(form));
  f.asc = f.asc === "1"; f.major = !!form.major.checked; FE.store.set("sc.custom", f); return f;
}
async function runCustom() {
  const f = saveForm(), out = ROOT.querySelector("#scOut");
  const unit = f.region === "kr" ? 1e8 : 1e6, n = v => v === "" || v == null ? null : Number(v);
  const body = { region: f.region, sector: f.sector || null, sort: f.sort, asc: f.asc, major: f.major, count: FE.store.get("sc.count", 100),
    mcap_min: n(f.mcap_min) != null ? n(f.mcap_min) * unit : null, mcap_max: n(f.mcap_max) != null ? n(f.mcap_max) * unit : null,
    pe_min: n(f.pe_min), pe_max: n(f.pe_max), pb_max: n(f.pb_max), div_min: n(f.div_min), roe_min: n(f.roe_min), chg_min: n(f.chg_min), chg_max: n(f.chg_max) };
  if (Object.entries(body).some(([k, v]) => typeof v === "number" && isNaN(v))) return FE.toast("숫자 칸에 숫자만 입력하세요.", true);
  FE.loading(out, "조건 검색 중…");
  try {
    const d = await FE.api("/api/screener/custom", body);
    if (!ROOT || FE.store.get("sc.last") !== "custom") return;
    const reg = META.regions.find(r => r.id === f.region)?.name || f.region, sec = META.sectors.find(s => s.id === f.sector)?.name;
    CUR = { title: "조건 검색 결과", sub: `${reg}${sec ? " · " + sec : ""} · 조건 ${d.conditions}개`, total: d.total, kind: "주식", id: "custom",
      note: f.region !== "us" ? "미국 외 종목은 Yahoo가 결과 목록에 PER·PBR 값을 주지 않는 경우가 많아 '—'로 보일 수 있어요(조건 필터 자체는 적용됨). 예상PER은 올해 예상 EPS 기준." : "" };
    ROWS = d.rows; SORT = {}; draw();
  } catch (e) { FE.error(out, e); }
}

function draw() {
  const out = ROOT?.querySelector("#scOut"); if (!out) return;
  const fund = CUR.kind !== "주식";
  const cols = [
    { k: "sel", l: `<input type="checkbox" class="sc-chk" data-all ${SEL.size && SEL.size === ROWS.length ? "checked" : ""} title="전체 선택">`, a: "c", f: (v, r) => `<input type="checkbox" class="sc-chk" data-s="${esc(r.symbol)}" ${SEL.has(r.symbol) ? "checked" : ""}>` },
    { k: "symbol", l: "종목", a: "l", sort: true, f: v => `<b class="c-orange">${esc(v)}</b>` },
    { k: "name", l: "이름", a: "l", sort: true, f: v => `<span class="c-white" title="${esc(v)}">${esc(String(v || "").slice(0, 34))}</span>` },
    { k: "price", l: "현재가", sort: true, f: (v, r) => `<b class="c-white">${pxc(v, r.currency)}</b>` },
    { k: "change_pct", l: "등락률", sort: true, f: v => `<b class="${FE.cls(v)}">${FE.arrow(v)} ${FE.pctRaw(v)}</b>` },
    { k: "volume", l: "거래량", sort: true, f: v => v ? FE.big(v) : "—" },
    { k: "mcap", l: fund ? "순자산" : FE.term("mcap", "시가총액"), sort: true, f: (v, r) => mcap(v, r.currency) },
    ...(fund ? [{ k: "ytd", l: "연초 대비", sort: true, f: v => `<span class="${FE.cls(v)}">${FE.spct(v, 1)}</span>` },
               { k: "expense", l: FE.term("expense", "총보수"), sort: true, f: v => v == null ? "—" : FE.num(v, 2) + "%" }]
            : [{ k: "pe", l: FE.term("per", "PER"), sort: true, f: v => v == null ? "—" : FE.num(v, 1) },
               { k: "fpe", l: FE.term("fper", "예상PER"), sort: true, f: v => v == null ? "—" : FE.num(v, 1) },
               { k: "pb", l: FE.term("pbr", "PBR"), sort: true, f: v => v == null ? "—" : FE.num(v, 2) }]),
    { k: "div_yield", l: FE.term("div", "배당"), sort: true, f: v => FE.pct(v) },
    { k: "w52_chg", l: FE.term("w52chg", "52주"), sort: true, f: v => `<span class="${FE.cls(v)}">${FE.spct(v, 1)}</span>` },
    { k: "exchange", l: "거래소", a: "l", sort: true, f: v => `<span class="c-dim">${esc(v || "")}</span>` }];
  const counts = FE.pills("scCnt", [[25, "25"], [50, "50"], [100, "100"], [250, "250"]], FE.store.get("sc.count", 100));
  out.innerHTML = FE.panel({ title: esc(CUR.title), sub: `${esc(CUR.sub || "")}`, flush: true, bodyId: "scTbl",
    acts: `<span class="c-muted" style="font-size:12px">표시 <b class="c-white">${ROWS.length}</b> / 전체 <b class="c-orange">${CUR.total != null ? FE.int(CUR.total) : "—"}</b> · <span id="scSelN">${SEL.size ? `선택 ${SEL.size}` : ""}</span></span> <span class="c-dim" style="font-size:12px">개수</span>${counts}`,
    body: FE.table(cols, ROWS, { rowCls: () => "click", rowAttr: r => `data-sym="${esc(r.symbol)}"`, empty: "조건에 맞는 종목이 없습니다. 조건을 완화해 보세요.", maxH: "calc(100vh - 330px)" }) }) +
    (CUR.note ? `<div class="note c-yellow" style="margin-top:6px">${esc(CUR.note)}</div>` : "") + `<div class="note" style="margin-top:6px">행 클릭 = 종목 리서치 · 체크 후 「+ 관심종목」 = 선택 종목만 추가(선택 없으면 전체) · 데이터: Yahoo Finance 스크리너 (지연 시세). 스크리너 결과는 학습·아이디어용이며 투자 권유가 아닙니다.</div>`;
  const t = out.querySelector("#scTbl");
  t.querySelectorAll("th[data-sort]").forEach(th => {
    if (SORT.k === th.dataset.sort) th.innerHTML += SORT.d > 0 ? " ▲" : " ▼";
    th.onclick = () => {
      const k = th.dataset.sort; SORT = { k, d: SORT.k === k ? -SORT.d : -1 };
      ROWS.sort((a, b) => { const x = a[k], y = b[k]; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * SORT.d; });
      draw();
    };
  });
  FE.onPills(out, "scCnt", v => { FE.store.set("sc.count", +v); CUR.id === "custom" ? runCustom() : runPreset(CUR.id); });
}
function updSel() { const n = ROOT?.querySelector("#scSelN"); if (n) n.textContent = SEL.size ? `선택 ${SEL.size}` : ""; }

function exportCsv() {
  if (!ROWS.length) return FE.toast("내보낼 결과가 없어요.", true);
  const head = ["symbol", "name", "price", "currency", "change_pct", "volume", "mcap", "pe", "fpe", "pb", "div_yield", "w52_chg", "exchange"];
  const q = v => { v = v ?? ""; return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v; };
  const csv = "﻿" + [head.join(","), ...ROWS.map(r => head.map(h => q(r[h])).join(","))].join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `screener_${CUR?.id || "result"}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  FE.toast(`${ROWS.length}종목을 CSV로 저장했어요.`);
}
})();
