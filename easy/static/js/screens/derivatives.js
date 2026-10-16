/* DERIVATIVES — 파생상품 (F9): option chain, option pricer, strategy builder, bond calculator, VIX & futures */
(() => {
FE.glossary({
  dv_itm: ["내가격 (ITM) / 외가격 (OTM)", "지금 당장 행사하면 이익이 나는 옵션이 내가격(ITM). 콜은 행사가 < 현재가, 풋은 행사가 > 현재가. 반대는 외가격(OTM), 행사가≈현재가는 등가격(ATM)."],
  dv_bidask: ["매수·매도 호가", "매수호가(Bid)는 지금 팔 수 있는 가격, 매도호가(Ask)는 지금 살 수 있는 가격. 차이(스프레드)가 클수록 거래 비용이 커요."],
  dv_em: ["예상 변동폭", "등가격(ATM) 콜+풋(스트래들) 가격. 만기까지 시장이 예상하는 주가의 ± 움직임 크기로, 대략 68% 확률 범위로 해석해요."],
  dv_atmiv: ["ATM 내재변동성", "현재가에 가장 가까운 행사가 옵션의 내재변동성. 시장이 예상하는 연간 변동성의 대표값."],
  dv_smile: ["변동성 스마일", "행사가별 내재변동성을 이은 곡선. 주가지수는 하락 대비 풋 수요 때문에 낮은 행사가의 IV가 높은 '스큐(기울기)' 모양이 흔해요."],
  dv_ivterm: ["IV 기간구조", "만기별 ATM 내재변동성. 실적 발표 같은 이벤트가 있는 만기의 IV가 튀어 오르는 경우가 많아요."],
  dv_intr: ["내재가치", "지금 행사하면 얻는 이익. 콜 = max(현재가 − 행사가, 0), 풋 = max(행사가 − 현재가, 0)."],
  dv_tv: ["시간가치", "옵션 가격 − 내재가치. 만기까지 남은 시간과 변동성에 대한 값으로, 만기가 다가올수록 0으로 줄어요(세타)."],
  dv_parity: ["풋-콜 패리티", "같은 행사가·만기의 콜 − 풋 = 현재가×e^(−qT) − 행사가×e^(−rT). 이 관계가 깨지면 차익거래 기회가 생겨요."],
  dv_binom: ["이항모형 (CRR)", "주가가 매 단계 일정 비율로 오르거나 내린다고 보고 나무 모양으로 계산하는 옵션 가격 모형. 만기 전 행사(미국식)를 반영할 수 있어요."],
  dv_amer: ["미국식 옵션", "만기 전 언제든 행사할 수 있는 옵션(미국 주식옵션 대부분). 유럽식은 만기일에만 행사 가능."],
  dv_early: ["조기행사 프리미엄", "미국식 가격 − 유럽식 가격. 배당이 큰 주식의 콜, 깊은 내가격 풋에서 커져요."],
  dv_pop: ["수익 확률", "주가가 로그정규분포를 따른다는 가정 아래 만기(가장 가까운 만기) 시점에 손익이 0보다 클 확률. 실제 시장과 다를 수 있어요."],
  dv_net: ["순 프리미엄", "전략을 만들 때 내는 돈(지불, 데빗) 또는 받는 돈(수취, 크레딧)의 합계."],
  dv_mult: ["계약 승수", "옵션 1계약이 몇 주에 해당하는지. 미국 주식옵션은 100주, 코스피200 옵션은 25만 원 × 지수."],
  dv_covered: ["커버드콜", "주식을 보유한 채 콜옵션을 팔아 프리미엄을 받는 전략. 상승 이익은 행사가에서 제한되는 대신 꾸준한 수입을 얻어요."],
  dv_protput: ["보호적 풋", "주식을 보유하면서 풋옵션을 사서 하락 손실을 제한하는 '보험' 전략."],
  dv_spread: ["스프레드", "같은 종류 옵션을 행사가만 다르게 사고팔아 비용과 위험을 줄인 전략. 이익도 제한돼요."],
  dv_straddle: ["스트래들 / 스트랭글", "같은 행사가(스트래들) 또는 다른 행사가(스트랭글)의 콜과 풋을 함께 사는 전략. 방향과 상관없이 크게 움직이면 이익."],
  dv_condor: ["아이언 콘도르", "외가격 풋 스프레드와 콜 스프레드를 함께 파는 전략. 주가가 일정 범위에 머물면 이익, 손실은 제한돼요."],
  dv_butterfly: ["버터플라이", "행사가 3개(1:−2:1)로 만든 전략. 만기에 가운데 행사가 근처면 최대 이익."],
  dv_calendar: ["캘린더 스프레드", "같은 행사가로 근월물은 팔고 원월물은 사는 전략. 근월물이 더 빨리 시간가치를 잃는 점을 이용해요. 여기서는 근월물 만기 시점에 원월물을 블랙-숄즈로 평가한 근사치예요."],
  dv_clean: ["클린 가격 / 더티 가격", "클린 가격은 경과이자를 뺀 호가 기준 가격, 더티 가격은 실제 지불하는 금액(클린 + 경과이자). 액면 100 기준."],
  dv_accr: ["경과이자", "직전 이자 지급일부터 결제일까지 쌓인 이자. 채권을 사는 사람이 파는 사람에게 미리 정산해 줘요."],
  dv_mac: ["맥컬리 듀레이션", "채권 현금흐름을 받는 평균 시점(년). 가격 민감도는 수정 듀레이션으로 봐요."],
  dv_dv01: ["DV01", "수익률이 0.01%p(1bp) 변할 때 채권 가격(입력한 액면 기준 금액)이 변하는 크기."],
  dv_cy: ["경상수익률", "연간 이표 ÷ 클린 가격. 시세 차익을 뺀 '이자만의' 수익률."],
  dv_coupon: ["표면금리 (쿠폰)", "액면가 대비 매년 지급하는 이자율. 할증 채권(가격 > 100)은 표면금리가 시장 금리보다 높은 채권이에요."],
  dv_vix: ["VIX (변동성 지수)", "S&P500 옵션 가격으로 계산한 향후 30일 예상 변동성(연율, %). 20 미만은 안정, 30 이상은 공포 국면으로 봐요."],
  dv_contango: ["콘탱고 / 백워데이션", "만기가 먼 쪽 가격이 더 높으면 콘탱고(평상시), 가까운 쪽이 더 높으면 백워데이션. VIX가 백워데이션이면 단기 공포가 크다는 신호."],
  dv_vvix: ["VVIX", "VIX 옵션으로 계산한 'VIX의 변동성'. 100 이상이면 변동성 자체가 크게 출렁일 것으로 시장이 본다는 뜻."],
  dv_skew: ["CBOE SKEW", "S&P500 꼬리 위험(급락) 가격을 나타내는 지수. 보통 100~150, 높을수록 급락 대비 수요가 많아요."],
  dv_basis: ["베이시스", "선물 가격 − 현물 가격. 주가지수 선물은 보통 '금리 − 배당' 만큼 현물보다 비싸요."],
  dv_carry: ["연환산 캐리", "베이시스를 만기까지 일수로 1년 기준 환산한 비율. 대략 단기금리 − 배당수익률과 비슷해야 정상."],
  dv_curve: ["선물 곡선", "같은 상품의 월물(만기월)별 선물 가격을 이은 선. 보관비·금리·수급 상황을 보여줘요."],
});

const C = FE.color;
const TABS = [["chain", "옵션 체인 OPTION CHAIN"], ["pricer", "옵션 계산기 PRICER"], ["strategy", "전략 빌더 STRATEGY"], ["bond", "채권 계산기 BONDS"], ["vix", "선물·VIX"]];
const QUICK = ["SPY", "QQQ", "IWM", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN"];
const SRC_YF = "Yahoo Finance 옵션 체인 (yfinance) · 15분 이상 지연될 수 있음";
const SRC_CALC = "자체 계산 (블랙-숄즈·CRR 이항모형) · 학습용";

const css = `
#scr-derivatives .dv-ctl { align-items:flex-end; gap:10px; }
#scr-derivatives .dv-ctl .field label { white-space:nowrap; }
#scr-derivatives .dv-src { margin-top:4px; font-size:11px; color:var(--text-3); }
#scr-derivatives .dv-chain td, #scr-derivatives .dv-chain th { padding:3px 6px; font-size:12px; }
#scr-derivatives .dv-chain th.grp { text-align:center; letter-spacing:2px; font-size:12px; }
#scr-derivatives .dv-chain td.k { text-align:center; font-weight:700; color:var(--text); background:#141414 !important; border-left:1px solid var(--border-bright); border-right:1px solid var(--border-bright); }
#scr-derivatives .dv-chain tr td.ci { background:#0b1a10 !important; }
#scr-derivatives .dv-chain tr td.pi { background:#1d0c0c !important; }
#scr-derivatives .dv-chain tr.atm td.k { color:var(--accent); }
#scr-derivatives .dv-chain tr.spot td { background:var(--accent-bg) !important; color:var(--accent); font-weight:700; text-align:center; padding:1px; font-size:11px; border-bottom:1px solid var(--accent-dim); }
#scr-derivatives .dv-chain tbody tr:not(.spot) { cursor:pointer; }
#scr-derivatives .dv-chain tbody tr:not(.spot):hover td { outline:1px solid #2a2a2a; }
#scr-derivatives .dv-legs td { padding:3px 4px; }
#scr-derivatives .dv-legs .inp { width:100%; min-width:58px; padding:2px 5px; }
#scr-derivatives .dv-legs select.inp { min-width:64px; }
#scr-derivatives .dv-rm { background:none; border:0; color:var(--neg); cursor:pointer; font:inherit; }
#scr-derivatives .dv-big { font-size:26px; font-weight:700; color:var(--accent); }
#scr-derivatives .dv-h { color:var(--text-2); font-size:11.5px; letter-spacing:1px; margin:6px 0 2px; }
#scr-derivatives .form .inp { width:100%; }
#scr-derivatives .stat { min-width:110px; }
`;

/* ---------------- local helpers ---------------- */
const st = {
  tab: "chain", sym: FE.store.get("dv.sym", "SPY"), exp: "", range: "20",
  p: { kind: "call", side: "long", S: 100, K: 100, days: 30, sigma: 25, r: 4.2, q: 0 },
  s: null, b: null, root: "CL",
};
let root = null;
const $ = s => root.querySelector(s);
const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const numv = id => { const v = parseFloat($(id)?.value); return isNaN(v) ? null : v; };
const dteOf = e => Math.max(0, Math.round((new Date(e + "T21:00:00Z") - Date.now()) / 864e5));
const usd = v => v == null ? "—" : (v < 0 ? "-$" : "$") + FE.num(Math.abs(v), 2);
const signed = (v, d = 2) => v == null ? "—" : `<span class="${FE.cls(v)}">${FE.chg(v, d)}</span>`;
const pts = (xs, ys) => xs.map((x, i) => ({ x, y: ys[i] }));
const kstep = S => S >= 1000 ? 10 : S >= 200 ? 5 : S >= 50 ? 1 : S >= 10 ? 0.5 : 0.1;
const snapK = (S, k) => { const s = kstep(S); return +(Math.round(k / s) * s).toFixed(2); };
const cpanel = o => FE.panel({ title: o.title, color: o.color || "orange", bar: o.bar, cls: o.cls || "", sub: o.unit ? "단위: " + o.unit : "", acts: o.acts || "",
  body: `<div class="chart ${o.h || "md"}"><canvas id="${o.id}"></canvas></div><div class="dv-src">출처: ${o.src}</div>${o.note ? `<div class="note">${o.note}</div>` : ""}` });
// vertical marker lines on a chart (x in scale units — value for linear axes, index for category axes)
const vlines = lines => ({
  id: "dvVlines",
  afterDatasetsDraw(ch) {
    const { ctx, chartArea: a, scales: { x } } = ch;
    lines.forEach(l => {
      if (l.x == null) return; const px = x.getPixelForValue(l.x); if (!(px >= a.left && px <= a.right)) return;
      ctx.save(); ctx.strokeStyle = l.color || C.text2; ctx.setLineDash(l.dash || [4, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
      if (l.label) { ctx.setLineDash([]); ctx.fillStyle = l.color || C.text2; ctx.font = "11px Consolas, 'Malgun Gothic'"; ctx.fillText(l.label, Math.min(px + 4, a.right - 70), a.top + 11 + (l.row || 0) * 13); }
      ctx.restore();
    });
  },
});
const zeroGrid = { color: c => c.tick && c.tick.value === 0 ? "#4a4a4a" : C.grid };
const pnlFill = { target: { value: 0 }, above: "rgba(22,163,74,.13)", below: "rgba(220,38,38,.13)" };

/* ====================================================================== */
FE.screen({
  id: "derivatives", label: "파생상품", primary: true, order: 9, fkey: "F9", group: "트레이딩",
  desc: "옵션 체인·옵션 계산기·전략 빌더·채권 계산기·VIX 기간구조",
  render(el, arg) {
    root = el;
    if (!document.getElementById("derivatives-style")) { const s = document.createElement("style"); s.id = "derivatives-style"; s.textContent = css; document.head.appendChild(s); }
    const [t0, a1] = String(arg || "").split("/");
    st.tab = TABS.some(t => t[0] === t0) ? t0 : "chain";
    if (a1 && st.tab === "chain") st.sym = a1.toUpperCase();
    if (a1 && st.tab === "vix") st.root = a1.toUpperCase();
    el.innerHTML = FE.screenHead("DERIVATIVES", "옵션 · 채권 · 선물 분석 — 계산 결과는 학습용입니다",
      `<span class="c-dim">US OPTIONS · BSM · CRR · FIXED INCOME</span>`) +
      FE.subtabs("dvtab", TABS, st.tab) + `<div id="dvBody" style="display:flex;flex-direction:column;gap:8px"></div>`;
    FE.onSubtabs(el, "dvtab", show);
    show(st.tab);
  },
});

function show(t) {
  st.tab = t;
  el_tabs();
  history.replaceState(null, "", "#derivatives/" + t + (t === "chain" ? "/" + st.sym : t === "vix" ? "/" + st.root : ""));
  const b = $("#dvBody");
  ({ chain: viewChain, pricer: viewPricer, strategy: viewStrategy, bond: viewBond, vix: viewVix })[t](b);
}
function el_tabs() { root.querySelectorAll('[data-subtabs="dvtab"] button').forEach(x => x.classList.toggle("on", x.dataset.v === st.tab)); }

/* ====================================================================== */
/* OPTION CHAIN                                                            */
/* ====================================================================== */
function viewChain(b) {
  b.innerHTML = `<div class="row dv-ctl">
      ${FE.field("종목 (미국 상장)", `<input class="inp" id="chSym" value="${FE.esc(st.sym)}" style="width:110px" spellcheck="false">`)}
      ${FE.field("만기일", `<select class="inp" id="chExp" style="min-width:170px"><option value="">가장 가까운 주간 만기</option></select>`)}
      ${FE.field("행사가 범위", FE.pills("chRange", [["10", "ATM ±10"], ["20", "±20"], ["40", "±40"], ["all", "전체"]], st.range))}
      <button class="btn solid" id="chGo">조회</button>
      <div class="spacer"></div>
      ${FE.field("빠른 선택", FE.pills("chQuick", QUICK.map(s => [s, s]), st.sym))}
    </div>
    <div id="chOut"><div class="loading">옵션 체인을 불러오는 중…</div></div>`;
  const go = () => { st.sym = $("#chSym").value.trim().toUpperCase() || "SPY"; st.exp = $("#chExp").value; loadChain(); };
  $("#chGo").onclick = go;
  $("#chSym").addEventListener("keydown", e => { if (e.key === "Enter") { $("#chExp").value = ""; go(); } });
  $("#chExp").onchange = go;
  FE.onPills(b, "chRange", v => { st.range = v; if (st.chain) drawChain(st.chain); });
  FE.onPills(b, "chQuick", v => { $("#chSym").value = v; $("#chExp").value = ""; st.exp = ""; go(); });
  loadChain();
}

async function loadChain() {
  const out = $("#chOut"); if (!out) return;
  FE.loading(out, `${st.sym} 옵션 체인을 불러오는 중…`);
  history.replaceState(null, "", "#derivatives/chain/" + st.sym);
  try {
    const d = await FE.api("/api/derivatives/chain?" + FE.qs({ symbol: st.sym, exp: st.exp }));
    if (st.tab !== "chain") return;
    st.chain = d; st.exp = d.expiration; FE.store.set("dv.sym", st.sym);
    $("#chExp").innerHTML = d.expirations.map(e => `<option value="${e}" ${e === d.expiration ? "selected" : ""}>${e} (${dteOf(e)}일)</option>`).join("");
    drawChain(d);
    loadTerm(d.symbol);
    const wrap = out.querySelector(".dv-chain")?.closest(".tbl-wrap"), sp = out.querySelector(".dv-chain tr.spot");
    if (wrap && sp) wrap.scrollTop = Math.max(0, sp.offsetTop - wrap.clientHeight / 2);
  } catch (e) {
    st.chain = null;
    out.innerHTML = `<div class="err">⚠ ${FE.esc(e.message)}</div>` + FE.panel({ title: "참고", color: "cyan", body: `<div class="note">
      옵션 체인은 Yahoo Finance가 제공하는 <b>미국 상장 옵션</b>만 볼 수 있어요. 삼성전자(005930.KS) 같은 한국 주식과 코스피200 옵션은 Yahoo에 데이터가 없습니다(KRX 전용).<br>
      예시: SPY(S&P500 ETF), QQQ(나스닥100 ETF), AAPL, NVDA, TSLA. 대신 <b>옵션 계산기</b> 탭에서 어떤 종목이든 이론가를 계산해 볼 수 있어요.</div>` });
  }
}

function drawChain(d) {
  const out = $("#chOut"); if (!out) return;
  const rows = d.rows, ai = rows.findIndex(r => r.strike === d.atm_strike);
  const n = st.range === "all" ? 1e9 : +st.range;
  const vis = rows.filter((r, i) => Math.abs(i - ai) <= n);
  const em = d.expected_move;
  out.innerHTML = FE.stats([
    { l: `${FE.esc(d.symbol)} 현재가`, v: usd(d.spot), d: FE.esc(d.name) },
    { l: "만기 · 남은 일수", v: `<span class="sm" style="font-size:17px">${d.expiration}</span>`, d: `${d.dte}일 남음`, vcls: "sm" },
    { l: FE.term("pcr", "풋/콜 비율 (거래량)"), v: FE.num(d.pcr_volume, 2), vcls: d.pcr_volume > 1 ? "neg" : "pos", d: `콜 ${FE.int(d.totals.c_vol)} · 풋 ${FE.int(d.totals.p_vol)}` },
    { l: FE.term("pcr", "풋/콜 비율 (미결제)"), v: FE.num(d.pcr_oi, 2), vcls: d.pcr_oi > 1 ? "neg" : "pos", d: `콜 ${FE.int(d.totals.c_oi)} · 풋 ${FE.int(d.totals.p_oi)}` },
    { l: FE.term("maxpain", "맥스 페인"), v: usd(d.max_pain), d: d.max_pain ? `현재가 대비 ${FE.spct(d.max_pain / d.spot - 1)}` : "" },
    { l: FE.term("dv_em", "예상 변동폭 (스트래들)"), v: em ? "±" + usd(em) : "—", d: em ? `±${FE.pct(d.expected_move_pct)} · ${usd(d.spot - em)} ~ ${usd(d.spot + em)}` : "호가 없음" },
    { l: FE.term("dv_atmiv", "ATM 내재변동성"), v: FE.pct(d.atm_iv, 1), d: d.iv_move ? `IV 기준 ±${usd(d.iv_move)}` : "" },
  ]) + `<div class="grid" style="grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);margin-top:8px">
    ${FE.panel({ title: `OPTION CHAIN · ${FE.esc(d.symbol)} ${d.expiration}`, color: "orange", bar: true, flush: true,
      sub: `행 클릭 → 옵션 계산기로 · 음영 = ${FE.term("dv_itm", "내가격(ITM)")}`,
      body: chainTable(d, vis) + `<div class="dv-src" style="padding:4px 10px">출처: ${SRC_YF} · 델타는 각 옵션 IV와 금리 ${FE.num(d.r * 100, 1)}%로 자체 계산</div>` })}
    <div style="display:flex;flex-direction:column;gap:8px">
      ${cpanel({ id: "chOi", title: "행사가별 미결제약정 OPEN INTEREST", color: "cyan", unit: "계약", src: SRC_YF, h: "md" })}
      ${cpanel({ id: "chSmile", title: "변동성 스마일 IV SMILE", color: "purple", unit: "내재변동성 %", src: SRC_YF + " · 외가격(OTM) 옵션 기준, 호가 없는 행사가 제외", h: "md" })}
    </div></div>
    <div class="grid cols-3">
      ${cpanel({ id: "chPain", title: "맥스 페인 MAX PAIN", color: "yellow", unit: "옵션 매수자 총 수령액 (백만 USD)", src: SRC_YF + " · 미결제약정 × 내재가치 × 100주" })}
      ${cpanel({ id: "chVol", title: "행사가별 거래량 VOLUME", color: "green", unit: "계약", src: SRC_YF })}
      ${cpanel({ id: "chTerm", title: "IV 기간구조 TERM STRUCTURE", color: "blue", unit: "ATM 내재변동성 % · 풋/콜 비율", src: SRC_YF + " · 가까운 만기 최대 14개" })}
    </div>
    ${FE.panel({ title: "읽는 법", color: "cyan", body: `<div class="note">
      · 가운데 열이 ${FE.term("strike", "행사가")}, 왼쪽은 콜(오르면 이익), 오른쪽은 풋(내리면 이익)입니다. 음영 칸은 ${FE.term("dv_itm", "내가격")} 옵션, 주황색 띠가 현재가 위치예요.<br>
      · ${FE.term("oi", "미결제약정")}이 몰린 행사가는 지지·저항으로 해석되기도 해요. ${FE.term("pcr", "풋/콜 비율")}이 1보다 크면 하락 대비(헤지) 수요가 많다는 뜻입니다.<br>
      · ${FE.term("dv_em", "예상 변동폭")}은 등가격 스트래들 가격으로, 만기까지 시장이 예상하는 움직임의 크기예요. ${FE.term("maxpain", "맥스 페인")}은 속설일 뿐 예측 도구로 쓰기엔 근거가 약해요.<br>
      · 한국 주식·코스피200 옵션은 Yahoo에 데이터가 없어 이 화면에서 조회할 수 없습니다.</div>` })}`;
  out.querySelector(".dv-chain")?.addEventListener("click", e => {
    const tr = e.target.closest("tr[data-k]"); if (!tr) return;
    const td = e.target.closest("td"); const kind = td && td.cellIndex > 7 ? "put" : "call";
    const r = d.rows.find(x => x.strike === +tr.dataset.k); if (!r) return;
    const iv = (kind === "call" ? r.c_iv : r.p_iv) || d.atm_iv || 0.25;
    Object.assign(st.p, { kind, side: "long", S: +d.spot.toFixed(2), K: r.strike, days: Math.max(1, d.dte), sigma: +(iv * 100).toFixed(1), q: 0 });
    st.p.mkt = kind === "call" ? r.c_mid : r.p_mid;
    FE.toast(`${d.symbol} ${r.strike} ${kind === "call" ? "콜" : "풋"} → 옵션 계산기`);
    show("pricer");
  });
  // charts
  const ks = vis.map(r => r.strike);
  const spotIdx = ks.findIndex(k => k >= d.spot) - 0.5;
  const mpIdx = ks.indexOf(d.max_pain);
  const barOpts = (yFmt) => FE.chartOpts({ legend: true, xTicks: 12, yFmt });
  const kfmt = v => Math.abs(v) >= 1000 ? FE.big(v, 1) : FE.num(v, 0);
  FE.chart("chOi", { type: "bar", data: { labels: ks, datasets: [
    { label: "콜 OI", data: vis.map(r => r.c_oi), backgroundColor: "rgba(22,163,74,.75)", barPercentage: 1, categoryPercentage: .8 },
    { label: "풋 OI", data: vis.map(r => r.p_oi), backgroundColor: "rgba(220,38,38,.75)", barPercentage: 1, categoryPercentage: .8 }] },
    options: barOpts(kfmt), plugins: [vlines([{ x: spotIdx, color: C.accent, label: "현재가" }, { x: mpIdx >= 0 ? mpIdx : null, color: C.warn, label: "맥스페인", row: 1 }])] });
  FE.chart("chVol", { type: "bar", data: { labels: ks, datasets: [
    { label: "콜 거래량", data: vis.map(r => r.c_vol), backgroundColor: "rgba(22,163,74,.75)", barPercentage: 1, categoryPercentage: .8 },
    { label: "풋 거래량", data: vis.map(r => r.p_vol), backgroundColor: "rgba(220,38,38,.75)", barPercentage: 1, categoryPercentage: .8 }] },
    options: barOpts(kfmt), plugins: [vlines([{ x: spotIdx, color: C.accent, label: "현재가" }])] });
  // OTM wings only (+3% overlap): deep ITM quotes are thin and give noisy IVs
  const smileC = vis.filter(r => r.c_iv && r.strike >= d.spot * 0.97).map(r => ({ x: r.strike, y: r.c_iv * 100 }));
  const smileP = vis.filter(r => r.p_iv && r.strike <= d.spot * 1.03).map(r => ({ x: r.strike, y: r.p_iv * 100 }));
  FE.chart("chSmile", { type: "line", data: { datasets: [
    FE.line("콜 IV", smileC, C.pos, { pointRadius: 2 }), FE.line("풋 IV", smileP, C.neg, { pointRadius: 2 })] },
    options: FE.chartOpts({ legend: true, xType: "linear", mode: "nearest", yFmt: v => v.toFixed(0) + "%" }), plugins: [vlines([{ x: d.spot, color: C.accent, label: "현재가" }])] });
  const painM = d.pain.map(v => v / 1e6);
  const allK = d.rows.map(r => r.strike);
  const pi0 = allK.indexOf(vis[0].strike), pi1 = allK.indexOf(vis[vis.length - 1].strike);
  FE.chart("chPain", { type: "bar", data: { labels: ks, datasets: [{ label: "총 수령액", data: painM.slice(pi0, pi1 + 1),
    backgroundColor: ks.map(k => k === d.max_pain ? C.warn : "rgba(128,128,128,.45)"), barPercentage: 1, categoryPercentage: .85 }] },
    options: FE.chartOpts({ yFmt: v => FE.num(v, 0) + "M" }), plugins: [vlines([{ x: spotIdx, color: C.accent, label: "현재가" }])] });
}

function chainTable(d, vis) {
  const f = (v, dd = 2) => v == null || v === 0 && dd === 2 ? `<span class="c-dim">—</span>` : FE.num(v, dd);
  const ivc = v => v == null ? `<span class="c-dim">—</span>` : FE.num(v * 100, 1) + "%";
  const intc = v => v ? FE.int(v) : `<span class="c-dim">0</span>`;
  let spotDone = false, html = "";
  vis.forEach(r => {
    if (!spotDone && r.strike >= d.spot) { spotDone = true; html += `<tr class="spot"><td colspan="15">▼ 현재가 ${usd(d.spot)} ▲</td></tr>`; }
    const ci = r.c_itm ? "ci" : "", pi = r.p_itm ? "pi" : "";
    html += `<tr data-k="${r.strike}" class="${r.strike === d.atm_strike ? "atm" : ""}">
      <td class="${ci}">${intc(r.c_oi)}</td><td class="${ci}">${intc(r.c_vol)}</td><td class="${ci} c-purple">${ivc(r.c_iv)}</td>
      <td class="${ci}">${f(r.c_delta, 2)}</td><td class="${ci} c-green">${f(r.c_bid)}</td><td class="${ci} c-red">${f(r.c_ask)}</td><td class="${ci} c-white">${f(r.c_last)}</td>
      <td class="k">${FE.num(r.strike, r.strike % 1 ? 1 : 0)}</td>
      <td class="${pi} c-white">${f(r.p_last)}</td><td class="${pi} c-green">${f(r.p_bid)}</td><td class="${pi} c-red">${f(r.p_ask)}</td><td class="${pi}">${f(r.p_delta, 2)}</td>
      <td class="${pi} c-purple">${ivc(r.p_iv)}</td><td class="${pi}">${intc(r.p_vol)}</td><td class="${pi}">${intc(r.p_oi)}</td></tr>`;
  });
  if (!spotDone) html += `<tr class="spot"><td colspan="15">▼ 현재가 ${usd(d.spot)} ▲</td></tr>`;
  const h = ["OI", "거래량", "IV", "델타", "매수", "매도", "현재가"];
  return `<div class="tbl-wrap" style="max-height:560px"><table class="tbl dv-chain"><thead>
    <tr><th colspan="7" class="grp c-green">CALLS · 콜</th><th class="grp c-orange">${FE.term("strike", "행사가")}</th><th colspan="7" class="grp c-red">PUTS · 풋</th></tr>
    <tr>${h.map(x => `<th>${x}</th>`).join("")}<th class="c">STRIKE</th>${h.slice().reverse().map(x => `<th>${x}</th>`).join("")}</tr>
    </thead><tbody>${html}</tbody></table></div>`;
}

async function loadTerm(sym) {
  try {
    const t = await FE.api("/api/derivatives/ivterm?" + FE.qs({ symbol: sym }));
    if (!document.getElementById("chTerm") || st.chain?.symbol !== sym) return;
    const lab = t.term.map(x => x.exp.slice(5) + ` (${x.dte}d)`);
    FE.chart("chTerm", { type: "line", data: { labels: lab, datasets: [
      FE.line("ATM IV %", t.term.map(x => x.atm_iv == null ? null : x.atm_iv * 100), C.info, { pointRadius: 3, yAxisID: "y" }),
      FE.line("풋/콜 비율 (OI)", t.term.map(x => x.pcr_oi), C.warn, { pointRadius: 2, borderDash: [4, 3], yAxisID: "y1" })] },
      options: FE.chartOpts({ legend: true, xTicks: 7, yFmt: v => v.toFixed(1) + "%", scales: { y1: { position: "left", grid: { display: false }, ticks: { callback: v => v.toFixed(1) } } } }) });
  } catch { const c = document.getElementById("chTerm"); if (c) c.parentElement.innerHTML = `<div class="empty">기간구조를 불러오지 못했습니다.</div>`; }
}

/* ====================================================================== */
/* PRICER                                                                  */
/* ====================================================================== */
function viewPricer(b) {
  const p = st.p;
  const inp = (id, v, step = "any") => `<input class="inp" id="${id}" type="number" step="${step}" value="${v}">`;
  b.innerHTML = `<div class="grid cols-3">
    ${FE.panel({ title: "입력 INPUTS", color: "orange", bar: true, body: `<div class="form" id="prForm" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      ${FE.field("옵션 종류", `<select class="inp" id="prKind"><option value="call">콜 (오를 때 이익)</option><option value="put">풋 (내릴 때 이익)</option></select>`)}
      ${FE.field("포지션", `<select class="inp" id="prSide"><option value="long">매수 (Long)</option><option value="short">매도 (Short)</option></select>`)}
      ${FE.field("기초자산 가격 S", inp("prS", p.S))}
      ${FE.field(FE.term("strike", "행사가 K"), inp("prK", p.K))}
      ${FE.field("만기까지 일수", inp("prD", p.days, 1))}
      ${FE.field(FE.term("vol", "변동성 σ (%)"), inp("prV", p.sigma))}
      ${FE.field(FE.term("rf", "무위험 이자율 (%)"), inp("prR", p.r))}
      ${FE.field("배당수익률 (%)", inp("prQ", p.q))}
      </div><div class="note" style="margin-top:8px">값을 바꾸면 바로 다시 계산돼요. 옵션 체인에서 행을 클릭하면 실제 시세로 채워집니다.</div>` })}
    ${FE.panel({ title: "이론가 PRICE", color: "cyan", bodyId: "prRes", body: `<div class="loading">계산 중…</div>` })}
    ${FE.panel({ title: "그릭스 · 이항모형", color: "purple", bodyId: "prGreek", body: "" })}
    </div>
    <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">
      <div style="display:flex;flex-direction:column;gap:8px">
      ${FE.panel({ title: "내재변동성 역산 IV SOLVER", color: "magenta", bar: true, body: `<div class="form" style="grid-template-columns:1fr auto">
        ${FE.field("옵션 시장가격 (위 입력값 사용)", `<input class="inp" id="ivPx" type="number" step="any" value="${p.mkt ? (+p.mkt).toFixed(2) : ""}" placeholder="예: 3.25">`)}
        <button class="btn solid" id="ivGo">IV 계산</button></div><div id="ivOut" style="margin-top:8px"><div class="note">옵션 가격을 넣으면 그 가격에 녹아 있는 ${FE.term("iv", "내재변동성")}을 찾아요 (이분법 풀이).</div></div>` })}
      ${cpanel({ id: "prVolC", title: "변동성에 따른 가격", color: "blue", unit: "옵션 이론가 vs 변동성 %", src: SRC_CALC, h: "sm" })}
      </div>
      ${cpanel({ id: "prPay", title: "손익 곡선 PAYOFF", color: "orange", unit: "1주(1단위) 기준 손익", src: SRC_CALC, h: "lg", acts: `<span class="legend"><span><i style="background:${C.accent}"></i>만기</span><span><i style="background:${C.cyan}"></i>현재</span><span><i style="background:${C.purple}"></i>만기 절반 시점</span></span>` })}
    </div>
    <div class="grid cols-4">
      ${cpanel({ id: "prGd", title: "델타 vs 주가", color: "green", unit: "델타", src: SRC_CALC, h: "sm" })}
      ${cpanel({ id: "prGg", title: "감마 vs 주가", color: "cyan", unit: "감마", src: SRC_CALC, h: "sm" })}
      ${cpanel({ id: "prGv", title: "베가 vs 주가", color: "purple", unit: "변동성 1%p당 가격 변화", src: SRC_CALC, h: "sm" })}
      ${cpanel({ id: "prGt", title: "세타 vs 주가", color: "red", unit: "하루당 가격 변화", src: SRC_CALC, h: "sm" })}
    </div>
    ${cpanel({ id: "prDecay", title: "시간가치 감소 TIME DECAY", color: "yellow", unit: "옵션 이론가 (현재 주가·변동성 고정)", src: SRC_CALC,
      note: `만기가 다가올수록 ${FE.term("dv_tv", "시간가치")}가 점점 빠르게 줄어요 (등가격 옵션일수록 마지막 몇 주에 급감).` })}`;
  $("#prKind").value = p.kind; $("#prSide").value = p.side;
  const run = debounce(calcPricer, 250);
  $("#prForm").addEventListener("input", run); $("#prForm").addEventListener("change", run);
  $("#ivGo").onclick = solveIV;
  $("#ivPx").addEventListener("keydown", e => { if (e.key === "Enter") solveIV(); });
  calcPricer();
}

function readPricer() {
  const p = st.p;
  Object.assign(p, { kind: $("#prKind").value, side: $("#prSide").value, S: numv("#prS"), K: numv("#prK"), days: numv("#prD"), sigma: numv("#prV"), r: numv("#prR"), q: numv("#prQ") });
  return p;
}

async function calcPricer() {
  const p = readPricer();
  try {
    const d = await FE.api("/api/derivatives/price", p);
    if (!document.getElementById("prRes")) return;
    const sd = d.side === 1 ? "매수" : "매도", kn = d.kind === "call" ? "콜" : "풋";
    $("#prRes").innerHTML = `<div class="dv-h">${kn} ${sd} · 1주당 이론가</div><div class="dv-big">${FE.num(d.price, 4)}</div>` + FE.kv([
      [FE.term("dv_intr", "내재가치"), FE.num(d.intrinsic, 4)],
      [FE.term("dv_tv", "시간가치"), FE.num(d.time_value, 4)],
      [FE.term("be", "손익분기점 (만기)"), FE.num(d.breakeven, 2), "c-orange"],
      ["만기 내가격 확률 N(d2)", FE.pct(d.prob_itm, 1)],
      ["d1 / d2", `${FE.num(d.d1, 4)} / ${FE.num(d.d2, 4)}`, "w"],
      [FE.term("dv_parity", `패리티: 같은 조건 ${d.parity.kind === "call" ? "콜" : "풋"}`), FE.num(d.parity.price, 4)],
      ["콜 − 풋 = S·e^(−qT) − K·e^(−rT)", `${FE.num(d.parity.check, 4)} = ${FE.num(d.parity.fwd_minus_k, 4)}`, "w"],
    ]);
    const bn = d.binomial;
    $("#prGreek").innerHTML = FE.kv([
      [FE.term("delta", "델타 Δ"), FE.num(d.delta * d.side, 4), d.delta * d.side >= 0 ? "pos" : "neg"],
      [FE.term("gamma", "감마 Γ"), FE.num(d.gamma * d.side, 5)],
      [FE.term("vega", "베가 ν (1%p)"), FE.num(d.vega * d.side, 4)],
      [FE.term("theta", "세타 Θ (1일)"), FE.num(d.theta * d.side, 4), d.theta * d.side >= 0 ? "pos" : "neg"],
      [FE.term("rho", "로 ρ (1%p)"), FE.num(d.rho * d.side, 4)],
    ]) + `<hr class="d"><div class="dv-h">${FE.term("dv_binom", "CRR 이항모형")} (${bn.steps}단계)</div>` + FE.kv([
      [FE.term("dv_amer", "미국식 (조기행사 가능)"), FE.num(bn.american, 4), "c-orange"],
      ["유럽식 (만기에만 행사)", FE.num(bn.european, 4)],
      ["블랙-숄즈 (유럽식)", FE.num(d.price, 4)],
      [FE.term("dv_early", "조기행사 프리미엄"), FE.num(bn.early_premium, 4), bn.early_premium > 0.0001 ? "c-yellow" : ""],
    ]);
    const x = d.curve.x;
    FE.chart("prPay", { type: "line", data: { datasets: [
      FE.line("만기 손익", pts(x, d.curve.expiry), C.accent, { borderWidth: 2.2, fill: pnlFill }),
      FE.line("현재 손익", pts(x, d.curve.today), C.cyan),
      FE.line("만기 절반 시점", pts(x, d.curve.half), C.purple, { borderDash: [4, 3], borderWidth: 1.2 })] },
      options: FE.chartOpts({ xType: "linear", y: { grid: zeroGrid }, x: { title: { display: true, text: "만기 시 기초자산 가격" } } }),
      plugins: [vlines([{ x: p.S, color: C.text2, label: "현재가" }, { x: p.K, color: C.warn, label: "행사가", row: 1 }, { x: d.breakeven, color: C.accent, label: "손익분기", row: 2 }])] });
    [["prGd", "delta", C.pos], ["prGg", "gamma", C.cyan], ["prGv", "vega", C.purple], ["prGt", "theta", C.neg]].forEach(([id, k, col]) =>
      FE.chart(id, { type: "line", data: { datasets: [FE.line(k, pts(x, d.greeks_curve[k]), col)] },
        options: FE.chartOpts({ xType: "linear", y: { grid: zeroGrid } }), plugins: [vlines([{ x: p.S, color: C.text2 }, { x: p.K, color: C.warn }])] }));
    FE.chart("prDecay", { type: "line", data: { labels: d.decay.days_left, datasets: [FE.line("이론가", d.decay.value, C.warn, { fill: { target: "origin", above: "rgba(202,138,4,.12)" } })] },
      options: FE.chartOpts({ x: { reverse: false, title: { display: true, text: "만기까지 남은 일수" } } }) });
    FE.chart("prVolC", { type: "line", data: { datasets: [FE.line("이론가", pts(d.volcurve.vol, d.volcurve.value), C.info)] },
      options: FE.chartOpts({ xType: "linear", x: { title: { display: true, text: "변동성 (%)" } } }), plugins: [vlines([{ x: p.sigma, color: C.accent, label: "입력 변동성" }])] });
  } catch (e) { const r = document.getElementById("prRes"); if (r) FE.error(r, e); }
}

async function solveIV() {
  const p = readPricer(); const out = $("#ivOut");
  try {
    const d = await FE.api("/api/derivatives/iv", { ...p, price: numv("#ivPx") });
    out.innerHTML = `<div class="dv-h">내재변동성</div><div class="dv-big c-magenta">${FE.pct(d.iv, 2)}</div>` + FE.kv([
      ["모형 가격 (검산)", FE.num(d.model_price, 4)], [FE.term("delta", "델타"), FE.num(d.delta, 4)], [FE.term("vega", "베가"), FE.num(d.vega, 4)],
      ["입력 변동성과 차이", `${FE.chg(d.iv * 100 - p.sigma, 2)}%p`, d.iv * 100 > p.sigma ? "neg" : "pos"]]) +
      `<button class="btn" id="ivApply" style="margin-top:6px">이 IV를 계산기에 적용</button>`;
    $("#ivApply").onclick = () => { $("#prV").value = (d.iv * 100).toFixed(2); calcPricer(); };
  } catch (e) { FE.error(out, e); }
}

/* ====================================================================== */
/* STRATEGY BUILDER                                                        */
/* ====================================================================== */
const TPL = [
  ["longcall", "롱콜", "콜 1개 매수 — 상승에 베팅, 손실은 프리미엄으로 제한"],
  ["longput", "롱풋", "풋 1개 매수 — 하락에 베팅"],
  ["covered", "커버드콜", "주식 보유 + 외가격 콜 매도"],
  ["protput", "보호적 풋", "주식 보유 + 외가격 풋 매수"],
  ["bullcall", "불 콜 스프레드", "ATM 콜 매수 + 높은 행사가 콜 매도"],
  ["bearput", "베어 풋 스프레드", "ATM 풋 매수 + 낮은 행사가 풋 매도"],
  ["straddle", "스트래들", "ATM 콜 + ATM 풋 매수 — 큰 변동에 베팅"],
  ["strangle", "스트랭글", "외가격 콜 + 외가격 풋 매수"],
  ["condor", "아이언 콘도르", "풋 스프레드 + 콜 스프레드 매도 — 박스권에 베팅"],
  ["butterfly", "버터플라이", "콜 1 : −2 : 1 — 가운데 행사가에 수렴할 때 최대 이익"],
  ["calendar", "캘린더 (근사)", "근월 콜 매도 + 원월 콜 매수 (같은 행사가)"],
];
function tplLegs(id, S, days) {
  const k = m => snapK(S, S * m), L = (kind, side, m, qty = 1, dd = days) => ({ kind, side, K: kind === "stock" ? "" : k(m), qty, days: kind === "stock" ? "" : dd, iv: "", premium: "" });
  return {
    longcall: [L("call", "long", 1)], longput: [L("put", "long", 1)],
    covered: [L("stock", "long", 1), L("call", "short", 1.05)], protput: [L("stock", "long", 1), L("put", "long", 0.95)],
    bullcall: [L("call", "long", 1), L("call", "short", 1.05)], bearput: [L("put", "long", 1), L("put", "short", 0.95)],
    straddle: [L("call", "long", 1), L("put", "long", 1)], strangle: [L("call", "long", 1.05), L("put", "long", 0.95)],
    condor: [L("put", "long", 0.9), L("put", "short", 0.95), L("call", "short", 1.05), L("call", "long", 1.1)],
    butterfly: [L("call", "long", 0.95), L("call", "short", 1, 2), L("call", "long", 1.05)],
    calendar: [L("call", "short", 1, 1, days), L("call", "long", 1, 1, days * 2)],
  }[id];
}

function viewStrategy(b) {
  st.s ??= { tpl: "condor", S: 100, sigma: 25, r: 4.2, q: 0, mult: 100, days: 30, sym: st.sym || "SPY", legs: tplLegs("condor", 100, 30) };
  const s = st.s;
  const inp = (id, v, w = "") => `<input class="inp" id="${id}" type="number" step="any" value="${v}" ${w}>`;
  b.innerHTML = `
    ${FE.panel({ title: "전략 템플릿 TEMPLATES", color: "orange", bar: true, body: `${FE.pills("stTpl", TPL.map(t => [t[0], t[1]]), s.tpl)}
      <div class="note" id="stTplDesc" style="margin-top:6px"></div>
      <div class="form" id="stGlobal" style="margin-top:8px;grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
        ${FE.field("기초자산 가격 S", inp("stS", s.S))}
        ${FE.field(FE.term("vol", "기본 변동성 σ (%)"), inp("stV", s.sigma))}
        ${FE.field(FE.term("rf", "무위험 이자율 (%)"), inp("stR", s.r))}
        ${FE.field("배당수익률 (%)", inp("stQ", s.q))}
        ${FE.field(FE.term("dv_mult", "계약 승수"), inp("stM", s.mult))}
        ${FE.field("기본 만기 (일)", inp("stD", s.days))}
      </div>
      <div class="row dv-ctl" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border-dim)">
        <span class="c-cyan" style="font-weight:700">실시간 체인으로 채우기</span>
        ${FE.field("종목", `<input class="inp" id="stSym" value="${FE.esc(s.sym)}" style="width:90px" spellcheck="false">`)}
        ${FE.field("만기일", `<select class="inp" id="stExp" style="min-width:150px"><option value="">(종목 입력 후 불러오기)</option></select>`)}
        <button class="btn" id="stExpLoad">만기 목록</button><button class="btn solid" id="stChain">체인 시세 적용</button>
        <span class="note" id="stChainMsg">현재가·ATM IV·행사가별 중간가(매수·매도호가 평균)로 프리미엄을 채웁니다.</span>
      </div>` })}
    ${FE.panel({ title: "포지션 LEGS", color: "cyan", bar: true, acts: `<button class="btn" id="stAdd">+ 레그 추가</button>`, flush: true, bodyId: "stLegs" })}
    <div id="stStats"></div>
    <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
      ${cpanel({ id: "stPay", title: "전략 손익 PAYOFF", color: "orange", unit: "USD (계약 승수 반영)", src: SRC_CALC + " · 옵션 프리미엄 미입력 시 블랙-숄즈 이론가", h: "lg",
        acts: `<span class="legend"><span><i style="background:${C.accent}"></i>만기</span><span><i style="background:${C.cyan}"></i>현재</span><span><i style="background:${C.purple}"></i>절반 경과</span></span>` })}
      ${FE.panel({ title: "포지션 그릭스 NET GREEKS", color: "purple", bodyId: "stGreeks", body: "" })}
    </div>`;
  const recalc = debounce(calcStrategy, 300);
  const setTpl = id => {
    s.tpl = id; $("#stTplDesc").innerHTML = TPL.find(t => t[0] === id)[2] + (id === "calendar" ? ` · ${FE.term("dv_calendar", "근사 방식 설명")}` : "");
    readGlobal(); s.legs = tplLegs(id, s.S, s.days); drawLegs(); calcStrategy();
  };
  FE.onPills(b, "stTpl", setTpl);
  $("#stTplDesc").innerHTML = TPL.find(t => t[0] === s.tpl)[2];
  $("#stGlobal").addEventListener("input", () => { readGlobal(); recalc(); });
  $("#stAdd").onclick = () => { readLegs(); if (s.legs.length >= 8) return FE.toast("레그는 최대 8개입니다.", true); s.legs.push({ kind: "call", side: "long", K: snapK(s.S, s.S), qty: 1, days: s.days, iv: "", premium: "" }); drawLegs(); calcStrategy(); };
  $("#stExpLoad").onclick = loadStratExps;
  $("#stSym").addEventListener("keydown", e => { if (e.key === "Enter") loadStratExps(); });
  $("#stChain").onclick = applyChain;
  drawLegs(); calcStrategy();
}

function readGlobal() {
  const s = st.s; const g = id => numv(id);
  Object.assign(s, { S: g("#stS") ?? s.S, sigma: g("#stV") ?? s.sigma, r: g("#stR") ?? 0, q: g("#stQ") ?? 0, mult: g("#stM") ?? 100, days: g("#stD") ?? 30 });
}
function drawLegs(resolved) {
  const s = st.s, box = $("#stLegs"); if (!box) return;
  const opt = (v, list) => list.map(([a, l]) => `<option value="${a}" ${a === v ? "selected" : ""}>${l}</option>`).join("");
  box.innerHTML = `<div class="tbl-wrap"><table class="tbl dv-legs"><thead><tr><th class="l">#</th><th class="l">종류</th><th class="l">방향</th><th>${FE.term("strike", "행사가")}</th><th>수량</th><th>만기(일)</th><th>${FE.term("iv", "IV %")}</th><th>프리미엄 (1주)</th><th>적용 프리미엄</th><th>비용 (승수 반영)</th><th></th></tr></thead><tbody>
    ${s.legs.map((L, i) => { const R = resolved?.[i]; const stock = L.kind === "stock";
      return `<tr data-i="${i}">
      <td class="l c-dim">${i + 1}</td>
      <td class="l"><select class="inp" data-f="kind">${opt(L.kind, [["call", "콜"], ["put", "풋"], ["stock", "주식"]])}</select></td>
      <td class="l"><select class="inp" data-f="side">${opt(L.side, [["long", "매수"], ["short", "매도"]])}</select></td>
      <td><input class="inp" data-f="K" type="number" step="any" value="${L.K}" ${stock ? "disabled placeholder='—'" : ""}></td>
      <td><input class="inp" data-f="qty" type="number" step="any" value="${L.qty}"></td>
      <td><input class="inp" data-f="days" type="number" step="1" value="${L.days}" ${stock ? "disabled placeholder='—'" : `placeholder="${s.days}"`}></td>
      <td><input class="inp" data-f="iv" type="number" step="any" value="${L.iv}" ${stock ? "disabled" : `placeholder="${s.sigma}"`}></td>
      <td><input class="inp" data-f="premium" type="number" step="any" value="${L.premium}" placeholder="${stock ? "매입가 " + s.S : "자동 (BSM)"}"></td>
      <td class="${R?.auto ? "c-cyan" : "c-white"}">${R ? FE.num(R.premium, 4) + (R.auto ? " <span class='c-dim'>BSM</span>" : "") : "—"}</td>
      <td class="${R ? (R.side * R.premium > 0 ? "neg" : "pos") : ""}">${R ? FE.num(-R.side * R.qty * R.premium * s.mult, 2) : "—"}</td>
      <td><button class="dv-rm" data-rm="${i}" title="삭제">✕</button></td></tr>`; }).join("")}
    </tbody></table></div><div class="note" style="padding:5px 10px">비용 열: 음수 = 지불(데빗), 양수 = 수취(크레딧). 주식 레그 1개 × 승수 100 = 100주. 빈 칸은 기본값(만기·IV)과 블랙-숄즈 이론가를 써요.</div>`;
  const recalc = debounce(calcStrategy, 350);
  box.querySelectorAll("[data-f]").forEach(x => { x.addEventListener("input", recalc); x.addEventListener("change", recalc); });
  box.querySelectorAll("[data-rm]").forEach(x => x.onclick = () => { readLegs(); if (s.legs.length <= 1) return FE.toast("레그는 최소 1개가 필요합니다.", true); s.legs.splice(+x.dataset.rm, 1); drawLegs(); calcStrategy(); });
}
function readLegs() {
  const s = st.s; const box = $("#stLegs"); if (!box) return;
  box.querySelectorAll("tr[data-i]").forEach(tr => {
    const L = s.legs[+tr.dataset.i]; if (!L) return;
    tr.querySelectorAll("[data-f]").forEach(x => { L[x.dataset.f] = x.value; });
  });
}

async function calcStrategy() {
  const s = st.s; readGlobal(); readLegs();
  const legs = s.legs.map(L => ({ kind: L.kind, side: L.side, K: L.K === "" ? null : +L.K, qty: L.qty === "" ? 1 : +L.qty,
    days: L.days === "" ? s.days : +L.days, iv: L.iv === "" ? null : +L.iv, premium: L.premium === "" ? null : +L.premium }));
  // a kind change from stock → option leaves K empty: fill with ATM
  legs.forEach((L, i) => { if (L.kind !== "stock" && (L.K == null || isNaN(L.K))) { L.K = snapK(s.S, s.S); s.legs[i].K = L.K; } });
  try {
    const d = await FE.api("/api/derivatives/strategy", { S: s.S, sigma: s.sigma, r: s.r, q: s.q, mult: s.mult, legs });
    if (!document.getElementById("stPay")) return;
    // redraw legs only if the kind changed (to toggle disabled fields); otherwise update resolved columns in place
    const kinds = [...$("#stLegs").querySelectorAll('[data-f="kind"]')].map(x => x.value).join();
    if (kinds !== s._kinds) { s._kinds = kinds; drawLegs(d.legs); } else updateResolved(d.legs);
    const net = d.net_premium;
    $("#stStats").innerHTML = FE.stats([
      { l: FE.term("dv_net", net >= 0 ? "순 지불 (데빗)" : "순 수취 (크레딧)"), v: usd(Math.abs(net)), vcls: net >= 0 ? "neg" : "pos", d: `승수 ${FE.num(s.mult, 0)} 반영` },
      { l: "최대 이익", v: d.unlimited_profit ? "무제한" : usd(d.max_profit), vcls: "pos", d: `만기(${FE.num(d.horizon, 0)}일) 기준` },
      { l: "최대 손실", v: d.unlimited_loss ? "무제한" : usd(d.max_loss), vcls: "neg", d: "주가 0 ~ 무한대 범위" },
      { l: FE.term("be", "손익분기점"), v: `<span style="font-size:16px">${d.breakevens.length ? d.breakevens.map(x => FE.num(x, 2)).join(" / ") : "없음"}</span>`, d: d.breakevens.length ? d.breakevens.map(x => FE.spct(x / s.S - 1, 1)).join(" / ") : "" },
      { l: FE.term("dv_pop", "수익 확률"), v: FE.pct(d.pop, 1), vcls: d.pop >= 0.5 ? "pos" : "", d: `로그정규 · σ ${FE.num(s.sigma, 1)}%` },
      { l: "기대 손익 (모형)", v: usd(d.expected_pnl), vcls: FE.cls(d.expected_pnl), d: `±1σ 범위 ${FE.num(d.sd_range[0], 1)}~${FE.num(d.sd_range[1], 1)}` },
    ]);
    const g = d.greeks;
    $("#stGreeks").innerHTML = FE.kv([
      [FE.term("delta", "델타 (주식 환산 주수)"), FE.num(g.delta, 2), g.delta >= 0 ? "pos" : "neg"],
      [FE.term("gamma", "감마"), FE.num(g.gamma, 3)],
      [FE.term("vega", "베가 (IV 1%p당 USD)"), FE.num(g.vega, 2), g.vega >= 0 ? "pos" : "neg"],
      [FE.term("theta", "세타 (하루당 USD)"), FE.num(g.theta, 2), g.theta >= 0 ? "pos" : "neg"],
      [FE.term("rho", "로 (금리 1%p당 USD)"), FE.num(g.rho, 2)],
    ]) + `<hr class="d"><div class="note">· 델타 ${FE.chg(g.delta, 1)}: 주가가 1달러 오르면 약 ${FE.num(Math.abs(g.delta), 1)}달러 ${g.delta >= 0 ? "이익" : "손실"}.<br>
      · 세타가 양수면 시간이 지날수록 유리(옵션 매도형), 음수면 불리(매수형)해요.<br>· 손익 계산은 수수료·세금·조기행사를 반영하지 않은 학습용 근사치입니다.</div>`;
    const lines = [{ x: s.S, color: C.text2, label: "현재가" }].concat(d.breakevens.map((x, i) => ({ x, color: C.accent, label: "BE", row: 1 + (i % 2) })));
    FE.chart("stPay", { type: "line", data: { datasets: [
      FE.line("만기 손익", pts(d.x, d.expiry), C.accent, { borderWidth: 2.2, fill: pnlFill }),
      FE.line("현재 손익", pts(d.x, d.today), C.cyan),
      FE.line("절반 경과", pts(d.x, d.half), C.purple, { borderDash: [4, 3], borderWidth: 1.2 })] },
      options: FE.chartOpts({ xType: "linear", y: { grid: zeroGrid, ticks: { callback: v => FE.big(v, 1) } }, x: { min: d.x[0], max: d.x[d.x.length - 1], title: { display: true, text: "만기 시 기초자산 가격" } } }), plugins: [vlines(lines)] });
  } catch (e) { const x = document.getElementById("stStats"); if (x) x.innerHTML = `<div class="err">⚠ ${FE.esc(e.message)}</div>`; }
}
function updateResolved(R) {
  const s = st.s;
  $("#stLegs").querySelectorAll("tr[data-i]").forEach(tr => {
    const r = R[+tr.dataset.i]; if (!r) return; const td = tr.children;
    td[8].className = r.auto ? "c-cyan" : "c-white"; td[8].innerHTML = FE.num(r.premium, 4) + (r.auto ? " <span class='c-dim'>BSM</span>" : "");
    const cost = -r.side * r.qty * r.premium * s.mult; td[9].className = cost < 0 ? "neg" : "pos"; td[9].textContent = FE.num(cost, 2);
  });
}

async function loadStratExps() {
  const sym = $("#stSym").value.trim().toUpperCase(); if (!sym) return;
  st.s.sym = sym; $("#stChainMsg").textContent = "만기 목록을 불러오는 중…";
  try {
    const d = await FE.api("/api/derivatives/expirations?" + FE.qs({ symbol: sym }));
    const def = d.expirations.find(e => dteOf(e) >= 20) || d.expirations[0];
    $("#stExp").innerHTML = d.expirations.map(e => `<option value="${e}" ${e === def ? "selected" : ""}>${e} (${dteOf(e)}일)</option>`).join("");
    $("#stChainMsg").textContent = `${sym}: 만기 ${d.expirations.length}개. 만기를 고른 뒤 '체인 시세 적용'을 누르세요.`;
  } catch (e) { $("#stChainMsg").innerHTML = `<span class="neg">${FE.esc(e.message)}</span>`; }
}
async function applyChain() {
  const s = st.s; const sym = $("#stSym").value.trim().toUpperCase();
  if (!$("#stExp").value) { await loadStratExps(); if (!$("#stExp").value) return; }
  $("#stChainMsg").textContent = "체인 시세를 적용하는 중…";
  try {
    const d = await FE.api("/api/derivatives/chain?" + FE.qs({ symbol: sym, exp: $("#stExp").value }));
    const ks = d.rows.map(r => r.strike);
    const near = k => ks.reduce((a, b) => Math.abs(b - k) < Math.abs(a - k) ? b : a, ks[0]);
    s.S = +d.spot.toFixed(2); s.sigma = +((d.atm_iv || 0.25) * 100).toFixed(1); s.days = Math.max(1, d.dte);
    $("#stS").value = s.S; $("#stV").value = s.sigma; $("#stD").value = s.days;
    s.legs = tplLegs(s.tpl, s.S, s.days);
    let miss = 0;
    s.legs.forEach(L => {
      if (L.kind === "stock") { L.premium = s.S; return; }
      L.K = near(+L.K);
      if (+L.days !== s.days) { L.premium = ""; return; } // far leg of a calendar: model price
      const r = d.rows.find(x => x.strike === L.K); const mid = L.kind === "call" ? r?.c_mid : r?.p_mid; const iv = L.kind === "call" ? r?.c_iv : r?.p_iv;
      if (mid) L.premium = +mid.toFixed(3); else miss++;
      if (iv) L.iv = +(iv * 100).toFixed(1);
    });
    s._kinds = null; drawLegs(); calcStrategy();
    $("#stChainMsg").innerHTML = `<span class="c-green">${sym} ${d.expiration} 시세 적용 완료</span> · 현재가 ${usd(d.spot)} · ATM IV ${FE.pct(d.atm_iv, 1)}${miss ? ` · 호가 없는 레그 ${miss}개는 BSM 이론가 사용` : ""}${s.tpl === "calendar" ? " · 원월물 레그는 BSM 이론가" : ""}`;
  } catch (e) { $("#stChainMsg").innerHTML = `<span class="neg">${FE.esc(e.message)}</span>`; }
}

/* ====================================================================== */
/* BONDS                                                                   */
/* ====================================================================== */
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addY = (y) => { const d = new Date(); d.setFullYear(d.getFullYear() + y); return iso(d); };
const BPRE = [
  ["us10", "미 국채 10년 (예시)", { coupon: 4.25, ytm: 4.6, freq: 2, years: 10 }],
  ["kr3", "한국 국고채 3년 (예시)", { coupon: 2.75, ytm: 2.6, freq: 2, years: 3 }],
  ["corp5", "회사채 5년 (예시)", { coupon: 5.0, ytm: 5.6, freq: 4, years: 5 }],
  ["zero", "제로쿠폰 5년", { coupon: 0, ytm: 4.0, freq: 1, years: 5 }],
  ["long30", "초장기 30년", { coupon: 4.5, ytm: 5.0, freq: 2, years: 30 }],
];
function viewBond(b) {
  st.b ??= { mode: "ytm", face: 10000, coupon: 4.25, ytm: 4.6, price: 97, freq: 2, settle: iso(new Date()), maturity: addY(10), issue: "" };
  const s = st.b;
  b.innerHTML = `<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">
    ${FE.panel({ title: "채권 입력 BOND", color: "orange", bar: true, body: `
      ${FE.pills("bdMode", [["ytm", "수익률 → 가격"], ["price", "가격 → 수익률"]], s.mode)}
      <div class="form" id="bdForm" style="margin-top:8px;grid-template-columns:repeat(2,minmax(0,1fr))">
        ${FE.field("액면 금액 (보유 금액)", `<input class="inp" id="bdFace" type="number" step="any" value="${s.face}">`)}
        ${FE.field(FE.term("dv_coupon", "표면금리 (%)"), `<input class="inp" id="bdCpn" type="number" step="any" value="${s.coupon}">`)}
        ${FE.field(FE.term("ytm", "만기수익률 YTM (%)"), `<input class="inp" id="bdYtm" type="number" step="any" value="${s.ytm}">`)}
        ${FE.field(FE.term("dv_clean", "클린 가격 (액면 100)"), `<input class="inp" id="bdPx" type="number" step="any" value="${s.price}">`)}
        ${FE.field("이자 지급 (연)", `<select class="inp" id="bdFreq">${[[1, "연 1회"], [2, "연 2회 (반기)"], [4, "연 4회 (분기)"], [12, "연 12회 (월)"]].map(([v, l]) => `<option value="${v}" ${v === s.freq ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
        ${FE.field("결제일", `<input class="inp" id="bdSettle" type="date" value="${s.settle}">`)}
        ${FE.field("만기일", `<input class="inp" id="bdMat" type="date" value="${s.maturity}">`)}
        ${FE.field("발행일 (선택)", `<input class="inp" id="bdIssue" type="date" value="${s.issue}">`)}
      </div>
      <div class="dv-h" style="margin-top:10px">예시 채권</div>${FE.pills("bdPre", BPRE.map(p => [p[0], p[1]]), "")}
      <div class="note" style="margin-top:8px">액면 100 기준 가격, 이자 지급 주기 복리 기준 수익률(시장 관행)로 계산합니다. 계산 엔진: Fincept derivatives_pricing.py 채권 모듈.</div>
      <hr class="d"><div class="note">
      · 채권 가격과 금리는 반대로 움직여요. 시장 금리(YTM)가 표면금리보다 높으면 100보다 싸게(할인), 낮으면 비싸게(할증) 거래됩니다.<br>
      · ${FE.term("duration", "수정 듀레이션")}이 8이면 금리가 1%p 오를 때 가격이 약 8% 떨어져요. 만기가 길고 표면금리가 낮을수록 듀레이션이 커집니다.<br>
      · ${FE.term("convexity", "볼록성")} 덕분에 금리가 내릴 때 오르는 폭이 금리가 오를 때 내리는 폭보다 커요 (곡선이 아래로 볼록).</div>` })}
    <div style="display:flex;flex-direction:column;gap:8px">
      <div id="bdStats"></div>
      ${cpanel({ id: "bdPY", title: "가격-수익률 곡선 PRICE / YIELD", color: "cyan", unit: "클린 가격 (액면 100) vs YTM %", src: "자체 계산 · 실선 = 실제 가격, 점선 = 듀레이션 근사, 보라 = 듀레이션+볼록성 근사", h: "lg" })}
    </div></div>
    <div class="grid cols-2">
      ${FE.panel({ title: "금리 충격 RATE SHOCK", color: "red", bar: true, flush: true, bodyId: "bdShock" })}
      ${cpanel({ id: "bdCF", title: "현금흐름 CASH FLOWS", color: "green", unit: "입력한 액면 금액 기준", src: "자체 계산 · 막대 = 받는 금액, 선 = 현재가치(PV)" })}
    </div>
    ${FE.panel({ title: "현금흐름표 CASH-FLOW TABLE", color: "yellow", flush: true, bodyId: "bdFlows" })}`;
  const run = debounce(calcBond, 300);
  $("#bdForm").addEventListener("input", run); $("#bdForm").addEventListener("change", run);
  FE.onPills(b, "bdMode", v => { s.mode = v; syncMode(); calcBond(); });
  FE.onPills(b, "bdPre", v => { const p = BPRE.find(x => x[0] === v)[2]; $("#bdCpn").value = p.coupon; $("#bdYtm").value = p.ytm; $("#bdFreq").value = p.freq; $("#bdMat").value = addY(p.years); $("#bdSettle").value = iso(new Date()); $("#bdIssue").value = ""; s.mode = "ytm"; b.querySelectorAll('[data-pills="bdMode"] .pill').forEach(x => x.classList.toggle("on", x.dataset.v === "ytm")); syncMode(); calcBond(); });
  syncMode(); calcBond();
}
function syncMode() { const s = st.b; $("#bdYtm").disabled = s.mode === "price"; $("#bdPx").disabled = s.mode === "ytm"; }
async function calcBond() {
  const s = st.b;
  Object.assign(s, { face: numv("#bdFace"), coupon: numv("#bdCpn"), ytm: numv("#bdYtm"), price: numv("#bdPx"), freq: +$("#bdFreq").value,
    settle: $("#bdSettle").value, maturity: $("#bdMat").value, issue: $("#bdIssue").value });
  try {
    const d = await FE.api("/api/derivatives/bond", { ...s });
    if (!document.getElementById("bdPY")) return;
    if (s.mode === "ytm") $("#bdPx").value = d.clean_price.toFixed(4); else $("#bdYtm").value = d.ytm.toFixed(4);
    const face = s.face;
    $("#bdStats").innerHTML = FE.stats([
      { l: FE.term("dv_clean", "클린 가격"), v: FE.num(d.clean_price, 4), d: `${d.premium_discount} 채권 · ${FE.num(d.value_clean, 2)}` },
      { l: FE.term("dv_clean", "더티 가격"), v: FE.num(d.dirty_price, 4), vcls: "sm", d: `지불액 ${FE.num(d.value_dirty, 2)}` },
      { l: FE.term("dv_accr", "경과이자"), v: FE.num(d.accrued_interest, 4), vcls: "sm", d: FE.num(d.accrued_value, 2) },
      { l: FE.term("ytm", "만기수익률"), v: FE.num(d.ytm, 3) + "%", d: `${FE.term("dv_cy", "경상수익률")} ${FE.num(d.current_yield, 3)}%` },
      { l: FE.term("dv_mac", "맥컬리 듀레이션"), v: FE.num(d.duration, 3), vcls: "sm", d: "년" },
      { l: FE.term("duration", "수정 듀레이션"), v: FE.num(d.modified_duration, 3), vcls: "sm", d: `금리 +1%p → 약 ${FE.num(-d.modified_duration, 2)}%` },
      { l: FE.term("convexity", "볼록성"), v: FE.num(d.convexity, 2), vcls: "sm", d: `잔여 이표 ${d.remaining_coupons}회` },
      { l: FE.term("dv_dv01", "DV01"), v: FE.num(d.dv01, 2), vcls: "sm", d: `다음 이자일 ${d.next_coupon_date}` },
    ]);
    FE.chart("bdPY", { type: "line", data: { datasets: [
      FE.line("실제 가격", pts(d.py.ytm, d.py.price), C.cyan, { borderWidth: 2.2 }),
      FE.line("듀레이션 근사", pts(d.py.ytm, d.py.dur), C.warn, { borderDash: [5, 4], borderWidth: 1.2 }),
      FE.line("듀레이션+볼록성", pts(d.py.ytm, d.py.durconv), C.purple, { borderDash: [2, 3], borderWidth: 1.2 })] },
      options: FE.chartOpts({ legend: true, xType: "linear", x: { title: { display: true, text: "만기수익률 (%)" } } }),
      plugins: [vlines([{ x: d.ytm, color: C.accent, label: `YTM ${FE.num(d.ytm, 2)}%` }])] });
    $("#bdShock").innerHTML = FE.table([
      { k: "bp", l: "금리 변화", a: "l", f: v => `<b class="${v > 0 ? "neg" : "pos"}">${v > 0 ? "+" : ""}${v}bp</b>` },
      { k: "ytm", l: "새 수익률", f: v => FE.num(v, 3) + "%" },
      { k: "clean", l: "클린 가격", f: v => FE.num(v, 3) },
      { k: "chg_pct", l: "실제 변화", f: v => `<span class="${FE.cls(v)}">${FE.spct(v)}</span>` },
      { k: "dur_est", l: "듀레이션 추정", f: v => FE.spct(v), tip: "−수정듀레이션 × Δy" },
      { k: "durconv_est", l: "+볼록성 추정", f: v => FE.spct(v), tip: "−D×Δy + ½×볼록성×Δy²" },
      { k: "pnl", l: `손익 (액면 ${FE.big(face, 0)})`, f: v => `<span class="${FE.cls(v)}">${FE.chg(v, 2)}</span>` },
    ], d.shocks) + `<div class="note" style="padding:6px 10px">금리가 오르면 채권 가격은 내려요. 변화가 클수록 듀레이션만으로는 오차가 커지고, ${FE.term("convexity", "볼록성")}을 더하면 실제 값에 가까워집니다.</div>`;
    FE.chart("bdCF", { type: "bar", data: { labels: d.flows.map(f => f.date.slice(0, 7)), datasets: [
      { type: "bar", label: "이자", data: d.flows.map(f => f.coupon), backgroundColor: "rgba(22,163,74,.7)", stack: "a" },
      { type: "bar", label: "원금", data: d.flows.map(f => f.principal), backgroundColor: "rgba(8,145,178,.7)", stack: "a" },
      { type: "line", label: "현재가치", data: d.flows.map(f => f.pv), borderColor: C.accent, backgroundColor: C.accent, pointRadius: 0, borderWidth: 1.5 }] },
      options: FE.chartOpts({ legend: true, xTicks: 10, yFmt: v => FE.big(v, 1), scales: { x: { stacked: true, ticks: { maxRotation: 0, autoSkipPadding: 20, maxTicksLimit: 10 } }, y: { stacked: true, position: "right", grid: { color: C.grid }, ticks: { callback: v => FE.big(v, 1) } } } }) });
    $("#bdFlows").innerHTML = FE.table([
      { k: "date", l: "지급일", a: "l" }, { k: "t", l: "기간 (년)", f: v => FE.num(v, 3) },
      { k: "coupon", l: "이자", f: v => FE.num(v, 2) }, { k: "principal", l: "원금", f: v => v ? FE.num(v, 2) : "—" },
      { k: "total", l: "합계", f: v => `<b class="c-white">${FE.num(v, 2)}</b>` }, { k: "df", l: "할인계수", f: v => FE.num(v, 5) },
      { k: "pv", l: "현재가치", f: v => `<span class="c-cyan">${FE.num(v, 2)}</span>` },
    ], d.flows, { maxH: "320px" });
  } catch (e) { const x = document.getElementById("bdStats"); if (x) x.innerHTML = `<div class="err">⚠ ${FE.esc(e.message)}</div>`; }
}

/* ====================================================================== */
/* VIX & FUTURES                                                           */
/* ====================================================================== */
function viewVix(b) {
  b.innerHTML = `<div id="vxStats"><div class="loading">VIX 기간구조를 불러오는 중…</div></div>
    <div class="grid cols-2">
      ${cpanel({ id: "vxTerm", title: "VIX 기간구조 TERM STRUCTURE", color: "orange", unit: "변동성 지수 (연율 %)", src: "Yahoo Finance (^VIX9D ^VIX ^VIX3M ^VIX6M ^VIX1Y)", h: "md",
        note: `만기가 길수록 높으면 ${FE.term("dv_contango", "콘탱고")}(평상시), 단기가 더 높으면 백워데이션(공포 국면).` })}
      ${cpanel({ id: "vxHist", title: "VIX vs VIX3M · 1년", color: "red", unit: "지수 · 비율(VIX÷VIX3M, 왼쪽 축)", src: "Yahoo Finance · 비율 1 초과 = 백워데이션", h: "md" })}
    </div>
    <div class="grid cols-2">
      ${cpanel({ id: "vxVvix", title: "VVIX · SKEW · 1년", color: "purple", unit: "지수", src: "CBOE 공개 CSV (cboe_vix_data.py)", h: "sm" })}
      ${FE.panel({ title: "주가지수 선물 베이시스 BASIS", color: "cyan", bar: true, flush: true, bodyId: "fxBasis", body: `<div class="loading">불러오는 중…</div>` })}
    </div>
    <div class="row" style="margin-top:2px"><span class="c-orange" style="font-weight:700;letter-spacing:1px">${FE.term("dv_curve", "선물 곡선 FUTURES CURVE")}</span><span id="fxRoots"></span></div>
    <div class="grid" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)">
      ${cpanel({ id: "fxCurve", title: "월물별 선물 가격", color: "yellow", unit: "상품별", src: "Yahoo Finance 월물 계약 시세 (예: CLZ26.NYM)", h: "md" })}
      ${FE.panel({ title: "월물 표 CONTRACTS", color: "yellow", flush: true, bodyId: "fxTbl" })}
    </div>
    ${FE.panel({ title: "주요 선물 근월물 FRONT MONTH", color: "green", bar: true, flush: true, bodyId: "fxFront" })}`;
  loadVix(); loadFut();
}
async function loadVix() {
  try {
    const d = await FE.api("/api/derivatives/vix");
    if (!document.getElementById("vxTerm")) return;
    const now = d.curves.now.values, vix = now[1], v3 = now[2];
    const back = d.ratio_now > 1;
    const last = a => a.values.length ? a.values[a.values.length - 1] : null;
    $("#vxStats").innerHTML = FE.stats([
      { l: FE.term("dv_vix", "VIX (30일)"), v: FE.num(vix, 2), vcls: vix >= 30 ? "neg" : vix >= 20 ? "c-yellow" : "pos", d: vix >= 30 ? "공포 국면" : vix >= 20 ? "경계" : "안정" },
      { l: "VIX9D (9일)", v: FE.num(now[0], 2), vcls: "sm" },
      { l: "VIX3M (3개월)", v: FE.num(v3, 2), vcls: "sm" },
      { l: "VIX ÷ VIX3M", v: FE.num(d.ratio_now, 3), vcls: back ? "neg" : "pos", d: back ? "백워데이션 (단기 공포)" : "콘탱고 (평상시)" },
      { l: FE.term("dv_contango", "1년 중 콘탱고 비율"), v: FE.pct(d.contango_days_pct, 0), vcls: "sm" },
      { l: "VIX 1년 백분위", v: FE.pct(d.vix_pctile, 0), vcls: "sm", d: "높을수록 최근 1년 중 불안" },
      { l: FE.term("dv_vvix", "VVIX"), v: FE.num(last(d.vvix), 1), vcls: "sm" },
      { l: FE.term("dv_skew", "SKEW"), v: FE.num(last(d.skew), 1), vcls: "sm" },
    ]);
    const labels = d.terms.map(t => t.label);
    const ds = [["now", "현재", C.accent, 2.4], ["w1", "1주 전", C.cyan, 1.4], ["m1", "1개월 전", C.purple, 1.4], ["m3", "3개월 전", C.text2, 1.2]]
      .filter(([k]) => d.curves[k]).map(([k, l, c, w]) => FE.line(`${l} (${d.curves[k].date})`, d.curves[k].values, c, { pointRadius: 3, borderWidth: w, borderDash: k === "now" ? undefined : [4, 3] }));
    FE.chart("vxTerm", { type: "line", data: { labels, datasets: ds }, options: FE.chartOpts({ legend: true }) });
    const h = d.history;
    FE.chart("vxHist", { type: "line", data: { labels: h.dates, datasets: [
      FE.line("VIX", h.vix, C.neg), FE.line("VIX3M", h.vix3m, C.cyan),
      FE.line("VIX÷VIX3M", h.ratio, "rgba(202,138,4,.7)", { yAxisID: "y1", borderWidth: 1, fill: { target: { value: 1 }, above: "rgba(220,38,38,.18)", below: "rgba(0,0,0,0)" } })] },
      options: FE.chartOpts({ legend: true, xFmt: v => String(v).slice(2, 7), scales: { y1: { position: "left", grid: { display: false }, ticks: { callback: v => v.toFixed(2) } } } }) });
    if (d.vvix.values.length) {
      FE.chart("vxVvix", { type: "line", data: { labels: d.vvix.dates, datasets: [FE.line("VVIX", d.vvix.values, C.purple),
        FE.line("SKEW", d.vvix.dates.map(x => { const i = d.skew.dates.indexOf(x); return i < 0 ? null : d.skew.values[i]; }), C.warn, { yAxisID: "y1" })] },
        options: FE.chartOpts({ legend: true, xFmt: v => String(v).slice(2, 7), scales: { y1: { position: "left", grid: { display: false } } } }) });
    } else document.getElementById("vxVvix").parentElement.innerHTML = `<div class="empty">CBOE 데이터를 가져오지 못했습니다.</div>`;
  } catch (e) { const x = document.getElementById("vxStats"); if (x) FE.error(x, e); }
}
async function loadFut() {
  const box = $("#fxTbl"); if (!box) return; FE.loading(box);
  try {
    const d = await FE.api("/api/derivatives/futures?" + FE.qs({ root: st.root }));
    if (!document.getElementById("fxCurve")) return;
    $("#fxRoots").innerHTML = FE.pills("fxRoot", d.roots.map(r => [r.root, `${r.root} ${r.name}`]), d.root);
    FE.onPills(root, "fxRoot", v => { st.root = v; history.replaceState(null, "", "#derivatives/vix/" + v); loadFut(); });
    const cv = d.curve;
    FE.chart("fxCurve", { type: "line", data: { labels: cv.map(c => c.month), datasets: [FE.line(`${d.name} (${d.unit})`, cv.map(c => c.price), C.warn, { pointRadius: 3, borderWidth: 2 })] },
      options: FE.chartOpts({ legend: true, xTicks: 14 }) });
    const ttl = document.getElementById("fxCurve").closest(".panel").querySelector(".panel-h .s");
    if (ttl) ttl.innerHTML = `${FE.esc(d.name)} · 단위: ${FE.esc(d.unit)} · <b class="${d.structure === "콘탱고" ? "c-cyan" : d.structure === "백워데이션" ? "c-red" : ""}">${d.structure}</b> (근월→원월 ${FE.spct(d.slope)})`;
    box.innerHTML = FE.table([
      { k: "month", l: "만기월", a: "l" }, { k: "sym", l: "계약", a: "l", f: v => `<span class="c-dim">${v}</span>` },
      { k: "price", l: "가격", f: v => `<b class="c-white">${FE.price(v)}</b>` }, { k: "chg", l: "전일 대비", f: v => `<span class="${FE.cls(v)}">${FE.spct(v)}</span>` },
      { k: "spread", l: "근월물 대비", f: v => FE.chg(v, 2) }, { k: "spread_pct", l: "%", f: v => `<span class="${FE.cls(v)}">${FE.spct(v)}</span>` },
    ], cv, { maxH: "300px" });
    $("#fxBasis").innerHTML = FE.table([
      { k: "name", l: "지수", a: "l", f: (v, r) => `<b class="c-white">${v}</b> <span class="c-dim">${r.fut}</span>` },
      { k: "F", l: "선물", f: v => FE.num(v, 2) }, { k: "S", l: "현물", f: v => FE.num(v, 2) },
      { k: "basis", l: FE.term("dv_basis", "베이시스"), f: v => `<span class="${FE.cls(v)}">${FE.chg(v, 2)}</span>` },
      { k: "basis_pct", l: "%", f: v => FE.spct(v, 3) },
      { k: "carry_ann", l: FE.term("dv_carry", "연환산"), f: v => `<span class="c-cyan">${FE.spct(v)}</span>` },
      { k: "expiry", l: "만기 (추정)", a: "c", f: (v, r) => `${v || "—"} <span class="c-dim">${r.days}일</span>` },
    ], d.basis, { empty: "베이시스 데이터를 가져오지 못했습니다." }) + `<div class="note" style="padding:6px 10px">연속 선물(=F)과 현물 지수의 종가 차이입니다. 장 마감 시각이 달라 하루 단위로는 오차가 있을 수 있어요 (기준일 ${d.asof || "—"}).</div>`;
    $("#fxFront").innerHTML = FE.table([
      { k: "name", l: "상품", a: "l", f: (v, r) => `<b class="c-white">${v}</b> <span class="c-dim">${r.sym}</span>` },
      { k: "price", l: "가격", f: v => FE.price(v) }, { k: "chg", l: "전일 대비", f: v => `<span class="${FE.cls(v)}">${FE.arrow(v)} ${FE.spct(v)}</span>` },
      { k: "m1", l: "1개월", f: v => `<span class="${FE.cls(v)}">${FE.spct(v)}</span>` }, { k: "spark", l: "1개월 추이", a: "c", f: v => FE.sparkline(v, 110, 22) },
    ], d.front) + `<div class="dv-src" style="padding:4px 10px">출처: Yahoo Finance 연속 선물 (=F)</div>`;
  } catch (e) { FE.error(box, e); }
}

FE.command("/opt", "옵션 체인 (예: /opt SPY)", a => FE.go("derivatives", "chain/" + ((a || "SPY").toUpperCase())));
FE.command("/bond", "채권 계산기", () => FE.go("derivatives", "bond"));
})();
