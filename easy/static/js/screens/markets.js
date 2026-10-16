/* MARKETS — 마켓 (F2): editable quote panels, global heatmap, sector rotation */
(() => {
FE.glossary({
  rotation: ["섹터 로테이션", "경기 국면에 따라 돈이 업종 사이를 옮겨 다니는 현상. 기간별 수익률을 나란히 보면 어느 업종으로 자금이 이동 중인지 보여요."],
  heatmap: ["히트맵", "등락률을 색으로 칠한 지도. 초록은 상승, 빨강은 하락, 진할수록 크게 움직였어요."],
  ytd: ["YTD (연초 대비)", "올해 첫 거래일 직전 종가 대비 수익률."],
  futures: ["선물", "미래의 정해진 날에 정해진 가격으로 사고팔기로 한 계약. 원자재 시세는 대부분 근월물 선물 가격이에요."],
});

const DEF = [
  ["us", "미국 지수", "US INDICES", "orange", ["^GSPC", "^IXIC", "^DJI", "^RUT", "^NYA", "^VIX"]],
  ["kr", "한국 시장", "KOREA", "cyan", ["^KS11", "^KQ11", "005930.KS", "000660.KS", "373220.KS", "207940.KS", "005380.KS", "035420.KS", "035720.KS", "068270.KS"]],
  ["asia", "아시아", "ASIA-PACIFIC", "green", ["^N225", "^HSI", "000001.SS", "^TWII", "^STI", "^BSESN", "^AXJO"]],
  ["eu", "유럽", "EUROPE", "blue", ["^STOXX50E", "^GDAXI", "^FTSE", "^FCHI", "FTSEMIB.MI", "^IBEX", "^SSMI"]],
  ["fx", "외환", "FOREX", "cyan", ["KRW=X", "EURUSD=X", "JPY=X", "GBPUSD=X", "CNY=X", "AUDUSD=X", "CHF=X", "CAD=X", "EURKRW=X"]],
  ["cmd", "원자재", "COMMODITIES", "yellow", ["CL=F", "BZ=F", "GC=F", "SI=F", "HG=F", "NG=F", "PL=F", "ZC=F", "ZW=F", "ZS=F"]],
  ["bond", "채권", "FIXED INCOME", "purple", ["^IRX", "^FVX", "^TNX", "^TYX", "TLT", "IEF", "SHY", "HYG"]],
  ["crypto", "크립토", "CRYPTO", "magenta", ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "BNB-USD", "DOGE-USD", "ADA-USD", "AVAX-USD"]],
  ["sector", "섹터 ETF", "US SECTORS", "green", ["XLK", "XLC", "XLY", "XLF", "XLI", "XLV", "XLE", "XLB", "XLP", "XLU", "XLRE"]],
];
const KO = {
  "^GSPC": "S&P 500", "^IXIC": "나스닥 종합", "^DJI": "다우존스", "^RUT": "러셀 2000", "^NYA": "NYSE 종합", "^VIX": "VIX 공포지수",
  "^KS11": "코스피", "^KQ11": "코스닥", "005930.KS": "삼성전자", "000660.KS": "SK하이닉스", "373220.KS": "LG에너지솔루션", "207940.KS": "삼성바이오로직스",
  "005380.KS": "현대차", "035420.KS": "NAVER", "035720.KS": "카카오", "068270.KS": "셀트리온", "000270.KS": "기아", "005490.KS": "POSCO홀딩스", "105560.KS": "KB금융", "055550.KS": "신한지주",
  "^N225": "닛케이 225", "^HSI": "항셍", "000001.SS": "상하이 종합", "^TWII": "대만 가권", "^STI": "싱가포르 STI", "^BSESN": "인도 센섹스", "^AXJO": "호주 ASX 200",
  "^STOXX50E": "유로스톡스 50", "^GDAXI": "독일 DAX", "^FTSE": "영국 FTSE 100", "^FCHI": "프랑스 CAC 40", "FTSEMIB.MI": "이탈리아 FTSE MIB", "^IBEX": "스페인 IBEX 35", "^SSMI": "스위스 SMI",
  "KRW=X": "USD/KRW", "EURUSD=X": "EUR/USD", "JPY=X": "USD/JPY", "GBPUSD=X": "GBP/USD", "CNY=X": "USD/CNY", "AUDUSD=X": "AUD/USD", "CHF=X": "USD/CHF", "CAD=X": "USD/CAD", "EURKRW=X": "EUR/KRW", "JPYKRW=X": "JPY/KRW",
  "CL=F": "WTI 원유", "BZ=F": "브렌트유", "GC=F": "금", "SI=F": "은", "HG=F": "구리", "NG=F": "천연가스", "PL=F": "백금", "ZC=F": "옥수수", "ZW=F": "밀", "ZS=F": "대두",
  "^IRX": "미국채 3개월", "^FVX": "미국채 5년", "^TNX": "미국채 10년", "^TYX": "미국채 30년", "TLT": "미 장기채 ETF", "IEF": "미 중기채 ETF", "SHY": "미 단기채 ETF", "HYG": "하이일드 ETF",
  "BTC-USD": "비트코인", "ETH-USD": "이더리움", "SOL-USD": "솔라나", "XRP-USD": "리플", "BNB-USD": "BNB", "DOGE-USD": "도지코인", "ADA-USD": "카르다노", "AVAX-USD": "아발란체",
  XLK: "기술", XLC: "커뮤니케이션", XLY: "임의소비재", XLF: "금융", XLI: "산업재", XLV: "헬스케어", XLE: "에너지", XLB: "소재", XLP: "필수소비재", XLU: "유틸리티", XLRE: "부동산", SPY: "S&P 500 ETF",
};
const YIELD = new Set(["^IRX", "^FVX", "^TNX", "^TYX"]);
const ROT_SETS = {
  sector: ["미국 섹터", ["XLK", "XLC", "XLY", "XLF", "XLI", "XLV", "XLE", "XLB", "XLP", "XLU", "XLRE", "SPY"]],
  global: ["글로벌 지수", ["^GSPC", "^IXIC", "^KS11", "^KQ11", "^N225", "^HSI", "000001.SS", "^STOXX50E", "^GDAXI", "^FTSE", "^BSESN", "^TWII"]],
  kr: ["한국 대형주", ["005930.KS", "000660.KS", "373220.KS", "207940.KS", "005380.KS", "000270.KS", "068270.KS", "035420.KS", "005490.KS", "105560.KS", "055550.KS", "035720.KS"]],
  asset: ["자산군", ["SPY", "QQQ", "EFA", "EEM", "TLT", "HYG", "GLD", "SLV", "USO", "DBC", "VNQ", "BITO"]],
};
const MARKETS = [["뉴욕", "America/New_York", [[570, 960]]], ["서울", "Asia/Seoul", [[540, 930]]], ["도쿄", "Asia/Tokyo", [[540, 690], [750, 930]]],
  ["홍콩", "Asia/Hong_Kong", [[570, 720], [780, 960]]], ["상하이", "Asia/Shanghai", [[570, 690], [780, 900]]], ["런던", "Europe/London", [[480, 990]]], ["프랑크푸르트", "Europe/Berlin", [[540, 1050]]]];

const css = `
#scr-markets .tbl td { padding:3px 5px; font-size:12px; }
#scr-markets .tbl th { padding:4px 5px; }
#scr-markets .tbl td.nm { text-align:left; max-width:150px; overflow:hidden; text-overflow:ellipsis; color:var(--text); }
#scr-markets .tbl td.nm small { color:var(--text-3); margin-left:5px; font-size:10.5px; }
#scr-markets .mhrs { display:flex; gap:16px; flex-wrap:wrap; padding:5px 10px; border:1px solid var(--border-med); background:var(--bg-surface); font-size:12px; }
#scr-markets .mhrs b { font-weight:700; }
#scr-markets .edit { display:flex; gap:4px; padding:6px 8px; border-bottom:1px solid var(--border-dim); background:var(--bg-raised); }
#scr-markets .rm { background:none; border:0; color:var(--neg); cursor:pointer; font:inherit; padding:0 2px; }
#scr-markets .hm-g { margin-bottom:8px; }
#scr-markets .hm-t { color:var(--text-2); font-size:11px; letter-spacing:1px; font-weight:700; margin:2px 0 3px; }
#scr-markets .hm { display:grid; grid-template-columns:repeat(auto-fill,minmax(118px,1fr)); gap:2px; }
#scr-markets .hm .tile { border:0; padding:7px 8px; min-height:60px; }
#scr-markets .hm .tile .s { color:#fff; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#scr-markets .hm .tile .p { color:#fff; font-size:14px; font-weight:700; }
#scr-markets .hm .tile .k { color:rgba(255,255,255,.6); font-size:10.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#scr-markets .heat td.v { color:#fff; }
#scr-markets .mk-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
@media (max-width:1450px) { #scr-markets .mk-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width:900px) { #scr-markets .mk-grid { grid-template-columns:1fr; } #scr-markets .rotg { grid-template-columns:1fr !important; } }
`;
if (!document.getElementById("markets-css")) { const s = document.createElement("style"); s.id = "markets-css"; s.textContent = css; document.head.appendChild(s); }

const esc = FE.esc;
const symOk = s => /^[A-Z0-9.\-^=]{1,20}$/.test(s);
const panels = () => FE.store.get("mkt.panels", null) || Object.fromEntries(DEF.map(d => [d[0], d[4]]));
const savePanels = p => FE.store.set("mkt.panels", p);
const isKR = s => /\.(KS|KQ)$/.test(s);
const fmtPx = (s, v) => v == null || v === 0 ? "—" : YIELD.has(s) ? FE.num(v, 3) + "%" : isKR(s) ? FE.int(v) : FE.price(v);
const fmtChg = (s, v) => v == null ? "—" : YIELD.has(s) ? FE.chg(v * 100, 1) + "bp" : isKR(s) ? FE.chg(v, 0) : FE.chg(v, Math.abs(v) < 1 ? 4 : 2);
const label = (s, r) => KO[s] || r?.name || s;
const DATA = {};   // panel id -> quotes
let root = null, tab = "panels", editing = new Set();

function mstat([nm, tz, sess]) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  const now = (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10), t = `${String(parseInt(p.hour, 10) % 24).padStart(2, "0")}:${p.minute}`;
  if (p.weekday === "Sat" || p.weekday === "Sun") return [nm, t, "휴장", "flat"];
  for (let i = 0; i < sess.length; i++) { if (now < sess[i][0]) return [nm, t, i ? "점심휴장" : "개장 전", "c-yellow"]; if (now < sess[i][1]) return [nm, t, "개장", "pos"]; }
  return [nm, t, "마감", "neg"];
}
const hoursLine = () => `<span class="c-dim">${FE.term("mhours", "거래소 상태")}</span>` + MARKETS.map(m => { const [n, t, s, c] = mstat(m); return `<span>${n} <span class="c-dim">${t}</span> <b class="${c}">${s}</b></span>`; }).join("") + `<span class="c-dim">크립토 <b class="pos">24/7</b></span>`;

