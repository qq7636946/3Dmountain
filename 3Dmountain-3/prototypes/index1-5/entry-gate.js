/* index1-5 entry gate (2026-11-04; first on the test page index1-5-enter, live since the client said 「套到正式頁」). Inlined into index1-5.html by entry-gate-build.cjs, right after its markup, so it runs at first paint.
   Client: no picture first; a LOADING cover, the drop fading in, then the choice of sound; the counter made of points of light, the specks in the water,
   the corner readout, the two buttons, after junkbranding.com (our water and our type, not their site); letters that arrive out of a blur, after ysuriadesign.co.
   Second pass the same day (client: 「load 有亮點，用 CSS 做就好，比較省資源」「上方要加這種 menu 跟內頁一樣」): the cover is CSS only, no WebGL and no
   WebGL. The specks are SVG tiles drawn once here and moved by the compositor. The count first was Oswald filled with a dot tile; the client
   wanted the digits to move like junkbranding's (「文字的跳動要跟我提供給你的網址一樣」), which CSS cannot do, so it is points on a small 2D canvas.
   The site's own header comes in with the choice, and works: a click on it enters (muted) and does what it says.
   0 s     the cover: deep water, light from above, drifting specks, a few bright glints; the count drawn in points of light
   …       it counts the first batch, what has really arrived and been made ready: files, the scene's assets, the first frame, the journey
   100     the number scatters; the cover goes, the live drop comes into focus; the header comes down; then ENTER WITH SOUND / WITHOUT SOUND,
           while the second batch (the cards, the world) is prepared behind the choice
   enter   the click starts the water sound (only a click may); if the second batch is still coming the button fills until it is all there;
           then the drop lights up and shivers, the interface comes in, the scroll is let go
   It does not touch main.js: it reads body.is-ready, the scene's own "LOADING SCENE n%" note and __MONTIS_STUDY__ (warmEpilogue: epilogue-warm-build.cjs).
   Keys other than the scroll keys go on to the page while the gate holds, so the tuning panels (T, C, L, M) open on the gate too.
   Flags: ?gate=0 the live page's boot; ?gate=auto enters (muted) by itself when ready (QA); ?view=… (previews) skips it. QA: window.__GATE__. */
