/* RISE · the WHY sea after the dive (2026-11-22). Client: 「index1-5-canyon-forest-rise.html 俯視山谷結束後，如圖一這樣，放射光束圓點webgl打開接
   index1-5-flow.html 為何選擇我們這區塊的設計俯視海浪海鷗岩石」.

   The dive past FOUR PATHS (flow2-lake-dive.js: the zoom into the screen centre, the radial streaks, the soft lens circle) now opens on the
   WHY FINNOVATION sea of index1-5-flow.html instead of the placeholder block: finnovation-world.js's sea leg (waves seen from above, gulls,
   islands of rock, the four cards). The page's import map keeps the engine's own world inert (flow2-scope-world.js), so the canyon never pays
   for it; this file mounts the real world module itself, under another URL, a little before FOUR PATHS, and shows it inside the dive's own
   circle (same radius and feather, read from __FLOW2_LAKE_DIVE__.curve every frame): outside the circle the streaks keep flying, inside it is
   the sea. When the circle has covered the screen the sea is the page.
   Hand: flow2-lake-zoom.js's NEXT HOOK gives the wheel / keys / touch to the sea (take); up at its first card about two notches play the dive
   back and the circle closes on the view from above.
   Rise page only (html[data-rise-studio-pbr]). ?why=0 = the placeholder block as before. Dials: ?whyFade= ?whyRim= ?whyWarm=.
   Live: window.__FLOW2_NEXT__ = { state, tune, world }. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const html = document.documentElement;
  if (Q.get('why') === '0' || Q.get('after') === '0' || !html.hasAttribute('data-rise-studio-pbr')) return;
  const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };
  const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (error) { return false; } })();
  /* DROP (2026-11-22, client: 「轉場仿照 https://cosmicenterprises.co/ 這段」 + their pictures: a bead of light, then a water drop with the next world in
     it that grows over a picture streaming toward it, until it swallows the frame). Their method, read from the page: one full-screen pass that
     zoom-blurs the old picture toward the centre and shows the next world through a screen-space drop (magnified in the middle, pressed and split
     into colour at the rim, a window highlight on its skin). Here, in our own drawing: flow2-lake-dive.js draws the bead, the zoom blur and the
     brightening (tune.drop); the sea fills the drop at once (its mask is the drop: crisp, trembling a little while small), starts small inside it
     and opens up to full size (the sea's layer is scaled, never re-laid out), and the drop's skin is one picture drawn once (fresnel tint, a thin-film
     band, a colour split at the rim, a window highlight and a low arc of reflected light) moved by transform only. ?dive=lens = the lens dive as
     before; ?dropScale=1 = no opening-up; ?dropSkin=0 = no skin. */
  const DROP = Q.get('dive') !== 'lens' && !reduced;
  const T = {
    fadeIn: num('whyFade', DROP ? .03 : .3),   // share of the circle's growth over which the sea fades in inside it (the close lake water dissolves into it)
    rim: num('whyRim', DROP ? 0 : .5),         // the thin light ring at the circle's edge (0 = none)
    scale0: num('dropScale', .64),             // DROP: the sea's size inside the newborn drop (1 = full size from the start)
    skin: num('dropSkin', 1),                  // DROP: the skin's strength
    wobble: num('dropWobble', .06),            // DROP: the trembling of the small drop (share of its radius)
    shiftPad: num('dropShift', .24),           // DROP: how far beside the first card's photo the small drop looks (short-side units; 0 = no slide)
    warm: num('whyWarm', .9)      // journey units before FOUR PATHS at which the world is fetched and built
  };
  const S = { stage: 'idle', ready: false, entered: false, error: '', t: 0, r: 0, frames: 0, warmAt: 0, readyAt: 0 };
  const clamp01 = v => Math.min(1, Math.max(0, v)), sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const study = () => window.__MONTIS_STUDY__, dive = () => window.__FLOW2_LAKE_DIVE__;
  let W = null, job = null, root = null, ring = null, raf = 0, savedFlow, lastY = 0, movedAt = 0, moving = false;
  /* finnovation-world.js reads window.__SEA_FLOW__ (main.js's 06 → 07 bridge) to fade its sea in and to hold the wheel while the bridge runs.
     That bridge never opens on this page; while the sea is up the world sees a finished bridge instead (the real one is put back after). */
  const DONE_FLOW = { open: true, target: 1, amount: 1, velocity: 0, settle() { }, close() { } };
  /* THE LOOK (client 11-22: 「顏色是要改的跟第一幕水下和山道一樣的顏色」): the sea in the colours of the first act under water and of the canyon's
     river — steel blue, measured on screen: under water ≈ #39556e (hue 208, saturation .32, lightness .33), the canyon's river ≈ #273d57,
     its sky haze ≈ #667e9e. index1-5-flow.html's own sea reads ≈ #354e5e (hue 203, .28, .29): a little greener and darker. Its colour keys
     (world-ocean.js palette(): deep / lit / ink / foam, fog and cloud colours) are set to those blues; the grade is left as it is.
     ?whyLook=original = index1-5-flow.html's sea. */
  const ORIGINAL = Q.get('whyLook') === 'original';
  const LOOK = {
    valley: 0, deep: '#335473', lit: '#7fa1c2', ink: '#1e3550', foam: '#e3ecf5', glintColor: '#e8f0f8',
    seaFog: '#9fb3c8', seaCloudLit: '#f2f6fa', seaCloudShade: '#7487a6', seaSun: '#fff1e2',
    clouds: num('whyClouds', .4), cloudOpacity: .9, cloudShadow: .35,
    /* the water's detail as on the canyon's river (client 「水的細節跟礁石可以更符合山道的部分 有點草」): finer, calmer ripples and a broad soft
       sheen instead of scattered sparkle specks; the islands' stone as the canyon walls: cool grey, a little lighter (world-ocean ROCK_LOOK) */
    waveScale: num('whyWave', .62), rough: num('whyRough', 1), glint: num('whyGlint', .75), glintSize: num('whySheen', .85), glintKnee: num('whyKnee', 2.2),
    rockGrey: num('whyRockGrey', .5), rockCool: num('whyRockCool', .6), rockBright: num('whyRockBright', 1.12)
  };
  const GRADE_SAT = num('whySat', 1);
  /* BIG ISLAND (2026-11-22, client: 「河岸礁石 要一塊島嶼大一點」 + an aerial picture of one large rocky island with its surf): on desktop the
     sea's top-right island (world-ocean-islands.js FIXED_WIDE[1], .728 / .31, size .38) becomes one large island reaching into the corner, over the
     open water above the photo (the band below holds the copy and the cards).
     That file is generated (index1-5 build), so the change is made here: world-ocean.js hands its scene to window.__FLOW2_FINE_WORLD__.sea (unused
     on this page), and the island's pose is set again whenever the sea re-lays its islands. ?whyIsle=0 = as before; ?whyIsle=k,x,y,size,turn (k = the island, 0-5). */
  /* RISE UI (2026-11-23, client: 「島嶼太大縮小一點」): on index1-5-canyon-forest-rise-ui.html (html[data-rise-ui]) the big island is 72 % of its
     size (1.05 → .76), same place and turn; ?whyIsle=1,.58,.3,1.05,.38 = the size before. The rise page keeps 1.05. */
  const ISLE_SIZE = html.hasAttribute('data-rise-ui') ? .76 : 1.05;
  const ISLE = (() => { const v = Q.get('whyIsle'); if (v === '0') return null; const a = (v || '').split(',').map(Number); return a.length === 5 && a.every(Number.isFinite) ? a : [1, .58, .3, ISLE_SIZE, .38]; })();
  if (ISLE) {
    const bigIsle = ctx => {
      try {
        const mesh = ctx?.scene?.children?.find(o => o.material && o.material === ctx.islands); const pose = mesh?.geometry?.getAttribute('aPose');
        if (!pose || pose.count < 6) return;
        let seen = -1;
        const fit = () => { if (pose.version === seen) return; const k = ISLE[0] | 0, home = [[-.744, .34], [.728, .31], [-.856, -.14], [.864, -.18], [-.416, -.45], [.448, -.49]][k];   /* FIXED_WIDE: patched only in the wide layout */
          if (home && Math.abs(pose.getX(k) - home[0]) < .02 && Math.abs(pose.getY(k) - home[1]) < .02) { pose.setXYZW(k, ISLE[1], ISLE[2], ISLE[3], ISLE[4]); pose.needsUpdate = true; S.isle = 'big'; } seen = pose.version; };
        const was = mesh.onBeforeRender; mesh.onBeforeRender = function (...args) { fit(); if (was) was.apply(this, args); };
        fit();
      } catch (error) { S.isle = 'failed: ' + (error?.message || error); }
    };
    const FW = window.__FLOW2_FINE_WORLD__;
    if (!FW) window.__FLOW2_FINE_WORLD__ = { sea: bigIsle };
    else { const prev = FW.sea; FW.sea = ctx => { try { prev?.(ctx); } finally { bigIsle(ctx); } }; }
  }

  { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'prototypes/rise/why-sea.css?v=8-ui-center'; document.head.append(l); }
  if (Q.get('whyCenter') === '0') html.setAttribute('data-rise-why-nocenter', '');   /* RISE UI (2026-11-23): the card block as before (why-sea.css, rise-ui page only) */
  /* DROP: the dive plays as a drop, a little slower (their gate takes about two seconds; ours went 1.5 / 1.2) */
  if (DROP) { const D0 = dive(); if (D0 && D0.tune) { D0.tune.drop = 1; if (!Q.has('diveTime')) D0.tune.time = 1.8; if (!Q.has('diveBack')) D0.tune.closeTime = 1.3; } }

  /* ---------------- fetch and build the world near FOUR PATHS ---------------- */
  function load() {
    if (job) return job;
    S.stage = 'loading'; S.warmAt = Math.round(performance.now());
    job = import('../index1-5-flow/js/finnovation-world.js?v=rise-why2').then(module => {
      const C = study()?.CONFIG || {};
      root = document.querySelector('#fiWorld');
      if (!root) throw new Error('#fiWorld missing');
      if (DROP && T.scale0 < 1) root.style.willChange = 'transform';   /* DROP: set once while hidden, so scaling the sea in the drop never changes how its parts are laid out */
      /* only the sea leg is ever opened here: the closing LOGO lake and the principles (the sky leg) are not built at all */
      for (const name of ['logo', 'principles']) root.querySelector(`[data-world-part="${name}"]`)?.remove();
      root.setAttribute('data-world-sea-only', '');   /* finnovation-world.js SEA_ONLY: the planet's pictures are not fetched */
      const ocean = ORIGINAL ? () => C.worldOcean : (() => { let base = null, out = null; return () => { if (C.worldOcean !== base || !out) { base = C.worldOcean; out = { ...(base || {}), ...LOOK }; } return out; }; })();
      const grade = ORIGINAL ? () => C.grade : (() => { let base, out = null; return () => { if (C.grade !== base || !out) { base = C.grade; out = { ...(base || {}), sat: (Number.isFinite(+base?.sat) ? +base.sat : 1) * GRADE_SAT }; } return out; }; })();
      W = module.mountWorld({ root, reducedMotion: reduced, grade, mist: () => C.mist, video: () => C.video, ocean, logo: () => C });
      return Promise.race([W.ready, new Promise(resolve => setTimeout(resolve, 20000))]);
    }).then(() => { S.ready = true; S.stage = 'ready'; S.readyAt = Math.round(performance.now()); prewarm(); })
      .catch(error => { S.error = String(error?.message || error); S.stage = 'failed'; console.warn('[why-sea]', error); });
    return job;
  }
  const endOf = J => { const e = window.__FLOW2_SCOPE__?.end; return Number.isFinite(e) ? Math.min(e, J.max) : J.max; };
  let aboveFor = 0;
  const warmTimer = setInterval(() => {
    const J = study()?.journey; if (!J || job) { if (job) clearInterval(warmTimer); return; }
    const td = window.__RISE_TD__?.state; aboveFor = td && td.scene && td.scene !== 'canyon' && !td.play ? aboveFor + 1 : 0;
    if (aboveFor >= 5 || J.progress > endOf(J) - T.warm || html.dataset.flow2After === 'opening') {
      clearInterval(warmTimer);
      if (window.requestIdleCallback) requestIdleCallback(() => load(), { timeout: 1200 }); else setTimeout(load, 60);
    }
  }, 400);

  /* ---------------- the circle ---------------- */
  function mask(r, f) {
    if (!root) return;
    if (r == null) { root.style.removeProperty('-webkit-mask-image'); root.style.removeProperty('mask-image'); return; }
    const g = `radial-gradient(circle at 50% 50%, #000 ${Math.max(0, r - f).toFixed(1)}px, transparent ${Math.max(.5, r + f * .35).toFixed(1)}px)`;
    root.style.setProperty('-webkit-mask-image', g); root.style.setProperty('mask-image', g);
  }
  function setRing(r, k) {
    if (!(T.rim > 0)) return;
    if (!ring) {
      ring = document.createElement('div'); ring.className = 'rise-why-ring'; ring.setAttribute('aria-hidden', 'true');
      ring.style.cssText = 'position:fixed;left:50%;top:50%;width:2px;height:2px;border-radius:50%;pointer-events:none;z-index:40;opacity:0;' +
        'border:1px solid rgb(225 242 255 / .55);box-shadow:0 0 18px 2px rgb(170 220 255 / .45),inset 0 0 26px 2px rgb(170 220 255 / .35);will-change:transform,opacity';
      document.body.append(ring);
    }
    const o = clamp01(k * T.rim);
    ring.style.opacity = o.toFixed(3);
    if (o > .001) ring.style.transform = `translate(-50%, -50%) scale(${Math.max(.001, r).toFixed(2)})`;
  }

  /* ---------------- DROP: the drop's edge, its skin, the sea opening up inside it ---------------- */
  const SKIN_N = 1024, SKIN_R = 440;
  let skin = null, skinFailed = false, scaled = '';
  function makeSkin() {
    const N = SKIN_N, c = N / 2, r = SKIN_R, TAU = Math.PI * 2;
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const g = cv.getContext('2d', { willReadFrequently: true }); if (!g) return null;   /* drawn on the CPU now, uploaded once (an accelerated canvas ran its blur on the frame the drop was born: 75 ms) */
    const disc = (r1, gr) => { g.fillStyle = gr; g.beginPath(); g.arc(c, c, r1, 0, TAU); g.fill(); };
    const radial = (r0, r1, stops) => { const gr = g.createRadialGradient(c, c, r0, c, c, r1); for (const [o, col] of stops) gr.addColorStop(o, col); return gr; };
    /* the body: clear in the middle, the water's tint gathering toward the rim (fresnel), a bright meniscus on the skin */
    disc(r, radial(r * .5, r, [[0, 'rgba(196,232,244,0)'], [.62, 'rgba(196,232,244,.05)'], [.86, 'rgba(204,238,250,.2)'], [.965, 'rgba(226,248,255,.48)'], [1, 'rgba(255,255,255,.95)']]));
    /* thin film: a band of shifting colour just inside the rim */
    if (g.createConicGradient) {
      const fc = document.createElement('canvas'); fc.width = fc.height = N; const f = fc.getContext('2d');
      const cg = f.createConicGradient(-.6, c, c); ['#ff9fd2', '#ffe39a', '#a6ffd0', '#8fd6ff', '#b9a2ff', '#ff9fd2'].forEach((col, i, a) => cg.addColorStop(i / (a.length - 1), col));
      f.fillStyle = cg; f.fillRect(0, 0, N, N);
      f.globalCompositeOperation = 'destination-in';
      const m = f.createRadialGradient(c, c, r * .86, c, c, r * .995); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(.6, 'rgba(0,0,0,.6)'); m.addColorStop(.85, 'rgba(0,0,0,.45)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = m; f.fillRect(0, 0, N, N);
      g.globalAlpha = .45; g.drawImage(fc, 0, 0); g.globalAlpha = 1;
    }
    /* the colour split at the rim: warm just outside, cool just inside */
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,176,156,.34)'; g.beginPath(); g.arc(c, c, r * 1.006, 0, TAU); g.stroke();
    g.lineWidth = 4; g.strokeStyle = 'rgba(140,204,255,.3)'; g.beginPath(); g.arc(c, c, r * .975, 0, TAU); g.stroke();
    /* a soft light just outside the skin */
    g.fillStyle = radial(r, r * 1.13, [[0, 'rgba(222,246,255,.42)'], [1, 'rgba(222,246,255,0)']]); g.beginPath(); g.arc(c, c, r * 1.13, 0, TAU); g.arc(c, c, r, 0, TAU, true); g.fill('evenodd');
    /* the light on the skin: a soft window high on the left with a small sharp glint, a thin arc of reflected light low on the right */
    const spot = (x, y, rr, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); };
    spot(c - r * .38, c - r * .42, r * .32, .34);
    g.save(); g.translate(c - r * .47, c - r * .5); g.rotate(-.75); g.scale(1, .42); spot(0, 0, r * .13, .8); g.restore();
    g.save(); if ('filter' in g) g.filter = 'blur(5px)'; g.lineCap = 'round'; g.lineWidth = r * .04; g.strokeStyle = 'rgba(236,250,255,.32)'; g.beginPath(); g.arc(c, c, r * .885, .3, 1.35); g.stroke(); g.restore();
    cv.className = 'rise-why-drop'; cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;left:50%;top:50%;width:' + N + 'px;height:' + N + 'px;pointer-events:none;z-index:40;opacity:0;will-change:transform,opacity';
    document.body.append(cv);
    return cv;
  }
  function setSkin(rx, ry, k) {
    if (!(T.skin > 0) || skinFailed) return;
    const o = clamp01(k * T.skin);
    if (!skin) { if (o < .002) return; try { skin = makeSkin(); } catch (error) { skin = null; } if (!skin) { skinFailed = true; return; } }
    if (o < .002) { if (skin.style.opacity !== '0') skin.style.opacity = '0'; return; }
    skin.style.opacity = o.toFixed(3);
    skin.style.transform = 'translate(-50%, -50%) scale(' + (rx / SKIN_R).toFixed(4) + ', ' + (ry / SKIN_R).toFixed(4) + ')';
  }
  function setXform(tx, v) {
    const next = v < .9995 || Math.abs(tx) > .25 ? 'translate(' + tx.toFixed(1) + 'px, 0) scale(' + v.toFixed(4) + ')' : '';
    if (next !== scaled && root) { scaled = next; root.style.transform = next; }
  }
  /* cx = the drop's centre in the sea's own (untransformed) px */
  function maskDrop(rx, ry, f, cx) {
    const g = 'radial-gradient(' + rx.toFixed(1) + 'px ' + ry.toFixed(1) + 'px at ' + cx.toFixed(1) + 'px 50%, #000 ' + Math.max(0, rx - f).toFixed(1) + 'px, transparent ' + Math.max(.5, rx + f * .35).toFixed(1) + 'px)';
    root.style.setProperty('-webkit-mask-image', g); root.style.setProperty('mask-image', g);
  }
  /* the sea's first card has its photo (drawn by the world's WebGL, so it cannot fade with the cards) across the screen's centre: while the drop
     is small it looks at the water beside the photo, and slides to the composed view as it opens (their drop drifts to the centre the same way).
     Read once right after the world has entered (its layout is fresh then: no extra layout). */
  let shiftX = 0;
  function measureShift() {
    shiftX = 0; if (!DROP || !root || !(T.shiftPad > 0)) return;
    try {
      const w = innerWidth, h = innerHeight, cx = w / 2, m = Math.min(w, h), pad = T.shiftPad * m;
      const ph = [...root.querySelectorAll('.fiwo-photo')].map(e => e.getBoundingClientRect()).find(r => r.width > 20 && r.right > 0 && r.left < w && r.bottom > 0 && r.top < h);
      if (!ph || !(ph.left - pad < cx && ph.right + pad > cx)) return;
      const tx = (ph.left + ph.right) / 2 > cx ? cx - (ph.left - pad) : cx - (ph.right + pad);
      shiftX = Math.abs(tx) < w * .3 ? tx : 0;
    } catch (error) { shiftX = 0; }
    S.dropShift = Math.round(shiftX);
  }
  /* one frame of the drop: c = the dive's curve, u = the drop's growth 0 → 1, m = the short side in px */
  function dropFrame(c, u, m) {
    const wob = T.wobble * (1 - sm(0, .35, u)) * Math.sin(performance.now() * .0138);   /* ≈ 2.2 trembles a second while small, taut once grown */
    const R = c.R * m, rx = R * (1 + wob), ry = R * (1 - wob), f = Math.max(.75, c.F * m);
    /* the sea starts small inside the drop and opens up; never so small that the drop shows past its edge */
    const tx = shiftX * (1 - sm(.25, .7, u)), w = innerWidth;
    const s = T.scale0 >= 1 && !tx ? 1 : Math.min(1, Math.max(T.scale0 + (1 - T.scale0) * sm(0, .55, u), 2.04 * c.R * (1 + Math.abs(wob)), 2.04 * (Math.max(rx, ry) + Math.abs(tx)) / w));
    maskDrop(rx / s, ry / s, f / s, w / 2 - tx / s); setXform(tx, s);
    root.style.opacity = sm(0, T.fadeIn, u).toFixed(3);
    cardsAt(sm(.4, .78, u));
    setSkin(rx, ry, sm(0, .03, u) * (1 - sm(.5, .8, u)));
  }
  function dropOff() { setSkin(0, 0, 0); setXform(0, 1); }
  /* the skin is drawn and shown at opacity .001 ahead of the drop (at the rest's prewarm, else in the dive's first frames), so its upload never lands on the drop's birth */
  function warmSkin(on) {
    if (!DROP || !(T.skin > 0) || skinFailed) return;
    if (!skin) { try { skin = makeSkin(); } catch (error) { skin = null; } if (!skin) { skinFailed = true; return; } }
    if (on) { skin.style.transform = 'translate(-50%, -50%) scale(.05)'; skin.style.opacity = '0.001'; } else skin.style.opacity = '0';
  }
  /* the sea's cards and labels come in once the drop is large (small, it shows only water: a card's straight edge in a small drop read as a hole, not a drop).
     Inline opacity on two layers (.fiw-viewport, .fiw-pins), never below .002 so they are rasterised before they show; '' = as the world has them. */
  let cards = null, cardsV = null;
  function cardsAt(v) {
    if (!DROP || !root) return;
    if (!cards) cards = [root.querySelector('.fiw-viewport'), root.querySelector('.fiw-pins')].filter(Boolean);
    const key = v == null ? 'off' : v >= 1 ? 'on' : Math.max(.002, v).toFixed(3);
    if (key === cardsV) return; cardsV = key;
    for (const e of cards) { e.style.opacity = key === 'off' || key === 'on' ? '' : key; e.style.willChange = key === 'off' ? '' : 'opacity'; }
  }

  /* the canyon engine draws nothing while the sea covers the screen (main.js FLOW2_COVER) */
  let covered = false;
  function cover(on) { if (on === covered) return; covered = on; window.__FLOW2_COVER__ = on; }
  /* the dive has finished before the sea is ready (a very fast visitor): its last picture, the navy, stands until it is, never the old placeholder */
  let veil = null;
  function setVeil(on) {
    if (on && !veil) {
      veil = document.createElement('div'); veil.className = 'rise-why-veil'; veil.setAttribute('aria-hidden', 'true');
      veil.style.cssText = 'position:fixed;inset:0;z-index:39;pointer-events:none;opacity:0;transition:opacity .5s ease;background:radial-gradient(120% 90% at 50% 0%,#10314f 0%,#0a1d33 46%,#061222 100%)';
      document.body.append(veil);
    }
    if (veil) requestAnimationFrame(() => { veil.style.opacity = on ? '1' : '0'; });
  }
  let waiting = false;
  /* the page HUD reads chapter 03 while the sea is up (flow2-hud.js follows .finnovation-ui[data-site-section]; the rail its aria-current) */
  let sectionWas = null;
  function chapter(on) {
    const ui = document.querySelector('.finnovation-ui'); if (!ui) return;
    if (on) { if (sectionWas == null) sectionWas = ui.dataset.siteSection ?? '1'; ui.dataset.siteSection = '2'; }
    else if (sectionWas != null) { ui.dataset.siteSection = sectionWas; sectionWas = null; }
    const i = ui.dataset.siteSection;
    ui.querySelectorAll('.fi-rail [data-section], .fi-menu-links [data-section]').forEach(b => { if (b.dataset.section === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  }
  function enter(quiet) {
    if (S.entered || !W) return;
    savedFlow = window.__SEA_FLOW__; window.__SEA_FLOW__ = DONE_FLOW;
    mask(0, 1); root.style.opacity = '0';
    W.enter(0, 'sea'); measureShift();
    S.entered = true; S.quiet = !!quiet;
    if (!quiet) { html.setAttribute('data-rise-why', 'on'); chapter(true); }
  }
  /* once, while the visitor rests on the view from above: the sea is drawn for a few frames behind a closed circle, so its programs are linked
     and its textures uploaded before the dive (measured: ≈ 1.8 s of first-use shader linking landed inside the dive otherwise) */
  function prewarm() {
    if (S.prewarmed || reduced) return;
    const go = () => {
      const J = study()?.journey;
      if ((html.dataset.flow2After || 'off') !== 'off' || S.entered) return;
      if (J && performance.now() - (J.lastInput || 0) < 900) { setTimeout(go, 400); return; }
      S.prewarmed = performance.now(); enter(true); warmSkin(true); cardsAt(0);
      let n = 0; const step = () => { if (++n < 4) { requestAnimationFrame(step); return; } if ((html.dataset.flow2After || 'off') === 'off' && S.quiet) { warmSkin(false); leave(); } S.prewarmMs = Math.round(performance.now() - S.prewarmed); };
      requestAnimationFrame(step);
    };
    setTimeout(go, 600);
  }
  function leave() {
    if (!S.entered) return;
    if (!S.quiet) chapter(false);
    S.quiet = false;
    try { W.close(); } catch (error) { S.error = String(error?.message || error); }
    window.__SEA_FLOW__ = savedFlow; savedFlow = undefined;
    mask(null); root.style.opacity = ''; setRing(0, 0); dropOff(); cardsAt(null); cover(false); setVeil(false); waiting = false;
    S.entered = false; html.removeAttribute('data-rise-why'); html.removeAttribute('data-rise-why-moving'); moving = false;
  }
  /* SMOOTH (2026-11-22, client: 「俯視山谷>俯視橫移這區塊時候，不夠順暢」 → 「先修卡頓」). Measured on the rise page (high quality): each flip of a
     page-wide state restyles most of the document — data-flow2-after 25 ms (flow2-lake-zoom.js, four per trip), data-rise-why 23 ms (15 ms since
     why-sea.css lost its universal selector), body.is-world 22 ms, body.is-world-dark 12 ms, the HUD's section 11 ms — and the world's enter forces
     a layout (≈ 31 ms), its close ≈ 24 ms. They used to land together: two frames of 54–63 ms on the dive's first frames, 45 + 35 ms when the view
     from above is back. Now they are staged, one per frame with a free frame between: going in, inside the dive's first 17 % (the circle is not
     born yet, nothing of the sea shows); coming back, after the dive has closed. The world sets is-world / is-world-dark itself on its first frame;
     staged ahead of it (and taken off before its close) it finds them as it would have set them and leaves them. Nothing on screen changes.
     ?whySplit=0 = the old single-frame enter and leave. */
  const SPLIT = Q.get('whySplit') !== '0';
  const body = document.body;
  let queue = [], qRaf = 0, qKind = '';
  function qStop() { if (qRaf) cancelAnimationFrame(qRaf); qRaf = 0; queue = []; qKind = ''; }
  function qRun(kind, steps, valid) {
    qStop(); queue = steps; qKind = queue.length ? kind : ''; if (!queue.length) return;
    let skip = 1;   /* a free frame before each step (the frame that started the stage has its own work) */
    const tick = () => {
      qRaf = 0;
      if (!valid()) { qStop(); kick(); return; }
      if (skip-- > 0) { qRaf = requestAnimationFrame(tick); return; }
      const f = queue.shift(); try { f(); } catch (error) { S.error = String(error?.message || error); }
      skip = 1;
      if (queue.length) qRaf = requestAnimationFrame(tick); else qKind = '';
      S.staged = (S.staged || 0) + 1;
    };
    qRaf = requestAnimationFrame(tick);
  }
  function qFlush() { const list = queue; qStop(); for (const f of list) { try { f(); } catch (error) { S.error = String(error?.message || error); } } }
  const inSection = () => document.querySelector('.finnovation-ui')?.dataset.siteSection === '2';
  function enterWorld() {
    if (S.entered || !W) return;
    savedFlow = window.__SEA_FLOW__; window.__SEA_FLOW__ = DONE_FLOW;
    mask(0, 1); root.style.opacity = '0';
    W.enter(0, 'sea'); measureShift();
    S.entered = true; S.quiet = true;   /* shown by the next steps */
  }
  /* site-layout.css (shared by the index1-5 family) hides the footer's parts in the world with `html body.is-world .finnovation-ui .fi-footer >
     :not(.fi-sound)`: a last compound with nothing but a :not() makes each body.is-world flip restyle the whole document (measured 14 of its 20 ms).
     On this page only, the same rule names the footer's own children by class (same declarations, same specificity: :where adds none). */
  (function patchFooterRule() {
    if (!SPLIT) return;
    try {
      const foot = document.querySelector('.finnovation-ui .fi-footer'); if (!foot) return;
      const cls = [...foot.children].filter(e => !e.classList.contains('fi-sound')).map(e => e.classList[0]);
      if (!cls.length || cls.some(c => !c)) return;
      const SEL = 'html body.is-world .finnovation-ui .fi-footer > :not(.fi-sound)';
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch (error) { continue; }
        for (let i = 0; i < rules.length; i++) {
          if (rules[i].selectorText !== SEL) continue;
          const decl = rules[i].style.cssText;
          sheet.deleteRule(i);
          sheet.insertRule(`html body.is-world .finnovation-ui .fi-footer > :is(${cls.map(c => '.' + CSS.escape(c)).join(', ')}):where(:not(.fi-sound)) { ${decl} }`, i);
          S.footerRule = 'patched'; return;
        }
      }
    } catch (error) { S.footerRule = 'failed: ' + (error?.message || error); }
  })();
  function inSteps() {
    const steps = [];
    if (DROP && !skin && !skinFailed && T.skin > 0) steps.push(() => warmSkin(true));
    if (!body.classList.contains('is-world')) steps.push(() => body.classList.add('is-world'));
    if (!body.classList.contains('is-world-dark')) steps.push(() => body.classList.add('is-world-dark'));
    if (!S.entered) steps.push(enterWorld);
    if (!html.hasAttribute('data-rise-why')) steps.push(() => html.setAttribute('data-rise-why', 'on'));
    if (!inSection() || S.quiet || !S.entered) steps.push(() => { if (S.entered) S.quiet = false; chapter(true); });
    return steps;
  }
  function stageOut() {
    if (!SPLIT) { leave(); return; }
    if (qKind === 'out') return;
    /* frame N (the dive has closed; flow2-lake-zoom.js restyles the page for data-flow2-after = off in this frame): only what costs nothing */
    mask(0, 1); if (root) root.style.opacity = '0'; setRing(0, 0); dropOff(); cover(false); setVeil(false); waiting = false;
    if (moving) { html.removeAttribute('data-rise-why-moving'); moving = false; }
    const quiet = S.quiet, steps = [];
    if (body.classList.contains('is-world-dark')) steps.push(() => body.classList.remove('is-world-dark'));
    if (body.classList.contains('is-world')) steps.push(() => body.classList.remove('is-world'));
    if (S.entered) steps.push(() => {
      S.quiet = false;
      try { W.close(); } catch (error) { S.error = String(error?.message || error); }
      window.__SEA_FLOW__ = savedFlow; savedFlow = undefined;
      mask(null); root.style.opacity = ''; cardsAt(null); S.entered = false;
    });
    if (html.hasAttribute('data-rise-why')) steps.push(() => html.removeAttribute('data-rise-why'));
    if (!quiet) steps.push(() => chapter(false));
    qRun('out', steps, () => (html.dataset.flow2After || 'off') === 'off');
  }

  /* every frame while the dive plays (or the sea is up): the circle follows the dive's own */
  function frame() {
    raf = 0;
    const st = html.dataset.flow2After || 'off';
    S.stage = st === 'off' ? (S.ready ? 'ready' : S.stage) : st;
    if (!W || !S.ready) { if (st === 'off') { setVeil(false); waiting = false; } else raf = requestAnimationFrame(frame); return; }
    if (waiting) { waiting = false; enter(); mask(null); root.style.opacity = ''; setVeil(false); }
    if (st === 'off') { stageOut(); return; }
    if (qKind === 'out') qStop();   /* a new dive while the way back was still being tidied: the entry below picks up what is missing */
    const D = dive(), w = innerWidth, h = innerHeight, m = Math.min(w, h);
    const t = st === 'in' ? 1 : clamp01(D?.state?.t ?? 0);
    /* SMOOTH: before the circle is born the entry is staged over the next frames; from just before it, whatever is left happens at once */
    const early = SPLIT && !reduced && st === 'opening' && !!D && t < (+D.tune.t0 || .17) * .85;
    if (early && qKind !== 'in') { const steps = inSteps(); if (steps.length) qRun('in', steps, () => (html.dataset.flow2After || 'off') === 'opening'); }
    if (!early && qKind === 'in') qFlush();
    if (qKind !== 'in') {
      if (!S.entered) enter();
      else if (S.quiet) { S.quiet = false; html.setAttribute('data-rise-why', 'on'); chapter(true); }
    }
    S.t = t; S.frames++;
    /* moving between two cards? (the read at the right steps aside, why-sea.css) */
    if (st === 'in') { const y = W.y, now = performance.now(); if (Math.abs(y - lastY) > .5) movedAt = now; lastY = y; const mv = now - movedAt < 160; if (mv !== moving) { moving = mv; html.toggleAttribute('data-rise-why-moving', mv); } }
    if (!D || t >= D.tune.t1) { mask(null); root.style.opacity = ''; setRing(0, 0); if (DROP) { dropOff(); cardsAt(1); } S.r = -1; cover(st === 'in'); }
    else {
      const c = D.curve(t, w / h), u = clamp01((t - D.tune.t0) / (D.tune.t1 - D.tune.t0));
      /* SMOOTH: once the world has entered (the third staged step), the sea's page stands at opacity .002 behind the unborn circle (invisible: the mask is closed too),
         so its cards and type are rasterised now, while the dive has barely moved; at 0 the GPU rasterised them on the frame the circle is born
         (measured: a 42–55 ms frame, 17 ms of it in raster) */
      if (c.R <= .002) { mask(0, 1); root.style.opacity = SPLIT && S.entered && st === 'opening' ? '0.002' : '0'; setRing(0, 0); if (DROP) { if (S.entered && st === 'opening') { warmSkin(true); cardsAt(0); setXform(0, 1); } else dropOff(); } }
      else if (DROP && c.drop) dropFrame(c, u, m);
      else {
        mask(c.R * m, c.F * m);
        root.style.opacity = (reduced ? 1 : sm(0, T.fadeIn, u)).toFixed(3);
        setRing(c.R * m * 2, sm(.04, .3, u) * (1 - sm(.7, 1, u)));
      }
      S.r = c.R; cover(false);
    }
    raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  new MutationObserver(kick).observe(html, { attributes: true, attributeFilter: ['data-flow2-after'] });

  window.__FLOW2_NEXT__ = {
    state: S, tune: T, get world() { return W; }, load,
    get enabled() { return S.stage !== 'failed'; },
    /* flow2-lake-zoom.js: the dive has finished (on) / starts back (off) */
    show(on) {
      if (on && !(S.ready && W)) { waiting = true; setVeil(true); load(); kick(); return; }
      if (on) { enter(); mask(null); root.style.opacity = ''; setRing(0, 0); }
      kick();
    },
    /* the hand while the sea is up: true = taken; false (up at the first card) = the dive may play back */
    take(d) {
      if (!W || !S.entered) return d > 0;
      const r = W.take(d / Math.max(720, innerHeight * .85), 'wheel');
      return d > 0 ? true : r !== false;
    }
  };
})();