/* ---------------- panels ---------------- */
function panelTable(id) {
  const rows = DATA[id];
  if (!rows) return `<div class="loading">불러오는 중…</div>`;
  const ed = editing.has(id);
  const cols = [
    { k: "symbol", l: "종목", a: "l", f: (s, r) => `${esc(label(s, r))}${r.stale ? `<span class="c-yellow" data-tip="최신 시세가 비어 있어 직전 거래일 종가 기준으로 표시해요."> *</span>` : ""}<small>${esc(s)}</small>`, c: () => "nm" },
    { k: "price", l: "현재가", f: (v, r) => fmtPx(r.symbol, v), c: () => "c-white", sort: true },
    { k: "change", l: "변동", f: (v, r) => fmtChg(r.symbol, v), c: v => FE.cls(v), sort: true },
    { k: "change_percent", l: "등락률", f: v => FE.pctRaw(v), c: v => FE.cls(v), sort: true },
    { k: "high", l: "고가", f: (v, r) => fmtPx(r.symbol, v), c: () => "c-muted" },
    { k: "low", l: "저가", f: (v, r) => fmtPx(r.symbol, v), c: () => "c-muted" },
    { k: "spark", l: "5일", a: "c", f: v => FE.sparkline(v, 56, 18) },
  ];
  if (ed) cols.push({ k: "_rm", l: "", a: "c", f: (v, r) => `<button class="rm" data-rm="${id}" data-s="${esc(r.symbol)}" title="삭제">✕</button>` });
  return (ed ? `<div class="edit"><input class="inp" data-addin="${id}" placeholder="티커 추가 (예: NVDA, 000270.KS)" style="flex:1"><button class="btn" data-add="${id}">추가</button><button class="btn muted" data-reset="${id}">기본값</button></div>` : "") +
    FE.table(cols, rows, { rowCls: () => "click", rowAttr: r => `data-sym="${esc(r.symbol)}"`, empty: "티커가 없습니다. '편집'에서 추가하세요." });
}
function drawPanel(id) {
  const b = root?.querySelector(`#mp-${id} .panel-b`); if (!b) return;
  b.innerHTML = panelTable(id);
  const rows = DATA[id]; if (rows) FE.sortable(b, rows, () => drawPanel(id));
  const s = root.querySelector(`#mp-${id} .panel-h .s`);
  if (s && rows) { const up = rows.filter(r => r.change_percent > 0).length, dn = rows.filter(r => r.change_percent < 0).length; s.innerHTML = `${DEF.find(d => d[0] === id)[2]} · <span class="pos">▲${up}</span> <span class="neg">▼${dn}</span>`; }
}
async function loadPanel(id) {
  const syms = panels()[id] || [];
  if (!syms.length) { DATA[id] = []; return drawPanel(id); }
  try {
    DATA[id] = (await FE.api("/api/markets/quotes?" + FE.qs({ symbols: syms.join(","), names: 1, spark: 1 }))).quotes;
    drawPanel(id);
  } catch (e) { const b = root?.querySelector(`#mp-${id} .panel-b`); if (b) FE.error(b, e); }
}
function renderPanels(out) {
  out.innerHTML = `<div class="grid mk-grid">${DEF.map(([id, t, sub, color]) => FE.panel({ id: "mp-" + id, title: t, sub, color, bar: true, flush: true,
    acts: `<button class="btn muted" data-edit="${id}" style="padding:1px 8px">${editing.has(id) ? "완료" : "편집"}</button>`, body: panelTable(id) })).join("")}</div>
    <div class="note">행을 클릭하면 종목 리서치가 열려요 · 열 제목(현재가·변동·등락률)을 누르면 정렬 · 원자재는 ${FE.term("futures", "근월물 선물")} 가격 · 채권 지수(^TNX 등)는 금리(%)이고 변동은 bp(0.01%p) 단위예요.</div>`;
  DEF.forEach(d => DATA[d[0]] && drawPanel(d[0]));
}
async function refreshPanels() { await Promise.all(DEF.map(d => loadPanel(d[0]))); }

