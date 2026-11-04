// 모바일: 스크롤 중 주소창이 접히고 펴지며 innerHeight 가 바뀌면 카드·문구 위치가 다시 계산돼 떨리므로,
// 움직임 계산에는 CSS 와 같은 고정 높이(100svh)를 쓴다.
const vhProbe=document.createElement('div');vhProbe.setAttribute('aria-hidden','true');
vhProbe.style.cssText='position:fixed;top:0;left:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
document.documentElement.append(vhProbe);
let vhCache=vhProbe.offsetHeight||window.innerHeight;
addEventListener('resize',()=>{vhCache=vhProbe.offsetHeight||window.innerHeight;}); // 100svh 는 주소창이 움직여도 그대로라 폰에선 값이 변하지 않음
const stableVH=()=>vhCache;
// 모바일 터치: 고정 장면 구간에서는 스와이프 1회에 정지점 하나씩 이동한다(관성 한 번에 메시지·카드 여러 장이 지나가지 않게).
// 각 구간은 register(getStops)로 문서 기준 scrollY 정지점 목록을 넘긴다. 첫 정지점 위·마지막 정지점 아래로는 네이티브 스크롤로 빠져나간다.
// 이동은 거리와 무관하게 같은 길이의 감속 트윈이라, 카드 간격이 좁은 구간과 넓은 구간이 같은 박자로 한 장씩 들어온다.
// 세게·길게 스와이프하면 손을 뗄 때의 속도만큼 여러 칸을 가되, 칸마다 HOLD 동안 멈춰 보여주고 다음 칸으로 넘어간다.
const stepScroll=(()=>{
  const mq=matchMedia('(max-width:767px) and (hover:none) and (pointer:coarse)');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const root=document.documentElement;
  const sources=[];
  const DURATION=900,CHAIN=700,HOLD=380,SETTLE=420,THRESHOLD=24,MAX_STEPS=4;
  let cache=null,tween=null,queue={dir:0,count:0},hold=0,touch=null,idle=0;
  const clearChain=()=>{queue={dir:0,count:0};clearTimeout(hold);hold=0;};
  // 손을 떼기 직전 속도(px/ms)로 이동할 칸 수를 정한다: 천천히 1칸, 빠를수록 최대 MAX_STEPS칸.
  const stepsFor=speed=>Math.max(1,Math.min(MAX_STEPS,1+Math.floor((speed-.6)/.7)));
  const enqueue=(dir,count)=>{if(count>=1){if(queue.dir!==dir)queue={dir,count:0};queue.count=Math.min(MAX_STEPS,queue.count+count);}pump();};
  // 이동이 끝나 있으면 HOLD 만큼 보여준 뒤 예약된 다음 칸으로 간다.
  const pump=()=>{
    if(tween||hold||!queue.count||touch)return;
    const dir=queue.dir;queue.count--;if(!queue.count)queue.dir=0;
    hold=setTimeout(()=>{hold=0;step(dir,CHAIN,true);},HOLD);
  };
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const enabled=()=>mq.matches&&!reduce.matches&&!document.querySelector('.site-header.menu-open');
  const stops=()=>cache||=sources.flatMap(get=>get()).filter(Number.isFinite).map(Math.round).sort((a,b)=>a-b);
  const invalidate=()=>{cache=null;sync();};
  // 정지점 사이에 있을 때는 세로 네이티브 스크롤을 꺼 둔다(touch-action 은 터치 시작 시점에 적용되므로 미리 걸어 둔다).
  // 경계 정지점에서는 풀어 두고, 안쪽 방향 스와이프만 touchmove preventDefault 로 가로챈다.
  const sync=()=>{
    const list=enabled()?stops():[];
    const inside=list.length>1&&(tween||(scrollY>list[0]+1&&scrollY<list.at(-1)-1));
    root.style.touchAction=inside?'pan-x pinch-zoom':'';
  };
  const go=(index,duration)=>{
    const list=stops(),to=list[index],from=scrollY;
    cancelAnimationFrame(tween?.raf||0);
    if(to===undefined||Math.abs(to-from)<1){tween=null;sync();return;}
    tween={index,from,to,start:performance.now(),duration,raf:0};
    const tick=now=>{
      if(!tween)return;
      const t=Math.max(0,Math.min(1,(now-tween.start)/tween.duration));
      scrollTo({top:tween.from+(tween.to-tween.from)*ease(t),behavior:'instant'});
      if(t<1){tween.raf=requestAnimationFrame(tick);return;}
      tween=null;sync();
      pump();
    };
    sync();tween.raf=requestAnimationFrame(tick);
  };
  // 진행 중인 이동과 같은 방향이면 다음 칸으로 예약하고, 반대 방향이면 남은 예약을 버리고 지금 위치에서 바로 되돌아간다.
  const step=(dir,duration=DURATION,chained=false)=>{
    if(tween&&Math.sign(tween.to-tween.from)===dir){enqueue(dir,1);return;}
    if(!chained)clearChain();
    const list=stops(),y=scrollY;
    const index=dir>0?list.findIndex(v=>v>y+2):list.findLastIndex(v=>v<y-2);
    if(index>=0)go(index,duration);else clearChain();
  };
  const nearest=()=>{const list=stops(),y=scrollY;let best=-1;list.forEach((v,i)=>{if(best<0||Math.abs(v-y)<Math.abs(list[best]-y))best=i;});return best;};
  // 관성으로 구간 안에 들어와 멈추면 가장 가까운 정지점으로 짧게 맞춘다.
  const settle=()=>{
    if(touch||tween||!enabled())return;
    const list=stops();
    if(list.length<2||scrollY<=list[0]+1||scrollY>=list.at(-1)-1)return;
    const index=nearest();if(Math.abs(list[index]-scrollY)>1)go(index,SETTLE);
  };
  const scheduleSettle=()=>{clearTimeout(idle);idle=setTimeout(settle,140);};
  addEventListener('scroll',()=>{if(!tween){sync();if(!touch)scheduleSettle();}},{passive:true});
  addEventListener('scrollend',()=>{if(!tween&&!touch){clearTimeout(idle);settle();}});
  addEventListener('touchstart',event=>{
    touch=null;
    if(event.touches.length!==1||!enabled()||event.target.closest?.('dialog, .mobile-menu, .job-filters, .benefit-tabs'))return;
    const point=event.touches[0];
    touch={x:point.clientX,y:point.clientY,time:event.timeStamp,claimed:null,stepped:false,samples:[[event.timeStamp,point.clientY]]};
    clearTimeout(idle);
    if(hold||queue.count)clearChain(); // 연속 이동 중 다시 손을 대면 남은 칸은 취소하고 사용자 조작을 따른다
  },{passive:true});
  addEventListener('touchmove',event=>{
    if(!touch||event.touches.length!==1)return;
    const point=event.touches[0],dx=point.clientX-touch.x,dy=point.clientY-touch.y;
    touch.samples.push([event.timeStamp,point.clientY]);if(touch.samples.length>8)touch.samples.shift();
    if(touch.claimed===null){
      if(!dx&&!dy)return;
      if(Math.abs(dx)>Math.abs(dy)&&!tween){touch.claimed=false;return;} // 가로 제스처(카드 레일)는 관여하지 않음
      const list=stops(),dir=dy<0?1:-1,y=scrollY;
      touch.claimed=list.length>1&&(!!tween||(dir>0?y>=list[0]-stableVH()*.5&&y<list.at(-1)-2:y>list[0]+2&&y<=list.at(-1)+stableVH()*.5));
    }
    if(!touch.claimed)return;
    if(event.cancelable)event.preventDefault();
    if(!touch.stepped&&Math.abs(dy)>=THRESHOLD){touch.stepped=true;step(dy<0?1:-1);} // 손가락이 일정 거리 움직이면 떼기 전에 바로 출발
  },{passive:false});
  const end=event=>{
    const current=touch;touch=null;
    if(!current?.claimed){scheduleSettle();return;}
    const point=event.changedTouches[0],dy=point?point.clientY-current.y:0,dir=dy<0?1:-1;
    // 손을 떼기 직전 100ms 동안의 속도. 끝에서 멈췄다 떼면 느린 스와이프로 본다.
    const recent=current.samples.filter(([time])=>event.timeStamp-time<=100);
    const [t0,y0]=recent[0]||current.samples.at(-1)||[current.time,current.y];
    const flick=point?Math.abs(point.clientY-y0)/Math.max(16,event.timeStamp-t0):0;
    if(current.stepped){enqueue(dir,stepsFor(flick)-1);return;}
    const speed=Math.abs(dy)/Math.max(1,event.timeStamp-current.time);
    if(dy&&speed>.3){step(dir);enqueue(dir,stepsFor(Math.max(flick,speed))-1);}else if(!tween)settle();
  };
  addEventListener('touchend',end,{passive:true});addEventListener('touchcancel',end,{passive:true});
  addEventListener('resize',invalidate);mq.addEventListener?.('change',invalidate);reduce.addEventListener?.('change',invalidate);
  addEventListener('load',invalidate);document.fonts?.ready.then(invalidate);
  new ResizeObserver(invalidate).observe(document.body);
  return {register(getStops){sources.push(getStops);invalidate();},enabled,busy:()=>!!tween};
})();
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const all = (selector,scope=document) => [...scope.querySelectorAll(selector)];
  const lenis = !reduced.matches && window.Lenis ? new Lenis({lerp:.1,wheelMultiplier:.7,smoothWheel:true,syncTouch:false,prevent:node=>node.closest?.('dialog, .mobile-menu, .job-filters, .benefit-tabs')}) : null;
  if(lenis){const frame=time=>{lenis.raf(time);requestAnimationFrame(frame);};requestAnimationFrame(frame);}
  // Snap every Culture chapter after wheel input, before smooth-scroll inertia fades.
  if(document.body.classList.contains('page-culture')){
    const targets=[...document.querySelectorAll('.culture-opening,.culture-typing,.culture-principle-row,.talents-section,.benefits-section,.team-section,.join-section')];
    let timer,snapping=false,lastTarget=null;
    const snap=()=>{
      if(snapping||reduced.matches)return;
      const closest=targets.map(element=>{
        const block=element.querySelector('.culture-principle-copy')||element;
        const rect=block.getBoundingClientRect();
        const delta=element.matches('.culture-principle-row')?rect.top+rect.height/2-stableVH()*.5:rect.top-104;
        return {element,delta};
      }).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta))[0];
      if(!closest||Math.abs(closest.delta)>stableVH()*.48||Math.abs(closest.delta)<3||closest.element===lastTarget)return;
      lastTarget=closest.element;snapping=true;
      const done=()=>{snapping=false;};
      if(lenis)lenis.scrollTo(scrollY+closest.delta,{duration:.3,easing:t=>1-Math.pow(1-t,4),onComplete:done});
      else{window.scrollTo({top:scrollY+closest.delta,behavior:'smooth'});setTimeout(done,400);}
    };
    addEventListener('wheel',()=>{if(snapping)return;lastTarget=null;clearTimeout(timer);timer=setTimeout(snap,100);},{passive:true});
    addEventListener('touchend',()=>{lastTarget=null;clearTimeout(timer);timer=setTimeout(snap,120);},{passive:true});
    addEventListener('keydown',event=>{if(['PageDown','PageUp','ArrowDown','ArrowUp',' '].includes(event.key)){lastTarget=null;clearTimeout(timer);timer=setTimeout(snap,180);}});
  }

  const header=document.querySelector('.site-header');
  const menuButton=document.querySelector('.menu-toggle');
  const menu=document.querySelector('#mobile-menu');
  function setMenu(open){
    header.classList.toggle('menu-open',open);
    menuButton.setAttribute('aria-expanded',String(open));
    menuButton.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');
    menu.inert=!open;
    if(open)lenis?.stop();else lenis?.start();
  }
  menuButton.addEventListener('click',()=>setMenu(menuButton.getAttribute('aria-expanded')!=='true'));
  document.addEventListener('click',event=>{if(!header.contains(event.target))setMenu(false);});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&header.classList.contains('menu-open')){setMenu(false);menuButton.focus();}
    if(event.key==='Tab'&&header.classList.contains('menu-open')){
      const items=[menuButton,...all('a',menu)],first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  addEventListener('resize',()=>{if(innerWidth>991)setMenu(false);});

  const reviewToggle=document.querySelector('.review-toggle');
  if(reviewToggle){
    const setNotes=visible=>{
      document.body.classList.toggle('notes-off',!visible);
      reviewToggle.setAttribute('aria-expanded',String(visible));
      reviewToggle.innerHTML='<span aria-hidden="true">●</span> 다른 폰트 적용하기';
      
      lenis?.resize();
    };
    setNotes(false);
    reviewToggle.addEventListener('click',()=>setNotes(document.body.classList.contains('notes-off')));
  }

  const fontChoices={lexend:'LexendDeca',viga:'Viga',onest:'Onest',redhat:'RedHatDisplay',heavitas:'Heavitas'};
  const fontButtons=all('[data-font-choice]');
  function chooseReviewFont(choice){
    const selected=fontChoices[choice]?choice:'viga';
    document.documentElement.dataset.latinFont=selected;
    document.documentElement.style.setProperty('--latin-font',fontChoices[selected]);
    fontButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fontChoice===selected)));
    localStorage.setItem('your-unicorn-review-font-v2',selected);
    document.fonts.load(`800 1em ${fontChoices[selected]}`).finally(()=>{dispatchEvent(new Event('resize'));lenis?.resize();});
  }
  if(!document.body.classList.contains('approved-page'))chooseReviewFont(localStorage.getItem('your-unicorn-review-font-v2')||'viga');
  fontButtons.forEach(b=>b.addEventListener('click',()=>chooseReviewFont(b.dataset.fontChoice)));

  // Internal pages use regular links, without a full-screen transition.
  addEventListener('pageshow',()=>{lenis?.start();});
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download'))return;
    const url=new URL(link.href,location.href);
    if(url.origin!==location.origin||url.pathname!==location.pathname||url.search!==location.search||!url.hash)return;
    const target=document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if(target&&lenis){event.preventDefault();setMenu(false);history.pushState(null,'',url.hash);lenis.scrollTo(target,{offset:target.matches('[data-words-pile]')?0:-88});}
  });
  const restoreHash=()=>{
    if(!location.hash||!lenis)return;
    const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if(target){lenis.resize();lenis.scrollTo(target,{offset:target.matches('[data-words-pile]')?0:-100,immediate:true});}
  };
  addEventListener('hashchange',restoreHash);
  const reel=document.querySelector('.hero-word-reel');
  if(reel&&!reduced.matches){
    const words=all('.reel-word',reel);let active=0;
    setInterval(()=>{
      if(document.hidden||document.querySelector('.media-hero').getBoundingClientRect().bottom<0)return;
      active=(active+1)%words.length;
      reel.style.transform=`translateY(${-active*words[0].getBoundingClientRect().height}px)`;
      words.forEach((word,i)=>word.classList.toggle('is-active',i===active));
    },1500);
  }

  if (!reduced.matches && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('motion-ready');
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); } });
    }, { threshold: 0.09 });
    all('.page-company [data-reveal]').forEach(el => revealObserver.observe(el));

  }

  let productFlowReady=true,resetProductCarousel=()=>{};
  const carousel=document.querySelector('[data-product-carousel]');
  if(carousel){
    const track=carousel.querySelector('.product-carousel-track');
    const projects=all('.product-project',track);
    const toggle=document.querySelector('.flow-toggle');
    const count=projects.length/3;
    let offset=0,step=0,cycle=0,origin=0,cardWidth=0,visible=false;
    let userPaused=reduced.matches,focused=false,hovered=false,lastTime=0,active=count,tween=null,flowDelayUntil=0;
    const mod=(value,range)=>((value%range)+range)%range;
    const syncButton=()=>{
      if(!toggle)return;
      toggle.setAttribute('aria-pressed',String(userPaused));
      toggle.setAttribute('aria-label',userPaused?'제품 자동 흐름 재생':'제품 자동 흐름 일시정지');
      toggle.firstElementChild.textContent=userPaused?'▶':'Ⅱ';
    };
    const paint=()=>{
      if((carousel.classList.contains('unicorn-unfold-carousel')&&!carousel.closest('.is-previous-spread'))||!cycle)return;
      // Three repeated sets keep both clipped neighbors present at either loop boundary.
      track.style.transform=`translate3d(${origin-cycle+offset}px,0,0)`;
      active=count+Math.round(-offset/step);
      projects.forEach((project,i)=>project.classList.toggle('is-current',i===active));
    };
    resetProductCarousel=()=>{
      if(offset===0&&!tween)return;
      offset=0;tween=null;paint();
    };
    const stage=carousel.closest('.product-stage');
    const titles=all('.product-stage-title,.product-stage-bottom',stage);
    const fitTypography=()=>{
      if(!titles.length)return;
      stage.style.removeProperty('--product-type-size');
      const preferred=parseFloat(getComputedStyle(titles[0]).fontSize);
      const fit=Math.min(1,...titles.map(title=>{
        const style=getComputedStyle(title);
        const available=title.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
        return available/title.firstElementChild.getBoundingClientRect().width;
      }));
      stage.style.setProperty('--product-type-size',`${preferred*fit*.99}px`);
    };
    const measure=()=>{
      if((carousel.classList.contains('unicorn-unfold-carousel')&&!carousel.closest('.is-previous-spread')))return;
      fitTypography();
      const progress=cycle?offset/cycle:0,w=carousel.clientWidth;
      cardWidth=w*(innerWidth>=1440?.3:.38)*.68;const gap=w*20.4/1400;
      // Card 01 leads the visible row; the preceding repeat ends offscreen.
      step=cardWidth+gap;cycle=step*count;origin=gap;offset=progress*cycle;
      carousel.style.setProperty('--project-width',`${cardWidth}px`);
      carousel.style.setProperty('--project-gap',`${gap}px`);
      paint();
    };
    const moveTo=target=>{
      if(reduced.matches){offset=-mod(-target,cycle);paint();return;}
      tween={from:offset,to:target,start:performance.now(),duration:800};
    };
    const navigate=direction=>moveTo(-((Math.round(-offset/step))+direction)*step);
    carousel.addEventListener('keydown',event=>{
      if((carousel.classList.contains('unicorn-unfold-carousel')&&!carousel.closest('.is-previous-spread')))return;
      if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();navigate(event.key==='ArrowRight'?1:-1);}
    });
    let inspectingProject=null;
    const inspectProject=project=>{
      if((carousel.classList.contains('unicorn-unfold-carousel')&&!carousel.closest('.is-previous-spread'))||!project)return;
      if(inspectingProject&&inspectingProject!==project)inspectingProject.classList.remove('is-inspecting');
      inspectingProject=project;inspectingProject.classList.add('is-inspecting');hovered=true;
      const rect=project.getBoundingClientRect(),safe=Math.max(24,innerWidth*.02);
      let correction=0;
      if(rect.left<safe)correction=safe-rect.left;
      else if(rect.right>innerWidth-safe)correction=innerWidth-safe-rect.right;
      if(Math.abs(correction)>2)moveTo(offset+correction);
    };
    const endInspection=()=>{inspectingProject?.classList.remove('is-inspecting');inspectingProject=null;hovered=false;};
    carousel.addEventListener('focusin',event=>{
      if((carousel.classList.contains('unicorn-unfold-carousel')&&!carousel.closest('.is-previous-spread')))return;
      focused=true;
      if(event.target.matches(':focus-visible')){
        const project=event.target.closest('.product-project');
        if(project){const index=projects.indexOf(project);offset=-(index-count)*step;tween=null;paint();inspectProject(project);}
      }
    });
    carousel.addEventListener('focusout',()=>requestAnimationFrame(()=>{focused=carousel.contains(document.activeElement);if(!focused&&!carousel.matches(':hover'))endInspection();}));
    let drag=null;
    carousel.addEventListener('wheel',event=>{
      if((carousel.classList.contains('unicorn-unfold-carousel')&&!carousel.closest('.is-previous-spread')))return;
      const distance=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:(event.shiftKey?event.deltaY:0);
      if(!distance)return;
      event.preventDefault();endInspection();tween=null;offset=-mod(-(offset-distance),cycle);flowDelayUntil=performance.now()+2500;paint();
    },{passive:false});
    carousel.addEventListener('pointerdown',event=>{
      if((carousel.classList.contains('unicorn-unfold-carousel')&&!carousel.closest('.is-previous-spread')))return;
      if(event.button!==0)return;
      drag={x:event.clientX,offset};tween=null;flowDelayUntil=performance.now()+3000;
    });
    carousel.addEventListener('pointermove',event=>{
      if((carousel.classList.contains('unicorn-unfold-carousel')&&!carousel.closest('.is-previous-spread')))return;
      if(!drag||Math.abs(event.clientX-drag.x)<6)return;
      carousel.setPointerCapture(event.pointerId);carousel.classList.add('is-dragging');endInspection();
      offset=-mod(-(drag.offset+event.clientX-drag.x),cycle);paint();
    });
    const stopDrag=()=>{drag=null;carousel.classList.remove('is-dragging');flowDelayUntil=performance.now()+2500;};
    carousel.addEventListener('pointerup',stopDrag);carousel.addEventListener('pointercancel',stopDrag);
    carousel.addEventListener('pointerover',event=>{if(!drag)inspectProject(event.target.closest('.product-project'));});
    carousel.addEventListener('pointerleave',()=>{if(!focused)endInspection();});
    toggle?.addEventListener('click',()=>{userPaused=!userPaused;syncButton();});
    reduced.addEventListener('change',()=>{userPaused=reduced.matches;syncButton();});
    measure();new ResizeObserver(measure).observe(carousel);document.fonts.ready.then(measure);
    new IntersectionObserver(entries=>{
      const entering=entries[0].isIntersecting;
      if(entering&&!visible){resetProductCarousel();flowDelayUntil=performance.now()+1000;}
      visible=entering;
    },{threshold:.1}).observe(carousel);
    const frame=time=>{
      const delta=Math.min((time-lastTime)/1000,.05);lastTime=time;
      if(tween){
        const p=Math.min(1,(time-tween.start)/tween.duration),ease=1-Math.pow(1-p,4);
        offset=tween.from+(tween.to-tween.from)*ease;
        if(p===1){offset=-mod(-offset,cycle);tween=null;}paint();
      }else if(!(carousel.classList.contains('unicorn-unfold-carousel')&&!carousel.closest('.is-previous-spread'))&&carousel.dataset.unfolding!=='true'&&visible&&productFlowReady&&time>=flowDelayUntil&&!userPaused&&!reduced.matches&&!focused&&!hovered&&!document.hidden&&!document.querySelector('dialog[open]')){
        offset-=carousel.clientWidth*.03*delta; // 3차: 흐르는 속도 살짝 빠르게 (was .025)
        offset=-mod(-offset,cycle);paint();
      }
      requestAnimationFrame(frame);
    };
    syncButton();requestAnimationFrame(frame);
  }

  const wordsPile=document.querySelector('[data-words-pile]');
  if(wordsPile){
    const scene=wordsPile.querySelector('.c-words-pile');
    const container=scene.querySelector('.c-words-pile__container');
    const phrases=all('.c-words-pile__word--accent',scene);
    const desktop=matchMedia('(min-width:768px)');
    const count=phrases.length,duration=count*1000,stagger=(count-1)*1000;
    // OpenDue's whole-line sequence: one viewport of vertical travel,
    // overlapping entrances, then a three-unit hold before the section releases.
    const timelineDuration=duration+stagger*(count-1)+3000;
    let animations=[],scrollDistance=0,ticking=false,headingHeight=0,liftSteps=[];
    const updatePile=()=>{
      ticking=false;
      if(!animations.length)return;
      const progress=Math.max(0,Math.min(1,-wordsPile.getBoundingClientRect().top/scrollDistance));
      const time=progress*timelineDuration;
      let lift=0;
      animations.forEach((animation,index)=>{
        animation.currentTime=Math.max(0,Math.min(duration,time-index*stagger));
        // Shift the existing stack only as the new line enters the viewport.
        const arrival=Math.max(0,Math.min(1,(animation.effect.getComputedTiming().progress-.55)/.45));
        lift+=liftSteps[index]*arrival;
      });
      container.style.transform=`translate3d(0,${-headingHeight/2-lift}px,0)`;
    };
    const requestPile=()=>{if(!ticking){ticking=true;requestAnimationFrame(updatePile);}};
    const measurePile=()=>{
      animations.forEach(animation=>animation.cancel());animations=[];
      wordsPile.classList.remove('is-pinned');wordsPile.style.removeProperty('height');
      wordsPile.style.removeProperty('--pile-handoff');container.style.removeProperty('transform');
      scene.style.removeProperty('--pile-font-size');
      // Fit the longest complete phrase by changing the shared font size only.
      const preferred=parseFloat(getComputedStyle(scene).fontSize);
      const widest=Math.max(...all('.c-words-pile__text',scene).map(text=>text.getBoundingClientRect().width));
      if(widest>container.clientWidth)scene.style.setProperty('--pile-font-size',`${preferred*container.clientWidth/widest*.98}px`);
      if(reduced.matches||!desktop.matches)return;
      wordsPile.classList.add('is-pinned');
      headingHeight=scene.querySelector('h2').offsetHeight;
      const initialTop=(scene.offsetHeight-headingHeight)/2;
      const addedHeight=container.offsetHeight-headingHeight;
      const maxLift=Math.min(addedHeight,Math.max(0,initialTop-112));
      const liftRatio=addedHeight?maxLift/addedHeight:0;
      let previousBottom=headingHeight;
      liftSteps=phrases.map(phrase=>{
        const bottom=phrase.offsetTop+phrase.offsetHeight;
        const step=(bottom-previousBottom)*liftRatio;previousBottom=bottom;return step;
      });
      // Bring the next section directly below the completed stack as the pin ends.
      const finalBottom=initialTop-maxLift+container.offsetHeight;
      const handoff=Math.max(0,scene.offsetHeight-finalBottom-Math.max(40,innerWidth*.035));
      wordsPile.style.setProperty('--pile-handoff',`${handoff}px`);
      scrollDistance=scene.offsetHeight+stableVH()*count*.3;
      wordsPile.style.height=`${scene.offsetHeight+scrollDistance}px`;
      animations=phrases.map(phrase=>{
        const animation=phrase.animate(
          [{transform:`translate3d(0,${stableVH()}px,0)`},{transform:'translate3d(0,0,0)'}],
          {duration,fill:'both',easing:'cubic-bezier(.33,0,.10,1)'}
        );
        animation.pause();return animation;
      });
      updatePile();lenis?.resize();
    };
    addEventListener('scroll',requestPile,{passive:true});
    addEventListener('resize',measurePile);
    reduced.addEventListener('change',measurePile);desktop.addEventListener('change',measurePile);
    measurePile();document.fonts.ready.then(measurePile);
  }

  const productPile=document.querySelector('[data-product-pile]');
  if(productPile){
    const stage=productPile.querySelector('.product-stage');
    const title=stage.querySelector('.product-stage-title>span');
    const answer=stage.querySelector('.product-answer-group');
    const cards=all('.product-project',stage);
    const desktop=matchMedia('(min-width:768px)');
    let entries=[],startTop=0,travel=1,pinTop=0,ticking=false;
    const unit=value=>Math.max(0,Math.min(1,value));
    const updateProductPile=()=>{
      ticking=false;
      if(!entries.length)return;
      const progress=unit((startTop-productPile.getBoundingClientRect().top)/travel);
      // Keep card 01 at the start throughout the staggered arrival.
      productFlowReady=progress>=.65;
      if(progress<=.12)resetProductCarousel();
      entries.forEach(({animation,start,end})=>{
        animation.currentTime=unit((progress-start)/(end-start))*1000;
      });
    };
    const scheduleProductPile=()=>{if(!ticking){ticking=true;requestAnimationFrame(updateProductPile);}};
    const measureProductPile=()=>{
      entries.forEach(({animation})=>animation.cancel());entries=[];
      productPile.classList.remove('is-pinned');
      productPile.style.removeProperty('height');productPile.style.removeProperty('--product-pin-top');
      if(document.querySelector('.unicorn-unfold-carousel')||reduced.matches||!desktop.matches){productFlowReady=true;lenis?.resize();return;}
      // Pin below the navigation so the headline never sits behind its black bar.
      const navigation=document.querySelector('.site-header');
      const navigationTop=navigation?parseFloat(getComputedStyle(navigation).top)||0:0;
      pinTop=Math.max(104,(navigation?.offsetHeight||0)+navigationTop+20);
      const holdDistance=stableVH()*.75;
      startTop=stableVH()*.82;
      travel=startTop-pinTop+holdDistance;
      productPile.style.height=`${stage.offsetHeight+holdDistance}px`;
      productPile.style.setProperty('--product-pin-top',`${pinTop}px`);
      productPile.classList.add('is-pinned');
      const rise=(element,start,end,distance,fade=false)=>{
        const from={transform:`translate3d(0,${distance}px,0)`};
        const to={transform:'translate3d(0,0,0)'};
        if(fade){from.opacity=0;to.opacity=1;}
        const animation=element.animate([from,to],{duration:1000,fill:'both',easing:'cubic-bezier(.22,1,.36,1)'});
        animation.pause();entries.push({animation,start,end});
      };
      if(title)rise(title,0,.22,stableVH()*.2,true);
      cards.forEach((card,index)=>{
        // Repeat the same three-card cadence in every carousel copy.
        const delay=(index%(cards.length/3))*.065;
        rise(card,.12+delay,.52+delay,stableVH()*.62);
      });
      if(answer)rise(answer,.53,.82,stableVH()*.27,true);
      updateProductPile();lenis?.resize();
    };
    addEventListener('scroll',scheduleProductPile,{passive:true});
    addEventListener('resize',measureProductPile);
    desktop.addEventListener('change',measureProductPile);reduced.addEventListener('change',measureProductPile);
    // The carousel fits its typography first; observe only actual stage size changes.
    new ResizeObserver(measureProductPile).observe(stage);
    measureProductPile();document.fonts.ready.then(measureProductPile);
  }

  const bonusDialog=document.querySelector('.bonus-dialog');
  const bonusOpen=document.querySelector('.bonus-open');
  if(bonusDialog&&bonusOpen){
    bonusOpen.addEventListener('click',()=>{bonusDialog.showModal();document.body.style.overflow='hidden';lenis?.stop();});
    bonusDialog.querySelector('.dialog-close').addEventListener('click',()=>bonusDialog.close());
    bonusDialog.addEventListener('click',event=>{const r=bonusDialog.getBoundingClientRect();if(event.target===bonusDialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))bonusDialog.close();});
    bonusDialog.addEventListener('close',()=>{document.body.style.overflow='';lenis?.start();bonusOpen.focus({preventScroll:true});});
  }

  const benefitTabs=all('[data-benefit]');
  function selectBenefit(index){
    benefitTabs.forEach((tab,i)=>{const active=i===index;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;});
  }
  benefitTabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>selectBenefit(index));
    tab.addEventListener('keydown',event=>{
      let next=index;
      if(event.key==='ArrowRight')next=(index+1)%benefitTabs.length;
      else if(event.key==='ArrowLeft')next=(index+benefitTabs.length-1)%benefitTabs.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=benefitTabs.length-1;
      else return;
      event.preventDefault();selectBenefit(next);benefitTabs[next].focus();
    });
  });

  const experience=document.getElementById('job-experience');
  if(experience){
    const filters=all('.job-filter'),rows=all('.job-row');
    let selectedTeam='All';
    function filterJobs(){
      let visible=0;
      rows.forEach(row=>{const match=(selectedTeam==='All'||row.dataset.team===selectedTeam)&&(experience.value==='all'||row.dataset.experience===experience.value);row.hidden=!match;if(match)visible++;});
      document.getElementById('job-count').textContent=visible;
      document.querySelector('.empty-jobs').hidden=visible>0;
      filters.forEach(button=>{const active=button.dataset.team===selectedTeam;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    }
    filters.forEach(button=>button.addEventListener('click',()=>{selectedTeam=button.dataset.team;filterJobs();}));
    experience.addEventListener('change',filterJobs);
    document.getElementById('reset-jobs').addEventListener('click',()=>{selectedTeam='All';experience.value='all';filterJobs();});
    const initialTeam=new URLSearchParams(location.search).get('team');
    if(initialTeam){selectedTeam=initialTeam;filterJobs();}
  }

  let scheduled=false;
  const clamp=x=>Math.max(0,Math.min(1,x));
  const slides=all('.page-company [data-stack]');
  function measureCards(){
    slides.forEach(slide=>{
      const panel=slide.querySelector('.story-panel');
      slide.style.setProperty('--panel-height',`${panel.offsetHeight}px`);
      slide.classList.toggle('is-tall',panel.offsetHeight>stableVH()-40);
    });
    lenis?.resize();
  }
  const hero=document.querySelector('.page-company .media-hero');
  if(hero)document.documentElement.classList.add('hero-intro-ready');
  function updateHero(){
    if(!hero)return;
    const distance=Math.max(0,-hero.getBoundingClientRect().top);
    const raw=clamp(distance/Math.min(stableVH()*.32,260));
    const frame=reduced.matches?(distance>24?1:0):raw*raw*(3-2*raw);
    const navRaw=clamp((distance-24)/120);
    const nav=reduced.matches?(distance>24?1:0):navRaw*navRaw*(3-2*navRaw);
    const gutter=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter'));
    const inset=innerWidth>760?innerWidth*gutter/100:gutter;
    const radius=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--radius'));
    hero.style.setProperty('--hero-round',`${radius*frame}px`);
    hero.style.setProperty('--hero-inset',`${inset*frame}px`);
    hero.style.setProperty('--scroll-cue-opacity',String(1-clamp(distance/90)));
    hero.style.setProperty('--scroll-cue-shift',`${Math.min(distance*.12,12)}px`);
    header.style.setProperty('--gnb-opacity',String(nav));
    header.style.setProperty('--gnb-offset',`${-24*(1-nav)}px`);
    header.classList.toggle('is-revealed',nav>.01);
  }
  function updateScroll(){
    scheduled=false;updateHero();
    if(reduced.matches)return;
    slides.forEach((slide,index)=>{
      const panel=slide.querySelector('.story-panel');
      const p=slide.classList.contains('is-tall')?0:clamp(-slide.getBoundingClientRect().top/stableVH());
      const eased=p*p;
      panel.style.setProperty('--card-scale',String(1-.3*eased));
      panel.style.setProperty('--card-rx',`${40*eased}deg`);
      panel.style.setProperty('--card-rz',`${(index%2?3:-3)*eased}deg`);
      panel.style.setProperty('--card-opacity',String(1-clamp((p-.75)/.25)));
    });
    const portrait=document.querySelector('.intro-portrait');
    if(portrait&&innerWidth>760){const p=clamp((stableVH()-portrait.getBoundingClientRect().top)/(stableVH()+portrait.offsetHeight));portrait.style.transform=`rotate(${-5+p*10}deg)`;}
  }
  const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateScroll);}};
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',()=>{measureCards();schedule();},{passive:true});
  addEventListener('load',()=>{measureCards();restoreHash();schedule();});
  document.fonts?.ready.then(()=>{measureCards();schedule();});
  measureCards();updateScroll();
})();

