/* ECONOMICS — 경제 (F10): World Bank comparison & snapshot, US yield curve, IMF WEO outlook, ECB, OECD CLI, DBnomics */
(() => {
FE.glossary({
  ec_ca: ["경상수지", "상품·서비스 수출입과 해외 소득을 합친 대외 거래 수지(GDP 대비 %). 흑자면 해외에서 번 돈이 더 많다는 뜻."],
  ec_debt: ["정부 부채", "정부가 진 빚의 총액(GDP 대비 %). 일본은 200%를 넘고, 60%가 흔히 쓰이는 경계선이에요."],
  ec_fdi: ["외국인직접투자 (FDI)", "외국 기업이 공장 설립·지분 인수 등으로 들여온 장기 투자 자금."],
  ec_real: ["실질금리", "명목 금리에서 물가상승률을 뺀 금리. 실제 구매력 기준의 이자 수익."],
  ec_tfr: ["합계출산율", "여성 1명이 평생 낳을 것으로 예상되는 자녀 수. 2.1명 미만이면 인구가 줄어요(한국은 세계 최저 수준)."],
  ec_spread: ["장단기 금리차", "10년물 − 2년물(또는 3개월물) 국채 금리. 음수(역전)는 과거 미국 경기 침체 1~2년 전에 자주 나타났어요."],
  ec_inv: ["금리 역전", "단기 금리가 장기 금리보다 높은 상태. 시장이 앞으로 금리 인하(경기 둔화)를 예상한다는 신호로 읽혀요."],
  ec_effr: ["연방기금금리 (EFFR)", "미국 은행끼리 하루짜리 돈을 빌릴 때의 실제 평균 금리. 미 연준(Fed)이 목표 범위를 정해 조절하는 기준금리예요."],
  ec_weo: ["IMF 세계경제전망 (WEO)", "IMF가 매년 4월·10월 발표하는 국가별 성장률·물가·재정 전망. 올해 이후 값은 전망치예요."],
  ec_cli: ["경기선행지수 (CLI)", "OECD가 산업생산·주문·심리지표 등을 묶어 6~9개월 앞의 경기 흐름을 미리 보여주도록 만든 지수. 100이 장기 추세."],
  ec_phase: ["경기 국면", "CLI가 100 위 & 상승 = 확장, 100 위 & 하락 = 둔화, 100 아래 & 하락 = 수축, 100 아래 & 상승 = 회복."],
  ec_ecbr: ["ECB 정책금리", "유럽중앙은행 금리 3종. 예금금리(DFR)가 사실상의 기준금리, 기준금리(MRO)는 1주일 대출, 한계대출금리(MLF)는 상한."],
  ec_hicp: ["HICP (유로존 소비자물가)", "유로존 국가들이 같은 방식으로 계산하는 소비자물가지수. ECB 물가 목표는 2%."],
  ec_aaa: ["AAA 국채 수익률 곡선", "유로존에서 최고 신용등급(AAA) 국가 국채로 추정한 만기별 금리(현물 금리)."],
  ec_dbn: ["DBnomics", "IMF·OECD·세계은행·각국 통계청 등 80여 기관의 경제 통계를 한곳에 모은 공개 데이터 포털. 키 없이 검색할 수 있어요."],
  ec_ppp: ["구매력평가 (PPP)", "나라별 물가 차이를 보정한 환율. 생활 수준 비교에 써요."],
  ec_debtp: ["미 국가부채 (Debt to the Penny)", "미 재무부가 매일 공개하는 연방정부 총부채. 대중 보유분 + 정부 내부 보유분."],
  ec_gini: ["지니계수", "소득 불평등 정도(0=완전 평등, 100=완전 불평등). 30 안팎이면 낮은 편, 40 이상이면 높은 편."],
});

const C = FE.color;
const TABS = [["compare", "국가 비교"], ["snapshot", "국가 스냅샷"], ["yields", "미국 금리 YIELD CURVE"], ["imf", "IMF 전망"], ["ecb", "유럽 ECB"], ["cli", "경기선행지수"], ["dbn", "DBnomics 검색"]];
const SRC_WB = "World Bank WDI (worldbank_data.py)";
// series colours: Korea is always the accent orange, everyone else cycles through distinct hues
const SER = ["#0891b2", "#16a34a", "#dc2626", "#2563eb", "#9333ea", "#c026d3", "#64748b", "#14b8a6", "#ca8a04", "#e5e5e5"];
const colorsFor = ids => { let j = 0; return ids.map(id => id === "KOR" ? C.accent : SER[j++ % SER.length]); };
const PRESETS = [
  ["주요국", ["KOR", "USA", "JPN", "CHN", "DEU"]], ["G7", ["USA", "JPN", "DEU", "GBR", "FRA", "ITA", "CAN"]],
  ["아시아", ["KOR", "JPN", "CHN", "IND", "IDN", "VNM", "THA"]], ["신흥국", ["BRA", "IND", "IDN", "MEX", "TUR", "ZAF"]],
];
const TERM_OF = { "BN.CAB.XOKA.GD.ZS": "ec_ca", "GC.DOD.TOTL.GD.ZS": "ec_debt", "BX.KLT.DINV.WD.GD.ZS": "ec_fdi", "FR.INR.RINR": "ec_real", "SP.DYN.TFRT.IN": "ec_tfr",
  "SI.POV.GINI": "ec_gini", "FP.CPI.TOTL.ZG": "cpi", "NY.GDP.MKTP.CD": "gdp", "NY.GDP.MKTP.KD.ZG": "gdp", "GGXWDG_NGDP": "ec_debt", "BCA_NGDPD": "ec_ca", "PPPSH": "ec_ppp", "PCPIPCH": "cpi" };

const css = `
#scr-economics .ec-ctl { align-items:flex-end; gap:10px; }
#scr-economics .ec-chips { display:flex; flex-wrap:wrap; gap:2px; }
#scr-economics .ec-chips .pill { font-size:11.5px; padding:1px 7px; }
#scr-economics .ec-src { margin-top:4px; font-size:11px; color:var(--text-3); }
#scr-economics .ec-big { font-size:22px; font-weight:700; color:var(--accent); white-space:nowrap; }
#scr-economics .ec-card .panel-b { display:flex; flex-direction:column; gap:3px; }
#scr-economics .ec-card .meta { display:flex; justify-content:space-between; color:var(--text-2); font-size:11.5px; }
#scr-economics .ec-card svg.spark { width:100%; }
#scr-economics td.fc { background:#1a1000 !important; color:var(--accent); }
#scr-economics th.fc { color:var(--accent); }
#scr-economics .tbl tr.click td.l b { color:var(--text); }
#scr-economics .ph-확장 { color:var(--pos) !important; } #scr-economics .ph-둔화 { color:var(--warn) !important; }
#scr-economics .ph-수축 { color:var(--neg) !important; } #scr-economics .ph-회복 { color:var(--cyan) !important; }
#scr-economics .stat { min-width:120px; }
`;

const st = {
  tab: "compare", meta: null,
  wb: { ind: "NY.GDP.MKTP.KD.ZG", countries: ["KOR", "USA", "JPN", "CHN", "DEU"], years: 20 },
  snap: "KOR", years: 5,
  imf: { ind: "NGDP_RPCH", countries: ["KOR", "USA", "JPN", "CHN", "DEU", "WEOWORLD"], start: 2010 },
  cli: { countries: ["KOR", "USA", "CHN", "DEU", "JPN"], years: 10 },
  dbn: { q: "korea gdp", ds: null },
};
let root = null;
const $ = s => root.querySelector(s);
const cpanel = o => FE.panel({ title: o.title, color: o.color || "orange", bar: o.bar, cls: o.cls || "", sub: o.unit ? "단위: " + o.unit : "", acts: o.acts || "",
  body: `<div class="chart ${o.h || "md"}"><canvas id="${o.id}"></canvas></div><div class="ec-src">출처: ${o.src}</div>${o.note ? `<div class="note">${o.note}</div>` : ""}` });
const hlines = lines => ({
  id: "ecHlines",
  beforeDatasetsDraw(ch) {
    const { ctx, chartArea: a, scales: { y } } = ch;
    lines.forEach(l => { const py = y.getPixelForValue(l.y); if (!(py >= a.top && py <= a.bottom)) return;
      ctx.save(); ctx.strokeStyle = l.color || "#555"; ctx.setLineDash(l.dash || [4, 3]); ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
      if (l.label) { ctx.setLineDash([]); ctx.fillStyle = l.color || "#777"; ctx.font = "11px Consolas, 'Malgun Gothic'"; ctx.fillText(l.label, a.left + 4, py - 4); } ctx.restore(); });
  },
});
const shadeFrom = (idx, label) => ({
  id: "ecShade",
  beforeDatasetsDraw(ch) {
    if (idx == null || idx < 0) return; const { ctx, chartArea: a, scales: { x } } = ch;
    const px = Math.max(a.left, x.getPixelForValue(idx) - (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2); if (px >= a.right) return;
    ctx.save(); ctx.fillStyle = "rgba(217,119,6,.08)"; ctx.fillRect(px, a.top, a.right - px, a.bottom - a.top);
    ctx.fillStyle = C.accent; ctx.font = "11px Consolas, 'Malgun Gothic'"; ctx.fillText(label, px + 4, a.top + 12); ctx.restore();
  },
});
const fmtv = (v, kind, unit) => {
  if (v == null) return "—";
  if (kind === "usd") return "$" + FE.big(v, 2);
  if (kind === "pct" || unit === "%" || /%/.test(unit || "")) return FE.num(v, 2) + "%";
  if (Math.abs(v) >= 1e5) return FE.big(v, 2);
  return FE.num(v, 2);
};
const term = (code, label) => TERM_OF[code] ? FE.term(TERM_OF[code], FE.esc(label)) : FE.esc(label);
const cname = id => (st.meta?.countries.find(c => c.id === id) || st.meta?.wb_aggregates.find(c => c.id === id) || st.meta?.imf_aggregates.find(c => c.id === id) || {}).name || id;
function chips(name, list, sel) {
  return `<div class="ec-chips" data-chips="${name}">${list.map(c => `<button class="pill ${sel.includes(c.id) ? "on" : ""}" data-v="${c.id}" title="${c.id}">${FE.esc(c.name)}</button>`).join("")}</div>`;
}
function onChips(name, arr, max, fn) {
  const g = root.querySelector(`[data-chips="${name}"]`); if (!g) return;
  g.addEventListener("click", e => {
    const b = e.target.closest(".pill"); if (!b) return; const v = b.dataset.v; const i = arr.indexOf(v);
    if (i >= 0) { if (arr.length <= 1) return FE.toast("최소 1개는 선택해야 합니다.", true); arr.splice(i, 1); }
    else { if (arr.length >= max) return FE.toast(`최대 ${max}개까지 선택할 수 있어요.`, true); arr.push(v); }
    b.classList.toggle("on", arr.includes(v)); fn();
  });
}
const setChips = (name, arr) => root.querySelectorAll(`[data-chips="${name}"] .pill`).forEach(b => b.classList.toggle("on", arr.includes(b.dataset.v)));
const debounce = (fn, ms = 400) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };

/* ====================================================================== */
FE.screen({
  id: "economics", label: "경제", primary: true, order: 10, fkey: "F10", group: "경제·데이터",
  desc: "세계은행·IMF·미 재무부·ECB·OECD·DBnomics 거시경제 데이터",
  async render(el, arg) {
    root = el;
    if (!document.getElementById("economics-style")) { const s = document.createElement("style"); s.id = "economics-style"; s.textContent = css; document.head.appendChild(s); }
    const [t0, a1] = String(arg || "").split("/");
    st.tab = TABS.some(t => t[0] === t0) ? t0 : "compare";
    if (a1 && st.tab === "snapshot") st.snap = a1.toUpperCase();
    el.innerHTML = FE.screenHead("ECONOMICS", "세계 거시경제 데이터 — 국가 비교 · 금리 · 전망",
      `<span class="c-dim">WORLD BANK · IMF · US TREASURY · ECB · OECD · DBNOMICS</span>`) +
      FE.subtabs("ectab", TABS, st.tab) + `<div id="ecBody" style="display:flex;flex-direction:column;gap:8px"><div class="loading">불러오는 중…</div></div>`;
    FE.onSubtabs(el, "ectab", show);
    try { st.meta ??= await FE.api("/api/economics/meta"); } catch (e) { return FE.error($("#ecBody"), e); }
    show(st.tab);
  },
});
function show(t) {
  st.tab = t;
  root.querySelectorAll('[data-subtabs="ectab"] button').forEach(x => x.classList.toggle("on", x.dataset.v === t));
  history.replaceState(null, "", "#economics/" + t + (t === "snapshot" ? "/" + st.snap : ""));
  ({ compare: viewCompare, snapshot: viewSnapshot, yields: viewYields, imf: viewImf, ecb: viewEcb, cli: viewCli, dbn: viewDbn })[t]($("#ecBody"));
}

/* ====================================================================== */
/* COUNTRY COMPARISON (World Bank)                                         */
/* ====================================================================== */
function viewCompare(b) {
  const w = st.wb, m = st.meta;
  const list = m.countries.filter(c => c.wb).concat(m.wb_aggregates);
  b.innerHTML = `${FE.panel({ title: "국가 비교 COUNTRY COMPARISON", color: "orange", bar: true, body: `<div class="row ec-ctl">
      ${FE.field("지표 (세계은행)", `<select class="inp" id="cmInd" style="min-width:250px">${m.wb_indicators.map(i => `<option value="${i.code}" ${i.code === w.ind ? "selected" : ""}>${FE.esc(i.label)} (${FE.esc(i.unit)})</option>`).join("")}</select>`)}
      ${FE.field("기간", FE.pills("cmYears", [[10, "10년"], [20, "20년"], [30, "30년"], [50, "50년"]], w.years))}
      ${FE.field("빠른 선택", FE.pills("cmPre", PRESETS.map(p => [p[0], p[0]]), ""))}
      <span class="note">국가 최대 10개 · 클릭해 추가/제거</span></div>
      <div style="margin-top:8px">${chips("cmC", list, w.countries)}</div>` })}
    <div id="cmOut"><div class="loading">세계은행 데이터를 불러오는 중…</div></div>`;
  const go = debounce(loadCompare, 350);
  $("#cmInd").onchange = loadCompare;
  FE.onPills(b, "cmYears", v => { w.years = +v; loadCompare(); });
  FE.onPills(b, "cmPre", v => { w.countries = PRESETS.find(p => p[0] === v)[1].slice(); setChips("cmC", w.countries); loadCompare(); });
  onChips("cmC", w.countries, 10, go);
  loadCompare();
}
async function loadCompare() {
  const w = st.wb, out = $("#cmOut"); if (!out) return;
  w.ind = $("#cmInd").value;
  FE.loading(out, "세계은행 데이터를 불러오는 중…");
  try {
    const d = await FE.api("/api/economics/compare?" + FE.qs({ indicator: w.ind, countries: w.countries.join(","), years: w.years }));
    if (!document.getElementById("cmOut")) return;
    const I = d.indicator;
    const years = [...new Set(d.series.flatMap(s => s.years))].sort((a, b) => a - b);
    const ranked = d.table.filter(t => t.latest != null).sort((a, b) => b.latest - a.latest);
    out.innerHTML = `<div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
      ${cpanel({ id: "cmChart", title: `${term(I.code, I.label)} · 국가별 추이`, color: "cyan", unit: I.unit, src: `${SRC_WB} · 지표 코드 ${I.code}`, h: "lg",
        note: "최근 연도 값은 아직 발표되지 않은 나라가 있어요 (세계은행 집계는 보통 1~2년 늦게 채워집니다)." })}
      ${cpanel({ id: "cmBar", title: "최신값 순위", color: "yellow", unit: I.unit, src: SRC_WB + " · 나라별 가장 최근 연도", h: "lg" })}
      </div>` + FE.panel({ title: "비교 표 TABLE", color: "orange", bar: true, flush: true, body: FE.table([
      { k: "rank", l: "순위", a: "c", f: v => v ?? "—" },
      { k: "name", l: "국가", a: "l", f: (v, r) => `<b class="c-white">${FE.esc(v)}</b> <span class="c-dim">${r.id}</span>` },
      { k: "latest", l: "최신값", f: v => `<b class="c-cyan">${fmtv(v, I.kind, I.unit)}</b>` },
      { k: "year", l: "기준 연도", a: "c", f: v => v ?? "—" },
      { k: "chg", l: "전년 대비", f: v => v == null ? "—" : `<span class="${FE.cls(v)}">${I.kind === "usd" ? (v > 0 ? "+" : "") + FE.big(v, 2) : FE.chg(v, 2) + (I.kind === "pct" ? "%p" : "")}</span>` },
      { k: "avg5", l: "최근 5년 평균", f: v => fmtv(v, I.kind, I.unit) },
      { k: "min", l: "기간 최저", f: (v, r) => v == null ? "—" : `${fmtv(v, I.kind, I.unit)} <span class="c-dim">${r.min_year}</span>` },
      { k: "max", l: "기간 최고", f: (v, r) => v == null ? "—" : `${fmtv(v, I.kind, I.unit)} <span class="c-dim">${r.max_year}</span>` },
      { k: "spark", l: "최근 15년 추이", a: "c", f: v => v ? FE.sparkline(v, 120, 22) : "" },
    ], d.table.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))) });
    FE.chart("cmChart", { type: "line", data: { labels: years, datasets: (cc => d.series.map((s, i) => FE.line(s.name, years.map(y => { const k = s.years.indexOf(y); return k < 0 ? null : s.values[k]; }), cc[i], { pointRadius: 1.5, borderWidth: s.id === "KOR" ? 2.4 : 1.6 })))(colorsFor(d.series.map(s => s.id))) },
      options: FE.chartOpts({ legend: true, xTicks: 12, yFmt: v => I.kind === "usd" || Math.abs(v) >= 1e5 ? FE.big(v, 1) : FE.num(v, 1) }) });
    FE.chart("cmBar", { type: "bar", data: { labels: ranked.map(t => `${t.name} (${t.year})`), datasets: [{ label: I.label, data: ranked.map(t => t.latest),
      backgroundColor: ranked.map(t => t.id === "KOR" ? C.accent : t.latest < 0 ? "rgba(220,38,38,.7)" : "rgba(8,145,178,.7)") }] },
      options: { ...FE.chartOpts({ yFmt: null }), indexAxis: "y", scales: { x: { grid: { color: C.grid }, ticks: { callback: v => I.kind === "usd" || Math.abs(v) >= 1e5 ? FE.big(v, 1) : FE.num(v, 1) } }, y: { grid: { display: false }, ticks: { autoSkip: false } } } } });
  } catch (e) { FE.error(out, e); }
}