/* ---------------- heatmap ---------------- */
async function renderHeat(out) {
  if (DEF.some(d => !DATA[d[0]])) { FE.loading(out, "전 세계 시세를 불러오는 중…"); await refreshPanels(); }
  if (tab !== "heatmap" || !root) return;
  const all = DEF.flatMap(d => DATA[d[0]] || []).filter(r => r.change_percent != null && !YIELD.has(r.symbol));
  const up = all.filter(r => r.change_percent > 0).length, dn = all.filter(r => r.change_percent < 0).length;
  const avg = all.reduce((a, r) => a + r.change_percent, 0) / (all.length || 1);
  const best = [...all].sort((a, b) => b.change_percent - a.change_percent);
  out.innerHTML = FE.stats([
    { l: "집계 종목", v: all.length, vcls: "c-white" }, { l: "상승", v: up, vcls: "pos" }, { l: "하락", v: dn, vcls: "neg" },
    { l: "평균 등락률", v: FE.pctRaw(avg), vcls: FE.cls(avg) },
    { l: "최고", v: FE.pctRaw(best[0]?.change_percent), d: esc(label(best[0]?.symbol || "", best[0])), vcls: "pos" },
    { l: "최저", v: FE.pctRaw(best.at(-1)?.change_percent), d: esc(label(best.at(-1)?.symbol || "", best.at(-1))), vcls: "neg" },
  ]) + FE.panel({ title: "글로벌 히트맵", sub: "GLOBAL HEATMAP · 당일 등락률", color: "orange", bar: true,
    acts: `<span class="legend"><span><i style="background:${FE.color.neg}"></i>−3% 이하</span><span><i style="background:#333"></i>0%</span><span><i style="background:${FE.color.pos}"></i>+3% 이상</span></span>`,
    body: DEF.map(([id, t]) => { const rows = (DATA[id] || []).filter(r => !YIELD.has(r.symbol)); if (!rows.length) return "";
      return `<div class="hm-g"><div class="hm-t">▌ ${t}</div><div class="hm">${rows.map(r => `<div class="tile" data-sym="${esc(r.symbol)}" style="${FE.heat(r.change_percent, 3) || "background:var(--bg-raised)"}" data-tip="${esc(label(r.symbol, r))} ${esc(r.symbol)} · ${FE.price(r.price)} · ${FE.pctRaw(r.change_percent)}"><div class="s">${esc(label(r.symbol, r))}</div><div class="p">${FE.pctRaw(r.change_percent)}</div><div class="k">${esc(r.symbol)} · ${fmtPx(r.symbol, r.price)}</div></div>`).join("")}</div></div>`; }).join("") }) +
    `<div class="note">${FE.term("heatmap", "히트맵")}은 '마켓 패널'에 등록한 티커로 만들어져요(채권 금리 지수 제외). 패널을 편집하면 히트맵도 바뀝니다.</div>`;
}

