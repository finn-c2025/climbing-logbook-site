(() => {
  "use strict";
  const root = document.documentElement;
  const story = document.querySelector(".story");
  const stage = document.querySelector(".stage");
  const intro = document.querySelector(".intro");
  const wrap = document.querySelector(".phone-wrap");
  const phone = document.querySelector(".phone");
  const glow = document.querySelector(".glow");
  const cards = [...document.querySelectorAll(".card")];
  const views = [...document.querySelectorAll(".view")];

  const mqMobile = matchMedia("(max-width: 767px)");
  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");

  // Timeline (fractions of total pinned scroll; 520vh = 40 hold + 80 move + 4x90 features + 40 release)
  const HOLD_END = 0.077, MOVE_END = 0.231, FEAT_START = MOVE_END, SLOT = 0.173;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 4);                       // settle gently
  const easeInOut = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  const move = t => lerp(easeInOut(t), easeOut(t), .6);               // blend: soft start, soft landing

  let mode = null, current = -1, target = 0, smooth = 0, raf = 0;

  function setMode() {
    const next = (mqMobile.matches || mqReduce.matches) ? "stack" : "scroll";
    if (next === mode) return;
    mode = next;
    root.classList.toggle("mode-scroll", mode === "scroll");
    root.classList.toggle("mode-stack", mode === "stack");
    root.classList.toggle("reduced", mqReduce.matches);
    wrap.style.transform = ""; phone.style.transform = ""; phone.style.removeProperty("--sy");
    phone.style.removeProperty("--sb"); phone.style.removeProperty("--so");
    intro.style.cssText = ""; cards.forEach(c => c.style.cssText = "");
    glow.style.cssText = "";
    if (mode === "stack") bindObserver(); else unbindObserver();
    setView(0, true);
    measure();
  }

  /* ---- screen state ---- */
  function setView(i, force) {
    if (i === current && !force) return;
    current = i;
    views.forEach((v, n) => v.classList.toggle("is-active", n === i));
    cards.forEach((c, n) => c.setAttribute("aria-current", n === i - 1 ? "step" : "false"));
    if (views[i] && views[i].classList.contains("v-stats")) countUp(views[i]); else resetCounts();
  }

  function countUp(v) {
    const els = v.querySelectorAll("[data-count]");
    const dur = mqReduce.matches ? 0 : 1000, t0 = performance.now();
    const tick = now => {
      const t = dur ? clamp((now - t0) / dur) : 1, e = easeOut(t);
      els.forEach(el => {
        const n = parseFloat(el.dataset.count), d = +(el.dataset.dec || 0);
        el.textContent = (el.dataset.prefix || "") + (n * e).toFixed(d) + (el.dataset.suffix || "");
      });
      if (t < 1 && views[current] === v) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function resetCounts() {
    document.querySelectorAll("[data-count]").forEach(el => {
      const d = +(el.dataset.dec || 0);
      el.textContent = (el.dataset.prefix || "") + (0).toFixed(d) + (el.dataset.suffix || "");
    });
  }

  /* ---- scroll mode ---- */
  let top = 0, range = 1;
  function measure() {
    if (mode !== "scroll") return;
    const r = story.getBoundingClientRect();
    top = r.top + scrollY;
    range = Math.max(1, story.offsetHeight - innerHeight);
    onScroll();
  }
  function onScroll() {
    if (mode !== "scroll") return;
    target = clamp((scrollY - top) / range);
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function frame() {
    raf = 0;
    smooth += (target - smooth) * 0.14;              // scrub smoothing, like scrub: 1
    if (Math.abs(target - smooth) < 0.0004) smooth = target;
    render(smooth);
    if (smooth !== target) raf = requestAnimationFrame(frame);
  }

  function render(p) {
    const vw = innerWidth;
    const m = move(clamp((p - HOLD_END) / (MOVE_END - HOLD_END)));
    const narrow = vw < 1000;
    const endX = -(narrow ? 0.27 : 0.24) * vw;        // pinned to the left
    const x = lerp(0, endX, m);
    const s = lerp(1.04, narrow ? 0.76 : 0.9, m);
    const ry = lerp(0, 9, m), rx = lerp(4, 0, m);
    const drift = p > MOVE_END ? Math.sin(performance.now() / 2600) * 0.5 : 0;
    const rel = clamp((p - 0.923) / 0.077);             // release: gentle settle
    wrap.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), -50%, 0) scale(${s.toFixed(4)})`;
    phone.style.transform = `rotateX(${(rx + drift * 0.4).toFixed(2)}deg) rotateY(${(ry + drift).toFixed(2)}deg)`;
    phone.style.setProperty("--sy", lerp(40, 20, m).toFixed(1) + "px");
    phone.style.setProperty("--sb", lerp(80, 40, m).toFixed(1) + "px");
    phone.style.setProperty("--so", lerp(.55, .4, m).toFixed(3));
    glow.style.opacity = String(lerp(1, .55, m) * (1 - rel * 0.6));
    glow.style.transform = `translate3d(${(x * 0.9).toFixed(1)}px,0,0)`;

    const io = 1 - clamp((p - 0.03) / (HOLD_END - 0.03));
    intro.style.opacity = io.toFixed(3);
    intro.style.transform = `translate3d(0,${((1 - io) * -24).toFixed(1)}px,0)`;
    intro.style.visibility = io < 0.01 ? "hidden" : "visible";

    // cards
    let active = 0;
    cards.forEach((c, i) => {
      const u = (p - (FEAT_START + i * SLOT - 0.02)) / SLOT;   // slight lead so card is readable when screen swaps
      let o = 0, y = 0;
      if (u >= 0 && u <= 1) {
        if (u < .2) { const t = easeOut(u / .2); o = t; y = (1 - t) * 40; }
        else if (u > .8 && i < cards.length - 1) { const t = (u - .8) / .2; o = 1 - t * .85; y = -t * 24; }
        else { o = 1; }
        if (u >= 0.15 && (u <= 1.15 || i === cards.length - 1)) active = i + 1;
      } else if (u > 1 && i === cards.length - 1) { o = 1; active = i + 1; }
      c.style.opacity = o.toFixed(3);
      c.style.transform = `translate3d(0,calc(-50% + ${y.toFixed(1)}px),0)`;
      c.style.visibility = o < 0.01 ? "hidden" : "visible";
      c.style.pointerEvents = o > .5 ? "auto" : "none";
    });
    if (p < FEAT_START + 0.02) active = 0;
    setView(active);
  }

  /* ---- stack mode ---- */
  let io = null;
  function bindObserver() {
    unbindObserver();
    io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) setView(cards.indexOf(e.target) + 1); });
    }, { rootMargin: "-55% 0px -35% 0px", threshold: 0 });
    cards.forEach(c => io.observe(c));
    const introObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setView(0); }), { rootMargin: "-20% 0px -60% 0px" });
    introObs.observe(intro); io._intro = introObs;
  }
  function unbindObserver() { if (io) { io.disconnect(); if (io._intro) io._intro.disconnect(); io = null; } }

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { measure(); });
  addEventListener("load", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  mqMobile.addEventListener("change", setMode);
  mqReduce.addEventListener("change", setMode);
  setMode(); resetCounts(); measure();
})();
