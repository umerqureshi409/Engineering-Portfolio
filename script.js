(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ============================================================
     1. FRAME PRELOAD (progressive — render starts as soon as the
        first handful of frames are ready, rest load in background)
     ============================================================ */
  const FRAME_TOTAL = 240; // full 10s @ 24fps
  const frames = new Array(FRAME_TOTAL + 1); // 1-indexed
  let maxLoadedIndex = 0;

  const loaderFill = document.getElementById("loaderFill");
  const loaderPct = document.getElementById("loaderPct");
  const loaderEl = document.getElementById("loader");

  function frameSrc(n) {
    return `frames/frame_${String(n).padStart(4, "0")}.jpg`;
  }

  const READY_THRESHOLD = 24; // ~1s of frames is enough to start the experience
  let readyFired = false;

  function preloadFrames() {
    return new Promise((resolveReady) => {
      let settledCount = 0;
      for (let i = 1; i <= FRAME_TOTAL; i++) {
        const img = new Image();
        img.onload = img.onerror = () => {
          settledCount++;
          if (i > maxLoadedIndex && img.complete && img.naturalWidth) maxLoadedIndex = i;
          const pct = Math.round((settledCount / FRAME_TOTAL) * 100);
          loaderFill.style.width = pct + "%";
          loaderPct.textContent = pct < 100 ? `Loading the story… ${pct}%` : "Ready.";
          if (!readyFired && settledCount >= READY_THRESHOLD) {
            readyFired = true;
            resolveReady();
          }
        };
        img.src = frameSrc(i);
        frames[i] = img;
      }
      // safety net in case onload never reaches the threshold quickly
      setTimeout(() => { if (!readyFired) { readyFired = true; resolveReady(); } }, 4000);
    });
  }

  preloadFrames().then(() => {
    loaderEl.classList.add("loader-hidden");
    startStory();
  });

  /* ============================================================
     2. CUSTOM CURSOR
     ============================================================ */
  const cursorRing = document.getElementById("cursorRing");
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let ringX = mouseX, ringY = mouseY;

  if (!isCoarsePointer && !reduceMotion) {
    window.addEventListener("mousemove", (e) => {
      mouseX = e.clientX; mouseY = e.clientY;
      cursorRing.classList.remove("is-hidden");
      const target = e.target.closest("a, button, .icon-chip, input, textarea");
      cursorRing.classList.toggle("is-active", !!target);
    });
    window.addEventListener("mouseleave", () => cursorRing.classList.add("is-hidden"));

    (function cursorLoop() {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%,-50%)`;
      requestAnimationFrame(cursorLoop);
    })();
  } else {
    cursorRing.style.display = "none";
  }

  /* ============================================================
     2b. SMOKE CURSOR TRAIL
     ============================================================ */
  const smokeCanvas = document.getElementById("smokeCanvas");
  if (isCoarsePointer || reduceMotion) {
    smokeCanvas.style.display = "none";
  } else {
    const sctx = smokeCanvas.getContext("2d");
    let smokeW = window.innerWidth, smokeH = window.innerHeight;
    function resizeSmoke() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      smokeW = window.innerWidth; smokeH = window.innerHeight;
      smokeCanvas.width = smokeW * dpr;
      smokeCanvas.height = smokeH * dpr;
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeSmoke();
    window.addEventListener("resize", resizeSmoke);

    const MAX_PARTICLES = 90;
    const particles = [];
    let lastSpawnX = null, lastSpawnY = null;

    function spawnPuff(x, y) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      const hueMix = Math.random();
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.35 - Math.random() * 0.35,
        r: 10 + Math.random() * 14,
        maxR: 34 + Math.random() * 30,
        life: 0,
        maxLife: 70 + Math.random() * 40,
        hueMix,
      });
    }

    window.addEventListener("mousemove", (e) => {
      const x = e.clientX, y = e.clientY;
      if (lastSpawnX === null) { lastSpawnX = x; lastSpawnY = y; }
      const dist = Math.hypot(x - lastSpawnX, y - lastSpawnY);
      if (dist > 14) {
        spawnPuff(x, y);
        lastSpawnX = x; lastSpawnY = y;
      }
    });

    function drawSmoke() {
      sctx.clearRect(0, 0, smokeW, smokeH);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        if (p.life > p.maxLife) { particles.splice(i, 1); continue; }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        const t = p.life / p.maxLife;
        const radius = p.r + (p.maxR - p.r) * t;
        const alpha = (1 - t) * 0.22;
        const grad = sctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        const c1 = p.hueMix > 0.5 ? "79,140,255" : "155,123,246";
        grad.addColorStop(0, `rgba(${c1},${alpha})`);
        grad.addColorStop(1, `rgba(${c1},0)`);
        sctx.fillStyle = grad;
        sctx.beginPath();
        sctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        sctx.fill();
      }
      requestAnimationFrame(drawSmoke);
    }
    requestAnimationFrame(drawSmoke);
  }

  /* ============================================================
     3. NAV — hide-on-scroll-down / show-on-scroll-up
     ============================================================ */
  const nav = document.getElementById("nav");
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (y > lastY && y > 200) nav.style.transform = "translateY(-120%)";
    else nav.style.transform = "translateY(0)";
    lastY = y;
  }, { passive: true });

  /* ============================================================
     4. UNIFIED SCROLL STORY
     ============================================================ */
  const storySection = document.getElementById("story");
  const storySticky = document.getElementById("storySticky");
  const canvas = document.getElementById("storyCanvas");
  const ctx = canvas.getContext("2d");
  const railDots = Array.from(document.querySelectorAll(".rail-dot"));
  const skeletonReveal = document.getElementById("skeletonReveal");
  const iconField = document.getElementById("iconField");
  const storyFadeOut = document.getElementById("storyFadeOut");

  const FADE = 0.03; // constant fade width (fraction of total progress) at every internal transition

  // stage ranges as fractions of total story-scroll progress (0..1), mapped
  // directly onto the 240-frame / 10s video. Intro's start is pulled back
  // to a negative edge so it's at full opacity the instant the page loads —
  // there's nothing before it to crossfade from, unlike every later stage.
  const STAGES = {
    intro:   [-FADE, 0.160],
    about:   [0.160, 0.350],
    stack:   [0.350, 0.550],
    work:    [0.550, 0.700],
    // 0.700–0.800 is a pure-motion transition (standing up, walking) — no panel
    contact: [0.800, 1.000],
  };

  function smoothstep(edge0, edge1, x) {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawFrame(img) {
    const w = window.innerWidth, h = window.innerHeight;
    if (!img || !img.complete || !img.naturalWidth) return;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    const dx = (w - dw) / 2, dy = (h - dh) * 0.42;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  let needsUpdate = true;

  function computeProgress() {
    const rect = storySection.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return 0;
    const scrolled = -rect.top;
    return Math.min(1, Math.max(0, scrolled / total));
  }

  function updatePanels(progress) {
    let activeStage = null;
    const opacities = {};
    for (const [name, [start, end]] of Object.entries(STAGES)) {
      const opacity =
        smoothstep(start, start + FADE, progress) *
        (1 - smoothstep(end - FADE, end, progress));
      opacities[name] = opacity;
      const panel = document.querySelector(`.stage-panel[data-panel="${name}"]`);
      if (panel) {
        panel.style.opacity = opacity.toFixed(3);
        const visible = opacity > 0.5;
        panel.classList.toggle("is-visible", visible);
        panel.setAttribute("aria-hidden", visible ? "false" : "true");
        panel.style.transform = `translateY(calc(-50% + ${(1 - opacity) * 16}px))`;
      }
      if (progress >= start && progress <= end) activeStage = name;
    }
    railDots.forEach((dot) => {
      dot.classList.toggle("active", dot.dataset.stage === activeStage);
    });

    // skeleton cursor-reveal only relevant during the intro beat
    skeletonReveal.style.opacity = opacities.intro.toFixed(3);
    skeletonReveal.style.pointerEvents = opacities.intro > 0.05 ? "auto" : "none";

    // floating tech icons only relevant during the stack beat
    iconField.style.opacity = opacities.stack.toFixed(3);

    // fade the whole scene to solid background right at the very end,
    // so the handoff into the Projects section reads as a dissolve, not a cut
    const outro = smoothstep(0.965, 1.0, progress);
    storyFadeOut.style.opacity = outro.toFixed(3);
  }

  function renderStory(progress) {
    const idx = Math.min(FRAME_TOTAL, Math.max(1, Math.round(1 + progress * (FRAME_TOTAL - 1))));
    const clampedIdx = Math.min(idx, Math.max(1, maxLoadedIndex));
    drawFrame(frames[clampedIdx]);
    updatePanels(progress);
  }

  function loop() {
    if (needsUpdate) {
      needsUpdate = false;
      renderStory(computeProgress());
    }
    requestAnimationFrame(loop);
  }

  function onScrollOrResize() { needsUpdate = true; }

  function startStory() {
    resizeCanvas();
    renderStory(computeProgress());
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", () => { resizeCanvas(); onScrollOrResize(); });
    requestAnimationFrame(loop);
    // keep redrawing the current frame as later images finish loading in
    // the background, so the picture sharpens instead of staying stuck
    const bgRefresh = setInterval(() => {
      onScrollOrResize();
      if (maxLoadedIndex >= FRAME_TOTAL) clearInterval(bgRefresh);
    }, 400);
  }

  // cursor-reveal: listen on the whole sticky container (an ancestor of
  // every panel), so hovering over headline text still reveals the
  // skeleton underneath instead of only working over empty canvas
  function setReveal(clientX, clientY) {
    const rect = storySticky.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    skeletonReveal.style.clipPath = `circle(150px at ${x}px ${y}px)`;
  }

  if (!reduceMotion) {
    storySticky.addEventListener("mousemove", (e) => setReveal(e.clientX, e.clientY));
    storySticky.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      if (t) setReveal(t.clientX, t.clientY);
    }, { passive: true });

    // gentle idle sweep so first-time visitors discover the effect
    let sweepT = 0, userTookOver = false;
    storySticky.addEventListener("mousemove", () => { userTookOver = true; }, { once: true });
    storySticky.addEventListener("touchstart", () => { userTookOver = true; }, { once: true });
    (function idleSweep() {
      if (userTookOver) return;
      sweepT += 0.012;
      const rect = storySticky.getBoundingClientRect();
      const x = rect.left + rect.width * (0.5 + 0.16 * Math.sin(sweepT));
      const y = rect.top + rect.height * 0.4;
      setReveal(x, y);
      requestAnimationFrame(idleSweep);
    })();
  }

  // subtle parallax on the floating icon field, reusing the same pointer
  if (!isCoarsePointer && !reduceMotion) {
    storySticky.addEventListener("mousemove", (e) => {
      const rect = storySticky.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      iconField.style.transform = `translate(${relX * -18}px, ${relY * -14}px)`;
    });
  }

  // rail-dot click → scroll straight to the middle of that stage
  railDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const [start, end] = STAGES[dot.dataset.stage];
      const mid = (start + end) / 2;
      const rect = storySection.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const targetY = window.scrollY + rect.top + mid * total;
      window.scrollTo({ top: targetY, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  /* ============================================================
     5. SCROLL-REVEAL for static sections below the story
     ============================================================ */
  const revealSections = document.querySelectorAll(".reveal-section");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealSections.forEach((el) => io.observe(el));
  } else {
    revealSections.forEach((el) => el.classList.add("is-revealed"));
  }

  /* ============================================================
     6. CONTACT FORM — mailto fallback (no backend on this build)
     ============================================================ */
  const form = document.getElementById("contactForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = data.get("name");
    const email = data.get("email");
    const message = data.get("message");
    const subject = encodeURIComponent(`Portfolio inquiry from ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:umerq7743@gmail.com?subject=${subject}&body=${body}`;
  });
})();