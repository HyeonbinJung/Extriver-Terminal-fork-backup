/* PREDICT — 예측시장: Polymarket + Kalshi 공개 시장 데이터 (api/predict.py) */
(() => {
FE.glossary({
  p_vol: ["거래량", "이 시장에서 지금까지(또는 24시간 동안) 거래된 계약 금액(달러). 클수록 많은 사람이 돈을 걸었다는 뜻이라 확률을 더 믿을 만해요."],
  p_liq: ["유동성", "호가창에 걸려 있는 주문 규모. 유동성이 낮으면 조금만 사도 가격(확률)이 크게 움직여요."],
  p_oi: ["미결제 약정", "아직 정산되지 않은 계약의 총액. 결과가 나올 때까지 걸려 있는 돈이에요."],
  p_spread: ["매수·매도 호가 차이", "살 수 있는 가격(ask)과 팔 수 있는 가격(bid)의 차이. 좁을수록 거래가 활발해요."],
  p_chg: ["24시간 변화", "하루 동안 '예' 가격(확률)이 몇 %p 움직였는지."],
  p_negrisk: ["다중 결과 시장", "여러 후보 중 하나만 맞는 시장(예: 대선 후보). 각 후보의 '예' 확률을 합치면 대략 100%가 돼요."],
});

const esc = FE.esc;
let S = null;
const st = () => S ??= { ex: "poly", tag: "", order: "volume24hr", q: "", nosports: FE.store.get("predict.nosports", true), kcat: "", sel: null, ksel: null, interval: "1m", kdays: "30" };
const ORDERS = [["volume24hr", "24시간 거래량"], ["volume", "누적 거래량"], ["liquidity", "유동성"], ["endDate", "마감일"]];

function css() {
  if (document.getElementById("predict-style")) return;
  const s = document.createElement("style"); s.id = "predict-style";
  s.textContent = `
  .pm-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 520px; gap: 8px; min-height: 0; }
  .pm-list { max-height: calc(100vh - 290px); overflow-y: auto; }
  .pm-ev { display: grid; grid-template-columns: 40px minmax(0, 1fr) 150px; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--border-dim); cursor: pointer; }
  .pm-ev:hover { background: var(--bg-hover); }
  .pm-ev.sel { background: var(--accent-bg); box-shadow: inset 3px 0 0 var(--accent); }
  .pm-ev img { width: 40px; height: 40px; object-fit: cover; background: #1a1a1a; }
  .pm-ev .ph { width: 40px; height: 40px; background: #161616; display: flex; align-items: center; justify-content: center; color: var(--text-3); font-weight: 700; }
  .pm-ev .t { color: var(--text); font-weight: 700; line-height: 1.35; margin-bottom: 4px; }
  .pm-ev .tg { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 5px; }
  .pm-ev .tg span { font-size: 10.5px; color: var(--purple); border: 1px solid #3b1a5a; padding: 0 5px; }
  .pm-ev .m { text-align: right; font-size: 12px; color: var(--text-2); line-height: 1.6; white-space: nowrap; }
  .pm-ev .m b { color: var(--cyan); font-weight: 700; }
  .pm-ob { display: grid; grid-template-columns: minmax(60px, 190px) minmax(60px, 1fr) 52px; gap: 8px; align-items: center; font-size: 12px; margin: 2px 0; }
  .pm-ob .l { color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pm-ob .bar { height: 8px; background: #1a1a1a; position: relative; }
  .pm-ob .bar i { position: absolute; left: 0; top: 0; bottom: 0; }
  .pm-ob b { text-align: right; }
  .pm-det h2 { margin: 0 0 6px; font-size: 16px; color: #fff; line-height: 1.4; }
  .pm-desc { color: var(--text-2); white-space: pre-wrap; line-height: 1.65; max-height: 220px; overflow: auto; font-size: 12.5px; }
  .pm-ctl { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .pm-det .stat { min-width: 90px; padding: 6px 10px; }
  .pm-det .stat .v.sm { font-size: 15px; }
  .pm-det .tbl td, .pm-det .tbl th { padding: 4px 5px; font-size: 12px; }
  .pm-det .tbl td.l:first-child { max-width: 170px; overflow: hidden; text-overflow: ellipsis; }
  @media (max-width: 1200px) { .pm-wrap { grid-template-columns: 1fr; } .pm-list { max-height: 60vh; } }
  .pm-mk tr.on td { background: var(--accent-bg) !important; }
  `;
  document.head.appendChild(s);
}

const pct = p => p == null ? "—" : (p * 100 >= 99.5 && p < 1 ? ">99" : p * 100 < 0.5 && p > 0 ? "<1" : FE.num(p * 100, p * 100 < 10 ? 1 : 0)) + "%";
const barColor = (p, i) => i === 0 ? (p >= 0.5 ? FE.color.pos : FE.color.accent) : i === 1 ? FE.color.neg : FE.palette[(i + 2) % 10];
const obar = (label, p, i, extra = "") => `<div class="pm-ob"><span class="l" title="${esc(label)}">${esc(label)}</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, (p || 0) * 100))}%;background:${barColor(p, i)}"></i></div><b class="c-white">${pct(p)}</b>${extra}</div>`;
const usd = v => v == null ? "—" : "$" + FE.big(v, 1);
const endTxt = d => { if (!d) return "—"; const t = new Date(d), days = (t - Date.now()) / 864e5; return `${FE.date(d)}${days > 0 && days < 60 ? ` <span class="c-orange">D-${Math.ceil(days)}</span>` : ""}`; };

// Outcome rows for an event (binary → Yes/No, multi → each sub-market's YES)
function polyOutcomes(e, n = 3) {
  if (e.n_markets === 1 && e.markets[0]) return e.markets[0].outcomes.slice(0, n).map((o, i) => obar(o.name, o.p, i)).join("");
  return e.markets.slice(0, n).map((m, i) => obar(m.label || m.question, m.outcomes[0]?.p, i === 0 ? 0 : i + 2)).join("") + (e.n_markets > n ? `<div class="c-dim" style="font-size:11px">+${e.n_markets - n}개 결과 더 있음</div>` : "");
}

function render(el, arg) {
  css();
  const s = st();
  if (arg === "kalshi" || arg === "poly") s.ex = arg;
  el.innerHTML = FE.screenHead("PREDICTION MARKETS", "Polymarket · Kalshi — 사람들이 돈을 걸어 만든 '사건 확률'",
    `<span class="note">${FE.term("prob", "가격 = 확률")} · 공개 데이터 · 읽기 전용</span>`) +
    FE.subtabs("pmEx", [["poly", "POLYMARKET"], ["kalshi", "KALSHI"]], s.ex) + `<div id="pmBody"></div>
    <div class="note">예측시장 가격은 참가자들의 집단 예상일 뿐 실제 결과를 보장하지 않아요. 질문 원문은 영어로 두고 분류만 한국어로 표시합니다. 한국 거주자는 해당 서비스 이용이 제한될 수 있으니 학습·정보 확인용으로만 보세요.</div>`;
  FE.onSubtabs(el, "pmEx", v => { s.ex = v; body(); });
  const body = () => s.ex === "poly" ? poly(el.querySelector("#pmBody")) : kalshi(el.querySelector("#pmBody"));
  body();
  FE.every(180000, () => body());
}

/* ---------------- Polymarket ---------------- */
async function poly(b) {
  const s = st();
  if (!b.querySelector("#pmList") || b.dataset.ex !== "poly") {
    b.dataset.ex = "poly";
    b.innerHTML = `<div class="pm-ctl" style="margin:8px 0">
        <div id="pmTags"></div>
        <select class="inp" id="pmOrder">${ORDERS.map(([v, l]) => `<option value="${v}">${l} 순</option>`).join("")}</select>
        <input class="inp" id="pmQ" placeholder="검색 (영문, 예: bitcoin, fed, election)" style="width:240px" value="${esc(s.q)}">
        <label class="chk"><input type="checkbox" id="pmNs" ${s.nosports ? "checked" : ""}>스포츠·e스포츠 제외</label>
        <span class="spacer"></span><span class="c-dim" id="pmCnt"></span></div>
      <div class="pm-wrap">${FE.panel({ title: "MARKETS", color: "orange", sub: "Polymarket 활성 이벤트", flush: true, bodyId: "pmList", body: `<div class="loading">불러오는 중…</div>` })}
        ${FE.panel({ title: "MARKET DETAIL", color: "cyan", bodyId: "pmDet", body: `<div class="empty">왼쪽에서 시장을 선택하세요.</div>` })}</div>`;
    b.querySelector("#pmOrder").value = s.order;
    b.querySelector("#pmOrder").onchange = e => { s.order = e.target.value; poly(b); };
    let t; b.querySelector("#pmQ").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { s.q = e.target.value.trim(); poly(b); }, 450); });
    b.querySelector("#pmNs").onchange = e => { s.nosports = e.target.checked; FE.store.set("predict.nosports", s.nosports); poly(b); };
    b.querySelector("#pmList").onclick = e => { const r = e.target.closest("[data-ev]"); if (r) { s.sel = r.dataset.ev; b.querySelectorAll(".pm-ev").forEach(x => x.classList.toggle("sel", x === r)); polyDetail(b); } };
  }
  const list = b.querySelector("#pmList");
  try {
    const d = await FE.api("/api/predict/poly?" + FE.qs({ tag: s.tag, order: s.order, q: s.q, nosports: s.nosports ? 1 : "" }));
    if (!b.isConnected) return;
    const tags = b.querySelector("#pmTags");
    if (!tags.innerHTML) { tags.innerHTML = FE.pills("pmTag", d.tags, s.tag); FE.onPills(tags, "pmTag", v => { s.tag = v; s.q = ""; b.querySelector("#pmQ").value = ""; poly(b); }); }
    b.querySelector("#pmCnt").textContent = `${d.events.length}개 이벤트${s.q ? ` · "${s.q}" 검색` : ""}`;
    list.innerHTML = d.events.length ? d.events.map(e => `<div class="pm-ev ${String(e.id) === String(s.sel) ? "sel" : ""}" data-ev="${esc(e.id)}">
      ${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="ph">?</div>`}
      <div style="min-width:0"><div class="t">${esc(e.title)}</div>
        <div class="tg">${e.tags.slice(0, 4).map((t, i) => `<span>${esc(e.tags_ko[i] || t)}</span>`).join("")}</div>
        ${polyOutcomes(e)}</div>
      <div class="m">24h <b>${usd(e.volume24)}</b><br>누적 <b>${usd(e.volume)}</b><br>유동성 <b>${usd(e.liquidity)}</b><br><span class="c-dim">마감</span> ${endTxt(e.end)}</div></div>`).join("")
      : `<div class="empty">조건에 맞는 활성 시장이 없습니다.</div>`;
    if (!s.sel || !d.events.some(e => String(e.id) === String(s.sel))) { s.sel = d.events[0]?.id; list.querySelector(".pm-ev")?.classList.add("sel"); }
    if (s.sel) polyDetail(b);
    FE.status(`Polymarket ${d.events.length}개 이벤트`);
  } catch (e) { FE.error(list, e); }
}

async function polyDetail(b) {
  const s = st(), box = b.querySelector("#pmDet"), id = s.sel;
  box.innerHTML = `<div class="loading">시장 상세 불러오는 중…</div>`;
  let e;
  try { e = await FE.api("/api/predict/poly_event?id=" + encodeURIComponent(id)); } catch (er) { return FE.error(box, er); }
  if (st().sel !== id) return;
  const mk = e.markets, multi = mk.length > 1;
  let cur = mk[0];
  box.innerHTML = `<div class="pm-det"><h2>${esc(e.title)}</h2>
    <div class="row" style="margin-bottom:8px">${e.tags.map((t, i) => `<span class="badge c-purple">${esc(e.tags_ko[i] || t)}</span>`).join("")}${multi ? `<span class="badge c-orange">${FE.term("p_negrisk", "다중 결과 " + mk.length)}</span>` : ""}</div>
    ${FE.stats([{ l: FE.term("p_vol", "누적 거래량"), v: usd(e.volume), vcls: "sm c-cyan" }, { l: "24H 거래량", v: usd(e.volume24), vcls: "sm c-cyan" }, { l: FE.term("p_liq", "유동성"), v: usd(e.liquidity), vcls: "sm" }, { l: "마감", v: e.end ? FE.date(e.end) : "—", vcls: "sm c-white" }])}
    <div class="row" style="margin:10px 0 4px"><b class="c-orange" id="pmChT"></b><span class="spacer"></span>${FE.pills("pmInt", [["1d", "1D"], ["1w", "1W"], ["1m", "1M"], ["max", "MAX"]], s.interval)}</div>
    <div class="chart md"><canvas id="pmCh"></canvas></div>
    <div style="margin-top:10px" id="pmMk"></div>
    <div class="c-orange" style="font-weight:700;margin:10px 0 4px;letter-spacing:1px">RULES · 판정 기준 (원문)</div>
    <div class="pm-desc">${esc(e.desc || "설명 없음")}</div>
    ${e.resolution ? `<div class="note" style="margin-top:4px">판정 출처: ${esc(e.resolution)}</div>` : ""}
    ${e.url ? `<div style="margin-top:8px"><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Polymarket에서 보기 ↗</a></div>` : ""}</div>`;
  const mkTable = () => {
    box.querySelector("#pmMk").innerHTML = FE.table([
      { k: "label", l: multi ? "결과" : "시장", a: "l", f: (v, r) => `<span class="c-white">${esc(v || r.question)}</span>` },
      { k: "p", l: FE.term("prob", "확률(예)"), a: "l", f: (v, r) => `<div class="pm-ob" style="grid-template-columns:60px 44px;margin:0"><div class="bar"><i style="width:${(r.outcomes[0]?.p || 0) * 100}%;background:${FE.color.pos}"></i></div><b class="c-white">${pct(r.outcomes[0]?.p)}</b></div>` },
      { k: "change1d", l: FE.term("p_chg", "24H"), f: v => v == null ? "—" : `<span class="${FE.cls(v)}">${v > 0 ? "+" : ""}${FE.num(v * 100, 1)}%p</span>` },
      { k: "bid", l: FE.term("p_spread", "BID/ASK"), f: (v, r) => `<span class="c-muted">${v != null ? FE.num(v * 100, 1) : "—"} / ${r.ask != null ? FE.num(r.ask * 100, 1) : "—"}</span>` },
      { k: "volume", l: "거래량", f: v => usd(v) },
    ], mk.map(m => ({ ...m, p: m.outcomes[0]?.p })), { rowCls: m => "click " + (m === cur ? "on" : ""), rowAttr: (m, i) => `data-mi="${i}"`, maxH: "260px", cls: "pm-mk" });
  };
  const chart = async () => {
    const tok = cur?.outcomes[0]?.token;
    box.querySelector("#pmChT").textContent = (multi ? (cur.label || cur.question) + " — " : "") + `${cur?.outcomes[0]?.name || "Yes"} 확률 추이`;
    if (!tok) return;
    try {
      const h = (await FE.api("/api/predict/poly_history?" + FE.qs({ token: tok, interval: s.interval }))).history;
      if (st().sel !== id) return;
      const intra = s.interval === "1d" || s.interval === "1w";
      FE.chart("pmCh", { type: "line", data: { labels: h.map(x => { const d = new Date(x.t * 1000); return intra ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : FE.date(x.t); }),
        datasets: [FE.line("확률", h.map(x => x.p * 100), FE.color.accent, { fill: true, backgroundColor: "rgba(217,119,6,.12)" })] },
        options: FE.chartOpts({ yFmt: v => v + "%", y: { min: 0, max: 100, position: "right", grid: { color: FE.color.grid } } }) });
      if (!h.length) box.querySelector("#pmChT").textContent += " (기록 없음)";
    } catch (er) { box.querySelector("#pmChT").textContent += " — " + er.message; }
  };
  mkTable(); chart();
  FE.onPills(box, "pmInt", v => { s.interval = v; chart(); });
  box.querySelector("#pmMk").onclick = ev => { const r = ev.target.closest("[data-mi]"); if (r) { cur = mk[+r.dataset.mi]; mkTable(); chart(); } };
}

/* ---------------- Kalshi ---------------- */
async function kalshi(b) {
  const s = st();
  if (!b.querySelector("#kList") || b.dataset.ex !== "kalshi") {
    b.dataset.ex = "kalshi";
    b.innerHTML = `<div class="pm-ctl" style="margin:8px 0"><div id="kCats"></div>
        <input class="inp" id="kQ" placeholder="검색 (영문, 예: fed, inflation, president)" style="width:260px" value="">
        <span class="spacer"></span><span class="c-dim" id="kCnt"></span></div>
      <div class="pm-wrap">${FE.panel({ title: "KALSHI EVENTS", color: "orange", sub: "미국 CFTC 규제 거래소 · 24시간 거래량 순", flush: true, bodyId: "kList", body: `<div class="loading">Kalshi 이벤트 불러오는 중… (처음엔 몇 초 걸려요)</div>` })}
        ${FE.panel({ title: "EVENT DETAIL", color: "cyan", bodyId: "kDet", body: `<div class="empty">왼쪽에서 이벤트를 선택하세요.</div>` })}</div>`;
    let t; b.querySelector("#kQ").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { s.kq = e.target.value.trim(); kalshi(b); }, 300); });
    b.querySelector("#kList").onclick = e => { const r = e.target.closest("[data-kt]"); if (r) { s.ksel = r.dataset.kt; b.querySelectorAll(".pm-ev").forEach(x => x.classList.toggle("sel", x === r)); kDetail(b); } };
  }
  const list = b.querySelector("#kList");
  try {
    const d = await FE.api("/api/predict/kalshi?" + FE.qs({ category: s.kcat, q: s.kq }));
    if (!b.isConnected) return;
    const cats = b.querySelector("#kCats");
    if (!cats.innerHTML) { cats.innerHTML = FE.pills("kCat", [["", "전체"], ...d.categories.slice(0, 11).map(([c, ko, n]) => [c, `${ko} ${n}`])], s.kcat); FE.onPills(cats, "kCat", v => { s.kcat = v; kalshi(b); }); }
    b.querySelector("#kCnt").textContent = `${d.total}개 이벤트`;
    list.innerHTML = d.events.length ? d.events.map(e => `<div class="pm-ev ${e.ticker === s.ksel ? "sel" : ""}" data-kt="${esc(e.ticker)}">
      <div class="ph">${esc((e.category || "?").slice(0, 2).toUpperCase())}</div>
      <div style="min-width:0"><div class="t">${esc(e.title)} ${e.sub ? `<span class="c-dim" style="font-weight:400">· ${esc(e.sub)}</span>` : ""}</div>
        <div class="tg"><span>${esc(e.category_ko)}</span><span style="color:var(--text-3);border-color:#222">${esc(e.ticker)}</span></div>
        ${e.markets.slice(0, 3).map((m, i) => obar(e.n_markets > 1 ? (m.label || m.title) : "Yes", m.yes, e.n_markets > 1 && i ? i + 2 : 0)).join("")}
        ${e.n_markets > 3 ? `<div class="c-dim" style="font-size:11px">+${e.n_markets - 3}개 결과 더 있음</div>` : ""}</div>
      <div class="m">24h <b>${FE.big(e.volume24, 1)}</b> 계약<br>누적 <b>${FE.big(e.volume, 1)}</b><br>${FE.term("p_oi", "미결제")} <b>${FE.big(e.oi, 1)}</b><br><span class="c-dim">마감</span> ${endTxt(e.close)}</div></div>`).join("")
      : `<div class="empty">조건에 맞는 이벤트가 없습니다.</div>`;
    if (!s.ksel || !d.events.some(e => e.ticker === s.ksel)) { s.ksel = d.events[0]?.ticker; list.querySelector(".pm-ev")?.classList.add("sel"); }
    if (s.ksel) kDetail(b);
    FE.status(`Kalshi ${d.total}개 이벤트`);
  } catch (e) { FE.error(list, e); }
}

async function kDetail(b) {
  const s = st(), box = b.querySelector("#kDet"), t = s.ksel;
  box.innerHTML = `<div class="loading">불러오는 중…</div>`;
  let e;
  try { e = await FE.api("/api/predict/kalshi_event?ticker=" + encodeURIComponent(t)); } catch (er) { return FE.error(box, er); }
  if (st().ksel !== t) return;
  let cur = e.markets[0];
  box.innerHTML = `<div class="pm-det"><h2>${esc(e.title)}</h2><div class="row" style="margin-bottom:8px"><span class="badge c-purple">${esc(e.category_ko)}</span><span class="badge c-dim">${esc(e.ticker)}</span>${e.sub ? `<span class="c-dim">${esc(e.sub)}</span>` : ""}</div>
    ${FE.stats([{ l: "24H 거래량", v: FE.big(e.volume24, 1), d: "계약", vcls: "sm c-cyan" }, { l: FE.term("p_vol", "누적 거래량"), v: FE.big(e.volume, 1), d: "계약 (1계약 = 최대 $1)", vcls: "sm c-cyan" }, { l: FE.term("p_oi", "미결제"), v: FE.big(e.oi, 1), vcls: "sm" }, { l: "결과 수", v: e.n_markets, vcls: "sm c-white" }])}
    <div class="row" style="margin:10px 0 4px"><b class="c-orange" id="kChT"></b><span class="spacer"></span>${FE.pills("kDays", [["7", "7D"], ["30", "30D"], ["90", "90D"], ["365", "1Y"]], s.kdays)}</div>
    <div class="chart md"><canvas id="kCh"></canvas></div><div id="kMk" style="margin-top:10px"></div>
    <div class="c-orange" style="font-weight:700;margin:10px 0 4px;letter-spacing:1px">RULES · 판정 기준 (원문)</div><div class="pm-desc" id="kRules"></div>
    <div style="margin-top:8px"><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Kalshi에서 보기 ↗</a></div></div>`;
  const table = () => {
    box.querySelector("#kMk").innerHTML = FE.table([
      { k: "label", l: "결과", a: "l", f: (v, r) => `<span class="c-white">${esc(v || r.title)}</span>` },
      { k: "yes", l: FE.term("prob", "확률(예)"), a: "l", f: v => `<div class="pm-ob" style="grid-template-columns:60px 44px;margin:0"><div class="bar"><i style="width:${(v || 0) * 100}%;background:${FE.color.pos}"></i></div><b class="c-white">${pct(v)}</b></div>` },
      { k: "change1d", l: FE.term("p_chg", "24H"), f: v => { const c = v == null ? null : Math.round(v * 100); return c == null ? "—" : `<span class="${FE.cls(c)}">${c > 0 ? "+" : ""}${c}¢</span>`; } },
      { k: "bid", l: FE.term("p_spread", "BID/ASK ¢"), f: (v, r) => `<span class="c-muted">${v != null ? FE.num(v * 100, 0) : "—"} / ${r.ask != null ? FE.num(r.ask * 100, 0) : "—"}</span>` },
      { k: "volume24", l: "24H 거래", f: v => FE.big(v, 1) },
    ], e.markets, { rowCls: m => "click " + (m === cur ? "on" : ""), rowAttr: (m, i) => `data-mi="${i}"`, maxH: "260px", cls: "pm-mk" });
    box.querySelector("#kRules").textContent = cur?.rules || "규칙 정보 없음";
  };
  const chart = async () => {
    box.querySelector("#kChT").textContent = `${cur.label || cur.title} — 예 확률 추이`;
    try {
      const h = (await FE.api("/api/predict/kalshi_history?" + FE.qs({ series: e.series, ticker: cur.ticker, days: s.kdays }))).history;
      if (st().ksel !== t) return;
      const intra = +s.kdays <= 7;
      FE.chart("kCh", { type: "line", data: { labels: h.map(x => { const d = new Date(x.t * 1000); return intra ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}h` : FE.date(x.t); }),
        datasets: [FE.line("확률", h.map(x => x.p * 100), FE.color.cyan, { fill: true, backgroundColor: "rgba(8,145,178,.12)", stepped: true })] },
        options: FE.chartOpts({ yFmt: v => v + "%", y: { min: 0, max: 100, position: "right", grid: { color: FE.color.grid } } }) });
      if (!h.length) box.querySelector("#kChT").textContent += " (거래 기록 없음)";
    } catch (er) { box.querySelector("#kChT").textContent += " — " + er.message; }
  };
  table(); chart();
  FE.onPills(box, "kDays", v => { s.kdays = v; chart(); });
  box.querySelector("#kMk").onclick = ev => { const r = ev.target.closest("[data-mi]"); if (r) { cur = e.markets[+r.dataset.mi]; table(); chart(); } };
}

FE.screen({ id: "predict", label: "예측시장", primary: true, order: 14, group: "트레이딩",
  desc: "Polymarket · Kalshi 예측시장 확률·거래량·가격 추이", render });
})();
