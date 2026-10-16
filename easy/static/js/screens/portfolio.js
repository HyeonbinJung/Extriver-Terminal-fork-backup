/* PORTFOLIO — 포트폴리오 (F4)
   여러 포트폴리오를 브라우저(FE.store)에 저장하고, BUY/SELL/DIV 거래내역으로 보유현황·성과·위험·최적화·상관관계를 계산.
   딥링크: #portfolio/overview | risk | optimize | correlation */
(() => {
"use strict";
const { esc } = FE;

FE.glossary({
  pf_nav: ["NAV (순자산가치)", "지금 보유한 모든 종목을 현재가로 평가한 금액의 합계. 거래내역을 날짜순으로 되돌려 매일의 NAV를 다시 계산했어요."],
  pf_twr: ["시간가중수익률 (TWR)", "중간에 돈을 더 넣거나 뺀 효과를 제거한 순수 '운용 수익률'. 펀드 성과 비교의 표준 방식이에요."],
  pf_cost: ["매입원가 (Cost basis)", "아직 보유 중인 주식을 사는 데 들어간 돈(수수료 포함). 외화 종목은 매수 당시 환율로 기준 통화로 바꿨어요."],
  pf_avg: ["평균 단가", "보유 주식의 평균 매수가 (현지 통화, 수수료 포함). 매도해도 평균 단가는 바뀌지 않아요(이동평균법)."],
  pf_unreal: ["평가손익 (미실현)", "아직 팔지 않은 주식의 현재 평가금액 − 매입원가. 팔기 전까지는 확정되지 않은 손익이에요."],
  pf_real: ["실현손익", "이미 매도해서 확정된 손익 (매도금액 − 매도한 수량의 매입원가 − 수수료)."],
  pf_weight: ["비중", "포트폴리오 전체 평가금액 중 이 종목이 차지하는 비율."],
  pf_conc: ["집중도", "가장 큰 종목의 비중. 한 종목 비중이 너무 크면 그 종목 하나에 운명이 좌우돼요."],
  pf_neff: ["유효 종목 수", "1 ÷ Σ(비중²). 비중이 고르면 실제 종목 수와 같고, 쏠릴수록 작아져요. '실질적으로 몇 종목에 분산했는가'."],
  pf_vol30: ["30일 변동성", "최근 21거래일 일간 수익률의 표준편차를 연율화한 값. 최근 위험 수준."],
  pf_risk: ["위험 점수", "연 변동성 × 200 (최대 100). 30이면 채권형, 50 전후 주식형, 70 이상이면 공격적인 포트폴리오로 볼 수 있어요. 학습용 단순 지표."],
  pf_day: ["오늘 손익", "어제 종가 대비 오늘(최근 종가) 보유 종목 평가금액 변화. 한국·미국 장 시간이 달라 기준 시점이 다를 수 있어요."],
  pf_fx: ["환율 환산", "한국 주식(KRW)과 미국 주식(USD)을 한 통화로 합산하려고 환율을 적용해요. 외화 종목의 손익에는 환율 변동 효과도 포함돼요."],
  pf_te: ["추적오차", "포트폴리오와 벤치마크 수익률 차이의 변동성. 클수록 시장과 다르게 움직여요."],
  pf_ir: ["정보비율", "벤치마크 대비 초과수익 ÷ 추적오차. 0.5 이상이면 양호."],
  pf_cap: ["상승·하락 포착률", "시장이 오른 날 시장 상승폭의 몇 %를 따라갔는지(상승), 내린 날 하락폭의 몇 %를 따라 내렸는지(하락). 상승은 높고 하락은 낮을수록 좋아요."],
  pf_r2: ["결정계수 (R²)", "수익률 변동 중 벤치마크로 설명되는 비율 (0~1). 높을수록 시장을 따라 움직여요."],
  pf_param: ["모수적 VaR", "수익률이 정규분포를 따른다고 가정해 평균과 표준편차로 계산한 VaR. 실제 폭락(꼬리 위험)은 과소평가하는 경향이 있어요."],
  pf_hist: ["역사적 VaR", "지난 1년 실제 일간 수익률을 줄 세워 하위 5%(1%) 지점을 그대로 쓴 VaR. 분포 가정이 없어요."],
  pf_stress: ["스트레스 테스트", "과거 위기 때 시장 지수가 떨어진 폭 × 각 종목의 베타로 지금 포트폴리오가 얼마나 잃을지 추정. 환율 급등(원화 약세) 효과도 반영해요."],
  pf_contrib: ["수익 기여도", "전체 손익 중 각 종목이 벌거나 잃은 몫. 비중 × 수익률로 '누가 포트폴리오를 끌어올렸나'를 봐요."],
  pf_rp: ["리스크 패리티", "각 종목이 포트폴리오 전체 위험에 기여하는 몫이 똑같도록 비중을 정하는 방식. 변동성이 큰 종목은 적게, 작은 종목은 많이 담아요."],
  pf_ms: ["최대 샤프 포트폴리오", "과거 데이터 기준으로 위험 대비 수익(샤프 지수)이 가장 높았던 비중 조합."],
  pf_mv: ["최소 변동성 포트폴리오", "과거 데이터 기준으로 출렁임이 가장 작았던 비중 조합."],
  pf_rc: ["위험 기여도", "포트폴리오 전체 변동성 중 각 종목이 차지하는 몫. 비중이 작아도 변동성이 크면 위험 기여도는 클 수 있어요."],
  pf_rebal: ["리밸런싱", "목표 비중에 맞추려고 일부를 팔고 다른 종목을 사는 것. 거래 비용과 세금도 고려해야 해요."],
  pf_dr: ["분산 비율", "개별 종목 변동성의 가중합 ÷ 포트폴리오 변동성. 1보다 클수록 분산 효과가 커요."],
  pf_roll: ["롤링 상관관계", "최근 N일 창을 하루씩 옮기며 계산한 상관계수. 위기 때는 상관관계가 1에 가까워지는 경향이 있어요."],
});

/* ------------------------------------------------------------------ CSS */
if (!document.getElementById("portfolio-css")) {
  const st = document.createElement("style"); st.id = "portfolio-css";
  st.textContent = `
  #scr-portfolio .pf-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--border-dim)}
  #scr-portfolio .pf-bar .subtabs{border-bottom:0;flex:1;min-width:0}
  #scr-portfolio .pf-bar .btn.trade{min-width:58px;padding:5px 12px}
  #scr-portfolio .pf-strip{display:grid;grid-template-columns:1.35fr 1fr 1fr 1.6fr;border:1px solid var(--border-med);background:var(--bg-surface)}
  #scr-portfolio .pf-strip>div{padding:9px 16px;border-right:1px solid var(--border-dim);min-width:0}
  #scr-portfolio .pf-strip>div:last-child{border-right:0}
  #scr-portfolio .pf-strip .l{color:var(--text-2);font-size:11.5px;letter-spacing:1.2px;white-space:nowrap}
  #scr-portfolio .pf-strip .big{font-size:26px;font-weight:700;color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #scr-portfolio .pf-strip .big small{font-size:20px;margin-left:12px}
  #scr-portfolio .pf-strip .mid{font-size:22px;font-weight:700;white-space:nowrap}
  #scr-portfolio .pf-strip .d{font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #scr-portfolio .pf-risk{display:grid;grid-template-columns:1fr 1fr;gap:0 22px;font-size:12px;margin-top:2px}
  #scr-portfolio .pf-risk .r{display:flex;justify-content:space-between;gap:8px}
  #scr-portfolio .pf-risk .r span:first-child{color:var(--text-2);letter-spacing:.5px}
  #scr-portfolio .pf-risk .r b{font-weight:700}
  #scr-portfolio .pf-main{display:grid;grid-template-columns:270px minmax(0,1fr) 400px;gap:8px}
  #scr-portfolio .pf-tiles{display:grid;grid-template-columns:1fr 1fr;gap:3px}
  #scr-portfolio .pf-tiles .tile{padding:9px 9px;border:1px solid #000;min-height:58px}
  #scr-portfolio .pf-tiles .tile .s{color:#fff}
  #scr-portfolio .pf-tiles .tile .p{color:#fff;font-weight:700}
  #scr-portfolio .pf-tiles .tile.sel{outline:2px solid var(--accent)}
  #scr-portfolio .pf-perfh{display:flex;gap:16px;flex-wrap:wrap;padding:2px 0 6px;font-size:12.5px;color:var(--text-2);border-bottom:1px solid var(--border-dim);margin-bottom:6px}
  #scr-portfolio .pf-perfh b{margin-left:6px}
  #scr-portfolio .pf-sec{display:grid;grid-template-columns:150px 1fr;gap:10px;align-items:center}
  #scr-portfolio .pf-sec .lg{font-size:12px;display:flex;flex-direction:column;gap:3px;min-width:0}
  #scr-portfolio .pf-sec .lg div{display:flex;gap:6px;align-items:center;white-space:nowrap}
  #scr-portfolio .pf-sec .lg i{width:9px;height:9px;flex:none}
  #scr-portfolio .pf-sec .lg span.n{overflow:hidden;text-overflow:ellipsis;flex:1}
  #scr-portfolio .pf-corr td,#scr-portfolio .pf-corr th{text-align:center;padding:3px 4px;font-size:11.5px}
  #scr-portfolio .pf-corr td.d{background:#d4d4d4;color:#000;font-weight:700}
  #scr-portfolio .pf-hm td{cursor:pointer}
  #scr-portfolio .pf-type{font-weight:700}
  #scr-portfolio .pf-x{background:none;border:1px solid var(--border-med);color:var(--text-3);cursor:pointer;font:inherit;padding:0 6px}
  #scr-portfolio .pf-x:hover{color:var(--neg);border-color:var(--neg)}
  #scr-portfolio .pf-mini{background:none;border:1px solid var(--border-med);font:inherit;font-size:11px;padding:0 5px;cursor:pointer}
  #scr-portfolio .pf-mini.b{color:var(--pos)} #scr-portfolio .pf-mini.s{color:var(--neg)}
  #scr-portfolio .pf-modal{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:80;display:flex;align-items:flex-start;justify-content:center;padding-top:8vh}
  #scr-portfolio .pf-dlg{width:min(560px,94vw);background:var(--bg-raised);border:1px solid var(--accent)}
  #scr-portfolio .pf-dlg .form{grid-template-columns:1fr 1fr}
  #scr-portfolio .pf-dlg .inp{width:100%}
  #scr-portfolio .pf-bars .r{display:grid;grid-template-columns:90px 1fr 70px;gap:8px;align-items:center;padding:2px 0;font-size:12px}
  #scr-portfolio .pf-bars .bk{height:10px;background:var(--border-dim);position:relative}
  #scr-portfolio .pf-bars .bk i{position:absolute;top:0;bottom:0}
  #scr-portfolio .pf-bars .bk .z{position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--text-3)}
  #scr-portfolio tr.pf-sc.sel td{background:var(--accent-bg)}
  @media (max-width:1300px){#scr-portfolio .pf-main{grid-template-columns:240px minmax(0,1fr)} #scr-portfolio .pf-main>.pf-right{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:8px}}
  @media (max-width:900px){#scr-portfolio .pf-main{grid-template-columns:1fr} #scr-portfolio .pf-strip{grid-template-columns:1fr 1fr} #scr-portfolio .pf-main>.pf-right{grid-template-columns:1fr}}
  `;
  document.head.appendChild(st);
}

/* ------------------------------------------------------------------ storage */
const KEY = "portfolio.v1";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const uid = () => Math.random().toString(36).slice(2, 10);
function demo() {
  const T = (date, symbol, type, qty, price, fee, note) => ({ id: uid(), date, symbol, type, qty, price, fee, note });
  return { id: "demo", name: "데모 포트폴리오", base: "USD", bench: "SPY", txns: [
    T("2023-01-20", "NVDA", "BUY", 40, 17.80, 1, "AI 반도체 (분할 조정가)"),
    T("2023-02-10", "005930.KS", "BUY", 50, 62800, 1000, "삼성전자"),
    T("2023-03-15", "AAPL", "BUY", 20, 152.99, 1, ""),
    T("2023-06-01", "MSFT", "BUY", 10, 332.58, 1, ""),
    T("2023-10-02", "JPM", "BUY", 15, 145.20, 1, "금융 분산"),
    T("2024-01-05", "000660.KS", "BUY", 10, 138000, 500, "SK하이닉스"),
    T("2024-02-01", "GOOGL", "BUY", 25, 141.16, 1, ""),
    T("2024-04-01", "XOM", "BUY", 20, 118.50, 1, "에너지 분산"),
    T("2024-06-20", "NVDA", "SELL", 10, 130.78, 1, "일부 차익 실현"),
    T("2024-08-15", "AAPL", "DIV", 20, 0.25, 0, "분기 배당"),
    T("2024-11-14", "MSFT", "DIV", 10, 0.83, 0, "분기 배당"),
    T("2025-01-10", "AAPL", "SELL", 5, 236.85, 1, "리밸런싱"),
  ] };
}
function load() {
  let s = FE.store.get(KEY, null);
  if (!s || !Array.isArray(s.list) || !s.list.length) { s = { active: "demo", list: [demo()] }; FE.store.set(KEY, s); }
  if (!s.list.find(p => p.id === s.active)) s.active = s.list[0].id;
  return s;
}
let S = load();
const save = () => FE.store.set(KEY, S);
const P = () => S.list.find(p => p.id === S.active) || S.list[0];
const payload = (p = P(), extra = {}) => ({
  transactions: p.txns.map(t => ({ date: t.date, symbol: t.symbol, type: t.type, qty: +t.qty, price: +t.price, fee: +(t.fee || 0) })),
  base: p.base, benchmark: p.bench, ...extra,
});

/* ------------------------------------------------------------------ format */
const isKRW = c => c === "KRW" || c === "JPY";
const money = (v, base = P().base) => v == null || isNaN(v) ? "—" : isKRW(base) ? FE.int(v) : FE.num(v, 2);
const smoney = (v, base) => v == null || isNaN(v) ? "—" : (v > 0 ? "+" : "") + money(v, base);
const lpx = (v, ccy) => v == null ? "—" : isKRW(ccy) ? FE.int(v) : FE.price(v);
const qtyf = v => v == null ? "—" : Math.abs(v - Math.round(v)) < 1e-9 ? FE.int(v) : FE.num(v, 4);
const sc = v => `<span class="${FE.cls(v)}">${FE.spct(v)}</span>`;
const TCOL = { BUY: "pos", SELL: "neg", DIV: "c-cyan" };
const TLAB = { BUY: "BUY 매수", SELL: "SELL 매도", DIV: "DIV 배당" };
const BENCHES = [["SPY", "SPY (S&P500)"], ["QQQ", "QQQ (나스닥100)"], ["^KS11", "코스피"], ["ACWI", "ACWI (전세계)"]];
const VIEWS = [["overview", "보유현황 OVERVIEW"], ["risk", "성과·위험 PERF/RISK"], ["optimize", "최적화 OPTIMIZE"], ["correlation", "상관관계 CORRELATION"]];

/* ------------------------------------------------------------------ state */
let root, view = "overview", data = null, dataKey = "", perfPer = "1Y", perfMode = "pct", tileMode = "PNL", posFilter = "";
const cache = {};
async function analyze(force) {
  const k = JSON.stringify(payload());
  if (!force && data && dataKey === k) return data;
  data = await FE.api("/api/portfolio/analyze", payload()); dataKey = k; return data;
}

FE.screen({
  id: "portfolio", label: "포트폴리오", primary: true, order: 4, fkey: "F4", group: "포트폴리오",
  desc: "거래내역 기반 포트폴리오 관리 · 성과 · 위험 · 최적화 · 상관관계",
  render(el, arg) {
    root = el; S = load();
    view = VIEWS.some(v => v[0] === arg) ? arg : "overview";
    shell();
  },
});
FE.command("/pf", "포트폴리오 화면 (예: /pf risk)", a => FE.go("portfolio", a || undefined));

function shell() {
  const p = P();
  root.innerHTML = FE.screenHead("PORTFOLIO", "거래내역으로 계산한 보유현황 · 성과 · 위험 · 최적화",
    `<select class="inp" id="pfSel" style="min-width:220px;font-weight:700">${S.list.map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? "selected" : ""}>${esc(x.name)} (${esc(x.base)})</option>`).join("")}</select>
     <button class="btn muted" id="pfNew" data-tip="새 포트폴리오 만들기">+ 새로</button>
     <button class="btn muted" id="pfRen">이름</button>
     <button class="btn muted" id="pfDel">삭제</button>
     <span class="c-dim">|</span>
     <label class="c-muted" style="font-size:12px">${FE.term("pf_fx", "기준 통화")}</label>
     <select class="inp" id="pfBase">${["USD", "KRW"].map(b => `<option ${b === p.base ? "selected" : ""}>${b}</option>`).join("")}</select>
     <button class="btn muted" id="pfRefresh" data-tip="시세 새로고침">⟳</button>`) +
    `<div class="pf-bar">
      <button class="btn buy trade" data-tx="BUY">BUY</button><button class="btn sell trade" data-tx="SELL">SELL</button><button class="btn info trade" data-tx="DIV">DIV</button>
      ${FE.subtabs("pfv", VIEWS, view)}
      <button class="btn muted" id="pfExpCsv">CSV 내보내기</button><button class="btn muted" id="pfExpJson">JSON</button>
      <button class="btn muted" id="pfImp">가져오기</button><input type="file" id="pfFile" accept=".csv,.json,text/csv,application/json" hidden>
    </div>
    <div id="pfBody"></div>`;
  const $ = s => root.querySelector(s);
  $("#pfSel").onchange = e => { S.active = e.target.value; save(); data = null; shell(); };
  $("#pfNew").onclick = () => {
    const name = prompt("새 포트폴리오 이름", "내 포트폴리오"); if (!name) return;
    const base = confirm("기준 통화를 KRW(원화)로 할까요?\n확인 = KRW, 취소 = USD") ? "KRW" : "USD";
    const np = { id: uid(), name: name.slice(0, 40), base, bench: base === "KRW" ? "^KS11" : "SPY", txns: [] };
    S.list.push(np); S.active = np.id; save(); data = null; shell();
  };
  $("#pfRen").onclick = () => { const n = prompt("포트폴리오 이름", P().name); if (n) { P().name = n.slice(0, 40); save(); shell(); } };
  $("#pfDel").onclick = () => {
    if (!confirm(`'${P().name}' 포트폴리오와 거래내역 ${P().txns.length}건을 삭제할까요?`)) return;
    S.list = S.list.filter(x => x.id !== S.active);
    if (!S.list.length) S.list = [demo()];
    S.active = S.list[0].id; save(); data = null; shell(); FE.toast("삭제했습니다.");
  };
  $("#pfBase").onchange = e => { P().base = e.target.value; save(); data = null; shell(); };
  $("#pfRefresh").onclick = () => { data = null; Object.keys(cache).forEach(k => delete cache[k]); body(true); };
  root.querySelectorAll("[data-tx]").forEach(b => b.onclick = () => txForm(b.dataset.tx));
  FE.onSubtabs(root, "pfv", v => { view = v; history.replaceState(null, "", "#portfolio/" + v); body(); });
  $("#pfExpCsv").onclick = exportCsv; $("#pfExpJson").onclick = exportJson;
  $("#pfImp").onclick = () => $("#pfFile").click();
  $("#pfFile").onchange = e => importFile(e.target.files[0]);
  body();
}

function body(force) {
  const el = root.querySelector("#pfBody");
  if (!P().txns.length) {
    el.innerHTML = FE.panel({ title: "시작하기", bar: true, body: `<div class="empty" style="padding:40px">
      이 포트폴리오에는 아직 거래가 없습니다.<br><br>
      <button class="btn buy" data-tx2="BUY">BUY 첫 매수 기록하기</button> &nbsp; 또는 상단 <b>가져오기</b>로 CSV/JSON 파일을 불러오세요.<br><br>
      <span class="note">CSV 형식: date,symbol,type,qty,price,fee,note (예: 2024-01-05,005930.KS,BUY,10,72000,0,메모)</span></div>` });
    el.querySelector("[data-tx2]").onclick = () => txForm("BUY");
    return;
  }
  ({ overview, risk: riskView, optimize: optView, correlation: corrView })[view](el, force);
}

/* ================================================================== OVERVIEW */
async function overview(el, force) {
  FE.loading(el, "보유 종목 시세와 환율을 불러와 거래내역을 다시 계산하는 중…");
  let d;
  try { d = await analyze(force); } catch (e) { return FE.error(el, e); }
  if (view !== "overview") return;
  const p = P(), s = d.summary, rk = d.risk, B = d.base;
  const riskScore = rk.vol != null ? Math.min(100, Math.round(rk.vol * 200)) : null;
  el.innerHTML = `
  ${d.warnings.length || d.missing.length ? `<div class="err" style="margin-bottom:8px">${[...d.warnings, ...d.missing.map(m => m + ": 가격 데이터를 찾지 못해 평가에서 제외")].map(esc).join("<br>")}</div>` : ""}
  <div class="pf-strip">
    <div><div class="l">PORTFOLIO VALUE · ${FE.term("pf_nav", "평가금액")}</div>
      <div class="big">${money(s.value)}<small>${B}</small></div>
      <div class="d">▲ ${s.positions} 종목 · ${FE.term("pf_cost", "원금")} ${money(s.cost)} · USD/KRW ${FE.num(s.fx_usdkrw, 2)}</div></div>
    <div><div class="l">UNREALIZED P&amp;L · ${FE.term("pf_unreal", "평가손익")}</div>
      <div class="mid ${FE.cls(s.unrealized)}">${smoney(s.unrealized)}</div>
      <div class="d"><span class="${FE.cls(s.unrealized_pct)}">${FE.spct(s.unrealized_pct)}</span> &nbsp; <span class="pos">▲ ${s.gainers}</span> &nbsp; <span class="neg">▼ ${s.losers}</span> &nbsp; ${FE.term("pf_real", "실현")} <span class="${FE.cls(s.realized)}">${smoney(s.realized)}</span> · 배당 ${money(s.dividends)}</div></div>
    <div><div class="l">TODAY · ${FE.term("pf_day", "오늘")}</div>
      <div class="mid ${FE.cls(s.day)}">${smoney(s.day)}</div>
      <div class="d"><span class="${FE.cls(s.day_pct)}">${FE.spct(s.day_pct)}</span> · ${FE.term("pf_twr", "누적 TWR")} <span class="${FE.cls(s.twr_total)}">${FE.spct(s.twr_total)}</span></div></div>
    <div><div class="l">RISK &amp; POSITIONING · 위험·분산</div>
      <div class="pf-risk">
        <div class="r"><span>${FE.term("sharpe", "SHARPE")}</span><b class="${rk.sharpe >= 1 ? "pos" : rk.sharpe < 0 ? "neg" : "c-white"}">${FE.num(rk.sharpe)}</b></div>
        <div class="r"><span>${FE.term("pf_conc", "CONC 최대비중")}</span><b class="c-white">${FE.pct(rk.conc_top, 1)}</b></div>
        <div class="r"><span>${FE.term("beta", "BETA")} vs ${esc(d.benchmark)}</span><b class="c-white">${FE.num(rk.beta)}</b></div>
        <div class="r"><span>${FE.term("pf_vol30", "VOL 30D")}</span><b class="c-white">${FE.pct(rk.vol30, 1)}</b></div>
        <div class="r"><span>${FE.term("mdd", "MDD")}</span><b class="neg">${FE.pct(rk.mdd, 1)}</b></div>
        <div class="r"><span>${FE.term("pf_risk", "RISK 점수")}</span><b class="${riskScore > 60 ? "neg" : riskScore > 40 ? "c-yellow" : "pos"}">${riskScore ?? "—"}</b></div>
      </div></div>
  </div>
  <div class="pf-main">
    ${FE.panel({ title: "HOLDINGS", bar: true, acts: FE.pills("pft", [["PNL", "PNL"], ["WT", "WT"], ["DAY", "DAY"]], tileMode), bodyId: "pfTiles", style: "min-height:420px" })}
    ${FE.panel({ title: "PERFORMANCE", bar: true, acts: FE.pills("pfp", ["1M", "3M", "6M", "YTD", "1Y", "ALL"].map(x => [x, x]), perfPer) +
      `<select class="inp" id="pfBench" style="margin-left:6px">${BENCHES.map(([v, l]) => `<option value="${v}" ${v === p.bench ? "selected" : ""}>${l}</option>`).join("")}</select>` +
      FE.pills("pfm", [["pct", "%"], ["nav", "NAV"]], perfMode),
      body: `<div class="pf-perfh" id="pfPerfH"></div><div class="chart" style="height:340px"><canvas id="pfPerf"></canvas></div>` })}
    <div class="pf-right" style="display:flex;flex-direction:column;gap:8px">
      ${FE.panel({ title: "SECTORS", bar: true, sub: "섹터 비중", body: `<div class="pf-sec"><div class="chart" style="height:150px"><canvas id="pfSecC"></canvas></div><div class="lg" id="pfSecL"></div></div>` })}
      ${FE.panel({ title: `CORRELATION`, bar: true, sub: `${FE.term("corr", "상관계수")} · 상위 6종목 · 1년`, flush: true, bodyId: "pfCorr" })}
    </div>
  </div>
  ${FE.panel({ title: "POSITIONS", bar: true, sub: "보유 종목", acts: `<span class="badge c-orange">${d.holdings.length}</span><input class="inp" id="pfFilt" placeholder="종목 필터…" style="width:180px" value="${esc(posFilter)}">`, flush: true, bodyId: "pfPos" })}
  ${d.closed.length ? FE.panel({ title: "CLOSED", bar: true, color: "purple", sub: "전량 매도한 종목 (실현손익)", flush: true, body: FE.table([
      { k: "symbol", l: "SYMBOL", a: "l", f: v => `<b>${esc(v)}</b>` }, { k: "name", l: "종목명", a: "l", f: v => `<span class="c-muted">${esc(v)}</span>` },
      { k: "realized", l: `${FE.term("pf_real", "실현손익")} (${B})`, f: v => `<span class="${FE.cls(v)}">${smoney(v)}</span>` },
      { k: "dividends", l: `배당 (${B})`, f: v => money(v) }, { k: "sells", l: "매도 횟수" }], d.closed) }) : ""}
  ${FE.panel({ title: "TRANSACTION HISTORY", bar: true, sub: "거래내역", acts: `<span class="c-dim" style="font-size:12px">${p.txns.length}건 · 브라우저에 저장됨</span>`, flush: true, bodyId: "pfTx" })}
  <div class="note">※ 시세는 yfinance 지연 데이터이며 학습용입니다. 외화 종목의 원금은 매수일 환율, 평가금액은 최신 환율로 환산합니다. 한국 주식 가격·거래가는 원(KRW) 단위로 입력하세요.</div>`;
  drawTiles(d); drawPerf(d); drawSectors(d); drawCorrMini(d); drawPositions(d); drawTx();
  FE.onPills(el, "pft", v => { tileMode = v; drawTiles(d); });
  FE.onPills(el, "pfp", v => { perfPer = v; drawPerf(d); });
  FE.onPills(el, "pfm", v => { perfMode = v; drawPerf(d); });
  el.querySelector("#pfBench").onchange = e => { P().bench = e.target.value; save(); data = null; overview(el); };
  el.querySelector("#pfFilt").oninput = e => { posFilter = e.target.value; drawPositions(d); };
  FE.status(`포트폴리오 ${p.name}: ${d.holdings.length}종목 · 평가금액 ${money(s.value)} ${B}`);
}

function tileColor(v, max) {
  if (v == null || isNaN(v)) return "background:#1a1a1a";
  const a = Math.min(1, Math.abs(v) / max);
  return v >= 0 ? `background:rgba(22,${Math.round(100 + 63 * a)},74,${0.35 + 0.6 * a})` : `background:rgba(${Math.round(150 + 70 * a)},38,38,${0.35 + 0.6 * a})`;
}
function drawTiles(d) {
  const el = root.querySelector("#pfTiles"); if (!el) return;
  const rows = d.holdings.slice().sort((a, b) => (b.weight || 0) - (a.weight || 0));
  const val = h => tileMode === "PNL" ? h.pnl_pct : tileMode === "DAY" ? h.day_chg_pct : h.weight;
  const tiles = rows.map(h => {
    const v = val(h);
    const style = tileMode === "WT" ? `background:rgba(217,119,6,${0.2 + Math.min(.75, (v || 0) * 3)})` : tileColor(v, tileMode === "DAY" ? 0.04 : 0.6);
    const txt = tileMode === "WT" ? FE.pct(v, 1) : FE.spct(v, 1);
    return `<div class="tile" style="${style}" data-sym="${esc(h.symbol)}" data-tip-title="${esc(h.name)}" data-tip="평가손익 ${FE.spct(h.pnl_pct)} · 비중 ${FE.pct(h.weight, 1)} · 오늘 ${FE.spct(h.day_chg_pct)}">
      <div class="s">${esc(h.symbol.replace(/\.(KS|KQ)$/, ""))}</div><div class="p">${txt}</div></div>`;
  }).join("");
  const movers = rows.filter(h => h.day_chg_pct != null).sort((a, b) => b.day_chg_pct - a.day_chg_pct);
  const up = movers.slice(0, 2), dn = movers.slice(-2).reverse();
  el.innerHTML = `<div class="pf-tiles">${tiles}</div>
    <div style="margin-top:10px;border-top:1px solid var(--border-dim);padding-top:6px">
      <div class="c-dim" style="font-size:11.5px;letter-spacing:1px">TOP MOVERS · 오늘</div>
      ${up.map(h => `<div class="row" style="font-size:12.5px"><span class="pos">▲ ${esc(h.symbol)}</span><span class="spacer"></span><span class="${FE.cls(h.day_chg_pct)}">${FE.spct(h.day_chg_pct)}</span></div>`).join("")}
      ${dn.map(h => `<div class="row" style="font-size:12.5px"><span class="neg">▼ ${esc(h.symbol)}</span><span class="spacer"></span><span class="${FE.cls(h.day_chg_pct)}">${FE.spct(h.day_chg_pct)}</span></div>`).join("")}
    </div>`;
  el.querySelectorAll(".tile").forEach(t => t.onclick = () => {
    posFilter = posFilter === t.dataset.sym ? "" : t.dataset.sym;
    const f = root.querySelector("#pfFilt"); if (f) f.value = posFilter;
    el.querySelectorAll(".tile").forEach(x => x.classList.toggle("sel", x.dataset.sym === posFilter));
    drawPositions(d);
  });
}

function periodStart(dates, per) {
  if (per === "ALL") return 0;
  const last = new Date(dates[dates.length - 1]); const t = new Date(last);
  if (per === "YTD") t.setMonth(0, 1); else t.setMonth(t.getMonth() - { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 }[per]);
  const iso = t.toISOString().slice(0, 10); const i = dates.findIndex(x => x >= iso);
  return i < 0 ? 0 : i;
}
function drawPerf(d) {
  const pf = d.performance, B = d.base;
  const i0 = periodStart(pf.dates, perfPer);
  const lab = pf.dates.slice(i0);
  const tw = pf.twr.slice(i0), bm = pf.bench ? pf.bench.slice(i0) : null;
  const pr = tw[tw.length - 1] / tw[0] - 1, br = bm ? bm[bm.length - 1] / bm[0] - 1 : null;
  root.querySelector("#pfPerfH").innerHTML =
    `<span class="c-orange">${perfPer}<b class="${FE.cls(pr)}">${FE.spct(pr)}</b></span>
     <span>${esc(d.benchmark)}<b class="${FE.cls(br)}">${FE.spct(br)}</b></span>
     <span>${FE.term("pf_twr", "TOTAL")}<b class="${FE.cls(d.summary.twr_total)}">${FE.spct(d.summary.twr_total)}</b></span>
     <span class="c-orange">NAV ${B}<b class="c-orange">${money(d.summary.value)}</b></span>
     <span>COST ${B}<b class="c-muted">${money(d.summary.cost)}</b></span>`;
  let ds, yFmt;
  if (perfMode === "pct") {
    ds = [FE.line("포트폴리오 (TWR)", tw.map(v => (v / tw[0] - 1) * 100), FE.color.accent, { fill: { target: "origin", above: "rgba(22,163,74,.10)", below: "rgba(220,38,38,.12)" }, borderWidth: 2 })];
    if (bm) ds.push(FE.line(d.benchmark, bm.map(v => (v / bm[0] - 1) * 100), FE.color.cyan, { borderDash: [4, 3] }));
    yFmt = v => v.toFixed(0) + "%";
  } else {
    ds = [FE.line(`NAV (${B})`, pf.nav.slice(i0), FE.color.accent, { fill: { target: "origin", above: "rgba(217,119,6,.10)" }, borderWidth: 2 }),
      FE.line(`원금 (${B})`, pf.cost.slice(i0), FE.color.text2, { borderDash: [4, 3], stepped: true })];
    yFmt = v => FE.big(v, 1);
  }
  FE.chart("pfPerf", { type: "line", data: { labels: lab, datasets: ds }, options: FE.chartOpts({ legend: true, yFmt, xTicks: 7 }) });
}
function drawSectors(d) {
  const sec = d.sectors;
  FE.chart("pfSecC", { type: "doughnut", data: { labels: sec.map(s => s.sector), datasets: [{ data: sec.map(s => +(s.weight * 100).toFixed(2)), backgroundColor: sec.map((_, i) => FE.palette[(i + 1) % FE.palette.length]), borderColor: "#0a0a0a", borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: "68%", plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw}%` } } } } });
  root.querySelector("#pfSecL").innerHTML = sec.map((s, i) => `<div><i style="background:${FE.palette[(i + 1) % FE.palette.length]}"></i><span class="n">${esc(s.sector)} (${s.count})</span><b class="c-white">${FE.pct(s.weight, 1)}</b></div>`).join("");
}
function corrTable(syms, M, o = {}) {
  const short = s => s.replace(/\.(KS|KQ)$/, "");
  return `<div class="tbl-wrap"><table class="tbl pf-corr ${o.cls || ""}"><thead><tr><th></th>${syms.map(s => `<th class="c">${esc(short(s))}</th>`).join("")}</tr></thead><tbody>${
    M.map((row, i) => `<tr><th class="l" style="position:static">${esc(short(syms[i]))}</th>${row.map((v, j) => i === j ? `<td class="d">1.00</td>` :
      `<td data-a="${esc(syms[i])}" data-b="${esc(syms[j])}" style="${FE.heat(v, 1, "#d97706", "#0891b2")};color:#fff">${v == null ? "—" : v.toFixed(2)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function drawCorrMini(d) {
  const el = root.querySelector("#pfCorr");
  el.innerHTML = d.correlation ? corrTable(d.correlation.symbols, d.correlation.matrix) +
    `<div class="note" style="padding:4px 10px">주황 = 같이 움직임(분산 효과 작음), 청록 = 반대로 움직임. 자세히 보기 → <a href="#portfolio/correlation">상관관계 탭</a></div>` : `<div class="empty">종목이 2개 이상 필요합니다.</div>`;
}
function drawPositions(d) {
  const el = root.querySelector("#pfPos"); if (!el) return;
  const f = posFilter.trim().toUpperCase();
  const rows = d.holdings.filter(h => !f || h.symbol.includes(f) || (h.name || "").toUpperCase().includes(f));
  const B = d.base;
  const cols = [
    { k: "symbol", l: "SYMBOL", a: "l", sort: true, f: (v, r) => `<b class="c-white">${esc(v)}</b> <span class="c-dim" style="font-size:11px">${esc((r.name || "").slice(0, 18))}</span>` },
    { k: "qty", l: "QTY", sort: true, f: qtyf },
    { k: "last", l: "LAST", sort: true, f: (v, r) => `${lpx(v, r.currency)} <span class="c-dim" style="font-size:10.5px">${r.currency}</span>` },
    { k: "avg_cost", l: FE.term("pf_avg", "AVG COST"), sort: true, f: (v, r) => lpx(v, r.currency) },
    { k: "mkt_val", l: `MKT VAL (${B})`, sort: true, f: v => `<span class="c-white">${money(v)}</span>` },
    { k: "cost_basis", l: `${FE.term("pf_cost", "COST BASIS")}`, sort: true, f: v => money(v) },
    { k: "pnl", l: "P&amp;L", sort: true, f: v => `<span class="${FE.cls(v)}">${smoney(v)}</span>` },
    { k: "pnl_pct", l: "P&amp;L%", sort: true, f: v => sc(v) },
    { k: "day_chg_pct", l: "CHG%", sort: true, f: v => sc(v) },
    { k: "spark", l: "TREND 30D", a: "c", f: v => FE.sparkline(v, 84, 20) },
    { k: "weight", l: FE.term("pf_weight", "WT%"), sort: true, f: v => `<span class="c-orange">${FE.pct(v, 1)}</span>` },
    { k: "sector", l: "섹터", a: "l", f: v => `<span class="c-muted" style="font-size:11.5px">${esc(v)}</span>` },
    { k: "_a", l: "", a: "c", f: (v, r) => `<button class="pf-mini b" data-q="BUY" data-s="${esc(r.symbol)}">B</button> <button class="pf-mini s" data-q="SELL" data-s="${esc(r.symbol)}">S</button>` },
  ];
  const draw = rs => {
    el.innerHTML = FE.table(cols, rs, { rowCls: () => "click", rowAttr: r => `data-sym="${esc(r.symbol)}"`, empty: "필터와 일치하는 종목이 없습니다." }) +
      `<div class="note" style="padding:4px 10px">행 클릭 → 종목 리서치 · B/S → 이 종목 매수/매도 기록 · 열 제목 클릭 → 정렬 · 금액 열은 ${B} 환산, LAST/AVG COST는 현지 통화</div>`;
    FE.sortable(el, rs, draw);
    el.querySelectorAll("tr[data-sym]").forEach(tr => tr.onclick = e => {
      const b = e.target.closest("[data-q]"); if (b) return txForm(b.dataset.q, b.dataset.s);
      if (FE.screens.some(s => s.id === "research")) FE.go("research", tr.dataset.sym);
    });
  };
  draw(rows);
}
function drawTx() {
  const el = root.querySelector("#pfTx"); if (!el) return;
  const p = P();
  const rows = p.txns.map(t => ({ ...t, total: t.type === "BUY" ? t.qty * t.price + (+t.fee || 0) : t.qty * t.price - (+t.fee || 0) }))
    .sort((a, b) => b.date.localeCompare(a.date));
  el.innerHTML = FE.table([
    { k: "date", l: "DATE", a: "l", sort: true },
    { k: "symbol", l: "SYMBOL", a: "l", sort: true, f: v => `<b class="c-white">${esc(v)}</b>` },
    { k: "type", l: "TYPE", a: "l", f: v => `<span class="pf-type ${TCOL[v]}">${TLAB[v] || esc(v)}</span>` },
    { k: "qty", l: "QTY", f: qtyf },
    { k: "price", l: "PRICE", f: (v, r) => lpx(v, /\.(KS|KQ)$/.test(r.symbol) ? "KRW" : "USD") },
    { k: "fee", l: "FEE", f: v => FE.num(v || 0, 2) },
    { k: "total", l: "TOTAL (현지)", sort: true, f: (v, r) => `<span class="${TCOL[r.type]}">${/\.(KS|KQ)$/.test(r.symbol) ? FE.int(v) : FE.num(v, 2)}</span>` },
    { k: "note", l: "NOTES", a: "l", f: v => `<span class="c-muted">${esc(v || "")}</span>` },
    { k: "id", l: "", a: "c", f: v => `<button class="pf-x" data-del="${esc(v)}" title="삭제">✕</button>` },
  ], rows, { maxH: "340px" });
  el.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const t = p.txns.find(x => x.id === b.dataset.del); if (!t) return;
    if (!confirm(`${t.date} ${t.symbol} ${t.type} ${t.qty}주 거래를 삭제할까요?`)) return;
    p.txns = p.txns.filter(x => x.id !== t.id); save(); data = null; body();
  });
}

/* ================================================================== TX FORM */
function heldQty(sym) {
  let q = 0; P().txns.forEach(t => { if (t.symbol === sym) q += t.type === "BUY" ? +t.qty : t.type === "SELL" ? -t.qty : 0; }); return q;
}
function txForm(type, sym = "") {
  root.querySelector(".pf-modal")?.remove();
  const m = document.createElement("div"); m.className = "pf-modal";
  const syms = [...new Set(P().txns.map(t => t.symbol))];
  m.innerHTML = `<div class="pf-dlg">${FE.panel({ title: "TRANSACTION", bar: true, sub: "거래 기록", acts: `<button class="pf-x" data-close>✕</button>`, body: `
    <div class="row" style="margin-bottom:10px">${FE.pills("pftt", [["BUY", "BUY 매수"], ["SELL", "SELL 매도"], ["DIV", "DIV 배당"]], type)}<span class="spacer"></span><span class="c-dim" style="font-size:12px">${esc(P().name)}</span></div>
    <div class="form">
      ${FE.field("날짜", `<input class="inp" type="date" id="fDate" value="${today()}" max="${today()}">`)}
      ${FE.field("종목 코드 (검색)", `<input class="inp" id="fSym" list="fSymList" value="${esc(sym)}" placeholder="AAPL, 005930.KS, 삼성" autocomplete="off"><datalist id="fSymList">${syms.map(s => `<option value="${esc(s)}">`).join("")}</datalist>`)}
      ${FE.field(`<span id="fQtyL">수량 (주)</span>`, `<input class="inp" id="fQty" type="number" min="0" step="any" placeholder="10">`)}
      ${FE.field(`<span id="fPxL">가격 (현지 통화)</span>`, `<input class="inp" id="fPx" type="number" min="0" step="any" placeholder="0.00">`)}
      ${FE.field("수수료 (현지 통화)", `<input class="inp" id="fFee" type="number" min="0" step="any" value="0">`)}
      ${FE.field("메모", `<input class="inp" id="fNote" maxlength="80" placeholder="선택">`)}
    </div>
    <div class="row" style="margin-top:8px"><button class="btn muted" id="fClose">해당일 종가 불러오기</button><button class="btn muted" id="fAll" hidden>전량</button><span class="spacer"></span><span id="fInfo" class="c-muted" style="font-size:12px"></span></div>
    <div class="note" id="fHint" style="margin-top:6px"></div>
    <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn muted" data-close>취소</button><button class="btn solid" id="fSave">저장</button></div>` })}</div>`;
  root.appendChild(m);
  const $ = s => m.querySelector(s);
  let cur = type;
  const setType = t => {
    cur = t;
    $("#fQtyL").textContent = t === "DIV" ? "보유 수량 (주)" : "수량 (주)";
    $("#fPxL").textContent = t === "DIV" ? "주당 배당금 (현지 통화)" : "가격 (현지 통화)";
    $("#fAll").hidden = t === "BUY";
    $("#fSave").className = "btn " + (t === "BUY" ? "buy" : t === "SELL" ? "sell" : "info");
    $("#fHint").innerHTML = t === "BUY" ? "매수: 원금 = 수량 × 가격 + 수수료. 한국 주식은 원 단위, 미국 주식은 달러 단위로 입력하세요." :
      t === "SELL" ? "매도: 평균 단가 기준으로 실현손익이 계산됩니다. 보유 수량보다 많이 팔 수 없어요." :
      "배당: 배당금 = 보유 수량 × 주당 배당금 − 수수료(세금). 현금 수입으로 기록되며 보유 수량은 바뀌지 않아요.";
    info();
  };
  const info = () => { const s = $("#fSym").value.trim().toUpperCase(); $("#fInfo").textContent = s ? `현재 보유: ${qtyf(heldQty(s))}주` : ""; };
  FE.onPills(m, "pftt", setType); setType(type);
  m.querySelectorAll("[data-close]").forEach(b => b.onclick = () => m.remove());
  m.onclick = e => { if (e.target === m) m.remove(); };
  let t;
  $("#fSym").addEventListener("input", () => {
    info(); clearTimeout(t); const q = $("#fSym").value.trim(); if (q.length < 2) return;
    t = setTimeout(async () => {
      try { const r = await FE.api("/api/search?q=" + encodeURIComponent(q)); $("#fSymList").innerHTML = (r.results || []).slice(0, 10).map(x => `<option value="${esc(x.symbol)}">${esc(x.name || x.shortname || "")} ${esc(x.exchange || "")}</option>`).join(""); } catch {}
    }, 300);
  });
  $("#fAll").onclick = () => { $("#fQty").value = heldQty($("#fSym").value.trim().toUpperCase()); };
  $("#fClose").onclick = async () => {
    const s = $("#fSym").value.trim().toUpperCase(); if (!s) return FE.toast("종목 코드를 먼저 입력하세요.", true);
    try { const r = await FE.api("/api/portfolio/price?" + FE.qs({ symbol: s, date: $("#fDate").value })); $("#fPx").value = r.close; $("#fInfo").textContent = `${r.date} 종가 ${lpx(r.close, r.currency)} ${r.currency}`; if (cur === "DIV") $("#fQty").value = heldQty(s); }
    catch (e) { FE.toast(e.message, true); }
  };
  $("#fSave").onclick = () => {
    const tx = { id: uid(), date: $("#fDate").value, symbol: $("#fSym").value.trim().toUpperCase(), type: cur, qty: +$("#fQty").value, price: +$("#fPx").value, fee: +$("#fFee").value || 0, note: $("#fNote").value.trim() };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date) || tx.date > today()) return FE.toast("날짜를 확인하세요 (미래 날짜 불가).", true);
    if (!/^[A-Z0-9.\-^=]{1,20}$/.test(tx.symbol)) return FE.toast("종목 코드 형식이 올바르지 않습니다.", true);
    if (!(tx.qty > 0)) return FE.toast("수량은 0보다 커야 합니다.", true);
    if (!(tx.price > 0)) return FE.toast("가격을 입력하세요.", true);
    if (tx.fee < 0) return FE.toast("수수료는 0 이상이어야 합니다.", true);
    if (cur === "SELL" && tx.qty > heldQty(tx.symbol) + 1e-9) return FE.toast(`보유 수량(${qtyf(heldQty(tx.symbol))}주)보다 많이 팔 수 없습니다.`, true);
    P().txns.push(tx); save(); data = null; m.remove();
    FE.toast(`${tx.symbol} ${TLAB[cur]} ${qtyf(tx.qty)}주 기록했습니다.`); body();
  };
  setTimeout(() => (sym ? $("#fQty") : $("#fSym")).focus(), 30);
}

/* ================================================================== IMPORT / EXPORT */
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportCsv() {
  const p = P(); const q = v => /[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : (v ?? "");
  download(`${p.name}.csv`, "﻿date,symbol,type,qty,price,fee,note\n" + p.txns.map(t => [t.date, t.symbol, t.type, t.qty, t.price, t.fee || 0, t.note || ""].map(q).join(",")).join("\n"), "text/csv");
  FE.toast(`${p.txns.length}건을 CSV로 내보냈습니다.`);
}
function exportJson() { const p = P(); download(`${p.name}.json`, JSON.stringify({ name: p.name, base: p.base, bench: p.bench, txns: p.txns }, null, 2), "application/json"); }
function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
  const split = l => { const out = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const c = l[i];
    if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out.map(s => s.trim()); };
  let head = ["date", "symbol", "type", "qty", "price", "fee", "note"];
  if (/date|symbol/i.test(lines[0])) head = split(lines.shift()).map(h => h.toLowerCase().replace("quantity", "qty"));
  return lines.map(l => { const c = split(l); const o = {}; head.forEach((h, i) => o[h] = c[i]); return o; });
}
async function importFile(f) {
  if (!f) return;
  try {
    const text = await f.text(); let raw, meta = {};
    if (/\.json$/i.test(f.name) || text.trim().startsWith("{") || text.trim().startsWith("[")) {
      const j = JSON.parse(text); raw = Array.isArray(j) ? j : j.txns || j.transactions || []; meta = Array.isArray(j) ? {} : j;
    } else raw = parseCsv(text);
    const txns = raw.map(r => ({ id: uid(), date: String(r.date || "").slice(0, 10), symbol: String(r.symbol || "").trim().toUpperCase(),
      type: String(r.type || "BUY").toUpperCase().replace("DIVIDEND", "DIV"), qty: +r.qty || +r.quantity || 0, price: +r.price || 0, fee: +r.fee || 0, note: r.note || r.notes || "" }))
      .filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && t.symbol && ["BUY", "SELL", "DIV"].includes(t.type) && t.qty > 0 && t.price >= 0);
    if (!txns.length) return FE.toast("가져올 수 있는 거래가 없습니다. 형식: date,symbol,type,qty,price,fee,note", true);
    const np = { id: uid(), name: (meta.name || f.name.replace(/\.(csv|json)$/i, "")).slice(0, 40), base: meta.base === "KRW" ? "KRW" : "USD", bench: meta.bench || "SPY", txns };
    S.list.push(np); S.active = np.id; save(); data = null; shell();
    FE.toast(`'${np.name}' 포트폴리오로 ${txns.length}건을 가져왔습니다 (${raw.length - txns.length}건 제외).`);
  } catch (e) { FE.toast("파일을 읽지 못했습니다: " + e.message, true); }
}

/* ================================================================== PERF / RISK */
async function riskView(el, force) {
  FE.loading(el, "수익률 · 변동성 · VaR · 스트레스 테스트 계산 중…");
  const k = "risk" + JSON.stringify(payload());
  let d;
  try { d = (!force && cache[k]) || (cache[k] = await FE.api("/api/portfolio/risk", payload())); } catch (e) { return FE.error(el, e); }
  if (view !== "risk") return;
  const B = d.base, st = d.stats, c = d.capm || {};
  let horizon = 1;
  el.innerHTML = `
  ${FE.stats([
    { l: FE.term("pf_twr", "누적 TWR"), v: FE.spct(st.total_return), vcls: FE.cls(st.total_return) },
    { l: FE.term("cagr", "연평균 (CAGR)"), v: FE.spct(st.cagr), vcls: FE.cls(st.cagr) },
    { l: FE.term("vol", "변동성"), v: FE.pct(st.volatility), vcls: "c-white" },
    { l: FE.term("sharpe", "샤프"), v: FE.num(st.sharpe), vcls: "c-cyan" },
    { l: FE.term("sortino", "소르티노"), v: FE.num(st.sortino), vcls: "c-cyan" },
    { l: FE.term("mdd", "최대 낙폭"), v: FE.pct(st.max_drawdown), vcls: "neg" },
    { l: FE.term("beta", "베타") + " vs " + esc(d.benchmark), v: FE.num(c.beta), vcls: "c-white" },
    { l: FE.term("alpha", "알파 (연)"), v: FE.spct(c.alpha), vcls: FE.cls(c.alpha) },
  ])}
  <div class="grid cols-3">
    ${FE.panel({ title: "RETURNS BY PERIOD", bar: true, sub: "기간별 수익률", flush: true, body: FE.table([
      { k: "label", l: "기간", a: "l" }, { k: "port", l: "포트폴리오", f: sc }, { k: "bench", l: esc(d.benchmark), f: sc }, { k: "excess", l: "초과", f: sc }], d.periods) })}
    ${FE.panel({ title: "CAPM vs " + esc(d.benchmark), bar: true, color: "cyan", sub: "최근 1년 일간", body: FE.kv([
      [FE.term("beta", "베타"), FE.num(c.beta)], [FE.term("alpha", "알파 (연율)"), sc(c.alpha)], ["알파 t값", FE.num(c.alpha_t) + (Math.abs(c.alpha_t) > 1.96 ? " <span class='pos'>유의</span>" : " <span class='c-dim'>유의하지 않음</span>")],
      [FE.term("pf_r2", "R²"), FE.num(c.r2)], [FE.term("corr", "상관계수"), FE.num(c.corr)], [FE.term("pf_te", "추적오차"), FE.pct(c.tracking_error)],
      [FE.term("pf_ir", "정보비율"), FE.num(c.info_ratio)], [FE.term("pf_cap", "상승 포착률"), FE.pct(c.up_capture, 0)], [FE.term("pf_cap", "하락 포착률"), FE.pct(c.down_capture, 0)]]) })}
    ${FE.panel({ title: "VALUE AT RISK", bar: true, color: "red", sub: `${d.var_window}일 표본`, acts: FE.pills("pfh", [["1", "1일"], ["10", "10일"]], "1"), bodyId: "pfVar" })}
  </div>
  <div class="grid cols-2">
    ${FE.panel({ title: "CUMULATIVE RETURN", bar: true, sub: "TWR vs 벤치마크", body: `<div class="chart md"><canvas id="pfCum"></canvas></div>` })}
    ${FE.panel({ title: "DRAWDOWN", bar: true, color: "red", sub: "고점 대비 하락률", body: `<div class="chart md"><canvas id="pfDD"></canvas></div>` })}
    ${FE.panel({ title: "ROLLING VOLATILITY", bar: true, color: "yellow", sub: "21일 · 63일 연율화", body: `<div class="chart md"><canvas id="pfRV"></canvas></div>` })}
    ${FE.panel({ title: "DAILY RETURN DISTRIBUTION", bar: true, color: "purple", sub: "최근 1년 일간 수익률 (%) · 빨간 막대 = VaR 95% 밖", body: `<div class="chart md"><canvas id="pfHist"></canvas></div>` })}
  </div>
  <div class="grid cols-2">
    ${FE.panel({ title: "CONTRIBUTION", bar: true, color: "green", sub: `${FE.term("pf_contrib", "종목별 손익 기여")} (${B}, 실현+미실현+배당)`, bodyId: "pfContrib" })}
    ${FE.panel({ title: "STRESS TEST", bar: true, color: "red", sub: FE.term("pf_stress", "역사적 위기 시나리오 × 베타"), flush: true, bodyId: "pfStress" })}
  </div>
  ${FE.panel({ title: "MONTHLY RETURNS", bar: true, sub: "월별 TWR 수익률 (%)", flush: true, body: monthlyTable(d.monthly) })}
  <div class="note">※ 과거 데이터로 계산한 추정치이며 미래 손실을 보장하지 않습니다. 스트레스 테스트는 '위기 당시 지수 하락률 × 현재 종목 베타'의 단순 근사입니다.</div>`;
  const drawVar = () => {
    const k2 = Math.sqrt(horizon);
    const row = (lab, key, tip) => ({ lab: FE.term(tip, lab), v95: d.var["95"][key] * k2, v99: d.var["99"][key] * k2 });
    const rows = [row("역사적 VaR", "hist_var", "pf_hist"), row("역사적 CVaR", "hist_cvar", "cvar"), row("모수적 VaR", "param_var", "pf_param"), row("모수적 CVaR", "param_cvar", "cvar")];
    root.querySelector("#pfVar").innerHTML = FE.table([{ k: "lab", l: "", a: "l", f: v => v },
      { k: "v95", l: "95%", f: v => `<span class="neg">-${FE.pct(v)}</span><br><span class="c-dim" style="font-size:11px">${money(-v * d.nav, B)}</span>` },
      { k: "v99", l: "99%", f: v => `<span class="neg">-${FE.pct(v)}</span><br><span class="c-dim" style="font-size:11px">${money(-v * d.nav, B)}</span>` }], rows) +
      `<div class="note" style="margin-top:6px">"${horizon}일 동안 95% 확률로 손실이 ${money(d.var["95"].hist_var * k2 * d.nav, B)} ${B}를 넘지 않는다"는 뜻. ${horizon > 1 ? "10일 값은 √10 배로 단순 환산." : ""}</div>`;
  };
  drawVar();
  FE.onPills(el, "pfh", v => { horizon = +v; drawVar(); });
  const pctData = a => a.map(v => v == null ? null : (v / a[0] - 1) * 100);
  FE.chart("pfCum", { type: "line", data: { labels: d.dates, datasets: [FE.line("포트폴리오", pctData(d.twr), FE.color.accent, { borderWidth: 2 }), ...(d.bench ? [FE.line(d.benchmark, pctData(d.bench), FE.color.cyan, { borderDash: [4, 3] })] : [])] }, options: FE.chartOpts({ legend: true, yFmt: v => v.toFixed(0) + "%" }) });
  FE.chart("pfDD", { type: "line", data: { labels: d.dates, datasets: [FE.line("포트폴리오", d.drawdown.port.map(v => v * 100), FE.color.neg, { fill: { target: "origin", below: "rgba(220,38,38,.18)" } }), ...(d.drawdown.bench ? [FE.line(d.benchmark, d.drawdown.bench.map(v => v * 100), FE.color.text2, { borderDash: [4, 3] })] : [])] }, options: FE.chartOpts({ legend: true, yFmt: v => v.toFixed(0) + "%" }) });
  FE.chart("pfRV", { type: "line", data: { labels: d.rolling.dates, datasets: [FE.line("21일", d.rolling.vol21.map(v => v == null ? null : v * 100), FE.color.warn), FE.line("63일", d.rolling.vol63.map(v => v == null ? null : v * 100), FE.color.purple, { borderWidth: 2 })] }, options: FE.chartOpts({ legend: true, yFmt: v => v.toFixed(0) + "%" }) });
  const e = d.hist.edges, v95 = -d.var["95"].hist_var * 100;
  FE.chart("pfHist", { type: "bar", data: { labels: d.hist.counts.map((_, i) => ((e[i] + e[i + 1]) / 2).toFixed(2)), datasets: [{ label: "일수", data: d.hist.counts, backgroundColor: d.hist.counts.map((_, i) => (e[i] + e[i + 1]) / 2 < v95 ? FE.color.neg : FE.color.cyan), barPercentage: 1, categoryPercentage: 1 }] }, options: FE.chartOpts({ xTicks: 9, xFmt: v => v + "%" }) });
  // contribution bars
  const cmax = Math.max(...d.contribution.map(x => Math.abs(x.pnl || 0)), 1);
  root.querySelector("#pfContrib").innerHTML = `<div class="pf-bars">${d.contribution.map(x => `<div class="r"><b class="c-white">${esc(x.symbol)}</b>
    <div class="bk"><span class="z"></span><i style="${x.pnl >= 0 ? `left:50%;width:${x.pnl / cmax * 50}%;background:var(--pos)` : `right:50%;width:${-x.pnl / cmax * 50}%;background:var(--neg)`}"></i></div>
    <span class="${FE.cls(x.pnl)}" style="text-align:right">${smoney(x.pnl, B)}</span></div>`).join("")}</div>` +
    FE.table([{ k: "symbol", l: "종목", a: "l" }, { k: "share", l: "손익 비중", f: v => FE.pct(v, 1) }, { k: "weight", l: "현재 비중", f: v => FE.pct(v, 1) },
      { k: "ret_1y", l: "1년 수익률", f: sc }, { k: "contrib_1y", l: "1년 기여 (비중×수익)", f: sc }], d.contribution);
  // stress
  let sel = d.stress[0]?.id;
  const drawStress = () => {
    const el2 = root.querySelector("#pfStress");
    const s = d.stress.find(x => x.id === sel);
    el2.innerHTML = FE.table([{ k: "name", l: "시나리오", a: "l", f: (v, r) => `<b class="c-white">${esc(v)}</b><br><span class="c-dim" style="font-size:11px">${esc(r.desc)}</span>` },
      { k: "impact_pct", l: "예상 손실", f: v => `<b class="neg">${FE.spct(v)}</b>` }, { k: "impact", l: `금액 (${B})`, f: v => `<span class="neg">${smoney(v, B)}</span>` }],
      d.stress, { rowCls: r => "click pf-sc" + (r.id === sel ? " sel" : ""), rowAttr: r => `data-sc="${r.id}"` }) +
      (s ? `<div style="padding:6px 10px" class="c-muted">▸ ${esc(s.name)} 종목별 영향 (베타 × 지수 하락${s.fx ? `, 원/달러 +${Math.round(s.fx * 100)}%` : ""})</div>` + FE.table([
        { k: "symbol", l: "종목", a: "l" }, { k: "beta", l: FE.term("beta", "베타"), f: v => FE.num(v) }, { k: "equity_shock", l: "주가 충격", f: sc },
        { k: "fx_mult", l: "환율 효과", f: v => sc(v - 1) }, { k: "impact_pct", l: "합계", f: sc }, { k: "impact", l: B, f: v => `<span class="neg">${smoney(v, B)}</span>` }], s.items) : "");
    el2.querySelectorAll("[data-sc]").forEach(tr => tr.onclick = () => { sel = tr.dataset.sc; drawStress(); });
  };
  drawStress();
}
function monthlyTable(rows) {
  const M = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  return `<div class="tbl-wrap"><table class="tbl heat"><thead><tr><th class="l">연도</th>${M.map(m => `<th class="c">${m}</th>`).join("")}<th class="c">연간</th></tr></thead><tbody>${
    rows.map(r => { const yr = r.months.reduce((a, v) => v == null ? a : a * (1 + v), 1) - 1;
      return `<tr><td class="l c-white">${r.year}</td>${r.months.map(v => `<td style="${FE.heat(v, 0.1)}">${v == null ? "" : (v * 100).toFixed(1)}</td>`).join("")}<td style="${FE.heat(yr, 0.4)}">${(yr * 100).toFixed(1)}</td></tr>`; }).join("")}</tbody></table></div>`;
}

/* ================================================================== OPTIMIZE */
const PNAME = { current: "현재 비중", max_sharpe: "최대 샤프", min_vol: "최소 변동성", risk_parity: "리스크 패리티", equal: "동일 비중" };
const PCOL = { current: "#e5e5e5", max_sharpe: "#d97706", min_vol: "#16a34a", risk_parity: "#9333ea", equal: "#0891b2" };
const PTERM = { max_sharpe: "pf_ms", min_vol: "pf_mv", risk_parity: "pf_rp" };
let optCfg = { period: "2y", rf: 3, maxw: 100, target: "max_sharpe" };
async function optView(el, force) {
  el.innerHTML = FE.panel({ title: "OPTIMIZER", bar: true, sub: "보유 종목으로 만들 수 있는 비중 조합 탐색 (롱 온리)", body: `<div class="row">
     <span class="c-muted">학습 기간</span>${FE.pills("pfop", [["1y", "1년"], ["2y", "2년"], ["5y", "5년"]], optCfg.period)}
     <span class="c-muted" style="margin-left:10px">${FE.term("rf", "무위험 이자율")} %</span><input class="inp" id="oRf" type="number" step="0.1" value="${optCfg.rf}" style="width:70px">
     <span class="c-muted">종목당 최대 비중 %</span><input class="inp" id="oMax" type="number" step="5" min="5" max="100" value="${optCfg.maxw}" style="width:70px">
     <button class="btn solid" id="oRun">최적화 실행</button><span class="spacer"></span>
     <span class="note">랜덤 포트폴리오 1.3만 개 + 국소 탐색 · 수익률은 ${P().base} 환산(환율 포함)</span></div>` }) + `<div id="oOut"></div>`;
  FE.onPills(el, "pfop", v => { optCfg.period = v; });
  el.querySelector("#oRun").onclick = () => { optCfg.rf = +el.querySelector("#oRf").value || 0; optCfg.maxw = +el.querySelector("#oMax").value || 100; runOpt(true); };
  runOpt(force);
}
async function runOpt(force) {
  const out = root.querySelector("#oOut"); if (!out) return;
  FE.loading(out, "효율적 투자선 계산 중…");
  const body = payload(P(), { period: optCfg.period, rf: optCfg.rf / 100, max_weight: optCfg.maxw / 100 });
  const k = "opt" + JSON.stringify(body);
  let d;
  try { d = (!force && cache[k]) || (cache[k] = await FE.api("/api/portfolio/optimize", body)); } catch (e) { return FE.error(out, e); }
  if (view !== "optimize") return;
  const keys = Object.keys(d.portfolios), syms = d.symbols, B = d.base;
  out.innerHTML = `
  <div class="grid cols-2">
    ${FE.panel({ title: "EFFICIENT FRONTIER", bar: true, sub: `${FE.term("frontier", "효율적 투자선")} · 점 색 = 샤프 지수`, body: `<div class="chart lg"><canvas id="oScat"></canvas></div>` })}
    ${FE.panel({ title: "WEIGHTS", bar: true, color: "cyan", sub: "포트폴리오별 비중 · 성과 (학습 기간 기준)", flush: true, bodyId: "oW" })}
  </div>
  <div class="grid cols-2">
    ${FE.panel({ title: "BACKTEST", bar: true, sub: "각 비중으로 기간 초에 시작했다면 (1 → )", body: `<div class="chart md"><canvas id="oCurve"></canvas></div>` })}
    ${FE.panel({ title: "RISK CONTRIBUTION", bar: true, color: "purple", sub: FE.term("pf_rc", "종목별 위험 기여도"), body: `<div class="chart md"><canvas id="oRC"></canvas></div>` })}
  </div>
  ${FE.panel({ title: "REBALANCING", bar: true, color: "green", sub: FE.term("pf_rebal", "목표 비중으로 바꾸려면 필요한 거래"), acts: FE.pills("pfot", keys.filter(k => k !== "current").map(k => [k, PNAME[k]]), optCfg.target) +
    `<button class="btn buy" id="oApply" style="margin-left:8px" data-tip="아래 거래를 오늘 날짜·최근 종가로 거래내역에 추가합니다">거래내역에 반영</button>`, flush: true, bodyId: "oTr" })}
  <div class="note">※ 최적 비중은 <b>과거</b> 수익률·변동성으로 계산한 결과라 미래에도 최적이라는 보장이 없습니다(추정 오차에 매우 민감). 극단적인 비중은 최대 비중 제한으로 완화해 보세요. 학습용 참고 자료입니다.</div>`;
  // scatter
  const cl = d.cloud, smin = Math.min(...cl.sharpe), smax = Math.max(...cl.sharpe);
  const shc = s => { const t = (s - smin) / (smax - smin || 1); return `rgba(${Math.round(8 + t * 209)},${Math.round(145 - t * 26)},${Math.round(178 - t * 172)},.55)`; };
  FE.chart("oScat", { type: "scatter", data: { datasets: [
    ...keys.map(k => ({ label: PNAME[k], data: [{ x: d.portfolios[k].vol * 100, y: d.portfolios[k].ret * 100 }], backgroundColor: PCOL[k], borderColor: "#000", pointRadius: 8, pointStyle: k === "current" ? "crossRot" : "rectRot", borderWidth: k === "current" ? 3 : 1, ...(k === "current" ? { borderColor: "#fff" } : {}) })),
    { label: "효율적 투자선", type: "line", data: d.frontier.map(p => ({ x: p.vol * 100, y: p.ret * 100 })), borderColor: FE.color.accent, borderWidth: 2, pointRadius: 0, tension: .3 },
    { label: "개별 종목", data: d.assets.map(a => ({ x: a.vol * 100, y: a.ret * 100, s: a.symbol })), backgroundColor: "#64748b", pointRadius: 4, pointStyle: "triangle" },
    { label: "랜덤 조합", data: cl.vol.map((v, i) => ({ x: v * 100, y: cl.ret[i] * 100 })), backgroundColor: cl.sharpe.map(shc), pointRadius: 1.6 },
  ] }, options: FE.chartOpts({ legend: true, mode: "nearest", xType: "linear", xFmt: v => (+v).toFixed(0) + "%", yFmt: v => v.toFixed(0) + "%",
    x: { type: "linear", title: { display: true, text: "변동성 (연, %)", color: FE.color.text2 } }, y: { title: { display: true, text: "기대수익률 (연, %)", color: FE.color.text2 } },
    tooltip: { callbacks: { label: c => `${c.dataset.label}${c.raw.s ? " " + c.raw.s : ""}: 변동성 ${c.raw.x.toFixed(1)}% · 수익률 ${c.raw.y.toFixed(1)}%` } } }) });
  // weights table
  const rows = syms.map((s, i) => { const r = { sym: s }; keys.forEach(k => r[k] = d.portfolios[k].weights[i]); return r; });
  const mrow = (lab, f, key) => `<tr><td class="l c-muted">${lab}</td>${keys.map(k => `<td>${f(d.portfolios[k][key])}</td>`).join("")}</tr>`;
  root.querySelector("#oW").innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">종목</th>${keys.map(k => `<th><span style="color:${PCOL[k]}">■</span> ${PTERM[k] ? FE.term(PTERM[k], PNAME[k]) : PNAME[k]}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(r => `<tr><td class="l"><b class="c-white">${esc(r.sym)}</b></td>${keys.map(k => `<td style="${k !== "current" && Math.abs(r[k] - r.current) > .05 ? `color:${r[k] > r.current ? "var(--pos)" : "var(--neg)"}` : ""}">${FE.pct(r[k], 1)}</td>`).join("")}</tr>`).join("")}
    ${mrow("기대수익률 (연)", v => sc(v), "ret")}${mrow(FE.term("vol", "변동성"), v => FE.pct(v, 1), "vol")}${mrow(FE.term("sharpe", "샤프"), v => `<b class="c-cyan">${FE.num(v)}</b>`, "sharpe")}
    ${mrow(FE.term("mdd", "최대 낙폭"), v => `<span class="neg">${FE.pct(v, 1)}</span>`, "max_drawdown")}${mrow(FE.term("pf_dr", "분산 비율"), v => FE.num(v), "div_ratio")}
    </tbody></table></div>`;
  FE.chart("oCurve", { type: "line", data: { labels: d.dates, datasets: keys.map(k => FE.line(PNAME[k], d.portfolios[k].curve, PCOL[k], { borderWidth: k === "current" ? 2.4 : 1.4 })) }, options: FE.chartOpts({ legend: true, yFmt: v => v.toFixed(2) }) });
  FE.chart("oRC", { type: "bar", data: { labels: syms, datasets: keys.map(k => ({ label: PNAME[k], data: (d.portfolios[k].risk_contrib || []).map(v => v * 100), backgroundColor: PCOL[k] })) }, options: FE.chartOpts({ legend: true, yFmt: v => v.toFixed(0) + "%", mode: "index" }) });
  const drawTr = () => {
    const tr = d.trades[optCfg.target];
    root.querySelector("#oTr").innerHTML = FE.table([
      { k: "symbol", l: "종목", a: "l", f: v => `<b class="c-white">${esc(v)}</b>` }, { k: "current", l: "현재 비중", f: v => FE.pct(v, 1) },
      { k: "target", l: "목표 비중", f: v => `<span class="c-orange">${FE.pct(v, 1)}</span>` },
      { k: "delta_value", l: `금액 변화 (${B})`, f: v => `<span class="${FE.cls(v)}">${smoney(v, B)}</span>` },
      { k: "shares_round", l: "주식 수 (반올림)", f: (v, r) => `<span class="${FE.cls(v)}">${v > 0 ? "+" : ""}${FE.int(v)}</span> <span class="c-dim" style="font-size:11px">(${FE.num(r.shares, 2)})</span>` },
      { k: "price", l: "최근가 (현지)", f: (v, r) => `${lpx(v, r.currency)} <span class="c-dim" style="font-size:10.5px">${r.currency}</span>` },
      { k: "action", l: "", a: "c", f: v => `<span class="badge ${v === "BUY" ? "fill-green" : v === "SELL" ? "fill-red" : ""}">${v === "BUY" ? "매수" : v === "SELL" ? "매도" : "유지"}</span>` }], tr) +
      `<div class="note" style="padding:4px 10px">총 평가금액 ${money(d.total, B)} ${B} 기준. 매도 ${FE.int(tr.filter(t => t.action === "SELL").length)}건 · 매수 ${FE.int(tr.filter(t => t.action === "BUY").length)}건 — 실제 거래 전 수수료·세금을 확인하세요.</div>`;
  };
  drawTr();
  FE.onPills(out, "pfot", v => { optCfg.target = v; drawTr(); });
  out.querySelector("#oApply").onclick = () => {
    const tr = d.trades[optCfg.target].filter(t => t.action !== "HOLD" && t.shares_round);
    if (!tr.length) return FE.toast("반영할 거래가 없습니다.");
    if (!confirm(`${PNAME[optCfg.target]} 비중으로 ${tr.length}건의 거래를 오늘 날짜·최근 종가로 기록할까요?`)) return;
    const p = P();
    tr.sort((a, b) => a.shares_round - b.shares_round).forEach(t => {
      const q = Math.min(Math.abs(t.shares_round), t.shares_round < 0 ? heldQty(t.symbol) : Infinity); if (!q) return;
      p.txns.push({ id: uid(), date: today(), symbol: t.symbol, type: t.shares_round > 0 ? "BUY" : "SELL", qty: q, price: t.price, fee: 0, note: `리밸런싱 → ${PNAME[optCfg.target]}` });
    });
    save(); data = null; FE.toast("리밸런싱 거래를 기록했습니다."); view = "overview"; shell();
  };
}

/* ================================================================== CORRELATION */
let corrCfg = { period: "1y", window: 60, a: null, b: null, bench: true };
async function corrView(el) {
  FE.loading(el, "보유 종목 목록 확인 중…");
  let d; try { d = await analyze(); } catch (e) { return FE.error(el, e); }
  if (view !== "correlation") return;
  const syms = d.holdings.filter(h => !h.missing).map(h => h.symbol);
  if (syms.length < 2) return el.innerHTML = `<div class="empty">상관관계를 보려면 종목이 2개 이상 필요합니다.</div>`;
  el.innerHTML = FE.panel({ title: "CORRELATION", bar: true, sub: "보유 종목 일간 수익률 상관관계", body: `<div class="row">
    <span class="c-muted">기간</span>${FE.pills("pfcp", [["6mo", "6개월"], ["1y", "1년"], ["2y", "2년"], ["5y", "5년"]], corrCfg.period)}
    <span class="c-muted" style="margin-left:10px">${FE.term("pf_roll", "롤링 창")}</span>${FE.pills("pfcw", [[20, "20일"], [60, "60일"], [120, "120일"]], corrCfg.window)}
    <label class="chk" style="margin-left:10px"><input type="checkbox" id="cB" ${corrCfg.bench ? "checked" : ""}> 벤치마크(SPY·코스피) 포함</label></div>` }) + `<div id="cOut"></div>`;
  const run = async () => {
    const out = el.querySelector("#cOut"); FE.loading(out, "상관관계 계산 중…");
    const list = corrCfg.bench ? [...syms, "SPY", "^KS11"].filter((x, i, a) => a.indexOf(x) === i) : syms;
    if (!corrCfg.a || !list.includes(corrCfg.a)) corrCfg.a = list[0];
    if (!corrCfg.b || !list.includes(corrCfg.b) || corrCfg.b === corrCfg.a) corrCfg.b = list.find(x => x !== corrCfg.a);
    let c; try { c = await FE.api("/api/portfolio/correlation?" + FE.qs({ symbols: list.join(","), period: corrCfg.period, window: corrCfg.window, a: corrCfg.a, b: corrCfg.b })); } catch (e) { return FE.error(out, e); }
    if (view !== "correlation") return;
    const pr = c.pair;
    const opt = sel => c.symbols.map(s => `<option ${s === sel ? "selected" : ""}>${esc(s)}</option>`).join("");
    out.innerHTML = `<div class="grid cols-2">
      ${FE.panel({ title: "CORRELATION MATRIX", bar: true, sub: `평균 상관계수 ${FE.num(c.avg)} · 셀 클릭 → 아래 페어로 선택`, flush: true, body: corrTable(c.symbols, c.matrix, { cls: "pf-hm" }) + (c.note ? `<div class="note" style="padding:4px 10px">※ ${esc(c.note)}</div>` : "") })}
      ${FE.panel({ title: "PAIRS", bar: true, color: "cyan", sub: "상관계수 높은 순 → 낮은 순", flush: true, body: FE.table([{ k: "a", l: "A", a: "l" }, { k: "b", l: "B", a: "l" },
        { k: "corr", l: FE.term("corr", "상관계수"), f: v => `<b style="color:${v > .7 ? "var(--accent)" : v < .3 ? "var(--cyan)" : "var(--text)"}">${FE.num(v)}</b>` },
        { k: "_", l: "해석", a: "l", f: (v, r) => `<span class="c-muted">${r.corr > .7 ? "거의 같이 움직임 — 분산 효과 작음" : r.corr > .4 ? "어느 정도 같이 움직임" : r.corr > .1 ? "약한 관계 — 분산 효과 좋음" : "거의 무관/반대 — 분산 효과 큼"}</span>` }],
        c.pairs, { rowCls: () => "click", rowAttr: r => `data-a="${esc(r.a)}" data-b="${esc(r.b)}"`, maxH: "330px" }) })}
    </div>
    ${FE.panel({ title: "ROLLING CORRELATION", bar: true, sub: `${corrCfg.window}일 창`, acts: `<select class="inp" id="cA">${opt(pr.a)}</select><span class="c-dim">vs</span><select class="inp" id="cBb">${opt(pr.b)}</select>`,
      body: `<div class="row" style="font-size:12.5px;margin-bottom:6px"><span>전체 기간 <b class="c-cyan">${FE.num(pr.full)}</b></span><span>최근 <b class="c-orange">${FE.num(pr.last)}</b></span><span>최저 <b>${FE.num(pr.min)}</b></span><span>최고 <b>${FE.num(pr.max)}</b></span></div>
        <div class="grid cols-2"><div class="chart md"><canvas id="cRoll"></canvas></div><div class="chart md"><canvas id="cPx"></canvas></div></div>` })}`;
    FE.chart("cRoll", { type: "line", data: { labels: pr.dates, datasets: [FE.line(`${pr.a} vs ${pr.b}`, pr.rolling, FE.color.accent, { fill: { target: { value: 0 }, above: "rgba(217,119,6,.12)", below: "rgba(8,145,178,.15)" }, borderWidth: 2 }), FE.line("전체 평균", pr.rolling.map(() => pr.full), FE.color.text2, { borderDash: [4, 3], borderWidth: 1 })] }, options: FE.chartOpts({ legend: true, y: { min: -1, max: 1 }, yFmt: v => v.toFixed(1) }) });
    FE.chart("cPx", { type: "line", data: { labels: pr.price_dates, datasets: [FE.line(pr.a, pr.pa, FE.color.accent), FE.line(pr.b, pr.pb, FE.color.cyan)] }, options: FE.chartOpts({ legend: true, yFmt: v => v.toFixed(0) }) });
    const pick = (a, b) => { if (a && b && a !== b) { corrCfg.a = a; corrCfg.b = b; run(); } };
    out.querySelectorAll("td[data-a], tr[data-a]").forEach(x => x.onclick = () => pick(x.dataset.a, x.dataset.b));
    out.querySelector("#cA").onchange = e => pick(e.target.value, corrCfg.b === e.target.value ? corrCfg.a : corrCfg.b);
    out.querySelector("#cBb").onchange = e => pick(corrCfg.a === e.target.value ? corrCfg.b : corrCfg.a, e.target.value);
  };
  FE.onPills(el, "pfcp", v => { corrCfg.period = v; run(); });
  FE.onPills(el, "pfcw", v => { corrCfg.window = +v; run(); });
  el.querySelector("#cB").onchange = e => { corrCfg.bench = e.target.checked; run(); };
  run();
}
})();
