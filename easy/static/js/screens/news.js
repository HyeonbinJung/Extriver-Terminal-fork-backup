/* NEWS — 뉴스: RSS aggregation (api/news.py), layout mirrors the desktop News screen (images/News.png) */
(() => {
FE.glossary({
  n_sent: ["뉴스 감성 (센티먼트)", "제목·요약에 들어간 긍정 단어(급등, 반등, beat…)와 부정 단어(급락, 우려, miss…)를 세어 강세▲ / 약세▼ / 중립–으로 분류한 값이에요. 단순 키워드 규칙이라 참고용입니다."],
  n_impact: ["시장 영향도", "금리·연준·전쟁·급락·속보 같은 단어가 제목에 있으면 HIGH, 실적·유가·인수합병 등은 MED, 나머지는 LOW. 시장을 크게 움직일 수 있는 뉴스를 먼저 보려고 쓰는 필터예요."],
  n_flash: ["FLASH (긴급)", "최근 6시간 안에 나온 영향도 HIGH 기사 중 가장 새로운 것. 데스크톱 앱의 FLASH 배너와 같은 역할이에요."],
  n_ticker: ["$티커 태그", "기사 제목에서 회사·자산 이름을 찾아 붙인 종목 코드. 누르면 종목 리서치 화면이 열려요."],
  n_dedupe: ["중복 제거", "여러 매체가 같은 소식을 비슷한 제목으로 내보내면 하나만 남기고, 같은 소식을 다룬 다른 매체 수를 +N으로 표시해요."],
});

const CATS = [["ALL", "ALL"], ["MKT", "MKT"], ["EARN", "EARN"], ["ECO", "ECO"], ["TECH", "TECH"], ["NRG", "NRG"], ["CRPT", "CRPT"], ["GEO", "GEO"], ["DEF", "DEF"], ["KR", "KR"]];
const CAT_KO = { ALL: "전체", MKT: "시장", EARN: "실적", ECO: "경제·중앙은행", TECH: "기술", NRG: "에너지·원자재", CRPT: "암호화폐", GEO: "지정학", DEF: "국방", KR: "한국" };
const WINDOWS = [["1", "1H"], ["6", "6H"], ["24", "24H"], ["48", "48H"], ["168", "7D"]];
const SENT_KO = { bullish: "강세", bearish: "약세", neutral: "중립" };
const esc = FE.esc;

let DATA = null, S = null;
const st = () => S ??= {
  cat: FE.store.get("news.cat", "ALL"), win: FE.store.get("news.win", "24"), q: "", src: "", sent: "", imp: "",
  view: "feed", sel: null, lang: FE.store.get("news.lang", ""),
};
const bm = () => FE.store.get("news.bookmarks", []);
const isBm = id => bm().some(b => b.id === id);

function css() {
  if (document.getElementById("news-style")) return;
  const s = document.createElement("style"); s.id = "news-style";
  s.textContent = `
  #scr-news { height: 100%; padding: 0; gap: 0; overflow: hidden; }
  .nw-cmd { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--border-dim); background: var(--bg-surface); flex-wrap: wrap; flex: none; }
  .nw-intel { border: 1px solid var(--accent); color: var(--accent); font-weight: 700; padding: 1px 10px; letter-spacing: 1px; }
  .nw-cmd .inp { height: 24px; }
  .nw-cmd .pill { font-size: 11.5px; padding: 1px 7px; }
  .nw-cnt { margin-left: auto; display: flex; gap: 14px; align-items: center; white-space: nowrap; font-size: 12px; font-weight: 700; }
  #nwStats { display: flex; gap: 16px; align-items: center; }
  .nw-cmd select.inp { font-size: 12px; padding: 2px 4px; height: 24px; }
  .nw-stats { display: flex; align-items: center; gap: 16px; padding: 4px 10px; border-bottom: 1px solid var(--border-dim); color: var(--text-3); font-size: 11.5px; white-space: nowrap; overflow: hidden; flex: none; }
  .nw-stats b { color: var(--cyan); font-weight: 400; margin-left: 4px; }
  .nw-sbar { display: inline-flex; width: 90px; height: 6px; vertical-align: middle; margin: 0 6px; background: var(--border-med); }
  .nw-sbar i { display: block; height: 100%; }
  .nw-main { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 470px; }
  .nw-left { display: flex; flex-direction: column; min-width: 0; min-height: 0; border-right: 1px solid var(--border-med); }
  .nw-flash { display: flex; align-items: center; gap: 10px; background: #2a0808; border-bottom: 1px solid var(--neg-dim); padding: 0 10px 0 0; height: 30px; flex: none; cursor: pointer; }
  .nw-flash .tag { background: var(--neg); color: #fff; font-weight: 700; padding: 0 10px; height: 100%; display: flex; align-items: center; letter-spacing: 1px; }
  .nw-flash .h { color: #fff; font-weight: 700; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nw-flash .s { color: var(--cyan); font-size: 11.5px; }
  .nw-list { flex: 1; overflow-y: auto; min-height: 0; }
  .nw-row { display: grid; grid-template-columns: 48px 12px 118px minmax(0, 1fr) auto; align-items: center; gap: 4px; height: 29px; padding: 0 10px 0 6px; border-bottom: 1px solid #121212; border-left: 3px solid transparent; cursor: pointer; font-size: 14px; }
  .nw-row:nth-child(even) { background: #0b0b0b; }
  .nw-row:hover { background: var(--bg-hover); }
  .nw-row.sel { background: #1c1408; }
  .nw-row.i-HIGH { border-left-color: var(--accent); }
  .nw-row.i-MED { border-left-color: #6b4a12; }
  .nw-row .age { color: var(--text-3); text-align: right; font-size: 12.5px; padding-right: 4px; }
  .nw-row .dot { color: var(--text-3); font-size: 10px; }
  .nw-row .dot.new { color: var(--accent); }
  .nw-row .src { color: var(--cyan); font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: clip; font-size: 13px; }
  .nw-row .hl { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--text); }
  .nw-row .hl .dup { color: var(--text-3); font-size: 11px; margin-left: 6px; }
  .nw-row .meta { display: flex; gap: 6px; align-items: center; white-space: nowrap; font-size: 12.5px; padding-left: 8px; }
  .nw-tk { color: var(--warn); cursor: pointer; }
  .nw-tk:hover { text-decoration: underline; }
  .nw-imp-HIGH { color: var(--neg); font-weight: 700; } .nw-imp-MED { color: var(--warn); }
  .nw-right { display: flex; flex-direction: column; min-height: 0; overflow-y: auto; background: var(--bg-surface); }
  .nw-dh { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border-dim); color: var(--accent); font-weight: 700; letter-spacing: 2px; }
  .nw-det { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
  .nw-det h2 { margin: 0; font-size: 16px; line-height: 1.45; color: #fff; }
  .nw-badges { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .nw-badges .badge { padding: 1px 7px; }
  .nw-sum { color: var(--text-2); line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
  .nw-btns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .nw-btns .btn { text-align: center; padding: 6px 4px; }
  .nw-btns a.btn { text-decoration: none; display: block; }
  .nw-btns .btn.on { color: var(--on-accent); background: var(--accent); border-color: var(--accent); }
  .nw-rel-h { color: var(--accent); font-weight: 700; letter-spacing: 1px; margin-top: 4px; border-top: 1px solid var(--border-dim); padding-top: 10px; }
  .nw-rel { padding: 5px 0; border-bottom: 1px solid #141414; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-2); font-size: 12.5px; }
  .nw-rel:hover { color: var(--text); }
  .nw-rel b { color: var(--cyan); font-weight: 400; }
  .nw-strip { height: 26px; border-top: 1px solid var(--border-med); background: var(--bg-base); overflow: hidden; white-space: nowrap; flex: none; position: relative; }
  .nw-strip .track { display: inline-flex; gap: 36px; padding-left: 100%; line-height: 26px; animation: nwscroll 260s linear infinite; }
  .nw-strip:hover .track { animation-play-state: paused; }
  .nw-strip span { cursor: pointer; }
  @keyframes nwscroll { to { transform: translateX(-100%); } }
  .nw-src-tbl td.nw-err { color: var(--neg); white-space: normal; text-align: left; }
  @media (max-width: 1100px) { .nw-main { grid-template-columns: 1fr; } .nw-right { max-height: 45vh; border-top: 1px solid var(--border-med); } }
  `;
  document.head.appendChild(s);
}

const p2 = n => String(n).padStart(2, "0");
const fmtDT = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
const ageOf = a => FE.ago(a.ts * 1000) || "now";
const sentHtml = a => a.sentiment === "bullish" ? `<span class="pos">▲</span>` : a.sentiment === "bearish" ? `<span class="neg">▼</span>` : `<span class="c-dim">–</span>`;
const tickHtml = (a, n = 3) => (a.tickers || []).slice(0, n).map(([s, l]) => `<span class="nw-tk" data-tk="${esc(s)}">$${esc(l)}</span>`).join(" ");

function filtered() {
  const s = st(), now = Date.now() / 1000, q = s.q.trim().toLowerCase();
  let list = s.view === "bookmarks" ? bm() : DATA.articles;
  return list.filter(a =>
    (s.view === "bookmarks" || now - a.ts <= +s.win * 3600) &&
    (s.cat === "ALL" || (a.cats || []).includes(s.cat)) &&
    (!s.src || a.source === s.src) && (!s.sent || a.sentiment === s.sent) &&
    (!s.imp || (s.imp === "HIGH" ? a.impact === "HIGH" : a.impact !== "LOW")) &&
    (!s.lang || a.lang === s.lang) &&
    (!q || (a.title + " " + a.summary + " " + a.source + " " + (a.tickers || []).map(t => t.join(" ")).join(" ")).toLowerCase().includes(q))
  ).sort((a, b) => b.ts - a.ts);
}

function render(el, arg) {
  css();
  const s = st();
  if (arg) {
    const A = arg.toUpperCase();
    if (CATS.some(c => c[0] === A)) { s.cat = A; s.view = "feed"; }
    else if (arg === "bookmarks") s.view = "bookmarks";
    else if (arg === "sources") s.view = "sources";
    else if (/^[0-9a-f]{12}$/.test(arg)) s.sel = arg;
    else s.q = arg;
  }
  el.innerHTML = `
  <div class="nw-cmd">
    <span class="nw-intel" data-tip="뉴스 인텔리전스: 국내외 40여 개 RSS 피드를 모아 분류·중복 제거합니다.">INTEL</span>
    <input class="inp" id="nwQ" placeholder="Search… 제목·요약·종목" style="width:170px" value="${esc(s.q)}">
    ${FE.pills("nwCat", CATS, s.cat)}
    ${FE.pills("nwWin", WINDOWS, s.win)}
    <select class="inp" id="nwSent" title="감성 필터"><option value="">감성 전체</option><option value="bullish">▲ 강세</option><option value="bearish">▼ 약세</option><option value="neutral">– 중립</option></select>
    <select class="inp" id="nwImp" title="영향도 필터"><option value="">영향 전체</option><option value="HIGH">HIGH만</option><option value="MED">MED 이상</option></select>
    <select class="inp" id="nwLang" title="언어"><option value="">국내+해외</option><option value="ko">국내(한글)</option><option value="en">해외(영문)</option></select>
    <select class="inp" id="nwSrc" style="max-width:150px"><option value="">모든 소스</option></select>
    ${FE.pills("nwView", [["feed", "피드"], ["bookmarks", "북마크"], ["sources", "소스 상태"]], s.view)}
    <button class="btn" style="margin-left:auto" id="nwRef" title="강제 새로고침 (60초에 한 번)">REFRESH</button>
  </div>
  <div class="nw-stats"><span id="nwStats"><span>FEEDS <b>…</b></span></span><div class="nw-cnt" id="nwCnt"></div></div>
  <div class="nw-main">
    <div class="nw-left"><div id="nwFlash"></div><div class="nw-list" id="nwList"><div class="loading">40여 개 RSS 피드를 병렬로 불러오는 중… (처음엔 10초 정도 걸려요)</div></div></div>
    <div class="nw-right" id="nwDet"></div>
  </div>
  <div class="nw-strip" id="nwStrip"></div>`;
  const $ = id => el.querySelector("#" + id);
  $("nwSent").value = s.sent; $("nwImp").value = s.imp; $("nwLang").value = s.lang;

  FE.onPills(el, "nwCat", v => { s.cat = v; FE.store.set("news.cat", v); draw(); });
  FE.onPills(el, "nwWin", v => { s.win = v; FE.store.set("news.win", v); draw(); });
  FE.onPills(el, "nwView", v => { s.view = v; draw(); });
  let t; $("nwQ").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { s.q = e.target.value; draw(); }, 150); });
  $("nwSent").onchange = e => { s.sent = e.target.value; draw(); };
  $("nwImp").onchange = e => { s.imp = e.target.value; draw(); };
  $("nwLang").onchange = e => { s.lang = e.target.value; FE.store.set("news.lang", s.lang); draw(); };
  $("nwSrc").onchange = e => { s.src = e.target.value; draw(); };
  $("nwRef").onclick = () => load(true);

  // delegated clicks: rows, tickers, related, strip, flash
  el.addEventListener("click", e => {
    const tk = e.target.closest("[data-tk]"); if (tk) { e.stopPropagation(); return FE.go("research", tk.dataset.tk); }
    const r = e.target.closest("[data-id]"); if (r) select(r.dataset.id, !r.classList.contains("nw-row"));
  });
  el.tabIndex = -1;
  el.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (!["ArrowDown", "ArrowUp", "j", "k"].includes(e.key)) return;
    e.preventDefault();
    const rows = [...el.querySelectorAll(".nw-row")]; const i = rows.findIndex(r => r.dataset.id === s.sel);
    const n = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" || e.key === "j" ? 1 : -1)))];
    if (n) { select(n.dataset.id); n.scrollIntoView({ block: "nearest" }); }
  });

  function find(id) { return DATA?.articles.find(a => a.id === id) || bm().find(a => a.id === id); }

  function select(id, scroll) {
    s.sel = id;
    el.querySelectorAll(".nw-row").forEach(r => r.classList.toggle("sel", r.dataset.id === id));
    if (scroll) el.querySelector(`.nw-row[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
    detail();
  }

  function related(a) {
    const kw = new Set(a.kw || []), tk = new Set((a.tickers || []).map(t => t[0]));
    return DATA.articles.filter(b => b.id !== a.id).map(b => {
      let sc = 0; (b.kw || []).forEach(k => kw.has(k) && sc++); (b.tickers || []).forEach(t => tk.has(t[0]) && (sc += 2));
      return [sc, b];
    }).filter(([sc]) => sc >= 2).sort((x, y) => y[0] - x[0] || y[1].ts - x[1].ts).slice(0, 10).map(x => x[1]);
  }

  function detail() {
    const a = s.sel && find(s.sel);
    const box = $("nwDet");
    if (!a) { box.innerHTML = `<div class="nw-dh">ARTICLE DETAIL</div><div class="empty">왼쪽 목록에서 기사를 선택하세요.<br><br><span class="c-dim">↑↓ 키로 이동할 수 있어요.</span></div>`; return; }
    const d = new Date(a.ts * 1000);
    const rel = DATA ? related(a) : [];
    const sentCls = a.sentiment === "bullish" ? "c-green" : a.sentiment === "bearish" ? "c-red" : "c-muted";
    const trUrl = `https://translate.google.com/translate?sl=auto&tl=ko&u=${encodeURIComponent(a.link)}`;
    box.innerHTML = `<div class="nw-dh">ARTICLE DETAIL<span class="c-dim" style="letter-spacing:0;font-weight:400">${esc(a.feed || "")}</span></div>
    <div class="nw-det">
      <h2>${esc(a.title)}</h2>
      <div class="nw-badges">
        ${a.breaking ? `<span class="badge fill-orange">BREAKING</span>` : ""}
        ${a.id === S?.flashId ? `<span class="badge fill-red">FLASH</span>` : ""}
        <span class="badge ${sentCls}">${a.sentiment.toUpperCase()} · ${SENT_KO[a.sentiment]}</span>
        <span class="badge nw-imp-${a.impact}" style="${a.impact === "LOW" ? "color:var(--text-3)" : ""}">${a.impact} IMPACT</span>
        ${(a.cats || []).map(c => `<span class="badge c-orange" title="${CAT_KO[c] || c}">${c}</span>`).join("")}
      </div>
      <div><span class="c-cyan" style="font-weight:700">${esc(a.source)}</span> <span class="c-dim">· ${ageOf(a)} 전 · ${fmtDT(d)}${a.dated === false ? " (발행시각 미제공)" : ""}</span>
        ${a.also?.length ? `<div class="note">같은 소식: ${a.also.map(esc).join(", ")} ${FE.term("n_dedupe", "(중복 제거)")}</div>` : ""}</div>
      <div class="nw-sum">${a.summary ? esc(a.summary) : `<span class="c-dim">요약이 제공되지 않은 기사입니다. OPEN으로 원문을 확인하세요.</span>`}</div>
      <div class="note">${FE.term("n_impact", "영향도")}: <span class="nw-imp-${a.impact}">${a.impact}</span> · ${FE.term("n_sent", "감성")}: <span class="${sentCls}">${SENT_KO[a.sentiment]}</span> (점수 ${a.score > 0 ? "+" : ""}${a.score})
        ${a.tickers?.length ? `<br>${FE.term("n_ticker", "관련 종목")}: ${tickHtml(a, 6)}` : ""}</div>
      <div class="nw-btns">
        <a class="btn" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">OPEN ↗</a>
        <button class="btn" id="nwCopy">COPY URL</button>
        <button class="btn ${isBm(a.id) ? "on" : ""}" id="nwBm">${isBm(a.id) ? "★ 북마크됨" : "☆ BOOKMARK"}</button>
        ${a.lang === "en" ? `<a class="btn muted" href="${esc(trUrl)}" target="_blank" rel="noopener noreferrer">번역해서 열기</a>` : ""}
        ${a.tickers?.length ? `<button class="btn muted" data-tk="${esc(a.tickers[0][0])}">종목 분석 ▸</button>` : ""}
        <button class="btn muted" id="nwSame">같은 소스 보기</button>
      </div>
      <div class="nw-rel-h">RELATED <span class="c-dim" style="font-weight:400;letter-spacing:0">· 키워드·종목이 겹치는 기사 ${rel.length}건</span></div>
      <div>${rel.length ? rel.map(b => `<div class="nw-rel" data-id="${b.id}"><b>${esc(b.source)}</b> - ${esc(b.title)} <span class="c-dim">${ageOf(b)}</span></div>`).join("") : `<div class="c-dim" style="padding:6px 0">관련 기사가 없습니다.</div>`}</div>
    </div>`;
    box.querySelector("#nwCopy").onclick = async () => {
      try { await navigator.clipboard.writeText(a.link); FE.toast("URL을 복사했습니다."); }
      catch { const i = document.createElement("textarea"); i.value = a.link; document.body.appendChild(i); i.select(); document.execCommand("copy"); i.remove(); FE.toast("URL을 복사했습니다."); }
    };
    box.querySelector("#nwBm").onclick = () => {
      let list = bm();
      if (isBm(a.id)) { list = list.filter(b => b.id !== a.id); FE.toast("북마크에서 뺐습니다."); }
      else { list.unshift({ ...a, saved: Date.now() }); list = list.slice(0, 300); FE.toast("북마크에 저장했습니다 (이 브라우저)."); }
      FE.store.set("news.bookmarks", list); detail(); if (s.view === "bookmarks") draw();
    };
    box.querySelector("#nwSame").onclick = () => { s.src = a.source; $("nwSrc").value = a.source; draw(); };
  }

  function drawSources() {
    const f = DATA.feeds;
    $("nwFlash").innerHTML = "";
    $("nwList").innerHTML = `<div style="padding:8px">${FE.table([
      { k: "name", l: "소스", a: "l", f: v => `<span class="c-cyan">${esc(v)}</span>` },
      { k: "id", l: "피드 ID", a: "l", f: v => `<span class="c-dim">${esc(v)}</span>` },
      { k: "cat", l: "분류", a: "c" },
      { k: "lang", l: "언어", a: "c", f: v => v === "ko" ? "한글" : "영문" },
      { k: "ok", l: "상태", a: "c", f: v => v ? `<span class="pos">● OK</span>` : `<span class="neg">● FAIL</span>` },
      { k: "count", l: "기사", f: v => FE.int(v) },
      { k: "ms", l: "응답", f: v => (v / 1000).toFixed(1) + "s" },
      { k: "error", l: "오류", a: "l", c: () => "nw-err", f: v => esc(v || "") },
    ], f, { cls: "nw-src-tbl" })}
    <div class="note" style="margin-top:8px">피드 목록은 데스크톱 앱(NewsService_Feeds.cpp)의 기본 피드 + 키 없이 쓸 수 있는 국내 언론 RSS입니다. 각 피드는 9초 제한·3MB 상한으로 병렬 수집하고, DOCTYPE/ENTITY가 들어간 XML은 보안상 거부합니다.</div></div>`;
  }

  function draw() {
    if (!DATA) return;
    el.querySelectorAll('[data-pills="nwView"] .pill').forEach(p => p.classList.toggle("on", p.dataset.v === s.view));
    const all = DATA.articles, now = Date.now() / 1000;
    const lastSeen = FE.store.get("news.lastSeen", 0);
    // counters
    const inWin = all.filter(a => now - a.ts <= +s.win * 3600);
    const alerts = inWin.filter(a => a.impact === "HIGH").length;
    const fresh = all.filter(a => a.ts > lastSeen && a.dated !== false).length;
    const okF = DATA.feeds.filter(f => f.ok).length;
    $("nwCnt").innerHTML = `<span class="c-orange" data-tip="지난 방문 이후 새로 들어온 기사">${fresh} NEW</span>
      <span class="c-red" data-tip="선택한 시간 범위의 영향도 HIGH 기사">${alerts} ALERTS</span>
      <span class="c-white">${all.length}</span><span class="c-dim">${okF}/${DATA.feeds.length}</span>`;
    // source dropdown
    const srcs = [...new Set(all.map(a => a.source))].sort();
    const sel = $("nwSrc"); if (sel.options.length !== srcs.length + 1) sel.innerHTML = `<option value="">모든 소스 (${srcs.length})</option>` + srcs.map(x => `<option>${esc(x)}</option>`).join("");
    sel.value = s.src;
    if (s.view === "sources") { stats([]); return drawSources(); }
    const list = filtered();
    stats(list);
    // flash
    // FLASH = newest high-impact item (last 6h) in the current filter, else the global one
    const fl = s.view === "bookmarks" ? null : list.find(a => a.impact === "HIGH" && now - a.ts < 6 * 3600 && a.dated !== false) || (DATA.flash && all.find(a => a.id === DATA.flash));
    s.flashId = fl?.id;
    $("nwFlash").innerHTML = fl ? `<div class="nw-flash" data-id="${fl.id}" title="${esc(fl.title)}"><span class="tag">${FE.term("n_flash", "FLASH")}</span><span class="h">${esc(fl.title)}</span><span class="s">${esc(fl.source)} · ${ageOf(fl)}</span></div>` : "";
    // rows
    $("nwList").innerHTML = list.length ? list.slice(0, 600).map(a => `<div class="nw-row i-${a.impact} ${a.id === s.sel ? "sel" : ""}" data-id="${a.id}">
        <span class="age">${a.dated === false ? "~" : ""}${ageOf(a)}</span><span class="dot ${a.ts > lastSeen && a.dated !== false ? "new" : ""}">●</span>
        <span class="src" title="${esc(a.source)}">${esc(a.source)}</span>
        <span class="hl" title="${esc(a.title)}">${esc(a.title)}${a.dups ? `<span class="dup">+${a.dups}</span>` : ""}</span>
        <span class="meta">${a.impact !== "LOW" ? `<span class="nw-imp-${a.impact}">${a.impact}</span>` : ""}${sentHtml(a)}${tickHtml(a)}</span></div>`).join("")
      + (list.length > 600 ? `<div class="empty">상위 600건만 표시합니다. 필터를 좁혀 보세요. (전체 ${list.length}건)</div>` : "")
      : `<div class="empty">${s.view === "bookmarks" ? "저장한 북마크가 없습니다. 기사를 열고 ☆ BOOKMARK를 누르세요." : "조건에 맞는 기사가 없습니다. 시간 범위를 늘리거나 필터를 풀어 보세요."}</div>`;
    if (!s.sel || !find(s.sel) || (s.view === "bookmarks" && list.length && !list.some(a => a.id === s.sel))) s.sel = (fl || list[0])?.id;
    el.querySelectorAll(".nw-row").forEach(r => r.classList.toggle("sel", r.dataset.id === s.sel));
    detail();
  }

  function stats(list) {
    const n = list.length || 1;
    const bull = list.filter(a => a.sentiment === "bullish").length, bear = list.filter(a => a.sentiment === "bearish").length;
    const net = (bull - bear) / n;
    const okF = DATA.feeds.filter(f => f.ok).length, bad = DATA.feeds.length - okF;
    const srcs = new Set(list.map(a => a.source)).size;
    const age = Math.round((Date.now() / 1000 - DATA.fetched_at) / 60);
    $("nwStats").innerHTML = `<span>FEEDS<b>${okF}</b>${bad ? `<b class="c-red">✕${bad}</b>` : ""}</span><span>ARTS<b>${list.length}</b></span>
      <span>SRCS<b>${srcs}</b></span><span>HIGH<b class="c-red">${list.filter(a => a.impact === "HIGH").length}</b></span>
      <span>${FE.term("n_sent", "SENT")}<span class="nw-sbar"><i style="width:${bull / n * 100}%;background:var(--pos)"></i><i style="width:${(n - bull - bear) / n * 100}%;background:#444"></i><i style="width:${bear / n * 100}%;background:var(--neg)"></i></span><span class="${FE.cls(net)}">${net >= 0 ? "+" : ""}${net.toFixed(2)}</span> <span class="c-dim">(▲${bull} ▼${bear})</span></span>
      <span>${CAT_KO[s.cat]} · ${WINDOWS.find(w => w[0] === s.win)[1]}</span>
      <span>수집 <b>${age <= 0 ? "방금" : age + "분 전"}</b> · 5분마다 자동 갱신${DATA.refreshing ? " · <span class='c-orange'>갱신 중…</span>" : ""}</span>`;
  }

  function strip() {
    const top = DATA.articles.slice(0, 40);
    const html = top.map(a => `<span data-id="${a.id}">${a.breaking ? `<b class="c-orange">BREAKING</b> ` : a.impact === "HIGH" ? `<b class="c-red">FLASH</b> ` : ""}<span class="c-cyan">${esc(a.source)}</span> <span class="c-white">${esc(a.title)}</span></span>`).join("");
    $("nwStrip").innerHTML = `<div class="track">${html}</div>`;
  }

  async function load(force) {
    try {
      if (force) $("nwRef").disabled = true;
      const prevSel = s.sel;
      DATA = await FE.api("/api/news/feed" + (force ? "?refresh=1" : ""));
      s.sel = prevSel;
      draw(); strip();
      FE.status(`뉴스 ${DATA.articles.length}건 · 피드 ${DATA.feeds.filter(f => f.ok).length}/${DATA.feeds.length}`);
      // mark visit after a short delay so "NEW" dots are visible this time
      clearTimeout(load._t); load._t = setTimeout(() => FE.store.set("news.lastSeen", Math.floor(Date.now() / 1000)), 20000);
    } catch (e) { if (!DATA) FE.error($("nwList"), e); else FE.toast("새로고침 실패: " + e.message, true); }
    finally { const b = $("nwRef"); if (b) b.disabled = false; }
  }
  if (DATA) { draw(); strip(); }
  load(false);
  FE.every(5 * 60 * 1000, () => load(false));
  FE.every(30 * 1000, () => DATA && s.view !== "sources" && stats(filtered()));
}

FE.screen({ id: "news", label: "뉴스", primary: true, order: 3, fkey: "F3", group: "핵심",
  desc: "40여 개 국내외 RSS 뉴스 모음 · 감성/영향도 분류 · 북마크", render });
FE.command("/news", "뉴스 검색 (예: /news 반도체)", a => FE.go("news", a || undefined));
})();