/* ====================================================================== */
/* COUNTRY SNAPSHOT                                                        */
/* ====================================================================== */
function viewSnapshot(b) {
  const m = st.meta;
  b.innerHTML = `<div class="row ec-ctl">${FE.field("국가", `<select class="inp" id="snC" style="min-width:200px">${m.countries.map(c => `<option value="${c.id}" ${c.id === st.snap ? "selected" : ""}>${FE.esc(c.name)} (${c.id})</option>`).join("")}</select>`)}
    ${FE.field("빠른 선택", FE.pills("snQ", [["KOR", "한국"], ["USA", "미국"], ["JPN", "일본"], ["CHN", "중국"], ["DEU", "독일"], ["IND", "인도"], ["VNM", "베트남"]], st.snap))}</div>
    <div id="snOut"><div class="loading">불러오는 중…</div></div>`;
  $("#snC").onchange = () => { st.snap = $("#snC").value; loadSnap(); };
  FE.onPills(b, "snQ", v => { st.snap = v; $("#snC").value = v; loadSnap(); });
  loadSnap();
}
async function loadSnap() {
  const out = $("#snOut"); if (!out) return;
  history.replaceState(null, "", "#economics/snapshot/" + st.snap);
  FE.loading(out, `${cname(st.snap)} 경제 지표를 불러오는 중… (지표 16개 · 세계은행 + IMF)`);
  try {
    const d = await FE.api("/api/economics/snapshot?" + FE.qs({ country: st.snap }));
    if (!document.getElementById("snOut")) return;
    const cols = ["orange", "cyan", "green", "purple", "yellow", "blue", "magenta", "red"];
    const cards = d.cards.map((c, i) => {
      const ch = c.latest != null && c.prev != null ? c.latest - c.prev : null;
      const chTxt = ch == null ? "" : c.kind === "usd" ? (ch > 0 ? "+$" : "-$") + FE.big(Math.abs(ch), 2) : (c.kind === "pct" ? FE.chg(ch, 2) + "%p" : Math.abs(ch) >= 1000 ? (ch > 0 ? "+" : "") + FE.big(ch, 2) : FE.chg(ch, 2));
      return FE.panel({ title: term(c.code, c.label), color: cols[i % cols.length], cls: "ec-card", sub: FE.esc(c.unit), body: c.latest == null ? `<div class="empty" style="padding:8px">데이터 없음</div>` : `
        <div class="ec-big">${fmtv(c.latest, c.kind, c.unit)}</div>
        <div class="meta"><span>${c.year}년 기준</span><span class="${FE.cls(ch)}">${ch == null ? "" : "전년 대비 " + chTxt}</span></div>
        ${FE.sparkline(c.values, 260, 38, FE.palette[i % 10])}
        <div class="meta"><span>${c.years[0]}</span><span>최저 ${fmtv(Math.min(...c.values), c.kind, c.unit)} · 최고 ${fmtv(Math.max(...c.values), c.kind, c.unit)}</span><span>${c.years[c.years.length - 1]}</span></div>` });
    }).join("");
    const ol = d.outlook;
    const yrs = ol[0]?.years || [];
    out.innerHTML = `${d.note ? `<div class="note c-yellow" style="padding:4px">${FE.esc(d.note)}</div>` : ""}
      <div class="screen-sub" style="margin:2px 4px 6px;color:var(--accent);font-weight:700;letter-spacing:1px">▌ ${FE.esc(d.name)} · ${d.country} 경제 스냅샷</div>
      ${cards ? `<div class="grid cols-4">${cards}</div><div class="ec-src">출처: ${SRC_WB} · 카드별 최근 30년 추이 (스파크라인)</div>` : ""}
      ${ol.length ? `<div class="grid" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);margin-top:8px">
        ${FE.panel({ title: `${FE.term("ec_weo", "IMF 전망 OUTLOOK")} · ${FE.esc(d.name)}`, color: "orange", bar: true, flush: true, body: FE.table(
          [{ k: "label", l: "지표", a: "l", f: (v, r) => `${term(r.code, v)} <span class="c-dim">${FE.esc(r.unit)}</span>` }].concat(yrs.map((y, j) => ({ k: "v" + j, l: y >= d.this_year ? `${y}E` : String(y), f: v => v == null ? "—" : FE.num(v, 1), c: () => y >= d.this_year ? "fc" : "" }))),
          ol.map(o => ({ ...o, ...Object.fromEntries(o.values.map((v, j) => ["v" + j, v])) }))) + `<div class="ec-src" style="padding:4px 10px">출처: IMF DataMapper WEO (imf_datamapper_data.py) · <span class="c-orange">주황 칸·E = 전망치</span></div>` })}
        ${cpanel({ id: "snImf", title: "성장률 · 물가 전망", color: "cyan", unit: "%", src: "IMF World Economic Outlook · 음영 구간 = 전망", h: "md" })}
      </div>` : ""}`;
    out.querySelectorAll(".ec-card svg.spark").forEach(x => x.setAttribute("preserveAspectRatio", "none"));
    const g = ol.find(o => o.code === "NGDP_RPCH"), p = ol.find(o => o.code === "PCPIPCH");
    if (g || p) {
      const fi = yrs.findIndex(y => y >= d.this_year);
      FE.chart("snImf", { type: "bar", data: { labels: yrs.map(y => y >= d.this_year ? y + "E" : y), datasets: [
        g && { label: "실질 GDP 성장률", data: g.values, backgroundColor: yrs.map(y => y >= d.this_year ? "rgba(217,119,6,.45)" : C.accent) },
        p && { label: "물가상승률", data: p.values, backgroundColor: yrs.map(y => y >= d.this_year ? "rgba(8,145,178,.45)" : C.cyan) }].filter(Boolean) },
        options: FE.chartOpts({ legend: true, yFmt: v => v + "%" }), plugins: [shadeFrom(fi, "IMF 전망")] });
    }
  } catch (e) { FE.error(out, e); }
}

