/* FOREX — 환율: converter, pair chart, KRW-centric table, cross-rate matrix */
(() => {
FE.glossary({
  crossrate: ["크로스 환율", "달러를 거치지 않은 두 통화 사이의 환율(예: EUR/KRW). 보통 각 통화의 달러 환율을 나눠서 계산해요."],
  fxpair: ["통화쌍", "EUR/USD = 1유로를 사는 데 필요한 달러. 앞쪽이 기준 통화, 뒤쪽이 가격 통화예요."],
  fxvol: ["환율 변동성", "일간 환율 변화의 표준편차를 1년 기준으로 환산. 주요 통화는 보통 5~12%, 신흥국 통화는 더 커요."],
  krwrate: ["원화 기준 환율", "외화 1단위(엔·동·루피아는 100단위)를 사는 데 필요한 원화. 숫자가 오르면 원화 약세(외화가 비싸짐)."],
});

const NAMES = { USD: "미국 달러", KRW: "한국 원", EUR: "유로", JPY: "일본 엔", CNY: "중국 위안", GBP: "영국 파운드", AUD: "호주 달러", CAD: "캐나다 달러",
  CHF: "스위스 프랑", HKD: "홍콩 달러", SGD: "싱가포르 달러", VND: "베트남 동", TWD: "대만 달러", INR: "인도 루피", THB: "태국 바트", NZD: "뉴질랜드 달러",
  SEK: "스웨덴 크로나", NOK: "노르웨이 크로네", MXN: "멕시코 페소", BRL: "브라질 헤알", PHP: "필리핀 페소", IDR: "인도네시아 루피아", MYR: "말레이시아 링깃",
  ZAR: "남아공 랜드", TRY: "튀르키예 리라", DKK: "덴마크 크로네", PLN: "폴란드 즐로티" };
const SIGN = { USD: "$", KRW: "₩", EUR: "€", JPY: "¥", CNY: "¥", GBP: "£", VND: "₫", INR: "₹" };
const UNIT = { JPY: 100, VND: 100, IDR: 100 };
const CCYS = Object.keys(NAMES);
const MATRIX = ["USD", "EUR", "JPY", "GBP", "CNY", "KRW", "AUD", "CAD", "CHF", "HKD"];
const HZ = ["1D", "1W", "1M", "3M", "1Y"];

const css = `
#scr-forex .fxres { font-size:26px; font-weight:700; color:var(--accent); margin:8px 0 2px; word-break:break-all; }
#scr-forex .fxin { display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); gap:6px; align-items:end; }
#scr-forex .fxin .full { grid-column:1 / -1; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:6px; align-items:end; }
#scr-forex .fxin select { width:100%; }
#scr-forex .mx td { text-align:center; font-size:11.5px; padding:4px 4px; color:#fff; }
#scr-forex .mx th { text-align:center; }
#scr-forex .mx td.h { color:var(--accent); font-weight:700; background:var(--bg-raised) !important; }
#scr-forex .heat td.v span { display:block; padding:1px 0; color:#fff; }
@media (max-width:1000px) { #scr-forex .fxg { grid-template-columns:1fr !important; } }
`;
if (!document.getElementById("forex-css")) { const s = document.createElement("style"); s.id = "forex-css"; s.textContent = css; document.head.appendChild(s); }

const esc = FE.esc;
const opt = sel => CCYS.map(c => `<option value="${c}" ${c === sel ? "selected" : ""}>${c} · ${NAMES[c]}</option>`).join("");
const fmtRate = v => { if (v == null || isNaN(v)) return "—"; const a = Math.abs(v); return FE.num(v, a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : 7); };
const fmtAmt = (v, c) => { if (v == null || isNaN(v)) return "—"; const d = ["KRW", "JPY", "VND", "IDR"].includes(c) ? 0 : 2; return (SIGN[c] || "") + FE.num(v, Math.abs(v) < 1 ? 6 : d) + " " + c; };
let root = null;
let st = { amount: 1000, from: "USD", to: "KRW", period: "1y", base: "KRW" };

function parseArg(arg) {
  if (!arg) return;
  const toks = String(arg).toUpperCase().replace(/[\/,]/g, " ").split(/\s+/).filter(Boolean);
  const ccy = toks.filter(t => CCYS.includes(t));
  const n = toks.find(t => /^[\d.]+$/.test(t.replace(/,/g, "")));
  if (n) st.amount = parseFloat(n.replace(/,/g, ""));
  if (ccy[0]) st.from = ccy[0];
  if (ccy[1]) st.to = ccy[1]; else if (ccy[0] && ccy[0] !== "KRW") st.to = "KRW"; else if (ccy[0] === "KRW") st.to = "USD";
  const bad = toks.filter(t => /^[A-Z]{3}$/.test(t) && !CCYS.includes(t));
  if (bad.length) setTimeout(() => FE.toast("지원하지 않는 통화: " + bad.join(", "), true), 300);
}

async function convert() {
  const o = root?.querySelector("#fxOut"); if (!o) return;
  st.amount = parseFloat(root.querySelector("#fxAmt").value.replace(/,/g, "")) || 0;
  st.from = root.querySelector("#fxFrom").value; st.to = root.querySelector("#fxTo").value;
  FE.store.set("fx.state", st);
  if (st.from === st.to) { o.innerHTML = `<div class="fxres">${fmtAmt(st.amount, st.to)}</div><div class="note">같은 통화예요.</div>`; return; }
  try {
    const d = await FE.api("/api/markets/fx/convert?" + FE.qs({ amount: st.amount, from: st.from, to: st.to }));
    o.innerHTML = `<div class="c-muted">${fmtAmt(d.amount, d.from)} =</div><div class="fxres">${fmtAmt(d.result, d.to)}</div>` +
      FE.kv([[FE.term("fxpair", `${d.from}/${d.to}`), fmtRate(d.rate)], [`${d.to}/${d.from}`, fmtRate(d.inverse)],
        ["전일 대비", FE.spct(d.change_1d), FE.cls(d.change_1d)], ["1개월 대비", FE.spct(d.change_1m), FE.cls(d.change_1m)]]) +
      `<div class="note" style="margin-top:6px">Yahoo Finance 일별 환율(최근 체결가) 기준 · 은행 고시 환율·수수료(스프레드)와 다를 수 있어요.</div>`;
  } catch (e) { FE.error(o, e); }
}

async function chart() {
  const o = root?.querySelector("#fxChartBox"); if (!o) return;
  const a = st.from, b = st.to === st.from ? (a === "KRW" ? "USD" : "KRW") : st.to;
  root.querySelector("#fxPairT").textContent = `${a}/${b}`;
  o.innerHTML = `<div class="loading">차트 불러오는 중…</div>`;
  try {
    const d = await FE.api("/api/markets/fx/chart?" + FE.qs({ from: a, to: b, period: st.period }));
    if (!root) return;
    const s = d.stats, computed = !/=X$/.test(d.source);
    o.innerHTML = `<div id="fxPC" style="height:300px"></div>` + `<div style="margin-top:6px">${FE.stats([
      { l: "현재", v: fmtRate(s.last), vcls: "c-white sm" }, { l: "기간 변화", v: FE.spct(s.change), vcls: FE.cls(s.change) + " sm" },
      { l: "최고", v: fmtRate(s.high), vcls: "pos sm" }, { l: "최저", v: fmtRate(s.low), vcls: "neg sm" }, { l: "평균", v: fmtRate(s.mean), vcls: "sm" },
      { l: FE.term("fxvol", "연 변동성"), v: FE.pct(s.vol, 1), vcls: "c-cyan sm" }, { l: "최대 일간 상승/하락", v: `<span class="pos">${FE.spct(s.best)}</span> <span class="neg">${FE.spct(s.worst)}</span>`, vcls: "sm" },
    ])}</div><div class="note">데이터: ${esc(d.source)} · ${s.days}거래일</div>`;
    FE.priceChart(o.querySelector("#fxPC"), { candles: d.candles, type: computed ? "area" : "candle", volume: false, height: 300 });
  } catch (e) { FE.error(o, e); }
}

async function table() {
  const o = root?.querySelector("#fxTbl"); if (!o) return;
  try {
    const d = await FE.api("/api/markets/fx/rates?base=" + st.base);
    if (!root) return;
    const rows = d.rows.map(r => ({ ...r, unit: st.base === "KRW" ? (UNIT[r.ccy] || 1) : 1 }));
    const mx = Object.fromEntries(HZ.map(h => [h, Math.max(0.002, ...rows.map(r => Math.abs(r[h] || 0)))]));
    const draw = () => {
      o.innerHTML = FE.table([
        { k: "ccy", l: "통화", a: "l", f: (c, r) => `<b class="c-orange">${c}</b> ${esc(NAMES[c] || "")}${r.unit > 1 ? ` <span class="c-dim">(${r.unit})</span>` : ""}`, sort: true },
        { k: "rate", l: `${st.base} 환산`, f: (v, r) => `<b class="c-white">${fmtRate(v * r.unit)}</b>`, sort: true },
        ...HZ.map(h => ({ k: h, l: h, a: "c", sort: true, f: v => `<span style="${FE.heat(v, mx[h])}">${FE.spct(v)}</span>`, c: () => "v" })),
        { k: "lo52", l: "52주 최저", f: (v, r) => fmtRate(v * r.unit), c: () => "c-muted" },
        { k: "hi52", l: "52주 최고", f: (v, r) => fmtRate(v * r.unit), c: () => "c-muted" },
        { k: "spark", l: "30일", a: "c", f: v => FE.sparkline(v, 70, 18) },
      ], rows, { cls: "heat", rowCls: r => "click" + (r.ccy === st.from ? " sel" : ""), rowAttr: r => `data-ccy="${r.ccy}"`, maxH: "460px" });
      FE.sortable(o, rows, draw);
    };
    draw();
    root.querySelector("#fxAsof").textContent = d.asof || "";
  } catch (e) { FE.error(o, e); }
}

async function matrix() {
  const o = root?.querySelector("#fxMx"); if (!o) return;
  try {
    const d = await FE.api("/api/markets/fx/matrix?ccys=" + MATRIX.join(","));
    if (!root) return;
    o.innerHTML = `<div class="tbl-wrap"><table class="tbl mx"><thead><tr><th>1 단위 →</th>${d.ccys.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>` +
      d.ccys.map((a, i) => `<tr><td class="h">${a}</td>${d.ccys.map((b, j) => i === j ? `<td style="background:var(--bg-raised);color:var(--text-3)">—</td>` :
        `<td class="click" data-a="${a}" data-b="${b}" style="cursor:pointer;${FE.heat(d.change[i][j], 0.015)}" data-tip="1 ${a} = ${fmtRate(d.matrix[i][j])} ${b} · 전일 대비 ${FE.spct(d.change[i][j])}">${fmtRate(d.matrix[i][j])}</td>`).join("")}</tr>`).join("") +
      `</tbody></table></div><div class="note" style="padding:6px 10px">행 통화 1단위가 열 통화로 얼마인지 · 색 = 전일 대비 변화(초록: 행 통화 강세) · 셀을 누르면 변환기와 차트에 반영돼요.</div>`;
  } catch (e) { FE.error(o, e); }
}

function setPair(a, b) {
  st.from = a; st.to = b;
  root.querySelector("#fxFrom").value = a; root.querySelector("#fxTo").value = b;
  convert(); chart();
  root.querySelectorAll("#fxTbl tr[data-ccy]").forEach(tr => tr.classList.toggle("sel", tr.dataset.ccy === a));
}

FE.screen({
  id: "forex", label: "환율", primary: true, order: 12, group: "시장",
  desc: "환율 변환기 · 통화쌍 차트 · 원화 기준 환율표 · 크로스 환율 매트릭스",
  render(el, arg) {
    root = el;
    st = { ...st, ...FE.store.get("fx.state", {}) };
    parseArg(arg);
    el.innerHTML = FE.screenHead("FOREX", "환율 변환 · 통화쌍 차트 · 원화 기준 환율 · 크로스 환율",
      `<span class="note">명령줄: <b>/fx 100 USD KRW</b></span><button class="btn" id="fxRef">↻ 새로고침</button>`) +
      `<div class="grid fxg" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">` +
      FE.panel({ title: "환율 변환기", sub: "CURRENCY CONVERTER", color: "orange", bar: true, body: `
        <div class="fxin"><div class="full">${FE.field("금액", `<input class="inp" id="fxAmt" value="${st.amount}" inputmode="decimal">`)}<button class="btn solid" id="fxGo">변환</button></div>
          ${FE.field("보내는 통화", `<select class="inp" id="fxFrom">${opt(st.from)}</select>`)}
          <button class="btn muted" id="fxSwap" title="통화 바꾸기">⇄</button>
          ${FE.field("받는 통화", `<select class="inp" id="fxTo">${opt(st.to)}</select>`)}</div>
        <div class="row" style="margin-top:6px">${[1, 100, 1000, 10000, 1000000].map(v => `<button class="pill" data-amt="${v}">${FE.int(v)}</button>`).join("")}</div>
        <div id="fxOut"><div class="loading">계산 중…</div></div>` }) +
      FE.panel({ title: "통화쌍 차트", sub: `<span id="fxPairT"></span>`, color: "cyan", bar: true,
        acts: FE.pills("fxp", [["1mo", "1M"], ["3mo", "3M"], ["6mo", "6M"], ["ytd", "YTD"], ["1y", "1Y"], ["2y", "2Y"], ["5y", "5Y"], ["10y", "10Y"]], st.period),
        body: `<div id="fxChartBox"></div>` }) + `</div>` +
      `<div class="grid fxg" style="grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)">` +
      FE.panel({ title: "원화 기준 환율", sub: `${FE.term("krwrate", "KRW BASED")} · <span id="fxAsof"></span>`, color: "green", bar: true, flush: true,
        acts: FE.pills("fxbase", [["KRW", "원화 기준"], ["USD", "달러 기준"]], st.base), body: `<div id="fxTbl"><div class="loading">불러오는 중…</div></div>` }) +
      FE.panel({ title: "크로스 환율", sub: FE.term("crossrate", "CROSS RATES"), color: "purple", bar: true, flush: true, body: `<div id="fxMx"><div class="loading">불러오는 중…</div></div>` }) + `</div>`;

    const go = () => { convert(); chart(); };
    el.querySelector("#fxGo").onclick = go;
    el.querySelector("#fxAmt").addEventListener("keydown", e => e.key === "Enter" && convert());
    el.querySelector("#fxAmt").addEventListener("input", () => { clearTimeout(el._t); el._t = setTimeout(convert, 400); });
    el.querySelector("#fxFrom").onchange = go; el.querySelector("#fxTo").onchange = go;
    el.querySelector("#fxSwap").onclick = () => setPair(st.to, st.from);
    el.querySelector("#fxRef").onclick = () => { convert(); chart(); table(); matrix(); };
    FE.onPills(el, "fxp", v => { st.period = v; FE.store.set("fx.state", st); chart(); });
    FE.onPills(el, "fxbase", v => { st.base = v; FE.store.set("fx.state", st); table(); });
    el.addEventListener("click", e => {
      const a = e.target.closest("[data-amt]"); if (a) { el.querySelector("#fxAmt").value = a.dataset.amt; return convert(); }
      const c = e.target.closest("tr[data-ccy]"); if (c) { const x = c.dataset.ccy; return setPair(x, st.base === x ? (x === "KRW" ? "USD" : "KRW") : st.base); }
      const m = e.target.closest("td[data-a]"); if (m) return setPair(m.dataset.a, m.dataset.b);
    });
    go(); table(); matrix();
    FE.every(120000, () => { convert(); table(); matrix(); });
  },
  leave() { root = null; },
});

FE.command("/fx", "환율 변환 (예: /fx 100 USD KRW)", a => FE.go("forex", a || "1 USD KRW"));
})();