// Independent photo drift through the opening gallery.
(()=>{
  const gallery=document.querySelector('[data-floating-gallery]');
  if(!gallery)return;
  const shots=[...gallery.querySelectorAll('[data-drift]')];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let queued=false;
  const paint=()=>{queued=false;const rect=gallery.getBoundingClientRect();const progress=Math.max(-1,Math.min(1,(stableVH()/2-rect.top)/(rect.height+stableVH())*2));shots.forEach(shot=>shot.style.setProperty('--drift',`${reduce.matches?0:progress*Number(shot.dataset.drift)}px`));};
  const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(paint);}};
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);paint();
})();

// Technology-style entrance: the second phrase opens out after the image reveal.
(() => {
  const hero=document.querySelector('.company-film-hero');
  if(!hero)return;
  const first=hero.querySelector('.company-hero-copy h1');
  const last=hero.querySelector('.company-hero-copy p');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced)return;
  const enter=()=>{
    last.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:800,delay:700,easing:'cubic-bezier(.22,.61,.36,1)',fill:'backwards'});
    document.querySelector('.hero-media').animate([{opacity:0},{opacity:1}],{duration:1200,easing:'cubic-bezier(.38,0,.215,1)',fill:'backwards'});
  };
  document.fonts.ready.then(enter);
})();

