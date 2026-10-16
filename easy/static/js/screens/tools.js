/* TOOLS — 도구: 금융 계산기 · 노트 · 단위 변환 (pure frontend) */
(() => {
FE.glossary({
  t_comp: ["복리", "이자에 다시 이자가 붙는 방식. 기간이 길수록 효과가 기하급수적으로 커져요."],
  t_real: ["실질 가치", "물가 상승을 빼고 '오늘 돈으로 치면 얼마인지' 환산한 값."],
  t_epi: ["원리금균등 상환", "매달 갚는 금액(원금+이자)이 같아요. 초반엔 이자 비중이 크고 원금은 천천히 줄어요."],
  t_ep: ["원금균등 상환", "매달 같은 원금을 갚고 이자는 남은 원금에 붙어요. 첫 달 부담이 크지만 총 이자가 적어요."],
  t_bullet: ["만기일시 상환", "매달 이자만 내다가 만기에 원금을 한 번에 갚아요. 총 이자가 가장 많아요."],
  t_grace: ["거치 기간", "원금은 갚지 않고 이자만 내는 기간."],
  t_4pct: ["4% 룰", "은퇴 자산의 4%씩 매년 꺼내 쓰면 30년 정도 버틸 수 있다는 미국 연구(트리니티 스터디) 경험칙. 필요 자산 ≈ 연 생활비 × 25."],
  t_geo: ["기하평균 수익률", "실제로 돈이 불어난 속도. 매년 +50%, -50%면 산술평균은 0%지만 실제로는 -25% 손실(기하평균 -13.4%)이에요. 변동성이 클수록 차이가 커집니다."],
  t_avg: ["평균 단가 (평단)", "보유 주식 전체의 1주당 평균 매수 가격. 떨어졌을 때 더 사면(물타기) 평단이 낮아져요."],
  t_be: ["본전 상승률", "지금 가격에서 몇 % 올라야 평단(본전)에 도달하는지. -50% 손실은 +100% 올라야 회복돼요."],
  t_72: ["72의 법칙", "72 ÷ 연 수익률(%) ≈ 원금이 2배가 되는 데 걸리는 햇수. 연 8%면 약 9년."],
  t_isa: ["ISA (개인종합자산관리계좌)", "한 계좌에서 예금·펀드·ETF 등을 운용하고, 순이익 200만원(서민형 400만원)까지 비과세, 초과분은 9.9% 분리과세하는 절세 계좌."],
  t_bp: ["bp (베이시스 포인트)", "0.01%p. 금리 0.25%p 인상 = 25bp 인상."],
});

const esc = FE.esc;
const TABS = [["compound", "복리·적립식"], ["loan", "대출 상환"], ["retire", "은퇴 자금"], ["cagr", "CAGR·수익률"], ["avg", "평단가·물타기"], ["tax", "세후 수익"], ["r72", "72법칙"], ["notes", "노트"], ["units", "단위·포맷"]];
const won = v => v == null || !isFinite(v) ? "—" : (v < 0 ? "-" : "") + FE.int(Math.abs(v)) + "원";
const wonK = v => v == null || !isFinite(v) ? "—" : FE.krw(v) + "원";
const axK = v => { const a = Math.abs(v), t = x => String(+x.toFixed(1)); return a >= 1e12 ? t(v / 1e12) + "조" : a >= 1e8 ? t(v / 1e8) + "억" : a >= 1e4 ? t(v / 1e4) + "만" : String(v); };
const P = s => { const v = parseFloat(String(s ?? "").replace(/[, ]/g, "")); return isNaN(v) ? 0 : v; };

function css() {
  if (document.getElementById("tools-style")) return;
  const s = document.createElement("style"); s.id = "tools-style";
  s.textContent = `
  .tl-grid { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 8px; align-items: start; }
  .tl-form { display: flex; flex-direction: column; gap: 9px; }
  .tl-form .inp { width: 100%; }
  .tl-f { display: grid; grid-template-columns: 1fr 170px; align-items: center; gap: 8px; }
  .tl-f label { color: var(--text-2); }
  .tl-f .w { position: relative; }
  .tl-f .w i { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--text-3); font-style: normal; font-size: 12px; pointer-events: none; }
  .tl-f .w .inp { padding-right: 34px; text-align: right; }
  .tl-big { font-size: 26px; font-weight: 700; color: var(--accent); }
  .nt-wrap { display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 8px; min-height: calc(100vh - 260px); }
  .nt-item { padding: 8px 10px; border-bottom: 1px solid var(--border-dim); cursor: pointer; border-left: 3px solid transparent; }
  .nt-item:hover { background: var(--bg-hover); }
  .nt-item.sel { background: var(--accent-bg); border-left-color: var(--accent); }
  .nt-item .t { color: var(--text); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nt-item .m { color: var(--text-3); font-size: 11.5px; display: flex; gap: 8px; margin-top: 2px; white-space: nowrap; }
  .nt-item .m .tk { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .nt-ed textarea { width: 100%; min-height: 300px; resize: vertical; line-height: 1.6; }
  .nt-prev { line-height: 1.7; color: var(--text); word-break: break-word; }
  .nt-prev h1, .nt-prev h2, .nt-prev h3 { color: var(--accent); margin: 10px 0 4px; font-size: 15px; }
  .nt-prev h1 { font-size: 17px; }
  .nt-prev code { background: #1a1a1a; padding: 0 4px; color: var(--cyan); }
  .nt-prev ul { margin: 4px 0; padding-left: 20px; }
  .nt-prev blockquote { border-left: 3px solid var(--border-bright); margin: 6px 0; padding-left: 10px; color: var(--text-2); }
  .nt-tk { color: var(--warn); cursor: pointer; }
  .nt-tk:hover { text-decoration: underline; }
  @media (max-width: 1000px) { .tl-grid, .nt-wrap { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(s);
}

/* ---------- generic calculator scaffold ---------- */
// fields: [{k, l, v, u (unit), money, opts:[[v,l]], tip}]
function calc(box, id, title, fields, compute, note) {
  const saved = FE.store.get("tools." + id, {});
  const val = f => saved[f.k] ?? f.v;
  const fmt = (f, v) => f.money ? FE.int(P(v)) : v;
  box.innerHTML = `<div class="tl-grid">
    ${FE.panel({ title, color: "orange", bar: true, acts: `<button class="btn muted" id="tlReset">초기화</button>`, body: `<div class="tl-form">${fields.map(f => `
      <div class="tl-f"><label>${f.tip ? FE.term(f.tip, esc(f.l)) : esc(f.l)}</label>${f.opts
        ? `<select class="inp" data-k="${f.k}">${f.opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val(f)) ? "selected" : ""}>${l}</option>`).join("")}</select>`
        : `<span class="w"><input class="inp" data-k="${f.k}" inputmode="decimal" value="${esc(fmt(f, val(f)))}" ${f.money ? 'data-money="1"' : ""}><i>${f.u || ""}</i></span>`}</div>`).join("")}
      ${note ? `<div class="note">${note}</div>` : ""}</div>` })}
    <div id="tlOut" class="grid"></div></div>`;
  const out = box.querySelector("#tlOut");
  const read = () => { const v = {}; box.querySelectorAll("[data-k]").forEach(i => v[i.dataset.k] = i.tagName === "SELECT" ? i.value : P(i.value)); return v; };
  const run = () => {
    const v = read(); const raw = {}; box.querySelectorAll("[data-k]").forEach(i => raw[i.dataset.k] = i.value); FE.store.set("tools." + id, raw);
    try { const r = compute(v); out.innerHTML = r.html; r.after && r.after(out); } catch (e) { out.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
  box.querySelectorAll("[data-k]").forEach(i => {
    i.addEventListener("input", run); i.addEventListener("change", run);
    if (i.dataset.money) i.addEventListener("blur", () => { i.value = FE.int(P(i.value)); });
  });
  box.querySelector("#tlReset").onclick = () => { FE.store.set("tools." + id, {}); calc(box, id, title, fields, compute, note); };
  run();
}
const need = (c, msg) => { if (!c) throw new Error(msg); };

/* ---------- 1. 복리·적립식 ---------- */
function compound(box) {
  calc(box, "compound", "복리 · 적립식 미래가치", [
    { k: "p0", l: "초기 원금", v: 10000000, u: "원", money: true },
    { k: "pm", l: "월 적립액", v: 500000, u: "원", money: true },
    { k: "r", l: "연 수익률", v: 7, u: "%" },
    { k: "y", l: "기간", v: 20, u: "년" },
    { k: "g", l: "적립액 연 증가율", v: 0, u: "%" },
    { k: "inf", l: "물가상승률", v: 2.5, u: "%", tip: "t_real" },
    { k: "freq", l: "복리 주기", v: "12", opts: [["12", "월복리"], ["4", "분기복리"], ["1", "연복리"]], tip: "t_comp" },
  ], v => {
    need(v.y > 0 && v.y <= 80, "기간은 1~80년으로 입력하세요."); need(v.r > -50 && v.r < 100, "수익률 범위를 확인하세요.");
    const n = +v.freq, rm = Math.pow(1 + v.r / 100 / n, n / 12) - 1; // effective monthly
    let bal = v.p0, paid = v.p0, pm = v.pm; const rows = [{ y: 0, paid, bal }];
    for (let m = 1; m <= v.y * 12; m++) {
      bal = bal * (1 + rm) + pm; paid += pm;
      if (m % 12 === 0) { rows.push({ y: m / 12, paid, bal, real: bal / Math.pow(1 + v.inf / 100, m / 12) }); pm *= 1 + v.g / 100; }
    }
    const last = rows[rows.length - 1], gain = last.bal - last.paid;
    return {
      html: FE.stats([{ l: "최종 금액", v: wonK(last.bal), d: won(last.bal) }, { l: "총 납입액", v: wonK(last.paid), vcls: "c-cyan" }, { l: "총 수익", v: wonK(gain), d: `납입 대비 ${FE.num(gain / last.paid * 100, 1)}%`, vcls: "c-green" }, { l: FE.term("t_real", "실질 가치"), v: wonK(last.real), d: `물가 ${v.inf}% 반영`, vcls: "c-purple" }])
        + FE.panel({ title: "자산 성장", color: "cyan", sub: "막대 = 납입 원금 + 수익", body: `<div class="chart"><canvas id="tlCh"></canvas></div>` })
        + FE.panel({ title: "연도별", color: "yellow", flush: true, body: FE.table([{ k: "y", l: "연차", a: "c" }, { k: "paid", l: "누적 납입", f: won }, { k: "bal", l: "평가액", f: v => `<b class="c-white">${won(v)}</b>` }, { k: "gain", l: "수익", f: v => `<span class="pos">${won(v)}</span>` }, { k: "real", l: "실질 가치", f: won }], rows.slice(1).map(r => ({ ...r, gain: r.bal - r.paid })), { maxH: "300px" }) }),
      after: () => FE.chart("tlCh", { type: "bar", data: { labels: rows.map(r => r.y + "년"), datasets: [
        { label: "납입 원금", data: rows.map(r => r.paid), backgroundColor: FE.color.cyan, stack: "a" },
        { label: "수익", data: rows.map(r => r.bal - r.paid), backgroundColor: FE.color.accent, stack: "a" },
        { type: "line", label: "실질 가치", data: rows.map(r => r.real ?? r.bal), borderColor: FE.color.purple, borderWidth: 1.5, pointRadius: 0 }] },
        options: { ...FE.chartOpts({ legend: true, yFmt: axK }), scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, position: "right", grid: { color: FE.color.grid }, ticks: { callback: axK } } } } }),
    };
  }, "월 적립은 매달 말 납입 기준. 수익률은 세전·수수료 전 가정이며, 실제 투자 수익은 매년 들쭉날쭉해요.");
}

/* ---------- 2. 대출 상환 ---------- */
function loan(box) {
  calc(box, "loan", "대출 상환 계산", [
    { k: "amt", l: "대출 금액", v: 300000000, u: "원", money: true },
    { k: "r", l: "연 이자율", v: 4.5, u: "%" },
    { k: "n", l: "대출 기간", v: 30, u: "년" },
    { k: "grace", l: "거치 기간", v: 0, u: "개월", tip: "t_grace" },
    { k: "type", l: "상환 방식", v: "epi", opts: [["epi", "원리금균등"], ["ep", "원금균등"], ["bullet", "만기일시"]] },
  ], v => {
    need(v.amt > 0, "대출 금액을 입력하세요."); need(v.n > 0 && v.n <= 50, "기간은 1~50년."); need(v.r >= 0 && v.r < 50, "이자율 범위를 확인하세요.");
    const N = Math.round(v.n * 12), G = Math.min(Math.round(v.grace), N - 1), i = v.r / 100 / 12, rows = [];
    let bal = v.amt;
    const R = N - G, pmt = i ? v.amt * i / (1 - Math.pow(1 + i, -R)) : v.amt / R;
    for (let m = 1; m <= N; m++) {
      const int = bal * i; let prin = 0;
      if (m > G) prin = v.type === "epi" ? pmt - int : v.type === "ep" ? v.amt / R : (m === N ? bal : 0);
      prin = Math.min(prin, bal); bal -= prin;
      rows.push({ m, pay: prin + int, prin, int, bal: Math.max(0, bal) });
    }
    const totInt = rows.reduce((a, r) => a + r.int, 0);
    const yr = []; for (let y = 0; y < Math.ceil(N / 12); y++) { const s = rows.slice(y * 12, y * 12 + 12); yr.push({ y: y + 1, prin: s.reduce((a, r) => a + r.prin, 0), int: s.reduce((a, r) => a + r.int, 0), bal: s[s.length - 1].bal }); }
    const first = rows[G] || rows[0];
    return {
      html: FE.stats([{ l: G ? "거치 후 첫 상환액" : "첫 달 상환액", v: won(first.pay), d: v.type === "epi" ? "매달 동일" : v.type === "ep" ? `마지막 달 ${won(rows[N - 1].pay)}` : "이자만 납부, 만기에 원금", vcls: "sm" },
          { l: "총 이자", v: wonK(totInt), d: `원금 대비 ${FE.num(totInt / v.amt * 100, 1)}%`, vcls: "sm c-red" }, { l: "총 상환액", v: wonK(v.amt + totInt), vcls: "sm c-cyan" },
          { l: "방식", v: { epi: FE.term("t_epi", "원리금균등"), ep: FE.term("t_ep", "원금균등"), bullet: FE.term("t_bullet", "만기일시") }[v.type], vcls: "sm c-white" }])
        + FE.panel({ title: "연도별 원금·이자", color: "cyan", sub: "막대 = 그 해 낸 원금/이자 · 선 = 남은 원금", body: `<div class="chart"><canvas id="tlCh"></canvas></div>` })
        + FE.panel({ title: "상환 스케줄", color: "yellow", sub: `${N}회차`, flush: true, body: FE.table([{ k: "m", l: "회차", a: "c" }, { k: "pay", l: "납입액", f: v => `<b class="c-white">${won(v)}</b>` }, { k: "prin", l: "원금", f: won }, { k: "int", l: "이자", f: v => `<span class="neg">${won(v)}</span>` }, { k: "bal", l: "잔액", f: won }], rows, { maxH: "320px" }) }),
      after: () => FE.chart("tlCh", { type: "bar", data: { labels: yr.map(r => r.y + "년"), datasets: [
        { label: "원금", data: yr.map(r => r.prin), backgroundColor: FE.color.cyan, stack: "a", yAxisID: "y" },
        { label: "이자", data: yr.map(r => r.int), backgroundColor: FE.color.neg, stack: "a", yAxisID: "y" },
        { type: "line", label: "남은 원금", data: yr.map(r => r.bal), borderColor: FE.color.accent, borderWidth: 1.5, pointRadius: 0, yAxisID: "y2" }] },
        options: { ...FE.chartOpts({ legend: true }), scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, position: "left", grid: { color: FE.color.grid }, ticks: { callback: axK } }, y2: { position: "right", grid: { display: false }, ticks: { callback: axK } } } } }),
    };
  }, "중도상환수수료·보증료 등은 포함하지 않은 단순 계산입니다. 원리금균등은 한국 은행 주담대·신용대출의 표준 방식이에요.");
}

