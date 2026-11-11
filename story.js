(() => {
  "use strict";
  const root = document.documentElement;
  const story = document.querySelector(".story");
  const stage = document.querySelector(".stage");
  const intro = document.querySelector(".intro");
  const wrap = document.querySelector(".phone-wrap");
  const phone = document.querySelector(".phone");
  const glow = document.querySelector(".glow");
  const bar = document.querySelector(".progress i");
  const cards = [...document.querySelectorAll(".card")];
  const vids = [...document.querySelectorAll(".clip")];
  const N = vids.length;

  const mqMobile = matchMedia("(max-width: 767px)");
  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");

  // ---- Tunable scroll budget (vh). Each clip: PLAY (phone centred) -> GLIDE_OUT -> TEXT hold -> GLIDE_BACK.
  const INTRO = 35, VPS = 16, MIN_PLAY = 45, GLIDE_OUT = 32, HOLD = 38, LAST_HOLD = 80, GLIDE_BACK = 28, REL = 40;
  const SIDE_X = 0.24, SIDE_X_NARROW = 0.27, SIDE_SCALE = 0.88, TILT = 12;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 4);
  const easeInOut = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  const glide = t => lerp(easeInOut(t), easeOut(t), .6);

  // phone sits LEFT on clip 1, RIGHT on clip 2, and so on. Text goes on the opposite side.
  const sideOf = i => (i % 2 === 0 ? -1 : 1);
  cards.forEach((c, i) => { c.classList.add(sideOf(i) < 0 ? "r" : "l"); });

  let mode = null, active = -1, segs = [], total = 1, top = 0, target = 0, smooth = 0, vh = 1, inView = true;

  function setMode() {
    const next = (mqMobile.matches || mqReduce.matches) ? "stack" : "scroll";
    if (next === mode) return;
    mode = next;
    root.classList.toggle("mode-scroll", mode === "scroll");
    root.classList.toggle("mode-stack", mode === "stack");
    wrap.style.transform = ""; phone.style.cssText = ""; intro.style.cssText = ""; glow.style.cssText = "";
    cards.forEach(c => { c.style.cssText = ""; [...c.children].forEach(k => k.style.cssText = ""); });
    story.style.height = "";
    vids.forEach(v => { v.pause(); v.loop = mode === "stack"; });
    if (mode === "stack") bindObserver(); else unbindObserver();
    setActive(0, true);
    measure();
  }

  function setActive(i, force) {
    if (i === active && !force) return;
    active = i;
    vids.forEach((v, n) => v.classList.toggle("is-active", n === i));
    cards.forEach((c, n) => c.setAttribute("aria-current", n === i ? "step" : "false"));
    [i + 1, i + 2].forEach(k => { if (vids[k] && vids[k].preload !== "auto") vids[k].preload = "auto"; });
    if (mode === "stack") {
      vids.forEach((v, n) => { if (n !== i) v.pause(); });
      const v = vids[i];
      v.currentTime = 0;
      if (!mqReduce.matches) v.play().catch(() => {});
    }
  }

  function measure() {
    if (mode !== "scroll") return;
    vh = innerHeight / 100;
    let y = INTRO * vh; segs = [];
    vids.forEach((v, i) => {
      const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : +v.dataset.dur;
      const last = i === N - 1;
      const p0 = y, p1 = p0 + Math.max(MIN_PLAY, dur * VPS) * vh, p2 = p1 + GLIDE_OUT * vh;
      const p3 = p2 + (last ? LAST_HOLD : HOLD) * vh, p4 = p3 + (last ? 0 : GLIDE_BACK * vh);
      segs.push({ p0, p1, p2, p3, p4, dur });
      y = p4;
    });
    total = y + REL * vh;
    story.style.height = (total + innerHeight) + "px";
    top = story.getBoundingClientRect().top + scrollY;
    onScroll();
  }

  function onScroll() { if (mode === "scroll") target = clamp(scrollY - top, 0, total); }

  function tick() {
    if (mode === "scroll" && inView && segs.length) {
      smooth += (target - smooth) * 0.16;
      if (Math.abs(target - smooth) < 0.3) smooth = target;
      render(smooth);
    }
    requestAnimationFrame(tick);
  }

  function render(pos) {
    const vw = innerWidth, now = performance.now();
    const X = (vw < 1000 ? SIDE_X_NARROW : SIDE_X) * vw;

    // which clip are we in? (-1 = intro)
    let a = -1;
    for (let i = 0; i < N; i++) if (pos >= segs[i].p0) a = i;

    let x = 0, y = 0, sc = 1, rx = 0, ry = 0, f = 0, landed = 0;
    if (a < 0) {
      const m = glide(clamp((pos - INTRO * vh * .3) / (INTRO * vh * .7)));
      y = lerp(10 * vh, 0, m); sc = lerp(0.8, 1, m); rx = lerp(6, 0, m);
    } else {
      const s = segs[a], side = sideOf(a);
      let g = 0;                                   // 0 = centre, 1 = at the side
      if (pos < s.p1) g = 0;
      else if (pos < s.p2) g = glide(clamp((pos - s.p1) / (s.p2 - s.p1)));
      else if (pos < s.p3 || a === N - 1) g = 1;
      else g = 1 - glide(clamp((pos - s.p3) / (s.p4 - s.p3)));
      const swing = (pos >= s.p1 && pos < s.p2) ? Math.sin(Math.PI * clamp((pos - s.p1) / (s.p2 - s.p1))) :
                    (pos >= s.p3 && pos < s.p4) ? Math.sin(Math.PI * clamp((pos - s.p3) / (s.p4 - s.p3))) : 0;
      x = side * X * g; sc = lerp(1, SIDE_SCALE, g); f = g;
      ry = -side * (TILT * g + 2.5 * swing);
      rx = 2 * swing;
    }
    const idle = Math.sin(now / 1800) * 4, idleR = Math.sin(now / 2600) * 1.4;
    wrap.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${(y + idle).toFixed(1)}px), 0) scale(${sc.toFixed(4)})`;
    phone.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${(ry + idleR).toFixed(2)}deg)`;
    phone.style.setProperty("--sy", lerp(40, 22, f).toFixed(1) + "px");
    phone.style.setProperty("--sb", lerp(80, 44, f).toFixed(1) + "px");
    phone.style.setProperty("--so", lerp(.55, .4, f).toFixed(3));

    // glow follows the phone and pulses when text lands
    if (a >= 0) { const s = segs[a]; landed = Math.sin(Math.PI * clamp((pos - (s.p2 - 10 * vh)) / (24 * vh))); }
    glow.style.opacity = String((lerp(1, .6, f) + .25 * landed).toFixed(3));
    glow.style.transform = `translate3d(${(x * .9).toFixed(1)}px,${y.toFixed(1)}px,0) scale(${(1 + .12 * landed).toFixed(3)})`;

    // intro headline: gone before the phone grows
    const io = 1 - clamp(pos / (INTRO * vh * .55));
    intro.style.opacity = io.toFixed(3);
    intro.style.transform = `translate3d(0,${((1 - io) * -28).toFixed(1)}px,0)`;
    intro.style.visibility = io < .01 ? "hidden" : "visible";

    // video: scrub during PLAY, hold last frame afterwards
    const idx = Math.max(0, a);
    setActive(idx);
    const sg = segs[idx], v = vids[idx];
    const prog = a < 0 ? 0 : clamp((pos - sg.p0) / (sg.p1 - sg.p0));
    const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : sg.dur;
    const ct = Math.min(prog * dur, Math.max(0, dur - 0.04));
    if (!v.seeking && Math.abs(v.currentTime - ct) > 0.02) v.currentTime = ct;

    // text: slides in from its own side while the phone lands, leaves as the phone glides back
    cards.forEach((c, i) => {
      const g = segs[i], dir = -sideOf(i);           // +1 = text on right
      const es = g.p2 - 12 * vh;
      const tOut = i === N - 1 ? 0 : clamp((pos - g.p3) / (22 * vh));
      let any = 0;
      [...c.children].forEach((k, n) => {
        const tIn = easeOut(clamp((pos - es - n * 4 * vh) / (20 * vh)));
        const o = tIn * (1 - tOut);
        any = Math.max(any, o);
        const tx = dir * 60 * (1 - tIn) + dir * 40 * tOut;
        k.style.opacity = o.toFixed(3);
        k.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
        k.style.filter = o > .99 ? "none" : `blur(${((1 - o) * 8).toFixed(1)}px)`;
      });
      c.style.visibility = any < .01 ? "hidden" : "visible";
    });

    bar.style.transform = `scaleX(${clamp(pos / total).toFixed(4)})`;
  }

  let io = null;
  function bindObserver() {
    unbindObserver();
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setActive(cards.indexOf(e.target)); }),
      { rootMargin: "-55% 0px -35% 0px" });
    cards.forEach(c => io.observe(c));
    const o2 = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setActive(0); }), { rootMargin: "-20% 0px -60% 0px" });
    o2.observe(intro); io._o2 = o2;
  }
  function unbindObserver() { if (io) { io.disconnect(); io._o2 && io._o2.disconnect(); io = null; } }

  new IntersectionObserver(es => { inView = es[0].isIntersecting; }, { rootMargin: "100px 0px" }).observe(story);

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", measure);
  addEventListener("load", measure);
  vids.forEach(v => v.addEventListener("loadedmetadata", measure));
  mqMobile.addEventListener("change", setMode);
  mqReduce.addEventListener("change", setMode);
  setMode(); measure(); requestAnimationFrame(tick);
})();