// One continuous film surface: full viewport -> the gallery's central frame.
// 모바일 떨림 방지: 영상 레이어 위치는 CSS sticky(컴포지터)가 고정하고, JS 는 잘라내는 영역만 다룬다.
// 좌표·크기는 레이아웃이 바뀔 때만 재고, 스크롤 중에는 스크롤 구동 애니메이션(지원 브라우저) 또는 rAF 로 clip-path 만 갱신한다.
(() => {
  const opening=document.querySelector('.film-gallery-opening');
  if(!opening)return;
  const hero=opening.querySelector('.company-film-hero');
  const media=hero.querySelector('.hero-media');
  const legacyTarget=opening.querySelector('.shot-center');
  opening.prepend(media);
  media.classList.add('shared-opening-film');
  const approvedHeader=document.querySelector('.approved-company .approved-header');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const scrollDriven=CSS.supports?.('animation-timeline: scroll()')&&CSS.supports('animation-range: 0px 1px');
  // 주소창이 접혀도 변하지 않는 레이어 높이(100lvh)
  const lvhProbe=document.createElement('div');lvhProbe.setAttribute('aria-hidden','true');
  lvhProbe.style.cssText='position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
  document.documentElement.append(lvhProbe);
  let geo=null,pending=false,headerShown=null;
  const measure=()=>{
    const mask=opening.querySelector('.unicorn-mask-section');
    const live=mask&&!mask.hidden;
    const target=live?mask.querySelector('.unicorn-mask-frame'):legacyTarget;
    const stage=live?mask.querySelector('.unicorn-mask-stage'):null;
    const stickyTop=stage?parseFloat(getComputedStyle(stage).top)||0:0;
    const root=opening.getBoundingClientRect(),box=target.getBoundingClientRect();
    const start=root.top+scrollY;
    const end=Math.max(1,stage?mask.offsetTop-stickyTop:target.offsetTop+target.parentElement.offsetTop-stableVH()*.2);
    const W=document.documentElement.clientWidth||innerWidth,H=lvhProbe.offsetHeight||innerHeight;
    // 축소가 끝난 순간(스테이지가 고정된 상태)의 카드 위치 — 스크롤과 무관한 값
    const top=stage?stickyTop+target.offsetTop:box.top+scrollY-start-end;
    const left=box.left-root.left,width=target.offsetWidth||box.width,height=target.offsetHeight||box.height;
    geo={start,end,W,H,top,left,right:W-left-width,bottom:H-top-height,radius:stage?10:24}; // 10/19: match the 10px card corners in the unicorn stage.
    const vars={'--film-start':`${start}px`,'--film-stop':`${start+end}px`,'--film-layer-height':`${H}px`,
      '--film-t':`${geo.top}px`,'--film-r':`${geo.right}px`,'--film-b':`${geo.bottom}px`,'--film-l':`${geo.left}px`,'--film-radius':`${geo.radius}px`,
      // Keep the video viewport stable: resize the iframe only when the layout changes.
      '--film-width':`${Math.max(W,(H+120)*16/9)}px`,'--film-height':`${Math.max(H+120,W*9/16)}px`};
    for(const [k,v] of Object.entries(vars))media.style.setProperty(k,v);
    media.classList.toggle('is-scroll-driven',scrollDriven&&!reduce.matches);
    schedule();
  };
  const paint=()=>{
    pending=false;
    if(!geo)return;
    const raw=Math.max(0,Math.min(1,(scrollY-geo.start)/geo.end));
    if(approvedHeader){
      const enter=Math.max(0,Math.min(1,raw/.18)),visibility=enter*enter*(3-2*enter);
      approvedHeader.style.setProperty('--header-enter',visibility);
      const shown=visibility>=.05;
      if(shown!==headerShown){headerShown=shown;approvedHeader.inert=!shown;approvedHeader.setAttribute('aria-hidden',String(!shown));}
    }
    hero.style.setProperty('--opening-copy-opacity',String(1-Math.min(1,raw*3)));
    if(media.classList.contains('is-scroll-driven')){media.style.removeProperty('clip-path');return;} // 잘라내기는 CSS 스크롤 타임라인이 스크롤과 같은 프레임에 계산
    const p=raw*raw*(3-2*raw);
    const r=(n)=>(n*p).toFixed(2);
    media.style.clipPath=`inset(${r(geo.top)}px ${r(geo.right)}px ${r(geo.bottom)}px ${r(geo.left)}px round ${r(geo.radius)}px)`;
    media.style.setProperty('--film-shade',String(.13+.32*p));
  };
  const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(paint);}};
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',measure);reduce.addEventListener?.('change',measure);
  const observer=new ResizeObserver(()=>measure());
  observer.observe(opening);
  opening.querySelectorAll('.unicorn-mask-frame,.unicorn-mask-stage').forEach(el=>observer.observe(el));
  document.fonts?.ready.then(measure);addEventListener('load',measure);
  measure();paint();
})();

