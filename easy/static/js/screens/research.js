/* RESEARCH — 종목 리서치 (Fincept Equity Research 화면)
   Deep links: #research/AAPL   #research/AAPL/financials   (tabs: overview financials technicals valuation peers analysts holders dividends news) */
(() => {
const esc = FE.esc;

FE.glossary({
  rec: ["투자의견 (컨센서스)", "애널리스트 의견을 1(적극 매수)~5(매도)로 평균낸 값. 낮을수록 긍정적이에요."],
  eps: ["EPS (주당순이익)", "순이익 ÷ 주식 수. 주식 1주가 1년 동안 번 이익."],
  bps: ["BPS (주당순자산)", "자본총계 ÷ 주식 수. 회사를 청산하면 1주당 돌아올 장부상 몫."],
  surprise: ["어닝 서프라이즈", "실제 발표된 EPS가 애널리스트 예상치보다 얼마나 높았는지(+) 낮았는지(−)."],
  ebitda: ["EBITDA", "이자·세금·감가상각 전 이익. 회사가 본업으로 벌어들이는 현금 창출력의 대략적인 크기."],
  capex: ["설비투자 (CAPEX)", "공장·장비 등 장기 자산을 사는 데 쓴 돈. 현금흐름표에서는 음수로 표시돼요."],
  wc: ["운전자본", "유동자산 − 유동부채. 일상 영업을 굴리는 데 묶여 있는 돈."],
  ocf: ["영업활동 현금흐름", "본업으로 실제 들어온 현금. 순이익보다 꾸며내기 어려워 더 믿을 만한 지표로 봐요."],
  willr: ["윌리엄스 %R", "최근 14일 고가 대비 현재가 위치(−100~0). −80 이하 과매도, −20 이상 과매수."],
  cci: ["CCI (상품채널지수)", "가격이 평균에서 얼마나 벗어났는지. +100 이상 과열, −100 이하 침체."],
  adx: ["ADX (평균방향지수)", "추세의 '세기'(방향 아님). 25 이상이면 추세가 뚜렷하고 20 미만이면 횡보. +DI>−DI면 상승 추세."],
  roc: ["ROC (변화율)", "N일 전 대비 가격 변화율. 0보다 크면 상승 모멘텀."],
  pctb: ["%B", "볼린저 밴드 안에서 현재가 위치. 0% = 하단 밴드, 100% = 상단 밴드."],
  techsum: ["기술적 요약", "여러 지표의 매수/매도 신호를 단순히 세어 본 결과(investing.com 방식). 지표끼리 겹치는 정보가 많아 참고용으로만 보세요."],
  dcf: ["DCF (현금흐름할인법)", "앞으로 벌어들일 잉여현금흐름을 오늘 가치로 할인해 더한 값으로 적정 주가를 추정하는 방법. 가정을 조금만 바꿔도 결과가 크게 변해요."],
  relval: ["상대가치평가", "비슷한 회사들의 PER·PBR 등 배수(중앙값)를 이 회사의 이익·자산에 곱해 '시장 기준 적정가'를 추정하는 방법."],
  peers: ["동종업체", "같은 업종에서 비교 대상으로 삼는 회사들. 배수가 경쟁사보다 높으면 프리미엄, 낮으면 할인돼 거래된다는 뜻이에요."],
  upgrade: ["투자의견 변경", "증권사가 등급(매수/중립/매도)이나 목표가를 올리거나(상향) 내린(하향) 기록."],
  insider: ["내부자 거래", "임원·대주주가 자기 회사 주식을 사고판 기록. 내부자 매수는 긍정적 신호로 보기도 해요."],
  inst: ["기관 투자자", "자산운용사·연기금·은행 등 큰 돈을 굴리는 기관. 보유 비중이 높으면 수급이 안정적인 편이에요."],
  exdiv: ["배당락일", "이 날 이후에 산 주식은 이번 배당을 받지 못해요. 배당락일 전날까지 보유해야 합니다."],
  split: ["주식 분할", "1주를 여러 주로 쪼개는 것. 가치는 그대로이고 1주 가격만 낮아져요."],
  shout: ["발행주식수", "회사가 발행한 전체 주식 수."],
  insiders: ["내부자 지분", "임원·대주주 등이 보유한 비율."],
  shortratio: ["공매도 상환일수", "공매도 물량을 평균 거래량으로 모두 되사는 데 걸리는 일수."],
  ma2060: ["MA20 · MA60", "20일·60일 이동평균선. 주가가 두 선 위에 있으면 단기·중기 상승 추세로 봐요."],
  growth_rev: ["매출 성장률", "최근 분기 매출이 1년 전 같은 분기보다 몇 % 늘었는지."],
  growth_earn: ["이익 성장률", "최근 분기 순이익이 1년 전 같은 분기보다 몇 % 늘었는지."],
  yoy: ["전년 대비 (YoY)", "작년 같은 기간과 비교한 증감률. 분기 데이터는 4분기 전과 비교해요."],
});

const TABS = [["overview", "개요"], ["financials", "재무제표"], ["technicals", "기술적 분석"], ["valuation", "밸류에이션"],
  ["peers", "동종업체"], ["analysts", "애널리스트"], ["holders", "주주"], ["dividends", "배당"], ["news", "뉴스"]];
const TAB_IDS = TABS.map(t => t[0]);
const LINE_COLORS = ["#0891b2", "#16a34a", "#dc2626", "#2563eb", "#9333ea", "#c026d3", "#14b8a6", "#64748b", "#e5e5e5", "#ca8a04"];
const CUR = { USD: "$", KRW: "₩", EUR: "€", JPY: "¥", GBP: "£", CNY: "¥", HKD: "HK$", TWD: "NT$", INR: "₹", CAD: "C$", AUD: "A$" };
const ST = { sym: "AAPL", tab: "overview", ov: null, period: FE.store.get("rs.period", "1y"), ctype: FE.store.get("rs.ctype", "candle"), fin: { st: "income", freq: "annual" } };

/* ---------- formatting ---------- */
const noDec = c => c === "KRW" || c === "JPY";
const px = (v, c) => v == null || isNaN(v) ? "—" : noDec(c) ? FE.int(v) : FE.price(v);
const pxs = (v, c) => v == null || isNaN(v) ? "—" : (CUR[c] ?? "") + px(v, c) + (CUR[c] || !c ? "" : " " + c);
const money = (v, c) => v == null || isNaN(v) ? "—" : c === "KRW" ? FE.krw(v) + "원" : (CUR[c] ?? "") + FE.big(v);
const mult = v => v == null || isNaN(v) ? "—" : FE.num(v, 2) + "x";
const sigBadge = s => s === "BUY" ? `<span class="badge fill-green">매수</span>` : s === "SELL" ? `<span class="badge fill-red">매도</span>` : `<span class="badge c-muted">중립</span>`;
const REC = { strong_buy: ["적극 매수", "green"], buy: ["매수", "green"], hold: ["보유", "orange"], underperform: ["비중 축소", "red"], sell: ["매도", "red"], strong_sell: ["적극 매도", "red"], none: ["의견 없음", "muted"] };

/* ---------- styles ---------- */
if (!document.getElementById("rs-style")) {
  const s = document.createElement("style"); s.id = "rs-style";
  s.textContent = `
  #scr-research .rs-ov { display:grid; grid-template-columns: 290px minmax(0,1fr) 290px; gap:8px; }
  #scr-research .rs-col { display:flex; flex-direction:column; gap:8px; min-width:0; }
  #scr-research .rs-bottom { display:grid; grid-template-columns: minmax(0,2fr) minmax(0,1fr); gap:8px; }
  #scr-research .rs-desc { line-height:1.6; color:var(--text); max-height:150px; overflow:auto; }
  #scr-research .rs-recbar { margin-top:8px; padding:5px; text-align:center; font-weight:700; letter-spacing:1px; border:1px solid var(--border-med); background:var(--bg-raised); }
  #scr-research .rs-pos { position:relative; height:6px; background:var(--border-med); margin:10px 0 4px; }
  #scr-research .rs-pos > i { position:absolute; top:-4px; width:3px; height:14px; background:var(--accent); }
  #scr-research .rs-pos > b { position:absolute; left:0; top:0; bottom:0; background:linear-gradient(90deg,var(--neg),var(--warn),var(--pos)); opacity:.55; width:100%; }
  #scr-research .rs-axis { display:flex; justify-content:space-between; font-size:11px; color:var(--text-3); }
  #scr-research .rs-qs { display:flex; gap:22px; align-items:baseline; flex-wrap:wrap; padding:9px 14px; background:var(--bg-surface); border:1px solid var(--border-med); }
  #scr-research .rs-qs .sym { color:var(--accent); font-weight:700; font-size:15px; }
  #scr-research .rs-qs .px { font-size:15px; font-weight:700; color:var(--text); }
  #scr-research .rs-qs .k { color:var(--text-2); }
  #scr-research .rs-qs .k b { color:var(--text); font-weight:700; margin-left:4px; }
  #scr-research .rs-symbox { position:relative; display:flex; gap:6px; align-items:center; }
  #scr-research .rs-sug { position:absolute; top:100%; left:0; width:360px; z-index:50; background:var(--bg-raised); border:1px solid var(--border-bright); display:none; }
  #scr-research .rs-sug div { padding:5px 9px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #scr-research .rs-sug div:hover, #scr-research .rs-sug div.sel { background:var(--bg-hover); }
  #scr-research .rs-sug b { color:var(--accent); margin-right:8px; } #scr-research .rs-sug i { color:var(--text-2); font-style:normal; } #scr-research .rs-sug span { color:var(--text-3); margin-left:6px; }
  #scr-research .rs-yoy { font-size:10.5px; line-height:1.1; }
  #scr-research .rs-fin td.l { color:var(--text-2); } #scr-research .rs-fin tr.key td { color:var(--text); font-weight:700; } #scr-research .rs-fin tr.key td.l { color:var(--accent); }
  #scr-research .rs-fin tr.ratio td { color:var(--cyan); }
  #scr-research .rs-gauge { display:flex; height:10px; margin:10px 0 2px; position:relative; }
  #scr-research .rs-gauge span { flex:1; } #scr-research .rs-gauge i { position:absolute; top:-5px; width:4px; height:20px; background:#fff; border:1px solid #000; }
  #scr-research .rs-verdict { font-size:22px; font-weight:700; text-align:center; letter-spacing:2px; margin-top:4px; }
  #scr-research .rs-cnt { display:flex; justify-content:space-around; margin-top:6px; font-size:12px; color:var(--text-2); }
  #scr-research .rs-cnt b { display:block; text-align:center; font-size:16px; }
  #scr-research .rs-news { padding:8px 0; border-bottom:1px solid var(--border-dim); }
  #scr-research .rs-news a { color:var(--text); font-weight:700; } #scr-research .rs-news a:hover { color:var(--accent); }
  #scr-research .rs-news .m { color:var(--text-3); font-size:12px; margin-top:2px; } #scr-research .rs-news .m b { color:var(--cyan); font-weight:400; }
  #scr-research .rs-news .d { color:var(--text-2); font-size:12px; margin-top:3px; }
  #scr-research .rs-tgt { position:relative; height:66px; margin:12px 6px 0; }
  #scr-research .rs-tgt .ln { position:absolute; left:0; right:0; top:20px; height:4px; background:var(--border-bright); }
  #scr-research .rs-tgt .mk { position:absolute; top:12px; width:2px; height:20px; }
  #scr-research .rs-tgt .lb { position:absolute; top:34px; font-size:11px; transform:translateX(-50%); white-space:nowrap; }
  #scr-research .rs-tgt .lt { position:absolute; top:-2px; font-size:11px; transform:translateX(-50%); white-space:nowrap; }
  #scr-research .rs-sens td { text-align:center; } #scr-research .rs-sens td.base { outline:1px solid var(--accent); }
  @media (max-width:1200px) { #scr-research .rs-ov { grid-template-columns: 1fr 1fr; } #scr-research .rs-ov .rs-mid { grid-column:1 / -1; order:-1; } #scr-research .rs-bottom { grid-template-columns:1fr; } }
  @media (max-width:720px) { #scr-research .rs-ov { grid-template-columns: 1fr; } }`;
  document.head.appendChild(s);
}

/* ---------- watchlist storage (shared format with watchlist.js / screener.js) ---------- */
const WL_KEY = "watchlists";
const WL_DEFAULT = () => ({ active: "기본", lists: [
  { name: "기본", symbols: ["AAPL", "MSFT", "NVDA", "005930.KS", "000660.KS"] },
  { name: "지수", symbols: ["^GSPC", "^IXIC", "^DJI", "^KS11", "^KQ11", "^N225", "^VIX"] }] });
function wlLoad() { const d = FE.store.get(WL_KEY, null); return d && Array.isArray(d.lists) && d.lists.length ? d : WL_DEFAULT(); }
function wlAdd(sym) {
  const d = wlLoad(); const l = d.lists.find(x => x.name === d.active) || d.lists[0];
  if (l.symbols.includes(sym)) return FE.toast(`${sym}은(는) 이미 '${l.name}' 목록에 있어요.`);
  l.symbols.push(sym); FE.store.set(WL_KEY, d); FE.toast(`${sym} → 관심종목 '${l.name}'에 추가했습니다.`);
}

/* ---------- symbol search suggestions ---------- */
function suggest(inp, onPick) {
  const box = document.createElement("div"); box.className = "rs-sug"; inp.after(box);
  let t, items = [], sel = -1;
  const show = list => { items = list; sel = -1; box.innerHTML = list.map((x, i) => `<div data-i="${i}"><b>${esc(x.symbol)}</b><i>${esc(x.name || "")}</i><span>${esc(x.exchange || "")}</span></div>`).join(""); box.style.display = list.length ? "block" : "none"; };
  inp.addEventListener("input", () => {
    clearTimeout(t); const q = inp.value.trim(); if (q.length < 1) return show([]);
    t = setTimeout(async () => { try { show(((await FE.api("/api/search?q=" + encodeURIComponent(q))).results || []).slice(0, 8)); } catch { show([]); } }, 250);
  });
  inp.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(-1, Math.min(items.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1))); [...box.children].forEach((d, i) => d.classList.toggle("sel", i === sel)); }
    if (e.key === "Enter") { const v = sel >= 0 ? items[sel].symbol : inp.value.trim(); show([]); if (v) onPick(v.toUpperCase()); }
    if (e.key === "Escape") show([]);
  });
  box.addEventListener("mousedown", e => { const d = e.target.closest("[data-i]"); if (d) { e.preventDefault(); show([]); onPick(items[+d.dataset.i].symbol); } });
  inp.addEventListener("blur", () => setTimeout(() => show([]), 150));
}

