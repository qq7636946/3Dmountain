/* The authored particle count runs independently of main-thread 3D setup.
   The same renderer also provides a non-worker fallback. No third-party code. */
function createFlowGateCounterRenderer(options) {
  const { canvas, reduced = false, coarse = false, schedule, cancel, now, onStats = () => {}, onDone = () => {} } = options;
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) throw Error('Gate counter: 2D canvas unavailable');
  const N = coarse ? 1000 : 1800;
  const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  const tx = new Float32Array(N), ty = new Float32Array(N), phase = new Float32Array(N);
  const ink = options.makeCanvas(), inkCtx = ink.getContext('2d', { willReadFrequently: true });
  let viewW = 1, viewH = 1, W = 1, H = 1, dpr = 1, fontPx = 100, advance = 60, cx = 0, cy = 0;
  let family = options.family || 'Oswald', glyphs = {}, text = '', typed = false, burstAt = -1, alpha = 0;
  let last = now(), handle = 0, stopped = false, paused = false, frames = 0, maxGap = 0, reportAt = last;
  const tones = [['#fff', 1.9, 0], ['#eef8fff0', 1.5, 1], ['#cfe9ffb8', 1.15, 2]];
  function resize(size, expanded = burstAt >= 0) {
    viewW = Math.max(1, size.width); viewH = Math.max(1, size.height);
    dpr = Math.max(1, Math.min(size.dpr || 1, coarse ? 1.25 : 1.5));
    const oldCx = cx, oldCy = cy;
    fontPx = Math.round(viewW < 700 ? Math.min(viewH * .27, viewW * .4) : Math.min(viewH * .32, viewW * .27));
    W = expanded ? viewW : Math.min(viewW, Math.max(320, fontPx * 3.5));
    H = expanded ? viewH : Math.min(viewH, fontPx * 2.4);
    cx = W * .5; cy = expanded ? viewH * .43 : H * .5;
    canvas.width = Math.ceil(W * dpr); canvas.height = Math.ceil(H * dpr);
    for (let i = 0; i < N; i++) { x[i] += cx - oldCx; y[i] += cy - oldCy; tx[i] += cx - oldCx; ty[i] += cy - oldCy; }
    glyphs = {}; inkCtx.font = `300 ${fontPx}px "${family}", "Arial Narrow", sans-serif`;
    advance = inkCtx.measureText('0').width * 1.06;
    if (typed && !expanded) { const value = text; text = ''; set(value, false); }
  }
  function glyph(digit) {
    if (glyphs[digit]) return glyphs[digit];
    ink.width = Math.ceil(fontPx * .9); ink.height = Math.ceil(fontPx * 1.2);
    inkCtx.fillStyle = '#fff'; inkCtx.textAlign = 'center'; inkCtx.textBaseline = 'middle';
    inkCtx.font = `300 ${fontPx}px "${family}", "Arial Narrow", sans-serif`;
    inkCtx.fillText(digit, ink.width / 2, ink.height / 2);
    const data = inkCtx.getImageData(0, 0, ink.width, ink.height).data, pts = [];
    const step = Math.max(1, Math.round(fontPx / 200)); let top = Infinity, bottom = -Infinity;
    for (let j = 0; j < ink.height; j += step) for (let i = 0; i < ink.width; i += step) {
      if (data[(j * ink.width + i) * 4 + 3] > 128) { pts.push(i - ink.width / 2, j); top = Math.min(top, j); bottom = Math.max(bottom, j); }
    }
    const mid = (top + bottom) / 2;
    for (let i = 1; i < pts.length; i += 2) pts[i] -= mid;
    return (glyphs[digit] = { pts, step });
  }
  function set(value, kick = true) {
    const L = value.length, same = L === text.length;
    for (let k = 0; k < L; k++) {
      if (same && value[k] === text[k]) continue;
      const { pts, step } = glyph(value[k]), length = pts.length / 2;
      if (!length) continue;
      const sx = cx + (k - (L - 1) / 2) * advance;
      for (let i = Math.floor(k * N / L); i < Math.floor((k + 1) * N / L); i++) {
        const q = Math.floor(Math.random() * length) * 2, stray = Math.random() < .06 ? fontPx * .035 : step * .9;
        tx[i] = sx + pts[q] + (Math.random() - .5) * stray * 2;
        ty[i] = cy + pts[q + 1] + (Math.random() - .5) * stray * 2;
        if (reduced) { x[i] = tx[i]; y[i] = ty[i]; }
        else if (kick) { const force = fontPx * (1.2 + Math.random() * 2.2); vx[i] += (Math.random() - .5) * force; vy[i] += (Math.random() - .5) * force * .8; }
      }
    }
    text = value;
    if (reduced) draw(now());
  }
  function draw(time) {
    handle = 0;
    if (stopped || paused) return;
    const rawDt = Math.max(0, (time - last) / 1000), dt = Math.min(.06, rawDt); last = time;
    if (frames) maxGap = Math.max(maxGap, rawDt * 1000);
    frames++;
    const burst = burstAt >= 0, life = burst ? Math.max(0, 1 - (time - burstAt) / 1700) : 1;
    alpha = reduced ? 1 : Math.min(1, alpha + dt / 1.1);
    // Exact damped spring: stable after a delayed frame, with shared trig.
    const w = 10.5, damp = .72 * w, wd = w * Math.sqrt(1 - .72 * .72);
    const decay = Math.exp(-damp * dt), co = Math.cos(wd * dt), si = Math.sin(wd * dt) / wd, drag = Math.exp(-dt * 1.5);
    if (!reduced) for (let i = 0; i < N; i++) {
      if (burst) { vx[i] *= drag; vy[i] = vy[i] * drag - 14 * dt; x[i] += vx[i] * dt; y[i] += vy[i] * dt; }
      else {
        const dx = x[i] - tx[i], dy = y[i] - ty[i], ux = vx[i], uy = vy[i];
        x[i] = tx[i] + decay * (dx * co + (ux + damp * dx) * si);
        y[i] = ty[i] + decay * (dy * co + (uy + damp * dy) * si);
        vx[i] = decay * (ux * co - (damp * ux + w * w * dx) * si);
        vy[i] = decay * (uy * co - (damp * uy + w * w * dy) * si);
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * life;
    for (const [colour, size, group] of tones) {
      ctx.fillStyle = colour; ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const kind = i % 8 === 0 ? 0 : i % 8 < 4 ? 1 : 2;
        if (kind !== group) continue;
        const jitter = reduced ? 0 : .45;
        ctx.rect(x[i] + Math.sin(time * .0021 + phase[i]) * jitter - size / 2, y[i] + Math.cos(time * .0017 + phase[i] * 1.3) * jitter - size / 2, size, size);
      }
      ctx.fill();
    }
    if (time - reportAt >= 1000) { reportAt = time; onStats({ frames, maxGap: Math.round(maxGap), pixels: canvas.width * canvas.height, particles: N }); }
    if (burst && (life <= 0 || reduced)) { dispose(); onDone(); return; }
    if (!reduced && !stopped && !paused) handle = schedule(draw);
  }
  function pause() { paused = true; if (handle) cancel(handle); handle = 0; }
  function resume() { if (stopped) return; paused = false; last = now(); if (!handle && !reduced) handle = schedule(draw); }
  function dispose() { stopped = true; if (handle) cancel(handle); handle = 0; }
  resize(options);
  for (let i = 0; i < N; i++) { x[i] = tx[i] = W * (.06 + Math.random() * .88); y[i] = ty[i] = H * (.08 + Math.random() * .84); phase[i] = Math.random() * Math.PI * 2; }
  resume();
  return {
    resize, pause, resume, dispose,
    ready(font) { if (font) { family = font; glyphs = {}; inkCtx.font = `300 ${fontPx}px "${family}", sans-serif`; advance = inkCtx.measureText('0').width * 1.06; } typed = true; set(text || '0'); },
    set(value) { if (typed && value !== text) set(value); },
    complete() { typed = true; set('100', false); for (let i = 0; i < N; i++) { x[i] = tx[i]; y[i] = ty[i]; vx[i] = vy[i] = 0; } },
    burst() { resize({ width: viewW, height: viewH, dpr }, true); burstAt = now(); for (let i = 0; i < N; i++) { const angle = Math.random() * Math.PI * 2, speed = fontPx * (.6 + Math.random() * 2.6); vx[i] = Math.cos(angle) * speed * 1.9; vy[i] = Math.sin(angle) * speed * .7 - fontPx * .15; } if (reduced) draw(now()); }
  };
}