// Official YouTube embed; start silently and keep the example film looping.
(() => {
  const mount=document.getElementById('hero-youtube-player');
  if(!mount)return;
  const layer=mount.parentElement;
  const fallback=layer.parentElement.querySelector('.hero-film-fallback');
  const playFallback=()=>{if(fallback){fallback.muted=true;fallback.play().catch(()=>{});}};
  playFallback();
  let player,ready=false;
  const resume=()=>{
    if(!layer.classList.contains('is-playing'))playFallback();
    if(!ready||document.hidden)return;
    const box=layer.getBoundingClientRect();
    if(box.bottom<=0||box.top>=stableVH())return;
    if(player.getPlayerState()!==1){player.mute();player.playVideo();}
  };
  addEventListener('pageshow',resume);
  addEventListener('focus',resume);
  document.addEventListener('visibilitychange',resume);
  document.addEventListener('pointerdown',resume,{passive:true});
  document.addEventListener('keydown',resume);
  new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))resume();}).observe(layer);
  const init=()=>{
    player=new YT.Player(mount,{
      videoId:'TNnFyAkXJ_w',
      playerVars:{autoplay:1,mute:1,controls:0,loop:1,playlist:'TNnFyAkXJ_w',playsinline:1,cc_load_policy:0,rel:0,disablekb:1,iv_load_policy:3,origin:location.origin},
      events:{
        onReady:({target})=>{ready=true;target.getIframe().setAttribute('tabindex','-1');target.getIframe().setAttribute('title','브랜드 예시 배경 영상');target.mute();target.playVideo();[800,2000,5000].forEach(delay=>setTimeout(resume,delay));},
        onStateChange:({data,target})=>{if(data===1){layer.classList.add('is-playing');fallback?.pause();target.unloadModule('captions');}if(data===0)target.playVideo();},
        onApiChange:({target})=>target.unloadModule('captions'),
        onError:()=>{layer.classList.remove('is-playing');playFallback();}
      }
    });
  };
  if(window.YT?.Player)init();
  else{window.onYouTubeIframeAPIReady=init;const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';document.head.append(script);}
})();


(() => {
  const heading=document.getElementById('unicorn-question');
  if(!heading)return;
  const text=heading.querySelector('.c-words-pile__text');
  const fit=()=>{
    const size=parseFloat(getComputedStyle(heading).fontSize);
    const width=text.getBoundingClientRect().width;
    if(width)heading.style.setProperty('--question-fit',`${size*heading.clientWidth/width}px`);
  };
  document.fonts.ready.then(fit);
  document.fonts.addEventListener('loadingdone',fit);
  new ResizeObserver(fit).observe(heading);
  new MutationObserver(()=>document.fonts.ready.then(fit)).observe(document.documentElement,{attributes:true,attributeFilter:['data-latin-font']});
})();

(() => {
  const picker=document.querySelector('.lang-switch');
  if(!picker)return;
  picker.querySelector('[data-language]').addEventListener('click',()=>{picker.open=false;});
  document.addEventListener('click',e=>{if(!picker.contains(e.target))picker.open=false;});
  picker.addEventListener('keydown',e=>{if(e.key==='Escape'){picker.open=false;picker.querySelector('summary').focus();}});
})();

// Core values: retain each original explanation below the visual strip.
document.querySelectorAll('[data-value]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-value]').forEach(item=>item.setAttribute('aria-expanded',String(item===button)));
  document.querySelectorAll('.value-detail').forEach(panel=>panel.hidden=panel.id!==button.getAttribute('aria-controls'));
}));

// Keep the active recruiting stage readable while its neighbours follow an arc.
const journey=document.querySelector('.journey-scroll');
if(journey){
 const choices=[...journey.querySelectorAll('[data-journey]')];
 const panels=[...journey.querySelectorAll('.journey-detail')];
 const measureJourneyDetails=()=>{
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
  choices.forEach((button,i)=>{button.style.setProperty('--offset',i-active);button.style.setProperty('--stage-opacity',[1,.09,.045,.02,.01][Math.abs(i-active)]);button.classList.toggle('is-active',i===active);button.setAttribute('aria-pressed',String(i===active));panels[i].hidden=i!==active;});
 };
 choices.forEach((button,i)=>{
  button.addEventListener('click',()=>{manual=true;selectStage(i);});
  button.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();manual=true;selectStage(event.key==='Home'?0:event.key==='End'?4:active+(event.key==='ArrowDown'?1:-1));choices[active].focus({preventScroll:true});}});
 });
 let scheduled=false;
 const updateJourney=()=>{scheduled=false;if(innerWidth<768||manual)return;const box=journey.getBoundingClientRect();const sticky=journey.querySelector('.journey-frame');const inset=parseFloat(getComputedStyle(sticky).top)||0;const travel=journey.offsetHeight-sticky.offsetHeight;if(travel>0)selectStage(Math.round(Math.max(0,Math.min(1,(inset-box.top)/travel))*4));};
 addEventListener('scroll',()=>{manual=false;if(!scheduled){scheduled=true;requestAnimationFrame(updateJourney);}},{passive:true});
 addEventListener('resize',updateJourney);updateJourney();
}

// Play only city films that are actually entering the viewport.
const cityFilms=[...document.querySelectorAll('.city-film')];
if(cityFilms.length){
 const cityObserver=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{
  target.muted=true;
  if(isIntersecting)target.play().catch(()=>{});else target.pause();
 }),{rootMargin:'100px'});
 cityFilms.forEach(video=>cityObserver.observe(video));
}


// Keep the Vision surface aligned with the header.
const visionMask=document.querySelector('.vision-section');
if(visionMask){
  const update=()=>{
    const header=document.querySelector('.site-header')?.getBoundingClientRect();
    visionMask.style.setProperty('--vision-inset',`${header?.left??24}px`);
  };
  addEventListener('resize',update);update();
}

// Translate the rail so the tag silhouettes can overflow their container.
(() => {
 const section=document.querySelector('.growth-tags');if(!section)return;
 const viewport=section.querySelector('.growth-tags-window');
 const track=section.querySelector('.growth-tags-track');
 const cards=[...section.querySelectorAll('.growth-tag')];
 const buttons=[...section.querySelectorAll('[data-growth-direction]')];
 let index=0,startX=null;
 const update=()=>{
  const step=cards[1].offsetLeft-cards[0].offsetLeft;
  const max=Math.max(0,track.scrollWidth-viewport.clientWidth);
  const last=Math.ceil(max/step);index=Math.max(0,Math.min(index,last));
  track.style.transform=`translateX(${-Math.min(index*step,max)}px)`;
  buttons[0].disabled=index===0;buttons[1].disabled=index===last;
  section.querySelector('#growth-tags-status').textContent=`${cards.length}개 중 ${index+1}번째 카드부터 표시`;
 };
 const move=direction=>{index+=direction;update();};
 buttons.forEach(button=>button.addEventListener('click',()=>move(Number(button.dataset.growthDirection))));
 viewport.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();if(event.key==='Home')index=0;else if(event.key==='End')index=cards.length-1;else index+=event.key==='ArrowRight'?1:-1;update();
 });
 viewport.addEventListener('pointerdown',event=>{startX=event.clientX;viewport.setPointerCapture(event.pointerId);});
 viewport.addEventListener('pointerup',event=>{if(startX!==null&&Math.abs(event.clientX-startX)>40)move(event.clientX<startX?1:-1);startX=null;});
 viewport.addEventListener('pointercancel',()=>{startX=null;});
 viewport.addEventListener('wheel',event=>{if(Math.abs(event.deltaX)>Math.abs(event.deltaY)&&Math.abs(event.deltaX)>12){event.preventDefault();if(!viewport.wheelLocked){move(event.deltaX>0?1:-1);viewport.wheelLocked=true;setTimeout(()=>viewport.wheelLocked=false,400);}}},{passive:false});
 new ResizeObserver(update).observe(viewport);update();
})();

// FAQ categories retain independent disclosure states and keyboard navigation.
(() => {
 const tabs=[...document.querySelectorAll('[data-faq-tab]')];
 if(!tabs.length)return;
 const activate=index=>{
  tabs.forEach((tab,i)=>{
   tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;
   document.getElementById(tab.getAttribute('aria-controls')).hidden=i!==index;
  });
  document.querySelector('.faq-intro h2').textContent=index?'After you apply.':'Before you apply.';
 };
 tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>activate(i));
  tab.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   activate(index);tabs[index].focus();
  });
 });
})();

// Expand the crossing film from its actual marquee position into a large frame.
(()=>{
 const section=document.querySelector('.city-expansion-scroll');
 if(!section)return;
 const stage=section.querySelector('.city-expansion-stage'),rows=section.querySelector('.city-film-rows');
 const frame=section.querySelector('.city-expanded-film');
 let film=frame.querySelector('video');
 const shade=frame.querySelector('.city-film-shade'),message=frame.querySelector('.global-cities-message');
 const heading=section.parentElement.querySelector('.global-cities-intro');
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let origin=null,ticking=false,sourceSlot=null;
 function restoreSource(){
  if(sourceSlot){sourceSlot.replaceWith(film);sourceSlot=null;film.play().catch(()=>{});}
 }
 const clamp=n=>Math.max(0,Math.min(1,n));
 // 3차: 뷰포트 기준 하단 여백 40px — 고정된 인트로 아래에서 쓸 수 있는 높이(도시 줄·확대 영상 모두 이 안에)
 const availH=()=>{if(innerWidth<=700)return Infinity;const top=heading?heading.getBoundingClientRect().height+(parseFloat(getComputedStyle(heading).top)||0):0;return Math.max(320,stableVH()-top-40);};
 const filmH=w=>Math.min(w*9/16,availH());
 // End the sticky track as soon as the film and its headline are fully revealed.
 function measure(){
  if(reduced.matches){section.style.height='';stage.style.height='';return;}
  rows.style.setProperty('--city-avail',Number.isFinite(availH())?`${availH()}px`:'9999px');
  // Size the clipping stage from its actual full-width content, not the page gutter.
  const insetX=0;
  const filmHeight=filmH(Math.max(1,stage.clientWidth-insetX*2));
  stage.style.height=`${Math.ceil(Math.max(rows.scrollHeight,filmHeight))}px`;
  const travel=Math.max(1,stableVH()*(innerWidth<=700?.6:1.5)-stage.offsetHeight)*.8; // 3차: 데스크톱도 고정 구간 축소(2.3→1.5) → 영상 카드 아래 빈 공간이 길게 보이지 않게 // 3차: 모바일은 고정 구간을 짧게 → 영상 카드와 CTA 사이 빈 간격 최소화 // 3차: 모바일은 하단 여백이 너무 커서 이동 거리 축소
  section.style.height=`${stage.offsetHeight+travel}px`;
 }
 function update(){
  ticking=false;
  if(heading)heading.style.transform='';
  // 3차: 확대 영상 높이(폭*9/16)가 스테이지보다 커지면(초기 측정 시 폭이 달랐던 경우) 아래 CTA를 덮으므로 즉시 재측정
  {rows.style.setProperty('--city-avail',Number.isFinite(availH())?`${availH()}px`:'9999px');const need=Math.ceil(Math.max(rows.scrollHeight,filmH(Math.max(1,stage.clientWidth))));if(innerWidth>700&&Math.abs(stage.offsetHeight-need)>1){restoreSource();origin=null;measure();}}
  if(reduced.matches){section.classList.remove('is-expanding');rows.style.opacity='1';return;}
  const rect=stage.getBoundingClientRect(),inset=parseFloat(getComputedStyle(stage).top)||0;
  const progress=clamp((inset-section.getBoundingClientRect().top)/(section.offsetHeight-stage.offsetHeight));
  // Release the heading with the film, keeping their shared edge intact.
  if(heading && progress>=1){
   const headingRect=heading.getBoundingClientRect();
   const shift=Math.min(0,rect.top-headingRect.height-headingRect.top);
   heading.style.transform=`translateY(${shift}px)`;
  }
  if(progress<=0){restoreSource();origin=null;section.classList.remove('is-expanding');frame.style.visibility='hidden';rows.style.opacity='1';return;}
  if(!origin){
   section.classList.add('is-expanding');
   // 3차: 서울 영상(data-no-expand)은 확대 대상에서 제외 — 글로벌 도시 영상만 커진다.
   // 3차: 확대 대상은 data-expand 표시된 글로벌 영상(택시·브루클린 브리지·타이베이·공원)만.
   const marked=[...rows.querySelectorAll('video[data-expand]')];
   const pool=marked.length?marked:[...rows.querySelectorAll('video:not([data-no-expand])')];
   const visible=(pool.length?pool:[...rows.querySelectorAll('video')]).map(video=>{
    const box=video.getBoundingClientRect();
    const width=Math.max(0,Math.min(box.right,rect.right,innerWidth)-Math.max(box.left,rect.left,0));
    const height=Math.max(0,Math.min(box.bottom,rect.bottom,stableVH())-Math.max(box.top,rect.top,inset));
    return {video,box,ratio:width*height/Math.max(1,box.width*box.height)};
   }).filter(item=>item.ratio>0);
   if(!visible.length){section.classList.remove('is-expanding');return;}
   // Choose the film nearest the visible screen centre at this moment.
   // Every film is eligible; the moving rows make the selected film vary naturally.
   const centerX=innerWidth/2,centerY=(Math.max(0,rect.top)+Math.min(stableVH(),rect.bottom))/2;
   visible.sort((a,b)=>Math.hypot(a.box.x+a.box.width/2-centerX,a.box.y+a.box.height/2-centerY)-Math.hypot(b.box.x+b.box.width/2-centerX,b.box.y+b.box.height/2-centerY));
   const {video:source,box:b}=visible[0];
   origin={x:b.x-rect.x,y:b.y-rect.y,w:b.width,h:b.height};
   // Reuse the playing element itself: no reload, poster flash, or seek discontinuity.
   const placeholder=source.cloneNode(true);
   source.replaceWith(placeholder);
   sourceSlot=placeholder;
   if(frame.contains(film))film.remove();
   frame.prepend(source);film=source;
   film.play().catch(()=>{});

  }
  const t=clamp(progress/.8125),ease=t*t*(3-2*t);
  const insetX=0;
  const targetX=insetX,targetWidth=Math.max(1,rect.width-insetX*2);
  const mix=(a,b)=>a+(b-a)*ease;
  Object.assign(frame.style,{visibility:'visible',left:`${mix(origin.x,targetX)}px`,top:`${mix(origin.y,0)}px`,width:`${mix(origin.w,targetWidth)}px`,height:`${mix(origin.h,innerWidth<=700?rect.height:filmH(targetWidth))}px`}); // 3차: 모바일은 스테이지 높이까지 채워 아래 빈 공간 제거
  rows.style.opacity=String(1-clamp(progress/.25));
  const reveal=clamp((progress-.725)/.275);
  shade.style.opacity=String(reveal*.48);message.style.opacity=String(reveal);message.style.transform=`translateY(${(1-reveal)*24}px)`;
 }
 function request(){if(!ticking){ticking=true;requestAnimationFrame(update);}}
 addEventListener('scroll',request,{passive:true});addEventListener('resize',()=>{restoreSource();origin=null;measure();request();});reduced.addEventListener('change',()=>{restoreSource();origin=null;measure();request();});measure();update();
})();

