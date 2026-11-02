(()=>{
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
$('[data-open-evidence]')?.addEventListener('click',()=>$('#approved-evidence').showModal());
$('[data-close-evidence]')?.addEventListener('click',()=>$('#approved-evidence').close());
$$('.acc__head').forEach(b=>b.addEventListener('click',()=>{const on=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(on));b.closest('.acc__item').classList.toggle('is-open',on)}));
const steps=$$('.approved-journey [data-journey]'),panels=$$('.approved-journey .journey-detail');
steps.forEach((b,i)=>b.addEventListener('click',()=>{steps.forEach((x,j)=>{x.classList.toggle('is-active',j===i);x.setAttribute('aria-pressed',String(j===i));x.style.setProperty('--offset',j-i)});panels.forEach((x,j)=>x.hidden=j!==i)}));
// The embedded comparison is static; full-page Company keeps its original script.
if(window!==parent){const send=()=>parent.postMessage({type:'section-height',height:document.documentElement.scrollHeight},location.origin);new ResizeObserver(send).observe(document.body);addEventListener('load',send)}

// Draft 2 original scroll-linked background and staggered text reveal.
  const darkens = $$("[data-darken]");
  if (darkens.length) {
    const DARK_FROM = 0.95, DARK_TO = 0.35;   // 섹션 윗변이 화면 높이의 95% → 35% 지점에 올 때까지
    const paint = () => darkens.forEach((el) => {
      const t = el.getBoundingClientRect().top / innerHeight;
      const k = Math.min(1, Math.max(0, (DARK_FROM - t) / (DARK_FROM - DARK_TO)));
      el.style.setProperty("--dk", k.toFixed(3));
      if (t < 0.85) el.classList.add("is-show");            // 섹션이 화면에 보이기 시작하면 바로 등장
      else if (t >= 1) el.classList.remove("is-show");      // 화면 밖으로 완전히 내려가면 처음 상태로
    });
    window.addEventListener("scroll", paint, { passive: true });
    window.addEventListener("resize", paint);
    paint();
  }
// Use the content viewport so the scrollbar never steals the right gutter.
const measurePage=()=>{
 const width=`${document.documentElement.clientWidth}px`;
 document.body.style.setProperty('--page-screen',width);
 document.body.style.setProperty('--subpage-screen',width);
};
measurePage();addEventListener('resize',measurePage);
// Original draft 2 rise-in effect for body content.
if(document.body.matches('.approved-culture,.approved-recruit')){
 const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-in');observer.unobserve(e.target)}}),{threshold:.15});
 document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
}

const talentList=document.querySelector('.talent-list');
if(talentList){
 const items=[...talentList.querySelectorAll('.talent-item')];
 let active=null;
 const select=item=>{
  active=item;
  items.forEach(row=>{
   const open=row===item,detail=row.querySelector('.talent-detail');
   row.classList.toggle('is-expanded',open);
   row.querySelector('.talent-toggle').setAttribute('aria-expanded',String(open));
   detail.setAttribute('aria-hidden',String(!open));detail.inert=!open;
  });
 };
 select(null);talentList.classList.add('is-enhanced');
 const pop=item=>{const symbol=item?.querySelector('.talent-symbol');if(!symbol)return;symbol.classList.remove('is-popping');void symbol.offsetWidth;symbol.classList.add('is-popping');};
 items.forEach(item=>{
  const button=item.querySelector('.talent-toggle');
  button.addEventListener('click',()=>select(active===item?null:item));
  button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))select(item);});
  button.addEventListener('keydown',event=>{if(event.key==='Escape')select(null);});
 });
 // (preview) scroll-driven opening replaced by preview-talent-scroll script

}

