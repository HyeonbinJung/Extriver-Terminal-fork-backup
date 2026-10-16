/* DASHBOARD — 대시보드 (F1): dense multi-widget market overview like the desktop Dashboard */
(() => {
FE.glossary({
  vix: ["VIX (공포지수)", "S&P 500 옵션 가격으로 계산한 향후 30일 예상 변동성. 15 미만 평온, 20~30 불안, 30 이상 공포 구간으로 봐요."],
  breadth: ["시장 폭 (Breadth)", "오른 종목 수와 내린 종목 수의 비교. 지수가 올라도 오른 종목이 적으면 '소수 대형주만 끄는 장'이라 힘이 약하다고 봐요."],
  spread: ["장단기 금리차", "10년물 금리 − 3개월물 금리. 마이너스(역전)이면 과거 경기 침체에 앞서 나타난 경우가 많아 침체 신호로 봐요."],
  sectoretf: ["섹터 ETF", "S&P 500 기업을 업종별로 묶은 상장지수펀드(XLK=기술, XLF=금융 …). 어느 업종에 돈이 몰리는지 볼 수 있어요."],
  dxy: ["달러 인덱스 (DXY)", "유로·엔·파운드 등 6개 주요 통화 대비 달러 가치. 오르면 달러 강세."],
  prevclose: ["전일 종가", "직전 거래일의 마지막 가격. 오늘 등락률의 기준이에요."],
  dayrange: ["당일 범위", "오늘 거래된 최저가 ~ 최고가."],
  movers: ["상승·하락 상위", "오늘 미국 시장에서 가장 많이 오르거나 내린 종목(Yahoo Finance 스크리너, 시총 20억 달러 이상)."],
  yield: ["국채 금리", "정부가 돈을 빌릴 때 내는 이자율. 10년물은 대출·주택담보 금리와 주식 밸류에이션의 기준이 돼요."],
  mhours: ["거래 시간", "각 거래소의 정규장 시간(현지 시각 기준). 공휴일은 반영하지 않아요."],
});

const IDX = [["^GSPC", "S&P 500"], ["^IXIC", "나스닥 종합"], ["^DJI", "다우존스"], ["^RUT", "러셀 2000"], ["^KS11", "코스피"], ["^KQ11", "코스닥"],
  ["^N225", "닛케이 225"], ["^HSI", "항셍"], ["000001.SS", "상하이 종합"], ["^BSESN", "센섹스"], ["^STOXX50E", "유로스톡스 50"], ["^GDAXI", "DAX"], ["^FTSE", "FTSE 100"], ["^FCHI", "CAC 40"]];
const FX = [["KRW=X", "USD/KRW"], ["EURUSD=X", "EUR/USD"], ["JPY=X", "USD/JPY"], ["GBPUSD=X", "GBP/USD"], ["CNY=X", "USD/CNY"], ["AUDUSD=X", "AUD/USD"], ["CHF=X", "USD/CHF"], ["CAD=X", "USD/CAD"], ["EURKRW=X", "EUR/KRW"], ["JPYKRW=X", "JPY/KRW"]];
const CMD = [["CL=F", "WTI 원유"], ["BZ=F", "브렌트유"], ["GC=F", "금"], ["SI=F", "은"], ["HG=F", "구리"], ["PL=F", "백금"], ["NG=F", "천연가스"], ["ZC=F", "옥수수"], ["ZW=F", "밀"]];
const BOND = [["^IRX", "미 3개월", "3M"], ["^FVX", "미 5년", "5Y"], ["^TNX", "미 10년", "10Y"], ["^TYX", "미 30년", "30Y"]];
const CRY = [["BTC-USD", "비트코인"], ["ETH-USD", "이더리움"], ["SOL-USD", "솔라나"], ["XRP-USD", "리플"], ["BNB-USD", "BNB"], ["DOGE-USD", "도지코인"]];
const SEC = [["XLK", "기술"], ["XLC", "통신"], ["XLY", "임의소비재"], ["XLF", "금융"], ["XLI", "산업재"], ["XLV", "헬스케어"], ["XLE", "에너지"], ["XLB", "소재"], ["XLP", "필수소비재"], ["XLU", "유틸리티"], ["XLRE", "부동산"], ["SPY", "S&P 500"]];
const STRIP = [["^GSPC", "S&P500"], ["^IXIC", "NASDAQ"], ["^KS11", "KOSPI"], ["^KQ11", "KOSDAQ"], ["^N225", "NIKKEI"], ["KRW=X", "USD/KRW"], ["GC=F", "GOLD"], ["^TNX", "US10Y"], ["BTC-USD", "BTC"], ["^VIX", "VIX"]];

const MARKETS = [ // [이름, tz, sessions [[openMin, closeMin]], 지수]
  ["뉴욕 NYSE·나스닥", "America/New_York", [[570, 960]]], ["한국 KRX", "Asia/Seoul", [[540, 930]]], ["도쿄 TSE", "Asia/Tokyo", [[540, 690], [750, 930]]],
  ["홍콩 HKEX", "Asia/Hong_Kong", [[570, 720], [780, 960]]], ["상하이 SSE", "Asia/Shanghai", [[570, 690], [780, 900]]], ["런던 LSE", "Europe/London", [[480, 990]]],
  ["프랑크푸르트 XETRA", "Europe/Berlin", [[540, 1050]]], ["크립토 (24/7)", "UTC", null]];

const WIDGETS = [ // id, title, english sub, color, column
  ["indices", "글로벌 지수", "GLOBAL INDICES", "orange", 0], ["quote", "QUOTE", "관심 종목", "orange", 0],
  ["fx", "외환 주요 통화쌍", "FOREX · MAJOR PAIRS", "cyan", 1], ["bonds", "채권 금리", "US TREASURY YIELDS", "blue", 1], ["news", "마켓 뉴스", "MARKET NEWS", "yellow", 1],
  ["cmd", "원자재", "COMMODITIES", "yellow", 2], ["crypto", "크립토", "CRYPTO TOP", "purple", 2], ["sectors", "섹터 성과", "US SECTORS", "green", 2],
  ["pulse", "시장 심리", "MARKET PULSE", "magenta", 3], ["movers", "상승·하락 상위", "TOP GAINERS / LOSERS", "green", 3], ["hours", "마켓 시간", "MARKET HOURS", "cyan", 3],
];

const css = `
#scr-dashboard { gap:6px; padding:6px; }
#scr-dashboard .dstrip { display:flex; border:1px solid var(--border-med); background:var(--bg-surface); overflow:hidden; }
#scr-dashboard .dstrip .it { flex:1 1 0; min-width:0; padding:4px 10px; border-right:1px solid var(--border-dim); cursor:pointer; white-space:nowrap; overflow:hidden; }
#scr-dashboard .dstrip .it:last-child { border-right:0; }
#scr-dashboard .dstrip .it:hover { background:var(--bg-hover); }
#scr-dashboard .dstrip .n { color:var(--text-2); font-size:11px; letter-spacing:.5px; }
#scr-dashboard .dstrip .p { font-weight:700; font-size:13px; }
#scr-dashboard .dstrip .c { font-size:11px; margin-left:4px; }
#scr-dashboard .dcols { display:grid; grid-template-columns:1.06fr 1fr 1fr 1.04fr; gap:6px; align-items:start; }
#scr-dashboard .dcol { display:flex; flex-direction:column; gap:6px; min-width:0; }
#scr-dashboard .panel-h { min-height:26px; padding:3px 8px; gap:8px; }
#scr-dashboard .panel-h .t { font-size:12px; letter-spacing:1px; }
#scr-dashboard .panel-h .s { font-size:10.5px; letter-spacing:.5px; }
#scr-dashboard .panel-b { padding:5px 8px; }
#scr-dashboard .panel-b.flush { padding:0; }
#scr-dashboard .tbl th { padding:3px 6px; font-size:10.5px; }
#scr-dashboard .tbl td { padding:2px 6px; font-size:12px; }
#scr-dashboard .tbl td.nm { text-align:left; color:var(--text); max-width:120px; overflow:hidden; text-overflow:ellipsis; }
#scr-dashboard .tbl td.nm small { color:var(--text-3); margin-left:4px; font-size:10px; }
#scr-dashboard .x { background:none; border:0; color:var(--text-3); cursor:pointer; font:inherit; padding:0 3px; }
#scr-dashboard .x:hover { color:var(--accent); }
#scr-dashboard .sec { display:grid; grid-template-columns:repeat(3,1fr); gap:2px; }
#scr-dashboard .sec .tile { padding:5px 6px; border:0; text-align:center; }
#scr-dashboard .sec .tile .s { font-size:11.5px; color:#fff; }
#scr-dashboard .sec .tile .p { font-size:12px; color:#fff; font-weight:700; }
#scr-dashboard .sec .tile .k { font-size:10px; color:rgba(255,255,255,.65); }
#scr-dashboard .ph { color:var(--text-2); font-size:10.5px; letter-spacing:1px; font-weight:700; margin:7px 0 3px; border-left:2px solid var(--accent); padding-left:6px; }
#scr-dashboard .ph:first-child { margin-top:0; }
#scr-dashboard .gauge { position:relative; height:8px; display:flex; gap:1px; margin:4px 0 2px; }
#scr-dashboard .gauge i { flex:1; }
#scr-dashboard .gauge b { position:absolute; top:-3px; width:3px; height:14px; background:#fff; transform:translateX(-1px); }
#scr-dashboard .brd { display:grid; grid-template-columns:92px 1fr 48px; gap:6px; align-items:center; font-size:11.5px; padding:2px 0; }
#scr-dashboard .brd .bar { height:6px; display:flex; background:var(--border-med); }
#scr-dashboard .brd .bar i { display:block; height:100%; }
#scr-dashboard .mv { display:grid; grid-template-columns:62px 1fr auto 62px; gap:6px; font-size:12px; padding:1px 0; cursor:pointer; white-space:nowrap; }
#scr-dashboard .mv:hover { background:var(--bg-hover); }
#scr-dashboard .mv .nm { color:var(--text-3); overflow:hidden; text-overflow:ellipsis; font-size:11px; }
#scr-dashboard .mv .vl { color:var(--text-3); text-align:right; font-size:11px; }
#scr-dashboard .nw { display:grid; grid-template-columns:40px 1fr; gap:6px; padding:4px 0; border-bottom:1px solid var(--border-dim); font-size:12px; }
#scr-dashboard .nw:last-child { border-bottom:0; }
#scr-dashboard .nw .tm { color:var(--accent); }
#scr-dashboard .nw a { color:var(--text); display:block; line-height:1.35; }
#scr-dashboard .nw a:hover { color:var(--accent); text-decoration:none; }
#scr-dashboard .nw .pb { color:var(--text-3); font-size:10.5px; }
#scr-dashboard .qbig { font-size:24px; font-weight:700; line-height:1.1; }
#scr-dashboard .qbox { display:grid; grid-template-columns:1fr 1fr; gap:0 14px; }
#scr-dashboard .hr { display:grid; grid-template-columns:1fr auto 60px; gap:6px; font-size:12px; padding:2px 0; }
#scr-dashboard .hr .lt { color:var(--text-3); font-size:11px; }
#scr-dashboard .wset { display:flex; flex-wrap:wrap; gap:4px 14px; }
#scr-dashboard .curve { display:flex; align-items:flex-end; gap:6px; height:50px; margin:6px 0 2px; }
#scr-dashboard .curve div { flex:1; text-align:center; font-size:10px; color:var(--text-2); }
#scr-dashboard .curve div i { display:block; background:var(--info); margin:1px 6px 2px; opacity:.85; }
@media (max-width:1300px) { #scr-dashboard .dcols { grid-template-columns:1fr 1fr; } #scr-dashboard .dstrip { flex-wrap:wrap; } #scr-dashboard .dstrip .it { flex:1 0 20%; } }
@media (max-width:720px) { #scr-dashboard .dcols { grid-template-columns:1fr; } #scr-dashboard .dstrip .it { flex:1 0 45%; } }
`;
if (!document.getElementById("dashboard-css")) { const s = document.createElement("style"); s.id = "dashboard-css"; s.textContent = css; document.head.appendChild(s); }

const esc = FE.esc;
const name = (list, sym) => (list.find(x => x[0] === sym) || [, sym])[1];
const qmap = rows => Object.fromEntries((rows || []).map(r => [r.symbol, r]));
const STALE = `<span class="c-yellow" data-tip="최신 시세가 비어 있어 직전 거래일 종가 기준으로 표시해요."> *</span>`;
const pxCell = q => q && q.price != null ? FE.price(q.price) : "—";

/* ---------- market hours (local exchange time via Intl) ---------- */
function marketStatus([nm, tz, sess]) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date()).map(p => [p.type, p.value]));
  const hh = parseInt(parts.hour, 10) % 24, mm = parseInt(parts.minute, 10), now = hh * 60 + mm;
  const local = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  if (!sess) return { nm, local, st: "개장", cls: "pos", left: "24시간" };
  const fmt = m => m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return { nm, local, st: "주말 휴장", cls: "flat", left: "" };
  for (let i = 0; i < sess.length; i++) {
    const [o, c] = sess[i];
    if (now < o) return i === 0 ? { nm, local, st: "개장 전", cls: "c-yellow", left: fmt(o - now) + " 후 개장" } : { nm, local, st: "점심 휴장", cls: "c-yellow", left: fmt(o - now) + " 후 재개" };
    if (now < c) return { nm, local, st: "개장", cls: "pos", left: fmt(c - now) + " 후 마감" };
  }
  return { nm, local, st: "장 마감", cls: "neg", left: "" };
}