// Apply stickers from left to right, unfolding their raised paper edge.
(()=>{
 const stickers=[...document.querySelectorAll('.growth-sticker')];if(!stickers.length)return;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 stickers.forEach(sticker=>{
  const face=document.createElement('span');face.className='sticker-face';
  face.textContent=sticker.textContent;sticker.replaceChildren(face);
 });
 const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{
  target.classList.toggle('is-stuck',isIntersecting||reduced.matches);
 }),{threshold:.8,rootMargin:'-150px 0px -12% 0px'});
 stickers.forEach(s=>observer.observe(s));
})();

(()=>{
 const section=document.querySelector('.growth-cascade');if(!section)return;
 const heading=section.querySelector('.growth-tags-heading');
 const measure=()=>{
  section.style.setProperty('--growth-heading-height',`${heading.offsetHeight}px`);
  const title=heading.querySelector('h2'),card=section.querySelector('.growth-cascade-card');
  section.style.setProperty('--growth-number-left',`${title.getBoundingClientRect().left-card.getBoundingClientRect().left}px`);
 };
 const stack=section.querySelector('.growth-cascade-stack');
 const cards=[...stack.querySelectorAll('.growth-cascade-card')];
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let pending=false;
 const release=()=>{
  pending=false;
  const pin=parseFloat(getComputedStyle(section).getPropertyValue('--growth-pin-top'))||92;
  const step=12;
  const last=cards[cards.length-1];
  const bottom=stack.getBoundingClientRect().bottom-parseFloat(getComputedStyle(stack).paddingBottom);
  const shift=reduced.matches?0:Math.min(0,bottom-last.offsetHeight-pin-heading.offsetHeight-(cards.length-1)*step);
  section.style.setProperty('--growth-release',`${shift}px`);
  cards.forEach((card,i)=>{
   const next=cards[i+1];
   const overlap=next?Math.max(0,Math.min(1,1-(next.getBoundingClientRect().top-card.getBoundingClientRect().top)/card.offsetHeight)):0;
   card.style.setProperty('--proof-scale',reduced.matches?'1':String(1-overlap*.025));
   card.style.setProperty('--proof-light',reduced.matches?'1':String(1-overlap*.06));
  });
 };
 const request=()=>{if(!pending){pending=true;requestAnimationFrame(release);}};
 new ResizeObserver(()=>{measure();request();}).observe(heading);measure();release();
 addEventListener('scroll',request,{passive:true});addEventListener('resize',request);
})();

(()=>{
 const section=document.querySelector('.global-cities-section');if(!section)return;
 const heading=section.querySelector('.global-cities-intro');
 const measure=()=>section.style.setProperty('--global-heading-height',`${heading.offsetHeight}px`);
 new ResizeObserver(measure).observe(heading);measure();
})();