(() => {
  const root = document.documentElement, gate = document.getElementById('gate'), loader = document.getElementById('loader');
  const query = new URLSearchParams(location.search);
  if (!gate || query.get('gate') === '0' || query.has('view')) { root.dataset.gate = 'off'; gate?.remove(); return; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, coarse = matchMedia('(pointer: coarse)').matches;
  const $ = s => gate.querySelector(s);
  const status = $('.gate-sr');
  const hudFiles = $('.gate-files'), hudMb = $('.gate-mb'), hudStage = $('.gate-stage-en'), hudStageZh = $('.gate-stage-zh');
  const buttons = [...gate.querySelectorAll('.gate-btn')];
  const G = window.__GATE__ = { state: 'boot', target: 0, shown: 0, marks: {}, enter: sound => enter(!!sound) };
  const mark = key => { G.marks[key] ??= Math.round(performance.now()); };

  /* letters out of a blur: every [data-split] gets its characters wrapped, each with its place in the line */
  for (const el of gate.querySelectorAll('[data-split]')) {
    let i = 0;
    const wrap = node => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) { const frag = document.createDocumentFragment(); for (const ch of child.textContent) { const s = document.createElement('span'); s.className = 'gate-ch'; s.style.setProperty('--i', i++); s.textContent = ch; frag.append(s); } child.replaceWith(frag); }
        else if (child.nodeType === 1) wrap(child);
      }
    };
    wrap(el);
  }

  /* ------------------------------------------------------------ the cover's specks: SVG tiles drawn once, the CSS moves them */
  let seed = 20261104;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  /* n dots in a w×h tile that repeats without a seam (a dot over an edge is drawn again on the other side) */
  function tile(w, h, n, [r0, r1], [a0, a1], soft) {
    let s = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>`;
    if (soft) s += `<defs><radialGradient id='g'><stop offset='0' stop-color='#fff'/><stop offset='.28' stop-color='#e4f3ff' stop-opacity='.7'/><stop offset='1' stop-color='#a9dcff' stop-opacity='0'/></radialGradient></defs>`;
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h, r = r0 + (r1 - r0) * rnd() ** 2, a = a0 + (a1 - a0) * rnd();
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
        const cx = x + dx, cy = y + dy;
        if (cx + r < 0 || cx - r > w || cy + r < 0 || cy - r > h) continue;
        s += `<circle cx='${cx.toFixed(1)}' cy='${cy.toFixed(1)}' r='${r.toFixed(2)}' fill='${soft ? 'url(#g)' : '#eaf6ff'}' fill-opacity='${a.toFixed(2)}'/>`;
      }
    }
    return `url("data:image/svg+xml,${encodeURIComponent(s + '</svg>')}")`;
  }
  const sea = loader?.querySelector('.gate-sea');
  if (sea) {
    const k = coarse ? .6 : 1;
    sea.style.setProperty('--dust-far', tile(300, 300, Math.round(70 * k), [.5, 1.1], [.25, .7]));
    sea.style.setProperty('--dust-mid', tile(460, 460, Math.round(34 * k), [1, 2.2], [.35, .85]));
    sea.style.setProperty('--dust-near', tile(720, 720, Math.round(12 * k), [6, 15], [.14, .34], true));
    /* the bright glints: a few points that flare and fade, each on its own clock */
    const glints = sea.querySelector('.gate-glints');
    for (let i = 0, n = coarse ? 9 : 16; glints && i < n; i++) {
      const g = document.createElement('i');
      g.style.cssText = `left:${(4 + rnd() * 92).toFixed(1)}%;top:${(6 + rnd() * 88).toFixed(1)}%;--s:${(.6 + rnd() * .9).toFixed(2)};animation-duration:${(3.2 + rnd() * 3.6).toFixed(2)}s;animation-delay:${(-rnd() * 6).toFixed(2)}s`;
      glints.append(g);
    }
  }
  requestAnimationFrame(() => { gate.classList.add('is-in'); sea?.classList.add('is-on'); });

  /* ------------------------------------------------------------ the count: points of light that gather into the number (after junkbranding.com)
     The number does not tick every percent: it jumps (at most every 0.8 s), and at each jump the points of the digits that changed are thrown
     into a loose cloud and gather into the new digits; a digit that stays keeps its points. At 100 they burst into the water.
     A 2D canvas, no WebGL: about 2,600 points (1,500 on a phone), each frame one rect per point in a few fills, while the count runs only. */
  const count = (() => {
    const canvas = $('.gate-count'), ctx = canvas?.getContext('2d');
    if (!ctx) return null;
    const N = coarse ? 1500 : 2600;
    const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N), tx = new Float32Array(N), ty = new Float32Array(N), ph = new Float32Array(N);
    let W = 1, H = 1, dpr = 1, fontPx = 100, advance = 60, cx = 0, cy = 0, glyphs = {}, text = '', typed = false, burstAt = 0, alpha = 0, last = performance.now(), running = true;
    const ink = document.createElement('canvas'), ictx = ink.getContext('2d', { willReadFrequently: true });
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      /* about a third of the height: smaller numerals hold their points closer together, so the strokes read bright */
      fontPx = Math.round(W < 700 ? Math.min(H * .27, W * .4) : Math.min(H * .32, W * .27));
      cx = W * .5; cy = H * .43; glyphs = {};
      ictx.font = `300 ${fontPx}px "Oswald", "Arial Narrow", sans-serif`; advance = ictx.measureText('0').width * 1.06;
    }
    /* a digit's ink, drawn once in Oswald Light, 300 (client: 「字要細的」「300」) and sampled; points relative to the middle of its ink */
    function glyph(d) {
      if (glyphs[d]) return glyphs[d];
      ink.width = Math.ceil(fontPx * .9); ink.height = Math.ceil(fontPx * 1.2);
      ictx.clearRect(0, 0, ink.width, ink.height); ictx.fillStyle = '#fff'; ictx.textAlign = 'center'; ictx.textBaseline = 'middle';
      ictx.font = `300 ${fontPx}px "Oswald", "Arial Narrow", sans-serif`; ictx.fillText(d, ink.width / 2, ink.height / 2);
      const data = ictx.getImageData(0, 0, ink.width, ink.height).data, pts = [], step = Math.max(1, Math.round(fontPx / 200));
      let top = Infinity, bottom = -Infinity;
      for (let j = 0; j < ink.height; j += step) for (let i = 0; i < ink.width; i += step) if (data[(j * ink.width + i) * 4 + 3] > 128) { pts.push(i - ink.width / 2, j); top = Math.min(top, j); bottom = Math.max(bottom, j); }
      const mid = (top + bottom) / 2;
      for (let k = 1; k < pts.length; k += 2) pts[k] -= mid;
      return (glyphs[d] = { pts, step });
    }
    /* each digit of the number gets its share of the points; a digit that changed (or a number that got longer) is re-formed through a cloud */
    function set(next, kick = true) {
      const L = next.length, same = L === text.length;
      for (let k = 0; k < L; k++) {
        if (same && next[k] === text[k]) continue;
        const { pts, step } = glyph(next[k]), n = pts.length / 2; if (!n) continue;
        const sx = cx + (k - (L - 1) / 2) * advance, a = Math.floor(k * N / L), b = Math.floor((k + 1) * N / L);
        for (let i = a; i < b; i++) {
          const q = Math.floor(Math.random() * n) * 2, stray = Math.random() < .06 ? fontPx * .035 : step * .9;
          tx[i] = sx + pts[q] + (Math.random() - .5) * 2 * stray; ty[i] = cy + pts[q + 1] + (Math.random() - .5) * 2 * stray;
          if (reduce) { x[i] = tx[i]; y[i] = ty[i]; }
          else if (kick) { const s = fontPx * (1.2 + Math.random() * 2.2); vx[i] += (Math.random() - .5) * s; vy[i] += (Math.random() - .5) * s * .8; }
        }
      }
      text = next;
    }
    size();
    /* the points start scattered through the water and gather into the first digit once Oswald is in */
    for (let i = 0; i < N; i++) { x[i] = tx[i] = W * (.15 + Math.random() * .7); y[i] = ty[i] = H * (.1 + Math.random() * .8); ph[i] = Math.random() * 6.283; }
    addEventListener('resize', () => { const t = text; size(); text = ''; if (typed) set(t, false); });
    const TONES = [['#ffffff', 1.9, 7], ['#eef8fff0', 1.5, 3], ['#cfe9ffb8', 1.15, 0]];   /* colour, size, which points (i % 8: 0 → 7, 1–3 → 3, the rest → 0) */
    function draw(now) {
      if (!running) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
      const bursting = burstAt > 0, life = bursting ? Math.max(0, 1 - (now - burstAt) / 1700) : 1;
      alpha = Math.min(1, alpha + dt / 1.1);
      /* the gathering: each point springs to its place (about half a second, a little overshoot), pulled through the cloud */
      const w = 10.5, w2 = w * w, c = 2 * .72 * w, drag = Math.exp(-dt * 1.5);
      for (let i = 0; i < N; i++) {
        if (bursting) { vx[i] *= drag; vy[i] = vy[i] * drag - 14 * dt; }
        else { vx[i] += (w2 * (tx[i] - x[i]) - c * vx[i]) * dt; vy[i] += (w2 * (ty[i] - y[i]) - c * vy[i]) * dt; }
        x[i] += vx[i] * dt; y[i] += vy[i] * dt;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * life;
      for (const [colour, s, kind] of TONES) {
        ctx.fillStyle = colour; ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const m = i % 8, k = m === 0 ? 7 : m < 4 ? 3 : 0; if (k !== kind) continue;
          /* a little life in every point: it trembles where it is */
          ctx.rect(x[i] + Math.sin(t * 2.1 + ph[i]) * .45 - s / 2, y[i] + Math.cos(t * 1.7 + ph[i] * 1.3) * .45 - s / 2, s, s);
        }
        ctx.fill();
      }
      /* the bright few: a point in about forty flares now and then */
      ctx.fillStyle = '#ffffff'; ctx.beginPath();
      for (let i = 5; i < N; i += 41) { const f = Math.sin(t * 2.4 + ph[i] * 3); if (f > .55) { const s = 1.6 + 2.6 * (f - .55); ctx.rect(x[i] - s / 2, y[i] - s / 2, s, s); } }
      ctx.fill();
      if (bursting && life <= 0) { running = false; canvas.remove(); return; }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    return {
      get text() { return text; },
      ready() { typed = true; set(text || '0'); },
      set(next) { if (typed && next !== text) set(next); },
      /* 100: the points are thrown out, wide more than high, slow down in the water and fade */
      burst() {
        burstAt = performance.now();
        if (reduce) return;
        for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, s = fontPx * (.6 + Math.random() * 2.6); vx[i] = Math.cos(a) * s * 1.9; vy[i] = Math.sin(a) * s * .7 - fontPx * .15; }
      },
    };
  })();
  /* the numerals wait for Oswald (preloaded), so the count never forms in a stand-in face */
  Promise.race([document.fonts?.load('300 200px "Oswald"') ?? Promise.resolve(), new Promise(r => setTimeout(r, 1800))]).catch(() => {}).then(() => count?.ready());

  /* ------------------------------------------------------------ what has really arrived and been made ready */
  const EXPECT = coarse ? 94 : 100;   /* requests before the hero: about 98 on a desktop, 92 on a phone (2026-11-04) */
  let requests = 0, bytes = 0;
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) { requests++; bytes += e.transferSize || e.encodedBodySize || 0; } }).observe({ type: 'resource', buffered: true }); } catch { requests = EXPECT * .5; }
  let assets = 0;
  const note = loader?.querySelector('.loader-note');
  if (note) new MutationObserver(() => {
    const text = note.textContent || '', m = /(\d+)\s*%/.exec(text);
    if (/READY/.test(text)) assets = 1; else if (m) assets = Math.max(assets, m[1] / 100);
  }).observe(note, { childList: true, characterData: true, subtree: true });
  /* Two batches (client: 「選擇聲音時候也可以繼續載入，分批載入，讓客戶進去＝都好了」): the count stands for the first, the scene and the journey;
     the second, the cards and the world (warmEpilogue), is prepared while the visitor reads the choice. Entering waits for both (see enter). */
  let warming = false;
  const warm = () => {
    const S = window.__MONTIS_STUDY__;
    if (S?.chapterReady?.journey && !warming && S.warmEpilogue) { warming = true; mark('warm'); S.warmEpilogue(); }
  };
  /* the second batch: 1 when the cards and the world are ready (or the page has no warm-up); in between an estimate that keeps moving */
  function rest(now) {
    const S = window.__MONTIS_STUDY__, W = S?.epilogueWarm;
    if (!S?.warmEpilogue || W?.world) return 1;
    if (W?.cards) return .55 + .4 * (1 - Math.exp(-(now - (G.marks.cards ??= Math.round(now))) / 2500));
    return warming ? .08 + .42 * (1 - Math.exp(-(now - G.marks.warm) / 2200)) : 0;
  }
  function aim(now) {
    const S = window.__MONTIS_STUDY__;
    if (G.state !== 'boot') {
      warm();
      /* a slow device: the journey still not ready 20 s after the drop came up. Let the count end; the page goes on preparing */
      if (now - G.marks.hero > 20000 || S?.chapterReady?.journey) return 1;
      return Math.max(S?.chapterReady?.logo ? .8 : 0, .62 + .3 * (1 - Math.exp(-(now - G.marks.hero) / 1500)));
    }
    const net = Math.min(1, requests / EXPECT);
    let p = .4 * net;
    if (assets > 0) p = Math.max(p, .4 + .12 * assets);
    /* then the scene is built on the CPU (terrain, shaders), with nothing to count: the counter keeps creeping towards .59, so it never stands still */
    if (net > .9 || assets >= 1) { G.creepFrom ??= now; p = Math.max(p, .52 + .07 * (1 - Math.exp(-(now - G.creepFrom) / 2600))); }
    return Math.min(.59, p);
  }
  const STAGES = [[.4, 'GATHERING WATER', '匯聚水氣'], [.6, 'SHAPING THE DROP', '凝成水滴'], [1, 'OPENING THE CURRENT', '打開水流'], [Infinity, 'READY', '準備完成']];
  let stageAt = -1;

  /* ------------------------------------------------------------ the scroll waits behind the gate */
  let locked = true;
  const NAV_KEYS = new Set([' ', 'Spacebar', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'PageDown', 'PageUp', 'Home', 'End']);
  /* what may be used while the gate holds: the gate, the tuning panels, and once the choice is up the header and its menu */
  const inside = event => event.target instanceof Element && (gate.contains(event.target) || !!event.target.closest('#tuner, .fi-grade, .lgp')
    || (G.state === 'ready' && !!event.target.closest('.finnovation-ui > .fi-header, .fi-menu')));
  const hold = event => {
    if (!locked || inside(event)) return;
    if (event.type.startsWith('pointer') && event.pointerType !== 'touch') return;   /* the mouse may play with the drop once it shows; a finger would scroll */
    if (event.type === 'keydown') {
      if (event.key === 'Enter' && G.state === 'ready') { event.preventDefault(); enter(true); }
      else if (NAV_KEYS.has(event.key)) event.preventDefault();
      else return;   /* any other key (Tab, the panels' letters) goes on to the page */
    } else if (event.cancelable && (event.type === 'wheel' || event.type === 'touchmove')) event.preventDefault();
    event.stopImmediatePropagation();
  };
  const HELD = ['wheel', 'keydown', 'touchstart', 'touchmove', 'pointerdown', 'pointermove', 'pointerup'];
  for (const type of HELD) addEventListener(type, hold, { capture: true, passive: false });
  gate.addEventListener('keydown', event => { if (event.key === 'Enter' || NAV_KEYS.has(event.key)) event.stopPropagation(); });   /* keys meant for the gate's buttons stay in the gate */
  /* the header, once the choice is up: a click on it enters without sound, then does what it says (a chapter, the menu). If the second batch is
     still coming, the click waits with the way in and is played again once inside; while the gate finishes, the header does nothing */
  addEventListener('click', event => {
    const item = event.target instanceof Element && event.target.closest('.finnovation-ui > .fi-header :is(a, button)');
    if (!item || (G.state !== 'ready' && G.state !== 'finishing')) return;
    if (G.state === 'ready' && rest(performance.now()) >= 1) return enter(false);
    event.preventDefault(); event.stopImmediatePropagation();
    if (G.state === 'ready') enter(false, undefined, () => item.click());   /* the muted button fills meanwhile */
  }, true);

  /* ------------------------------------------------------------ the choice, and the way in */
  for (const button of buttons) button.addEventListener('click', event => {
    if (G.state !== 'ready') return;
    const box = button.getBoundingClientRect(), ripple = document.createElement('i');
    ripple.className = 'gate-ripple';
    ripple.style.left = ((event.clientX || box.left + box.width / 2) - box.left) + 'px';
    ripple.style.top = ((event.clientY || box.top + box.height / 2) - box.top) + 'px';
    button.append(ripple);
    enter(button.dataset.sound === 'on', button);
  });
  /* the choice: the sound starts at the click (only a click may start it). If the second batch is still coming, the chosen button fills as it
     arrives and the way in follows the moment it is all there, so inside nothing is still loading (at most 12 s: after that the page goes on
     preparing behind the visitor). `after` runs once inside (a header click played again). */
  function enter(withSound, button = buttons[withSound ? 0 : 1], after) {
    if (G.state !== 'ready') return;
    G.sound = withSound; mark('chosen');
    for (const b of buttons) b.disabled = true;
    if (withSound) { const live = document.querySelector('.finnovation-ui .fi-sound'); if (live && live.getAttribute('aria-pressed') !== 'true') live.click(); }
    if (rest(performance.now()) >= 1) return go(after);
    G.state = 'finishing'; gate.classList.add('is-finishing'); button?.classList.add('is-waiting');
    if (status) status.textContent = 'Almost there. Preparing the rest of the site.';
    const from = performance.now();
    const wait = now => {
      warm();
      const r = rest(now);
      button?.style.setProperty('--w', r.toFixed(3));
      if (r >= 1 || now - from > 12000) { mark('finished'); setTimeout(() => go(after), reduce ? 0 : 280); return; }   /* the full button is seen for a moment */
      requestAnimationFrame(wait);
    };
    requestAnimationFrame(wait);
  }
  function go(after) {
    G.state = 'entering'; mark('entered');
    root.dataset.gate = 'enter';
    gate.classList.remove('is-finishing');
    const S = window.__MONTIS_STUDY__;
    /* the drop answers: it lights up (the water light of flash-glow-build.cjs, one pulse from dark) and shivers */
    if (S && !reduce) {
      const F = S.CONFIG?.flashGlow, hero = S.flashPulse?.hero;
      if (hero && F?.on > .5) { hero.armed = false; if (hero.t < 0) hero.t = 0; }
      if (S.dropTouch) S.dropTouch.wobble = Math.min(1, (S.dropTouch.wobble || 0) + .55);
    }
    setTimeout(() => { locked = false; }, reduce ? 0 : 420);
    if (after) setTimeout(after, reduce ? 0 : 60);
    setTimeout(() => {
      G.state = 'entered';
      root.dataset.gate = 'off';
      for (const type of HELD) removeEventListener(type, hold, { capture: true });
      gate.remove(); loader?.querySelector('.gate-sea')?.remove();
    }, reduce ? 60 : 2600);
  }
  function dismiss() {   /* no 3D (text mode): the readable page is all there is */
    G.state = 'off'; locked = false; root.dataset.gate = 'off';
    for (const type of HELD) removeEventListener(type, hold, { capture: true });
    gate.remove(); loader?.classList.add('gate-gone');
  }
  function reveal() {   /* 100: the count scatters, the cover goes, the live drop comes into focus, the header comes down, then the choice */
    G.state = 'reveal'; mark('reveal');
    count?.burst();
    /* the focus pull: the scene is blurred only now, under the cover, and sharpens as the cover goes (no blur while it is covered: nothing to see, all cost) */
    if (!reduce) {
      root.style.setProperty('--gate-blur', '14'); root.dataset.gateFocus = 'set';
      requestAnimationFrame(() => requestAnimationFrame(() => { root.dataset.gateFocus = 'pull'; root.style.setProperty('--gate-blur', '0'); }));
      setTimeout(() => { delete root.dataset.gateFocus; root.style.removeProperty('--gate-blur'); }, 2200);
    }
    setTimeout(() => loader?.classList.add('gate-gone'), reduce ? 0 : 350);
    setTimeout(() => {
      G.state = 'ready'; mark('ready');
      root.dataset.gate = 'ready';
      for (const b of buttons) b.disabled = false;
      gate.querySelectorAll('[data-split]').forEach(el => el.classList.add('is-shown'));
      if (status) status.textContent = 'Ready. Enter with sound, or without.';
      /* the second batch goes on while the choice is read (warm() also covers a count that ended on the 20 s rule, before the journey was ready) */
      const tick = setInterval(() => { if (G.state === 'ready' || G.state === 'finishing') warm(); else clearInterval(tick); }, 400);
      if (query.get('gate') === 'auto') enter(false);
    }, reduce ? 0 : 1300);
  }

  /* ------------------------------------------------------------ the clock (what the count shows; the count draws itself, the cover's motion is all CSS) */
  let last = performance.now();
  function frame(now) {
    if (G.state !== 'boot' && G.state !== 'live') return;
    if (root.dataset.renderMode === 'text') return dismiss();
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (G.state === 'boot' && document.body.classList.contains('is-ready')) { G.state = 'live'; mark('hero'); }
    G.target = Math.max(G.target, aim(now));
    /* the number follows what has arrived, a little behind and never faster than 0.9 a second (1.8 for the last stretch), so it reads as flow, not as jumps */
    const step = Math.min((G.target - G.shown) * (1 - Math.exp(-dt / .45)), (G.target >= 1 ? 1.8 : .9) * dt);
    G.shown = G.target >= 1 && G.target - G.shown < .004 ? 1 : G.shown + Math.max(0, step);
    const text = String(Math.min(99, Math.floor(G.shown * 100)));
    /* the number jumps rather than ticks: the points need about half a second to gather, and the number should be read for a moment after */
    if (count && text !== count.text && now - (G.textAt || 0) > 850) { G.textAt = now; count.set(text); G.text = count.text; }
    gate.style.setProperty('--p', G.shown.toFixed(4));
    if (hudFiles) hudFiles.textContent = String(requests);
    if (hudMb) hudMb.textContent = (bytes / 1048576).toFixed(1) + ' MB';
    const stage = STAGES.findIndex(([upTo]) => G.shown < upTo);
    if (stage !== stageAt) { stageAt = stage; hudStage.textContent = STAGES[stage][1]; hudStageZh.textContent = STAGES[stage][2]; if (status) status.textContent = 'Loading. ' + STAGES[stage][1]; }
    if (G.shown >= 1 && G.state === 'live') return reveal();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