/* ---------- 3. 은퇴 자금 ---------- */
function retire(box) {
  calc(box, "retire", "은퇴 자금 계산", [
    { k: "age", l: "현재 나이", v: 35, u: "세" }, { k: "rage", l: "은퇴 나이", v: 60, u: "세" }, { k: "life", l: "기대 수명", v: 90, u: "세" },
    { k: "now", l: "현재 모은 돈", v: 50000000, u: "원", money: true }, { k: "save", l: "월 저축액", v: 1000000, u: "원", money: true },
    { k: "r1", l: "은퇴 전 수익률", v: 6, u: "%" }, { k: "r2", l: "은퇴 후 수익률", v: 3.5, u: "%" },
    { k: "spend", l: "은퇴 후 월 생활비 (현재 가치)", v: 3000000, u: "원", money: true },
    { k: "pension", l: "월 연금 수령액 (현재 가치)", v: 1000000, u: "원", money: true },
    { k: "inf", l: "물가상승률", v: 2.5, u: "%" },
  ], v => {
    need(v.rage > v.age && v.life > v.rage, "나이 순서를 확인하세요 (현재 < 은퇴 < 기대수명).");
    const yw = v.rage - v.age, yr = v.life - v.rage, rm1 = Math.pow(1 + v.r1 / 100, 1 / 12) - 1, inf = v.inf / 100;
    const series = []; let bal = v.now;
    for (let a = v.age; a < v.rage; a++) { series.push({ age: a, bal }); for (let m = 0; m < 12; m++) bal = bal * (1 + rm1) + v.save; }
    const atRet = bal;
    const need0 = (v.spend - v.pension) * 12 * Math.pow(1 + inf, yw); // first-year net withdrawal (nominal)
    // PV at retirement of a growing annuity (withdraw at year start)
    const r2 = v.r2 / 100, g = inf, k = (1 + g) / (1 + r2);
    const required = need0 <= 0 ? 0 : Math.abs(r2 - g) < 1e-9 ? need0 * yr : need0 * (1 - Math.pow(k, yr)) / (1 - k);
    let b2 = atRet, w = need0, depleted = null;
    for (let a = v.rage; a <= v.life; a++) { series.push({ age: a, bal: Math.max(0, b2) }); b2 = (b2 - w) * (1 + r2); w *= 1 + g; if (b2 < 0 && depleted == null) depleted = a + 1; }
    const gap = atRet - required;
    // monthly saving needed to close the gap
    const fvAnn = rm1 ? (Math.pow(1 + rm1, yw * 12) - 1) / rm1 : yw * 12;
    const needSave = gap >= 0 ? null : v.save + (-gap) / fvAnn;
    return {
      html: FE.stats([{ l: "은퇴 시점 예상 자산", v: wonK(atRet), d: `${v.rage}세 (명목)` }, { l: "필요 자산", v: wonK(required), d: `${yr}년간 생활비 − 연금`, vcls: "c-cyan" },
          { l: gap >= 0 ? "여유" : "부족", v: wonK(Math.abs(gap)), vcls: gap >= 0 ? "c-green" : "c-red", d: depleted ? `${depleted}세에 자산 소진 예상` : "기대 수명까지 유지" },
          { l: gap >= 0 ? "현재 저축 유지 OK" : "필요 월 저축액", v: needSave ? won(needSave) : "✓", vcls: needSave ? "c-orange sm" : "c-green" }])
        + FE.panel({ title: "나이별 자산 추이", color: "cyan", sub: `은퇴 전 적립 → 은퇴 후 인출 (명목 금액)`, body: `<div class="chart"><canvas id="tlCh"></canvas></div>` })
        + `<div class="note">은퇴 첫해 필요 인출액(명목): <b>${wonK(need0)}</b>/년 = 현재 가치 월 ${won(v.spend - v.pension)} × 물가 ${yw}년치. ${FE.term("t_4pct", "4% 룰")}로 보면 필요 자산 ≈ ${wonK(need0 * 25)}.<br>국민연금 예상액은 국민연금공단 '내 연금 알아보기'에서 확인할 수 있어요. 세금·의료비 급증 등은 반영하지 않은 단순 모델입니다.</div>`,
      after: () => FE.chart("tlCh", { type: "line", data: { labels: series.map(s => s.age + "세"), datasets: [FE.line("자산", series.map(s => s.bal), FE.color.accent, { fill: true, backgroundColor: "rgba(217,119,6,.15)", segment: { borderColor: c => series[c.p0DataIndex].age >= v.rage ? FE.color.cyan : FE.color.accent } })] },
        options: FE.chartOpts({ yFmt: axK, xTicks: 12 }) }),
    };
  });
}

