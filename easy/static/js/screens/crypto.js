/* CRYPTO — 크립토: CoinGecko 시장 + alternative.me 공포·탐욕 지수 (api/crypto.py) */
(() => {
FE.glossary({
  c_fdv: ["완전 희석 가치 (FDV)", "최대 공급량이 모두 풀렸다고 가정한 시가총액. 시가총액보다 훨씬 크면 앞으로 풀릴 물량(희석)이 많다는 뜻이에요."],
  c_ath: ["역대 최고가 (ATH)", "지금까지 거래된 가장 높은 가격. 'ATH 대비 -50%'는 최고가에서 반토막 난 상태라는 뜻."],
  c_supply: ["유통 공급량", "현재 시장에서 거래 가능한 코인 수. 최대 공급량이 정해진 코인(BTC 2,100만 개)은 희소성이 강조돼요."],
  c_trending: ["트렌딩", "최근 24시간 CoinGecko에서 가장 많이 검색된 코인. 관심이 쏠렸다는 뜻이지 좋은 투자라는 뜻은 아니에요 (소형 코인이 많음)."],
  c_sector: ["섹터 (카테고리)", "레이어1, 디파이, 밈코인처럼 같은 성격의 코인을 묶은 것. 섹터별 자금 흐름을 보면 시장 테마를 알 수 있어요."],
  c_vol: ["24시간 거래량", "최근 24시간 동안 모든 거래소에서 거래된 금액. 시가총액 대비 거래량이 크면 매매가 활발하다는 뜻."],
  c_chg: ["가격 변화율", "1시간·24시간·7일 전 대비 가격 변화(%)."],
  c_stable: ["스테이블코인", "USDT·USDC처럼 1달러에 가치를 고정한 코인. 가격 변화가 거의 없어요."],
});

let OV = null, MK = null, S = null;
const st = () => S ??= { cur: FE.store.get("crypto.cur", "usd"), tab: "markets", q: "", days: "30" };
const esc = FE.esc;
const TABS = [["markets", "시장 (TOP 100)"], ["sectors", "섹터"], ["fng", "공포·탐욕"]];

function css() {
  if (document.getElementById("crypto-style")) return;
  const s = document.createElement("style"); s.id = "crypto-style";
  s.textContent = `
  .cr-coin { display: flex; align-items: center; gap: 8px; }
  .cr-coin img { width: 18px; height: 18px; border-radius: 50%; background: #222; }
  .cr-coin .n { color: var(--text); font-weight: 700; } .cr-coin .s { color: var(--text-3); font-size: 11.5px; }
  .cr-fng { display: flex; flex-direction: column; gap: 8px; }
  .cr-fng .big { font-size: 40px; font-weight: 700; line-height: 1; }
  .cr-gauge { position: relative; height: 10px; background: linear-gradient(90deg, #dc2626, #ea580c 25%, #ca8a04 50%, #65a30d 75%, #16a34a); }
  .cr-gauge i { position: absolute; top: -4px; width: 3px; height: 18px; background: #fff; box-shadow: 0 0 0 1px #000; }
  .cr-gl { display: flex; justify-content: space-between; color: var(--text-3); font-size: 11px; }
  .cr-tr { display: grid; grid-template-columns: 22px 1fr auto auto; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--border-dim); cursor: pointer; }
  .cr-tr:hover { background: var(--bg-hover); }
  .cr-tr img { width: 18px; height: 18px; border-radius: 50%; }
  .cr-top3 img { width: 16px; height: 16px; border-radius: 50%; margin-left: 2px; vertical-align: middle; }
  .cr-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 10px 12px; background: var(--bg-surface); border: 1px solid var(--border-med); }
  .cr-head img { width: 34px; height: 34px; border-radius: 50%; }
  .cr-head .nm { font-size: 18px; font-weight: 700; color: var(--accent); }
  .cr-head .px { font-size: 22px; font-weight: 700; }
  .cr-desc { color: var(--text-2); line-height: 1.7; white-space: pre-wrap; max-height: 280px; overflow: auto; }
  .cr-dom { display: flex; height: 14px; margin: 6px 0; }
  .cr-dom i { display: block; height: 100%; }
  @media (max-width: 1200px) { .cr-main { grid-template-columns: 1fr !important; } }
  `;
  document.head.appendChild(s);
}

const cur = () => st().cur;
const rate = () => (cur() === "krw" ? (MK?.krw || OV?.krw || null) : 1);
const px = v => { const r = rate(); if (v == null || r == null) return "—"; return cur() === "krw" ? "₩" + (v * r >= 100 ? FE.int(v * r) : FE.num(v * r, 2)) : "$" + FE.price(v); };
const big = v => { const r = rate(); if (v == null || r == null) return "—"; return cur() === "krw" ? "₩" + FE.krw(v * r) : "$" + FE.big(v); };
const pc = v => `<span class="${FE.cls(v)}">${FE.pctRaw(v)}</span>`;
const coinCell = (r) => `<span class="cr-coin">${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}<span class="n">${esc(r.name)}</span><span class="s">${esc(r.symbol)}</span></span>`;
const fngColor = v => v <= 24 ? "#dc2626" : v <= 44 ? "#ea580c" : v <= 55 ? "#ca8a04" : v <= 75 ? "#65a30d" : "#16a34a";

function header(el) {
  const s = st();
  return FE.screenHead("CRYPTO MARKETS", "CoinGecko · alternative.me · 키 없이 무료 데이터 (1~2분 지연)",
    `${FE.pills("crCur", [["usd", "USD $"], ["krw", "KRW ₩"]], s.cur)}
     <input class="inp" id="crQ" placeholder="코인 검색 (이름·심볼)" style="width:180px">
     <button class="btn" id="crRef">새로고침</button>`);
}

function statsHtml() {
  const g = OV?.global || {}, f = OV?.fng?.now;
  const vol = g.volume ?? (MK?.coins?.length ? MK.coins.reduce((a, c) => a + (c.volume || 0), 0) : null);
  return FE.stats([
    { l: "총 시가총액", v: big(g.mcap), d: g.mcap_change_24h != null ? `24h ${pc(g.mcap_change_24h)}` : "", vcls: "sm" },
    { l: FE.term("c_vol", "24H 거래량"), v: big(vol), d: g.volume == null && vol ? "TOP100 합계" : "", vcls: "sm" },
    { l: FE.term("dominance", "BTC 도미넌스"), v: g.btc_dom != null ? FE.num(g.btc_dom, 1) + "%" : "—", vcls: "sm c-orange" },
    { l: "ETH 도미넌스", v: g.eth_dom != null ? FE.num(g.eth_dom, 1) + "%" : "—", vcls: "sm c-blue" },
    { l: FE.term("fng", "공포·탐욕 지수"), v: f ? `<span style="color:${fngColor(f.v)}">${f.v}</span> <span style="font-size:13px;color:${fngColor(f.v)}">${f.ko}</span>` : "—", d: OV?.fng?.avg30 != null ? `30일 평균 ${OV.fng.avg30}` : "", vcls: "sm" },
    { l: "USD/KRW", v: OV?.krw ? FE.num(OV.krw, 1) : "—", d: g.coins ? `코인 ${FE.int(g.coins)}개 · 거래소 ${FE.int(g.markets)}` : "", vcls: "sm c-cyan" },
  ]);
}

function render(el, arg) {
  css();
  const s = st();
  if (arg === "krw" || arg === "usd") { s.cur = arg; FE.store.set("crypto.cur", arg); arg = null; }
  if (arg && TABS.some(t => t[0] === arg)) { s.tab = arg; arg = null; }
  if (arg) return coinView(el, arg);
  el.innerHTML = header(el) + `<div id="crStats">${statsHtml()}</div>` + FE.subtabs("crTab", TABS, s.tab) + `<div id="crBody"><div class="loading">시세 불러오는 중…</div></div>
    <div class="note">데이터: CoinGecko 무료 API (분당 호출 제한이 있어 60~120초 캐시), 한도 초과 시 Yahoo Finance로 대체. 원화 가격은 USD × 환율(KRW=X)로 환산한 값이라 국내 거래소 시세(김치 프리미엄)와 다를 수 있어요. 학습용 정보입니다.</div>`;
  FE.onSubtabs(el, "crTab", v => { s.tab = v; body(); });
  FE.onPills(el, "crCur", v => { s.cur = v; FE.store.set("crypto.cur", v); el.querySelector("#crStats").innerHTML = statsHtml(); body(); });
  const q = el.querySelector("#crQ"); q.value = s.q;
  q.addEventListener("input", () => { s.q = q.value; if (s.tab !== "markets") { s.tab = "markets"; el.querySelectorAll('[data-subtabs="crTab"] button').forEach(b => b.classList.toggle("on", b.dataset.v === "markets")); } body(); });
  q.addEventListener("keydown", async e => {
    if (e.key !== "Enter" || q.value.trim().length < 2) return;
    const hit = MK?.coins.find(c => c.symbol.toLowerCase() === q.value.trim().toLowerCase() || c.name.toLowerCase() === q.value.trim().toLowerCase());
    if (hit) return FE.go("crypto", hit.id);
    try { const r = await FE.api("/api/crypto/search?" + FE.qs({ q: q.value.trim() })); if (r.coins[0]) FE.go("crypto", r.coins[0].id); else FE.toast("검색 결과가 없습니다.", true); } catch (er) { FE.toast(er.message, true); }
  });
  el.querySelector("#crRef").onclick = () => load(true);

  function body() {
    const b = el.querySelector("#crBody");
    if (s.tab === "markets") return marketsTab(b);
    if (s.tab === "sectors") return sectorsTab(b);
    return fngTab(b);
  }

  function marketsTab(b) {
    if (!MK) { b.innerHTML = `<div class="loading">TOP 100 코인 불러오는 중…</div>`; return; }
    const term = s.q.trim().toLowerCase();
    const rows = MK.coins.filter(c => !term || c.name.toLowerCase().includes(term) || c.symbol.toLowerCase().includes(term));
    const tr = OV?.trending || [];
    const g = OV?.global;
    const domCols = ["#f7931a", "#627eea", "#26a17b", "#f3ba2f", "#23292f", "#2775ca", "#9945ff", "#ff060a"];
    b.innerHTML = `<div class="grid cr-main" style="grid-template-columns:minmax(0,1fr) 340px">
      ${FE.panel({ title: "TOP 100 · 시가총액 순", color: "orange", sub: `${rows.length}개 · 출처 ${MK.source === "yahoo" ? "Yahoo (CoinGecko 한도 초과)" : "CoinGecko"}${MK.stale ? " · 지연 데이터" : ""}`, flush: true, bodyId: "crTbl" })}
      <div class="grid" style="align-content:start">
        ${FE.panel({ title: "FEAR & GREED", color: "yellow", sub: FE.term("fng", "공포·탐욕"), body: fngMini() })}
        ${g?.dominance ? FE.panel({ title: "DOMINANCE", color: "cyan", sub: FE.term("dominance", "시총 비중"), body: `<div class="cr-dom">${g.dominance.map(([k, v], i) => `<i style="width:${v}%;background:${domCols[i]}" data-tip="${k.toUpperCase()} ${v.toFixed(1)}%"></i>`).join("")}</div>
            <div class="legend">${g.dominance.map(([k, v], i) => `<span><i style="background:${domCols[i]}"></i>${k.toUpperCase()} ${v.toFixed(1)}%</span>`).join("")}</div>` }) : ""}
        ${FE.panel({ title: "TRENDING", color: "magenta", sub: FE.term("c_trending", "24h 검색 상위"), body: tr.length ? tr.slice(0, 10).map((t, i) => `<div class="cr-tr" data-coin="${esc(t.id)}"><span class="c-dim">${i + 1}</span><span class="cr-coin">${t.thumb ? `<img src="${esc(t.thumb)}" alt="" referrerpolicy="no-referrer">` : ""}<span class="n">${esc(t.symbol)}</span><span class="s">${esc(t.name.slice(0, 16))}</span></span><span class="c-dim">#${t.rank ?? "—"}</span>${pc(t.chg24)}</div>`).join("") : `<div class="empty">트렌딩 데이터 없음</div>` })}
      </div></div>`;
    const draw = list => {
      b.querySelector("#crTbl").innerHTML = FE.table([
        { k: "rank", l: "#", a: "c", sort: true, f: v => `<span class="c-dim">${v ?? "—"}</span>` },
        { k: "name", l: "코인", a: "l", sort: true, f: (v, r) => coinCell(r) },
        { k: "price", l: "가격", sort: true, f: v => `<b class="c-white">${px(v)}</b>` },
        { k: "chg1h", l: FE.term("c_chg", "1H"), sort: true, f: pc },
        { k: "chg24", l: "24H", sort: true, f: pc },
        { k: "chg7d", l: "7D", sort: true, f: pc },
        { k: "mcap", l: FE.term("mcap", "시가총액"), sort: true, f: v => big(v) },
        { k: "volume", l: FE.term("c_vol", "거래량 24H"), sort: true, f: v => `<span class="c-muted">${big(v)}</span>` },
        { k: "spark", l: "7일 추이", a: "c", f: v => FE.sparkline(v, 100, 24) },
      ], list, { rowCls: () => "click", rowAttr: r => `data-coin="${esc(r.id)}"`, maxH: "calc(100vh - 330px)", empty: "검색 결과가 없습니다. Enter를 누르면 전체 코인에서 찾아요." });
      FE.sortable(b.querySelector("#crTbl"), list, draw);
    };
    draw(rows);
    b.onclick = e => { const r = e.target.closest("[data-coin]"); if (r) FE.go("crypto", r.dataset.coin); };
  }

  function fngMini() {
    const f = OV?.fng; if (!f?.now) return `<div class="empty">공포·탐욕 지수를 불러오지 못했습니다.</div>`;
    const h = f.history, prev = h[h.length - 2], wk = h[h.length - 8];
    return `<div class="cr-fng"><div class="row"><span class="big" style="color:${fngColor(f.now.v)}">${f.now.v}</span><span style="color:${fngColor(f.now.v)};font-weight:700;font-size:16px">${f.now.ko}</span><span class="spacer"></span>${FE.sparkline(h.map(x => x.v), 110, 30, FE.color.warn)}</div>
      <div class="cr-gauge"><i style="left:calc(${f.now.v}% - 1px)"></i></div><div class="cr-gl"><span>극단적 공포</span><span>중립</span><span>극단적 탐욕</span></div>
      ${FE.kv([["어제", prev ? `${prev.v} · ${prev.ko}` : "—"], ["지난주", wk ? `${wk.v} · ${wk.ko}` : "—"], ["30일 평균", f.avg30]])}</div>`;
  }

  function sectorsTab(b) {
    const cats = OV?.categories || [];
    if (!cats.length) { b.innerHTML = `<div class="empty">섹터 데이터를 불러오지 못했습니다 (CoinGecko 한도). 잠시 후 새로고침하세요.</div>`; return; }
    const top = cats.slice(0, 24).slice().sort((a, c) => (c.chg24 || 0) - (a.chg24 || 0));
    b.innerHTML = `<div class="grid cols-2">
      ${FE.panel({ title: "SECTOR 24H", color: "cyan", sub: FE.term("c_sector", "시가총액 상위 24개 섹터의 24시간 변화"), body: `<div class="chart lg"><canvas id="crSecCh"></canvas></div>` })}
      ${FE.panel({ title: "SECTORS", color: "orange", sub: `${cats.length}개 (시총 10억 달러 이상)`, flush: true, bodyId: "crSecT" })}</div>`;
    const draw = list => {
      b.querySelector("#crSecT").innerHTML = FE.table([
        { k: "name", l: "섹터", a: "l", sort: true, f: v => `<span class="c-white">${esc(v)}</span>` },
        { k: "mcap", l: "시가총액", sort: true, f: v => big(v) },
        { k: "chg24", l: "24H", sort: true, f: pc },
        { k: "volume", l: "거래량", sort: true, f: v => `<span class="c-muted">${big(v)}</span>` },
        { k: "top", l: "대표 코인", a: "l", f: v => `<span class="cr-top3">${(v || []).map(u => `<img src="${esc(u)}" alt="" referrerpolicy="no-referrer">`).join("")}</span>` },
      ], list, { maxH: "520px" });
      FE.sortable(b.querySelector("#crSecT"), list, draw);
    };
    draw(cats.slice());
    FE.chart("crSecCh", { type: "bar", data: { labels: top.map(c => c.name.length > 22 ? c.name.slice(0, 21) + "…" : c.name), datasets: [{ data: top.map(c => c.chg24), backgroundColor: top.map(c => (c.chg24 || 0) >= 0 ? FE.color.pos : FE.color.neg) }] },
      options: { ...FE.chartOpts({ yFmt: v => v + "%" }), indexAxis: "y", scales: { x: { grid: { color: FE.color.grid }, ticks: { callback: v => v + "%" } }, y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 10.5 } } } } } });
  }

  function fngTab(b) {
    const f = OV?.fng;
    if (!f?.now) { b.innerHTML = `<div class="empty">공포·탐욕 지수를 불러오지 못했습니다.</div>`; return; }
    b.innerHTML = `<div class="grid cr-main" style="grid-template-columns:340px minmax(0,1fr)">
      ${FE.panel({ title: "현재 지수", color: "yellow", body: fngMini() + `<hr class="d"><div class="note">
        <b>0~24 극단적 공포</b> · 25~44 공포 · 45~55 중립 · 56~75 탐욕 · <b>76~100 극단적 탐욕</b><br><br>
        변동성·거래량·소셜 미디어·도미넌스·구글 검색량을 합쳐 매일 계산합니다 (alternative.me). "남들이 공포에 질렸을 때 사라"는 역발상 지표로 많이 쓰이지만, 공포가 더 길게 이어질 수도 있어요.
        ${f.next_update ? `<br><br>다음 갱신까지 약 ${Math.round(f.next_update / 3600)}시간` : ""}</div>` })}
      ${FE.panel({ title: "30일 추이", color: "orange", sub: "막대 색 = 구간 (빨강 공포 → 초록 탐욕)", body: `<div class="chart lg"><canvas id="crFngCh"></canvas></div>` })}</div>
      ${FE.panel({ title: "일별 기록", color: "cyan", flush: true, body: FE.table([
        { k: "t", l: "날짜", a: "l", f: v => FE.date(v) }, { k: "v", l: "지수", f: v => `<b style="color:${fngColor(v)}">${v}</b>` },
        { k: "ko", l: "구간", a: "l", f: (v, r) => `<span style="color:${fngColor(r.v)}">${esc(v)}</span>` },
        { k: "label", l: "원문", a: "l", f: v => `<span class="c-dim">${esc(v)}</span>` }], f.history.slice().reverse(), { maxH: "300px" }) })}`;
    FE.chart("crFngCh", { type: "bar", data: { labels: f.history.map(x => FE.date(x.t).slice(5)), datasets: [{ data: f.history.map(x => x.v), backgroundColor: f.history.map(x => fngColor(x.v)) }] },
      options: FE.chartOpts({ y: { min: 0, max: 100, position: "right", grid: { color: FE.color.grid } }, xTicks: 10 }) });
  }

  async function load(force) {
    try {
      const [o, m] = await Promise.allSettled([FE.api("/api/crypto/overview"), FE.api("/api/crypto/markets")]);
      if (o.status === "fulfilled") OV = o.value; if (m.status === "fulfilled") MK = m.value;
      if (!el.isConnected) return;
      el.querySelector("#crStats").innerHTML = statsHtml(); body();
      if (m.status === "rejected") FE.toast("코인 시세 오류: " + m.reason.message, true);
      FE.status(`코인 ${MK?.coins?.length || 0}개 · ${MK?.source || ""}`);
      if (force) FE.toast("새로고침했습니다 (서버 캐시 60~120초).");
    } catch (e) { FE.error(el.querySelector("#crBody"), e); }
  }
  body(); load();
  FE.every(120000, load);
}

/* ---------------- coin detail (#crypto/<coingecko id>) ---------------- */
async function coinView(el, id) {
  const s = st();
  el.innerHTML = FE.screenHead("CRYPTO · " + esc(id.toUpperCase()), "코인 상세",
    `<button class="btn muted" data-go="crypto">◀ 목록</button>${FE.pills("crCur2", [["usd", "USD $"], ["krw", "KRW ₩"]], s.cur)}`) + `<div id="crDet"><div class="loading">코인 정보 불러오는 중…</div></div>`;
  FE.onPills(el, "crCur2", v => { s.cur = v; FE.store.set("crypto.cur", v); draw(); });
  let D = null;
  const row = MK?.coins.find(c => c.id === id);
  async function load() {
    try {
      D = await FE.api("/api/crypto/coin?" + FE.qs({ id, days: s.days, symbol: row?.symbol }));
      if (!OV) FE.api("/api/crypto/overview").then(o => { OV = o; }).catch(() => {});
      draw();
    } catch (e) { FE.error(el.querySelector("#crDet"), e); }
  }
  function draw() {
    if (!D) return;
    const i = D.info || {}, last = D.chart?.length ? D.chart[D.chart.length - 1].p : i.price;
    const first = D.chart?.length ? D.chart[0].p : null, chg = first ? (last / first - 1) * 100 : null;
    if (!rate() && D.krw) MK = { ...(MK || {}), krw: D.krw };
    const desc = i.desc_ko || i.desc;
    el.querySelector("#crDet").innerHTML = `
      <div class="cr-head">${i.image ? `<img src="${esc(i.image)}" alt="" referrerpolicy="no-referrer">` : ""}<span class="nm">${esc(i.name || id)}</span><span class="c-dim">${esc(i.symbol || "")} · #${i.rank ?? "—"}</span>
        <span class="px">${px(last)}</span><span class="${FE.cls(i.chg24)}" style="font-weight:700">${FE.arrow(i.chg24)} ${FE.pctRaw(i.chg24)} <span class="c-dim">24h</span></span>
        <span class="spacer"></span>${FE.pills("crDays", [["1", "1D"], ["7", "7D"], ["30", "30D"], ["90", "90D"], ["365", "1Y"]], s.days)}</div>
      <div class="grid cr-main" style="grid-template-columns:minmax(0,1fr) 340px;margin-top:8px">
        ${FE.panel({ title: "PRICE", color: "orange", sub: `${({ 1: "1일", 7: "7일", 30: "30일", 90: "90일", 365: "1년" })[s.days]} 변화 <span class="${FE.cls(chg)}">${FE.pctRaw(chg)}</span> · ${esc(D.chart_src || "")}${cur() === "krw" ? " · 원화 환산" : ""}`, body: D.chart?.length ? `<div id="crCh" style="height:420px"></div>` : `<div class="empty">차트 데이터 없음 (${esc((D.errors || []).join(" / "))})</div>` })}
        ${FE.panel({ title: "STATS", color: "cyan", body: FE.kv([
          [FE.term("mcap", "시가총액"), big(i.mcap)], [FE.term("c_fdv", "FDV"), big(i.fdv)], [FE.term("c_vol", "24h 거래량"), big(i.volume)],
          ["24h 고가", px(i.high24)], ["24h 저가", px(i.low24)],
          [FE.term("c_ath", "역대 최고가"), px(i.ath)], ["ATH 대비", pc(i.ath_chg)], ["ATH 날짜", FE.date(i.ath_date)],
          ["7일 변화", pc(i.chg7d)], ["30일 변화", pc(i.chg30d)], ["1년 변화", pc(i.chg1y)],
          [FE.term("c_supply", "유통량"), i.supply ? FE.big(i.supply) + " " + esc(i.symbol || "") : "—"],
          ["최대 공급", i.max_supply ? FE.big(i.max_supply) : "무제한/미정"],
          ["커뮤니티 낙관", i.sentiment_up != null ? FE.num(i.sentiment_up, 0) + "%" : "—", "c-green"],
          ["해시 알고리즘", esc(i.hashing || "—"), "w"], ["시작일", esc(i.genesis || "—"), "w"],
        ]) + (i.homepage ? `<div style="margin-top:8px"><a href="${esc(i.homepage)}" target="_blank" rel="noopener noreferrer">공식 홈페이지 ↗</a></div>` : "") })}
      </div>
      ${desc ? FE.panel({ title: "ABOUT", color: "purple", sub: (i.categories || []).map(c => `<span class="badge c-orange" style="margin-right:4px">${esc(c)}</span>`).join("") + (i.desc_ko ? "" : " · 한글 설명이 없어 영문 표시"), body: `<div class="cr-desc">${esc(desc)}</div>` }) : ""}
      <div class="note">${D.errors?.length ? "일부 데이터 오류: " + esc(D.errors.join(" / ")) + " · " : ""}가격 차트·통계는 CoinGecko 기준이며 학습용입니다.</div>`;
    FE.onPills(el, "crDays", v => { s.days = v; el.querySelector("#crCh") && (el.querySelector("#crCh").innerHTML = `<div class="loading">불러오는 중…</div>`); load(); });
    const box = el.querySelector("#crCh");
    if (box && D.chart?.length) {
      const r = rate() || 1, seen = new Set();
      const candles = D.chart.filter(p => p.p != null && !seen.has(p.t) && seen.add(p.t)).map(p => ({ time: p.t, open: p.p * r, high: p.p * r, low: p.p * r, close: p.p * r, volume: p.v ? p.v * r : 0 }));
      box.innerHTML = "";
      FE.priceChart(box, { candles, type: "area", height: 420, intraday: +s.days <= 7, volume: true });
    }
  }
  load();
  FE.every(120000, load);
}

FE.screen({ id: "crypto", label: "크립토", primary: true, order: 8, fkey: "F8", group: "시장",
  desc: "코인 TOP 100 · 공포·탐욕 지수 · 트렌딩 · 섹터 (CoinGecko)", render });
FE.command("/coin", "코인 상세 (예: /coin bitcoin)", a => FE.go("crypto", (a || "").toLowerCase() || undefined));
})();
