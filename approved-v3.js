// 3차 수정 (10/29, Figma 리뷰 코멘트 반영) — 페이지 공통 보조 스크립트.
(()=>{
 // 고정 줄바꿈 블록: 줄이 컨테이너보다 길면 글자 크기를 살짝 줄여 한 줄을 유지한다 (일하는 방식 카드 등 nowrap 블록만).
 let fitting=false;
 const fit=()=>{
  if(fitting)return;fitting=true;
  try{
   document.querySelectorAll('.cx-fixed').forEach(p=>{
    if(p.closest('.cx-card__more')){p.style.removeProperty('--fx-scale');return;} // 3차: 카드 본문은 자연 줄바꿈(고정 줄 아님)
    const lines=[...p.querySelectorAll('.fx-line')];if(!lines.length)return;
    const prev=p.style.getPropertyValue('--fx-scale');
    // 스케일을 1로 되돌린 자연 폭으로 측정 (역산하면 반올림 오차가 누적돼 점점 작아짐)
    p.style.setProperty('--fx-scale','1');
    const avail=p.clientWidth;const widest=Math.max(...lines.map(l=>l.scrollWidth));
    const next=avail&&widest>avail?Math.max(.6,avail/widest*.995).toFixed(3):'';
    if(next)p.style.setProperty('--fx-scale',next);else p.style.removeProperty('--fx-scale');
   });
  }finally{fitting=false;}
 };
 addEventListener('resize',fit);document.fonts?.ready.then(fit);fit();
 // 카드가 펼쳐질 때(높이 전환) 다시 측정 — 자기 자신(.cx-fixed style)이 일으킨 변경은 무시
 new MutationObserver(recs=>{if(recs.some(r=>!(r.attributeName==='style'&&r.target.classList?.contains('cx-fixed'))))fit();}).observe(document.body,{attributes:true,subtree:true,attributeFilter:['class','style']});
})();