/* ====================================================================== */
/* US TREASURY YIELD CURVE                                                 */
/* ====================================================================== */
function viewYields(b) {
  b.innerHTML = `<div class="row ec-ctl">${FE.field("금리차 기간", FE.pills("ycY", [[1, "1년"], [2, "2년"], [5, "5년"], [10, "10년"], [20, "20년"], [36, "1990~"]], st.years))}
    <span class="note">미 연준 H.15 일별 국채 금리 (1990년~) · 실패 시 treasury.gov → Yahoo 순서로 대체</span></div>
    <div id="ycOut"><div class="loading">미국 국채 금리를 불러오는 중…</div></div>`;
  FE.onPills(b, "ycY", v => { st.years = +v; loadYields(); });
  loadYields();
}
async function loadYields() {
  const out = $("#ycOut"); if (!out) return;
  try {
    const d = await FE.api("/api/economics/yields?" + FE.qs({ years: st.years }));
    if (!document.getElementById("ycOut")) return;
    const now = d.curves.now.values, L = d.labels, ix = l => L.indexOf(l);
    const ef = d.effr, efLast = ef.rate.length ? ef.rate.length - 1 : -1;
    const bp = (a, b2) => a == null || b2 == null ? null : (a - b2) * 100;
    const inv = d.inverted_now;
    out.innerHTML = FE.stats([
      { l: "미 국채 3개월", v: FE.num(now[ix("3M")], 2) + "%", vcls: "sm" },
      { l: "2년물", v: FE.num(now[ix("2Y")], 2) + "%", d: d.curves.w1 ? `1주 ${FE.chg(bp(now[ix("2Y")], d.curves.w1.values[ix("2Y")]), 0)}bp` : "" },
      { l: "10년물", v: FE.num(now[ix("10Y")], 2) + "%", d: d.curves.w1 ? `1주 ${FE.chg(bp(now[ix("10Y")], d.curves.w1.values[ix("10Y")]), 0)}bp` : "" },
      { l: "30년물", v: FE.num(now[ix("30Y")], 2) + "%", vcls: "sm" },
      { l: FE.term("ec_spread", "10Y − 2Y"), v: FE.chg(d.spread_now * 100, 0) + "bp", vcls: d.spread_now < 0 ? "neg" : "pos", d: inv ? `${FE.term("ec_inv", "역전")} ${d.run_days}거래일째` : `정상 · ${d.run_days}거래일째` },
      { l: FE.term("ec_spread", "10Y − 3M"), v: FE.chg(d.spread3m_now * 100, 0) + "bp", vcls: d.spread3m_now < 0 ? "neg" : "pos" },
      { l: FE.term("ec_effr", "연방기금금리"), v: efLast >= 0 ? FE.num(ef.rate[efLast], 2) + "%" : "—", vcls: "sm", d: efLast >= 0 ? `목표 ${FE.num(ef.lo[efLast], 2)}~${FE.num(ef.hi[efLast], 2)}%` : "" },
    ]) + `<div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);margin-top:8px">
      ${cpanel({ id: "ycCurve", title: `${FE.term("yc", "수익률 곡선")} US TREASURY CURVE`, color: "orange", unit: "연 %", src: d.source + ` · 기준일 ${d.asof}`, h: "lg" })}
      ${FE.panel({ title: "만기별 금리 · 변화 (bp)", color: "cyan", flush: true, body: FE.table([
        { k: "m", l: "만기", a: "l", f: v => `<b class="c-white">${v}</b>` }, { k: "now", l: "현재 %", f: v => `<b class="c-cyan">${FE.num(v, 2)}</b>` },
        ...[["w1", "1주"], ["m1", "1개월"], ["m6", "6개월"], ["y1", "1년"]].map(([k, l]) => ({ k, l: l + " 변화", f: v => v == null ? "—" : `<span class="${FE.cls(v)}">${FE.chg(v, 0)}</span>` }))],
        L.map((m, i) => ({ m, now: now[i], ...Object.fromEntries(["w1", "m1", "m6", "y1"].map(k => [k, d.curves[k] ? bp(now[i], d.curves[k].values[i]) : null])) }))) +
        `<div class="note" style="padding:6px 10px">bp = 0.01%p. 단기 금리는 기준금리 기대를, 장기 금리는 성장·물가 전망과 기간 프리미엄을 반영해요.</div>` })}
      </div>
      <div class="grid cols-2">
        ${cpanel({ id: "ycSpread", title: `${FE.term("ec_spread", "장단기 금리차")} 10Y−2Y · 10Y−3M`, color: "red", unit: "%p (빨간 음영 = 역전)", src: d.source, h: "md",
          note: `기간 중 역전 비율 ${FE.pct(d.inverted_share, 0)} · 마지막 10Y−2Y 역전일 ${d.last_inversion || "없음"}` })}
        ${cpanel({ id: "ycLevel", title: "금리 수준 2Y · 10Y · 연방기금금리", color: "cyan", unit: "연 %", src: d.source + " · EFFR: NY Fed (federal_reserve_data.py)", h: "md" })}
      </div>
      ${d.debt.dates.length ? cpanel({ id: "ycDebt", title: `${FE.term("ec_debtp", "미국 국가부채")} DEBT TO THE PENNY`, color: "purple", unit: "조 달러",
        src: "U.S. Treasury FiscalData (treasury_data.py) · 최근 3년", h: "sm",
        acts: `<b class="c-purple">$${FE.num(d.debt.total[d.debt.total.length - 1] / 1e12, 2)}조</b> <span class="c-dim">${d.debt.dates[d.debt.dates.length - 1]}</span>` }) : ""}`;
    const cs = [["now", "현재", C.accent, 2.6], ["w1", "1주 전", C.cyan, 1.2], ["m1", "1개월 전", C.purple, 1.2], ["y1", "1년 전", C.text2, 1.2], ["y2", "2년 전", "#475569", 1.2]];
    FE.chart("ycCurve", { type: "line", data: { datasets: cs.filter(([k]) => d.curves[k]).map(([k, l, c, w]) =>
      FE.line(`${l} (${d.curves[k].date})`, d.mat_years.map((x, i) => ({ x, y: d.curves[k].values[i] })).filter(p => p.y != null), c, { borderWidth: w, pointRadius: k === "now" ? 3 : 1.5, borderDash: k === "now" ? undefined : [4, 3] })) },
      options: FE.chartOpts({ legend: true, xType: "linear", mode: "nearest", yFmt: v => v.toFixed(2) + "%",
        x: { type: "logarithmic", min: 0.08, max: 30, ticks: { autoSkip: false, maxTicksLimit: 20, maxRotation: 0, callback: v => ({ 0.08333333333333333: "1M", 0.25: "3M", 0.5: "6M", 1: "1Y", 2: "2Y", 3: "3Y", 5: "5Y", 7: "7Y", 10: "10Y", 20: "20Y", 30: "30Y" })[v] ?? "" },
          afterBuildTicks: ax => { ax.ticks = d.mat_years.map(v => ({ value: v })); }, grid: { color: C.grid } } }) });
    const h = d.history, xf = v => String(v).slice(0, st.years > 5 ? 4 : 7);
    FE.chart("ycSpread", { type: "line", data: { labels: h.dates, datasets: [
      FE.line("10Y−2Y", h.s10_2, C.accent, { fill: { target: { value: 0 }, above: "rgba(217,119,6,.08)", below: "rgba(220,38,38,.35)" } }),
      FE.line("10Y−3M", h.s10_3m, C.cyan, { borderWidth: 1 })] },
      options: FE.chartOpts({ legend: true, xFmt: xf, yFmt: v => v.toFixed(1) }), plugins: [hlines([{ y: 0, color: "#777", label: "0 (역전 경계)" }])] });
    const efMap = new Map(ef.dates.map((x, i) => [x, ef.rate[i]]));
    FE.chart("ycLevel", { type: "line", data: { labels: h.dates, datasets: [
      FE.line("2년물", h.y2, C.purple), FE.line("10년물", h.y10, C.accent), FE.line("30년물", h.y30, "#475569", { borderWidth: 1 }),
      FE.line("연방기금금리", h.dates.map(x => efMap.get(x) ?? null), C.pos, { borderWidth: 1.4, stepped: true })] },
      options: FE.chartOpts({ legend: true, xFmt: xf, yFmt: v => v.toFixed(1) + "%" }) });
    if (d.debt.dates.length) FE.chart("ycDebt", { type: "line", data: { labels: d.debt.dates, datasets: [
      FE.line("총부채", d.debt.total.map(v => v / 1e12), C.purple, { fill: { target: "origin", above: "rgba(147,51,234,.12)" } }), FE.line("대중 보유분", d.debt.public.map(v => v / 1e12), C.cyan, { borderWidth: 1 })] },
      options: FE.chartOpts({ legend: true, xFmt: v => String(v).slice(0, 7), yFmt: v => "$" + v.toFixed(0) + "조" }) });
  } catch (e) { FE.error(out, e); }
}