// Final Unicorn sequence, independent of previously saved review choices.
(()=>{
 const mask=document.querySelector('.unicorn-mask-section');if(!mask)return;
 const gallery=document.querySelector('[data-floating-gallery]');
 const carousel=document.querySelector('[data-product-carousel]');
 const carouselHome=carousel.parentElement;
 const cards=[...carousel.querySelectorAll('.product-project')];
 const flowSection=document.querySelector('.reimagine-flow');
 const flowStage=flowSection?.querySelector('.reimagine-flow-stage');

 function choose(version){
  const legacy=version==='gallery';
  mask.classList.toggle('is-previous-spread',version==='spread');
  const linked=version==='mask'&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
  mask.classList.toggle('has-linked-flow',linked);
  if(flowStage){(linked?mask.querySelector('.unicorn-mask-stage'):flowSection).append(flowStage);flowSection.hidden=linked;flowStage.style.opacity=linked?'0':'';flowStage.style.removeProperty('--question-enter-y');flowStage.style.removeProperty('--question-enter-opacity');}

  document.body.classList.remove('unicorn-dark-active');mask.classList.remove('is-dark-scene');
  gallery.hidden=!legacy;mask.hidden=legacy;
  (legacy?carouselHome:mask.querySelector('.unicorn-mask-stage')).append(carousel);
  carousel.classList.toggle('unicorn-unfold-carousel',!legacy);
  carouselHome.closest('.unicorn-products').hidden=!legacy;
  if(legacy){document.querySelector('.shared-opening-film').style.opacity='';carousel.style.opacity='';carousel.style.pointerEvents='';carousel.dataset.unfolding='false';cards.forEach(c=>{c.style.transform='';c.style.opacity='';});}

  gallery.id=legacy?'imagination':'imagination-legacy';mask.id=legacy?'imagination-mask':'imagination';
  localStorage.setItem('your-unicorn-section-version',version);
  dispatchEvent(new Event('resize'));
 }
 choose('mask');
 const stage=mask.querySelector('.unicorn-mask-stage');
 const first=mask.querySelector('.unicorn-mask-first'),second=mask.querySelector('.unicorn-mask-second');
 const title=mask.querySelector('.unicorn-mask-title'),english=mask.querySelector('.unicorn-mask-english');
 const productTitle=document.createElement('div');productTitle.className='unicorn-stack-title';
 productTitle.innerHTML='<span>WE CALL THEM</span><span>UNICORN<br>PRODUCTS</span>';stage.append(productTitle);
 function fitTopProductTitle(){
  const font=Math.max(36,Math.min(innerWidth*.042,86));
  productTitle.style.setProperty('font-size',`${font}px`,'important');
  const headline=productTitle.querySelector('span+span');
  const range=document.createRange();range.selectNodeContents(headline);
  const widest=Math.max(0,...Array.from(range.getClientRects(),r=>r.width));
  const mobile=innerWidth<768;
  const available=mobile?Math.max(0,Math.min(stage.clientWidth,innerWidth-48)):Math.max(0,Math.min(Math.max(300,Math.min(innerWidth*.31,640)),innerWidth*.32)-12);
  const fittedWidth=Math.min(widest,available);
  if(widest>available&&widest>0)productTitle.style.setProperty('font-size',`${font*available/widest}px`,'important');
  productTitle.dataset.headlineWidth=String(fittedWidth);
  productTitle.style.setProperty('width',`${mobile?Math.min(innerWidth,stage.clientWidth):fittedWidth}px`,'important');
  const label=productTitle.querySelector('span:first-child');
  label.style.setProperty('width',`${fittedWidth}px`,'important');
  label.style.setProperty('margin-inline','auto','important');
 }
 // Measure the actual display font against the caption column at each viewport size.
 function fitProductCaptions(){
  if(productTitle.classList.contains('is-top')){fitTopProductTitle();return;}
  for(const el of [title,productTitle]){
   el.style.removeProperty('font-size');
   const base=parseFloat(getComputedStyle(el).fontSize),available=el.clientWidth-8;
   if(available<=0)continue;
   const range=document.createRange();range.selectNodeContents(el);
   const widest=Math.max(0,...Array.from(range.getClientRects(),r=>r.width));
   if(widest>available)el.style.setProperty('font-size',`${base*available/widest}px`,'important');
  }
 }
 const captionObserver=new ResizeObserver(fitProductCaptions);captionObserver.observe(stage);
 document.fonts.ready.then(fitProductCaptions);addEventListener('resize',fitProductCaptions);fitProductCaptions();

 const detail=document.createElement('div');detail.className='unicorn-stack-detail';stage.append(detail);
 const detailItems=cards.slice(4,8).map(card=>{
  const item=document.createElement('div');item.className='unicorn-stack-description';
  const back=card.querySelector('.product-face-back');
  if(back){item.append(back.querySelector('h3').cloneNode(true),back.querySelector('p').cloneNode(true));}
  else{item.innerHTML='<h3>CRUNTIN</h3><p>Crunchy + Protein</p>';}
  detail.append(item);return item;
 });
 const reduce=matchMedia('(prefers-reduced-motion:reduce)');
 const clamp=n=>Math.max(0,Math.min(1,n));
 const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
 function sizeCards(){
  if(mask.hidden)return;
  const portrait=innerWidth<768?stableVH()*.52:Math.min((stage.clientWidth-64)*1.15/3.15,stableVH()*.48)*1.5;
  const product=Math.max(306,Math.min(535.5,Math.max(innerWidth*.26775,stableVH()*.36975)));
  let cardH=(portrait+product)/2;
  if(innerWidth<768)cardH=innerWidth*.63*812/637; // 모바일: 영상 카드·제품 카드 공통 크기 — 카드 폭을 화면 폭의 63%로(여백이 넓다는 피드백, 글자 크기는 그대로)
  if(innerWidth<768){ // 3차: 화면이 낮은 휴대폰에서도 헤더와 'WE CALL THEM' 사이 여백(최소 32px)이 남도록 카드 높이를 줄임(비율 유지)
   const gap=parseFloat(getComputedStyle(stage).rowGap)||14,pad=32;
   const avail=stage.clientHeight-productTitle.offsetHeight-detail.offsetHeight-gap*2-pad*2;
   if(avail>0)cardH=Math.max(180,Math.min(cardH,avail));
  }
  stage.style.setProperty('--unicorn-card-height',`${cardH}px`);
  stage.style.setProperty('--unicorn-card-width',`${mask.querySelector('.unicorn-mask-frame').offsetWidth}px`);
 }
 sizeCards();addEventListener('resize',sizeCards);document.fonts.ready.then(sizeCards);
 let railScale=1, spreadClock=null, wasSpread=false, easedProgress=null, lastPaint=0, thirdProgress=0, thirdPassed=false, topTitleMode=false;
 const third=mask.querySelector('.unicorn-mask-third');
 function paint(now=performance.now()){
  if(mask.hidden)return;
  const frame=mask.querySelector('.unicorn-mask-frame');
  const rect=mask.getBoundingClientRect(),top=parseFloat(getComputedStyle(stage).top)||0;
  // preview: hold the scroll at p=.27 for ~1.1 screens to show the third line, then continue as before
  const scrolledPx=top-rect.top,totalPx=Math.max(1,mask.offsetHeight-stage.offsetHeight);
  const plateauPx=mask.classList.contains('has-linked-flow')&&!mask.classList.contains('is-previous-spread')?stableVH()*(innerWidth<768?.7:1.1):0; // 모바일은 'WHAT IS A UNICORN' 멈춤 구간을 약 2/3로(너무 오래 머문다는 피드백)
  const baseTotal=Math.max(1,totalPx-plateauPx),r0=(mask.classList.contains('has-linked-flow')?.58:1)*.27,startPx=r0*baseTotal;
  thirdProgress=plateauPx?clamp((scrolledPx-startPx)/plateauPx):0; thirdPassed=plateauPx&&scrolledPx>startPx;
  const target=clamp(scrolledPx<startPx?scrolledPx/baseTotal:scrolledPx<startPx+plateauPx?r0:(scrolledPx-plateauPx)/baseTotal);
  const dt=Math.min(50,Math.max(1,now-lastPaint));lastPaint=now;
  if(easedProgress===null||reduce.matches||stepScroll.enabled()||Math.abs(target-easedProgress)>.18)easedProgress=target; // 모바일 스텝 이동은 트윈 자체가 감속 곡선이라 지연 보정을 겹치지 않는다
  else easedProgress+=(target-easedProgress)*(1-Math.exp(-dt/70));
  const raw=Math.abs(target-easedProgress)<.00005?target:easedProgress;
  if(raw!==target)request();
  const linked=mask.classList.contains('has-linked-flow');
  const p=linked?clamp(raw/.58):raw;
  const handoff=linked?smooth((raw-.54)/.06):0;
  const railOut=linked?smooth((raw-.54)/.03):0,stageIn=linked?smooth((raw-.57)/.03):0; // 3차: 카드가 완전히 사라진 뒤 다음 장면(HOW IS IT DONE?) 등장 — 겹쳐 비치지 않게
  if(linked&&flowStage){
   const textEnter=smooth((raw-.572)/.028);
   flowStage.style.opacity=stageIn;flowStage.style.pointerEvents=handoff===1?'auto':'none';
   flowStage.style.setProperty('--question-enter-y',`${24*(1-textEnter)}px`);
   flowStage.style.setProperty('--question-enter-opacity',textEnter);
  }
  const darkScene=!mask.classList.contains('is-previous-spread')&&(p>=.272||thirdPassed); // preview: dark from the 'WE CALL THEM UNICORN PRODUCTS' phase (was .68)
  mask.classList.toggle('is-dark-scene',darkScene);
  mask.classList.toggle('is-third-phase',darkScene&&thirdPassed&&p<.3); // preview: keep the film visible behind the third line
  const manifesto=document.querySelector('.reimagine-flow')?.getBoundingClientRect();
  document.body.classList.toggle('unicorn-dark-active',(darkScene&&rect.bottom>top+80)||!!(manifesto&&manifesto.top<=top+80&&manifesto.bottom>top+80));
  const entrance=reduce.matches?1:innerWidth<768?smooth((top-rect.top)/(stableVH()*.3)):smooth((stableVH()*.7-rect.top)/(stableVH()*.5)); // 모바일: 영상이 카드로 다 줄어든 뒤(섹션이 헤더 아래 고정된 순간부터) 제목·영어 문장이 나타나게 — 커다란 영상 위에 글씨가 겹치는 순간 제거
  title.querySelectorAll('.unicorn-title-line>span').forEach((line,i)=>{
   const reveal=reduce.matches?1:smooth((entrance-i*.22)/(1-i*.22));
   line.style.transform=`translateY(${105*(1-reveal)}%)`;
  });
  english.querySelectorAll('.unicorn-english-line>span').forEach((line,i)=>{
   const delay=i*.11;
   const reveal=reduce.matches?1:smooth((entrance-delay)/(1-delay));
   line.style.transform=`translateY(${105*(1-reveal)}%)`;
  });
  if(mask.classList.contains('is-previous-spread')){
   const spread=reduce.matches?1:smooth((p-.64)/.29);
   title.style.opacity=1-smooth((p-.58)/.14);
   english.style.opacity=1-smooth((p-.58)/.14);
   first.style.opacity=smooth(p/.15)*(1-smooth((p-.26)/.12));
   second.style.opacity=smooth((p-.36)/.15)*(1-smooth((p-.59)/.1));
   carousel.style.top=`${frame.offsetTop}px`;carousel.style.left=`${-stage.getBoundingClientRect().left}px`;
   carousel.style.width=`${innerWidth}px`;carousel.style.transform='none';
   stage.style.setProperty('--unicorn-rail-top',`${frame.offsetTop}px`);stage.style.setProperty('--unicorn-rail-bottom',`${frame.offsetTop+frame.offsetHeight}px`);
   mask.querySelectorAll('.unicorn-products-top,.unicorn-products-bottom').forEach(el=>el.style.opacity=smooth((p-.72)/.18));
   const width=innerWidth*(innerWidth>=1440?.3:.38)*.68,gap=innerWidth*20.4/1400;
   carousel.style.setProperty('--project-width',`${width}px`);carousel.style.setProperty('--project-gap',`${gap}px`);
   carousel.style.opacity=smooth((p-.63)/.09);carousel.style.pointerEvents=spread===1?'auto':'none';
   carousel.classList.toggle('is-spread',spread===1);carousel.dataset.unfolding=String(spread<1);
   if(spread<1&&wasSpread)setRailOffset(0);wasSpread=spread===1;
   if(spread<1)carousel.querySelector('.product-carousel-track').style.transform=`translate3d(${gap-4*(width+gap)}px,0,0)`;
   cards.forEach((card,i)=>{card.style.opacity=spread<1&&(i<4||i>7)?'0':'';card.style.transform=spread<1?`translateX(${(innerWidth/2-(gap+(i-4)*(width+gap)+width/2))*(1-spread)}px)`:'';});
   mask.querySelector('.unicorn-mask-copy').style.opacity=1-smooth((p-.67)/.13);
   document.querySelector('.shared-opening-film').style.opacity=1-smooth((p-.67)/.13);
   return;
  }
  const change=reduce.matches?1:smooth((p-.275)/.035);
  const definitionExit=reduce.matches?1:smooth((p-.23)/.035);
  let spread=reduce.matches?1:smooth((p-.70)/.045);
  // 모바일 펼침은 스크롤 위치를 따라가지 않는다(디자이너 요청): 넷째 카드가 다 도착한 지점(p .745)을 지나면 1초 동안 끝까지 펼쳐지고,
  // 그 위로 되돌아가면 같은 방식으로 다시 접힌다. 스크롤 중간에 멈춰도 반쯤 펼쳐진 채 남지 않는다.
  if(innerWidth<768&&!reduce.matches){
   const goal=p>=.745?1:0;
   if(spreadClock===null)spreadClock=goal;
   else if(spreadClock!==goal){spreadClock=goal>spreadClock?Math.min(goal,spreadClock+dt/1000):Math.max(goal,spreadClock-dt/1000);if(spreadClock!==goal)request();}
   spread=smooth(spreadClock);
  }
  title.style.opacity=1-definitionExit;
  english.style.opacity=1-definitionExit;
  productTitle.classList.remove('is-top');
  productTitle.style.opacity=String(change*(1-railOut)); // 카드와 함께 사라짐(제목만 남는 빈 화면 방지)
  productTitle.style.transform='none';
  detail.style.opacity=String(change*(1-smooth((p-.66)/.05))*(1-handoff)); // 제품 설명(쌓인 카드 옆): 카드가 펼쳐지기 직전까지 표시
  first.style.opacity=reduce.matches?0:smooth(p/.07)*(1-smooth((p-.10)/.035));
  second.style.opacity=reduce.matches?0:smooth((p-.14)/.04)*(1-smooth((p-.24)/.04));
  if(third){const t=thirdProgress;third.style.opacity=reduce.matches?0:smooth(t/.18)*(1-smooth((t-.82)/.18));
   if(thirdPassed)second.style.opacity=String(+second.style.opacity*(1-smooth(t/.12)));}
  first.style.transform=second.style.transform='none';
  carousel.style.top=`${frame.offsetTop}px`;
  const stageLeft=stage.getBoundingClientRect().left;
  const safeTitleRail=productTitle.getBoundingClientRect().right+24;
  const railTarget=innerWidth<768?0:Math.max(Math.min(760,Math.max(300,innerWidth*.355)),safeTitleRail);
  const railStart=railTarget*spread;
  carousel.style.left=`${railStart-stageLeft}px`;
  carousel.style.width=`${Math.max(0,innerWidth-railStart)}px`;
  carousel.style.setProperty('--unfold-origin',`${frame.getBoundingClientRect().left*(1-spread)}px`);
  carousel.style.transform='none';
  carousel.style.setProperty('--project-width',`${frame.offsetWidth}px`);
  carousel.style.setProperty('--project-gap','24px');
  // 모바일 펼침(11/4 디자이너 시안): 넷째 카드(크런틴)는 제자리에 남고 나머지 카드가 그 뒤에서 좌우로 나온다.
  // 펼칠수록 제목을 키우고(CSS --spread) 카드도 키워, 제목+카드 묶음을 화면 세로 가운데에 둔다(아래 검은 여백 축소).
  const mobileRail=innerWidth<768;
  railScale=1;
  if(mobileRail){
   productTitle.style.setProperty('--spread',spread.toFixed(4));
   const w=frame.offsetWidth,h=frame.offsetHeight,S=stage.clientHeight,th=productTitle.offsetHeight,gapY=40;
   const kMax=Math.min(1.1,(innerWidth-40)/(w+48)); // 펼침 카드 최대 1.1배(디자이너 요청으로 1.2→1.1), 좌우 다음 카드가 20px 이상 보이게
   const k1=Math.max(1,Math.min(kMax,(S-80-th-gapY)/h));
   const top1=Math.max(0,(S-(th+gapY+h*k1))/2);
   railScale=1+(k1-1)*spread;
   productTitle.style.transform=`translateY(${((top1-productTitle.offsetTop)*spread).toFixed(2)}px)`;
   carousel.style.top=`${frame.offsetTop+(top1+th+gapY-frame.offsetTop)*spread}px`;
   carousel.style.transformOrigin='50% 0';
   carousel.style.transform=`scale(${railScale.toFixed(4)})`;
   carousel.style.setProperty('--unfold-origin',`${frame.getBoundingClientRect().left-3*(w+24)}px`); // 크런틴(레일 8번째)을 쌓인 자리에 고정
  }
  carousel.style.opacity=1-railOut; // 카드 레일은 계속 보이고 제목 영역을 비운 오른쪽으로 펼쳐진다
  carousel.style.pointerEvents=spread===1&&handoff<.6?'auto':'none'; // 3차: 카드가 보이는 동안은 호버(뒤집기) 가능
  carousel.dataset.unfolding=String(spread<1);
  carousel.classList.toggle('is-spread',spread===1);
  if(spread<1&&wasSpread)setRailOffset(0);
  wasSpread=spread===1;
  const arriveSpan=innerWidth<768?.075:.1; // 모바일: 다음 카드가 출발하기 전에 이전 카드 도착을 끝내 정지점마다 카드·설명이 온전히 보이게
  const firstIntroRaw=clamp((p-.28)/.14); // 3차: 제목이 뜨는 순간 첫 카드도 올라오기 시작 — 제목만 덩그러니 남는 빈 화면 제거
  const firstIntro=1-Math.pow(1-firstIntroRaw,3.2);
  cards.forEach((card,i)=>{
   if(mobileRail&&(i<4||i>7)){ // 모바일: 오른쪽 반복 카드도 크런틴 뒤에서 오른쪽으로 펼쳐진다
    card.style.opacity=String(smooth(spread/.3));card.style.filter='';
    card.style.transform=i>7&&spread<1?`translate3d(${-(i-7)*(frame.offsetWidth+24)*(1-spread)}px,0,0)`:'';return;
   }
   if(i<4||i>7){card.style.opacity=spread===1?'1':'0';card.style.transform='';card.style.filter='';return;} // 반복 세트는 레일이 오른쪽에 고정된 뒤에만 표시해 왼쪽 제목 영역을 비운다
   // preview: first card rises while the third line fades out (no blank gap), with a long decelerating glide
   const j=i-4,lead=j===0&&plateauPx>0;
   const arrival=reduce.matches?1:lead?firstIntro:smooth((p-(.42+j*.08))/arriveSpan);
   const covered=j<2?smooth((p-(.42+(j+1)*.08))/arriveSpan):0;
   const rise=lead?Math.min(340,stableVH()*.42):Math.min(180,stableVH()*.22);
   card.style.transform=`translate3d(${(mobileRail?3-j:-j)*(frame.offsetWidth+24)*(1-spread)}px,${(1-arrival)*rise-covered*12*(1-spread)}px,0) rotate(${[-1.5,1,-1,1.5][j]*(1-spread)*(lead?arrival:1)}deg) scale(${1-(1-arrival)*(lead?.08:.06)-covered*.035*(1-spread)})`;
   card.style.opacity=lead?smooth(firstIntroRaw/.45):smooth(arrival/.25);
   if(lead)card.style.filter=arrival<.999&&window.innerWidth>=768?`blur(${(5*(1-arrival)).toFixed(2)}px)`:''; // 모바일은 블러 생략(떨림·끊김 방지)
   card.style.zIndex=String(j+1);
   const fadeOut=j>=2?1:1-smooth((p-(.42+(j+1)*.08))/.035);
   detailItems[j].style.opacity=j===3?0:smooth((arrival-.6)/.4)*fadeOut;
   detailItems[j].style.transform=`translateY(${(1-arrival)*12}px)`;
  });
  mask.querySelector('.unicorn-mask-copy').style.opacity=1-change;
  const media=document.querySelector('.shared-opening-film');
  if(media)media.style.opacity=1-smooth((p-.30)/.05);
 }
 let railOffset=0;
 const railCycle=()=>{const w=parseFloat(carousel.style.getPropertyValue('--project-width'))||0,g=parseFloat(carousel.style.getPropertyValue('--project-gap'))||0;return (w+g)*cards.length/3;};
 function setRailOffset(value){
  const track=carousel.querySelector('.product-carousel-track');
  const cycle=railCycle();
  railOffset=cycle?((value%cycle)+cycle)%cycle:0; // 3차: 한 세트 길이로 순환 → 끝없이 이어짐
  if(innerWidth<768&&railOffset>0)railOffset-=cycle; // 모바일은 왼쪽으로 흐르므로 (-한 세트, 0] 범위를 써서 오른쪽 끝 카드가 비지 않게
  track.style.translate=`${-railOffset}px 0`;
 }
 // 펼쳐진 상태에서 자동으로 오른쪽으로 흐르며, 드래그/호버 중에는 멈춘다.
 let railHover=false,railLast=0;
 carousel.addEventListener('pointerenter',()=>{railHover=true});carousel.addEventListener('pointerleave',()=>{railHover=false});
 carousel.addEventListener('wheel',event=>{
  if(mask.hidden||mask.classList.contains('is-previous-spread')||!wasSpread)return;
  const distance=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:(event.shiftKey?event.deltaY:0);
  if(!distance)return;
  event.preventDefault();setRailOffset(railOffset-distance);
 },{passive:false});
 (function flow(now){
  requestAnimationFrame(flow);
  const dt=railLast?Math.min(50,now-railLast):0;railLast=now;
  if(!wasSpread||mask.hidden||mask.classList.contains('is-previous-spread')||document.hidden||drag||railHover||reduce.matches)return;
  const r=carousel.getBoundingClientRect();if(r.bottom<0||r.top>stableVH())return;
  const w=parseFloat(carousel.style.getPropertyValue('--project-width'))||0,g=parseFloat(carousel.style.getPropertyValue('--project-gap'))||0;
  setRailOffset(railOffset+(innerWidth<768?1:-1)*dt*((w+g)/6000)); // 모바일: 크런틴 다음에 쉐이크·초코팝·감자칩 순서로 오도록 왼쪽으로 흐름
 })(performance.now());
 let drag=null;
 carousel.addEventListener('pointerdown',event=>{if(!mask.hidden&&!mask.classList.contains('is-previous-spread')&&wasSpread&&event.button===0){drag={x:event.clientX,left:railOffset};carousel.setPointerCapture(event.pointerId);}});
 carousel.addEventListener('pointermove',event=>{if(drag)setRailOffset(drag.left+(drag.x-event.clientX)/railScale);});
 const stop=()=>{drag=null;};carousel.addEventListener('pointerup',stop);carousel.addEventListener('pointercancel',stop);
 let queued=false;function request(){if(!queued){queued=true;requestAnimationFrame(now=>{queued=false;paint(now);});}};
 // 모바일 스텝 스크롤 정지점: 메시지·카드가 완전히 보이는 진행률을 paint()의 진행률 계산을 거꾸로 풀어 scrollY 로 바꾼다.
 // mask 진행률 p(=raw/.58): 첫 문장, 둘째 문장, (셋째 문장은 멈춤 구간 가운데), 제품 카드 1~3, 펼침
 // 질문 장면 fp(멈춤 구간 없이 선형 진행률 .60+.40*fp — reimagine paint 기준): HOW IS IT DONE?, HOW SHOULD IT BE DONE?, MAKE IT 카드 1~3, 펼침+국문
 // 넷째 카드(크런틴)에서는 멈추지 않고 셋째 카드에서 한 번에 펼침까지 이어진다(디자이너 요청). 크런틴 도착은 이동 중에 지나간다.
 stepScroll.register(()=>{
  if(mask.hidden||!mask.classList.contains('has-linked-flow')||mask.classList.contains('is-previous-spread'))return [];
  const top=parseFloat(getComputedStyle(stage).top)||0;
  const origin=mask.getBoundingClientRect().top+scrollY-top;
  const totalPx=Math.max(1,mask.offsetHeight-stage.offsetHeight);
  const plateauPx=stableVH()*(innerWidth<768?.7:1.1);
  const baseTotal=Math.max(1,totalPx-plateauPx),r0=.58*.27,startPx=r0*baseTotal;
  const at=raw=>origin+(raw<r0?raw*baseTotal:raw*baseTotal+plateauPx);
  return [0,
   ...[.085,.21].map(p=>at(p*.58)),
   origin+startPx+plateauPx*.5,
   ...[.46,.577,.657,.80].map(p=>at(p*.58)),
   ...[.14,.39,.585,.63,.675,.84].map(fp=>origin+(.60+.40*fp)*totalPx)];
 });
 addEventListener('scroll',request,{passive:true});addEventListener('resize',request);reduce.addEventListener('change',request);paint();
})();