/* ---------- 4. CAGR ---------- */
function cagr(box) {
  calc(box, "cagr", "CAGR · 수익률 계산", [
    { k: "a", l: "시작 금액", v: 10000000, u: "원", money: true }, { k: "b", l: "종료 금액", v: 25000000, u: "원", money: true },
    { k: "y", l: "기간", v: 7, u: "년" }, { k: "target", l: "목표 CAGR (역산용)", v: 10, u: "%" },
    { k: "list", l: "연도별 수익률 (쉼표)", v: "" },
  ], v => {
    need(v.a > 0 && v.b > 0 && v.y > 0, "금액과 기간은 0보다 커야 해요.");
    const raw = box.querySelector('[data-k="list"]').value || "25, -15, 30, -20, 18";
    const c = Math.pow(v.b / v.a, 1 / v.y) - 1, tot = v.b / v.a - 1;
    const fut = v.a * Math.pow(1 + v.target / 100, v.y);
    const rs = raw.split(/[,\s]+/).map(Number).filter(x => !isNaN(x) && x > -100);
    const ar = rs.length ? rs.reduce((s, x) => s + x, 0) / rs.length : null;
    const gm = rs.length ? (Math.pow(rs.reduce((p, x) => p * (1 + x / 100), 1), 1 / rs.length) - 1) * 100 : null;
    let g = 100; const path = [100, ...rs.map(x => (g *= 1 + x / 100))];
    return {
      html: FE.stats([{ l: FE.term("cagr", "CAGR (연평균)"), v: FE.pctRaw(c * 100), vcls: c >= 0 ? "c-green" : "c-red" }, { l: FE.term("total", "총 수익률"), v: FE.pctRaw(tot * 100), vcls: "c-cyan" }, { l: "배수", v: FE.num(v.b / v.a, 2) + "배", vcls: "c-white" }, { l: `연 ${v.target}%로 ${v.y}년 후`, v: wonK(fut), vcls: "c-orange sm" }])
        + FE.panel({ title: "산술평균 vs 기하평균", color: "purple", sub: FE.term("t_geo", "변동성 손실 확인"), body: rs.length ? `<div class="grid cols-2"><div>${FE.kv([["입력한 수익률", rs.map(x => FE.pctRaw(x, 0)).join(", "), "w"], ["산술평균 (단순 평균)", FE.pctRaw(ar), "c-yellow"], [FE.term("t_geo", "기하평균 (실제 CAGR)"), FE.pctRaw(gm), gm >= 0 ? "pos" : "neg"], ["차이 (변동성 비용)", FE.num(ar - gm, 2) + "%p", "c-red"], ["100만원 → 최종", won(path[path.length - 1] * 10000), "w"]])}
            <div class="note" style="margin-top:8px">펀드 광고의 '연평균 수익률'이 산술평균이면 실제 내 계좌 수익(기하평균)보다 높게 보일 수 있어요.</div></div><div class="chart sm"><canvas id="tlCh"></canvas></div></div>` : `<div class="empty">왼쪽 '연도별 수익률'에 예: 25, -15, 30 을 입력하세요.</div>` }),
      after: () => rs.length && FE.chart("tlCh", { type: "line", data: { labels: path.map((_, i) => i + "년"), datasets: [FE.line("실제 경로", path, FE.color.accent), FE.line("산술평균 가정", path.map((_, i) => 100 * Math.pow(1 + ar / 100, i)), FE.color.text2, { borderDash: [4, 3] })] }, options: FE.chartOpts({ legend: true }) }),
    };
  }, "연도별 수익률을 비워 두면 예시(25, -15, 30, -20, 18)로 계산해요.");
}

