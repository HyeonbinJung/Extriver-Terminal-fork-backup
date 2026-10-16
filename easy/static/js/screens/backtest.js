/* BACKTEST — 백테스트 (F5)
   단일 전략 · 전략 비교 · 파라미터 최적화 · 전략 설명.  딥링크: #backtest/AAPL , #backtest/compare/005930.KS , #backtest/optimize/AAPL */
(() => {
"use strict";
const { esc } = FE;

FE.glossary({
  bt_pf: ["손익비 (Profit factor)", "이긴 거래의 총이익 ÷ 진 거래의 총손실. 1보다 크면 벌었고, 1.5 이상이면 양호, 2 이상이면 우수."],
  bt_win: ["승률", "끝난 거래 중 수익으로 마감한 비율. 승률이 낮아도 한 번 벌 때 크게 벌면 수익이 날 수 있어요."],
  bt_exp: ["노출도 (Exposure)", "전체 기간 중 실제로 주식을 들고 있던 날의 비율. 낮을수록 현금으로 쉬는 시간이 많아요."],
  bt_hold: ["평균 보유일", "한 번 사서 팔 때까지 평균 며칠 들고 있었는지 (달력일)."],
  bt_fee: ["수수료·슬리피지", "매수·매도할 때마다 거래 금액의 이 비율만큼 비용이 듭니다. 거래가 잦은 전략일수록 결과에 큰 영향을 줘요."],
  bt_size: ["포지션 크기", "매수 신호 때 자산의 몇 %를 주식에 넣을지. '변동성 목표'는 최근 20일 변동성이 클수록 적게 사서 위험을 일정하게 맞춰요."],
  bt_overfit: ["과최적화", "과거 데이터에 딱 맞춘 파라미터는 미래에 잘 안 맞는 경우가 많아요. 주변 값들도 고르게 좋은 '평평한 고원'을 고르는 것이 안전합니다."],
  bt_bh: ["매수 후 보유 (Buy & Hold)", "처음에 사서 끝까지 들고 있는 가장 단순한 전략. 모든 전략의 비교 기준이에요."],
  bt_dca: ["적립식 매수 (DCA)", "매달 같은 금액으로 사는 방법. 비쌀 때 적게, 쌀 때 많이 사게 되어 평균 단가가 평탄해져요."],
  bt_donchian: ["돈치안 채널", "최근 N일 최고가·최저가로 그린 통로. 최고가를 넘으면 추세 시작으로 보고 사는 '터틀 트레이딩'의 핵심."],
  bt_mom: ["모멘텀", "최근 N일 동안 오른 종목이 계속 오르는 경향. 수익률이 기준보다 높을 때만 보유해요."],
});

const STRATS = {
  buyhold: { name: "매수 후 보유", params: [], desc: `<b>첫날 사서 마지막 날까지 보유</b>합니다. 다른 모든 전략의 기준선이에요. 대부분의 매매 전략은 장기적으로 이 단순한 전략을 이기기 어렵습니다.` },
  sma: { name: "이동평균 교차", params: [["fast", "단기 이동평균 (일)", 20], ["slow", "장기 이동평균 (일)", 60]],
    desc: `<b>단기 이동평균이 장기 이동평균 위에 있으면 보유</b>, 아래로 내려가면 매도(골든·데드 크로스). 큰 추세는 잘 타지만, 횡보장에서는 잦은 '속임수 신호'로 손실이 쌓여요.` },
  rsi: { name: "RSI 역추세", params: [["n", "RSI 기간 (일)", 14], ["lower", "매수 기준 (RSI 미만)", 30], ["upper", "매도 기준 (RSI 초과)", 70]],
    desc: `<b>RSI가 30 아래(과매도)로 떨어지면 매수, 70 위(과매수)로 오르면 매도</b>합니다. 박스권에서 잘 맞지만, 강한 하락 추세에서는 '떨어지는 칼날'을 잡을 위험이 있어요.` },
  bollinger: { name: "볼린저 밴드 평균회귀", params: [["n", "이동평균 기간 (일)", 20], ["k", "표준편차 배수", 2]],
    desc: `<b>종가가 하단 밴드(평균 − k×표준편차) 아래로 내려가면 매수, 중심선(평균) 위로 돌아오면 매도</b>. '너무 많이 떨어지면 평균으로 돌아온다'는 가정의 평균회귀 전략이에요.` },
  macd: { name: "MACD 교차", params: [["fast", "단기 EMA", 12], ["slow", "장기 EMA", 26], ["signal", "시그널 EMA", 9]],
    desc: `<b>MACD선이 시그널선 위에 있으면 보유, 아래로 내려가면 매도</b>. 추세의 방향과 힘을 함께 보는 대표적인 추세 추종 지표예요.` },
  momentum: { name: "모멘텀", params: [["lookback", "수익률 측정 기간 (일)", 90], ["threshold", "기준 수익률 (0.05 = 5%)", 0]],
    desc: `<b>최근 N일 수익률이 기준보다 높을 때만 보유</b>합니다. '오르는 것이 더 오른다'는 시계열 모멘텀으로, 큰 하락장을 피하는 데 도움이 되지만 급반등은 놓치기 쉬워요.` },
  donchian: { name: "돌파 (돈치안 채널)", params: [["entry", "진입: N일 최고가 돌파", 20], ["exit", "청산: M일 최저가 이탈", 10]],
    desc: `<b>종가가 최근 N일 최고가를 넘으면 매수, 최근 M일 최저가 아래로 떨어지면 매도</b>. 전설적인 '터틀 트레이딩'의 규칙으로, 승률은 낮아도 큰 추세 한 번으로 크게 버는 구조예요.` },
  dca: { name: "적립식 매수 (매월)", params: [],
    desc: `<b>초기 자본을 개월 수로 나눠 매달 첫 거래일에 같은 금액만큼 매수</b>합니다. 남은 돈은 현금으로 대기. 한 번에 사는 것(매수 후 보유)보다 수익은 낮을 수 있지만 타이밍 위험을 줄여요.` },
};
const GRID = ["sma", "rsi", "bollinger", "macd", "momentum", "donchian"];
const TABS = [["single", "단일 전략"], ["compare", "전략 비교"], ["optimize", "파라미터 최적화"], ["guide", "전략 설명"]];
const MET = [["sharpe", "샤프"], ["total_return", "총수익"], ["cagr", "CAGR"], ["max_drawdown", "MDD"]];

if (!document.getElementById("backtest-css")) {
  const st = document.createElement("style"); st.id = "backtest-css";
  st.textContent = `
  #scr-backtest .bt-wrap{display:grid;grid-template-columns:300px minmax(0,1fr);gap:8px;align-items:start}
  #scr-backtest .bt-cfg .field{margin-bottom:8px} #scr-backtest .bt-cfg .inp{width:100%}
  #scr-backtest .bt-desc{border-left:3px solid var(--accent);padding:6px 10px;background:var(--bg-raised);font-size:12px;line-height:1.6;color:var(--text-2)}
  #scr-backtest .bt-desc b{color:var(--text)}
  #scr-backtest .bt-pc{height:400px} #scr-backtest .bt-grid td{cursor:pointer;min-width:58px}
  #scr-backtest .bt-grid td:hover{outline:1px solid var(--accent)}
  #scr-backtest .bt-grid td.best{outline:2px solid #fff}
  @media (max-width:1000px){#scr-backtest .bt-wrap{grid-template-columns:1fr}}`;
  document.head.appendChild(st);
}

let root, tab = "single";
const cfg = Object.assign({ symbol: "AAPL", period: "5y", capital: "", fee: 0.1, strategy: "sma", params: {}, size_mode: "fixed", size: 100 }, FE.store.get("backtest.cfg", {}));
const saveCfg = () => FE.store.set("backtest.cfg", cfg);
const isKR = s => /\.(KS|KQ)$/.test(s);
const money = (v, sym) => v == null ? "—" : isKR(sym) ? FE.int(v) : FE.num(v, 2);
const sp = v => `<span class="${FE.cls(v)}">${FE.spct(v)}</span>`;
const pf = v => v == null ? "—" : v >= 99 ? "∞" : FE.num(v);

FE.screen({
  id: "backtest", label: "백테스트", primary: true, order: 5, fkey: "F5", group: "트레이딩",
  desc: "8가지 매매 전략을 과거 데이터로 검증 · 전략 비교 · 파라미터 최적화",
  render(el, arg) {
    root = el;
    const parts = (arg || "").split("/").filter(Boolean);
    if (parts[0] && TABS.some(t => t[0] === parts[0])) { tab = parts.shift(); } else tab = "single";
    if (parts[0]) cfg.symbol = parts[0].toUpperCase();
    shell();
  },
});
FE.command("/bt", "백테스트 (예: /bt 005930.KS)", a => FE.go("backtest", a ? a.toUpperCase() : undefined));

function shell() {
  root.innerHTML = FE.screenHead("BACKTEST", "매매 규칙을 과거 데이터로 검증합니다",
    `<span class="badge c-yellow">과거 성과 ≠ 미래 수익 · 학습용</span>`) + FE.subtabs("btt", TABS, tab) + `<div class="bt-wrap"><div id="btCfg"></div><div id="btOut"></div></div>`;
  FE.onSubtabs(root, "btt", v => { tab = v; history.replaceState(null, "", "#backtest/" + v + "/" + cfg.symbol); drawCfg(); go(); });
  drawCfg(); go();
}

function drawCfg() {
  const el = root.querySelector("#btCfg");
  const st = STRATS[cfg.strategy];
  const showStrat = tab === "single" || tab === "optimize";
  const strats = tab === "optimize" ? GRID : Object.keys(STRATS);
  if (tab === "optimize" && !GRID.includes(cfg.strategy)) cfg.strategy = "sma";
  if (tab === "guide") { el.innerHTML = ""; root.querySelector(".bt-wrap").style.gridTemplateColumns = "1fr"; return; }
  root.querySelector(".bt-wrap").style.gridTemplateColumns = "";
  el.innerHTML = FE.panel({ title: "SETTINGS", bar: true, sub: "백테스트 설정", cls: "bt-cfg", body: `
    ${FE.field("종목 코드", `<input class="inp" id="bSym" list="bSymL" value="${esc(cfg.symbol)}" autocomplete="off" placeholder="AAPL, 005930.KS, BTC-USD"><datalist id="bSymL"></datalist>`)}
    ${FE.field("기간", FE.pills("btp", [["1y", "1년"], ["2y", "2년"], ["5y", "5년"], ["10y", "10년"], ["max", "전체"]], cfg.period))}
    <div class="grid cols-2" style="gap:8px">
      ${FE.field(`초기 자본 (${isKR(cfg.symbol) ? "원" : "달러"})`, `<input class="inp" id="bCap" type="number" min="100" value="${cfg.capital || (isKR(cfg.symbol) ? 10000000 : 10000)}">`)}
      ${FE.field(FE.term("bt_fee", "수수료 (%/회)"), `<input class="inp" id="bFee" type="number" step="0.01" min="0" max="5" value="${cfg.fee}">`)}
    </div>
    ${showStrat ? FE.field("전략", `<select class="inp" id="bStrat">${strats.map(k => `<option value="${k}" ${k === cfg.strategy ? "selected" : ""}>${STRATS[k].name}</option>`).join("")}</select>`) : ""}
    ${showStrat ? `<div class="grid cols-2" style="gap:8px">${st.params.map(([k, l, d]) => FE.field(l, `<input class="inp" data-p="${k}" type="number" step="any" value="${cfg.params[cfg.strategy]?.[k] ?? d}">`)).join("")}</div>` : ""}
    ${cfg.strategy !== "buyhold" && cfg.strategy !== "dca" || tab === "compare" ? `<div class="grid cols-2" style="gap:8px">
      ${FE.field(FE.term("bt_size", "포지션 크기"), `<select class="inp" id="bMode"><option value="fixed" ${cfg.size_mode === "fixed" ? "selected" : ""}>고정 비율</option><option value="voltarget" ${cfg.size_mode === "voltarget" ? "selected" : ""}>변동성 목표</option></select>`)}
      ${FE.field(cfg.size_mode === "fixed" ? "자산 대비 %" : "목표 변동성 %", `<input class="inp" id="bSize" type="number" min="5" max="100" value="${cfg.size}">`)}</div>` : ""}
    <button class="btn solid" id="bRun" style="width:100%;margin-top:4px;padding:7px">▶ ${tab === "compare" ? "전체 전략 비교 실행" : tab === "optimize" ? "격자 최적화 실행" : "백테스트 실행"}</button>
    ${showStrat ? `<div class="bt-desc" style="margin-top:10px">${st.desc}</div>` : `<div class="note" style="margin-top:10px">8개 전략을 각 기본 파라미터로 같은 종목·기간에 돌려 비교합니다.</div>`}
    <div class="note" style="margin-top:8px">신호는 종가 기준으로 계산하고 같은 종가에 체결한다고 가정합니다(미래 데이터 미사용). 세금·배당·공매도는 반영하지 않습니다.</div>` });
  const $ = s => el.querySelector(s);
  FE.onPills(el, "btp", v => { cfg.period = v; });
  $("#bStrat") && ($("#bStrat").onchange = e => { readCfg(); cfg.strategy = e.target.value; saveCfg(); drawCfg(); });
  $("#bMode") && ($("#bMode").onchange = e => { readCfg(); cfg.size_mode = e.target.value; cfg.size = cfg.size_mode === "fixed" ? 100 : 15; drawCfg(); });
  $("#bRun").onclick = () => { readCfg(); go(); };
  let t; $("#bSym").addEventListener("input", () => { clearTimeout(t); const q = $("#bSym").value.trim(); if (q.length < 2) return;
    t = setTimeout(async () => { try { const r = await FE.api("/api/search?q=" + encodeURIComponent(q)); $("#bSymL").innerHTML = (r.results || []).slice(0, 8).map(x => `<option value="${esc(x.symbol)}">${esc(x.name || x.shortname || "")}</option>`).join(""); } catch {} }, 300); });
  $("#bSym").addEventListener("change", () => { const s = $("#bSym").value.trim().toUpperCase(); if (isKR(s) !== isKR(cfg.symbol)) { $("#bCap").value = isKR(s) ? 10000000 : 10000; } });
  $("#bSym").addEventListener("keydown", e => { if (e.key === "Enter") { readCfg(); go(); } });
}
function readCfg() {
  const $ = s => root.querySelector(s);
  const prevKR = isKR(cfg.symbol);
  cfg.symbol = ($("#bSym")?.value || cfg.symbol).trim().toUpperCase();
  cfg.capital = +$("#bCap")?.value || "";
  if (isKR(cfg.symbol) !== prevKR && cfg.capital && ((isKR(cfg.symbol) && cfg.capital < 100000) || (!isKR(cfg.symbol) && cfg.capital >= 10000000))) cfg.capital = "";
  cfg.fee = +$("#bFee")?.value || 0;
  const ps = {}; root.querySelectorAll("[data-p]").forEach(i => ps[i.dataset.p] = +i.value);
  if (Object.keys(ps).length) cfg.params[cfg.strategy] = ps;
  if ($("#bMode")) { cfg.size_mode = $("#bMode").value; cfg.size = +$("#bSize").value || 100; }
  saveCfg();
}
const req = extra => ({ symbol: cfg.symbol, period: cfg.period, capital: cfg.capital || undefined, fee: cfg.fee, strategy: cfg.strategy,
  params: cfg.params[cfg.strategy] || {}, size_mode: cfg.size_mode, size: cfg.size / 100, ...extra });

function go() { ({ single, compare, optimize: optim, guide })[tab](); }

/* ------------------------------------------------------------- single */
async function single() {
  const out = root.querySelector("#btOut"); FE.loading(out, `${cfg.symbol} · ${STRATS[cfg.strategy].name} 백테스트 중…`);
  let d; try { d = await FE.api("/api/backtest/run", req()); } catch (e) { return FE.error(out, e); }
  if (tab !== "single") return;
  const m = d.metrics, b = d.bh_metrics, S = d.symbol;
  const ex = m.total_return - b.total_return;
  out.innerHTML = `
  ${FE.stats([
    { l: FE.term("total", "총수익"), v: FE.spct(m.total_return), vcls: FE.cls(m.total_return), d: `보유 시 ${FE.spct(b.total_return)}` },
    { l: FE.term("cagr", "CAGR"), v: FE.spct(m.cagr), vcls: FE.cls(m.cagr), d: `보유 ${FE.spct(b.cagr)}` },
    { l: FE.term("vol", "변동성"), v: FE.pct(m.volatility), vcls: "c-white", d: `보유 ${FE.pct(b.volatility)}` },
    { l: FE.term("sharpe", "샤프"), v: FE.num(m.sharpe), vcls: "c-cyan", d: `보유 ${FE.num(b.sharpe)}` },
    { l: FE.term("sortino", "소르티노"), v: FE.num(m.sortino), vcls: "c-cyan", d: `보유 ${FE.num(b.sortino)}` },
    { l: FE.term("mdd", "MDD"), v: FE.pct(m.max_drawdown), vcls: "neg", d: `보유 ${FE.pct(b.max_drawdown)}` },
  ])}
  ${FE.stats([
    { l: FE.term("bt_win", "승률"), v: FE.pct(m.win_rate, 1), vcls: "sm c-white" }, { l: "거래 수", v: FE.int(m.trades), vcls: "sm c-white" },
    { l: FE.term("bt_hold", "평균 보유일"), v: m.avg_hold == null ? "—" : FE.num(m.avg_hold, 1) + "일", vcls: "sm c-white" },
    { l: FE.term("bt_pf", "손익비"), v: pf(m.profit_factor), vcls: "sm " + (m.profit_factor >= 1 ? "pos" : "neg") },
    { l: FE.term("bt_exp", "노출도"), v: FE.pct(m.exposure, 1), vcls: "sm c-white" },
    { l: "최종 자산", v: money(m.final, S), vcls: "sm c-orange", d: `초기 ${money(d.capital, S)} ${d.currency}` },
    { l: "보유 대비", v: FE.spct(ex), vcls: "sm " + FE.cls(ex), d: ex >= 0 ? "매수 후 보유보다 나음" : "매수 후 보유보다 못함" },
  ])}
  ${FE.panel({ title: `${esc(S)} · ${esc(d.strategy_name)}`, bar: true, sub: `${Object.entries(d.params).map(([k, v]) => `${k}=${v}`).join(" · ") || "파라미터 없음"} · ▲B 매수 ▼S 매도`, body: `<div id="btPc" class="bt-pc"></div>${d.indicator ? `<div class="chart sm" style="margin-top:6px"><canvas id="btInd"></canvas></div>` : ""}` })}
  <div class="grid cols-2">
    ${FE.panel({ title: "EQUITY CURVE", bar: true, sub: `전략 vs ${FE.term("bt_bh", "매수 후 보유")} (${d.currency})`, body: `<div class="chart md"><canvas id="btEq"></canvas></div>` })}
    ${FE.panel({ title: "DRAWDOWN", bar: true, color: "red", sub: "고점 대비 하락률", body: `<div class="chart md"><canvas id="btDD"></canvas></div>` })}
  </div>
  ${FE.panel({ title: "MONTHLY RETURNS", bar: true, sub: "월별 수익률 (%)", flush: true, body: monthly(d.monthly) })}
  ${FE.panel({ title: "TRADES", bar: true, color: "cyan", sub: `${d.trades.length}건${d.dca ? ` · 매월 ${money(d.dca.monthly, S)} × ${d.dca.months}회 · 평균 단가 ${money(d.dca.avg_price, S)}` : ""}`, flush: true, body: FE.table([
    { k: "entry_date", l: "매수일", a: "l" }, { k: "entry", l: "매수가", f: v => money(v, S) },
    { k: "exit_date", l: "매도일", a: "l", f: v => v || `<span class="c-yellow">보유 중</span>` }, { k: "last", l: "매도가/현재가", f: v => money(v, S) },
    { k: "days", l: "보유일" }, { k: "size", l: "비중", f: v => FE.pct(v, 0) },
    { k: "ret", l: "수익률", f: sp }, { k: "pnl", l: `손익 (${d.currency})`, f: v => `<span class="${FE.cls(v)}">${v > 0 ? "+" : ""}${money(v, S)}</span>` }],
    d.trades.slice().reverse(), { maxH: "360px", empty: "기간 중 매매 신호가 없었습니다." }) })}
  <div class="note">※ 과거 결과는 미래 수익을 보장하지 않습니다. 수수료 ${FE.num(d.fee * 100, 2)}%/회 반영, 세금·배당·호가 차이는 미반영. 학습용 시뮬레이션입니다.</div>`;
  FE.priceChart(out.querySelector("#btPc"), { candles: d.candles, overlays: d.overlays, markers: d.markers.length > 400 ? d.markers.slice(-400) : d.markers, height: 400 });
  if (d.indicator) {
    const I = d.indicator;
    const ds = I.lines.map(l => FE.line(l.name, l.data, l.color));
    I.levels.forEach(v => ds.push(FE.line("", d.dates.map(() => v), FE.color.text3, { borderDash: [3, 3], borderWidth: 1 })));
    if (I.hist) ds.push({ type: "bar", label: "히스토그램", data: I.hist, backgroundColor: I.hist.map(v => v >= 0 ? "rgba(22,163,74,.5)" : "rgba(220,38,38,.5)"), barPercentage: 1, categoryPercentage: 1 });
    FE.chart("btInd", { type: "line", data: { labels: d.dates, datasets: ds }, options: FE.chartOpts({ legend: false, plugins: { title: { display: true, text: I.name, color: FE.color.text2, align: "start", font: { size: 11 } } } }) });
  }
  FE.chart("btEq", { type: "line", data: { labels: d.dates, datasets: [FE.line(STRATS[d.strategy].name, d.equity, FE.color.accent, { borderWidth: 2 }), FE.line("매수 후 보유", d.bh, FE.color.text2, { borderDash: [4, 3] })] }, options: FE.chartOpts({ legend: true, yFmt: v => FE.big(v, 1) }) });
  FE.chart("btDD", { type: "line", data: { labels: d.dates, datasets: [FE.line(STRATS[d.strategy].name, d.drawdown.map(v => v * 100), FE.color.neg, { fill: { target: "origin", below: "rgba(220,38,38,.18)" } }), FE.line("매수 후 보유", d.bh_drawdown.map(v => v * 100), FE.color.text2, { borderDash: [4, 3] })] }, options: FE.chartOpts({ legend: true, yFmt: v => v.toFixed(0) + "%" }) });
  FE.status(`백테스트 ${S} ${d.strategy_name}: 총수익 ${FE.spct(m.total_return)} · 샤프 ${FE.num(m.sharpe)}`);
}
function monthly(rows) {
  const M = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  return `<div class="tbl-wrap"><table class="tbl heat"><thead><tr><th class="l">연도</th>${M.map(m => `<th class="c">${m}</th>`).join("")}<th class="c">연간</th></tr></thead><tbody>${
    rows.map(r => `<tr><td class="l c-white">${r.year}</td>${r.months.map(v => `<td style="${FE.heat(v, 0.1)}">${v == null ? "" : (v * 100).toFixed(1)}</td>`).join("")}<td style="${FE.heat(r.total, 0.4)}">${r.total == null ? "" : (r.total * 100).toFixed(1)}</td></tr>`).join("")}</tbody></table></div>`;
}

/* ------------------------------------------------------------- compare */
async function compare() {
  const out = root.querySelector("#btOut"); FE.loading(out, `${cfg.symbol}: 8개 전략 비교 중…`);
  let d; try { d = await FE.api("/api/backtest/compare", req()); } catch (e) { return FE.error(out, e); }
  if (tab !== "compare") return;
  const rows = d.rows.slice();
  const best = rows.reduce((a, r) => (r.sharpe ?? -9) > (a.sharpe ?? -9) ? r : a, rows[0]);
  out.innerHTML = FE.panel({ title: `STRATEGY COMPARISON · ${esc(d.symbol)}`, bar: true, sub: `기간 ${esc(d.period)} · 샤프 최고: ${esc(best.name)} · 행 클릭 → 단일 전략으로 자세히`, flush: true, bodyId: "cmpT" }) +
    FE.panel({ title: "EQUITY CURVES", bar: true, sub: "초기 자본 = 100", body: `<div class="chart lg"><canvas id="cmpC"></canvas></div>` }) +
    `<div class="note">※ 모두 기본 파라미터입니다. 같은 기간·같은 종목에서 가장 좋았던 전략이 다른 기간에도 좋다는 보장은 없어요.</div>`;
  const cols = [
    { k: "name", l: "전략", a: "l", f: (v, r) => `<b style="color:${FE.palette[Object.keys(STRATS).indexOf(r.strategy)]}">■</b> <b class="c-white">${esc(v)}</b>` },
    { k: "total_return", l: "총수익", sort: true, f: sp }, { k: "cagr", l: "CAGR", sort: true, f: sp },
    { k: "volatility", l: "변동성", sort: true, f: v => FE.pct(v) }, { k: "sharpe", l: FE.term("sharpe", "샤프"), sort: true, f: v => `<b class="c-cyan">${FE.num(v)}</b>` },
    { k: "sortino", l: "소르티노", sort: true, f: v => FE.num(v) }, { k: "max_drawdown", l: "MDD", sort: true, f: v => `<span class="neg">${FE.pct(v)}</span>` },
    { k: "win_rate", l: FE.term("bt_win", "승률"), sort: true, f: v => FE.pct(v, 0) }, { k: "trades", l: "거래", sort: true },
    { k: "profit_factor", l: FE.term("bt_pf", "손익비"), sort: true, f: pf }, { k: "exposure", l: FE.term("bt_exp", "노출"), sort: true, f: v => FE.pct(v, 0) }];
  const el = out.querySelector("#cmpT");
  const draw = rs => { el.innerHTML = FE.table(cols, rs, { rowCls: r => "click" + (r === best ? " sel" : ""), rowAttr: r => `data-s="${r.strategy}"` }); FE.sortable(el, rs, draw);
    el.querySelectorAll("[data-s]").forEach(tr => tr.onclick = () => { cfg.strategy = tr.dataset.s; saveCfg(); tab = "single"; shell(); }); };
  draw(rows);
  FE.chart("cmpC", { type: "line", data: { labels: d.dates, datasets: Object.keys(d.curves).map((k, i) => FE.line(STRATS[k].name, d.curves[k], FE.palette[i], { borderWidth: k === "buyhold" ? 2.2 : 1.3, ...(k === "buyhold" ? { borderDash: [5, 3] } : {}) })) }, options: FE.chartOpts({ legend: true, yFmt: v => v.toFixed(0) }) });
}

/* ------------------------------------------------------------- optimize */
let optMetric = "sharpe";
async function optim() {
  const out = root.querySelector("#btOut"); FE.loading(out, `${cfg.symbol} · ${STRATS[cfg.strategy].name} 파라미터 격자 계산 중…`);
  let d; try { d = await FE.api("/api/backtest/optimize", req()); } catch (e) { return FE.error(out, e); }
  if (tab !== "optimize") return;
  const lab = k => (STRATS[d.strategy].params.find(p => p[0] === k) || [k, k])[1];
  out.innerHTML = FE.panel({ title: `PARAMETER GRID · ${esc(d.symbol)} · ${esc(STRATS[d.strategy].name)}`, bar: true, sub: `세로: ${esc(lab(d.y.key))} · 가로: ${esc(lab(d.x.key))} · 셀 클릭 → 그 값으로 백테스트`,
    acts: FE.pills("btm", MET, optMetric), flush: true, bodyId: "gridT" }) +
    `<div class="note">⚠ ${FE.term("bt_overfit", "과최적화 주의")}: ${esc(d.note)} 흰 테두리 = 현재 지표 기준 최고값.</div>`;
  const draw = () => {
    const vals = d.cells.flat().filter(Boolean).map(c => c[optMetric]).filter(v => v != null);
    const lower = optMetric === "max_drawdown";
    const bestV = lower ? Math.max(...vals) : Math.max(...vals);
    const mid = vals.slice().sort((a, b) => a - b)[Math.floor(vals.length / 2)];
    const span = Math.max(...vals.map(v => Math.abs(v - mid))) || 1;
    const fmt = v => optMetric === "sharpe" ? FE.num(v) : FE.spct(v, 1);
    out.querySelector("#gridT").innerHTML = `<div class="tbl-wrap"><table class="tbl heat bt-grid"><thead><tr><th class="l">${esc(lab(d.y.key))} \\ ${esc(lab(d.x.key))}</th>${d.x.values.map(v => `<th class="c">${v}</th>`).join("")}</tr></thead><tbody>${
      d.cells.map((row, i) => `<tr><th class="l" style="position:static">${d.y.values[i]}</th>${row.map((c, j) => c ? `<td class="${c[optMetric] === bestV ? "best" : ""}" style="${FE.heat(c[optMetric] - mid, span)};color:#fff" data-x="${d.x.values[j]}" data-y="${d.y.values[i]}" data-tip-title="${esc(lab(d.x.key))} ${d.x.values[j]} · ${esc(lab(d.y.key))} ${d.y.values[i]}" data-tip="샤프 ${FE.num(c.sharpe)} · 총수익 ${FE.spct(c.total_return)} · MDD ${FE.pct(c.max_drawdown)} · 거래 ${c.trades}회 · 승률 ${FE.pct(c.win_rate, 0)}">${fmt(c[optMetric])}</td>` : `<td class="c-dim">—</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    out.querySelectorAll("td[data-x]").forEach(td => td.onclick = () => {
      const ps = Object.assign({}, d.base, { [d.x.key]: +td.dataset.x, [d.y.key]: +td.dataset.y });
      cfg.params[d.strategy] = ps; cfg.strategy = d.strategy; saveCfg(); tab = "single"; shell();
      FE.toast(`${lab(d.x.key)}=${td.dataset.x}, ${lab(d.y.key)}=${td.dataset.y} 적용`);
    });
  };
  draw();
  FE.onPills(out, "btm", v => { optMetric = v; draw(); });
}

/* ------------------------------------------------------------- guide */
function guide() {
  root.querySelector("#btOut").innerHTML = `<div class="grid cols-2">${Object.entries(STRATS).map(([k, s], i) => FE.panel({ title: esc(s.name), color: ["orange", "cyan", "purple", "yellow", "blue", "green", "red", "magenta"][i], bar: true,
    acts: `<button class="btn" data-try="${k}">▶ 이 전략 실행</button>`,
    body: `<div class="bt-desc">${s.desc}</div>${s.params.length ? `<div class="note" style="margin-top:6px">파라미터: ${s.params.map(p => `${esc(p[1])} = <b>${p[2]}</b>`).join(" · ")}</div>` : ""}` })).join("")}</div>
    ${FE.panel({ title: "백테스트를 읽는 법", bar: true, body: `<div class="note">
      · <b>${FE.term("total", "총수익")}과 ${FE.term("cagr", "CAGR")}</b>만 보지 말고 <b>${FE.term("mdd", "최대 낙폭")}</b>을 꼭 같이 보세요. 50% 떨어지면 원금 회복에 100% 상승이 필요합니다.<br>
      · <b>${FE.term("sharpe", "샤프")}</b>는 위험 대비 효율입니다. 수익이 조금 낮아도 샤프가 높으면 더 '편한' 전략이에요.<br>
      · <b>거래 수</b>가 너무 적으면(10회 미만) 운일 수 있습니다. <b>${FE.term("bt_fee", "수수료")}</b>를 0.2~0.3%로 올려도 살아남는지 확인하세요.<br>
      · 같은 데이터로 파라미터를 고르면 결과가 부풀려집니다(${FE.term("bt_overfit", "과최적화")}). 기간을 바꿔(예: 5년에서 고르고 10년으로 검증) 확인해 보세요.<br>
      · <b>과거 성과는 미래 수익을 보장하지 않습니다.</b> 이 화면은 학습용 시뮬레이션입니다.</div>` })}`;
  root.querySelectorAll("[data-try]").forEach(b => b.onclick = () => { cfg.strategy = b.dataset.try; saveCfg(); tab = "single"; shell(); });
}
})();