/* ====================================================================== */
/* IMF WEO                                                                 */
/* ====================================================================== */
function viewImf(b) {
  const s = st.imf, m = st.meta;
  const list = m.countries.concat(m.imf_aggregates);
  b.innerHTML = `${FE.panel({ title: `${FE.term("ec_weo", "IMF 세계경제전망")} WEO OUTLOOK`, color: "orange", bar: true, body: `<div class="row ec-ctl">
      ${FE.field("지표", `<select class="inp" id="imInd" style="min-width:220px">${m.imf_indicators.map(i => `<option value="${i.code}" ${i.code === s.ind ? "selected" : ""}>${FE.esc(i.label)} (${FE.esc(i.unit)})</option>`).join("")}</select>`)}
      ${FE.field("시작 연도", FE.pills("imStart", [[1980, "1980"], [2000, "2000"], [2010, "2010"], [2018, "2018"]], s.start))}
      ${FE.field("빠른 선택", FE.pills("imPre", PRESETS.map(p => [p[0], p[0]]).concat([["세계", "세계·권역"]]), ""))}</div>
      <div style="margin-top:8px">${chips("imC", list, s.countries)}</div>` })}
    <div id="imOut"><div class="loading">IMF 데이터를 불러오는 중…</div></div>`;
  const go = debounce(loadImf, 350);
  $("#imInd").onchange = loadImf;
  FE.onPills(b, "imStart", v => { s.start = +v; loadImf(); });
  FE.onPills(b, "imPre", v => { s.countries = v === "세계" ? ["WEOWORLD", "ADVEC", "OEMDC", "EURO", "DA", "KOR"] : PRESETS.find(p => p[0] === v)[1].slice(); setChips("imC", s.countries); loadImf(); });
  onChips("imC", s.countries, 10, go);
  loadImf();
}
async function loadImf() {
  const s = st.imf, out = $("#imOut"); if (!out) return;
  s.ind = $("#imInd").value; FE.loading(out, "IMF DataMapper에서 불러오는 중…");
  try {
    const d = await FE.api("/api/economics/imf?" + FE.qs({ indicator: s.ind, countries: s.countries.join(","), start: s.start }));
    if (!document.getElementById("imOut")) return;
    const I = d.indicator, years = [...new Set(d.series.flatMap(x => x.years))].sort((a, b) => a - b);
    const fi = years.indexOf(d.forecast_from);
    out.innerHTML = cpanel({ id: "imChart", title: `${term(I.code, I.label)} · 실적과 전망`, color: "cyan", unit: I.unit, src: `IMF DataMapper — ${FE.esc(d.source)} (imf_datamapper_data.py) · 지표 ${I.code}`, h: "lg",
      note: `${d.forecast_from}년부터(음영·점선)는 IMF 전망치입니다. 일부 국가는 그 이전 연도도 추정치일 수 있어요. ${I.en ? `원 지표명: ${FE.esc(I.en)}` : ""}` }) +
      FE.panel({ title: "연도별 표 (E = 전망)", color: "orange", bar: true, flush: true, body: FE.table(
        [{ k: "name", l: "국가·권역", a: "l", f: (v, r) => `<b class="c-white">${FE.esc(v)}</b> <span class="c-dim">${r.id}</span>` }].concat(d.cols.map(y => ({ k: String(y), l: y >= d.forecast_from ? `${y}E` : String(y), f: v => v == null ? "—" : FE.num(v, I.unit.includes("US$") && Math.abs(v) >= 1000 ? 0 : 1), c: () => y >= d.forecast_from ? "fc" : "" }))),
        d.table) + `<div class="ec-src" style="padding:4px 10px">출처: IMF WEO · 최종 갱신 ${FE.esc(d.updated || "—")} · ${FE.term("ec_weo", "WEO란?")}</div>` });
    FE.chart("imChart", { type: "line", data: { labels: years, datasets: (cc => d.series.map((x, i) => FE.line(x.name, years.map(y => { const k = x.years.indexOf(y); return k < 0 ? null : x.values[k]; }), cc[i],
      { pointRadius: 1.5, borderWidth: x.id === "KOR" ? 2.4 : 1.5, segment: { borderDash: ctx => years[ctx.p1DataIndex] > d.forecast_from ? [5, 4] : undefined } })))(colorsFor(d.series.map(x => x.id))) },
      options: FE.chartOpts({ legend: true, xTicks: 14, yFmt: v => Math.abs(v) >= 1e4 ? FE.big(v, 0) : FE.num(v, 1) }), plugins: [shadeFrom(fi, "IMF 전망"), hlines([{ y: 0, color: "#555" }])] });
  } catch (e) { FE.error(out, e); }
}