function installFlowCounterWorker() {
  let renderer = null, ready = false, pending = [];
  const dispatch = message => { if (message.type === 'resize') renderer.resize(message.size); else renderer[message.type]?.(message.value); };
  self.onmessage = async event => {
    const message = event.data;
    if (message.type !== 'init') { if (ready) dispatch(message); else pending.push(message); return; }
    try {
      const schedule = self.requestAnimationFrame ? cb => self.requestAnimationFrame(cb) : cb => setTimeout(() => cb(performance.now()), 1000 / 60);
      const cancel = self.cancelAnimationFrame ? id => self.cancelAnimationFrame(id) : clearTimeout;
      renderer = createFlowGateCounterRenderer({ ...message.options, canvas: message.canvas, schedule, cancel, now: () => performance.now(), makeCanvas: () => new OffscreenCanvas(1, 1),
        onStats: stats => self.postMessage({ type: 'stats', ...stats }), onDone: () => self.postMessage({ type: 'done' }) });
      const face = new FontFace('FlowGateOswald', `url("${message.fontUrl}")`, { weight: '300' });
      await Promise.race([face.load(), new Promise((_, reject) => setTimeout(() => reject(Error('Gate font unavailable')), 2200))]); self.fonts.add(face);
      renderer.ready('FlowGateOswald'); ready = true;
      for (const item of pending) dispatch(item); pending = [];
      self.postMessage({ type: 'ready' });
    } catch (error) { renderer?.dispose(); self.postMessage({ type: 'error', message: String(error) }); }
  };
}