/* ---------------- rotation ---------------- */
const HZ = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y"];
async function renderRot(out, set) {
  set = ROT_SETS[set] ? set : "sector";
  out.innerHTML = `<div class="row">${FE.pills("rotset", Object.entries(ROT_SETS).map(([k, v]) => [k, v[0]]), set)}<span class="note">기간별 수익률을 서버에서 2년 일봉으로 계산 · 셀 색 = 같은 기간 안에서의 상대 크기</span></div><div id="rotOut"><div class="loading">2년치 가격을 불러와 수익률을 계산하는 중…</div></div>`;
  FE.onPills(out, "rotset", v => { FE.store.set("mkt.rotset", v); renderRot(out, v); });
  let d;
  try { d = await FE.api("/api/markets/returns?symbols=" + encodeURIComponent(ROT_SETS[set][1].join(","))); } catch (e) { return FE.error(out.querySelector("#rotOut"), e); }
  if (!root || tab !== "rotation") return;
  const rows = d.rows.filter(r => r.price != null);
  const mx = Object.fromEntries(HZ.map(h => [h, Math.max(0.005, ...rows.map(r => Math.abs(r[h] || 0)))]));
  const draw = () => {
    const o = out.querySelector("#rotOut");
    const lead = HZ.map(h => { const s = rows.filter(r => r[h] != null).sort((a, b) => b[h] - a[h]); return { h, top: s[0], bot: s.at(-1) }; });
    o.innerHTML = `<div class="grid rotg" style="grid-template-columns:minmax(0,2.2fr) minmax(0,1fr)">` + FE.panel({ title: "섹터 로테이션", sub: `${FE.term("rotation", "SECTOR ROTATION")} · ${ROT_SETS[set][0]}`, color: "green", bar: true, flush: true,
      body: FE.table([
        { k: "symbol", l: "종목", a: "l", f: (s, r) => `${esc(label(s, r))}<small>${esc(s)}</small>`, c: () => "nm" },
        { k: "price", l: "현재가", f: (v, r) => fmtPx(r.symbol, v), c: () => "c-white", sort: true },
        ...HZ.map(h => ({ k: h, l: h === "YTD" ? FE.term("ytd", "YTD") : h, a: "c", sort: true, f: v => `<span style="display:block;padding:2px 0;${FE.heat(v, mx[h])}">${FE.spct(v, 1)}</span>`, c: () => "v" })),
        { k: "spark", l: "3개월 추이", a: "c", f: v => FE.sparkline(v, 90, 20) },
      ], rows, { cls: "heat", rowCls: () => "click", rowAttr: r => `data-sym="${esc(r.symbol)}"` }) }) +
      FE.panel({ title: "기간별 선도·후행", sub: "LEADERS / LAGGARDS", color: "cyan", bar: true, flush: true,
        body: FE.table([{ k: "h", l: "기간", a: "l", c: () => "c-orange" },
          { k: "top", l: "선도", a: "l", f: (v, r) => v ? `<span class="c-white">${esc(label(v.symbol, v))}</span> <span class="pos">${FE.spct(v[r.h], 1)}</span>` : "—" },
          { k: "bot", l: "후행", a: "l", f: (v, r) => v ? `<span class="c-white">${esc(label(v.symbol, v))}</span> <span class="neg">${FE.spct(v[r.h], 1)}</span>` : "—" }],
          lead, {}) + `<div class="note" style="padding:6px 10px">최근(1D·1W)과 장기(6M·1Y) 선도 업종이 다르면 자금이 이동 중일 수 있어요. 학습용 데이터입니다.</div>` }) + `</div>`;
    FE.sortable(o.querySelector(".panel"), rows, draw);
  };
  draw();
}

