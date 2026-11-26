/* RISE LOAD v2 (2026-11-22): moves the loader drawn by rise-load.css (?load=1 only). It reads the page's own gate (window.__GATE__: shown 0–1,
   state) and the gate's hidden counters (.gate-files / .gate-mb), fills the ring, lights 25 / 50 / 75 / 100, names the stage, and resolves the
   terminal lines out of scrambled letters as the build reaches them. One rAF loop while the cover is up; nothing after it. */
(() => {
  const root = document.documentElement;
  if (!root.hasAttribute('data-rise-load')) return;
  const el = document.getElementById('riseLoad'); if (!el) return;
  const $ = s => el.querySelector(s);
  const dial = $('.rl-dial'), word = $('.rl-word'), en = $('.rl-en'), zh = $('.rl-zh');
  const quads = [...el.querySelectorAll('.rl-q')].map(q => [+q.dataset.q / 100, q]);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* the site's own header logo, where the header will put it (the header is in the page, hidden until the way in) */
  const brand = $('.rl-brand'), art = document.querySelector('.finnovation-ui .fi-header .fi-brand-art');
  if (brand && art) {
    brand.replaceChildren(art.cloneNode(true));
    const place = () => { const r = art.getBoundingClientRect(); if (r.width > 20) Object.assign(brand.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' }); };
    place(); addEventListener('resize', place);
  }

  /* letters that settle left to right out of noise (the reference's terminal), in the HUD's mono */
  const NOISE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&+/<>[]';
  function scramble(node, text) {
    if (node._rl) clearInterval(node._rl);
    if (reduce) { node.textContent = text; return; }
    let step = 0; const n = text.length, steps = Math.max(10, n + 6);
    node._rl = setInterval(() => {
      step++; const settled = Math.floor((step / steps) * (n + 2)) - 2;
      let s = '';
      for (let i = 0; i < n; i++) s += i < settled || text[i] === ' ' ? text[i] : NOISE[(Math.random() * NOISE.length) | 0];
      node.textContent = s;
      if (step >= steps) { clearInterval(node._rl); node._rl = 0; node.textContent = text; }
    }, 38);
  }
  const lines = {}; for (const li of el.querySelectorAll('[data-rl-line]')) lines[li.dataset.rlLine] = li.querySelector('span');
  const resolve = (key, text) => { const s = lines[key]; if (!s || s.dataset.done) return; s.dataset.done = '1'; s.classList.remove('is-wait'); s.classList.add('is-done'); scramble(s, text); };
  /* the legal lines and the waiting values scramble in once at the start */
  for (const s of el.querySelectorAll('.rl-legal span, [data-rl-line] span')) scramble(s, s.textContent);

  const STAGES = [[.38, 'GATHERING WATER', '匯聚水氣'], [.88, 'SHAPING THE DROP', '凝成水滴'], [1, 'OPENING THE CURRENT', '打開水流'], [Infinity, 'READY', '準備完成']];
  let stageAt = -1, lastP = -1, filesKey = '', shown = 0, last = 0;
  const files = document.querySelector('.gate-files'), mb = document.querySelector('.gate-mb');
  function frame(now) {
    const G = window.__GATE__;
    if (!G || !el.isConnected) return void requestAnimationFrame(frame);
    const done = /^(reveal|ready|entering|entered)$/.test(G.state);
    /* the ring follows the gate's count, and sweeps the last stretch (the count jumps to 1 when the build is done) in about 0.35 s */
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    const target = done ? 1 : Math.min(.995, +G.shown || 0);
    shown = reduce ? target : Math.min(target, shown + Math.max((target - shown) * (1 - Math.exp(-dt / .12)), (done ? 2.4 : .25) * dt));
    const p = shown;
    if (Math.abs(p - lastP) > .0015) {
      lastP = p; dial.style.setProperty('--p', p.toFixed(4));
      for (const [at, q] of quads) q.classList.toggle('is-on', p >= at - .002);
    }
    const stage = STAGES.findIndex(([upTo]) => p < upTo);
    if (stage !== stageAt) {
      stageAt = stage; en.textContent = STAGES[stage][1]; zh.textContent = STAGES[stage][2];
      if (!reduce) { word.classList.remove('is-swap'); void word.offsetWidth; word.classList.add('is-swap'); }
    }
    const key = (files?.textContent || '') + '|' + (mb?.textContent || '');
    if (key !== filesKey && lines.files && !lines.files._rl) { filesKey = key; lines.files.textContent = (files?.textContent || '0') + ' · ' + (mb?.textContent || '0 MB'); }
    if (p >= .38) resolve('signal', 'CONNECTED');
    if (p >= .88) resolve('depth', '−14 M · INSIGHT');
    if (done) { resolve('signal', 'CONNECTED'); resolve('depth', '−14 M · INSIGHT'); lines.files?.classList.add('is-done'); el.classList.add('is-done'); }
    if (G.state === 'entered' || G.state === 'off') return void retire();
    requestAnimationFrame(frame);
  }
  /* OPT2 team A (2026-11-25, only with html[data-rise-opt2-a]): once the cover has faded out (#loader visibility: hidden), the loader is taken out of the
     layout: its two orbit dots kept spinning (rlSpin, infinite) under the hidden cover for the whole visit. Nothing visible changes. Without the attribute: as before. */
  let retired = false;
  function retire() {
    if (retired || !root.hasAttribute('data-rise-opt2-a')) return; retired = true;
    const cover = document.getElementById('loader');
    const check = () => { if (!el.isConnected) return; if (!cover || getComputedStyle(cover).visibility === 'hidden') el.style.display = 'none'; else setTimeout(check, 500); };
    setTimeout(check, 1800);
  }
  requestAnimationFrame(frame);
})();