function createFlowGateCounter({ canvas, reduced, coarse, root, fontUrl }) {
  if (!canvas) return null;
  let worker = null, renderer = null, blobUrl = '', value = '', typed = false, expanded = false, disposed = false, transferred = false;
  const size = () => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1, reduced, coarse });
  function box() {
    const { width, height } = size();
    const font = Math.round(width < 700 ? Math.min(height * .27, width * .4) : Math.min(height * .32, width * .27));
    Object.assign(canvas.style, expanded ? { inset: '0', left: '0', top: '0', width: width + 'px', height: height + 'px', transform: 'none' } : {
      inset: 'auto', left: '50%', top: '43%', width: Math.min(width, Math.max(320, font * 3.5)) + 'px', height: Math.min(height, font * 2.4) + 'px', transform: 'translate(-50%,-50%)'
    });
  }
  function stats(data) {
    root.dataset.gateCounterFrames = String(data.frames); root.dataset.gateCounterMaxGap = String(data.maxGap);
    root.dataset.gateCounterPixels = String(data.pixels);
  }
  function send(type, arg) {
    if (disposed) return;
    if (worker) worker.postMessage(type === 'resize' ? { type, size: arg } : { type, value: arg });
    else if (type === 'resize') renderer?.resize(arg);
    else renderer?.[type]?.(arg);
  }
  function dispose() {
    if (disposed) return;
    disposed = true; worker?.terminate(); renderer?.dispose(); worker = renderer = null;
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ''; }
    removeEventListener('resize', onResize); removeEventListener('pagehide', dispose); document.removeEventListener('visibilitychange', onVisibility);
  }
  function done() { dispose(); canvas.remove(); }
  function fallback() {
    if (disposed || renderer) return;
    worker?.terminate(); worker = null;
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ''; }
    if (transferred) { const fresh = canvas.cloneNode(false); canvas.replaceWith(fresh); canvas = fresh; transferred = false; }
    root.dataset.gateCounterEngine = 'canvas';
    renderer = createFlowGateCounterRenderer({ ...size(), canvas, family: 'Oswald', schedule: requestAnimationFrame, cancel: cancelAnimationFrame, now: () => performance.now(), makeCanvas: () => document.createElement('canvas'), onStats: stats, onDone: done });
    if (typed) { renderer.ready(); if (value) renderer.set(value); }
    if (expanded) { renderer.complete(); renderer.burst(); }
    if (document.hidden) renderer.pause();
  }
  function onResize() { box(); send('resize', size()); }
  function onVisibility() { send(document.hidden ? 'pause' : 'resume'); }
  box();
  if (!reduced && typeof Worker === 'function' && canvas.transferControlToOffscreen && typeof OffscreenCanvas === 'function') {
    try {
      const source = createFlowGateCounterRenderer.toString() + '\n(' + installFlowCounterWorker.toString() + ')();';
      blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      worker = new Worker(blobUrl);
      worker.onerror = event => { event.preventDefault(); fallback(); };
      worker.onmessage = event => {
        if (event.data.type === 'ready') root.dataset.gateCounterEngine = 'worker';
        else if (event.data.type === 'stats') stats(event.data);
        else if (event.data.type === 'done') done();
        else if (event.data.type === 'error') fallback();
      };
      const offscreen = canvas.transferControlToOffscreen(); transferred = true;
      worker.postMessage({ type: 'init', canvas: offscreen, options: size(), fontUrl }, [offscreen]);
      root.dataset.gateCounterEngine = 'starting';
    } catch { fallback(); }
  } else fallback();
  addEventListener('resize', onResize, { passive: true }); addEventListener('pagehide', dispose, { once: true }); document.addEventListener('visibilitychange', onVisibility);
  if (document.hidden) send('pause');
  return {
    get text() { return value; },
    ready() { typed = true; if (!worker) renderer?.ready(); },
    set(next) { if (typed && next !== value) { value = next; send('set', next); } },
    complete() { typed = true; value = '100'; send('complete'); },
    burst() { expanded = true; box(); send('burst'); },
    dispose
  };
}