/* ---------------- screen ---------------- */
function body() {
  const out = root.querySelector("#mOut"); if (!out) return;
  if (tab === "heatmap") renderHeat(out);
  else if (tab === "rotation") renderRot(out, FE.store.get("mkt.rotset", "sector"));
  else renderPanels(out);
}
let timer = null;
function setAuto() {
  if (timer) { clearInterval(timer); FE._timers.delete(timer); timer = null; }
  const on = FE.store.get("mkt.auto", true), sec = FE.store.get("mkt.iv", 60);
  if (on) timer = FE.every(sec * 1000, async () => { await refreshPanels(); if (tab === "heatmap") body(); stamp(); root?.querySelector("#mHrs") && (root.querySelector("#mHrs").innerHTML = hoursLine()); });
}
const stamp = () => { const t = root?.querySelector("#mUpd"); if (t) t.textContent = new Date().toTimeString().slice(0, 8); };

FE.screen({
  id: "markets", label: "마켓", primary: true, order: 2, fkey: "F2", group: "시장",
  desc: "지수·한국 시장·아시아·유럽·외환·원자재·채권·크립토·섹터 패널, 히트맵, 섹터 로테이션",
  render(el, arg) {
    root = el; editing = new Set();
    tab = ["panels", "heatmap", "rotation"].includes(arg) ? arg : "panels";
    const auto = FE.store.get("mkt.auto", true), iv = FE.store.get("mkt.iv", 60);
    el.innerHTML = FE.screenHead("MARKETS", "글로벌 시장 현황 · 패널 티커 편집 가능",
      `<label class="chk"><input type="checkbox" id="mAuto" ${auto ? "checked" : ""}> 자동 갱신</label>${FE.pills("miv", [[15, "15초"], [30, "30초"], [60, "1분"], [300, "5분"]], iv)}
       <span class="c-dim">업데이트 <span class="c-cyan" id="mUpd">—</span></span><button class="btn" id="mRef">↻ 새로고침</button><button class="btn muted" id="mResetAll" title="모든 패널을 기본 티커로">전체 초기화</button>`) +
      `<div class="mhrs" id="mHrs">${hoursLine()}</div>` +
      FE.subtabs("mtab", [["panels", "마켓 패널"], ["heatmap", "글로벌 히트맵"], ["rotation", "섹터 로테이션"]], tab) + `<div id="mOut"></div>`;
    FE.onSubtabs(el, "mtab", v => { tab = v; history.replaceState(null, "", "#markets/" + v); body(); });
    FE.onPills(el, "miv", v => { FE.store.set("mkt.iv", +v); setAuto(); FE.toast(`갱신 주기: ${+v >= 60 ? +v / 60 + "분" : v + "초"}`); });
    el.querySelector("#mAuto").onchange = e => { FE.store.set("mkt.auto", e.target.checked); setAuto(); };
    el.querySelector("#mRef").onclick = async () => { await refreshPanels(); stamp(); if (tab !== "panels") body(); };
    el.querySelector("#mResetAll").onclick = () => { if (!confirm("모든 패널을 기본 티커로 되돌릴까요?")) return; FE.store.set("mkt.panels", null); refreshPanels(); };
    el.addEventListener("click", e => {
      const ed = e.target.closest("[data-edit]");
      if (ed) { const id = ed.dataset.edit; editing.has(id) ? editing.delete(id) : editing.add(id); ed.textContent = editing.has(id) ? "완료" : "편집"; drawPanel(id); if (editing.has(id)) root.querySelector(`[data-addin="${id}"]`)?.focus(); return; }
      const rm = e.target.closest("[data-rm]");
      if (rm) { const p = panels(), id = rm.dataset.rm; p[id] = (p[id] || []).filter(s => s !== rm.dataset.s); savePanels(p); DATA[id] = (DATA[id] || []).filter(r => r.symbol !== rm.dataset.s); drawPanel(id); return; }
      const ad = e.target.closest("[data-add]"); if (ad) return addTicker(ad.dataset.add);
      const rs = e.target.closest("[data-reset]");
      if (rs) { const p = panels(), id = rs.dataset.reset; p[id] = DEF.find(d => d[0] === id)[4].slice(); savePanels(p); loadPanel(id); FE.toast("기본 티커로 되돌렸어요."); return; }
      if (e.target.closest("button, input, th")) return;
      const s = e.target.closest("[data-sym]"); if (s) FE.go("research", s.dataset.sym);
    });
    el.addEventListener("keydown", e => { const i = e.target.closest("[data-addin]"); if (i && e.key === "Enter") addTicker(i.dataset.addin); });
    body();
    refreshPanels().then(stamp);
    setAuto();
  },
  leave() { root = null; timer = null; },
});

function addTicker(id) {
  const i = root.querySelector(`[data-addin="${id}"]`); if (!i) return;
  const list = i.value.toUpperCase().split(/[\s,]+/).filter(Boolean);
  if (!list.length) return;
  const bad = list.filter(s => !symOk(s)); if (bad.length) return FE.toast("형식이 올바르지 않은 티커: " + bad.join(", "), true);
  const p = panels(); const cur = p[id] || [];
  const add = list.filter(s => !cur.includes(s));
  if (cur.length + add.length > 30) return FE.toast("패널당 최대 30개까지 넣을 수 있어요.", true);
  p[id] = cur.concat(add); savePanels(p); i.value = "";
  loadPanel(id).then(() => { const miss = (DATA[id] || []).filter(r => add.includes(r.symbol) && r.price == null).map(r => r.symbol); if (miss.length) FE.toast("시세를 찾지 못한 티커: " + miss.join(", "), true); else FE.toast(add.join(", ") + " 추가됨"); });
}
})();