// 모바일 헤더: 햄버거 버튼으로 메뉴 열고 닫기 (애니메이션 없음). 데스크톱에서는 CSS로 버튼을 숨긴다.
(()=>{
 const header=document.querySelector('.approved-header'),nav=header?.querySelector('nav');
 if(!header||!nav||header.querySelector('.approved-menu-toggle'))return;
 nav.id=nav.id||'approved-nav';
 const btn=document.createElement('button');
 btn.type='button';btn.className='approved-menu-toggle';btn.setAttribute('aria-controls',nav.id);btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-label','메뉴 열기');
 btn.innerHTML='<span class="approved-menu-toggle__bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="approved-menu-toggle__close" aria-hidden="true">✕</span>';
 header.append(btn);
 const set=open=>{header.classList.toggle('is-menu-open',open);document.documentElement.classList.toggle('approved-menu-open',open);btn.setAttribute('aria-expanded',String(open));btn.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');};
 btn.addEventListener('click',()=>set(!header.classList.contains('is-menu-open')));
 nav.addEventListener('click',e=>{if(e.target.closest('a'))set(false);});
 addEventListener('keydown',e=>{if(e.key==='Escape')set(false);});
 addEventListener('resize',()=>{if(innerWidth>700)set(false);});
})();

// 컬처 모핑 액터: 폰트 로드/레이아웃 안정 후 슬롯 좌표를 다시 재되, 캐시가 어긋나 글자가 겹치지 않게 한다.
(()=>{if(!document.querySelector('[data-actor]'))return;const kick=()=>dispatchEvent(new Event('resize'));document.fonts?.ready.then(()=>setTimeout(kick,50));addEventListener('load',()=>setTimeout(kick,300));})();

// QA: 로고 링크 접근성 이름, '#' 자리표시 링크는 클릭 시 상단 점프 방지
(()=>{document.querySelectorAll('a.approved-logo:not([aria-label])').forEach(a=>a.setAttribute('aria-label','유어유니콘 홈'));
document.querySelectorAll('a.ext[href="#"]').forEach(a=>{a.setAttribute('aria-disabled','true');a.addEventListener('click',e=>e.preventDefault());});})();

// QA: 뷰포트 폭 변수(--page-screen/--subpage-screen)가 resize 이벤트를 놓치는 환경(기기 회전·에뮬레이션)에서도 갱신되도록 ResizeObserver로 보강
(()=>{const apply=()=>{const w=document.documentElement.clientWidth+'px';document.body.style.setProperty('--page-screen',w);document.body.style.setProperty('--subpage-screen',w);};new ResizeObserver(apply).observe(document.documentElement);addEventListener('orientationchange',()=>setTimeout(apply,100));})();


// Retail image captions: hover on desktop; click/tap or keyboard to toggle. (3차: 모든 기기에서 평소엔 숨김, 올리거나 누르면 표시)
(() => {
  const figs = [...document.querySelectorAll('.retail-collection__photos figure')];
  const label = (f, open) => f.setAttribute('aria-label', `${open ? '사진 설명 숨기기' : '사진 설명 보기'}: ${f.querySelector('img')?.alt || ''}`);
  figs.forEach(f => { f.setAttribute('role', 'button'); f.tabIndex = 0; f.setAttribute('aria-expanded', 'false'); label(f, false); });
  const setOpen = (f, open) => { f.classList.toggle('is-caption-open', open); f.setAttribute('aria-expanded', String(open)); label(f, open); };
  document.addEventListener('click', event => {
    const figure = event.target.closest('.retail-collection__photos figure');
    figs.forEach(f => { if (f !== figure && f.classList.contains('is-caption-open')) setOpen(f, false); });
    if (!figure) return;
    setOpen(figure, !figure.classList.contains('is-caption-open'));
  });
  document.addEventListener('keydown', event => {
    const figure = event.target.closest?.('.retail-collection__photos figure');
    if (!figure || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    figure.click();
  });
})();

// 모바일 Culture: 설명 카드는 읽기 흐름 안에서 스크롤 진입 시 부드럽게 펼친다.
(()=>{
 const init=()=>{
  const cards=[...document.querySelectorAll('body.approved-culture .cx-scroll:not(.cx-scroll--who) .cx-card')];
  if(!cards.length||!('IntersectionObserver' in window))return;
  const mobile=matchMedia('(max-width:700px)');
  let observer=null;
  const observe=()=>{
   observer?.disconnect();observer=null;
   if(!mobile.matches)return;
   observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    entry.target.classList.add('is-mobile-expanded');observer.unobserve(entry.target);
   }),{rootMargin:'0px 0px -120px 0px',threshold:0});
   cards.forEach(card=>{if(!card.classList.contains('is-mobile-expanded'))observer.observe(card);});
  };
  observe();
  if(mobile.addEventListener)mobile.addEventListener('change',observe);else mobile.addListener(observe);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

// 리크루트(모바일) 입사 축하금 띠: 원래 자리가 화면 아래에 있으면 화면 하단에 붙어 보이고, 스크롤해서 자리에 닿으면 그 자리에 안착
(()=>{
 const band=document.querySelector('body.approved-recruit #bonus');
 if(!band)return;
 const mq=matchMedia('(max-width:700px)');
 const slot=document.createElement('div');slot.className='art-bonus-slot';slot.setAttribute('aria-hidden','true');band.before(slot);
 const head=band.querySelector('.art-bonus__head');
 let ticking=false;
 const update=()=>{
  ticking=false;
  if(!mq.matches){band.classList.remove('is-floating');slot.style.height='';return;}
  const h=head.offsetHeight;
  const floating=band.classList.contains('is-floating');
  const top=(floating?slot:band).getBoundingClientRect().top;
  const next=top+h>innerHeight;
  if(next!==floating)band.classList.toggle('is-floating',next);
  slot.style.height=next?h+'px':'';
 };
 const req=()=>{if(!ticking){ticking=true;requestAnimationFrame(update);}};
 addEventListener('scroll',req,{passive:true});addEventListener('resize',req);mq.addEventListener?.('change',req);
 document.fonts?.ready.then(req);update();
})();
