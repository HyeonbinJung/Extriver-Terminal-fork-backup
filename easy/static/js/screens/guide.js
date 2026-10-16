/* GUIDE — 기능 안내: every desktop-app screen explained in Korean (features.json) */
(() => {
let DATA = null;

FE.screen({
  id: "guide", label: "기능 안내", group: "도움말", order: 90, desc: "Fincept Terminal 데스크톱 앱 전체 기능 한국어 안내",
  async render(el) {
    el.innerHTML = FE.screenHead("FEATURE GUIDE", "데스크톱 앱(C++ · Qt6)의 화면을 한국어로 정리했습니다",
      `<input class="inp" id="gQ" placeholder="기능 검색 (예: 백테스트, 뉴스)" style="width:260px">`) +
      `<div class="note" style="padding:0 4px">「<span class="c-green">▶ 바로 열기</span>」가 있는 항목은 이 웹 터미널에서 바로 써볼 수 있어요. 명령줄(상단 <b>&gt; Enter Command</b>)에 종목 코드를 치면 종목 리서치가 열립니다 · 단축키: F1~F10 화면 이동, Ctrl+K 명령줄.</div>
       <div id="gOut"><div class="loading">불러오는 중…</div></div>`;
    try { DATA ??= await FE.api("/api/features"); } catch (e) { return FE.error(el.querySelector("#gOut"), e); }
    const draw = () => {
      const q = el.querySelector("#gQ").value.trim().toLowerCase();
      const list = DATA.filter(f => !q || JSON.stringify(f).toLowerCase().includes(q));
      const cats = [];
      list.forEach(f => { let c = cats.find(x => x.n === f.category); if (!c) cats.push(c = { n: f.category, items: [] }); c.items.push(f); });
      el.querySelector("#gOut").innerHTML = list.length ? cats.map(c => `
        <div class="screen-sub" style="margin:10px 4px 6px;color:var(--accent);font-weight:700;letter-spacing:1px">▌ ${FE.esc(c.n)} · ${c.items.length}</div>
        <div class="grid cols-auto">${c.items.map(f => {
          const scr = f.easy_tab && FE.screens.find(s => s.id === f.easy_tab);
          return FE.panel({ title: FE.esc(f.name_ko), sub: FE.esc(f.name), color: "cyan",
            acts: scr ? `<button class="btn" data-go="${scr.id}">▶ 바로 열기</button>` : "",
            body: `<div style="margin-bottom:6px">${FE.esc(f.summary)}</div>
              <div class="note">${(f.features || []).map(x => "· " + FE.esc(x)).join("<br>")}</div>
              <div style="margin-top:6px;font-size:12px"><span class="c-dim">필요한 것 ▸</span> <span class="${/없음/.test(f.needs) && !/키|계좌|로그인/.test(f.needs) ? "c-green" : "c-yellow"}">${FE.esc(f.needs)}</span></div>` });
        }).join("")}</div>`).join("") : `<div class="empty">검색 결과가 없습니다.</div>`;
    };
    el.querySelector("#gQ").addEventListener("input", draw);
    draw();
  },
});
})();