const journey=document.querySelector('.journey-scroll');
if(journey){
 const choices=[...journey.querySelectorAll('[data-journey]')];
 const panels=[...journey.querySelectorAll('.journey-detail')];
 const measureJourneyDetails=()=>{
  document.body.style.setProperty("--journey-screen",`${document.documentElement.clientWidth}px`);
  panels.forEach(panel=>panel.classList.add('is-measuring'));
  const height=Math.max(...panels.map(panel=>panel.getBoundingClientRect().height));
  journey.style.setProperty('--journey-detail-height',`${Math.ceil(height)}px`);
  panels.forEach(panel=>panel.classList.remove('is-measuring'));
 };
 measureJourneyDetails();
 document.fonts.ready.then(measureJourneyDetails);
 addEventListener('resize',measureJourneyDetails);
 let active=0,manual=false;
 const selectStage=index=>{
  active=Math.max(0,Math.min(choices.length-1,index));
  choices.forEach((button,i)=>{button.style.setProperty('--offset',i-active);button.style.setProperty('--stage-opacity',[1,.3,.18,.1,.07][Math.abs(i-active)]);button.classList.toggle('is-active',i===active);button.setAttribute('aria-pressed',String(i===active));panels[i].hidden=i!==active;});
 };
 choices.forEach((button,i)=>{
  button.addEventListener('click',()=>{manual=true;selectStage(i);});
  button.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();manual=true;selectStage(event.key==='Home'?0:event.key==='End'?4:active+(event.key==='ArrowDown'?1:-1));choices[active].focus({preventScroll:true});}});
 });
 let scheduled=false;
 const updateJourney=()=>{scheduled=false;if(innerWidth<=1000||innerHeight<=700||manual)return;const box=journey.getBoundingClientRect();const sticky=journey.querySelector('.journey-frame');const inset=parseFloat(getComputedStyle(sticky).top)||0;const travel=journey.offsetHeight-sticky.offsetHeight;if(travel>0)selectStage(Math.round(Math.max(0,Math.min(1,(inset-box.top)/travel))*4));};
 addEventListener('scroll',()=>{manual=false;if(!scheduled){scheduled=true;requestAnimationFrame(updateJourney);}},{passive:true});
 addEventListener('resize',updateJourney);updateJourney();
}


})();

// Start each growth card's motion once it has risen into its resting spot, not while it is still sliding in.
const proofCards=[...document.querySelectorAll('.growth-cascade-card')];
const checkProofCards=()=>{
 proofCards.forEach(card=>{
  if(card.classList.contains('is-observed'))return;
  const box=card.getBoundingClientRect(),pin=parseFloat(getComputedStyle(card).top);
  const rest=Number.isNaN(pin)?innerHeight*.5:pin+box.height*.12;
  if(box.top<=rest||box.bottom<=innerHeight)card.classList.add('is-observed');
 });
 if(proofCards.every(card=>card.classList.contains('is-observed')))removeEventListener('scroll',checkProofCards);
};
addEventListener('scroll',checkProofCards,{passive:true});addEventListener('resize',checkProofCards);checkProofCards();

// Crisp vector globe: each land dot fades in one at a time, in random order.
document.querySelectorAll('img.growth-globe').forEach(img=>{
 fetch(img.src.replace(/\.png($|\?)/,'.svg$1')).then(r=>r.ok?r.text():Promise.reject()).then(text=>{
  const svg=new DOMParser().parseFromString(text,'image/svg+xml').documentElement;
  svg.setAttribute('class','growth-globe');svg.setAttribute('aria-hidden','true');
  const dots=[...svg.querySelectorAll('ellipse')];
  dots.map(dot=>[Math.random(),dot]).sort((a,b)=>a[0]-b[0]).forEach(([,dot],i)=>dot.style.setProperty('--dot-delay',`${(.15+i*1.8/dots.length).toFixed(3)}s`));
  img.replaceWith(document.importNode(svg,true));
 }).catch(()=>{});
});

document.querySelectorAll('.talent-symbol').forEach(symbol=>symbol.addEventListener('animationend',()=>symbol.classList.remove('is-popping'),true));

// 10/19: retail photos page sideways with the arrow buttons (replaces the old auto crossfade).
document.querySelectorAll('.retail-carousel').forEach(carousel=>{
 const track=carousel.querySelector('.retail-collection__photos');
 const prev=carousel.querySelector('.retail-carousel__btn--prev'),next=carousel.querySelector('.retail-carousel__btn--next');
 const stepSize=()=>{const f=track.querySelector('figure');return f?f.getBoundingClientRect().width+parseFloat(getComputedStyle(track).columnGap||0):track.clientWidth};
 const update=()=>{const max=track.scrollWidth-track.clientWidth-2;prev.disabled=track.scrollLeft<=2;next.disabled=track.scrollLeft>=max;};
 const go=dir=>{const step=stepSize();track.scrollTo({left:(Math.round(track.scrollLeft/step)+dir)*step,behavior:'smooth'})};
 prev.addEventListener('click',()=>go(-1));
 next.addEventListener('click',()=>go(1));
 track.addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();
});
