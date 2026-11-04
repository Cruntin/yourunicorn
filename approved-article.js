// Culture · Recruits — 에디토리얼 레이아웃 모션
//  1) 첫 진입: 히어로 요소들이 80px 아래에서 차례로 올라옴
//  2) 스크롤: 히어로는 제자리에 머물며 75%까지 작아지고 흐려짐 → 크림 시트가 그 위를 덮음
//  3) 좌측 목차: 지금 읽는 섹션 표시 + 하단 진행 링
//  4) 물결 밑줄: 화면에 들어오면 흐르기 시작
//  5) 다음 페이지 이미지: 살짝 반대로 움직이는 패럴랙스
(() => {
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const wide = () => innerWidth > 1000;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add("is-hit")));

  const hero = document.querySelector(".art-hero");
  const heroIn = hero?.querySelector(".art-hero__inner");
  const SCALE_MIN = 0.75;
  const body = document.querySelector(".art-sheet .art-body") || document.querySelector(".art-body");   // 진행 링은 시트 본문 기준
  const prog = document.querySelector(".art-prog");
  const links = [...document.querySelectorAll(".art-toc a")];
  const secs = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const pars = [...document.querySelectorAll("[data-parallax]")];

  const frame = () => {
    const y = scrollY;
    if (heroIn) {
      if (wide() && !reduce) {
        const p = clamp01(y / hero.offsetHeight);
        const s = 1 - (1 - SCALE_MIN) * p;
        heroIn.style.transform = `translate3d(0, ${Math.min(y, hero.offsetHeight)}px, 0) scale(${s.toFixed(4)})`;
        heroIn.style.opacity = (1 - p).toFixed(3);
      } else {
        heroIn.style.transform = ""; heroIn.style.opacity = "";
      }
    }
    if (body && prog) {
      const r = body.getBoundingClientRect();
      const read = clamp01((innerHeight * 0.5 - r.top) / r.height);
      prog.style.setProperty("--read", read.toFixed(4));
    }
    if (links.length) {
      const cur = secs.filter((s) => s.getBoundingClientRect().top <= innerHeight * 0.35).pop();
      links.forEach((a, i) => a.classList.toggle("is-on", secs[i] === cur));
    }
    if (!reduce && wide()) pars.forEach((img) => {
      const box = img.parentElement.getBoundingClientRect();
      const room = img.offsetHeight - box.height;          // 위아래로 남겨둔 여유(각 3em)만큼만 움직임
      const raw = (box.top + box.height / 2 - innerHeight / 2) * Number(img.dataset.parallax);
      const off = Math.max(-room / 2, Math.min(room / 2, raw));
      img.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
    });
  };
  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame(); }); } };
  frame();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);

  // 입사축하금 띠: 마우스를 올리면(데스크톱) 또는 누르면 펼침
  document.querySelectorAll("[data-bonus]").forEach((el) => {
    const head = el.querySelector(".art-bonus__head");
    const set = (v) => { el.classList.toggle("is-open", v); head.setAttribute("aria-expanded", String(v)); };
    head.addEventListener("click", () => set(!el.classList.contains("is-open")));

  });

  // 좌측 제목: 지금 보고 있는 영역 이름으로 바뀜 (아래에서 올라오며 교체)
  const now = document.querySelector("[data-now]");
  const marks = [...document.querySelectorAll("[data-now-label]")];
  if (now && marks.length) {
    let label = now.textContent.trim();
    const swap = (next) => {
      if (next === label) return;
      label = next;
      const old = now.querySelector("span:not(.is-out)");
      const el = document.createElement("span");
      el.textContent = next;
      el.className = "is-in";
      now.querySelectorAll("span.is-out").forEach((o) => o.remove());   // 이전 교체가 남아 있으면 바로 정리
      if (old) { old.classList.add("is-out"); setTimeout(() => old.remove(), 200); }
      now.appendChild(el);
      void el.offsetWidth;
      setTimeout(() => el.classList.remove("is-in"), 90);   // 이전 글자가 빠진 뒤 새 글자 등장
    };
    const pick = () => {
      const y = innerHeight * 0.4;
      const cur = marks.filter((m) => m.getBoundingClientRect().top <= y).pop() || marks[0];
      swap(cur.dataset.nowLabel);
    };
    pick();
    addEventListener("scroll", () => requestAnimationFrame(pick), { passive: true });
  }

  // 공고 직군 필터: 칩을 누르면 해당 직군 공고만 (차례로 살짝 올라오며 표시)
  document.querySelectorAll("[data-job-filter]").forEach((chip, _, all) => chip.addEventListener("click", () => {
    const want = chip.dataset.jobFilter;
    all.forEach((c) => { c.classList.toggle("is-on", c === chip); c.setAttribute("aria-pressed", String(c === chip)); });
    const rows = [...document.querySelectorAll("[data-jobs] .job")];
    let k = 0;
    rows.forEach((r) => {
      const show = !want || r.dataset.group === want;
      r.hidden = !show;
      r.classList.remove("is-enter");
      if (show) { void r.offsetWidth; r.style.setProperty("--k", k++); r.classList.add("is-enter"); }
    });
    const empty = document.querySelector(".art-jobs__empty");
    if (empty) empty.hidden = k > 0;
  }));

  // 왼쪽 카드 묶음 (Culture): 카드가 차례로 아래에서 올라와 기준선(anchor)에 윗선을 맞추고,
  //   다음 카드가 올라오면 목록이 그만큼 위로 밀리며 앞 카드는 옅게 남음 · 설명은 차례로 펼쳐졌다 접힘
  const cardStacks = [];
  function makeCardStack(scrollEl, anchor, CARD_T) {
    const stage = scrollEl.querySelector(".cx-stage");
    const box = scrollEl.querySelector(".cx-cards");
    const cards = box ? [...box.querySelectorAll(".cx-card")].map((el) => ({ el, more: el.querySelector(".cx-card__more") })) : [];
    const c01 = (v) => Math.min(1, Math.max(0, v));
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    const seg = (p, [a, b]) => easeOut(c01((p - a) / (b - a)));
    const measure = () => {
      if (!box) return;
      const st = stage.getBoundingClientRect().top;
      if (innerWidth <= 900) {
        // 모바일: 제목 묶음 바로 아래에서 시작 (제목을 가리지 않게)
        const lay = anchor().closest(".cx-lay");
        const bottom = Math.max(...[...lay.children].map((el) => el.getBoundingClientRect().bottom));
        box.style.top = `${(bottom - st + 20).toFixed(1)}px`;
        return;
      }
      box.style.top = `${(anchor().getBoundingClientRect().top - st).toFixed(1)}px`;
    };
    const paint = (p) => {
      if (!cards.length) return;
      // Short viewports use the complete reading layout defined in approved.css.
      // 모바일은 화면이 낮아도 PC처럼 스크롤 연동. 펼친 카드가 무대에 안 들어가는 낮은 폰(cx-flow)만 한 흐름 목록
      if (document.body.classList.contains('approved-culture') && ((innerHeight <= 700 && innerWidth > 700) || document.body.classList.contains('cx-flow'))) return;
      const T = (i) => CARD_T[i] || CARD_T[CARD_T.length - 1];
      const ks = cards.map((c, i) => seg(p, T(i).rise));
      cards.forEach((c, i) => {
        let o = seg(p, T(i).open);
        if (CARD_T[i + 1]) o *= 1 - seg(p, CARD_T[i + 1].open);
        // 펼침: 자리는 펼친 만큼 늘리고, 설명 카드는 윗변을 축으로 뒤에서 앞으로 뒤집혀 나옴
        const inner = c.more.firstElementChild;
        c.more.style.height = `${((inner.offsetHeight + 12) * o).toFixed(1)}px`;
        inner.style.transform = `rotateX(${(-150 * (1 - o)).toFixed(2)}deg)`;
        inner.style.opacity = c01(o * 3).toFixed(3);
      });
      let shift = 0;
      for (let i = 1; i < cards.length; i++) shift += (cards[i].el.offsetTop - cards[i - 1].el.offsetTop) * ks[i];
      box.style.transform = `translateY(${(-shift).toFixed(1)}px)`;
      cards.forEach((c, i) => {
        const screenTop = box.offsetTop + c.el.offsetTop - shift;
        c.el.style.transform = `translateY(${((1 - ks[i]) * (stage.clientHeight - screenTop + 40)).toFixed(1)}px)`;
        const fadeK = innerWidth <= 900 ? 1 : 0.65;   // 모바일은 위로 밀린 카드가 제목을 가리지 않게 완전히 사라짐
        c.el.style.opacity = Math.max(0, 1 - fadeK * (ks[i + 1] || 0) - 0.25 * (ks[i + 2] || 0)).toFixed(3);   // 한 칸 밀리면 옅게, 두 칸 밀리면 더 옅게
      });
    };
    // 모바일: 가장 긴 카드를 펼쳤을 때 고정 무대(100svh - 헤더) 아래로 넘치는지
    const overflows = () => {
      if (!box || !cards.length) return false;
      measure();
      const tallest = Math.max(...cards.map((c) => c.el.offsetHeight - c.more.offsetHeight + c.more.firstElementChild.offsetHeight + 12));
      return (parseFloat(box.style.top) || 0) + tallest + 8 > stage.clientHeight;
    };
    const stack = { measure, paint, overflows };
    cardStacks.push(stack);
    return stack;
  }

  // AND WE MAKE IT REAL · WHO WE LOOK FOR: 제목은 고정, 왼쪽 카드가 차례로 (기준선 = 위 한글 한 줄 윗선)
  // 카드 수에 맞춰 스크롤 구간을 고르게 나눔: 카드마다 [올라옴 → 펼침]
  // 3차: 첫 카드는 무대가 고정되는 순간 이미 올라와 있어 제목 아래가 비지 않음. 나머지는 그 뒤에 차례로
  const cardTimeline = (n) => Array.from({ length: n }, (_, i) => {
    if (i === 0) return { rise: [-0.05, -0.001], open: [0.04, 0.16] }; // 진행 0에서 이미 올라와 있음
    const m = Math.max(1, n - 1), a = 0.22 + (0.74 / m) * (i - 1), w = 0.74 / m;
    return { rise: [a, a + w * 0.45], open: [a + w * 0.52, a + w * 0.85] };
  });
  document.querySelectorAll(".cx-scroll--real:not(.cx-scroll--who)").forEach((realScroll) => {
    const stack = makeCardStack(realScroll, () => realScroll.querySelector("[data-anchor]"), cardTimeline(realScroll.querySelectorAll(".cx-card").length));
    const reduceR = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tgt = 0, cur = 0, rafR = 0, lastR = 0;
    const tick = (now) => {
      const dt = Math.min(0.033, Math.max(0, (now - lastR) / 1000)); lastR = now;
      cur = reduceR ? tgt : cur + (tgt - cur) * (1 - Math.exp(-9 * dt));
      if (Math.abs(tgt - cur) < 0.0005) cur = tgt;
      stack.paint(cur);
      rafR = cur !== tgt ? requestAnimationFrame(tick) : 0;
    };
    const onRealScroll = () => {
      const r = realScroll.getBoundingClientRect();
      tgt = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      if (!rafR) { lastR = performance.now(); rafR = requestAnimationFrame(tick); }
    };
    window.addEventListener("scroll", onRealScroll, { passive: true });
    window.addEventListener("resize", () => { stack.measure(); stack.paint(cur); onRealScroll(); });
    document.fonts?.ready.then(() => { stack.measure(); stack.paint(cur); });
    stack.measure(); stack.paint(0); onRealScroll();
  });

  // WHO WE LOOK FOR: 제목 아래 카드 4개 — 스크롤에 따라 왼쪽부터 하나씩 올라오고, 그다음 하나씩 설명이 뒤에서 뒤집혀 펼쳐짐
  const whoScroll = document.querySelector(".cx-scroll--who");
  if (whoScroll) {
    const rowCards = [...whoScroll.querySelectorAll(".cx-row .cx-card")].map((el) => ({ el, more: el.querySelector(".cx-card__more") }));
    const n = rowCards.length;
    const c01 = (v) => Math.min(1, Math.max(0, v));
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    const APPEAR = [0.04, 0.36], OPEN = [0.42, 0.94];   // 등장 구간 · 펼침 구간 (카드끼리 조금씩 겹쳐 차례로)
    const part = ([a, b], i, p) => { const w = (b - a) / (n * 0.7 + 0.3); const s = a + w * 0.7 * i; return easeOut(c01((p - s) / w)); };
    // 네 설명 카드의 세로 길이를 가장 긴 카드에 맞춤
    const equalize = () => {
      const ins = rowCards.map((c) => c.more.firstElementChild);
      ins.forEach((el) => { el.style.minHeight = ""; });
      if (innerWidth <= 900) return;   // 모바일(한 줄씩 쌓임)은 맞추지 않음
      const hMax = Math.max(...ins.map((el) => el.offsetHeight));
      ins.forEach((el) => { el.style.minHeight = `${hMax}px`; });
    };
    const paintRow = (p) => rowCards.forEach((c, i) => {
      const k = part(APPEAR, i, p), o = part(OPEN, i, p);
      c.el.style.opacity = k.toFixed(3);
      c.el.style.transform = `translateY(${((1 - k) * 80).toFixed(1)}px)`;
      const inner = c.more.firstElementChild;
      c.more.style.height = `${((inner.offsetHeight + 12) * o).toFixed(1)}px`;
      inner.style.transform = `rotateX(${(-150 * (1 - o)).toFixed(2)}deg)`;
      inner.style.opacity = c01(o * 3).toFixed(3);
    });
    const reduceW = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tgt = 0, cur = 0, raf = 0, last = 0;
    const tick = (now) => {
      const dt = Math.min(0.033, Math.max(0, (now - last) / 1000)); last = now;
      cur = reduceW ? tgt : cur + (tgt - cur) * (1 - Math.exp(-9 * dt));
      if (Math.abs(tgt - cur) < 0.0005) cur = tgt;
      paintRow(cur);
      raf = cur !== tgt ? requestAnimationFrame(tick) : 0;
    };
    const onWho = () => {
      const r = whoScroll.getBoundingClientRect();
      tgt = innerWidth <= 900 ? 1 : c01(-r.top / Math.max(1, r.height - innerHeight));   // 모바일은 모두 펼친 상태
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    window.addEventListener("scroll", onWho, { passive: true });
    window.addEventListener("resize", () => { equalize(); paintRow(cur); onWho(); });
    document.fonts?.ready.then(() => { equalize(); paintRow(cur); });
    equalize(); paintRow(innerWidth <= 900 ? 1 : 0); onWho();
  }

  // Culture 흰 시트: 스크롤하면 HOW WE WORK는 작아져 위 라벨 자리로, 아래 WE IMAGINE WHAT SHOULD EXIST는 커져 두 줄 제목 자리로
  //   A(처음)·B(나중) 두 틀에서 글자 자리를 재 두고, 실제 글자를 두 자리 사이로 옮김
  //   스크롤 값은 스프링으로 따라가 살짝 넘쳤다 돌아오는 쫀득한 움직임
  const cxScroll = document.querySelector(".cx-scroll:not(.cx-scroll--real)");
  if (cxScroll) {
    const stage = cxScroll.querySelector(".cx-stage");
    const layA = cxScroll.querySelector(".cx-lay--a"), layB = cxScroll.querySelector(".cx-lay--b");
    const actors = [...cxScroll.querySelectorAll("[data-actor]")].map((el) => ({ el, key: el.dataset.actor }));
    const fadeA = [...layA.querySelectorAll(".spark, .cx-fade-a")], fadeB = [...layB.querySelectorAll(".cx-fade-b")];
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const SWAP = [0.04, 0.2];  // 3차: 더 빨리 등장             // 스크롤 진행 중 글자가 바뀌는 구간
    // 왼쪽 카드마다: 올라오는 구간 · 설명이 펼쳐지는 구간 (다음 카드가 펼쳐질 때 앞 카드 설명은 접힘)
    const CARD_T = [{ rise: [0.13, 0.21], open: [0.24, 0.32] }, { rise: [0.44, 0.54], open: [0.58, 0.70] }]; // 3차: 첫 카드는 글자 전환 직후 바로 올라옴, 둘째도 앞당김
    const STIFF = 120, DAMP = 19;         // 스프링: 감쇠를 높여 넘침은 아주 조금만
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rects = null;
    const measure = () => {
      // 첫 상태 글자 묶음의 윗선 = 두 번째 상태의 HOW WE WORK 윗선
      const labB = layB.querySelector('[data-slot="how"]').closest("p");
      layA.style.paddingTop = `${(labB.getBoundingClientRect().top - stage.getBoundingClientRect().top).toFixed(1)}px`;
      const s0 = stage.getBoundingClientRect();
      const rel = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - s0.left, y: r.top - s0.top, w: r.width }; };
      rects = actors.map((a) => {
        a.el.style.transform = "none";
        return { a: rel(layA.querySelector(`[data-slot="${a.key}"]`)), b: rel(layB.querySelector(`[data-slot="${a.key}"]`)), w0: a.el.getBoundingClientRect().width };
      });
    };
    const paint = (t) => {
      if (!rects) measure();
      const blockOff = { x: Math.min(...rects.map((r) => r.a.x)) - Math.min(...rects.map((r) => r.b.x)), y: Math.min(...rects.map((r) => r.a.y)) - Math.min(...rects.map((r) => r.b.y)) };
      actors.forEach((a, i) => {
        const { a: A, b: B, w0 } = rects[i];
        // 3차 모바일: 1단계(앞 절반) 제자리에서 두 번째 상태의 배치·크기로 바뀌고, 2단계(뒤 절반) 묶음째 위로 올라감
        const mobile = innerWidth <= 700;
        const tx = mobile ? clamp01(t / 0.5) : t, ty = mobile ? clamp01((t - 0.5) / 0.5) : t;
        const dx = mobile ? blockOff.x : 0, dy = mobile ? blockOff.y : 0;   // 두 번째 배치를 첫 묶음 위치로 끌어온 오프셋
        const x = A.x + (B.x + dx - A.x) * tx - dx * ty, y = A.y + (B.y + dy - A.y) * tx - dy * ty, w = A.w + (B.w - A.w) * tx;
        a.el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${(w / w0).toFixed(4)})`;
      });
      const c = clamp01(t);
      fadeA.forEach((el) => { el.style.opacity = (1 - clamp01(c / 0.5)).toFixed(3); el.style.transform = `translateY(${(-40 * c).toFixed(1)}px)`; });
      const bIn = innerWidth <= 700 ? clamp01((c - 0.88) / 0.12) : clamp01((c - 0.55) / 0.45); // 3차 모바일: 묶음이 다 올라간 뒤 한글 설명 등장
      fadeB.forEach((el) => { el.style.opacity = bIn.toFixed(3); el.style.transform = `translateY(${(20 * (1 - c)).toFixed(1)}px)`; });
    };
    // 왼쪽 카드: 목록 윗선 = 두 번째 상태의 HOW WE WORK 윗선
    const stack = makeCardStack(cxScroll, () => layB.querySelector('[data-slot="how"]'), CARD_T);
    const measureCard = stack.measure, paintCard = stack.paint;
    let target = 0, pos = 0, vel = 0, last = 0, raf = 0, pTarget = 0, pShown = 0;
    const step = (now) => {
      const dt = Math.min(0.033, Math.max(0, (now - last) / 1000)); last = now;
      if (reduce) { pos = target; vel = 0; pShown = pTarget; }
      else { vel += (STIFF * (target - pos) - DAMP * vel) * dt; pos += vel * dt; pShown += (pTarget - pShown) * (1 - Math.exp(-9 * dt)); }
      paint(pos);
      paintCard(pShown);
      if (Math.abs(target - pos) > 0.0005 || Math.abs(vel) > 0.0005 || Math.abs(pTarget - pShown) > 0.0005) raf = requestAnimationFrame(step);
      else { pos = target; pShown = pTarget; paint(pos); paintCard(pShown); raf = 0; }
    };
    const onScroll = () => {
      const r = cxScroll.getBoundingClientRect();
      const p = clamp01(-r.top / Math.max(1, r.height - innerHeight));
      pTarget = p;
      target = clamp01((p - SWAP[0]) / (SWAP[1] - SWAP[0]));
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { measure(); measureCard(); paint(pos); paintCard(pShown); onScroll(); });
    document.fonts?.ready.then(() => { measure(); measureCard(); paint(pos); paintCard(pShown); });
    measure(); measureCard(); paint(0); paintCard(0); onScroll();
  }

  // 모바일 Culture: 펼친 카드가 고정 무대에 다 들어가지 않는 낮은 폰(아이폰 SE·mini 등)만 한 흐름 목록(cx-flow)으로 둔다.
  //   무대 높이가 100svh 기준이라 툴바가 접히고 펴져도 판정은 그대로 — 폭이 바뀔 때만 다시 잰다.
  //   흐름 목록에서는 카드 설명이 화면에 들어올 때 펼쳐진다.
  if (document.body.classList.contains("approved-culture") && cardStacks.length) {
    const flowCards = [...document.querySelectorAll(".cx-scroll:not(.cx-scroll--who) .cx-card")];
    let flowObserver = null, fitWidth = -1;
    const fitCheck = () => {
      if (innerWidth === fitWidth) return;
      fitWidth = innerWidth;
      const was = document.body.classList.contains("cx-flow");
      document.body.classList.remove("cx-flow");
      const flow = innerWidth <= 700 && cardStacks.some((s) => s.overflows());
      document.body.classList.toggle("cx-flow", flow);
      flowObserver?.disconnect(); flowObserver = null;
      if (flow && "IntersectionObserver" in window) {
        flowObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-mobile-expanded"); flowObserver.unobserve(entry.target);
        }), { rootMargin: "0px 0px -120px 0px", threshold: 0 });
        flowCards.forEach((card) => { if (!card.classList.contains("is-mobile-expanded")) flowObserver.observe(card); });
      }
      if (flow !== was) dispatchEvent(new Event("resize"));   // 배치가 바뀌었으니 각 구간 위치를 다시 잼
    };
    window.addEventListener("resize", fitCheck);
    document.fonts?.ready.then(() => { fitWidth = -1; fitCheck(); });
    fitCheck();
  }

  // 스파크: 화면에 들어오면 중앙에서 퍼지는 모션 재생 (다시 들어오면 처음부터)
  const sparkIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) e.target.classList.add("is-play");
    else if (e.boundingClientRect.top > 0) e.target.classList.remove("is-play");
  }), { threshold: 0.5 });
  document.querySelectorAll(".spark").forEach((el) => sparkIO.observe(el));

  const waveIO = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("is-on", e.isIntersecting)));
  document.querySelectorAll(".art-wave").forEach((el) => waveIO.observe(el));
})();