/* ---------- 5. 평단가·물타기 ---------- */
function avg(box) {
  calc(box, "avg", "평단가 · 물타기 계산", [
    { k: "q0", l: "보유 수량", v: 100, u: "주" }, { k: "a0", l: "현재 평단가", v: 80000, u: "원", money: true },
    { k: "p1", l: "추가 매수가 ①", v: 60000, u: "원", money: true }, { k: "q1", l: "추가 수량 ①", v: 50, u: "주" },
    { k: "p2", l: "추가 매수가 ②", v: 0, u: "원", money: true }, { k: "q2", l: "추가 수량 ②", v: 0, u: "주" },
    { k: "cur", l: "현재가", v: 60000, u: "원", money: true }, { k: "tgt", l: "목표 평단 (역산)", v: 70000, u: "원", money: true },
  ], v => {
    need(v.q0 >= 0 && v.a0 >= 0, "보유 수량/평단을 확인하세요.");
    const cost0 = v.q0 * v.a0, buys = [[v.p1, v.q1], [v.p2, v.q2]].filter(([p, q]) => p > 0 && q > 0);
    const q = v.q0 + buys.reduce((s, [, x]) => s + x, 0), cost = cost0 + buys.reduce((s, [p, x]) => s + p * x, 0);
    need(q > 0, "수량을 입력하세요.");
    const na = cost / q, val = q * v.cur, pl = val - cost, be = v.cur > 0 ? (na / v.cur - 1) * 100 : null;
    const pl0 = v.q0 ? (v.cur / v.a0 - 1) * 100 : null;
    // shares needed at current price to reach target average
    const needQ = v.tgt > v.cur && v.tgt < v.a0 ? Math.ceil(v.q0 * (v.a0 - v.tgt) / (v.tgt - v.cur)) : null;
    return {
      html: FE.stats([{ l: FE.term("t_avg", "새 평단가"), v: won(na), d: v.q0 ? `기존 ${won(v.a0)} → ${FE.pctRaw((na / v.a0 - 1) * 100)}` : "", vcls: "sm" }, { l: "총 수량 / 투자금", v: `${FE.int(q)}주`, d: won(cost), vcls: "sm c-white" },
          { l: "평가 손익", v: won(pl), d: FE.pctRaw(pl / cost * 100) + (pl0 != null ? ` (물타기 전 ${FE.pctRaw(pl0)})` : ""), vcls: "sm " + (pl >= 0 ? "c-green" : "c-red") }, { l: FE.term("t_be", "본전까지"), v: be != null ? (be <= 0 ? "이미 수익" : "+" + FE.num(be, 2) + "%") : "—", vcls: "sm c-orange" }])
        + FE.panel({ title: "목표 평단 역산", color: "cyan", body: needQ != null ? `평단을 <b class="c-orange">${won(v.tgt)}</b>로 낮추려면 현재가 ${won(v.cur)}에 <b class="c-orange">${FE.int(needQ)}주</b> (약 ${wonK(needQ * v.cur)}) 를 더 사야 해요.` : `<span class="c-dim">목표 평단은 현재가보다 높고 기존 평단보다 낮아야 계산돼요.</span>` })
        + FE.panel({ title: "손실 회복표", color: "red", sub: "떨어진 만큼 회복하려면 필요한 상승률", flush: true, body: FE.table([{ k: "d", l: "하락률", a: "c", f: x => `<span class="neg">-${x}%</span>` }, { k: "u", l: "필요 상승률", a: "c", f: x => `<b class="pos">+${FE.num(x, 1)}%</b>` }], [10, 20, 30, 40, 50, 60, 70, 80, 90].map(d => ({ d, u: (1 / (1 - d / 100) - 1) * 100 }))) })
        + `<div class="note">물타기는 평단을 낮춰 '본전'을 가깝게 만들지만, 한 종목에 돈이 더 몰려 위험도 커져요. 떨어진 이유(기업 가치 훼손인지 일시적 변동인지)를 먼저 확인하세요.</div>`,
    };
  });
}