/* ---------- screen ---------- */
let ROOT = null;
const setHash = () => history.replaceState(null, "", "#research/" + ST.sym + (ST.tab !== "overview" ? "/" + ST.tab : ""));

FE.screen({
  id: "research", label: "종목 리서치", primary: true, order: 7, fkey: "F7", group: "리서치",
  desc: "개별 종목 개요·차트·재무제표·기술적 분석·밸류에이션·동종업체·애널리스트·주주·배당·뉴스",
  render(el, arg) {
    ROOT = el;
    const parts = (arg || "").split("/").filter(Boolean);
    let sym = parts[0] ? parts[0].toUpperCase() : FE.store.get("rs.sym", "AAPL");
    if (parts[0] && TAB_IDS.includes(parts[0].toLowerCase()) && !parts[1]) { ST.tab = parts[0].toLowerCase(); sym = FE.store.get("rs.sym", "AAPL"); }
    else ST.tab = parts[1] && TAB_IDS.includes(parts[1].toLowerCase()) ? parts[1].toLowerCase() : "overview";
    ST.sym = sym; ST.ov = null;
    FE.store.set("rs.sym", sym);
    el.innerHTML = FE.screenHead("EQUITY RESEARCH", `<span style="color:var(--text);font-weight:700;font-size:15px">${esc(sym)}</span> <span id="rsName"></span>`,
      `<div class="rs-symbox"><input class="inp" id="rsSym" placeholder="종목 코드·이름 검색 (예: AAPL, 삼성전자)" style="width:280px" autocomplete="off"></div>
       <button class="btn" id="rsGo">조회</button><button class="btn muted" id="rsWl" title="현재 활성 관심종목 목록에 추가">+ 관심종목</button>`) +
      `<div class="rs-qs" id="rsQ"><span class="sym">${esc(sym)}</span><span class="k">시세 불러오는 중…</span></div>` +
      FE.subtabs("rs", TABS, ST.tab) + `<div id="rsBody"></div>`;
    const inp = el.querySelector("#rsSym");
    const go = s => { s = (s || "").trim().toUpperCase(); if (s) FE.go("research", s + (ST.tab !== "overview" ? "/" + ST.tab : "")); };
    suggest(inp, go);
    el.querySelector("#rsGo").onclick = () => go(inp.value);
    el.querySelector("#rsWl").onclick = () => wlAdd(ST.sym);
    FE.onSubtabs(el, "rs", id => { ST.tab = id; setHash(); showTab(); });
    loadOverview().then(showTab);
  },
  leave() { ROOT?.querySelectorAll("[data-lw]").forEach(x => { try { x._lw?.remove(); x._ro?.disconnect(); } catch {} }); ROOT = null; },
});
FE.command("/stock", "종목 리서치 열기 (예: /stock AAPL)", a => FE.go("research", (a || "AAPL").toUpperCase()));
FE.command("/fa", "재무제표 (예: /fa 005930.KS)", a => FE.go("research", (a || ST.sym).toUpperCase() + "/financials"));

async function loadOverview() {
  const sym = ST.sym;
  try {
    const d = await FE.api("/api/research/overview?" + FE.qs({ symbol: sym }));
    if (sym !== ST.sym || !ROOT) return;
    ST.ov = d; drawStrip(d);
    FE.status(`${d.name} · ${d.exchange || ""} · ${d.currency}`);
  } catch (e) {
    if (!ROOT) return;
    ROOT.querySelector("#rsQ").innerHTML = `<span class="sym">${esc(sym)}</span><span class="neg">${esc(e.message)}</span>`;
    ST.ov = { error: e };
  }
}

function drawStrip(d) {
  const q = d.quote, c = d.currency;
  ROOT.querySelector("#rsName").textContent = d.name !== d.symbol ? d.name : "";
  ROOT.querySelector("#rsQ").innerHTML = `<span class="sym">${esc(d.symbol)}</span>
    <span class="px">${pxs(q.price, c)}</span>
    <span class="${FE.cls(q.change)}" style="font-weight:700">${FE.chg(q.change, noDec(c) ? 0 : 2)}</span>
    <span class="${FE.cls(q.change_percent)}" style="font-weight:700">${FE.arrow(q.change_percent)}${FE.pctRaw(q.change_percent)}</span>
    <span class="k">거래량:<b>${FE.big(q.volume)}</b></span>
    <span class="k">고가:<b class="pos">${px(q.high, c)}</b></span><span class="k">저가:<b class="neg">${px(q.low, c)}</b></span>
    <span class="k">${FE.term("mcap", "시가총액")}:<b>${money(d.valuation.market_cap, c)}</b></span>
    <span class="k">통화:<b>${esc(c || "—")}</b></span><span class="k">거래소:<b>${esc(d.exchange || "—")}</b></span>
    ${d.market_state ? `<span class="k" style="margin-left:auto">${{ REGULAR: "<b class='pos'>장중</b>", PRE: "<b>장 시작 전</b>", POST: "<b>장 마감 후</b>", CLOSED: "<b>장 마감</b>", POSTPOST: "<b>장 마감</b>", PREPRE: "<b>장 마감</b>" }[d.market_state] || ""}</span>` : ""}`;
}