// Questions unfold into a keyword rail, then gather as a stack.
(()=>{
 const section=document.querySelector('.reimagine-flow');if(!section)return;
 const stage=document.querySelector('.reimagine-flow-stage');
 const current=stage.querySelector('.question-current'),better=stage.querySelector('.question-better');
 const dontSlot=current.querySelector('.question-dont-slot'),dont=current.querySelector('.question-dont');
 const sentence=current.querySelector('.question-sentence');
 const wordSlots=['is','should','be'].map(name=>sentence.querySelector('.word-'+name));
 const how=stage.querySelector('.flow-how'),categories=stage.querySelector('.flow-categories'),right=stage.querySelector('.reimagine-flow-right');
 const rail=stage.querySelector('.reimagine-flow-cards'),cards=[...rail.children];
 const repeated=[];
 const flavors=['01','02','03','04','08','09','10','11']; // 10/19: Figma 'MAKE IT' cards, left to right with the 3 base cards as 05-07.
 [-5,-4,-3,-2,2,3,4,5].forEach((slot,i)=>{const copy=cards[0].cloneNode(false);copy.classList.add('flow-repeat');copy.setAttribute('aria-hidden','true');copy.removeAttribute('id');const img=document.createElement('img');img.src='/product-media/make-it-'+flavors[i]+'.jpg';img.alt='';img.className='flow-flavor-original';const heading=document.createElement('h3');heading.append('MAKE IT',document.createElement('br'),i<4?'FUN.':i<6?'CRAVEABLE.':'CRUNCHY.');copy.append(img,heading);rail.append(copy);repeated.push({card:copy,slot});});
 const korean=stage.querySelector('.reimagine-flow-korean');
 let rollStart=0,rollFrame=0,turnAcc=0,lastTick=0; // 3차: 흐름 위치를 누적해 멈췄다 다시 돌 때 튀지 않게
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const clamp=n=>Math.max(0,Math.min(1,n));
 const ease=n=>{const p=clamp(n);return p*p*(3-2*p);};
 function paint(){
  if(reduced.matches)return;
  const linked=stage.closest('.has-linked-flow');
  const bounds=(linked||section).getBoundingClientRect();
  const sticky=linked?linked.querySelector('.unicorn-mask-stage'):stage;
  const top=parseFloat(getComputedStyle(sticky).top)||0;
  const raw=clamp((top-bounds.top)/Math.max(1,(linked||section).offsetHeight-sticky.offsetHeight));
  const p=linked?clamp((raw-.60)/.40):raw;
  const exit=ease((p-.42)/.12);
  const drop=ease((p-.18)/.12),close=ease((p-.23)/.13);
  current.style.opacity=1-exit;
  // preview: pin the sentence's left edge to the product card's left edge (no sideways drift while it appears or morphs)
  let shift=0;const cardFrame=linked&&linked.querySelector('.unicorn-mask-frame');
  if(cardFrame){current.style.transition='none';current.style.transform='none';const keep=sentence.style.transform;sentence.style.transform='none';shift=cardFrame.getBoundingClientRect().left-sentence.getBoundingClientRect().left;if(innerWidth<=700){const pr=current.querySelector('.question-prefix').getBoundingClientRect(),st=stage.getBoundingClientRect(),lines=[...sentence.querySelectorAll('.question-sentence-line')].map(l=>l.getBoundingClientRect()),sl=Math.min(...lines.map(r=>r.left)),srr=Math.max(...lines.map(r=>r.right));shift=(st.left+st.width/2)-((Math.min(pr.left,sl)+srr)/2);} // 3차: 모바일은 그룹 전체를 중앙에(왼쪽 잘림 방지)
sentence.style.transform=keep;}
  current.style.transform=shift||centerY?`translate(${shift.toFixed(2)}px,${centerY.toFixed(2)}px)`:'none';
  sentence.style.transform='none'; // preview: just fade out, no sideways slide
  current.querySelector('.question-prefix-morph').style.visibility=p>=.44?'hidden':'';
  dont.style.transform=`translateY(${28*drop}px)`;
  dont.style.opacity=1-ease((p-.20)/.10);
  dontSlot.style.width=`${dont.offsetWidth*(1-close)}px`;
  better.style.opacity=0;better.style.transform='none';
  const remove=ease((p-.18)/.10);
  const should=ease((p-.23)/.13),be=ease((p-.25)/.13);
  wordSlots.forEach((slot,i)=>{
   const word=slot.firstElementChild;
   const reveal=[1-remove,should,be][i];
   slot.style.width=`${word.offsetWidth*reveal}px`;
   word.style.opacity=reveal;
   word.style.transform=`translateY(${28*(1-reveal)}px)`;
  });
  rail.style.opacity=1;
  how.style.opacity=0;
  const spread=ease((p-.68)/.14),caption=ease((p-.72)/.10);
  categories.style.opacity=caption;right.style.opacity=caption*(1-spread);right.style.display=caption*(1-spread)<.02?'none':'';right.style.transform='none';korean.style.opacity=caption; // 3차: 오른쪽 캡션은 숨겨지면 레이아웃에서도 빠져 가운데 정렬
  const rolling=p>.82&&bounds.bottom>top+sticky.offsetHeight*.65;
  if(rolling){const now=performance.now();if(lastTick)turnAcc+=Math.min(50,now-lastTick)/6000;lastTick=now;} // 회전 속도 완화(슬롯당 6s), 탭 복귀 시 점프 방지(프레임 간격 50ms 상한)
  else{lastTick=0;if(p<.74)turnAcc=0;} // 멈추면 그 자리에 고정, 카드가 사라진 뒤에만 초기화
  const turn=turnAcc;
  const gap=cards[0].offsetWidth+Math.max(14,Math.min(36,innerWidth*.02)); // preview: tighter MAKE IT spacing (was 24..60, 3.3vw)
  const items=[...cards.map((card,i)=>({card,slot:i-1,index:i})),...repeated];
  items.forEach(({card,slot:initial,index})=>{
   const arrival=index===undefined?ease((p-.74)/.08):innerWidth<768?ease((p-(.54+index*.045))/.045):ease((p-(.42+index*.045))/.08); // 모바일: 질문 문구가 사라진 뒤 카드가 한 장씩 겹치지 않게 도착(스텝 정지점 .585/.63/.675)
   const slot=rolling?((initial-turn+11005.5)%11)-5.5:initial;
   card.style.opacity=arrival;
   card.style.transform=`translateX(${slot*gap*spread}px) translateY(${80*(1-arrival)}px) rotate(${index===undefined?0:[0,3,-3][index]*arrival*(1-spread)}deg)`;
  });
  if(rolling&&!rollFrame)rollFrame=requestAnimationFrame(()=>{rollFrame=0;paint()});

 }
 // 모바일: 고정 스테이지(100svh 기준) 아래쪽이 실제 보이는 영역 밖으로 나가는 브라우저에서는 질문을 보이는 부분의 세로 가운데로 올린다.
 // 스크롤마다가 아니라 크기가 바뀔 때만 계산한다(Safari·Chrome 에서는 스테이지가 보이는 영역 안이라 0).
 let centerY=0;
 const measureCenter=()=>{
  const sticky=stage.closest('.unicorn-mask-stage');
  if(!sticky||innerWidth>=768){centerY=0;return;}
  const top=parseFloat(getComputedStyle(sticky).top)||0,bottom=top+sticky.offsetHeight;
  const visible=Math.min(bottom,window.visualViewport?.height||innerHeight);
  centerY=Math.min(0,(top+visible)/2-(top+bottom)/2);
 };
 measureCenter();
 let queued=false;const request=()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;paint();});}};
 addEventListener('scroll',request,{passive:true});addEventListener('resize',()=>{measureCenter();request();});reduced.addEventListener('change',()=>{[current,better,dont,how,categories,right,korean,rail,...cards,current.querySelector('.question-motion')].forEach(e=>{e.style.opacity='';e.style.transform='';});dontSlot.style.width='';wordSlots.forEach(slot=>{slot.style.width='';slot.firstElementChild.style.opacity='';slot.firstElementChild.style.transform='';});request();});paint();
})();