/* ---------- 6. 세후 수익 (단순화) ---------- */
function tax(box) {
  calc(box, "tax", "세후 수익 계산 (단순화)", [
    { k: "type", l: "투자 유형", v: "us", opts: [["us", "해외주식 매매차익"], ["kr", "국내 상장주식 매매차익 (소액주주)"], ["int", "예금 이자 · 배당"], ["isa", "ISA 일반형"], ["isa2", "ISA 서민형"], ["custom", "직접 입력 세율"]] },
    { k: "cost", l: "투자 원금", v: 20000000, u: "원", money: true }, { k: "sell", l: "매도 금액 (원금+수익)", v: 30000000, u: "원", money: true },
    { k: "inc", l: "이자·배당 수익", v: 0, u: "원", money: true }, { k: "fee", l: "매매 수수료 등 비용", v: 0, u: "원", money: true },
    { k: "rate", l: "직접 입력 세율", v: 22, u: "%" },
  ], v => {
    const gain = v.sell - v.cost - v.fee, inc = v.inc, total = gain + inc;
    let taxAmt = 0, how = "";
    if (v.type === "us") { const base = Math.max(0, gain - 2500000); taxAmt = base * 0.22 + inc * 0.154; how = "양도차익에서 연 250만원 기본공제 후 22%(지방세 포함), 배당 15.4%. 손익통산은 같은 해 해외주식끼리만."; }
    else if (v.type === "kr") { taxAmt = inc * 0.154 + Math.max(0, v.sell) * 0.0015; how = "소액주주 국내 상장주식 매매차익은 비과세, 대신 매도 금액에 증권거래세(약 0.15%, 시장·연도별 상이)가 붙어요. 배당은 15.4%."; }
    else if (v.type === "int") { taxAmt = Math.max(0, total) * 0.154; how = "이자·배당소득세 15.4% (지방세 포함). 연 2,000만원 초과 시 금융소득종합과세 대상."; }
    else if (v.type === "isa" || v.type === "isa2") { const free = v.type === "isa" ? 2000000 : 4000000; taxAmt = Math.max(0, total - free) * 0.099; how = `ISA 순이익 ${FE.krw(free)}원까지 비과세, 초과분 9.9% 분리과세 (의무 가입 기간 3년).`; }
    else { taxAmt = Math.max(0, total) * v.rate / 100; how = `입력한 세율 ${v.rate}% 적용.`; }
    taxAmt = Math.max(0, taxAmt);
    const net = total - taxAmt;
    return {
      html: FE.stats([{ l: "세전 수익", v: won(total), vcls: "sm c-cyan" }, { l: "예상 세금", v: won(taxAmt), d: total > 0 ? `수익의 ${FE.num(taxAmt / total * 100, 1)}%` : "", vcls: "sm c-red" }, { l: "세후 수익", v: won(net), vcls: "sm " + (net >= 0 ? "c-green" : "c-red") }, { l: "세후 수익률", v: v.cost ? FE.pctRaw(net / v.cost * 100) : "—", vcls: "sm c-orange" }])
        + FE.panel({ title: "계산 기준", color: "yellow", body: `<div class="note">${how}<br><br>${FE.term("t_isa", "ISA")} · 연금저축 · IRP 같은 절세 계좌를 쓰면 같은 수익에서도 세금이 크게 줄어요. <b>세법은 자주 바뀌니 실제 신고 전 국세청·증권사 안내를 꼭 확인하세요.</b> (이 계산은 학습용 단순화 모델)</div>` })
        + FE.panel({ title: "유형별 비교", color: "cyan", sub: "같은 세전 수익 기준", flush: true, body: FE.table([{ k: "n", l: "유형", a: "l" }, { k: "t", l: "세금", f: won }, { k: "net", l: "세후 수익", f: x => `<b class="c-white">${won(x)}</b>` }],
            [["해외주식 (250만 공제, 22%)", Math.max(0, total - 2500000) * 0.22], ["이자·배당 (15.4%)", Math.max(0, total) * 0.154], ["ISA 일반형 (200만 비과세, 9.9%)", Math.max(0, total - 2000000) * 0.099], ["ISA 서민형 (400만 비과세, 9.9%)", Math.max(0, total - 4000000) * 0.099]].map(([n, t]) => ({ n, t, net: total - t }))) }),
    };
  });
}