function showTab() {
  if (!ROOT) return;
  const box = ROOT.querySelector("#rsBody");
  if (ST.ov?.error && ["overview", "valuation"].includes(ST.tab)) return FE.error(box, ST.ov.error);
  FE.loading(box);
  const fn = { overview: tabOverview, financials: tabFinancials, technicals: tabTechnicals, valuation: tabValuation, peers: tabPeers,
    analysts: tabAnalysts, holders: tabHolders, dividends: tabDividends, news: tabNews }[ST.tab];
  const tab = ST.tab, sym = ST.sym;
  Promise.resolve(fn(box)).catch(e => { if (ST.tab === tab && ST.sym === sym) FE.error(box, e); console.error(e); });
}
const stale = (tab, sym) => !ROOT || ST.tab !== tab || ST.sym !== sym;

/* =================================================================== OVERVIEW */
function tabOverview(box) {
  const d = ST.ov, c = d.currency, q = d.quote, v = d.valuation, s = d.shares, t = d.targets, r = d.range52, p = d.profit, g = d.growth, pr = d.profile, rk = d.risk;
  const rec = REC[t.rec_key] || null;
  const pos52 = r.high && r.low && r.price ? Math.max(0, Math.min(1, (r.price - r.low) / (r.high - r.low))) : null;
  box.innerHTML = `
  <div class="rs-ov">
    <div class="rs-col" id="rsColL">
      ${FE.panel({ title: "오늘의 거래", sub: "TODAY'S TRADING", body: FE.kv([
        ["시가", px(q.open, c)], ["고가", px(q.high, c), "pos"], ["저가", px(q.low, c), "neg"],
        ["전일 종가", px(q.prev_close, c), "w"], ["거래량", FE.big(q.volume)], ["평균 거래량", FE.big(q.avg_volume), "w"]]) })}
      ${FE.panel({ title: "밸류에이션", sub: "VALUATION", color: "cyan", body: FE.kv([
        [FE.term("mcap", "시가총액"), money(v.market_cap, c)], [FE.term("ev", "기업가치(EV)"), money(v.enterprise_value, c)],
        [FE.term("per", "PER"), mult(v.pe)], [FE.term("fper", "예상 PER"), mult(v.fpe)], [FE.term("peg", "PEG"), FE.num(v.peg)],
        [FE.term("pbr", "PBR"), mult(v.pb)], [FE.term("psr", "PSR"), mult(v.ps)], [FE.term("evebitda", "EV/EBITDA"), mult(v.ev_ebitda)],
        [FE.term("div", "배당수익률"), FE.pct(v.div_yield)], [FE.term("beta", "베타"), FE.num(v.beta), "w"]]) })}
      ${FE.panel({ title: "주식 정보", sub: "SHARE STATS", color: "purple", body: FE.kv([
        [FE.term("shout", "발행주식수"), FE.big(s.outstanding)], [FE.term("float", "유통주식"), FE.big(s.float)],
        [FE.term("insiders", "내부자 지분"), FE.pct(s.insiders)], [FE.term("inst", "기관 지분"), FE.pct(s.institutions)],
        [FE.term("short", "공매도 비율"), FE.pct(s.short_pct), "neg"], [FE.term("shortratio", "공매도 상환일수"), s.short_ratio != null ? FE.num(s.short_ratio, 1) + "일" : "—", "w"]]) })}
    </div>
    <div class="rs-mid">
      ${FE.panel({ title: "가격 차트", sub: `${FE.term("ma2060", "<span style='color:#0891b2'>MA20</span> · <span style='color:#9333ea'>MA60</span>")}`, cls: "rs-chartp", style: "height:100%",
        acts: `<span class="c-dim" style="font-size:12px">기간</span>${FE.pills("rsP", [["1mo", "1M"], ["3mo", "3M"], ["6mo", "6M"], ["1y", "1Y"], ["5y", "5Y"], ["max", "MAX"]], ST.period)}
               ${FE.pills("rsT", [["candle", "캔들"], ["area", "영역"]], ST.ctype)}`,
        body: `<div id="rsPc" data-lw style="height:520px"></div>` })}
    </div>
    <div class="rs-col">
      ${FE.panel({ title: "애널리스트 목표가", sub: "ANALYST TARGETS", color: "magenta", body: FE.kv([
        ["최고", pxs(t.high, c), "pos"], ["평균", pxs(t.mean, c), "w"], ["중앙값", pxs(t.median, c)], ["최저", pxs(t.low, c), "neg"],
        ["애널리스트 수", t.analysts != null ? FE.int(t.analysts) + "명" : "—"],
        ["평균 대비 여력", t.mean && q.price ? `<span class="${FE.cls(t.mean / q.price - 1)}">${FE.spct(t.mean / q.price - 1, 1)}</span>` : "—"]]) +
        `<div class="rs-recbar ${rec ? "c-" + rec[1] : "c-muted"}" ${t.rec_mean ? `data-tip="평균 점수 ${FE.num(t.rec_mean)} (1=적극 매수 … 5=매도)"` : ""}>${rec ? rec[0] : "의견 없음"}${t.rec_mean ? ` · ${FE.num(t.rec_mean)}` : ""}</div>` })}
      ${FE.panel({ title: "52주 범위", sub: "52 WEEK RANGE", body: FE.kv([["최고", pxs(r.high, c), "pos"], ["최저", pxs(r.low, c), "neg"],
          ["50일 평균", pxs(r.ma50, c), "w"], ["200일 평균", pxs(r.ma200, c), "w"]]) +
        (pos52 != null ? `<div class="rs-pos"><b></b><i style="left:calc(${(pos52 * 100).toFixed(1)}% - 1px)"></i></div><div class="rs-axis"><span>최저</span><span class="c-orange">현재 ${(pos52 * 100).toFixed(0)}% 위치</span><span>최고</span></div>` : "") })}
      ${FE.panel({ title: "수익성", sub: "PROFITABILITY", color: "green", body: FE.kv([
        [FE.term("gm", "매출총이익률"), FE.pct(p.gross)], [FE.term("om", "영업이익률"), FE.pct(p.operating)], [FE.term("npm", "순이익률"), FE.pct(p.net)],
        [FE.term("roa", "ROA"), FE.pct(p.roa)], [FE.term("roe", "ROE"), FE.pct(p.roe)]]) })}
      ${FE.panel({ title: "성장률", sub: "GROWTH RATES", color: "blue", body: FE.kv([
        [FE.term("growth_rev", "매출 성장률"), `<span class="${FE.cls(g.revenue)}">${FE.spct(g.revenue)}</span>`],
        [FE.term("growth_earn", "이익 성장률"), `<span class="${FE.cls(g.earnings)}">${FE.spct(g.earnings)}</span>`]]) })}
    </div>
  </div>
  ${rk ? FE.stats([
    { l: "1년 " + FE.term("total", "수익률"), v: FE.spct(rk.total_return, 1), vcls: FE.cls(rk.total_return) },
    { l: FE.term("vol", "변동성(연)"), v: FE.pct(rk.volatility, 1), vcls: "c-white" },
    { l: FE.term("sharpe", "샤프 지수"), v: FE.num(rk.sharpe), vcls: FE.cls(rk.sharpe) },
    { l: FE.term("mdd", "최대 낙폭"), v: FE.pct(rk.max_drawdown, 1), vcls: "neg" },
    { l: FE.term("beta", "베타") + ` <span class="c-dim">vs ${esc(d.benchmark)}</span>`, v: FE.num(rk.beta), vcls: "c-cyan", d: `상관계수 ${FE.num(rk.corr)}` },
    { l: FE.term("rsi", "RSI(14)"), v: FE.num(rk.rsi, 1), vcls: rk.rsi > 70 ? "neg" : rk.rsi < 30 ? "pos" : "c-white", d: rk.rsi > 70 ? "과매수" : rk.rsi < 30 ? "과매도" : "중립" },
    { l: FE.term("ma", "이동평균"), v: `<span class="${rk.above_ma20 ? "pos" : "neg"}">${rk.above_ma20 ? "▲" : "▼"}20</span> <span class="${rk.above_ma60 ? "pos" : "neg"}">${rk.above_ma60 ? "▲" : "▼"}60</span>`, vcls: "sm", d: "주가가 이평선 위(▲)/아래(▼)" },
  ]) : ""}
  <div class="rs-bottom">
    ${FE.panel({ title: "기업 개요", sub: "COMPANY OVERVIEW", color: "cyan", body: `<div class="rs-desc">${esc(pr.description || "설명 정보가 없습니다.")}</div><div class="note" style="margin-top:6px">원문(영문)은 Yahoo Finance 제공 자료입니다.</div>` })}
    ${FE.panel({ title: "기업 정보", sub: "COMPANY INFO", color: "white", body: FE.kv([
      ["섹터", esc(pr.sector || "—"), "w"], ["산업", esc(pr.industry || "—"), "w"], ["직원 수", pr.employees ? FE.int(pr.employees) + "명" : "—"],
      ["국가", esc([pr.city, pr.country].filter(Boolean).join(", ") || "—"), "w"],
      ["웹사이트", pr.website ? `<a href="${esc(pr.website)}" target="_blank" rel="noopener">${esc(pr.website.replace(/^https?:\/\//, ""))}</a>` : "—"],
      ["재무 통화", esc(d.financial_currency || c || "—"), "w"]]) })}
  </div>`;
  // match the chart height to the left column like the desktop layout
  const colL = box.querySelector("#rsColL"), pc = box.querySelector("#rsPc");
  if (innerWidth > 1200) pc.style.height = Math.max(380, colL.offsetHeight - 54) + "px";
  FE.onPills(box, "rsP", v => { ST.period = v; FE.store.set("rs.period", v); drawPriceChart(); });
  FE.onPills(box, "rsT", v => { ST.ctype = v; FE.store.set("rs.ctype", v); drawPriceChart(); });
  drawPriceChart();
}

async function drawPriceChart() {
  const sym = ST.sym, el = ROOT?.querySelector("#rsPc"); if (!el) return;
  try {
    const d = await FE.api("/api/research/chart?" + FE.qs({ symbol: sym, period: ST.period }));
    if (stale("overview", sym)) return;
    FE.priceChart(el, { candles: d.candles, type: ST.ctype, overlays: [{ name: "MA20", color: FE.color.cyan, data: d.ma20 }, { name: "MA60", color: FE.color.purple, data: d.ma60 }] });
    intPrices(el);
  } catch (e) { el.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

// KRW/JPY: no decimals on the price axis
function intPrices(el) {
  if (!noDec(ST.ov?.currency) || !el._lw) return;
  try { el._lw.applyOptions({ localization: { priceFormatter: v => Math.round(v).toLocaleString("en-US") } }); } catch {}
}

/* =================================================================== FINANCIALS */
const KEY_ROWS = new Set(["Total Revenue", "Operating Income", "Net Income", "Free Cash Flow", "Total Assets", "Total Liabilities Net Minority Interest", "Stockholders Equity", "Operating Cash Flow", "Diluted EPS"]);
const COUNT_ROWS = new Set(["Diluted Average Shares", "Ordinary Shares Number"]);

async function tabFinancials(box) {
  const sym = ST.sym, tab = "financials";
  box.innerHTML = `<div class="row" style="margin-bottom:8px">
      ${FE.pills("rsSt", [["income", "손익계산서"], ["balance", "재무상태표"], ["cashflow", "현금흐름표"]], ST.fin.st)}
      <span class="spacer"></span>${FE.pills("rsFq", [["annual", "연간"], ["quarterly", "분기"]], ST.fin.freq)}</div><div id="rsFin"></div>`;
  FE.onPills(box, "rsSt", v => { ST.fin.st = v; draw(); });
  FE.onPills(box, "rsFq", v => { ST.fin.freq = v; draw(); });
  async function draw() {
    const out = box.querySelector("#rsFin"); FE.loading(out, "재무제표를 불러오는 중…");
    let d; try { d = await FE.api("/api/research/financials?" + FE.qs({ symbol: sym, freq: ST.fin.freq })); } catch (e) { return FE.error(out, e); }
    if (stale(tab, sym)) return;
    const c = d.currency, st = d[ST.fin.st];
    if (!st.rows.length) { out.innerHTML = `<div class="empty">이 재무제표 데이터가 없습니다.</div>`; return; }
    const fmtv = (r, v) => v == null ? "—" : r.per_share ? FE.num(v, 2) : COUNT_ROWS.has(r.key) ? FE.big(v) : c === "KRW" ? FE.krw(v) : FE.big(v);
    const yoyLbl = ST.fin.freq === "annual" ? "전년 대비" : "전년 동기 대비";
    const head = `<tr><th class="l">${{ income: "손익계산서", balance: "재무상태표", cashflow: "현금흐름표" }[ST.fin.st]} <span class="c-dim">(${esc(c || "")}${c === "KRW" ? "" : ""})</span></th>${st.columns.map(x => `<th>${x}</th>`).join("")}</tr>`;
    const body = st.rows.map(r => `<tr class="${KEY_ROWS.has(r.key) ? "key" : ""}"><td class="l">${r.term ? FE.term(r.term, r.label) : r.label}</td>${r.values.map((v, i) =>
      `<td>${fmtv(r, v)}${r.yoy[i] != null ? `<div class="rs-yoy ${FE.cls(r.yoy[i])}">${FE.spct(r.yoy[i], 1)}</div>` : ""}</td>`).join("")}</tr>`).join("") +
      (st.ratios || []).map(r => `<tr class="ratio"><td class="l">${r.term ? FE.term(r.term, r.label) : r.label}</td>${r.values.map(v => `<td>${r.pct === false ? FE.num(v) + (v != null ? "배" : "") : FE.pct(v, 1)}</td>`).join("")}</tr>`).join("");
    const chartSpec = {
      income: { bars: [["Total Revenue", "매출액", FE.color.cyan], ["Operating Income", "영업이익", FE.color.accent], ["Net Income", "순이익", FE.color.pos]], line: "이익률", lines: (d.income.ratios || []).slice(0, 3) },
      balance: { bars: [["Total Assets", "자산", FE.color.cyan], ["Total Liabilities Net Minority Interest", "부채", FE.color.neg], ["Stockholders Equity", "자본", FE.color.pos]], line: "부채비율", lines: (st.ratios || []).filter(x => x.pct !== false) },
      cashflow: { bars: [["Operating Cash Flow", "영업CF", FE.color.cyan], ["Capital Expenditure", "CAPEX", FE.color.neg], ["Free Cash Flow", "FCF", FE.color.pos]], line: "FCF 마진", lines: [] },
    }[ST.fin.st];
    if (ST.fin.st === "cashflow") {
      const fcf = st.rows.find(r => r.key === "Free Cash Flow"), rev = d.income.rows.find(r => r.key === "Total Revenue");
      if (fcf && rev) chartSpec.lines = [{ label: "FCF 마진", values: fcf.values.map((v, i) => v != null && rev.values[i] ? v / rev.values[i] : null) }];
    }
    out.innerHTML = `<div class="grid cols-2" style="margin-bottom:8px">
        ${FE.panel({ title: "추이", sub: chartSpec.bars.map(b => b[1]).join(" · "), color: "cyan", body: `<div class="chart md"><canvas id="rsFc1"></canvas></div>` })}
        ${FE.panel({ title: chartSpec.line, sub: "비율 추이", color: "green", body: `<div class="chart md"><canvas id="rsFc2"></canvas></div>` })}
      </div>
      ${FE.panel({ title: "재무제표", sub: `${ST.fin.freq === "annual" ? "연간" : "분기"} · 단위 ${c === "KRW" ? "원(조/억)" : esc(c || "") + " (B=10억, M=백만)"} · 작은 글씨 = ${FE.term("yoy", yoyLbl)}`, flush: true,
        body: `<div class="tbl-wrap"><table class="tbl rs-fin"><thead>${head}</thead><tbody>${body}</tbody></table></div>` })}
      <div class="note" style="margin-top:6px">자료: Yahoo Finance(yfinance). 회사마다 계정 과목 구성이 달라 일부 항목은 비어 있을 수 있어요. 학습용 참고 자료입니다.</div>`;
    const labels = st.columns.slice().reverse();
    const rowVals = key => { const r = st.rows.find(x => x.key === key); return r ? r.values.slice().reverse() : null; };
    FE.chart("rsFc1", { type: "bar", data: { labels, datasets: chartSpec.bars.map(([k, l, col]) => ({ label: l, data: rowVals(k), backgroundColor: col })).filter(x => x.data) },
      options: FE.chartOpts({ legend: true, yFmt: v => c === "KRW" ? FE.krw(v) : FE.big(v, 0) }) });
    FE.chart("rsFc2", { type: "line", data: { labels, datasets: chartSpec.lines.map((r, i) => FE.line(r.label, r.values.slice().reverse(), FE.palette[i + (ST.fin.st === "balance" ? 3 : 0)], { pointRadius: 3 })) },
      options: FE.chartOpts({ legend: true, yFmt: v => (v * 100).toFixed(0) + "%" }) });
  }
  draw();
}

/* =================================================================== TECHNICALS */
async function tabTechnicals(box) {
  const sym = ST.sym, tab = "technicals";
  const d = await FE.api("/api/research/technicals?" + FE.qs({ symbol: sym }));
  if (stale(tab, sym)) return;
  const c = ST.ov?.currency;
  const gauge = (title, s) => {
    const pos = ((s.score + 1) / 2 * 100).toFixed(1);
    const col = s.score > .1 ? "pos" : s.score < -.1 ? "neg" : "c-white";
    return FE.panel({ title, color: "orange", body: `
      <div class="rs-verdict ${col}">${s.verdict}</div>
      <div class="rs-gauge"><span style="background:#7f1d1d"></span><span style="background:#dc2626"></span><span style="background:#404040"></span><span style="background:#16a34a"></span><span style="background:#14532d"></span><i style="left:calc(${pos}% - 2px)"></i></div>
      <div class="rs-axis"><span>적극 매도</span><span>매도</span><span>중립</span><span>매수</span><span>적극 매수</span></div>
      <div class="rs-cnt"><span><b class="pos">${s.buy}</b>매수</span><span><b class="c-white">${s.neutral}</b>중립</span><span><b class="neg">${s.sell}</b>매도</span></div>` });
  };
  const IND_TERM = { rsi: "rsi", macd: "macd", stoch: "stoch", willr: "willr", cci: "cci", adx: "adx", atr: "atr", bb: "pctb", obv: "obv", roc: "roc", ema: "ema", ma: "ma" };
  const fmtInd = x => x.value == null ? "—" : x.big ? FE.big(x.value) : x.key === "bb" ? FE.num(x.value, 1) + "%" : FE.num(x.value, 2);
  box.innerHTML = `
    <div class="grid cols-3">${gauge("기술 지표 요약", d.summary.indicators)}${gauge("이동평균 요약", d.summary.mas)}${gauge("종합 " + FE.term("techsum", "기술적 의견"), d.summary.overall)}</div>
    <div class="grid" style="grid-template-columns:minmax(0,3fr) minmax(0,2fr);margin-top:8px">
      ${FE.panel({ title: "가격 · 볼린저 밴드", sub: `${FE.term("bb", "BB(20,2)")} · <span style="color:#ca8a04">SMA50</span> · <span style="color:#c026d3">SMA200</span> · 최근 1년`, body: `<div id="rsTc" data-lw style="height:390px"></div>` })}
      <div class="rs-col">
        ${FE.panel({ title: "MACD", sub: "12, 26, 9", color: "cyan", acts: `<span class="legend"><span><i style="background:#0891b2"></i>MACD</span><span><i style="background:#d97706"></i>시그널</span></span>`, body: `<div class="chart sm"><canvas id="rsMacd"></canvas></div>` })}
        ${FE.panel({ title: "RSI (14)", sub: "70 과매수 · 30 과매도", color: "purple", body: `<div class="chart sm"><canvas id="rsRsi"></canvas></div>` })}
      </div>
    </div>
    <div class="grid" style="grid-template-columns:minmax(0,3fr) minmax(0,2fr);margin-top:8px">
      ${FE.panel({ title: "기술 지표", sub: `기준일 ${d.date} · 종가 ${pxs(d.price, c)}`, flush: true, body: FE.table([
        { k: "name", l: "지표", a: "l", f: (v, r) => `<span class="c-white">${IND_TERM[r.key] ? FE.term(IND_TERM[r.key], esc(v)) : esc(v)}</span>` },
        { k: "value", l: "값", f: (v, r) => `<b class="c-cyan">${fmtInd(r)}</b>${r.extra ? `<div class="rs-yoy c-dim">${esc(r.extra)}</div>` : ""}` },
        { k: "signal", l: "신호", a: "c", f: v => sigBadge(v) },
        { k: "text", l: "해석", a: "l", f: v => `<span class="c-muted">${esc(v)}</span>` }], d.indicators) })}
      ${FE.panel({ title: "이동평균", sub: "주가가 위 = 매수, 아래 = 매도", color: "yellow", flush: true, body: FE.table([
        { k: "name", l: "이동평균", a: "l", f: v => `<span class="c-white">${FE.term(v.startsWith("EMA") ? "ema" : "ma", v)}</span>` },
        { k: "value", l: "값", f: v => px(v, c) },
        { k: "gap", l: "괴리율", f: (v, r) => { const g = d.price / r.value - 1; return `<span class="${FE.cls(g)}">${FE.spct(g, 1)}</span>`; } },
        { k: "signal", l: "신호", a: "c", f: v => sigBadge(v) }], d.mas) })}
    </div>
    <div class="note" style="margin-top:6px">신호는 기계적인 규칙(예: RSI&lt;30 매수)으로 만든 참고용이며 투자 권유가 아닙니다. 지표 이름에 마우스를 올리면 설명이 나와요.</div>`;
  const s = d.series, T = s.dates;
  const ov = (arr, name, color, dash) => ({ name, color, dash, data: T.map((t, i) => ({ time: t, value: arr[i] })) });
  const tcEl = box.querySelector("#rsTc");
  FE.priceChart(tcEl, { candles: s.candles, type: "candle",
    overlays: [ov(s.bb_up, "BB상단", "#64748b", true), ov(s.bb_mid, "BB중심", "#64748b"), ov(s.bb_lo, "BB하단", "#64748b", true), ov(s.sma50, "SMA50", FE.color.warn), ov(s.sma200, "SMA200", FE.color.magenta)] });
  intPrices(tcEl);
  FE.chart("rsMacd", { type: "bar", data: { labels: T, datasets: [
    { type: "line", ...FE.line("MACD", s.macd, FE.color.cyan) }, { type: "line", ...FE.line("시그널", s.signal, FE.color.accent) },
    { label: "히스토그램", data: s.hist, backgroundColor: s.hist.map(v => v >= 0 ? "rgba(22,163,74,.6)" : "rgba(220,38,38,.6)") }] }, options: FE.chartOpts({ xTicks: 6 }) });
  FE.chart("rsRsi", { type: "line", data: { labels: T, datasets: [FE.line("RSI", s.rsi, FE.color.purple),
    FE.line("70", T.map(() => 70), FE.color.neg, { borderDash: [4, 4], borderWidth: 1 }), FE.line("30", T.map(() => 30), FE.color.pos, { borderDash: [4, 4], borderWidth: 1 })] },
    options: FE.chartOpts({ xTicks: 6, y: { min: 0, max: 100 } }) });
}

/* =================================================================== VALUATION */
async function tabValuation(box) {
  const sym = ST.sym, tab = "valuation";
  const pf = await FE.api("/api/research/dcf_prefill?" + FE.qs({ symbol: sym }));
  if (stale(tab, sym)) return;
  const c = pf.currency, pc = pf.price_currency, U = c === "KRW" ? 1e8 : 1e6, UL = c === "KRW" ? "억원" : "백만 " + (c || "");
  const fx = c && pc && c !== pc;
  const val = (v, k = 1) => v == null ? "" : +(v / k).toFixed(2);
  box.innerHTML = `
  <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
    ${FE.panel({ title: FE.term("dcf", "DCF 가치평가"), sub: "잉여현금흐름 할인 모형", bar: true, body: `
      <form class="form" id="rsDcf">
        ${FE.field(`기준 ${FE.term("fcf", "FCF")} (${UL})`, `<input class="inp" name="fcf" value="${val(pf.fcf, U)}">`)}
        ${FE.field("예측 기간 성장률 (%)", `<input class="inp" name="growth" value="${val(pf.growth * 100)}">`)}
        ${FE.field("예측 기간 (년)", `<input class="inp" name="years" value="${pf.years}">`)}
        ${FE.field(`${FE.term("wacc", "할인율 WACC")} (%)`, `<input class="inp" name="wacc" value="${val(pf.wacc * 100)}">`)}
        ${FE.field(`${FE.term("tg", "영구 성장률")} (%)`, `<input class="inp" name="tg" value="${val(pf.terminal_growth * 100)}">`)}
        ${FE.field(`${FE.term("netdebt", "순부채")} (${UL})`, `<input class="inp" name="nd" value="${val(pf.net_debt, U)}">`)}
        ${FE.field(`${FE.term("shout", "주식 수")} (백만 주)`, `<input class="inp" name="sh" value="${val(pf.shares, 1e6)}">`)}
        <button class="btn solid" type="submit">계산</button>
      </form>
      <div class="note" style="margin-top:8px">자동 입력: FCF·순부채·주식 수는 Yahoo 재무 데이터, 성장률은 최근 이익(또는 매출) 성장률을 −5~15%로 제한, WACC는 4% + 베타(${FE.num(pf.beta)}) × 5.5% 로 단순 추정했어요. 값을 바꿔 보며 결과가 얼마나 민감한지 확인해 보세요.
      ${fx ? `<br><b class="c-yellow">주의:</b> 재무 통화(${esc(c)})와 주가 통화(${esc(pc)})가 달라 주당 가치를 현재가와 바로 비교할 수 없어요.` : ""}</div>
      ${pf.fcf_hist?.length ? `<div class="note" style="margin-top:6px">과거 FCF: ${pf.fcf_hist.map(x => `${x.year} <b>${money(x.fcf, c)}</b>`).join(" · ")}</div>` : ""}
      <div id="rsDcfOut" style="margin-top:10px"></div>` })}
    ${FE.panel({ title: FE.term("relval", "상대가치평가"), sub: "동종업체 배수 중앙값 기준", bar: true, color: "cyan", bodyId: "rsRel", body: `<div class="loading">동종업체 배수를 불러오는 중…</div>` })}
  </div>`;
  const form = box.querySelector("#rsDcf");
  const run = async () => {
    const f = Object.fromEntries(new FormData(form)), out = box.querySelector("#rsDcfOut");
    try {
      const r = await FE.api("/api/research/dcf", { fcf: f.fcf * U, growth: f.growth / 100, years: f.years, wacc: f.wacc / 100, terminal_growth: f.tg / 100, net_debt: f.nd * U, shares: f.sh * 1e6, price: fx ? null : pf.price });
      if (stale(tab, sym)) return;
      const S = r.sensitivity;
      out.innerHTML = FE.stats([
        { l: "주당 적정가치", v: pxs(r.per_share, c), vcls: "c-orange" },
        { l: "현재가", v: pxs(pf.price, pc), vcls: "c-white" },
        { l: "상승 여력", v: r.upside != null ? FE.spct(r.upside, 1) : "—", vcls: FE.cls(r.upside) },
        { l: FE.term("ev", "기업가치"), v: money(r.enterprise_value, c), vcls: "sm c-cyan", d: `${FE.term("tv", "잔존가치")} 비중 ${FE.pct(r.tv_share, 0)}` }]) +
        `<div class="grid" style="margin-top:8px;grid-template-columns:minmax(0,1fr)">
          <div><div class="legend" style="margin-bottom:4px"><span><i style="background:#0891b2"></i>예상 FCF</span><span><i style="background:#d97706"></i>현재가치</span></div><div class="chart sm"><canvas id="rsDcfC"></canvas></div></div>
          <div><div class="note" style="margin-bottom:4px">민감도: 주당 가치 (행 = WACC, 열 = 영구 성장률)</div>
          <div class="tbl-wrap"><table class="tbl rs-sens"><thead><tr><th>WACC \\ g</th>${S.tg.map(t => `<th class="c">${FE.pct(t, 1)}</th>`).join("")}</tr></thead><tbody>
          ${S.values.map((row, i) => `<tr><th>${FE.pct(S.wacc[i], 1)}</th>${row.map((v, j) => { const up = !fx && v != null && pf.price ? v / pf.price - 1 : null;
            return `<td class="${i === 2 && j === 2 ? "base" : ""}" style="${up != null ? FE.heat(up, 1) : ""}">${v == null ? "—" : px(v, c)}</td>`; }).join("")}</tr>`).join("")}
          </tbody></table></div></div></div>`;
      FE.chart("rsDcfC", { type: "bar", data: { labels: [...r.flows.map(x => x.year + "년차"), "잔존가치"], datasets: [
        { label: "예상 FCF", data: [...r.flows.map(x => x.fcf), null], backgroundColor: FE.color.cyan },
        { label: "현재가치", data: [...r.flows.map(x => x.pv), r.pv_terminal], backgroundColor: FE.color.accent }] },
        options: FE.chartOpts({ yFmt: v => c === "KRW" ? FE.krw(v) : FE.big(v, 0) }) });
    } catch (e) { FE.error(out, e); }
  };
  form.addEventListener("submit", e => { e.preventDefault(); run(); });
  if (pf.fcf != null && pf.shares) run(); else box.querySelector("#rsDcfOut").innerHTML = `<div class="empty">FCF 또는 주식 수 데이터가 없어 직접 입력해야 해요.</div>`;
  // relative valuation
  const rel = box.querySelector("#rsRel");
  try {
    const peers = FE.store.get("rs.peers." + sym, null);
    const r = await FE.api("/api/research/relative?" + FE.qs({ symbol: sym, peers: peers ? peers.join(",") : "" }));
    if (stale(tab, sym)) return;
    const MT = { pe: "per", pb: "pbr", ps: "psr", ev_ebitda: "evebitda" };
    rel.innerHTML = FE.table([
      { k: "label", l: "배수", a: "l", f: (v, x) => `<b class="c-white">${FE.term(MT[x.key], v)}</b>` },
      { k: "mine", l: "이 종목", f: v => mult(v) },
      { k: "peer_median", l: "동종 중앙값", f: v => `<span class="c-cyan">${mult(v)}</span>` },
      { k: "base", l: "기준값", f: (v, x) => `<span class="c-dim">${esc(x.base_label)}</span><br>${x.key === "ev_ebitda" ? money(v, r.currency) : px(v, r.currency)}` },
      { k: "implied", l: "적정가", f: v => `<b class="c-orange">${pxs(v, r.currency)}</b>` },
      { k: "upside", l: "여력", f: v => `<span class="${FE.cls(v)}">${FE.spct(v, 1)}</span>` }], r.methods, { empty: "배수를 계산할 데이터가 부족합니다." }) +
      `<div style="margin-top:10px">${FE.stats([{ l: "평균 적정가", v: pxs(r.average, r.currency), vcls: "c-orange" }, { l: "현재가", v: pxs(r.price, r.currency), vcls: "c-white" },
        { l: "평균 대비 여력", v: r.average && r.price ? FE.spct(r.average / r.price - 1, 1) : "—", vcls: FE.cls(r.average && r.price ? r.average / r.price - 1 : 0) }])}</div>
      <div class="note" style="margin-top:8px">비교 대상: ${r.peers.map(p => `<a href="#research/${esc(p)}">${esc(p)}</a>`).join(", ") || "—"} · 「동종업체」 탭에서 바꿀 수 있어요.
      적자·음수 배수는 중앙값 계산에서 제외했습니다.${r.mixed_currency ? " 배수는 통화와 무관하지만 국가별로 시장 평균 배수가 달라 해석에 주의하세요." : ""}<br>
      <b>학습용 추정치</b>이며 투자 권유가 아닙니다.</div>`;
  } catch (e) { FE.error(rel, e); }
}

/* =================================================================== PEERS */
async function tabPeers(box) {
  const sym = ST.sym, tab = "peers";
  const custom = FE.store.get("rs.peers." + sym, null);
  box.innerHTML = `<div class="row" style="margin-bottom:8px">
      <span class="c-muted">${FE.term("peers", "비교 종목")}</span>
      <input class="inp" id="rsPeerIn" style="flex:1;min-width:260px" placeholder="쉼표로 구분 (예: MSFT, GOOGL, 005930.KS)">
      <button class="btn solid" id="rsPeerApply">적용</button><button class="btn muted" id="rsPeerReset">기본값</button></div><div id="rsPeerOut"><div class="loading">동종업체 데이터를 불러오는 중… (종목 수만큼 시간이 걸려요)</div></div>`;
  const inp = box.querySelector("#rsPeerIn");
  box.querySelector("#rsPeerApply").onclick = () => {
    const list = inp.value.split(/[,\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean).filter(x => x !== sym);
    if (!list.length) return FE.toast("비교 종목을 1개 이상 입력하세요.", true);
    FE.store.set("rs.peers." + sym, list.slice(0, 12)); tabPeers(box);
  };
  box.querySelector("#rsPeerReset").onclick = () => { FE.store.set("rs.peers." + sym, null); tabPeers(box); };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") box.querySelector("#rsPeerApply").click(); });
  const d = await FE.api("/api/research/peers?" + FE.qs({ symbol: sym, peers: custom ? custom.join(",") : "" }));
  if (stale(tab, sym)) return;
  inp.value = d.peers.join(", ");
  const out = box.querySelector("#rsPeerOut");
  const rows = d.rows;
  const cols = [
    { k: "symbol", l: "종목", a: "l", sort: true, f: (v, r) => `<b class="${v === sym ? "c-orange" : "c-white"}">${esc(v)}</b> <span class="c-dim">${esc((r.name || "").slice(0, 22))}</span>` },
    { k: "price", l: "현재가", sort: true, f: (v, r) => pxs(v, r.currency) },
    { k: "change_pct", l: "등락", sort: true, f: v => `<span class="${FE.cls(v)}">${FE.pctRaw(v)}</span>` },
    { k: "mcap", l: FE.term("mcap", "시가총액"), sort: true, f: (v, r) => money(v, r.currency) },
    { k: "pe", l: FE.term("per", "PER"), sort: true, f: v => mult(v) },
    { k: "fpe", l: FE.term("fper", "예상PER"), sort: true, f: v => mult(v) },
    { k: "pb", l: FE.term("pbr", "PBR"), sort: true, f: v => mult(v) },
    { k: "ev_ebitda", l: FE.term("evebitda", "EV/EBITDA"), sort: true, f: v => mult(v) },
    { k: "roe", l: FE.term("roe", "ROE"), sort: true, f: v => `<span class="${FE.cls(v)}">${FE.pct(v, 1)}</span>` },
    { k: "margin", l: FE.term("npm", "순이익률"), sort: true, f: v => FE.pct(v, 1) },
    { k: "growth", l: FE.term("growth_rev", "매출성장"), sort: true, f: v => `<span class="${FE.cls(v)}">${FE.spct(v, 1)}</span>` },
    { k: "div_yield", l: FE.term("div", "배당"), sort: true, f: v => FE.pct(v) },
    { k: "ret1y", l: "1년 수익률", sort: true, f: v => `<b class="${FE.cls(v)}">${FE.spct(v, 1)}</b>` }];
  const avgRow = () => {
    const med = k => { const v = rows.filter(r => r.symbol !== sym).map(r => r[k]).filter(x => x != null && !isNaN(x)).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    return { symbol: "동종 중앙값", pe: med("pe"), fpe: med("fpe"), pb: med("pb"), ev_ebitda: med("ev_ebitda"), roe: med("roe"), margin: med("margin"), growth: med("growth"), div_yield: med("div_yield"), ret1y: med("ret1y") };
  };
  out.innerHTML = `${FE.panel({ title: "동종업체 비교", sub: `${rows.length}개 종목 · 열 제목 클릭 = 정렬 · 행 클릭 = 해당 종목 리서치`, flush: true, bodyId: "rsPeerTbl" })}
    <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr);margin-top:8px">
      ${FE.panel({ title: "1년 상대 성과", sub: "시작일 = 100", color: "cyan", body: `<div class="chart" style="height:340px"><canvas id="rsPeerC"></canvas></div>` })}
      ${FE.panel({ title: "PER vs ROE", sub: "오른쪽 아래일수록 '싸고 잘 버는' 회사", color: "green", body: `<div class="chart" style="height:340px"><canvas id="rsPeerS"></canvas></div>` })}
    </div>
    <div class="note" style="margin-top:6px">시가총액은 각 종목의 거래 통화 기준이에요. 기본 비교 종목은 잘 알려진 종목은 내장 목록, 그 외에는 같은 업종(한국 종목은 같은 섹터 시가총액 상위)에서 자동으로 골라요.</div>`;
  const tbl = out.querySelector("#rsPeerTbl");
  const draw = list => {
    tbl.innerHTML = FE.table(cols, [...list, avgRow()], { rowCls: r => r.symbol === sym ? "click sel" : r.price == null ? "" : "click", rowAttr: r => r.price != null ? `data-sym="${esc(r.symbol)}"` : "" });
    FE.sortable(tbl, rows, draw);
  };
  draw(rows);
  tbl.addEventListener("click", e => { const tr = e.target.closest("tr[data-sym]"); if (tr && tr.dataset.sym !== sym) FE.go("research", tr.dataset.sym + "/peers"); });
  const P = d.perf;
  FE.chart("rsPeerC", { type: "line", data: { labels: P.dates, datasets: Object.entries(P.series).map(([k, v], i) =>
    FE.line(k, v, k === sym ? FE.color.accent : LINE_COLORS[i % 10], { borderWidth: k === sym ? 2.6 : 1.3 })) }, options: FE.chartOpts({ legend: true }) });
  const pts = rows.filter(r => r.pe && r.roe != null && r.pe < 300);
  FE.chart("rsPeerS", { type: "scatter", data: { datasets: pts.map((r, i) => ({ label: r.symbol, data: [{ x: r.roe * 100, y: r.pe }], backgroundColor: r.symbol === sym ? FE.color.accent : LINE_COLORS[i % 10], pointRadius: r.symbol === sym ? 8 : 5 })) },
    options: { ...FE.chartOpts({ legend: true, mode: "nearest", xType: "linear", yFmt: v => v + "x", x: { title: { display: true, text: "ROE %", color: FE.color.text2 } } }),
      plugins: { ...FE.chartOpts({ legend: true }).plugins, tooltip: { ...FE.chartOpts().plugins.tooltip, callbacks: { label: c2 => `${c2.dataset.label}: ROE ${c2.parsed.x.toFixed(1)}% · PER ${c2.parsed.y.toFixed(1)}x` } } } } });
}

/* =================================================================== ANALYSTS */
const ACT = { up: ["상향", "pos"], down: ["하향", "neg"], main: ["유지", "c-muted"], init: ["신규", "c-cyan"], reit: ["재확인", "c-muted"] };
const PTA = { Raises: ["상향", "pos"], Lowers: ["하향", "neg"], Maintains: ["유지", "c-muted"], Announces: ["신규", "c-cyan"] };
const GRADE = { "Buy": "매수", "Strong Buy": "적극 매수", "Outperform": "시장수익률 상회", "Overweight": "비중 확대", "Hold": "보유", "Neutral": "중립", "Equal-Weight": "중립", "Market Perform": "시장수익률", "Sector Perform": "업종 평균",
  "Underperform": "시장수익률 하회", "Underweight": "비중 축소", "Sell": "매도", "Peer Perform": "업종 평균", "Positive": "긍정적", "Negative": "부정적", "Sector Weight": "업종 비중", "In-Line": "시장 평균", "Perform": "평균", "Accumulate": "매집", "Reduce": "축소" };
const PER_LBL = { "0m": "이번 달", "-1m": "1개월 전", "-2m": "2개월 전", "-3m": "3개월 전", "0q": "이번 분기", "+1q": "다음 분기", "0y": "올해", "+1y": "내년" };

async function tabAnalysts(box) {
  const sym = ST.sym, tab = "analysts";
  const d = await FE.api("/api/research/analysts?" + FE.qs({ symbol: sym }));
  if (stale(tab, sym)) return;
  const c = d.currency, T = d.targets || {}, rec = REC[d.rec_key];
  const lo = Math.min(T.low ?? Infinity, d.price ?? Infinity), hi = Math.max(T.high ?? -Infinity, d.price ?? -Infinity);
  const at = v => ((v - lo) / (hi - lo || 1) * 100).toFixed(1) + "%";
  const tx = v => { const p = (v - lo) / (hi - lo || 1); return p < .15 ? "none" : p > .85 ? "translateX(-100%)" : "translateX(-50%)"; };
  const tgtViz = T.low != null && T.high != null ? `<div class="rs-tgt"><div class="ln"></div>
    <div class="mk" style="left:${at(T.low)};background:var(--neg)"></div><div class="lb neg" style="left:${at(T.low)};transform:none">최저 ${px(T.low, c)}</div>
    <div class="mk" style="left:${at(T.high)};background:var(--pos)"></div><div class="lb pos" style="left:${at(T.high)};transform:translateX(-100%)">최고 ${px(T.high, c)}</div>
    <div class="mk" style="left:${at(T.mean)};background:var(--cyan)"></div><div class="lt c-cyan" style="left:${at(T.mean)};transform:${tx(T.mean)}">평균 ${px(T.mean, c)}</div>
    ${d.price ? `<div class="mk" style="left:${at(d.price)};background:#fff;width:3px"></div><div class="lb c-white" style="left:${at(d.price)};top:50px;transform:${tx(d.price)}">▲ 현재 ${px(d.price, c)}</div>` : ""}</div>` : "";
  const eh = d.earnings_history || [];
  box.innerHTML = `
  <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)">
    ${FE.panel({ title: FE.term("target", "목표주가"), sub: "12개월 컨센서스", color: "magenta", body:
      FE.kv([["최고", pxs(T.high, c), "pos"], ["평균", pxs(T.mean, c), "w"], ["중앙값", pxs(T.median, c)], ["최저", pxs(T.low, c), "neg"], ["현재가", pxs(d.price, c), "w"],
        ["평균 대비 여력", T.mean && d.price ? `<span class="${FE.cls(T.mean / d.price - 1)}">${FE.spct(T.mean / d.price - 1, 1)}</span>` : "—"]]) + tgtViz })}
    ${FE.panel({ title: FE.term("rec", "투자의견"), sub: `${d.analysts ? FE.int(d.analysts) + "명" : ""}`, color: "orange", body: `
      <div class="rs-verdict ${rec ? "c-" + rec[1] : "c-muted"}" style="margin:14px 0 6px">${rec ? rec[0] : "의견 없음"}</div>
      <div style="text-align:center" class="c-muted">평균 점수 <b class="c-white">${FE.num(d.rec_mean)}</b> / 5 (1 = 적극 매수, 5 = 매도)</div>
      ${d.rec_mean ? `<div class="rs-gauge" style="margin-top:14px"><span style="background:#14532d"></span><span style="background:#16a34a"></span><span style="background:#404040"></span><span style="background:#dc2626"></span><span style="background:#7f1d1d"></span><i style="left:calc(${((d.rec_mean - 1) / 4 * 100).toFixed(1)}% - 2px)"></i></div>
      <div class="rs-axis"><span>적극 매수</span><span>매수</span><span>보유</span><span>매도</span><span>적극 매도</span></div>` : ""}` })}
    ${FE.panel({ title: "의견 분포 추이", sub: "최근 4개월", color: "cyan", body: `<div class="chart" style="height:200px"><canvas id="rsRec"></canvas></div>` })}
  </div>
  <div class="grid cols-2" style="margin-top:8px">
    ${FE.panel({ title: FE.term("surprise", "EPS 실적 vs 예상"), sub: "최근 분기", color: "green", body: eh.length ? `<div class="chart" style="height:220px"><canvas id="rsEps"></canvas></div>` + FE.table([
        { k: "quarter", l: "분기", a: "l" }, { k: "epsEstimate", l: "예상 EPS", f: v => FE.num(v) }, { k: "epsActual", l: "실제 EPS", f: v => `<b class="c-white">${FE.num(v)}</b>` },
        { k: "surprisePercent", l: "서프라이즈", f: v => `<b class="${FE.cls(v)}">${FE.spct(v, 1)}</b>` }], eh.slice().reverse()) : `<div class="empty">EPS 이력 데이터가 없습니다.</div>` })}
    ${FE.panel({ title: "실적 추정치", sub: "애널리스트 평균", color: "blue", body:
      `<div class="note" style="margin-bottom:4px">EPS 추정</div>` + FE.table([
        { k: "period", l: "기간", a: "l", f: v => PER_LBL[v] || v }, { k: "avg", l: "평균", f: v => `<b class="c-white">${FE.num(v)}</b>` }, { k: "low", l: "최저", f: v => FE.num(v) }, { k: "high", l: "최고", f: v => FE.num(v) },
        { k: "yearAgoEps", l: "1년 전", f: v => FE.num(v) }, { k: "growth", l: "성장률", f: v => `<span class="${FE.cls(v)}">${FE.spct(v, 1)}</span>` }, { k: "numberOfAnalysts", l: "애널리스트", f: v => FE.int(v) }], d.earnings_estimate, { empty: "EPS 추정치가 없습니다." }) +
      `<div class="note" style="margin:10px 0 4px">매출 추정</div>` + FE.table([
        { k: "period", l: "기간", a: "l", f: v => PER_LBL[v] || v }, { k: "avg", l: "평균", f: v => `<b class="c-white">${money(v, c)}</b>` }, { k: "low", l: "최저", f: v => money(v, c) }, { k: "high", l: "최고", f: v => money(v, c) },
        { k: "growth", l: "성장률", f: v => `<span class="${FE.cls(v)}">${FE.spct(v, 1)}</span>` }, { k: "numberOfAnalysts", l: "애널리스트", f: v => FE.int(v) }], d.revenue_estimate, { empty: "매출 추정치가 없습니다." }) })}
  </div>
  ${FE.panel({ title: FE.term("upgrade", "최근 투자의견 변경"), sub: "증권사별 등급·목표가", color: "yellow", flush: true, style: "margin-top:8px", body: FE.table([
    { k: "date", l: "날짜", a: "l", f: v => `<span class="c-muted">${esc(v)}</span>` }, { k: "Firm", l: "증권사", a: "l", f: v => `<span class="c-white">${esc(v)}</span>` },
    { k: "Action", l: "구분", a: "c", f: v => { const a = ACT[v] || [v, ""]; return `<span class="${a[1]}">${esc(a[0])}</span>`; } },
    { k: "FromGrade", l: "이전 등급", a: "l", f: v => esc(GRADE[v] || v || "—") }, { k: "ToGrade", l: "새 등급", a: "l", f: v => `<b class="c-white">${esc(GRADE[v] || v || "—")}</b>` },
    { k: "priceTargetAction", l: "목표가", a: "c", f: v => { const a = PTA[v] || [v || "—", "c-dim"]; return `<span class="${a[1]}">${esc(a[0])}</span>`; } },
    { k: "priorPriceTarget", l: "이전 목표가", f: v => v ? px(v, c) : "—" }, { k: "currentPriceTarget", l: "새 목표가", f: (v, r) => v ? `<b class="${FE.cls(v - (r.priorPriceTarget || v))}">${px(v, c)}</b>` : "—" }],
    d.upgrades, { empty: "투자의견 변경 기록이 없습니다 (해외 증권사 커버리지가 적은 종목은 비어 있을 수 있어요).", maxH: "420px" }) })}`;
  const R = d.recommendations || [];
  if (R.length) FE.chart("rsRec", { type: "bar", data: { labels: R.map(r => PER_LBL[r.period] || r.period).reverse(), datasets: [
    ["strongBuy", "적극 매수", "#15803d"], ["buy", "매수", "#22c55e"], ["hold", "보유", "#ca8a04"], ["sell", "매도", "#ef4444"], ["strongSell", "적극 매도", "#991b1b"]].map(([k, l, col]) =>
    ({ label: l, data: R.map(r => r[k]).reverse(), backgroundColor: col })) }, options: FE.chartOpts({ legend: true, x: { stacked: true }, y: { stacked: true } }) });
  if (eh.length) FE.chart("rsEps", { type: "bar", data: { labels: eh.map(x => x.quarter), datasets: [
    { label: "예상 EPS", data: eh.map(x => x.epsEstimate), backgroundColor: "#404040" },
    { label: "실제 EPS", data: eh.map(x => x.epsActual), backgroundColor: eh.map(x => x.epsActual >= x.epsEstimate ? FE.color.pos : FE.color.neg) }] }, options: FE.chartOpts({ legend: true }) });
}

/* =================================================================== HOLDERS */
const INS_TX = [[/sale/i, "매도", "neg"], [/purchase|buy/i, "매수", "pos"], [/gift/i, "증여", "c-muted"], [/award|grant/i, "주식 보상", "c-cyan"], [/exercise|conversion/i, "옵션 행사", "c-yellow"], [/tax/i, "세금 납부용 처분", "c-muted"]];
async function tabHolders(box) {
  const sym = ST.sym, tab = "holders";
  const d = await FE.api("/api/research/holders?" + FE.qs({ symbol: sym }));
  if (stale(tab, sym)) return;
  const c = d.currency, M = d.major || {};
  const ins = M.insidersPercentHeld, inst = M.institutionsPercentHeld;
  const hcols = [{ k: "Holder", l: "보유자", a: "l", f: v => `<span class="c-white" data-tip="${esc(v)}">${esc(String(v || "").length > 38 ? String(v).slice(0, 37) + "…" : v)}</span>` }, { k: "pctHeld", l: "지분율", f: v => `<b class="c-cyan">${FE.pct(v)}</b>` },
    { k: "Shares", l: "보유 주식", f: v => FE.big(v) }, { k: "Value", l: "평가액", f: v => money(v, c) },
    { k: "pctChange", l: "변동", f: v => `<span class="${FE.cls(v)}">${FE.spct(v, 1)}</span>` }, { k: "Date Reported", l: "보고일", f: v => `<span class="c-muted">${esc(v)}</span>` }];
  box.innerHTML = `
  <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">
    ${FE.panel({ title: "주요 주주 구성", sub: "MAJOR HOLDERS", color: "purple", body: FE.kv([
      [FE.term("insiders", "내부자 지분"), FE.pct(ins)], [FE.term("inst", "기관 지분"), FE.pct(inst)], ["기관 지분 (유통주식 대비)", FE.pct(M.institutionsFloatPercentHeld)],
      ["보유 기관 수", M.institutionsCount ? FE.int(M.institutionsCount) + "곳" : "—"], [FE.term("shout", "발행주식수"), FE.big(d.shares_out)], [FE.term("float", "유통주식"), FE.big(d.float)]]) +
      (ins != null || inst != null ? `<div class="chart" style="height:200px;margin-top:8px"><canvas id="rsHold"></canvas></div>` : "") })}
    ${FE.panel({ title: FE.term("inst", "기관 투자자 상위"), sub: "INSTITUTIONAL HOLDERS", color: "cyan", flush: true, body: FE.table(hcols, d.institutional, { empty: "기관 보유 데이터가 없습니다." }) })}
  </div>
  <div class="grid cols-2" style="margin-top:8px">
    ${FE.panel({ title: "펀드 보유 상위", sub: "MUTUAL FUND HOLDERS", color: "blue", flush: true, body: FE.table(hcols, d.mutualfund, { empty: "펀드 보유 데이터가 없습니다." }) })}
    ${FE.panel({ title: FE.term("insider", "내부자 거래"), sub: "INSIDER TRANSACTIONS", color: "yellow", flush: true, body: FE.table([
      { k: "Start Date", l: "날짜", a: "l", f: v => `<span class="c-muted">${esc(v)}</span>` }, { k: "Insider", l: "내부자", a: "l", f: (v, r) => `<span class="c-white">${esc(v)}</span><div class="rs-yoy c-dim">${esc(r.Position || "")}</div>` },
      { k: "Text", l: "구분", a: "c", f: v => { const m = INS_TX.find(([re]) => re.test(v || "")); return m ? `<span class="${m[2]}" data-tip="${esc(v)}">${m[1]}</span>` : `<span class="c-dim" data-tip="가격 정보가 없는 거래 — 보통 주식 보상(RSU) 지급이나 옵션 행사예요.">보상·기타</span>`; } },
      { k: "Shares", l: "주식 수", f: v => FE.big(v) }, { k: "Value", l: "금액", f: v => v ? money(v, c) : "—" }], d.insider, { empty: "내부자 거래 데이터가 없습니다 (미국 외 종목은 대부분 제공되지 않아요).", maxH: "460px" }) })}
  </div>`;
  if (ins != null || inst != null) FE.chart("rsHold", { type: "doughnut", data: { labels: ["내부자", "기관", "기타(개인 등)"], datasets: [{ data: [ins || 0, inst || 0, Math.max(0, 1 - (ins || 0) - (inst || 0))].map(x => +(x * 100).toFixed(2)),
    backgroundColor: [FE.color.purple, FE.color.cyan, "#404040"], borderColor: FE.color.bg }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: "right", labels: { color: FE.color.text2, boxWidth: 10 } }, tooltip: { callbacks: { label: x => `${x.label}: ${x.parsed}%` } } } } });
}

/* =================================================================== DIVIDENDS */
async function tabDividends(box) {
  const sym = ST.sym, tab = "dividends";
  const d = await FE.api("/api/research/dividends?" + FE.qs({ symbol: sym }));
  if (stale(tab, sym)) return;
  const c = d.currency, A = d.annual || [];
  const cut = Date.now() - 365 * 864e5, recent = (d.history || []).filter(h => new Date(h.date) > cut);
  const ttm = d.trailing_rate ?? (recent.length ? recent.reduce((a, h) => a + h.amount, 0) : null);
  const dp = v => v == null ? "—" : (CUR[c] ?? "") + (noDec(c) ? FE.num(v, v < 10 ? 2 : 0) : FE.num(v, v < 1 ? 4 : 2));
  box.innerHTML = FE.stats([
    { l: FE.term("div", "배당수익률 (예상)"), v: FE.pct(d.yield), vcls: "c-orange" },
    { l: "연간 배당금 (최근 12개월)", v: dp(ttm), vcls: "c-white", d: d.price && ttm ? `현재가 대비 ${FE.pct(ttm / d.price)}` : "" },
    { l: FE.term("payout", "배당성향"), v: FE.pct(d.payout, 1), vcls: "c-cyan" },
    { l: "5년 평균 수익률", v: FE.pct(d.five_year_yield), vcls: "c-white" },
    { l: FE.term("exdiv", "최근 배당락일"), v: d.ex_date || "—", vcls: "sm c-white", d: d.last_value ? `최근 배당 ${dp(d.last_value)}` : "" }]) +
  (A.length ? `<div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr);margin-top:8px">
    ${FE.panel({ title: "연도별 배당금", sub: "막대 = 1주당 연간 배당 · 선 = 그해 평균 주가 대비 수익률 (올해는 진행 중)", color: "orange", body: `<div class="chart" style="height:320px"><canvas id="rsDiv"></canvas></div>` })}
    ${FE.panel({ title: "배당 지급 내역", sub: `${d.history.length}건`, color: "cyan", flush: true, body: FE.table([
      { k: "date", l: "지급 기준일", a: "l", f: v => `<span class="c-muted">${v}</span>` }, { k: "amount", l: "1주당 배당", f: v => `<b class="c-white">${dp(v)}</b>` }], d.history, { maxH: "330px" }) })}
  </div>
  <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr);margin-top:8px">
    ${FE.panel({ title: "연간 요약", color: "green", flush: true, body: FE.table([
      { k: "year", l: "연도", a: "l", f: (v, r) => v + (r.partial ? ' <span class="c-dim">(진행 중)</span>' : "") }, { k: "count", l: "지급 횟수" }, { k: "total", l: "연간 배당", f: v => `<b class="c-white">${dp(v)}</b>` },
      { k: "growth", l: "증감", f: (v, r) => r.partial ? "—" : `<span class="${FE.cls(v)}">${FE.spct(v, 1)}</span>` }, { k: "yield", l: "수익률", f: v => FE.pct(v) }], A.slice().reverse(), { maxH: "300px" }) })}
    ${FE.panel({ title: FE.term("split", "주식 분할"), color: "purple", flush: true, body: FE.table([{ k: "date", l: "날짜", a: "l" }, { k: "ratio", l: "비율", f: v => `<b class="c-white">${v >= 1 ? "1 → " + FE.num(v, v % 1 ? 2 : 0) : "병합 " + FE.num(1 / v, 0) + " → 1"}</b>` }], d.splits, { empty: "분할 기록이 없습니다." }) })}
  </div>` : `<div class="empty" style="margin-top:8px">배당 지급 기록이 없습니다. 배당을 하지 않는 성장주이거나 ETF·지수·암호화폐일 수 있어요.</div>`) +
  `<div class="note" style="margin-top:6px">과거 배당금은 이후 주식 분할을 반영해 조정된 값이에요.</div>`;
  if (A.length) FE.chart("rsDiv", { type: "bar", data: { labels: A.map(a => a.year + (a.partial ? "*" : "")), datasets: [
    { label: "연간 배당", data: A.map(a => a.total), backgroundColor: A.map(a => a.partial ? "rgba(217,119,6,.4)" : FE.color.accent), yAxisID: "y" },
    { type: "line", ...FE.line("수익률", A.map(a => a.yield != null ? a.yield * 100 : null), FE.color.cyan, { pointRadius: 2 }), yAxisID: "y2" }] },
    options: FE.chartOpts({ legend: true, scales: { y2: { position: "left", grid: { display: false }, ticks: { callback: v => v.toFixed(1) + "%" } } } }) });
}

/* =================================================================== NEWS */
const agoKo = ts => { const a = FE.ago(ts); if (!a) return ""; const n = parseInt(a), u = a.slice(-1); return n + ({ s: "초", m: "분", h: "시간", d: "일" }[u] || "") + " 전"; };
async function tabNews(box) {
  const sym = ST.sym, tab = "news";
  const d = await FE.api("/api/research/news?" + FE.qs({ symbol: sym }));
  if (stale(tab, sym)) return;
  const A = d.articles || [];
  box.innerHTML = FE.panel({ title: "종목 뉴스", sub: `${esc(sym)} · ${A.length}건 · 출처 ${esc(d.source)}`, color: "orange", bar: true, body: A.length ? A.map(a => `
    <div class="rs-news"><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a>
      <div class="m"><b>${esc(a.publisher || "")}</b> · ${esc(FE.date(a.published_date))} ${a.published_date ? `· ${agoKo(a.published_date)}` : ""}</div>
      ${a.description ? `<div class="d">${esc(a.description.slice(0, 260))}${a.description.length > 260 ? "…" : ""}</div>` : ""}</div>`).join("") :
    `<div class="empty">관련 뉴스가 없습니다.</div>` }) + `<div class="note" style="margin-top:6px">해외 기사는 원문(영어) 링크로 연결됩니다. 제목을 누르면 새 탭에서 열려요.</div>`;
}
})();