/* ====================================================================== */
/* ECB                                                                     */
/* ====================================================================== */
async function viewEcb(b) {
  FE.loading(b, "ECB 데이터를 불러오는 중…");
  try {
    const d = await FE.api("/api/economics/ecb");
    if (st.tab !== "ecb") return;
    const last = s => s && s.values.length ? s.values[s.values.length - 1] : null;
    const lastD = s => s && s.dates.length ? s.dates[s.dates.length - 1] : "";
    const R = id => (d.rates || []).find(x => x.id === id);
    const fx = id => (d.fx || []).find(x => x.id === id);
    const hU2 = (d.hicp || []).find(x => x.id === "U2");
    const yc = d.yc;
    b.innerHTML = FE.stats([
      { l: FE.term("ec_ecbr", "예금금리 DFR"), v: FE.num(last(R("DFR")), 2) + "%", d: `변경일 ${lastD(R("DFR"))}` },
      { l: FE.term("ec_ecbr", "기준금리 MRO"), v: FE.num(last(R("MRR_FR")), 2) + "%", vcls: "sm" },
      { l: FE.term("ec_ecbr", "한계대출 MLF"), v: FE.num(last(R("MLFR")), 2) + "%", vcls: "sm" },
      { l: FE.term("ec_aaa", "AAA 10년 금리"), v: yc ? FE.num(yc.now[yc.labels.indexOf("10Y")], 2) + "%" : "—", vcls: "sm", d: yc ? yc.date : "" },
      { l: FE.term("ec_hicp", "유로존 물가 HICP"), v: hU2 ? FE.num(last(hU2), 1) + "%" : "—", vcls: "sm", d: hU2 ? `최신 관측 ${lastD(hU2)}` : "" },
      { l: "EUR/USD", v: FE.num(last(fx("USD")), 4), vcls: "sm", d: lastD(fx("USD")) },
      { l: "EUR/KRW", v: FE.num(last(fx("KRW")), 2), vcls: "sm", d: "ECB 기준환율" },
    ]) + `<div class="grid cols-2">
      ${cpanel({ id: "ecRates", title: `${FE.term("ec_ecbr", "ECB 정책금리")} KEY RATES`, color: "orange", unit: "연 %", src: "ECB Data Portal FM 데이터셋 (ecb_sdmx_data.py) · 2008년~ 월말 기준", h: "md" })}
      ${cpanel({ id: "ecYc", title: `${FE.term("ec_aaa", "유로존 AAA 국채 곡선")}`, color: "cyan", unit: "연 % (현물 금리)", src: "ECB Data Portal YC 데이터셋 (ecb_sdmx_data.py)", h: "md" })}
      ${cpanel({ id: "ecHicp", title: `${FE.term("ec_hicp", "물가상승률 HICP")} · 국가별`, color: "red", unit: "전년 동월 대비 %", src: "ECB Data Portal ICP 데이터셋", h: "md",
        note: hU2 ? `최신 관측 ${lastD(hU2)} — ECB가 이 시계열을 늦게 갱신하거나 개편 중일 수 있어요. 2% 점선 = ECB 목표.` : "" })}
      ${cpanel({ id: "ecFx", title: "유로 기준환율 (1년)", color: "green", unit: "EUR 1유로당 USD (오른쪽) · KRW (왼쪽)", src: "ECB 기준환율 EXR 데이터셋", h: "md" })}
    </div>${Object.keys(d.errors || {}).length ? `<div class="note c-yellow">일부 ECB 데이터 실패: ${FE.esc(Object.keys(d.errors).join(", "))}</div>` : ""}`;
    // monthly step grid for policy rates
    if (d.rates?.length) {
      const months = []; const t0 = new Date(2008, 0, 1), t1 = new Date();
      for (let t = new Date(t0); t <= t1; t.setMonth(t.getMonth() + 1)) months.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`);
      const step = s => months.map(mo => { let v = null; for (let i = 0; i < s.dates.length; i++) { if (s.dates[i].slice(0, 7) <= mo) v = s.values[i]; else break; } return v; });
      const col = { DFR: C.accent, MRR_FR: C.cyan, MLFR: C.purple };
      FE.chart("ecRates", { type: "line", data: { labels: months, datasets: d.rates.map(s => FE.line(s.name, step(s), col[s.id] || C.text2, { stepped: true })) },
        options: FE.chartOpts({ legend: true, xFmt: v => String(v).slice(0, 4), yFmt: v => v.toFixed(1) + "%" }), plugins: [hlines([{ y: 0, color: "#555" }])] });
    }
    if (yc) FE.chart("ecYc", { type: "line", data: { labels: yc.labels, datasets: [FE.line(`현재 (${yc.date})`, yc.now, C.cyan, { pointRadius: 3, borderWidth: 2.4 }),
      FE.line(`1년 전 (${yc.ago_date})`, yc.ago, C.text2, { pointRadius: 2, borderDash: [4, 3] })] }, options: FE.chartOpts({ legend: true, yFmt: v => v.toFixed(2) + "%" }) });
    if (d.hicp?.length) {
      const ms = [...new Set(d.hicp.flatMap(s => s.dates))].sort();
      FE.chart("ecHicp", { type: "line", data: { labels: ms, datasets: d.hicp.map((s, i) => FE.line(s.name, ms.map(mo => { const k = s.dates.indexOf(mo); return k < 0 ? null : s.values[k]; }), s.id === "U2" ? C.accent : FE.palette[(i + 1) % 10], { borderWidth: s.id === "U2" ? 2.4 : 1.2 })) },
        options: FE.chartOpts({ legend: true, xFmt: v => String(v).slice(0, 4), yFmt: v => v + "%" }), plugins: [hlines([{ y: 2, color: C.pos, label: "목표 2%" }])] });
    }
    const u = fx("USD"), k = fx("KRW");
    if (u) FE.chart("ecFx", { type: "line", data: { labels: u.dates, datasets: [FE.line("EUR/USD", u.values, C.pos),
      k && FE.line("EUR/KRW", u.dates.map(x => { const i = k.dates.indexOf(x); return i < 0 ? null : k.values[i]; }), C.warn, { yAxisID: "y1", borderWidth: 1.2 })].filter(Boolean) },
      options: FE.chartOpts({ legend: true, xFmt: v => String(v).slice(2, 7), yFmt: v => v.toFixed(3), scales: { y1: { position: "left", grid: { display: false }, ticks: { callback: v => FE.num(v, 0) } } } }) });
  } catch (e) { FE.error(b, e); }
}

/* ====================================================================== */
/* OECD CLI                                                                */
/* ====================================================================== */
function viewCli(b) {
  const s = st.cli;
  b.innerHTML = `${FE.panel({ title: `${FE.term("ec_cli", "OECD 경기선행지수")} CLI`, color: "orange", bar: true, body: `<div class="row ec-ctl">
      ${FE.field("기간", FE.pills("clY", [[5, "5년"], [10, "10년"], [20, "20년"]], s.years))}
      <span class="note">100 = 장기 추세. 100 위에서 꺾이면 경기 둔화, 100 아래에서 반등하면 회복 신호로 봐요. ${FE.term("ec_phase", "국면 구분")}</span></div>
      <div style="margin-top:8px">${chips("clC", st.meta.oecd_cli, s.countries)}</div>` })}
    <div id="clOut"><div class="loading">OECD 데이터를 불러오는 중…</div></div>`;
  FE.onPills(b, "clY", v => { s.years = +v; loadCli(); });
  onChips("clC", s.countries, 8, debounce(loadCli, 350));
  loadCli();
}
async function loadCli() {
  const s = st.cli, out = $("#clOut"); if (!out) return;
  FE.loading(out, "OECD SDMX에서 불러오는 중…");
  try {
    const d = await FE.api("/api/economics/cli?" + FE.qs({ countries: s.countries.join(","), years: s.years }));
    if (!document.getElementById("clOut")) return;
    const ms = [...new Set(d.series.flatMap(x => x.dates))].sort();
    out.innerHTML = `<div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
      ${cpanel({ id: "clChart", title: "경기선행지수 추이", color: "cyan", unit: "지수 (장기 추세 = 100)", src: d.source, h: "lg" })}
      ${FE.panel({ title: "현재 국면 PHASE", color: "yellow", flush: true, body: FE.table([
        { k: "name", l: "국가", a: "l", f: (v, r) => `<b class="c-white">${FE.esc(v)}</b>` },
        { k: "value", l: "CLI", f: (v, r) => `<b class="c-cyan">${FE.num(v, 2)}</b> <span class="c-dim">${r.date}</span>` },
        { k: "m1", l: "전월비", f: v => `<span class="${FE.cls(v)}">${FE.chg(v, 2)}</span>` },
        { k: "m6", l: "6개월", f: v => `<span class="${FE.cls(v)}">${FE.chg(v, 2)}</span>` },
        { k: "phase", l: FE.term("ec_phase", "국면"), a: "c", f: v => `<b class="ph-${v}">${v || "—"}</b>` },
        { k: "spark", l: "2년", a: "c", f: v => FE.sparkline(v, 80, 20) },
      ], d.table) + `<div class="note" style="padding:6px 10px">CLI는 6~9개월 앞의 경기 방향을 가늠하는 지표로, 수치 자체보다 방향(꺾임)을 봐요. 진폭 조정(AA) 시계열입니다.</div>` })}
    </div>`;
    FE.chart("clChart", { type: "line", data: { labels: ms, datasets: (cc => d.series.map((x, i) => FE.line(x.name, ms.map(mo => { const k = x.dates.indexOf(mo); return k < 0 ? null : x.values[k]; }), cc[i], { borderWidth: x.id === "KOR" ? 2.4 : 1.4 })))(colorsFor(d.series.map(x => x.id))) },
      options: FE.chartOpts({ legend: true, xFmt: v => String(v).slice(0, 4), yFmt: v => v.toFixed(1) }), plugins: [hlines([{ y: 100, color: "#777", label: "100 = 장기 추세" }])] });
  } catch (e) { FE.error(out, e); }
}

/* ====================================================================== */
/* DBnomics                                                                */
/* ====================================================================== */
function viewDbn(b) {
  const s = st.dbn;
  b.innerHTML = `${FE.panel({ title: `${FE.term("ec_dbn", "DBnomics")} 데이터 검색`, color: "orange", bar: true, body: `<div class="row ec-ctl">
      ${FE.field("검색어 (영문 권장)", `<input class="inp" id="dbQ" value="${FE.esc(s.q)}" style="width:300px" placeholder="예: korea gdp">`)}
      <button class="btn solid" id="dbGo">검색</button>
      ${FE.field("예시", FE.pills("dbEx", [["korea gdp", "korea gdp"], ["japan cpi", "japan cpi"], ["us unemployment", "us unemployment"], ["china exports", "china exports"], ["euro area hicp", "euro area hicp"]], ""))}</div>
      <div class="note" style="margin-top:6px">1) 검색 → 2) 데이터셋 선택 → 3) 시계열 선택 순서로 IMF·OECD·세계은행·Eurostat 등 80여 기관의 통계를 바로 차트로 볼 수 있어요.</div>` })}
    <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
      ${FE.panel({ title: "1) 데이터셋 DATASETS", color: "cyan", flush: true, bodyId: "dbDs", body: `<div class="empty">검색어를 입력하세요.</div>` })}
      ${FE.panel({ title: "2) 시계열 SERIES", color: "purple", flush: true, bodyId: "dbSr", body: `<div class="empty">왼쪽에서 데이터셋을 고르세요.</div>` })}
    </div>
    <div id="dbChartBox"></div>`;
  const go = () => { s.q = $("#dbQ").value.trim(); searchDbn(); };
  $("#dbGo").onclick = go; $("#dbQ").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  FE.onPills(b, "dbEx", v => { $("#dbQ").value = v; go(); });
  searchDbn();
}
async function searchDbn() {
  const s = st.dbn, box = $("#dbDs"); FE.loading(box, "DBnomics 검색 중…");
  try {
    const d = await FE.api("/api/economics/dbnomics/search?" + FE.qs({ q: s.q }));
    if (!document.getElementById("dbDs")) return;
    box.innerHTML = FE.table([
      { k: "provider", l: "기관", a: "l", f: v => `<b class="c-orange">${FE.esc(v)}</b>` },
      { k: "name", l: "데이터셋", a: "l", f: (v, r) => `<span class="c-white">${FE.esc((v || "").slice(0, 70))}</span><br><span class="c-dim">${FE.esc(r.dataset)}</span>` },
      { k: "matching", l: "일치 시계열", f: v => FE.int(v) },
    ], d.datasets, { rowCls: () => "click", rowAttr: r => `data-p="${FE.esc(r.provider)}" data-d="${FE.esc(r.dataset)}"`, maxH: "380px", empty: "검색 결과가 없습니다. 영문 키워드로 시도해 보세요." });
    box.querySelectorAll("tr[data-p]").forEach(tr => tr.onclick = () => { box.querySelectorAll("tr").forEach(x => x.classList.toggle("sel", x === tr)); seriesDbn(tr.dataset.p, tr.dataset.d); });
    const first = box.querySelector("tr[data-p]"); if (first) first.click();
  } catch (e) { FE.error(box, e); }
}
async function seriesDbn(p, ds) {
  const box = $("#dbSr"); FE.loading(box, "시계열 목록을 불러오는 중…");
  try {
    const d = await FE.api("/api/economics/dbnomics/series?" + FE.qs({ provider: p, dataset: ds, q: st.dbn.q }));
    if (!document.getElementById("dbSr")) return;
    box.innerHTML = `<div class="note" style="padding:5px 10px">${FE.esc(d.dataset || ds)} · ${FE.int(d.found)}개 중 최대 50개 표시</div>` + FE.table([
      { k: "name", l: "시계열", a: "l", f: (v, r) => `<span class="c-white">${FE.esc((v || "").slice(0, 90))}</span><br><span class="c-dim">${FE.esc(r.code)}</span>` },
    ], d.series, { rowCls: () => "click", rowAttr: r => `data-s="${FE.esc(r.code)}"`, maxH: "350px", empty: "이 데이터셋에서 검색어와 일치하는 시계열이 없습니다." });
    box.querySelectorAll("tr[data-s]").forEach(tr => tr.onclick = () => { box.querySelectorAll("tr").forEach(x => x.classList.toggle("sel", x === tr)); dataDbn(p, ds, tr.dataset.s); });
    const first = box.querySelector("tr[data-s]"); if (first) first.click();
  } catch (e) { FE.error(box, e); }
}
async function dataDbn(p, ds, code) {
  const box = $("#dbChartBox"); FE.loading(box, "시계열을 불러오는 중…");
  try {
    const d = await FE.api("/api/economics/dbnomics/data?" + FE.qs({ provider: p, dataset: ds, series: code }));
    if (!document.getElementById("dbChartBox")) return;
    const v = d.values, n = v.length, lastV = v[n - 1], prev = n > 1 ? v[n - 2] : null;
    box.innerHTML = FE.stats([
      { l: "최신값", v: FE.num(lastV, Math.abs(lastV) >= 1000 ? 0 : 2), d: d.dates[n - 1] },
      { l: "직전 대비", v: prev == null ? "—" : FE.chg(lastV - prev, 2), vcls: FE.cls(lastV - (prev ?? lastV)), d: prev == null ? "" : d.dates[n - 2] },
      { l: "기간 최저", v: FE.num(Math.min(...v), 2), vcls: "sm" }, { l: "기간 최고", v: FE.num(Math.max(...v), 2), vcls: "sm" },
      { l: "관측치", v: FE.int(n), vcls: "sm", d: `${d.dates[0]} ~ ${d.dates[n - 1]}` },
      { l: "주기", v: FE.esc({ annual: "연간", quarterly: "분기", monthly: "월간", daily: "일간", weekly: "주간" }[d.freq] || d.freq || "—"), vcls: "sm" },
    ]) + cpanel({ id: "dbChart", title: `3) ${FE.esc((d.name || code).slice(0, 110))}`, color: "green", unit: "원 시계열 단위 (시계열 이름 참조)", h: "lg",
      src: `DBnomics · ${FE.esc(p)}/${FE.esc(ds)}/${FE.esc(code)} · <a href="${FE.esc(d.url)}" target="_blank" rel="noopener">db.nomics.world에서 보기</a>` });
    FE.chart("dbChart", { type: "line", data: { labels: d.dates, datasets: [FE.line(code, v, C.pos, { pointRadius: n < 60 ? 2 : 0, fill: { target: "origin", above: "rgba(22,163,74,.10)", below: "rgba(220,38,38,.12)" } })] },
      options: FE.chartOpts({ xTicks: 10, yFmt: x => Math.abs(x) >= 1e4 ? FE.big(x, 1) : FE.num(x, 2) }) });
  } catch (e) { FE.error(box, e); }
}

FE.command("/eco", "국가 경제 스냅샷 (예: /eco KOR)", a => FE.go("economics", "snapshot/" + ((a || "KOR").toUpperCase())));
FE.command("/yc", "미국 국채 수익률 곡선", () => FE.go("economics", "yields"));
})();