/* ---------- 7. 72법칙 ---------- */
function r72(box) {
  calc(box, "r72", "72의 법칙", [{ k: "r", l: "연 수익률", v: 8, u: "%", tip: "t_72" }, { k: "y", l: "목표 기간 (역산)", v: 10, u: "년" }, { k: "x", l: "목표 배수", v: 2, u: "배" }], v => {
    need(v.r > 0 && v.r < 200, "수익률은 0보다 커야 해요."); need(v.x > 1, "배수는 1보다 커야 해요.");
    const exact = Math.log(v.x) / Math.log(1 + v.r / 100), rule = (v.x === 2 ? 72 : 72 * Math.log(v.x) / Math.log(2)) / v.r;
    const needR = (Math.pow(v.x, 1 / v.y) - 1) * 100;
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30].map(r => ({ r, rule: 72 / r, exact: Math.log(2) / Math.log(1 + r / 100), x3: Math.log(3) / Math.log(1 + r / 100), x10: Math.log(10) / Math.log(1 + r / 100) }));
    return {
      html: FE.stats([{ l: `72법칙 (${v.x}배)`, v: FE.num(rule, 1) + "년" }, { l: "정확한 값", v: FE.num(exact, 2) + "년", vcls: "c-cyan" }, { l: `${v.y}년 안에 ${v.x}배 → 필요 수익률`, v: FE.num(needR, 2) + "%", vcls: "c-orange" }])
        + FE.panel({ title: "수익률별 원금 2배·3배·10배 기간", color: "cyan", flush: true, body: FE.table([{ k: "r", l: "연 수익률", a: "c", f: x => x + "%" }, { k: "rule", l: "72법칙 (2배)", f: x => FE.num(x, 1) + "년" }, { k: "exact", l: "정확 (2배)", f: x => `<b class="c-white">${FE.num(x, 1)}년</b>` }, { k: "x3", l: "3배", f: x => FE.num(x, 1) + "년" }, { k: "x10", l: "10배", f: x => FE.num(x, 1) + "년" }], rows, { rowCls: r => r.r === Math.round(v.r) ? "sel" : "" }) })
        + `<div class="note">반대로 물가가 연 3%씩 오르면 돈의 가치는 72÷3 = 약 24년 만에 절반이 돼요. 수익률 6~10% 구간에서 가장 정확합니다.</div>`,
    };
  });
}