// Reveal the culture statement in sync with scroll, with a blinking caret.
(()=>{
 const section=document.querySelector('.culture-typing');if(!section)return;
 const output=section.querySelector('.culture-typed');
 const characters=Array.from(section.querySelector('.culture-typing-box').getAttribute('aria-label'));
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let pending=false,last=-1;
 const paint=()=>{
  pending=false;
  const progress=Math.max(0,Math.min(1,(stableVH()*.5-section.getBoundingClientRect().top)/(stableVH()*.3)));
  const count=reduced.matches?characters.length:Math.floor(progress*characters.length);
  document.body.classList.toggle('culture-typing-complete',count===characters.length);
  if(count!==last){output.textContent=characters.slice(0,count).join('');last=count;}
 };
 const request=()=>{if(!pending){pending=true;requestAnimationFrame(paint);}};
 addEventListener('scroll',request,{passive:true});addEventListener('resize',request);reduced.addEventListener('change',request);paint();
})();

// Keep the editorial column on the actual Company navigation start line.
(()=>{
 if(!document.body.matches('.page-company,.page-culture'))return;
 const nav=document.querySelector('.desktop-nav a[href="/"]');
 if(!nav)return;
 const grids=[...document.querySelectorAll('main .editorial-heading,main .growth-tags-heading,.culture-opening,.culture-typing-stage,.vision-section,.join-bottom,.culture-principle-row')];
 const context=document.querySelector('.culture-team-context');
 const align=()=>{
  if(innerWidth<768)return;
  const navRect=nav.getBoundingClientRect();
  const left=navRect.width?navRect.left:innerWidth*.36;
  for(const element of grids){
   const inset=parseFloat(getComputedStyle(element).paddingLeft)||0;
   const start=element.getBoundingClientRect().left+(element.matches('.join-bottom')?0:inset);
   element.style.setProperty('--nav-aligned-column',`${Math.max(0,left-start)}px`);
  }
  const talentControls=document.querySelector('.talents-section .growth-tags-controls');
  const talentTitle=document.querySelector('.talent-tags-heading h2');
  if(talentControls&&talentTitle){
   talentControls.style.setProperty('--talent-controls-inset',`${Math.max(0,talentTitle.getBoundingClientRect().left-talentControls.getBoundingClientRect().left)}px`);
  }
  if(context){
   const parent=context.parentElement;
   const start=parent.getBoundingClientRect().left+(parseFloat(getComputedStyle(parent).paddingLeft)||0);
   context.style.setProperty('--nav-aligned-column',`${Math.max(0,left-start)}px`);
  }
 };
 new ResizeObserver(align).observe(document.querySelector('.header-bar'));
 addEventListener('resize',align);
 document.fonts.ready.then(align);
 align();
})();

// Reveal each principle's explanation progressively as it crosses the viewport.
(()=>{
 const paragraphs=[...document.querySelectorAll('.culture-principle-reveal')];
 if(!paragraphs.length)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const items=paragraphs.map(element=>({element,words:[...element.querySelectorAll('span')]}));
 let queued=false;
 const paint=()=>{
  queued=false;
  for(const {element,words} of items){
   // Start heading typing at the viewport center, then reveal the body.
   const heading=element.closest('.culture-principle-copy').querySelector('h3');
   const progress=reduced.matches?1:Math.max(0,Math.min(1,(stableVH()*.3-heading.getBoundingClientRect().top)/(stableVH()*.25)));
   const filled=Math.floor(progress*words.length);
   words.forEach((word,i)=>{word.style.opacity=i<filled?'1':'.18';});
  }
 };
 const request=()=>{if(!queued){queued=true;requestAnimationFrame(paint);}};
 addEventListener('scroll',request,{passive:true});addEventListener('resize',request);reduced.addEventListener('change',request);paint();
})();

// Type principle headings from a bare caret, preserving the two-line layout.
(()=>{
 const headings=[...document.querySelectorAll('.culture-principle-copy h3')];
 if(!headings.length)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const items=headings.map(element=>{
  const text=[...element.childNodes].map(node=>node.nodeName==='BR'?'\n':node.textContent).join('');
  element.setAttribute('aria-label',text.replace(/\n/g,' '));
  const output=document.createElement('span');
  output.setAttribute('aria-hidden','true');
  element.replaceChildren(output);
  element.classList.add('principle-typing-title');
  return {element,output,characters:Array.from(text),last:-1};
 });
 let queued=false;
 const paint=()=>{
  queued=false;
  for(const item of items){
   const progress=Math.max(0,Math.min(1,(stableVH()*.5-item.element.getBoundingClientRect().top)/(stableVH()*.2)));
   const count=reduced.matches?item.characters.length:Math.floor(progress*item.characters.length);
   if(count!==item.last){item.output.textContent=item.characters.slice(0,count).join('');item.last=count;}
  }
 };
 const request=()=>{if(!queued){queued=true;requestAnimationFrame(paint);}};
 addEventListener('scroll',request,{passive:true});
 addEventListener('resize',request);
 reduced.addEventListener('change',request);
 paint();
})();

// Align benefit grids with their label and the header's round arrow button.
(()=>{
 const section=document.querySelector('.page-culture #benefits');
 const label=section?.querySelector('.culture-section-heading>p');
 const arrow=document.querySelector('.header-apply b');
 if(!label||!arrow)return;
 const align=()=>{
  if(innerWidth<768){section.style.removeProperty('--benefit-left');section.style.removeProperty('--benefit-right');return;}
  const bounds=section.getBoundingClientRect();
  const style=getComputedStyle(section);
  const start=bounds.left+parseFloat(style.paddingLeft);
  const end=bounds.right-parseFloat(style.paddingRight);
  section.style.setProperty('--benefit-left',`${Math.max(0,label.getBoundingClientRect().left-start)}px`);
  section.style.setProperty('--benefit-tabs-left',`${Math.max(0,section.querySelector('.culture-section-heading h2').getBoundingClientRect().left-start)}px`);
  section.style.setProperty('--benefit-right',`${Math.max(0,end-arrow.getBoundingClientRect().right)}px`);
  const teamList=document.querySelector('.page-culture .team-list');
  if(teamList){
   const parent=teamList.parentElement;
   const rect=parent.getBoundingClientRect(),css=getComputedStyle(parent);
   teamList.style.setProperty('--team-left',`${Math.max(0,label.getBoundingClientRect().left-rect.left-parseFloat(css.paddingLeft))}px`);
   teamList.style.setProperty('--team-right',`${Math.max(0,rect.right-parseFloat(css.paddingRight)-arrow.getBoundingClientRect().right)}px`);
  }
 };
 new ResizeObserver(align).observe(document.querySelector('.header-bar'));
 addEventListener('resize',align);document.fonts.ready.then(align);align();
})();


// Align and size the fixed statement to the Culture reading column.
(()=>{
 const statement=document.querySelector('.culture-fixed-statement');
 const copy=document.querySelector('.culture-principle-reveal');
 if(!statement||!copy)return;
 const fit=()=>{
  const left=innerWidth<768?20:innerWidth*.05;
  statement.style.left=`${left}px`;
  statement.style.right=`${left}px`;
  const measure=statement.cloneNode(false);
  measure.replaceChildren(...'WE IMAGINE WHAT SHOULD EXIST'.split(' ').flatMap((word,i)=>{
   const span=document.createElement('span');span.textContent=word;
   return i?[document.createTextNode(' '),span]:[span];
  }));
  Object.assign(measure.style,{fontSize:'100px',width:'max-content',left:'0',right:'auto',visibility:'hidden',transition:'none'});
  document.body.append(measure);
  const width=measure.getBoundingClientRect().width;
  measure.remove();
  if(width)statement.style.fontSize=`${98*statement.clientWidth/width}px`;
 };
 addEventListener('resize',fit);
 document.fonts.ready.then(fit);
 new ResizeObserver(fit).observe(copy);
 fit();
})();

// Reveal the rounded header silhouette once Culture reaches its white sections.
(()=>{
 const boundary=document.querySelector('.page-culture .talents-section');
 if(!boundary)return;
 const update=()=>{
  const top=boundary.getBoundingClientRect().top;
  document.body.classList.toggle('culture-light-section',top<=92);
  const statement=document.querySelector('.culture-fixed-statement');
  if(statement){
   const progress=Math.max(0,Math.min(1,(top-stableVH())/Math.max(160,stableVH()*.22)));
   const opacity=progress*progress*(3-2*progress);
   statement.style.setProperty('--statement-visibility',opacity);
   statement.style.setProperty('--statement-exit-y',`${(1-opacity)*10}px`);
  }
 };
 addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();
})();

// Change the brand statement at the second chapter's center trigger.
(()=>{
 const question=document.querySelector('#culture-real-question');
 const statement=document.querySelector('.culture-fixed-statement');
 if(!question||!statement)return;
 let previous=null;
 const update=()=>{
  const real=question.getBoundingClientRect().top<=stableVH()*.72;
  if(real===previous)return;previous=real;
  statement.classList.add('statement-entering');
  statement.replaceChildren(...(real?'AND WE MAKE IT REAL':'WE IMAGINE WHAT SHOULD EXIST').split(' ').flatMap((word,i)=>{
   const span=document.createElement('span');span.textContent=word;span.style.setProperty('--word',i);
   return i?[document.createTextNode(' '),span]:[span];
  }));
  const measure=statement.cloneNode(false);
  measure.replaceChildren(...'WE IMAGINE WHAT SHOULD EXIST'.split(' ').flatMap((word,i)=>{
   const span=document.createElement('span');span.textContent=word;
   return i?[document.createTextNode(' '),span]:[span];
  }));
  Object.assign(measure.style,{fontSize:'100px',width:'max-content',left:'0',right:'auto',visibility:'hidden',transition:'none'});
  document.body.append(measure);
  const width=measure.getBoundingClientRect().width;
  measure.remove();
  if(width)statement.style.fontSize=`${98*statement.clientWidth/width}px`;
  void statement.offsetWidth;
  requestAnimationFrame(()=>requestAnimationFrame(()=>statement.classList.remove('statement-entering')));
 };
 addEventListener('scroll',update,{passive:true});update();
})();

// Stamp at the pointer and interpolate a continuous trail while dragging.
document.querySelectorAll('.join-banner').forEach(banner=>{
 const button=banner.querySelector('.join-unicorn-play');
 if(!button)return;
 const svg=button.querySelector('svg'),stamps=svg.querySelector('.unicorn-stamps');
 const outline=svg.querySelector('.unicorn-fill').getAttribute('d');
 let count=0;

 const stampAt=(screenX,screenY)=>{
  count++;
  const matrix=svg.getScreenCTM();
  if(!matrix)return;
  const point=new DOMPoint(screenX-16,screenY-14).matrixTransform(matrix.inverse());
  const scale=32/238/Math.hypot(matrix.a,matrix.b);
  const stamp=document.createElementNS('http://www.w3.org/2000/svg','path');
  stamp.setAttribute('d',outline);stamp.setAttribute('fill','white');
  stamp.setAttribute('transform',`translate(${point.x} ${point.y}) scale(${scale})`);
  stamp.classList.add('unicorn-stamp');stamps.append(stamp);
  button.setAttribute('aria-label',`유니콘 도장 찍기, ${count}개 찍힘`);
  banner.querySelector('.unicorn-fill-status').textContent=`유니콘 도장 ${count}개`;

 };
 let pointer=null,last=null;
 banner.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('a')||pointer!==null)return;
  pointer=event.pointerId;last={x:event.clientX,y:event.clientY};
  banner.setPointerCapture(pointer);
  stampAt(last.x,last.y);
 });
 banner.addEventListener('pointermove',event=>{
  if(event.pointerId!==pointer||!last)return;
  const dx=event.clientX-last.x,dy=event.clientY-last.y;
  const distance=Math.hypot(dx,dy),spacing=12;
  const steps=Math.floor(distance/spacing);
  if(!steps)return;
  for(let i=1;i<=steps;i++)stampAt(last.x+dx*i*spacing/distance,last.y+dy*i*spacing/distance);
  last={x:last.x+dx*steps*spacing/distance,y:last.y+dy*steps*spacing/distance};
 });
 const end=event=>{
  if(event.pointerId!==pointer)return;
  pointer=null;last=null;
 };
 banner.addEventListener('pointerup',end);
 banner.addEventListener('pointercancel',end);
 banner.addEventListener('lostpointercapture',end);
 button.addEventListener('click',event=>{
  if(event.detail!==0)return;
  const bounds=svg.getBoundingClientRect();
  stampAt(bounds.left+bounds.width/2,bounds.top+bounds.height/2);
 });
});

// Fit retail headings to their available width after font or viewport changes.
(() => {
  const headings = [...document.querySelectorAll('.retail-highlight h2')];
  if (!headings.length) return;
  let frame;
  const fit = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      headings.forEach(heading => heading.style.removeProperty('font-size'));
      const size = Math.min(...headings.map(heading => {
        const base = parseFloat(getComputedStyle(heading).fontSize);
        return heading.scrollWidth > heading.clientWidth && heading.clientWidth > 0
          ? base * heading.clientWidth / heading.scrollWidth * .98 : base;
      }));
      headings.forEach(heading => heading.style.setProperty('font-size', `${size}px`));
    });
  };
  const observer = new ResizeObserver(fit);
  headings.forEach(heading => observer.observe(heading.parentElement));
  window.addEventListener('resize', fit);
  document.fonts.ready.then(fit);
  document.fonts.addEventListener('loadingdone', fit);
  fit();
})();