/* ---------- widget renderers ---------- */
const quoteTable = (list, rows, o = {}) => {
  const m = qmap(rows);
  const data = list.map(([s, n, k]) => ({ s, n, ...(m[s] || {}) }));
  return FE.table([
    { k: "n", l: o.l || "종목", a: "l", f: (v, r) => `${esc(v)}${r.stale ? STALE : ""}${o.sym ? `<small>${esc(r.s.replace("=X", "").replace("-USD", ""))}</small>` : ""}`, c: () => "nm" },
    { k: "price", l: "현재가", f: v => FE.price(v), c: () => "c-white" },
    { k: "change", l: "변동", f: v => FE.chg(v, Math.abs(v) < 1 ? 4 : 2), c: v => FE.cls(v) },
    { k: "change_percent", l: "등락률", f: v => FE.pctRaw(v), c: v => FE.cls(v) },
  ], data, { rowCls: () => "click", rowAttr: r => `data-sym="${esc(r.s)}"` });
};

const R = {};
R.indices = async b => { b.innerHTML = quoteTable(IDX, (await FE.api("/api/markets/quotes?symbols=" + encodeURIComponent(IDX.map(x => x[0]).join(",")))).quotes, { l: "지수" }); };
R.fx = async b => { b.innerHTML = quoteTable(FX, (await FE.api("/api/markets/quotes?symbols=" + encodeURIComponent(FX.map(x => x[0]).join(",")))).quotes, { l: "통화쌍" }); };
R.cmd = async b => { b.innerHTML = quoteTable(CMD, (await FE.api("/api/markets/quotes?symbols=" + encodeURIComponent(CMD.map(x => x[0]).join(",")))).quotes, { l: "품목" }); };
R.crypto = async b => { b.innerHTML = quoteTable(CRY, (await FE.api("/api/markets/quotes?symbols=" + encodeURIComponent(CRY.map(x => x[0]).join(",")))).quotes, { l: "코인", sym: true }); };
R.bonds = async b => {
  const rows = (await FE.api("/api/markets/quotes?symbols=" + encodeURIComponent(BOND.map(x => x[0]).join(",")))).quotes, m = qmap(rows);
  const tbl = FE.table([
    { k: "n", l: "만기", a: "l", c: () => "nm" },
    { k: "price", l: "금리", f: v => v == null ? "—" : FE.num(v, 3) + "%", c: () => "c-white" },
    { k: "change", l: "변동(bp)", f: v => v == null ? "—" : FE.chg(v * 100, 1), c: v => FE.cls(v) },
    { k: "change_percent", l: "등락률", f: v => FE.pctRaw(v), c: v => FE.cls(v) },
  ], BOND.map(([s, n]) => ({ s, n, ...(m[s] || {}) })), { rowCls: () => "click", rowAttr: r => `data-sym="${esc(r.s)}"` });
  const ys = BOND.map(x => m[x[0]]?.price), ok = ys.filter(v => v != null), mx = Math.max(...ok, 0.01), mn = Math.min(...ok, mx) - 0.5;
  const curve = `<div class="curve">${BOND.map((x, i) => `<div><span class="c-white" style="font-size:10px">${ys[i] == null ? "—" : FE.num(ys[i], 2)}</span><i style="height:${ys[i] == null ? 0 : Math.max(2, (ys[i] - mn) / (mx - mn) * 22)}px"></i>${x[2]}</div>`).join("")}</div>`;
  const sp = ys[2] != null && ys[0] != null ? ys[2] - ys[0] : null;
  b.innerHTML = tbl + `<div style="padding:4px 8px 6px">${curve}${FE.kv([[FE.term("spread", "장단기 금리차 10Y−3M"), sp == null ? "—" : `${FE.chg(sp * 100, 0)}bp`, sp == null ? "" : sp < 0 ? "neg" : "pos"]])}
    <div class="note">${sp == null ? "" : sp < 0 ? "금리 역전 — 과거 경기 침체 전에 자주 나타난 신호예요." : "정상 곡선 — 장기 금리가 단기보다 높아요."}</div></div>`;
};
R.sectors = async b => {
  const rows = (await FE.api("/api/markets/quotes?symbols=" + SEC.map(x => x[0]).join(","))).quotes, m = qmap(rows);
  const mx = Math.max(1, ...rows.map(r => Math.abs(r.change_percent || 0)));
  b.innerHTML = `<div class="sec">${SEC.map(([s, n]) => { const q = m[s] || {}; return `<div class="tile" data-sym="${s}" style="${FE.heat(q.change_percent, mx) || "background:var(--bg-raised)"}"><div class="s">${n}</div><div class="p">${FE.pctRaw(q.change_percent)}</div><div class="k">${s}</div></div>`; }).join("")}</div>
    <div class="note" style="margin-top:4px">${FE.term("sectoretf", "섹터 ETF")} 당일 등락률 · 색이 진할수록 크게 움직임</div>`;
};
R.pulse = async b => {
  const d = await FE.api("/api/markets/pulse"), f = d.fng || {}, v = d.vix || {};
  const fcls = f.value == null ? "flat" : f.value < 25 ? "neg" : f.value < 45 ? "c-yellow" : f.value <= 55 ? "c-white" : f.value <= 75 ? "pos" : "c-green";
  const fko = { "Extreme Fear": "극단적 공포", Fear: "공포", Neutral: "중립", Greed: "탐욕", "Extreme Greed": "극단적 탐욕" }[f.label] || f.label || "—";
  const segs = ["#dc2626", "#ea580c", "#ca8a04", "#65a30d", "#16a34a"].map(c => `<i style="background:${c}"></i>`).join("");
  const sn = { "^VIX": "VIX", "^TNX": "미 10년물", "DX-Y.NYB": "달러 인덱스", "GC=F": "금", "CL=F": "WTI", "BTC-USD": "비트코인", "KRW=X": "USD/KRW" };
  b.innerHTML = `
    <div class="ph">${FE.term("fng", "공포·탐욕 지수")} <span class="c-dim">(크립토 · alternative.me)</span></div>
    <div class="row" style="gap:10px;align-items:baseline"><span class="qbig ${fcls}">${f.value ?? "—"}</span><span class="c-dim">/100</span><span class="spacer"></span><b class="${fcls}">${esc(fko)}</b></div>
    <div class="gauge">${segs}${f.value != null ? `<b style="left:${f.value}%"></b>` : ""}</div>
    <div class="row" style="justify-content:space-between;font-size:11px;color:var(--text-3)"><span>어제 ${f.yesterday ?? "—"}</span><span>1주 전 ${f.week_ago ?? "—"}</span><span>30일 평균 ${f.avg30 ?? "—"}</span>${FE.sparkline(f.history, 70, 14, FE.color.magenta)}</div>
    <div class="ph">${FE.term("vix", "VIX 변동성 지수")}</div>
    <div class="row" style="gap:8px;align-items:baseline"><span class="qbig ${v.value >= 20 ? "neg" : "pos"}" style="font-size:20px">${FE.num(v.value)}</span><span class="${FE.cls(v.change_percent)}">${FE.pctRaw(v.change_percent)}</span></div>
    <div class="note">${esc(v.text || "")}</div>
    <div class="ph">${FE.term("breadth", "시장 폭 (상승/하락 종목 수)")}</div>
    ${(d.breadth || []).map(g => { const t = g.total || 1; return `<div class="brd"><span class="c-muted">${esc(g.name)}</span><div class="bar"><i style="width:${g.advancers / t * 100}%;background:var(--pos)"></i><i style="width:${g.unchanged / t * 100}%;background:var(--text-3)"></i><i style="width:${g.decliners / t * 100}%;background:var(--neg)"></i></div><span style="text-align:right"><span class="pos">${g.advancers}</span>/<span class="neg">${g.decliners}</span></span></div>`; }).join("")}
    <div class="ph">글로벌 스냅샷</div>
    ${FE.table([{ k: "symbol", l: "", a: "l", f: s => esc(sn[s] || s), c: () => "nm" }, { k: "price", l: "", f: (p, r) => r.symbol === "^TNX" ? FE.num(p, 3) + "%" : FE.price(p), c: () => "c-cyan" }, { k: "change_percent", l: "", f: x => FE.pctRaw(x), c: x => FE.cls(x) }],
      d.snapshot || [], { rowCls: () => "click", rowAttr: r => `data-sym="${esc(r.symbol)}"` }).replace(/<thead>.*?<\/thead>/s, "")}`;
};
R.movers = async b => {
  const d = await FE.api("/api/markets/movers?n=6");
  const row = (r, up) => `<div class="mv" data-sym="${esc(r.symbol)}"><b>${esc(r.symbol)}</b><span class="nm">${esc(r.name || "")}</span><span class="${FE.cls(r.change_percent)}">${FE.arrow(r.change_percent)} ${FE.pctRaw(r.change_percent)}</span><span class="vl">VOL ${FE.big(r.volume, 1)}</span></div>`;
  b.innerHTML = `<div class="ph" style="border-color:var(--pos)">상승 상위 TOP GAINERS</div>${(d.gainers || []).map(r => row(r)).join("") || '<div class="empty">없음</div>'}
    <div class="ph" style="border-color:var(--neg)">하락 상위 TOP LOSERS</div>${(d.losers || []).map(r => row(r)).join("") || '<div class="empty">없음</div>'}
    <div class="ph" style="border-color:var(--cyan)">거래량 상위 MOST ACTIVE</div>${(d.actives || []).slice(0, 4).map(r => row(r)).join("")}
    <div class="note" style="margin-top:3px">${FE.term("movers", "기준")}: ${esc(d.source || "")}</div>`;
};
R.news = async b => {
  const d = await FE.api("/api/markets/news?n=10");
  const hm = t => { const x = new Date(t * 1000); return isNaN(x) ? "" : String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0"); };
  b.innerHTML = (d.items || []).map(n => `<div class="nw"><span class="tm">${hm(n.time)}</span><div><a href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a><span class="pb">${esc(n.publisher)} · ${FE.ago(n.time)} 전${n.tickers?.length ? " · " + n.tickers.slice(0, 3).map(t => `<span class="c-orange" data-sym="${esc(t)}" style="cursor:pointer">${esc(t)}</span>`).join(" ") : ""}</span></div></div>`).join("")
    || '<div class="empty">뉴스가 없습니다.</div>';
};
R.hours = async b => {
  b.innerHTML = MARKETS.map(m => { const s = marketStatus(m); return `<div class="hr"><span>${esc(s.nm)} <span class="lt">${s.local}</span></span><span class="lt">${esc(s.left)}</span><b class="${s.cls}" style="text-align:right">${s.st}</b></div>`; }).join("") +
    `<div class="note" style="margin-top:3px">${FE.term("mhours", "현지 시각 기준")} · 공휴일 미반영</div>`;
};
R.quote = async (b, panel) => {
  const sym = FE.store.get("dash.quote", "AAPL");
  const d = await FE.api("/api/markets/quote?symbol=" + encodeURIComponent(sym));
  panel.querySelector(".panel-h .s").textContent = d.name || sym;
  const P = d.currency === "KRW" ? FE.int : FE.price;
  const cur = d.currency ? ` <span class="c-dim" style="font-size:11px">${esc(d.currency)}</span>` : "";
  b.innerHTML = `<div class="row" style="align-items:baseline;gap:8px"><span class="qbig ${FE.cls(d.change_percent)}">${P(d.price)}</span>${cur}
      <span class="${FE.cls(d.change)}">${FE.arrow(d.change)}${(d.currency === "KRW" ? FE.chg(d.change, 0) : FE.chg(d.change))} (${FE.pctRaw(d.change_percent)})</span><span class="spacer"></span><b class="c-orange" data-sym="${esc(d.symbol)}" style="cursor:pointer">${esc(d.symbol)}</b></div>
    <div class="chart" style="height:96px;margin:4px 0"><canvas id="dashQChart"></canvas></div>
    <div class="qbox">${FE.kv([[FE.term("prevclose", "전일 종가"), P(d.previous_close), "w"], ["시가", P(d.open), "w"], [FE.term("dayrange", "당일 범위"), `${P(d.low)} ~ ${P(d.high)}`, "w"]])}
      ${FE.kv([["거래량", FE.big(d.volume, 1), "w"], [FE.term("w52", "52주 범위"), d.w52_low ? `${P(d.w52_low)} ~ ${P(d.w52_high)}` : "—", "w"], [FE.term("mcap", "시가총액"), d.currency === "KRW" ? FE.krw(d.market_cap) : FE.big(d.market_cap), "w"]])}</div>`;
  const pts = d.intraday || [];
  if (pts.length > 1) {
    const up = pts[pts.length - 1].c >= pts[0].c, col = up ? FE.color.pos : FE.color.neg;
    FE.chart("dashQChart", { type: "line", data: { labels: pts.map(p => { const x = new Date(p.t * 1000); return `${x.getMonth() + 1}/${x.getDate()} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; }),
      datasets: [FE.line(d.symbol, pts.map(p => p.c), col, { fill: true, backgroundColor: up ? "rgba(22,163,74,.12)" : "rgba(220,38,38,.12)", borderWidth: 1.4 })] },
      options: FE.chartOpts({ xTicks: 4, x: { display: false }, y: { ticks: { maxTicksLimit: 4, font: { size: 10 } } } }) });
  }
};

/* ---------- screen ---------- */
let root = null;
const hidden = () => new Set(FE.store.get("dash.hidden", []));

async function loadWidget(id) {
  const p = root?.querySelector(`#dw-${id}`); if (!p) return;
  const b = p.querySelector(".panel-b");
  if (!b.innerHTML.trim()) FE.loading(b, "불러오는 중…");
  try { await R[id](b, p); } catch (e) { FE.error(b, e); }
}
async function loadStrip() {
  const el = root?.querySelector("#dStrip"); if (!el) return;
  try {
    const m = qmap((await FE.api("/api/markets/quotes?symbols=" + encodeURIComponent(STRIP.map(x => x[0]).join(",")))).quotes);
    el.innerHTML = STRIP.map(([s, n]) => { const q = m[s] || {}; return `<div class="it" data-sym="${esc(s)}"><div class="n">${n}</div><span class="p ${FE.cls(q.change_percent)}">${s === "^TNX" ? FE.num(q.price, 3) + "%" : pxCell(q)}</span><span class="c ${FE.cls(q.change_percent)}">${FE.arrow(q.change_percent)}${FE.pctRaw(q.change_percent)}</span></div>`; }).join("");
  } catch (e) { el.innerHTML = `<div class="it neg">${esc(e.message)}</div>`; }
}
function refreshAll() {
  loadStrip();
  const h = hidden();
  WIDGETS.forEach(([id]) => !h.has(id) && loadWidget(id));
  const t = root?.querySelector("#dUpd"); if (t) t.textContent = new Date().toTimeString().slice(0, 8);
}
function layout() {
  const h = hidden(), cols = [[], [], [], []];
  WIDGETS.forEach(([id, t, sub, color, col]) => {
    if (h.has(id)) return;
    let acts = `<button class="x" data-ref="${id}" title="새로고침">↻</button><button class="x" data-hide="${id}" title="위젯 숨기기">✕</button>`;
    if (id === "quote") acts = `<input class="inp" id="dQSym" value="${esc(FE.store.get("dash.quote", "AAPL"))}" style="width:96px;padding:1px 6px;font-size:12px" title="종목 코드 입력 후 Enter">` + acts;
    cols[col].push(FE.panel({ id: "dw-" + id, title: t, sub, color, bar: true, acts, flush: ["indices", "fx", "cmd", "crypto", "bonds"].includes(id) }));
  });
  root.querySelector("#dCols").innerHTML = cols.map(c => `<div class="dcol">${c.join("")}</div>`).join("");
  root.querySelector("#dCnt").textContent = WIDGETS.length - h.size;
  const qi = root.querySelector("#dQSym");
  if (qi) qi.addEventListener("keydown", e => { if (e.key === "Enter") { const v = qi.value.trim().toUpperCase(); if (!/^[A-Z0-9.\-^=]{1,20}$/.test(v)) return FE.toast("종목 코드 형식이 올바르지 않습니다.", true); FE.store.set("dash.quote", v); qi.value = v; loadWidget("quote"); } });
}
function settingsHtml() {
  const h = hidden();
  return `<div class="wset">${WIDGETS.map(([id, t, sub]) => `<label class="chk"><input type="checkbox" data-w="${id}" ${h.has(id) ? "" : "checked"}> ${t} <span class="c-dim">${sub}</span></label>`).join("")}</div>
    <div class="row" style="margin-top:6px"><button class="btn muted" id="dAll">모두 표시</button><button class="btn muted" id="dClose">닫기</button><span class="note">설정은 이 브라우저에 저장돼요.</span></div>`;
}

FE.screen({
  id: "dashboard", label: "대시보드", primary: true, order: 1, fkey: "F1", group: "핵심",
  desc: "글로벌 지수·환율·원자재·채권·크립토·시장 심리·뉴스를 한 화면에",
  render(el, arg) {
    root = el;
    el.innerHTML = FE.screenHead("DASHBOARD", `<span class="live">LIVE</span> 실시간 시장 개요 · <span class="c-cyan" id="dCnt">0</span> WIDGETS · 60초 자동 갱신`,
      `<span class="c-dim">업데이트 <span class="c-cyan" id="dUpd">—</span></span><button class="btn muted" id="dSet">위젯 설정</button><button class="btn" id="dRef">↻ 새로고침</button>`) +
      `<div id="dSetBox" style="display:none">${FE.panel({ title: "위젯 설정", sub: "보일 위젯을 고르세요", color: "orange", body: "" })}</div>
       <div class="dstrip" id="dStrip"><div class="it c-dim">불러오는 중…</div></div>
       <div class="dcols" id="dCols"></div>`;
    layout();
    const box = el.querySelector("#dSetBox");
    const openSet = () => { box.querySelector(".panel-b").innerHTML = settingsHtml(); box.style.display = ""; };
    el.querySelector("#dSet").onclick = () => box.style.display === "none" ? openSet() : (box.style.display = "none");
    el.querySelector("#dRef").onclick = refreshAll;
    box.addEventListener("change", e => {
      const c = e.target.closest("[data-w]"); if (!c) return;
      const h = hidden(); c.checked ? h.delete(c.dataset.w) : h.add(c.dataset.w);
      FE.store.set("dash.hidden", [...h]); if (c.checked) { layout(); refreshAll(); } else { el.querySelector("#dw-" + c.dataset.w)?.remove(); el.querySelector("#dCnt").textContent = WIDGETS.length - h.size; }
    });
    box.addEventListener("click", e => {
      if (e.target.id === "dAll") { FE.store.set("dash.hidden", []); layout(); refreshAll(); openSet(); }
      if (e.target.id === "dClose") box.style.display = "none";
    });
    el.addEventListener("click", e => {
      const hb = e.target.closest("[data-hide]");
      if (hb) { const h = hidden(); h.add(hb.dataset.hide); FE.store.set("dash.hidden", [...h]); el.querySelector("#dw-" + hb.dataset.hide)?.remove(); el.querySelector("#dCnt").textContent = WIDGETS.length - h.size; if (box.style.display !== "none") openSet(); FE.toast("위젯을 숨겼어요. '위젯 설정'에서 다시 켤 수 있어요."); return; }
      const rb = e.target.closest("[data-ref]"); if (rb) return loadWidget(rb.dataset.ref);
      if (e.target.closest("a, input")) return;
      const s = e.target.closest("[data-sym]"); if (s) FE.go("research", s.dataset.sym);
    });
    if (arg === "settings") openSet();
    else if (arg && /^[A-Za-z0-9.\-^=]{1,20}$/.test(arg)) { FE.store.set("dash.quote", arg.toUpperCase()); const qi = el.querySelector("#dQSym"); if (qi) qi.value = arg.toUpperCase(); }
    refreshAll();
    FE.every(60000, refreshAll);
    FE.every(30000, () => loadWidget("hours"));
  },
  leave() { root = null; },
});
})();
