/* QUANT LAB — 퀀트 랩
   몬테카를로 · 수익률 분포 · 계절성 · CAPM 회귀 · 롤링 지표 · 페어 분석 · 팩터 노출.
   딥링크: #quant/<module>/<symbol>  (예: #quant/capm/NVDA, #quant/pairs/KO,PEP) */
(() => {
"use strict";
const { esc } = FE;

FE.glossary({
  q_mc: ["몬테카를로 시뮬레이션", "과거 수익률의 평균·변동성으로 수천 개의 가상 미래 주가 경로를 만들어 '가능한 결과의 범위'를 봅니다. 예측이 아니라 확률 분포예요."],
  q_gbm: ["기하 브라운 운동 (GBM)", "주가의 로그 수익률이 정규분포를 따른다고 가정하는 표준 모형. 블랙-숄즈 옵션 공식의 기반이에요."],
  q_boot: ["부트스트랩", "과거 실제 일간 수익률을 무작위로 다시 뽑아 경로를 만드는 방법. 실제 분포의 두꺼운 꼬리가 반영돼요."],
  q_drift: ["기대수익률 (드리프트)", "시뮬레이션에 넣는 연간 평균 상승률. 과거 수익률을 그대로 쓰면 최근 급등주는 미래도 급등한다고 가정하게 되니 주의하세요. '0'은 기대 가격 = 현재가."],
  q_band: ["백분위 밴드", "5%~95% 밴드 안에 시뮬레이션 경로의 90%가 들어 있어요. 가운데 선은 중앙값(50%)."],
  q_skew: ["왜도 (Skewness)", "분포가 한쪽으로 치우친 정도. 음수면 '가끔 크게 떨어지는' 왼쪽 꼬리가 길어요. 주식은 보통 음수."],
  q_kurt: ["첨도 (초과 첨도)", "정규분포(0)보다 꼬리가 얼마나 두꺼운지. 양수면 극단적인 날이 정규분포 예상보다 자주 와요."],
  q_jb: ["자크-베라 검정", "왜도·첨도로 '수익률이 정규분포인가'를 검정. p값이 0.05보다 작으면 정규분포가 아니라고 봐요(대부분의 주식이 그렇습니다)."],
  q_qq: ["Q-Q 플롯", "실제 수익률(세로)을 정규분포 이론값(가로)과 비교. 점들이 대각선을 벗어나 양 끝에서 휘면 꼬리가 두껍다는 뜻."],
  q_season: ["계절성", "특정 달이나 요일에 수익률이 반복적으로 좋거나 나쁜 경향. 표본이 적어 우연일 가능성이 커요."],
  q_tom: ["월말·월초 효과", "매달 마지막 거래일~첫 3거래일 수익률이 나머지 날보다 높다는 오래된 이상현상."],
  q_r2: ["결정계수 (R²)", "종목 수익률 변동 중 시장(또는 팩터)으로 설명되는 비율. 0.7이면 70%가 시장 움직임."],
  q_t: ["t값", "추정치가 0과 통계적으로 다른지. 절대값 2(≈1.96) 이상이면 95% 신뢰수준에서 '우연이 아니다'라고 봐요."],
  q_treynor: ["트레이너 비율", "(수익률 − 무위험 이자율) ÷ 베타. 시장 위험 한 단위당 초과수익."],
  q_resid: ["고유 변동성", "시장으로 설명되지 않는 종목 고유의 출렁임. 분산투자로 줄일 수 있는 위험이에요."],
  q_hedge: ["헤지 비율", "A 1단위와 함께 B를 몇 단위 반대로 잡아야 시장 노출이 상쇄되는지 (로그 가격 회귀 기울기)."],
  q_z: ["스프레드 z-score", "두 종목 가격 관계(스프레드)가 평소(최근 N일 평균)보다 표준편차 몇 배 벌어졌는지. ±2를 넘으면 평균으로 돌아올 것에 베팅하는 게 페어 트레이딩."],
  q_coint: ["공적분", "두 가격이 따로 움직이는 듯해도 장기적으로 일정한 관계로 묶여 있는 성질. 스프레드의 ADF t값이 임계값(5%: −3.34)보다 작으면 공적분으로 봐요."],
  q_hl: ["반감기", "스프레드가 벌어졌을 때 절반만큼 되돌아오는 데 걸리는 평균 거래일 수. 짧을수록 페어 트레이딩에 유리."],
  q_factor: ["팩터 노출", "종목 수익률을 시장·규모·가치·모멘텀 같은 공통 요인으로 분해했을 때 각 요인에 대한 민감도(베타)."],
  q_roll: ["롤링 지표", "최근 N일 창을 하루씩 옮겨가며 다시 계산한 값. 위험이 시간에 따라 어떻게 바뀌는지 보여줘요."],
});

const MODS = [["montecarlo", "몬테카를로"], ["distribution", "수익률 분포"], ["seasonality", "계절성"], ["capm", "CAPM 회귀"], ["rolling", "롤링 지표"], ["pairs", "페어 분석"], ["factors", "팩터 노출"]];
const PER = { montecarlo: "2y", distribution: "5y", seasonality: "10y", capm: "2y", rolling: "5y", pairs: "2y", factors: "5y" };
const PERS = [["1y", "1년"], ["2y", "2년"], ["5y", "5년"], ["10y", "10년"], ["max", "전체"]];
const st = Object.assign({ mod: "montecarlo", sym: "AAPL", a: "KO", b: "PEP", per: {}, days: 252, sims: 2000, model: "gbm", drift: "hist", mu: 7, target: "", freq: "d", window: 60, bench: "", entry: 2, ffreq: "w" }, FE.store.get("quant.cfg", {}));
const save = () => FE.store.set("quant.cfg", st);
let root;
const sp = v => `<span class="${FE.cls(v)}">${FE.spct(v)}</span>`;
const pr = (v, s) => v == null ? "—" : /\.(KS|KQ)$/.test(s) ? FE.int(v) : FE.price(v);

if (!document.getElementById("quant-css")) {
  const c = document.createElement("style"); c.id = "quant-css";
  c.textContent = `#scr-quant .q-ctl{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  #scr-quant .q-ctl .lbl{color:var(--text-2);font-size:12px} #scr-quant .q-big{font-size:26px;font-weight:700}
  #scr-quant .q-verdict{border-left:3px solid var(--accent);background:var(--bg-raised);padding:8px 12px;line-height:1.7}
  #scr-quant .q-verdict b{color:var(--text)} #scr-quant .q-fb .r{display:grid;grid-template-columns:120px 1fr 80px;gap:8px;align-items:center;padding:3px 0}
  #scr-quant .q-fb .bk{height:12px;background:var(--border-dim);position:relative} #scr-quant .q-fb .bk i{position:absolute;top:0;bottom:0}
  #scr-quant .q-fb .bk .z{position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:var(--text-3)}`;
  document.head.appendChild(c);
}

FE.screen({
  id: "quant", label: "퀀트 랩", primary: true, order: 13, group: "AI·퀀트",
  desc: "몬테카를로 · 수익률 분포 · 계절성 · CAPM · 롤링 지표 · 페어 분석 · 팩터 노출",
  render(el, arg) {
    root = el;
    const [m, s] = (arg || "").split("/");
    if (MODS.some(x => x[0] === m)) st.mod = m;
    if (s) { if (st.mod === "pairs" && s.includes(",")) { [st.a, st.b] = s.toUpperCase().split(","); } else st.sym = s.toUpperCase(); }
    shell();
  },
});
FE.command("/quant", "퀀트 랩 (예: /quant capm NVDA)", a => { const [m, s] = (a || "").split(/\s+/); FE.go("quant", [m, s].filter(Boolean).join("/") || undefined); });

function shell() {
  root.innerHTML = FE.screenHead("QUANT LAB", "통계로 보는 종목 · 학습용 계량 분석 도구", `<span class="badge c-yellow">확률 ≠ 예측 · 학습용</span>`) +
    FE.subtabs("qm", MODS, st.mod) + `<div id="qCtl"></div><div id="qOut"></div>`;
  FE.onSubtabs(root, "qm", v => { st.mod = v; save(); history.replaceState(null, "", "#quant/" + v); ctl(); run(); });
  ctl(); run();
}

function ctl() {
  const m = st.mod, per = st.per[m] || PER[m];
  const symIn = m === "pairs" ? `<span class="lbl">종목 A</span><input class="inp" id="qA" value="${esc(st.a)}" style="width:110px"><span class="lbl">종목 B</span><input class="inp" id="qB" value="${esc(st.b)}" style="width:110px">`
    : `<span class="lbl">종목</span><input class="inp" id="qSym" list="qSymL" value="${esc(st.sym)}" style="width:130px" autocomplete="off"><datalist id="qSymL"></datalist>`;
  const extra = {
    montecarlo: `<span class="lbl">기간(거래일)</span>${FE.pills("qd", [[21, "1개월"], [63, "3개월"], [126, "6개월"], [252, "1년"], [756, "3년"]], st.days)}
      <span class="lbl">경로 수</span><select class="inp" id="qSims">${[500, 1000, 2000, 5000].map(v => `<option ${v == st.sims ? "selected" : ""}>${v}</option>`).join("")}</select>
      <span class="lbl">${FE.term("q_gbm", "모형")}</span>${FE.pills("qmo", [["gbm", "GBM"], ["bootstrap", "부트스트랩"]], st.model)}
      <span class="lbl">${FE.term("q_drift", "기대수익률")}</span><select class="inp" id="qDrift"><option value="hist" ${st.drift === "hist" ? "selected" : ""}>과거 평균</option><option value="zero" ${st.drift === "zero" ? "selected" : ""}>0 (중립)</option><option value="custom" ${st.drift === "custom" ? "selected" : ""}>직접 입력</option></select>
      <input class="inp" id="qMu" type="number" step="1" value="${st.mu}" style="width:60px" ${st.drift !== "custom" ? "hidden" : ""} title="연 기대수익률 %">
      <span class="lbl">목표가</span><input class="inp" id="qTgt" type="number" step="any" value="${esc(st.target)}" placeholder="현재가 +10%" style="width:110px">`,
    distribution: `<span class="lbl">빈도</span>${FE.pills("qf", [["d", "일간"], ["w", "주간"], ["m", "월간"]], st.freq)}`,
    capm: `<span class="lbl">벤치마크</span><input class="inp" id="qBench" value="${esc(st.bench)}" placeholder="자동 (SPY/코스피)" style="width:130px"><span class="lbl">빈도</span>${FE.pills("qf", [["d", "일간"], ["w", "주간"]], st.freq === "m" ? "d" : st.freq)}`,
    rolling: `<span class="lbl">벤치마크</span><input class="inp" id="qBench" value="${esc(st.bench)}" placeholder="자동" style="width:110px"><span class="lbl">${FE.term("q_roll", "창")}</span>${FE.pills("qw", [[20, "20일"], [60, "60일"], [120, "120일"], [252, "252일"]], st.window)}`,
    pairs: `<span class="lbl">z 기간</span>${FE.pills("qw", [[20, "20일"], [60, "60일"], [120, "120일"]], st.window)}<span class="lbl">진입 |z|</span><input class="inp" id="qEnt" type="number" step="0.5" min="0.5" max="4" value="${st.entry}" style="width:60px">`,
    factors: `<span class="lbl">빈도</span>${FE.pills("qff", [["d", "일간"], ["w", "주간"]], st.ffreq)}`,
    seasonality: "",
  }[m];
  root.querySelector("#qCtl").innerHTML = FE.panel({ body: `<div class="q-ctl">${symIn}<span class="lbl">데이터 기간</span>${FE.pills("qp", PERS, per)}${extra}<span class="spacer"></span><button class="btn solid" id="qRun">▶ 분석</button></div>` });
  const c = root.querySelector("#qCtl");
  FE.onPills(c, "qp", v => { st.per[m] = v; run(); });
  FE.onPills(c, "qd", v => { st.days = +v; run(); });
  FE.onPills(c, "qmo", v => { st.model = v; run(); });
  FE.onPills(c, "qf", v => { st.freq = v; run(); });
  FE.onPills(c, "qff", v => { st.ffreq = v; run(); });
  FE.onPills(c, "qw", v => { st.window = +v; run(); });
  const dr = c.querySelector("#qDrift"); if (dr) dr.onchange = () => { st.drift = dr.value; c.querySelector("#qMu").hidden = dr.value !== "custom"; run(); };
  c.querySelector("#qRun").onclick = run;
  c.querySelectorAll("input.inp").forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") run(); }));
  const si = c.querySelector("#qSym");
  if (si) { let t; si.addEventListener("input", () => { clearTimeout(t); const q = si.value.trim(); if (q.length < 2) return; t = setTimeout(async () => { try { const r = await FE.api("/api/search?q=" + encodeURIComponent(q)); c.querySelector("#qSymL").innerHTML = (r.results || []).slice(0, 8).map(x => `<option value="${esc(x.symbol)}">${esc(x.name || x.shortname || "")}</option>`).join(""); } catch {} }, 300); }); }
}
function read() {
  const c = root.querySelector("#qCtl"), v = s => c.querySelector(s)?.value?.trim();
  if (c.querySelector("#qSym")) { const ns = v("#qSym").toUpperCase(); if (ns !== st.sym) st.target = ""; st.sym = ns; }
  if (c.querySelector("#qA")) { st.a = v("#qA").toUpperCase(); st.b = v("#qB").toUpperCase(); }
  if (c.querySelector("#qSims")) st.sims = +v("#qSims");
  if (c.querySelector("#qMu")) st.mu = +v("#qMu") || 0;
  if (c.querySelector("#qTgt")) st.target = v("#qTgt");
  if (c.querySelector("#qBench")) st.bench = v("#qBench").toUpperCase();
  if (c.querySelector("#qEnt")) st.entry = +v("#qEnt") || 2;
  save();
}
async function run() {
  read();
  const m = st.mod, out = root.querySelector("#qOut"), period = st.per[m] || PER[m];
  const q = {
    montecarlo: { symbol: st.sym, period, days: st.days, sims: st.sims, model: st.model, drift: st.drift, mu: st.mu / 100, target: st.target },
    distribution: { symbol: st.sym, period, freq: st.freq },
    seasonality: { symbol: st.sym, period },
    capm: { symbol: st.sym, period, bench: st.bench, freq: st.freq === "m" ? "d" : st.freq },
    rolling: { symbol: st.sym, period, bench: st.bench, window: st.window },
    pairs: { a: st.a, b: st.b, period, window: st.window, entry: st.entry },
    factors: { symbol: st.sym, period, freq: st.ffreq },
  }[m];
  FE.loading(out, `${MODS.find(x => x[0] === m)[1]} 계산 중…`);
  let d; try { d = await FE.api(`/api/quant/${m}?` + FE.qs(q)); } catch (e) { return FE.error(out, e); }
  if (st.mod !== m) return;
  ({ montecarlo: mc, distribution: dist, seasonality: season, capm, rolling, pairs, factors })[m](out, d);
}

/* ------------------------------------------------------------- Monte Carlo */
function mc(out, d) {
  const t = d.terminal, S = d.symbol;
  if (!st.target) root.querySelector("#qTgt").placeholder = pr(d.target, S);
  out.innerHTML = `${FE.stats([
    { l: "현재가", v: pr(d.s0, S), vcls: "c-white" },
    { l: `중앙값 (${d.days}일 후)`, v: pr(t.median, S), vcls: FE.cls(t.median - d.s0), d: FE.spct(t.median / d.s0 - 1) },
    { l: "90% 범위", v: `${pr(t.p5, S)} ~ ${pr(t.p95, S)}`, vcls: "sm c-cyan" },
    { l: "상승 확률", v: FE.pct(t.prob_up, 1), vcls: "c-orange" },
    { l: `목표가 ${pr(d.target, S)} 이상`, v: FE.pct(t.prob_above_target, 1), vcls: "c-orange", d: `기간 중 한 번이라도 도달 ${FE.pct(t.prob_touch_target, 1)}` },
    { l: "20% 이상 손실", v: FE.pct(t.prob_loss_20, 1), vcls: "neg" },
    { l: "중앙 최대낙폭", v: FE.pct(t.median_mdd, 1), vcls: "neg" },
  ])}
  <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
    ${FE.panel({ title: "PRICE FAN CHART", bar: true, sub: `${FE.term("q_mc", "몬테카를로")} · ${d.sims}개 경로 · ${FE.term("q_band", "5/25/50/75/95% 밴드")}`, body: `<div class="chart lg"><canvas id="qFan"></canvas></div>` })}
    ${FE.panel({ title: "TERMINAL DISTRIBUTION", bar: true, color: "cyan", sub: "만기 가격 분포", body: `<div class="chart lg"><canvas id="qTerm"></canvas></div>` })}
  </div>
  <div class="q-verdict note">모형: <b>${d.model === "gbm" ? "GBM (정규분포 가정)" : "부트스트랩 (과거 일간 수익률 재표본)"}</b> · 입력 연 수익률 <b>${FE.spct(d.mu_annual)}</b> (로그), 연 변동성 <b>${FE.pct(d.sigma_annual)}</b> · 드리프트: <b>${{ hist: "과거 평균", zero: "0 (중립)", custom: "직접 입력" }[d.drift]}</b><br>
  해석: ${d.days}거래일 뒤 ${esc(S)}의 가격은 90% 확률로 <b>${pr(t.p5, S)} ~ ${pr(t.p95, S)}</b> 사이(모형 가정이 맞다면). ${d.drift === "hist" && d.mu_annual > 0.3 ? `<span class="c-yellow">⚠ 과거 수익률이 매우 높아(${FE.spct(d.mu_annual)}) 낙관적으로 나옵니다. 기대수익률을 '0 (중립)'으로 바꿔 비교해 보세요.</span>` : ""}<br>
  ※ 실제 주가는 급락·추세 변화가 있어 이 범위를 벗어날 수 있습니다. 미래 예측이 아닌 위험 범위 학습용입니다.</div>`;
  const H = d.history.dates.length, futN = d.days + 1;
  const last = new Date(d.history.dates[H - 1]); const fut = [];
  for (let i = 0, k = 0; k < futN; i++) { const x = new Date(last); x.setDate(x.getDate() + Math.round(i * 7 / 5)); fut.push(k === 0 ? d.history.dates[H - 1] : x.toISOString().slice(0, 10)); k++; }
  const labels = [...d.history.dates.slice(0, -1), ...fut];
  const pad = a => [...Array(H - 1).fill(null), ...a];
  const P = d.percentiles;
  const ds = [FE.line("과거 가격", [...d.history.close, ...Array(futN - 1).fill(null)], FE.color.text, { borderWidth: 1.6 })];
  d.sample_paths.slice(0, 20).forEach(p => ds.push(FE.line("", pad(p), "rgba(128,128,128,.18)", { borderWidth: .7 })));
  ds.push(FE.line("95%", pad(P["95"]), "rgba(8,145,178,.6)", { fill: false, borderWidth: 1 }), FE.line("5%", pad(P["5"]), "rgba(8,145,178,.6)", { fill: "-1", backgroundColor: "rgba(8,145,178,.10)", borderWidth: 1 }),
    FE.line("75%", pad(P["75"]), "rgba(217,119,6,.6)", { borderWidth: 1 }), FE.line("25%", pad(P["25"]), "rgba(217,119,6,.6)", { fill: "-1", backgroundColor: "rgba(217,119,6,.15)", borderWidth: 1 }),
    FE.line("중앙값", pad(P["50"]), FE.color.accent, { borderWidth: 2.2 }), FE.line("목표가", labels.map(() => d.target), FE.color.pos, { borderDash: [5, 4], borderWidth: 1 }));
  FE.chart("qFan", { type: "line", data: { labels, datasets: ds }, options: FE.chartOpts({ legend: false, yFmt: v => FE.big(v, 0), plugins: { tooltip: { filter: i => !!i.dataset.label } } }) });
  const e = t.edges;
  FE.chart("qTerm", { type: "bar", data: { labels: t.hist.map((_, i) => ((e[i] + e[i + 1]) / 2).toFixed(0)), datasets: [{ label: "경로 수", data: t.hist, backgroundColor: t.hist.map((_, i) => (e[i] + e[i + 1]) / 2 >= d.target ? FE.color.pos : (e[i] + e[i + 1]) / 2 < d.s0 ? "rgba(220,38,38,.7)" : FE.color.cyan), barPercentage: 1, categoryPercentage: 1 }] },
    options: { ...FE.chartOpts({ xTicks: 6 }), indexAxis: "x" } });
}

/* ------------------------------------------------------------- distribution */
function dist(out, d) {
  const fl = { d: "일간", w: "주간", m: "월간" }[d.freq];
  out.innerHTML = `${FE.stats([
    { l: `평균 (${fl})`, v: FE.spct(d.mean, 3), vcls: FE.cls(d.mean) }, { l: `표준편차 (${fl})`, v: FE.pct(d.std), vcls: "c-white", d: `연율 ${FE.pct(d.ann_vol)}` },
    { l: FE.term("q_skew", "왜도"), v: FE.num(d.skew), vcls: d.skew < 0 ? "neg" : "pos" }, { l: FE.term("q_kurt", "초과 첨도"), v: FE.num(d.kurtosis), vcls: d.kurtosis > 1 ? "c-yellow" : "c-white" },
    { l: FE.term("q_jb", "자크-베라"), v: FE.num(d.jb, 1), vcls: "c-cyan", d: `p = ${d.jb_p < 0.0001 ? "<0.0001" : FE.num(d.jb_p, 4)}` },
    { l: "상승 비율", v: FE.pct(d.positive, 1), vcls: "c-white", d: `표본 ${d.n}개` },
    { l: "3σ 초과", v: `${d.tail_3sigma}회`, vcls: "c-yellow", d: `정규분포면 ${FE.num(d.tail_3sigma_normal, 1)}회` },
  ])}
  <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
    ${FE.panel({ title: "RETURN HISTOGRAM", bar: true, sub: `${fl} 수익률(%) 막대 vs 같은 평균·표준편차의 정규분포 곡선`, body: `<div class="chart lg"><canvas id="qHist"></canvas></div>` })}
    ${FE.panel({ title: "Q-Q PLOT", bar: true, color: "purple", sub: FE.term("q_qq", "정규성 진단"), body: `<div class="chart lg"><canvas id="qQQ"></canvas></div>` })}
  </div>
  <div class="grid cols-3">
    ${FE.panel({ title: "VALUE AT RISK", bar: true, color: "red", sub: `${fl} 기준`, flush: true, body: FE.table([{ k: "c", l: "신뢰수준", a: "l" }, { k: "hist", l: "역사적 VaR", f: v => `<span class="neg">-${FE.pct(v)}</span>` }, { k: "param", l: "정규 VaR", f: v => `<span class="neg">-${FE.pct(v)}</span>` }, { k: "cvar", l: FE.term("cvar", "CVaR"), f: v => `<span class="neg">-${FE.pct(v)}</span>` }],
      ["95", "99"].map(c => ({ c: c + "%", ...d.var[c] }))) + `<div class="note" style="padding:6px 10px">역사적 VaR가 정규 VaR보다 크면 실제 꼬리 위험이 정규분포 가정보다 크다는 뜻이에요.</div>` })}
    ${FE.panel({ title: "WORST", bar: true, color: "red", sub: "최악의 구간", flush: true, body: FE.table([{ k: "date", l: "날짜", a: "l" }, { k: "ret", l: "수익률", f: sp }], d.worst) })}
    ${FE.panel({ title: "BEST", bar: true, color: "green", sub: "최고의 구간", flush: true, body: FE.table([{ k: "date", l: "날짜", a: "l" }, { k: "ret", l: "수익률", f: sp }], d.best) })}
  </div>
  <div class="q-verdict note">진단: ${d.normal_rejected ? `<b class="c-yellow">정규분포가 아닙니다</b> (자크-베라 p < 0.05).` : `<b>정규분포와 크게 다르지 않습니다</b> (p ≥ 0.05).`}
   ${d.kurtosis > 1 ? `꼬리가 두꺼워 극단적인 ${fl} 움직임이 정규분포 예상보다 자주 일어납니다.` : ""} ${d.skew < -0.2 ? "왼쪽 꼬리(급락)가 더 긴 분포예요." : d.skew > 0.2 ? "오른쪽 꼬리(급등)가 더 긴 분포예요." : ""}
   표준편차만으로 위험을 판단하면 실제 위험을 과소평가할 수 있어요.</div>`;
  FE.chart("qHist", { type: "bar", data: { labels: d.hist.mids.map(v => v.toFixed(2)), datasets: [
    { type: "line", label: "정규분포", data: d.hist.normal, borderColor: FE.color.accent, borderWidth: 2, pointRadius: 0, tension: .3 },
    { label: "실제 빈도", data: d.hist.counts, backgroundColor: d.hist.mids.map(v => v < 0 ? "rgba(220,38,38,.6)" : "rgba(22,163,74,.6)"), barPercentage: 1, categoryPercentage: 1 }] },
    options: FE.chartOpts({ legend: true, xTicks: 10, xFmt: v => v + "%" }) });
  const qq = d.qq, lo = Math.min(...qq.theory), hi = Math.max(...qq.theory);
  FE.chart("qQQ", { type: "scatter", data: { datasets: [{ label: "표본", data: qq.theory.map((x, i) => ({ x, y: qq.sample[i] })), backgroundColor: FE.color.cyan, pointRadius: 2 },
    { label: "정규분포선", type: "line", data: [{ x: lo, y: lo }, { x: hi, y: hi }], borderColor: FE.color.accent, borderWidth: 1.5, pointRadius: 0 }] },
    options: FE.chartOpts({ legend: false, xType: "linear", x: { type: "linear", title: { display: true, text: "이론 분위수 (σ)", color: FE.color.text2 } }, y: { title: { display: true, text: "표본 분위수 (σ)", color: FE.color.text2 } } }) });
}

/* ------------------------------------------------------------- seasonality */
function season(out, d) {
  const M = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  const bm = d.by_month;
  out.innerHTML = `${FE.stats([
    { l: "가장 좋은 달", v: M[d.best_month - 1], vcls: "pos", d: `평균 ${FE.spct(bm[d.best_month - 1].avg)} · 승률 ${FE.pct(bm[d.best_month - 1].win, 0)}` },
    { l: "가장 나쁜 달", v: M[d.worst_month - 1], vcls: "neg", d: `평균 ${FE.spct(bm[d.worst_month - 1].avg)} · 승률 ${FE.pct(bm[d.worst_month - 1].win, 0)}` },
    { l: FE.term("q_tom", "월말·월초 (일평균)"), v: FE.spct(d.turn_of_month.tom_avg, 3), vcls: FE.cls(d.turn_of_month.tom_avg), d: `나머지 날 ${FE.spct(d.turn_of_month.rest_avg, 3)}` },
    { l: "분석 연수", v: d.grid.length + "년", vcls: "c-white" },
  ])}
  ${FE.panel({ title: "MONTHLY RETURN HEATMAP", bar: true, sub: `${esc(d.symbol)} 연도 × 월 수익률 (%)`, flush: true, body: `<div class="tbl-wrap"><table class="tbl heat"><thead><tr><th class="l">연도</th>${M.map(m => `<th class="c">${m}</th>`).join("")}<th class="c">연간</th></tr></thead><tbody>${
    d.grid.map(r => `<tr><td class="l c-white">${r.year}</td>${r.months.map(v => `<td style="${FE.heat(v, 0.12)}">${v == null ? "" : (v * 100).toFixed(1)}</td>`).join("")}<td style="${FE.heat(r.total, 0.5)}">${r.total == null ? "" : (r.total * 100).toFixed(1)}</td></tr>`).join("")}
    <tr><td class="l c-orange">평균</td>${bm.map(x => `<td style="${FE.heat(x.avg, 0.06)}"><b>${x.avg == null ? "" : (x.avg * 100).toFixed(1)}</b></td>`).join("")}<td></td></tr>
    <tr><td class="l c-orange">승률</td>${bm.map(x => `<td class="c-muted">${x.win == null ? "" : Math.round(x.win * 100) + "%"}</td>`).join("")}<td></td></tr></tbody></table></div>` })}
  <div class="grid cols-2">
    ${FE.panel({ title: "AVERAGE BY MONTH", bar: true, color: "cyan", sub: "월별 평균 · 중앙값 수익률 (%)", body: `<div class="chart md"><canvas id="qMon"></canvas></div>` })}
    ${FE.panel({ title: "DAY OF WEEK", bar: true, color: "purple", sub: "요일별 평균 일간 수익률 (%) · 승률", body: `<div class="chart md"><canvas id="qDow"></canvas></div>` })}
  </div>
  <div class="q-verdict note">${FE.term("q_season", "계절성")}은 표본이 적어(한 달당 ${bm[0].n}개 안팎) 우연일 가능성이 큽니다. 승률이 70% 이상이면서 평균과 중앙값이 같은 방향일 때만 참고하세요. 매매 비용을 넘는 효과인지도 확인이 필요해요.</div>`;
  FE.chart("qMon", { type: "bar", data: { labels: M, datasets: [{ label: "평균", data: bm.map(x => x.avg * 100), backgroundColor: bm.map(x => x.avg >= 0 ? FE.color.pos : FE.color.neg) }, { label: "중앙값", data: bm.map(x => x.median * 100), backgroundColor: "rgba(128,128,128,.5)" }] }, options: FE.chartOpts({ legend: true, yFmt: v => v.toFixed(1) + "%" }) });
  FE.chart("qDow", { type: "bar", data: { labels: d.dow.map(x => x.day + "요일"), datasets: [{ label: "평균 (%)", data: d.dow.map(x => x.avg * 100), backgroundColor: d.dow.map(x => x.avg >= 0 ? FE.color.pos : FE.color.neg), yAxisID: "y" },
    { type: "line", label: "승률 (%)", data: d.dow.map(x => x.win * 100), borderColor: FE.color.accent, backgroundColor: FE.color.accent, yAxisID: "y2", pointRadius: 3 }] },
    options: FE.chartOpts({ legend: true, yFmt: v => v.toFixed(2) + "%", scales: { y2: { position: "left", grid: { display: false }, ticks: { callback: v => v + "%" } } } }) });
}

/* ------------------------------------------------------------- CAPM */
function capm(out, d) {
  const sig = Math.abs(d.alpha_t) > 1.96;
  out.innerHTML = `${FE.stats([
    { l: FE.term("beta", "베타"), v: FE.num(d.beta), vcls: "c-orange", d: `t = ${FE.num(d.beta_t, 1)} · 표준오차 ${FE.num(d.beta_se, 3)}` },
    { l: FE.term("alpha", "알파 (연)"), v: FE.spct(d.alpha), vcls: FE.cls(d.alpha), d: `${FE.term("q_t", "t")} = ${FE.num(d.alpha_t)} · ${sig ? "유의함" : "유의하지 않음"}` },
    { l: FE.term("q_r2", "R²"), v: FE.num(d.r2), vcls: "c-cyan", d: `상관계수 ${FE.num(d.corr)}` },
    { l: "연 수익률", v: FE.spct(d.ret), vcls: FE.cls(d.ret), d: `${esc(d.bench)} ${FE.spct(d.bench_ret)}` },
    { l: "CAPM 기대수익률", v: FE.spct(d.expected_capm), vcls: "c-white", d: "무위험 + 베타 × 시장 초과" },
    { l: FE.term("q_treynor", "트레이너"), v: FE.num(d.treynor), vcls: "c-white" },
    { l: FE.term("q_resid", "고유 변동성"), v: FE.pct(d.resid_vol), vcls: "c-white", d: `전체 ${FE.pct(d.vol)}` },
  ])}
  <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
    ${FE.panel({ title: "SECURITY CHARACTERISTIC LINE", bar: true, sub: `${esc(d.symbol)} vs ${esc(d.bench)} ${d.freq === "w" ? "주간" : "일간"} 초과수익률 (%) · n=${d.n}`, body: `<div class="chart lg"><canvas id="qSc"></canvas></div>` })}
    ${FE.panel({ title: "INTERPRETATION", bar: true, color: "cyan", sub: "해석", body: `<div class="q-verdict note" style="border:0;background:none;padding:0">
      · ${esc(d.bench)}가 <b>1%</b> 움직일 때 ${esc(d.symbol)}는 평균 <b>${FE.num(d.beta)}%</b> 움직였습니다 → ${d.beta > 1.2 ? "<b class='c-yellow'>시장보다 공격적</b>" : d.beta < 0.8 ? "<b class='c-cyan'>시장보다 방어적</b>" : "<b>시장과 비슷</b>"}.<br>
      · 수익률 변동의 <b>${FE.pct(d.r2, 0)}</b>는 시장으로 설명되고, 나머지 ${FE.pct(1 - d.r2, 0)}는 종목 고유 요인입니다.<br>
      · 시장 움직임을 빼고도 연 <b class="${FE.cls(d.alpha)}">${FE.spct(d.alpha)}</b>의 알파가 있었지만, t값 ${FE.num(d.alpha_t)}로 ${sig ? "<b class='pos'>통계적으로 유의합니다</b>" : "<b class='c-yellow'>운과 구별하기 어렵습니다</b>"}.<br>
      · ${FE.term("q_treynor", "트레이너 비율")} ${FE.num(d.treynor)}, 정보비율 ${FE.num(d.info_ratio)}.<br><br>
      <span class="c-dim">회귀식: (종목 − 무위험) = α + β × (시장 − 무위험) + ε · 무위험 이자율 3%</span></div>` })}
  </div>`;
  FE.chart("qSc", { type: "scatter", data: { datasets: [
    { label: "관측치", data: d.scatter.x.map((x, i) => ({ x, y: d.scatter.y[i] })), backgroundColor: "rgba(8,145,178,.45)", pointRadius: 2.2 },
    { label: `회귀선 β=${d.beta.toFixed(2)}`, type: "line", data: d.line.x.map((x, i) => ({ x, y: d.line.y[i] })), borderColor: FE.color.accent, borderWidth: 2.2, pointRadius: 0 },
    { label: "β=1", type: "line", data: d.line.x.map(x => ({ x, y: x })), borderColor: FE.color.text3, borderDash: [4, 4], borderWidth: 1, pointRadius: 0 }] },
    options: FE.chartOpts({ legend: true, mode: "nearest", xType: "linear", x: { type: "linear", title: { display: true, text: `${d.bench} 초과수익률 (%)`, color: FE.color.text2 } }, y: { title: { display: true, text: `${d.symbol} 초과수익률 (%)`, color: FE.color.text2 } } }) });
}

/* ------------------------------------------------------------- rolling */
function rolling(out, d) {
  const L = d.last, R = d.range, w = d.window;
  out.innerHTML = `${FE.stats([
    { l: `${w}일 ${FE.term("vol", "변동성")}`, v: FE.pct(L.vol, 1), vcls: "c-yellow", d: `범위 ${FE.pct(R.vol.min, 0)}~${FE.pct(R.vol.max, 0)}` },
    { l: `${w}일 ${FE.term("beta", "베타")}`, v: FE.num(L.beta), vcls: "c-orange", d: `범위 ${FE.num(R.beta.min)}~${FE.num(R.beta.max)}` },
    { l: `${w}일 ${FE.term("sharpe", "샤프")}`, v: FE.num(L.sharpe), vcls: "c-cyan", d: `평균 ${FE.num(R.sharpe.mean)}` },
    { l: `${w}일 ${FE.term("corr", "상관")}`, v: FE.num(L.corr), vcls: "c-white", d: `vs ${esc(d.bench)}` },
    { l: `${w}일 수익률`, v: FE.spct(L.ret), vcls: FE.cls(L.ret) },
  ])}
  <div class="grid cols-2">
    ${FE.panel({ title: "ROLLING VOLATILITY", bar: true, color: "yellow", sub: `${w}일 연율 변동성 vs ${esc(d.bench)}`, body: `<div class="chart md"><canvas id="rV"></canvas></div>` })}
    ${FE.panel({ title: "ROLLING BETA", bar: true, sub: `${w}일 베타 · 상관계수`, body: `<div class="chart md"><canvas id="rB"></canvas></div>` })}
    ${FE.panel({ title: "ROLLING SHARPE", bar: true, color: "cyan", sub: `${w}일 샤프 지수`, body: `<div class="chart md"><canvas id="rS"></canvas></div>` })}
    ${FE.panel({ title: "DRAWDOWN", bar: true, color: "red", sub: "고점 대비 하락률", body: `<div class="chart md"><canvas id="rD"></canvas></div>` })}
  </div>
  <div class="q-verdict note">위험 지표는 고정된 값이 아닙니다. 변동성은 위기 때 몇 배로 뛰고, 베타·상관관계도 시기마다 달라져요. 하나의 숫자(예: 5년 베타)로 판단하기 전에 추세를 확인하세요.</div>`;
  const o = f => FE.chartOpts({ legend: true, yFmt: f });
  FE.chart("rV", { type: "line", data: { labels: d.dates, datasets: [FE.line(d.symbol, d.vol.map(v => v * 100), FE.color.warn, { borderWidth: 2 }), FE.line(d.bench, d.bench_vol.map(v => v * 100), FE.color.text2, { borderDash: [4, 3] })] }, options: o(v => v.toFixed(0) + "%") });
  FE.chart("rB", { type: "line", data: { labels: d.dates, datasets: [FE.line("베타", d.beta, FE.color.accent, { borderWidth: 2 }), FE.line("상관계수", d.corr, FE.color.cyan), FE.line("β=1", d.dates.map(() => 1), FE.color.text3, { borderDash: [3, 3], borderWidth: 1 })] }, options: o(v => v.toFixed(1)) });
  FE.chart("rS", { type: "line", data: { labels: d.dates, datasets: [FE.line("샤프", d.sharpe, FE.color.cyan, { borderWidth: 1.6, fill: { target: { value: 0 }, above: "rgba(22,163,74,.12)", below: "rgba(220,38,38,.15)" } })] }, options: o(v => v.toFixed(1)) });
  FE.chart("rD", { type: "line", data: { labels: d.dates, datasets: [FE.line("낙폭", d.drawdown.map(v => v * 100), FE.color.neg, { fill: { target: "origin", below: "rgba(220,38,38,.18)" } })] }, options: o(v => v.toFixed(0) + "%") });
}

/* ------------------------------------------------------------- pairs */
function pairs(out, d) {
  const zl = d.z_last, s = d.strategy;
  out.innerHTML = `${FE.stats([
    { l: FE.term("corr", "수익률 상관"), v: FE.num(d.corr), vcls: "c-cyan", d: `가격 상관 ${FE.num(d.corr_price)}` },
    { l: FE.term("q_hedge", "헤지 비율"), v: FE.num(d.hedge, 3), vcls: "c-orange", d: `R² ${FE.num(d.r2)}` },
    { l: FE.term("q_coint", "ADF t값"), v: FE.num(d.adf_t), vcls: d.cointegrated ? "pos" : "c-yellow", d: d.cointegrated ? "공적분 (5% 유의)" : `공적분 아님 (5% 임계 ${d.crit["5%"]})` },
    { l: FE.term("q_hl", "반감기"), v: d.half_life == null ? "—" : d.half_life > 250 ? "250일+" : FE.num(d.half_life, 1) + "일", vcls: "c-white", d: d.half_life == null || d.half_life > 250 ? "평균회귀 거의 없음" : "" },
    { l: FE.term("q_z", "현재 z-score"), v: FE.num(zl), vcls: Math.abs(zl) >= d.entry ? "c-yellow" : "c-white", d: zl >= d.entry ? `${esc(d.a)} 상대적 고평가` : zl <= -d.entry ? `${esc(d.a)} 상대적 저평가` : "평균 범위" },
    { l: "z 전략 수익", v: FE.spct(s.total), vcls: FE.cls(s.total), d: `${s.trades}회 신호 · 노출 ${FE.pct(s.exposure, 0)}` },
  ])}
  <div class="grid cols-2">
    ${FE.panel({ title: "NORMALIZED PRICES", bar: true, sub: `시작 = 100 · ${esc(d.a)} vs ${esc(d.b)}`, body: `<div class="chart md"><canvas id="pP"></canvas></div>` })}
    ${FE.panel({ title: "SPREAD Z-SCORE", bar: true, color: "yellow", sub: `log(${esc(d.a)}) − ${FE.num(d.hedge, 3)}·log(${esc(d.b)}) · ${d.window}일 z · 진입 ±${d.entry}`, body: `<div class="chart md"><canvas id="pZ"></canvas></div>` })}
    ${FE.panel({ title: "SPREAD", bar: true, color: "purple", sub: "OLS 잔차 (로그 스프레드)", body: `<div class="chart md"><canvas id="pS"></canvas></div>` })}
    ${FE.panel({ title: "Z-SCORE STRATEGY", bar: true, color: "green", sub: `z > ${d.entry}: A 매도·B 매수 / z < −${d.entry}: A 매수·B 매도 / z가 0을 지나면 청산`, body: `<div class="chart md"><canvas id="pE"></canvas></div>` })}
  </div>
  <div class="q-verdict note">${d.cointegrated ? `<b class="pos">두 종목은 공적분 관계</b>로 보입니다(ADF ${FE.num(d.adf_t)} < ${d.crit["5%"]}). 스프레드가 벌어지면 되돌아오는 경향이 통계적으로 확인됩니다.` :
    `<b class="c-yellow">공적분이 확인되지 않았습니다</b>(ADF ${FE.num(d.adf_t)} > ${d.crit["5%"]}). 상관관계가 높아도 스프레드가 계속 벌어질 수 있어 페어 트레이딩에 부적합할 수 있어요.`}
    임계값(Engle-Granger): 1% ${d.crit["1%"]}, 5% ${d.crit["5%"]}, 10% ${d.crit["10%"]}. 전략 수익은 수수료·공매도 비용 제외, 학습용입니다.</div>`;
  const o = f => FE.chartOpts({ legend: true, yFmt: f });
  FE.chart("pP", { type: "line", data: { labels: d.dates, datasets: [FE.line(d.a, d.pa, FE.color.accent), FE.line(d.b, d.pb, FE.color.cyan)] }, options: o(v => v.toFixed(0)) });
  FE.chart("pZ", { type: "line", data: { labels: d.dates, datasets: [FE.line("z", d.z, FE.color.warn, { borderWidth: 1.6 }), FE.line(`+${d.entry}`, d.dates.map(() => d.entry), FE.color.neg, { borderDash: [4, 3], borderWidth: 1 }), FE.line(`−${d.entry}`, d.dates.map(() => -d.entry), FE.color.pos, { borderDash: [4, 3], borderWidth: 1 }), FE.line("0", d.dates.map(() => 0), FE.color.text3, { borderWidth: 1 })] }, options: o(v => v.toFixed(1)) });
  FE.chart("pS", { type: "line", data: { labels: d.dates, datasets: [FE.line("스프레드", d.spread, FE.color.purple)] }, options: o(v => v.toFixed(2)) });
  FE.chart("pE", { type: "line", data: { labels: d.dates, datasets: [FE.line("페어 전략 (1 →)", s.equity, FE.color.pos, { borderWidth: 2 })] }, options: o(v => v.toFixed(2)) });
}

/* ------------------------------------------------------------- factors */
function factors(out, d) {
  const mx = Math.max(...d.factors.map(f => Math.abs(f.beta)), 0.5);
  out.innerHTML = `${FE.stats([
    { l: FE.term("alpha", "알파 (연)"), v: FE.spct(d.alpha), vcls: FE.cls(d.alpha), d: `t = ${FE.num(d.alpha_t)}` },
    { l: FE.term("q_r2", "R² (6팩터)"), v: FE.num(d.r2), vcls: "c-cyan", d: `조정 ${FE.num(d.adj_r2)}` },
    { l: "R² (시장만)", v: FE.num(d.capm_r2), vcls: "c-white", d: `팩터 추가로 +${FE.num((d.r2 - d.capm_r2) * 100, 1)}%p 설명` },
    { l: FE.term("q_resid", "고유 변동성"), v: FE.pct(d.resid_vol), vcls: "c-white", d: `전체 ${FE.pct(d.total_vol)}` },
    { l: "표본", v: `${d.n}`, vcls: "sm c-white", d: d.freq === "w" ? "주간 수익률" : "일간 수익률" },
  ])}
  <div class="grid cols-2">
    ${FE.panel({ title: "FACTOR BETAS", bar: true, sub: `${FE.term("q_factor", "팩터 노출")} · 진한 막대 = 통계적으로 유의 (|t| > 1.96)`, body: `<div class="q-fb">${d.factors.map(f => `<div class="r"><span><b class="c-white">${f.key}</b> <span class="c-muted">${esc(f.name)}</span></span>
      <div class="bk"><span class="z"></span><i style="${f.beta >= 0 ? `left:50%;width:${f.beta / mx * 50}%` : `right:50%;width:${-f.beta / mx * 50}%`};background:${f.beta >= 0 ? "var(--pos)" : "var(--neg)"};opacity:${f.significant ? 1 : .35}"></i></div>
      <b class="${FE.cls(f.beta)}" style="text-align:right">${FE.num(f.beta, 2)}</b></div>`).join("")}</div>` })}
    ${FE.panel({ title: "FACTOR TABLE", bar: true, color: "cyan", sub: "팩터 프록시 · t값 · 연 수익 기여", flush: true, body: FE.table([
      { k: "key", l: "팩터", a: "l", f: (v, r) => `<b class="c-white">${v}</b> <span class="c-muted">${esc(r.name)}</span>` },
      { k: "proxy", l: "프록시", a: "l", f: (v, r) => `<span data-tip="${esc(r.desc)}" class="term">${esc(v)}</span>` },
      { k: "beta", l: "베타", f: v => `<b class="${FE.cls(v)}">${FE.num(v)}</b>` },
      { k: "t", l: FE.term("q_t", "t값"), f: (v, r) => `<span class="${r.significant ? "c-orange" : "c-dim"}">${FE.num(v, 1)}</span>` },
      { k: "factor_ret", l: "팩터 연수익", f: sp }, { k: "ret_contrib", l: "기여 (연)", f: sp }], d.factors) })}
  </div>
  <div class="q-verdict note">읽는 법: <b>MKT</b> 베타는 시장 민감도, <b>SMB</b>가 +면 소형주처럼, <b>HML</b>이 −면 성장주처럼, <b>MOM</b>이 +면 최근 강세주처럼 움직였다는 뜻입니다.
    팩터는 미국 ETF(SPY·IWM·IWD·IWF·MTUM·QUAL·USMV)로 만든 간이 프록시로, 학술용 Fama-French 팩터와 다릅니다.${d.note ? `<br><span class="c-yellow">⚠ ${esc(d.note)}</span>` : ""}</div>`;
}
})();