/* ---------- 8. 노트 (Fincept Notes-like) ---------- */
const NCATS = [["general", "일반"], ["research", "리서치"], ["idea", "트레이드 아이디어"], ["journal", "매매일지"], ["macro", "거시경제"], ["earnings", "실적"], ["other", "기타"]];
const NSENT = { bullish: ["▲ 강세", "pos"], bearish: ["▼ 약세", "neg"], neutral: ["– 중립", "flat"] };
const dt = ms => { const d = new Date(ms), p = x => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const notes = () => FE.store.get("tools.notes", []);
const saveNotes = l => FE.store.set("tools.notes", l);
const tickersOf = t => [...new Set((String(t).match(/\$[A-Za-z0-9.\-^=]{1,15}/g) || []).map(x => x.slice(1).toUpperCase()))];
function md(src) {
  const lines = esc(src).split("\n"); let html = "", inList = false;
  const inline = s => s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<i>$1</i>")
    .replace(/\$([A-Za-z0-9.\-^=]{1,15})/g, (m, t) => `<span class="nt-tk" data-tk="${t.toUpperCase()}">$${t.toUpperCase()}</span>`);
  for (const l of lines) {
    const li = l.match(/^\s*[-*] (.*)/);
    if (li) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(li[1])}</li>`; continue; }
    if (inList) { html += "</ul>"; inList = false; }
    const h = l.match(/^(#{1,3}) (.*)/);
    if (h) html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    else if (/^&gt; /.test(l)) html += `<blockquote>${inline(l.slice(5))}</blockquote>`;
    else html += l.trim() ? `<div>${inline(l)}</div>` : "<br>";
  }
  return html + (inList ? "</ul>" : "");
}

function notesTab(box) {
  let sel = FE.store.get("tools.notes.sel", null), q = "", fcat = "", fsent = "", mode = "edit";
  box.innerHTML = `<div class="nt-wrap">
    ${FE.panel({ title: "NOTES", color: "orange", bar: true, acts: `<button class="btn solid" id="ntNew">+ 새 노트</button>`, flush: true, body: `
      <div style="padding:8px;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid var(--border-dim)">
        <input class="inp" id="ntQ" placeholder="검색 (제목·내용·$티커)">
        <div class="row"><select class="inp" id="ntCat" style="flex:1"><option value="">모든 카테고리</option>${NCATS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
        <select class="inp" id="ntSent"><option value="">모든 감성</option><option value="bullish">▲ 강세</option><option value="bearish">▼ 약세</option><option value="neutral">– 중립</option></select></div>
        <div class="row"><button class="btn muted" id="ntExp">JSON 내보내기</button><label class="btn muted" style="cursor:pointer">JSON 가져오기<input type="file" id="ntImp" accept=".json,application/json" hidden></label></div>
      </div><div id="ntList" style="overflow:auto;max-height:calc(100vh - 400px)"></div>` })}
    <div id="ntEd"></div></div>`;
  const $ = s => box.querySelector(s);
  const list = () => {
    const ql = q.toLowerCase();
    const l = notes().filter(n => (!fcat || n.cat === fcat) && (!fsent || n.sent === fsent) && (!ql || (n.title + " " + n.body + " " + (n.tickers || []).join(" ")).toLowerCase().includes(ql))).sort((a, b) => (b.pin - a.pin) || b.updated - a.updated);
    $("#ntList").innerHTML = l.length ? l.map(n => `<div class="nt-item ${n.id === sel ? "sel" : ""}" data-id="${n.id}"><div class="t">${n.pin ? `<span class="c-orange">■</span> ` : ""}${esc(n.title || "(제목 없음)")}</div>
      <div class="m"><span class="c-orange">${esc((NCATS.find(c => c[0] === n.cat) || [, "일반"])[1])}</span><span class="${NSENT[n.sent]?.[1] || "flat"}">${NSENT[n.sent]?.[0] || ""}</span><span class="tk">${(n.tickers || []).slice(0, 4).map(t => "$" + esc(t)).join(" ")}</span><span>${dt(n.updated).slice(5, 10)}</span></div></div>`).join("")
      : `<div class="empty">${notes().length ? "검색 결과가 없습니다." : "노트가 없습니다.<br>+ 새 노트로 시작하세요."}</div>`;
  };
  const editor = () => {
    const n = notes().find(x => x.id === sel);
    if (!n) { $("#ntEd").innerHTML = FE.panel({ title: "EDITOR", color: "cyan", body: `<div class="empty">왼쪽에서 노트를 고르거나 새 노트를 만드세요.<br><br><span class="note">마크다운 일부 지원: # 제목, **굵게**, - 목록, \`코드\`, &gt; 인용. $AAPL처럼 쓰면 티커 태그가 돼요. 노트는 이 브라우저에만 저장됩니다.</span></div>` }); return; }
    $("#ntEd").innerHTML = FE.panel({ title: "EDITOR", color: "cyan", sub: `수정 ${dt(n.updated)}`,
      acts: `${FE.pills("ntMode", [["edit", "편집"], ["view", "미리보기"]], mode)}<button class="btn muted" id="ntPin">${n.pin ? "고정 해제" : "고정"}</button><button class="btn muted" id="ntDel" style="color:var(--neg)">삭제</button>`,
      body: `<div class="nt-ed" style="display:flex;flex-direction:column;gap:8px">
        <input class="inp" id="ntT" placeholder="제목" value="${esc(n.title)}" style="font-size:15px;font-weight:700">
        <div class="row"><select class="inp" id="ntC">${NCATS.map(([v, l]) => `<option value="${v}" ${v === n.cat ? "selected" : ""}>${l}</option>`).join("")}</select>
          ${FE.pills("ntS", [["bullish", "▲ 강세"], ["neutral", "– 중립"], ["bearish", "▼ 약세"]], n.sent || "neutral")}
          <span class="spacer"></span><span class="note" id="ntTk"></span></div>
        ${mode === "edit" ? `<textarea class="inp" id="ntB" placeholder="# 투자 아이디어&#10;- $NVDA 데이터센터 매출 성장…&#10;**리스크**: …">${esc(n.body)}</textarea>` : `<div class="nt-prev" style="min-height:300px">${md(n.body) || '<span class="c-dim">내용 없음</span>'}</div>`}
      </div>` });
    const tk = () => { const t = tickersOf(n.title + " " + n.body); $("#ntTk").innerHTML = t.length ? t.map(x => `<span class="nt-tk" data-tk="${esc(x)}">$${esc(x)}</span>`).join(" ") : "티커 없음"; return t; };
    tk();
    let timer;
    const save = (patch) => { Object.assign(n, patch, { updated: Date.now() }); n.tickers = tk(); const l = notes().map(x => x.id === n.id ? n : x); saveNotes(l); clearTimeout(timer); timer = setTimeout(list, 250); };
    $("#ntT").addEventListener("input", e => save({ title: e.target.value }));
    $("#ntC").onchange = e => save({ cat: e.target.value });
    $("#ntB")?.addEventListener("input", e => save({ body: e.target.value }));
    FE.onPills($("#ntEd"), "ntS", v => save({ sent: v }));
    FE.onPills($("#ntEd"), "ntMode", v => { mode = v; editor(); });
    $("#ntPin").onclick = () => { save({ pin: !n.pin }); editor(); list(); };
    $("#ntDel").onclick = () => { if (!confirm("이 노트를 삭제할까요?")) return; saveNotes(notes().filter(x => x.id !== n.id)); sel = null; list(); editor(); };
  };
  $("#ntNew").onclick = () => {
    const n = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: "새 노트", body: "", cat: fcat || "general", sent: "neutral", tickers: [], pin: false, created: Date.now(), updated: Date.now() };
    saveNotes([n, ...notes()]); sel = n.id; FE.store.set("tools.notes.sel", sel); mode = "edit"; list(); editor(); $("#ntT")?.select();
  };
  $("#ntList").onclick = e => { const it = e.target.closest("[data-id]"); if (it) { sel = it.dataset.id; FE.store.set("tools.notes.sel", sel); list(); editor(); } };
  box.addEventListener("click", e => { const t = e.target.closest("[data-tk]"); if (t) FE.go("research", t.dataset.tk); });
  $("#ntQ").addEventListener("input", e => { q = e.target.value; list(); });
  $("#ntCat").onchange = e => { fcat = e.target.value; list(); };
  $("#ntSent").onchange = e => { fsent = e.target.value; list(); };
  $("#ntExp").onclick = () => {
    const blob = new Blob([JSON.stringify({ app: "fincept-easy-notes", version: 1, exported: new Date().toISOString(), notes: notes() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `fincept-notes-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    FE.toast(`노트 ${notes().length}개를 내보냈습니다.`);
  };
  $("#ntImp").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (f.size > 5e6) throw new Error("파일이 너무 큽니다 (5MB 이하).");
      const d = JSON.parse(await f.text()); const arr = Array.isArray(d) ? d : d.notes;
      if (!Array.isArray(arr)) throw new Error("노트 형식이 아닙니다.");
      const cur = notes(), ids = new Set(cur.map(n => n.id));
      const add = arr.filter(n => n && typeof n === "object" && !ids.has(String(n.id))).map(n => ({ id: String(n.id || Math.random().toString(36).slice(2)), title: String(n.title || "").slice(0, 300), body: String(n.body || "").slice(0, 100000), cat: NCATS.some(c => c[0] === n.cat) ? n.cat : "general", sent: NSENT[n.sent] ? n.sent : "neutral", tickers: tickersOf((n.title || "") + " " + (n.body || "")), pin: !!n.pin, created: +n.created || Date.now(), updated: +n.updated || Date.now() }));
      saveNotes([...add, ...cur]); list(); FE.toast(`노트 ${add.length}개를 가져왔습니다.`);
    } catch (er) { FE.toast("가져오기 실패: " + er.message, true); }
    e.target.value = "";
  };
  if (!notes().length) { // first run: one sample note
    saveNotes([{ id: "sample", title: "예시: 반도체 사이클 메모", body: "# 투자 아이디어\n- $005930.KS $000660.KS 메모리 가격 반등 여부 체크\n- $NVDA 데이터센터 매출 성장률\n\n**리스크**: 재고 증가, 환율\n\n> 분기 실적 발표 후 다시 확인", cat: "research", sent: "bullish", tickers: ["005930.KS", "000660.KS", "NVDA"], pin: false, created: Date.now(), updated: Date.now() }]);
    sel = "sample";
  }
  list(); editor();
}

/* ---------- 9. 단위·포맷 ---------- */
function units(box) {
  calc(box, "units", "단위 · 숫자 변환", [
    { k: "n", l: "숫자", v: 1234567890000, u: "", money: true }, { k: "fx", l: "환율 (원/달러)", v: 1350, u: "원" },
    { k: "pct", l: "퍼센트", v: 0.25, u: "%", tip: "t_bp" }, { k: "ar", l: "연 이율", v: 5, u: "%" },
  ], v => {
    const n = v.n;
    const kor = x => { const a = Math.abs(x); const parts = []; let r = Math.floor(a); for (const [u, d] of [["경", 1e16], ["조", 1e12], ["억", 1e8], ["만", 1e4]]) { if (r >= d) { parts.push(FE.int(Math.floor(r / d)) + u); r %= d; } } if (r) parts.push(FE.int(r)); return (x < 0 ? "-" : "") + (parts.join(" ") || "0"); };
    const mr = (Math.pow(1 + v.ar / 100, 1 / 12) - 1) * 100;
    return {
      html: FE.panel({ title: "숫자 읽기", color: "cyan", body: FE.kv([["한국식", kor(n) + "원", "c-orange"], ["간단히", FE.krw(n), "w"], ["영문 단위", FE.big(n), "w"], ["달러 환산", "$" + FE.big(n / (v.fx || 1)), "c-green"], ["달러 → 원 (같은 숫자를 달러로 볼 때)", FE.krw(n * v.fx) + "원", "c-green"], ["지수 표기", n.toExponential(3), "c-muted"]]) })
        + FE.panel({ title: "퍼센트 · bp", color: "yellow", body: FE.kv([[FE.term("t_bp", "bp"), FE.num(v.pct * 100, 1) + "bp", "c-orange"], ["소수", FE.num(v.pct / 100, 6), "w"], ["1억원의 " + v.pct + "%", won(1e8 * v.pct / 100), "w"]]) })
        + FE.panel({ title: "이율 변환", color: "purple", body: FE.kv([["연 " + v.ar + "% → 월 복리 환산", FE.num(mr, 4) + "%", "c-orange"], ["단순 월 이율 (연÷12)", FE.num(v.ar / 12, 4) + "%", "w"], ["월 " + FE.num(v.ar / 12, 3) + "% 복리 → 실효 연이율", FE.num((Math.pow(1 + v.ar / 1200, 12) - 1) * 100, 3) + "%", "w"], ["세후 (이자소득세 15.4%)", FE.num(v.ar * 0.846, 3) + "%", "c-cyan"]]) })
        + FE.panel({ title: "자주 쓰는 단위", color: "orange", flush: true, body: FE.table([{ k: "a", l: "표기", a: "l" }, { k: "b", l: "뜻", a: "l" }], [
          { a: "K / M / B / T", b: "천 / 백만 / 십억 / 조 (1B 달러 ≈ " + FE.krw(1e9 * v.fx) + "원)" }, { a: "1bp", b: "0.01%p" }, { a: "YoY / QoQ / MoM", b: "전년 / 전분기 / 전월 대비" },
          { a: "TTM", b: "최근 12개월 합계" }, { a: "EPS", b: "주당순이익" }, { a: "1주 = 1 share", b: "주식 수 단위" }]) }),
    };
  });
}

const VIEWS = { compound, loan, retire, cagr, avg, tax, r72, notes: notesTab, units };

FE.screen({ id: "tools", label: "도구", primary: true, order: 15, group: "도구", desc: "복리·대출·은퇴·평단가·세금 계산기, 투자 노트, 단위 변환",
  render(el, arg) {
    css();
    let tab = TABS.some(t => t[0] === arg) ? arg : FE.store.get("tools.tab", "compound");
    el.innerHTML = FE.screenHead("TOOLS", "금융 계산기 · 노트 · 단위 변환 — 브라우저에서만 계산 (서버 전송 없음)") + FE.subtabs("tlTab", TABS, tab) + `<div id="tlBody"></div>`;
    const show = id => { tab = id; FE.store.set("tools.tab", id); history.replaceState(null, "", "#tools/" + id); VIEWS[id](el.querySelector("#tlBody")); };
    FE.onSubtabs(el, "tlTab", show);
    show(tab);
  } });
FE.command("/calc", "금융 계산기 (예: /calc loan)", a => FE.go("tools", a || "compound"));
FE.command("/note", "투자 노트", () => FE.go("tools", "notes"));
})();
