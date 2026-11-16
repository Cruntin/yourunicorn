// 언어 선택(PC 헤더): 바깥을 누르거나 Esc 를 누르면 닫힘
(() => {
  const picks = [...document.querySelectorAll('.approved-lang--pick')];
  if (!picks.length) return;
  document.addEventListener('click', e => picks.forEach(d => { if (d.open && !d.contains(e.target)) d.open = false; }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') picks.forEach(d => { if (d.open) { d.open = false; d.querySelector('summary').focus(); } }); });
})();

// EN·JP 페이지: 사이트 스크립트가 넣는 화면 낭독기용 한국어 문구(메뉴 열기, 사진 설명 보기 등)를 그 언어로 바꿈.
// 사이트 스크립트(approved-source.js, approved-v3.js)는 한국어 페이지와 같이 쓰므로 고치지 않고 여기서 바꾼다.
(() => {
  const lang = document.documentElement.lang;
  const L = lang.startsWith('ja') ? 1 : lang.startsWith('en') ? 0 : -1;
  if (L < 0) return;
  const RULES = [
    [/^메뉴 열기$/, ['Open menu', 'メニューを開く']],
    [/^메뉴 닫기$/, ['Close menu', 'メニューを閉じる']],
    [/^사진 설명 보기: ([\s\S]*)$/, ['Show photo caption: $1', '写真の説明を表示: $1']],
    [/^사진 설명 숨기기: ([\s\S]*)$/, ['Hide photo caption: $1', '写真の説明を隠す: $1']],
    [/^유어유니콘 홈$/, ['YOUR UNICORN home', 'YOUR UNICORN ホーム']],
    [/^브랜드 예시 배경 영상$/, ['Brand background video', 'ブランドの背景映像']],
    [/^제품 자동 흐름 일시정지$/, ['Pause product carousel', '製品の自動スクロールを一時停止']],
    [/^제품 자동 흐름 재생$/, ['Play product carousel', '製品の自動スクロールを再生']],
    [/^(\d+)개 중 (\d+)번째 카드부터 표시$/, ['Showing from card $2 of $1', '全$1枚中$2枚目から表示']],
    [/^유니콘 도장 찍기, (\d+)개 찍힘$/, ['Stamp a unicorn, $1 stamped', 'ユニコーンスタンプを押す（$1個）']],
    [/^유니콘 도장 (\d+)개$/, ['$1 unicorn stamps', 'ユニコーンスタンプ $1個']],
  ];
  const tr = v => { for (const [re, out] of RULES) if (re.test(v)) return v.replace(re, out[L]); return null; };
  const ATTRS = ['aria-label', 'title'];
  const fixEl = el => { for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && /[가-힣]/.test(v)) { const t = tr(v); if (t !== null) el.setAttribute(a, t); } } };
  const fixText = el => { const v = el.textContent; if (v && /[가-힣]/.test(v)) { const t = tr(v.trim()); if (t !== null) el.textContent = t; } };
  const STATUS = '#growth-tags-status, .unicorn-fill-status';
  const all = root => { if (root.nodeType !== 1) return; fixEl(root); root.querySelectorAll('[aria-label], [title]').forEach(fixEl); if (root.matches(STATUS)) fixText(root); root.querySelectorAll(STATUS).forEach(fixText); };
  all(document.documentElement);
  new MutationObserver(ms => ms.forEach(m => {
    if (m.type === 'attributes') fixEl(m.target);
    else { m.addedNodes.forEach(all); const el = m.target.nodeType === 1 ? m.target : m.target.parentElement; if (el && el.closest && el.closest(STATUS)) fixText(el.closest(STATUS)); }
  })).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
})();
