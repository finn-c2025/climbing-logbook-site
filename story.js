(() => {
  "use strict";
  const root = document.documentElement;
  const story = document.querySelector(".story");
  const intro = document.querySelector(".intro");
  const wrap = document.querySelector(".phone-wrap");
  const phone = document.querySelector(".phone");
  const glow = document.querySelector(".glow");
  const cards = [...document.querySelectorAll(".card")];
  const vids = [...document.querySelectorAll(".clip")];
  const N = vids.length;

  const mqMobile = matchMedia("(max-width: 767px)");
  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");

  // Scroll budget in vh. Each clip plays while you scroll (VPS vh per second of video),
  // then freezes on its last frame for a DWELL while its description is on screen.
  const PRE = 25, VPS = 24, MIN_TRAVEL = 50, DWELL = 55, LAST_DWELL = 80, REL = 40, MOVE_VH = 110, CARD_EXIT = 18;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 4);
  const easeInOut = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  const move = t => lerp(easeInOut(t), easeOut(t), .6);

  let mode = null, active = -1, segs = [], total = 1, top = 0, target = 0, smooth = 0, raf = 0, vh = 1;

  function setMode() {
    const next = (mqMobile.matches || mqReduce.matches) ? "stack" : "scroll";
    if (next === mode) return;
    mode = next;
    root.classList.toggle("mode-scroll", mode === "scroll");
    root.classList.toggle("mode-stack", mode === "stack");
    wrap.style.transform = ""; phone.style.cssText = ""; intro.style.cssText = ""; glow.style.cssText = "";
    cards.forEach(c => c.style.cssText = "");
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
    let y = PRE * vh; segs = [];
    vids.forEach((v, i) => {
      const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : +v.dataset.dur;
      const travel = Math.max(MIN_TRAVEL, dur * VPS) * vh;
      const dwell = (i === N - 1 ? LAST_DWELL : DWELL) * vh;
      segs.push({ t0: y, t1: y + travel, d1: y + travel + dwell, dur });
      y += travel + dwell;
    });
    total = y + REL * vh;
    story.style.height = (total + innerHeight) + "px";
    top = story.getBoundingClientRect().top + scrollY;
    onScroll();
  }

  function onScroll() {
    if (mode !== "scroll") return;
    target = clamp(scrollY - top, 0, total);
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function frame() {
    raf = 0;
    smooth += (target - smooth) * 0.16;
    if (Math.abs(target - smooth) < 0.5) smooth = target;
    render(smooth);
    if (smooth !== target) raf = requestAnimationFrame(frame);
  }

  function render(pos) {
    const vw = innerWidth, s0 = segs[0];
    // phone moves while clip 1 plays
    const moveLen = Math.min(MOVE_VH * vh, (s0.t1 - s0.t0) * 0.75);
    const m = move(clamp((pos - s0.t0) / moveLen));
    const narrow = vw < 1000;
    const x = lerp(0, -(narrow ? 0.27 : 0.24) * vw, m);
    const sc = lerp(1.04, narrow ? 0.76 : 0.9, m);
    const drift = m >= 1 ? Math.sin(performance.now() / 2600) * 0.5 : 0;
    const rel = clamp((pos - (total - REL * vh)) / (REL * vh));
    wrap.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), -50%, 0) scale(${sc.toFixed(4)})`;
    phone.style.transform = `rotateX(${(lerp(4, 0, m) + drift * .4).toFixed(2)}deg) rotateY(${(lerp(0, 9, m) + drift).toFixed(2)}deg)`;
    phone.style.setProperty("--sy", lerp(40, 20, m).toFixed(1) + "px");
    phone.style.setProperty("--sb", lerp(80, 40, m).toFixed(1) + "px");
    phone.style.setProperty("--so", lerp(.55, .4, m).toFixed(3));
    glow.style.opacity = String(lerp(1, .55, m) * (1 - rel * .6));
    glow.style.transform = `translate3d(${(x * .9).toFixed(1)}px,0,0)`;

    const io = 1 - clamp((pos - s0.t0 * .4) / (s0.t0 * .6 + 25 * vh));
    intro.style.opacity = io.toFixed(3);
    intro.style.transform = `translate3d(0,${((1 - io) * -24).toFixed(1)}px,0)`;
    intro.style.visibility = io < .01 ? "hidden" : "visible";

    // which clip is current, and scrub it
    let a = 0;
    for (let i = 0; i < N; i++) if (pos >= segs[i].t0) a = i;
    setActive(a);
    const sg = segs[a], v = vids[a];
    const prog = clamp((pos - sg.t0) / (sg.t1 - sg.t0));
    const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : sg.dur;
    const ct = Math.min(prog * dur, Math.max(0, dur - 0.04));
    if (!v.seeking && Math.abs(v.currentTime - ct) > 0.02) v.currentTime = ct;

    // cards: fade in as the clip finishes, hold through the dwell, leave as the next clip starts
    cards.forEach((c, i) => {
      const g = segs[i];
      const enter = g.t1 - Math.min(.4 * (g.t1 - g.t0), 28 * vh);
      let o = 0, y = 0;
      if (pos >= enter && pos <= g.d1) {
        const t = clamp((pos - enter) / (g.t1 - enter));
        o = easeOut(t); y = (1 - o) * 40;
      } else if (pos > g.d1) {
        if (i === N - 1) o = 1;
        else { const t = clamp((pos - g.d1) / (CARD_EXIT * vh)); o = 1 - t; y = -t * 24; }
      }
      c.style.opacity = o.toFixed(3);
      c.style.transform = `translate3d(0,calc(-50% + ${y.toFixed(1)}px),0)`;
      c.style.visibility = o < .01 ? "hidden" : "visible";
      c.style.pointerEvents = o > .5 ? "auto" : "none";
    });
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

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", measure);
  addEventListener("load", measure);
  vids.forEach(v => v.addEventListener("loadedmetadata", measure));
  mqMobile.addEventListener("change", setMode);
  mqReduce.addEventListener("change", setMode);
  setMode(); measure();
})();
