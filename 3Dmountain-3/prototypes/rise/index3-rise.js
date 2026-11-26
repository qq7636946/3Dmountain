/* RISE · from the underwater chapter to the canyon, with the same waterline on the way back.
   The two cameras share a lens. Each renders its side of the moving waterline. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('rise') === '0') return;
  window.__RISE_OCEAN__ = true;
  const DQ = new URLSearchParams(location.search);
  DQ.set('ocean', '1');
  DQ.delete('oceanCross');
  const lite = innerWidth < 760 || (navigator.deviceMemory || 8) <= 4;
  /* UNDERWATER QUALITY (2026-11-22, client: 「水下幫我做最優化 畫質可以降低一點沒關係 給我參數選低中高，然後預設低」): ?uwq=low|medium|high,
     default low. Only the first act's own canvas: its render scale (× .72 / .86 / 1 of what the page's quality gives it), its sand maps
     (1024 → 512 below high) and the surface's wave map seen from below (1024 → 512 at low). high = exactly as before. */
  const UWQ = /^(low|medium|high)$/.test(Q.get('uwq') || '') ? Q.get('uwq') : 'low';
  const UWQ_K = { low: .72, medium: .86, high: 1 }[UWQ];
  const uwTexTier = UWQ === 'high' ? undefined : (() => { const base = window.__FLOW2_TEX_TIER__ || {}; const sz = (full, min) => Math.max(min || 512, Math.round(full * .5));
    return { ...base, tier: base.tier === 'low' ? 'low' : 'medium', scale: .5, size: sz, url: (b, full, ext, min) => b + '-' + sz(full, min) + '.' + (ext || 'webp'), pick: m => (m && (m.medium || m.high)) || null }; })();
  window.__RISE_UWQ__ = { tier: UWQ, scale: UWQ_K };
  const html = document.documentElement;
  const rhythm = window.__RISE_RHYTHM__;
  const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };
  const reducedMQ = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)'); } catch (error) { return { matches: false }; } })();
  const HERE = (document.currentScript && document.currentScript.src) ? new URL('.', document.currentScript.src).href : new URL('prototypes/rise/', document.baseURI).href;
  const GORGE = new URL('../drop-gorge/', HERE).href;
  const STAMP = { scene: '50-seapng', dive: '23-splash', optics: '15-bubble-anchor', td: '24' };
  /* OPT2 D1 (team D, 2026-11-25; html[data-rise-opt2] only, ?opt2D=0 = off): sea.png (PNG, 2.0 MB) as the same picture in WebP q95 (0.36 MB, max 9/255 on screen); phones (< 760 px wide) half size (0.13 MB) */
  const SEA_PIC = html.hasAttribute('data-rise-opt2') && Q.get('opt2D') !== '0' ? (innerWidth < 760 ? 'images/opt2d/sea-776-q95.webp' : 'images/opt2d/sea-q95.webp') : 'sea.png';
  const SEA_VIDEO_URL = (Q.get('seaVideo') === '1' || (html.hasAttribute('data-rise-sea-video') && Q.get('seaVideo') !== '0'))
    ? new URL('../../' + (Q.get('sea') === 'mp4' ? 'sea.mp4' : Q.get('sea') === 'b' ? 'sea_B.mp4' : SEA_PIC), HERE).href : '';   /* 2026-11-24: sea.png by default (「第一幕換圖我看看」); ?sea=mp4 / ?sea=b = the videos */

  const T = {
    travel: 1100, entry: 170, depthTravel: 1100, depth: 18, canyonLift: 0,
    touchGain: 1.3, dropR: 0.135, scale: Math.max(0.55, Math.min(1.35, num('gorgeScale', lite ? 0.86 : 0.94))),
    beats: [[190, 320, 450, 530], [540, 670, 800, 880], [890, 1020, 1e9, 1e9]],
    riseTravel: num('riseTravel', 160),
    crossPx: num('riseCrossPx', 240),
    cutSeconds: Math.max(0.55, Math.min(2.5, num('diveTime', rhythm?.tune.surfaceSeconds ?? 1.04)))
  };
  const renderScale = () => Q.has('gorgeScale') ? T.scale
    : Math.min(T.scale, window.__FLOW2_QUALITY__?.pick(1.35, 0.84, 0.70) ?? T.scale) * UWQ_K;   /* UWQ_K: ?uwq= (1 at high) */

  const S = {
    stage: 'waiting', state: 'gorge', pre: true,
    g: 0, gT: 0, p: 0, pT: 0, v: 0, uc: 1,
    cover: false, notes: [], frames: 0, drawn: 0,
    openY: -14, gOpen: NaN, waterline: null,
    navAt: -1e9, self: false, stroke: null, snap: false, ck: 0
  };
  const note = m => { if (S.notes.length < 16) S.notes.push(m); };
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const s5 = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
  const now = () => performance.now();
  const api = window.__RISE__ = window.__FLOW2_GORGE__ = { tune: T, state: S, rise: true };

  /* ---------------------------------------------------------------- page pieces */
  for (const href of [GORGE + 'drop-gorge.css?v=6', HERE + 'rise.css?v=15-uwq']) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.append(l);
  }
  html.setAttribute('data-rise', 'under');
  html.setAttribute('data-xs-gorge', 'in');
  html.style.setProperty('--xs-ui', '0');

  let canvas = null, ui = null, sea = null, lastUiStr = '0';
  let fadingUI = [];
  function bindFadingUI() {
    fadingUI = document.querySelectorAll('.finnovation-ui :is(.fi-copy,.fi-rail,.fi-footer,.f2u-side,.fi-veil),.f2u-lock,.alp-labels,#flow2-canyon-atlas');
    for (const el of fadingUI) el.style.setProperty('--rise-interface-opacity', lastUiStr);
  }
  const setXsUi = v => {
    const s = v.toFixed(3);
    if (s === lastUiStr) return;
    lastUiStr = s;
    for (const el of fadingUI) el.style.setProperty('--rise-interface-opacity', s);
  };

  const SEA_COPY = [
    { k: '01 — INSIGHT', zh: '洞察先於判斷', t: ['<em>INSIGHT</em> RUNS DEEP.'], p: 'We study sectors, cycles and people before capital moves — the clearest view is the one that goes beneath the surface.', layout: 'c' },
    { k: '02 — DISCIPLINE', zh: '以紀律創造長期價值', t: ['<em>DISCIPLINE</em>', 'SETS THE', 'PACE.'], p: 'Clear limits, measured steps. Patience is part of how we invest: every position is sized, reviewed and held to the same standard as it grows.', layout: 'l' },
    { k: '03 — STRATEGIES', zh: '四大投資領域', t: ['<em>FOUR PATHS,</em>', 'ONE', 'CURRENT.'], list: ['AI QUANT TRADING', 'PUBLIC EQUITIES', 'PRE-IPO INVESTMENT', 'DERIVATIVE STRATEGIES'], zhList: ['AI 量化交易', '上市櫃投資', '未上市與 PRE-IPO', '衍生性商品'], layout: 'r' }
  ];

  function buildDom() {
    canvas = document.createElement('canvas'); canvas.id = 'xs-gl'; canvas.setAttribute('aria-hidden', 'true');
    const gl0 = document.getElementById('gl'); (gl0 && gl0.parentNode ? gl0.after(canvas) : document.body.prepend(canvas));
    ui = document.createElement('div'); ui.id = 'xs-ui'; ui.setAttribute('aria-label', 'Insight, discipline, four strategies');
    const el = document.createElement('div'); el.id = 'xs-sea';
    const ticks = side => { let h = ''; for (let d = 0; d <= 70; d += 1) { const major = d % 5 === 0; h += `<i class="${major ? 'M' : ''}" style="top:${d * 22}px">${major && d ? '−' + String(d).padStart(2, '0') : ''}</i>`; } return `<div class="xs-sea-rule ${side}" aria-hidden="true"><div class="xs-sea-strip">${h}</div><b class="xs-sea-mark"></b></div>`; };
    el.innerHTML = ticks('l') + ticks('r') + SEA_COPY   /* 2026-11-21 (client: 「細的直線刪除」): no centre axis line under water */.map((c, i) => {
      const t = c.t.map(x => `<span>${x}</span>`).join('');
      const body = c.list ? '<ol class="xs-sea-list">' + c.list.map((x, j) => `<li><b>${String(j + 1).padStart(2, '0')}</b><span>${x}</span><span lang="zh-Hant">${c.zhList[j]}</span></li>`).join('') + '</ol>' : `<p class="xs-sea-p">${c.p}</p>`;
      const copy = `<p class="xs-sea-k"><span>${c.k}</span><span lang="zh-Hant">${c.zh}</span></p><h2 class="xs-sea-t">${t}</h2><div class="xs-sea-c">${body}</div>`;
      return `<section class="xs-sea-b ${c.layout}" data-i="${i}">${i === 0 ? `<div class="xs-sea-insight-copy">${copy}</div>` : copy}</section>`;
    }).join('');
    ui.append(el); document.body.append(ui);
    sea = {
      el, strips: [...el.querySelectorAll('.xs-sea-strip')],
      blocks: [...el.querySelectorAll('.xs-sea-b')],
      frame: [...el.querySelectorAll('.xs-sea-rule, .xs-sea-axis')],
      op: '', sy: '', ok: '', bState: [{}, {}, {}]
    };
    html.setAttribute('data-xs-sea', '');
    canvas.style.display = 'block';
  }

  const PPM = 62, RULER_PPM = 22;
  let stationY = [-14, -26, -38];
  function layoutSea(yCam, k, fade) {
    if (!sea) return;
    const on = S.state === 'gorge' && k * fade > 0.001;
    if (on !== sea.on) { sea.on = on; sea.el.classList.toggle('is-on', on); }
    if (!on) {
      if (sea.op !== '0') { sea.op = '0'; sea.el.style.opacity = '0'; }
      return;
    }
    const Hh = innerHeight;
    const op = (fade * k).toFixed(3);
    if (op !== sea.op) { sea.op = op; sea.el.style.opacity = op; }
    const sy = (Hh / 2 - (-yCam) * RULER_PPM).toFixed(1);
    if (sy !== sea.sy) {
      sea.sy = sy;
      const tr = `translate3d(0, ${sy}px, 0)`;
      for (const st of sea.strips) st.style.transform = tr;
    }
    const kk = smooth(7, 10, -yCam).toFixed(3);
    if (kk !== sea.ok) { sea.ok = kk; for (const n of sea.frame) n.style.opacity = kk; }
    sea.blocks.forEach((b, i) => {
      const y = stationY[i], bs = sea.bState[i];
      if (!Number.isFinite(y)) { if (bs.vis !== false) { bs.vis = false; b.style.visibility = 'hidden'; } return; }
      // Carry the first station into the ascending shot until the canyon heading takes over.
      const gap = (yCam - y) * PPM;
      const off = i === 0 && gap > 0 ? Hh * 0.055 * Math.tanh(gap / (Hh * 0.33)) : gap;
      const a = 1 - smooth(Hh * 0.36, Hh * 0.6, Math.abs(off));
      if (a <= 0.001) { if (bs.vis !== false) { bs.vis = false; b.style.visibility = 'hidden'; } return; }
      if (bs.vis !== true) { bs.vis = true; b.style.visibility = 'visible'; }
      const offS = off.toFixed(1), aS = a.toFixed(3), inS = (1 - smooth(Hh * 0.05, Hh * 0.5, off)).toFixed(3);
      if (bs.off !== offS) { bs.off = offS; b.style.transform = `translate3d(0, ${offS}px, 0)`; }
      if (bs.a !== aS) { bs.a = aS; b.style.opacity = aS; }
      if (bs.inS !== inS) { bs.inS = inS; b.style.setProperty('--in', inS); }
    });
  }

  /* The canyon's own composer draws the crossing before its output tone mapping. */
  let study = null, J = null, scene = null, dive = null, optics = null, waterView = null, opening = null, bubbleLogo = null;
  const engine = {};
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const attachBefore = host.attach, canyonBefore = host.canyon;
  host.attach = function (h = {}) {
    try { return attachBefore?.call(this, h); }
    finally { Object.assign(engine, h); }
  };
  host.canyon = function (h = {}) {
    try { return canyonBefore?.call(this, h); }
    finally { if (h.canyon) engine.canyon = h.canyon; }
  };

  function installCrossing() {
    engine.canyon ||= study.canyon;
    if (!engine.canyon || !engine.composer || !engine.ShaderPass) throw new Error('Canyon renderer is not ready');
    waterView = optics.createWaterlineView({ ...engine, ocean: scene.ocean, lite });
    if (!S.drawn) scene.fitWaterEdges(optics.canyonWaterEdges(scene.THREE, engine.canyon));
    const composer = engine.composer;
    const render = composer.render;
    composer.render = function (...args) {
      if (S.state !== 'gorge' || S.pre || !S.waterline || S.waterline.fullyUnder
        || study.mainRenderPass.scene !== engine.canyon.scene) return render.apply(this, args);
      const cursor = study.sceneCursor?.pass;
      const wasEnabled = cursor?.enabled;
      if (cursor) cursor.enabled = false;
      try {
        return waterView.render({
          sample: S.waterline, time: clockSec, reduced: reducedMQ.matches, splashAt
        }, () => render.apply(this, args));
      } finally {
        if (cursor) cursor.enabled = wasEnabled;
      }
    };
    return waterView.warm();
  }

  const FROM = () => { const sc = window.__FLOW2_SCOPE__; return sc && Number.isFinite(+sc.from) ? +sc.from : 4.87; };
  const scopeReady = () => { const sc = window.__FLOW2_SCOPE__; return !sc || !sc.state || sc.state.stage === 'ready' || sc.state.stage === 'no engine' || String(sc.state.stage).startsWith('failed'); };

  /* ---------------------------------------------------------------- PASS 2 · canyon's end render-open circle */
  /* RISE-TD (2026-11-20, client's storyboard 轉場>黑白>渲染>彩色): the default hand-over on this page is td-transition.js, scrubbed by the wheel.
     ?riseOut=circle = the brushed circle from the drop (rejected, kept behind this dial) · ?riseOut=stroke = lift-cut's own stroke, no hold. */
  /* MASTER (2026-11-20 evening, client: 「轉場不要定住才轉 回復原本的那個去優化就好」): the default is the ORIGINAL again — lift-cut's own stroke flowing
     into the studio view's entrance, no hold. The one-cut system (td-transition.js) loads and runs only with ?riseOut=td. */
  const OUT = Q.get('riseOut') || 'stroke', TD = OUT === 'td';
  let td = null;
  /* MASTER dials, read by the guarded RISE HOOK lines in flow2-lift-cut.js and flow2-studio-pbr-view.js (only this page, only the stroke). Panel 「俯瞰轉場」, key J.
     ?riseMaster=0 = the untouched original (no hooks read). */
  if (OUT === 'stroke' && Q.get('riseMaster') !== '0') {
    const MT = {
      glidePow: num('riseGlide', 1.45),      // the valley keeps its speed under the stroke (2.2 = the original: it slows early)
      backTime: num('riseBack', .85),        // seconds of the stroke on the way back (the entry keeps 1.15: 轉場 X panel)
      lightAt: num('riseLightAt', .8),       // the rivers' light, curtains and the ring's column start when the colour has grown this far (0 = at once, as before)
      lightSeconds: num('riseLight', 1.7),   // … and take this long
      lineAt: .9, lineOut: num('riseLineOut', .9)   // the 3D lines withdraw once the lens has settled, over this many seconds
    };
    if (rhythm) {
      if (!Q.has('riseBack')) MT.backTime = rhythm.tune.returnSeconds;
      if (!Q.has('riseLightAt')) MT.lightAt = rhythm.tune.lightAt;
      if (!Q.has('riseLight')) MT.lightSeconds = rhythm.tune.lightSeconds;
      if (!Q.has('riseLineOut')) MT.lineOut = rhythm.tune.lineOut;
    }
    window.__RISE_MASTER__ = { tune: MT, state: {} };
    try { window.__FLOW2_PANEL__?.add({ id: 'rise-master', title: '俯瞰轉場', key: 'j', tune: MT, rows: [
      ['山谷帶速度進轉場（2.2＝原本，越小越不減速）', 'glidePow', 1, 2.6, .05], ['退場筆刷時間（秒）', 'backTime', .4, 2, .05],
      ['河光・光幕・光柱：顏色長到多少才開始', 'lightAt', 0, .98, .01], ['河光・光幕・光柱：長度（秒）', 'lightSeconds', .5, 5, .05],
      ['3D 線退場長度（秒）', 'lineOut', .2, 3, .05]
    ] }); } catch (error) { }
  }
  const CIRCLE = OUT === 'circle';
  const shift = () => (study && study.journeyClock ? 20 - study.journeyClock(20) : 2.894);
  const P1 = () => { const c = window.__FLOW2_LIFT_CUT__; return ((c && c.tune && Number.isFinite(+c.tune.from)) ? +c.tune.from : 6.6) + shift(); };
  const H = () => { const c = window.__FLOW2_LIFT_CUT__; const land = c && c.tune && Number.isFinite(+c.tune.land) ? +c.tune.land : 0.06; return num('gorgeAt', P1() - land); };
  const atlas = () => window.__FLOW2_FOREST_ATLAS__;
  const brushMode = () => { const c = window.__FLOW2_LIFT_CUT__; return !!(c && c.tune && c.tune.mode === 'brush' && c.state && c.state.stage === 'ready' && innerWidth >= 760 && html.dataset.renderMode !== 'text'); };
  const circleOK = () => CIRCLE && brushMode() && !!dive && !!dive.cut && !reducedMQ.matches;
  const tdOK = () => TD && !!td && td.ready && brushMode() && !reducedMQ.matches;
  const holdOK = () => (TD ? tdOK() : circleOK());

  function installHold() {
    const d = Object.getOwnPropertyDescriptor(J, 'target'); let own = J.target;
    Object.defineProperty(J, 'target', {
      configurable: true, enumerable: true,
      get: d && d.get ? () => d.get.call(J) : () => own,
      set: v => { v = filter(+v); if (d && d.set) d.set.call(J, v); else own = v; }
    });
  }
  function filter(v) {
    if (!Number.isFinite(v) || S.self || !(CIRCLE || TD)) return v;
    const p = +J.progress;
    if (Math.abs(v - p) > 1.3) { if (S.state === 'canyon' || S.state === 'after') S.navAt = now(); return v; }
    if (S.state === 'canyon' && S.stage === 'ready' && holdOK() && p <= H() + 0.02 && v > H()) { if (TD) td?.ask?.(); return H(); }
    return v;
  }
  const atHold = () => J && S.state === 'canyon' && holdOK() && +J.target >= H() - 0.003 && +J.progress >= H() - 0.35;
  function circleAtlas() {
    const A = atlas(); if (!A) return false; if (A.__riseCircle) return true;
    let raw = A.override;
    Object.defineProperty(A, 'override', {
      configurable: true, enumerable: true,
      get() { return raw && raw.on && !raw.warm && (S.state === 'open' || S.state === 'close') ? Object.assign({}, raw, { brush: 1, reduce: 1 }) : raw; },
      set(v) { raw = v; }
    });
    A.__riseCircle = () => raw;
    return true;
  }

  let snapC = null, still = null;
  function grab() {
    const gl0 = document.getElementById('gl'); if (!gl0 || !gl0.width) return false;
    if (!snapC) snapC = document.createElement('canvas');
    if (snapC.width !== gl0.width || snapC.height !== gl0.height) { snapC.width = gl0.width; snapC.height = gl0.height; }
    const c2 = snapC.getContext('2d', { alpha: false }); c2.drawImage(gl0, 0, 0);
    const probe = (grab.p ||= Object.assign(document.createElement('canvas'), { width: 8, height: 8 })).getContext('2d', { willReadFrequently: true });
    probe.drawImage(snapC, 0, 0, 8, 8); const d = probe.getImageData(0, 0, 8, 8).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    if (sum < 200) return false;
    const T3 = scene.THREE;
    if (!still) {
      const tex = new T3.CanvasTexture(snapC); tex.colorSpace = T3.NoColorSpace; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = T3.LinearFilter;
      const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
      const mat = new T3.ShaderMaterial({
        uniforms: { t: { value: tex } }, depthTest: false, depthWrite: false,
        vertexShader: 'varying vec2 v; void main(){ v = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'precision highp float; uniform sampler2D t; varying vec2 v; void main(){ gl_FragColor = vec4(texture2D(t, v).rgb, 1.0); }'
      });
      const mesh = new T3.Mesh(geo, mat); mesh.frustumCulled = false; const sc = new T3.Scene(); sc.add(mesh);
      still = { tex, sc, cam: new T3.Camera() };
    }
    still.tex.needsUpdate = true; S.snap = true;
    return true;
  }
  function dropCentre() {
    try {
      const SG = window.__FLOW2_SEAGULL__, ctx = SG && SG.ctx, D = ctx && ctx.drop;
      if (D && D.on && D.pos) { const v = D.pos.clone().project(ctx.canyon.camera); const x = v.x * 0.5 + 0.5, y = v.y * 0.5 + 0.5; if (x > 0.1 && x < 0.9 && y > 0.1 && y < 0.9) return [x, y]; }
    } catch (error) { }
    return [0.5, 0.5];
  }
  function handover() {
    if (S.state !== 'canyon') return;
    S.state = 'arming'; window.__FLOW2_IDLE_HOLD__ = true; let tries = 0;
    const go = () => {
      if (S.state !== 'arming') return;
      if (!grab()) { if (++tries < 6) { requestAnimationFrame(go); return; } S.state = 'canyon'; note('no still: the stroke'); S.self = true; try { J.target = P1() + 0.08; } finally { S.self = false; } S.state = 'after'; return; }
      S.centre = dropCentre(); S.state = 'open'; S.stroke = { t0: now(), seen: 0 }; S.ck = 0;
      circleAtlas(); canvas.style.display = 'block'; paintOpacity(1); html.setAttribute('data-rise', 'open'); drawOpen();
      S.self = true; try { J.target = P1() + 0.08; } finally { S.self = false; }
      kick();
    };
    requestAnimationFrame(go);
  }
  function endOpen(to) { S.state = to; S.stroke = null; canvas.style.display = 'none'; html.setAttribute('data-rise', 'canyon'); }
  const cEase = t => 0.18 * t + 0.82 * t * t * (3 - 2 * t);
  function drawOpen() {
    const st = S.stroke; if (!st) return;
    const raw = atlas() && atlas().__riseCircle ? atlas().__riseCircle() : null, on = !!(raw && raw.on && !raw.warm);
    const span = 1000 * ((window.__FLOW2_LIFT_CUT__ && +window.__FLOW2_LIFT_CUT__.tune.brushTime) || 1.15);
    let k = 0;
    if (S.state === 'open') {
      if (on && !st.seen) st.seen = now();
      if (!st.seen) { if (now() - st.t0 > 900) { note('no stroke came'); endOpen('after'); return; } }
      else { const t = clamp01((S.circleHold != null ? S.circleHold : now() - st.seen) / span); k = cEase(t); if (S.circleHold == null && t >= 1 && (!on || now() - st.seen > span + 400)) { endOpen('after'); return; } }
    } else {
      if (on && !st.seen) st.seen = now(); const t = clamp01((S.circleHold != null ? S.circleHold : now() - st.t0) / span); k = 1 - cEase(t);
      if (S.circleHold == null && t >= 1 && ((st.seen && !on && st.ended) || now() - st.t0 > span + 2500)) { endOpen('canyon'); return; }
    }
    S.ck = k;
    const R = scene.renderer, ac = R.autoClear; R.autoClear = true;
    try { R.setRenderTarget(null); R.render(still.sc, still.cam); } finally { R.autoClear = ac; }
    dive.cut(k, S.centre[0], S.centre[1]);
    S.frames++;
  }
  document.addEventListener('flow2:handover', e => {
    const d = e.detail || {};
    if (d.dir < 0 && d.phase === 'start') {
      if (S.state === 'after' && S.snap && circleOK() && now() - S.navAt > 400) {
        S.state = 'close'; S.stroke = { t0: now(), seen: 0 }; S.ck = 1; circleAtlas(); canvas.style.display = 'block'; paintOpacity(1); html.setAttribute('data-rise', 'open'); drawOpen(); kick();
      }
    } else if (d.phase === 'end') {
      if (d.dir < 0 && S.state === 'close') { if (S.stroke) S.stroke.ended = now(); }
      else if (d.dir > 0 && S.state === 'canyon') S.state = 'after';
      else if (d.dir < 0 && S.state === 'after') S.state = 'canyon';
    }
  });

  /* Keep the leading drop on the same scrubbed timeline as the view. */
  const linkedDrop = () => bubbleLogo?.linksDrop() && !!window.__FLOW2_DROP__;
  const dropSubmersion = (progress, height) => linkedDrop() ? 1 - s5(-6.4, 0.62, height) : s5(0.03, 0.24, progress);
  let dropDive = 1;
  function wireDrop() {
    const drop = window.__FLOW2_DROP__;
    if (!drop) return;
    const flock = window.__FLOW2_SEAGULL__;
    if (Number.isFinite(+flock?.tune?.from)) flock.tune.from = Math.min(+flock.tune.from, FROM() - 0.012);
    if (Array.isArray(drop.tune?.p2)) drop.tune.p2 = [FROM() - 0.14, FROM() - 0.02];
    const busy = drop.busy;
    drop.busy = () => busy?.() || ['canyon', 'arming', 'open', 'close'].includes(S.state);
    Object.defineProperty(drop, 'diveOverride', {
      configurable: true, enumerable: true, set() {},
      get() {
        if (S.state === 'gorge') return S.pre ? 1 : dropDive;
        return ['canyon', 'arming', 'open', 'close'].includes(S.state) ? 0 : null;
      }
    });
    Object.defineProperty(drop, 'handoffCamera', {
      configurable: true,
      get() { return S.state === 'gorge' && !S.pre && linkedDrop() ? waterView?.dryCamera : undefined; }
    });
    Object.defineProperty(drop, 'pull', {
      configurable: true, enumerable: true, set() { },
      get() { return S.state === 'canyon' && J && CIRCLE ? smooth(H() - 0.5, H(), +J.progress) : (S.state === 'arming' || S.state === 'open' || S.state === 'close' ? 1 : 0); }
    });
  }

  /* Screen-independent coordinates: scroll pixels -> metres -> the existing descent. */
  let crossLength, deepLength, totalLength, airHeight, joinHeight, joinTangent;
  const travelTime = new Float32Array(257);
  const travelEase = t => rhythm ? rhythm.smoother(t) : smooth(0, 1, t);
  function initMapping() {
    crossLength = Math.max(120, T.crossPx);
    deepLength = Math.max(150, T.riseTravel);
    totalLength = crossLength + deepLength;
    const canyon = engine.canyon;
    const waterY = canyon.river.mesh.getWorldPosition(new scene.THREE.Vector3()).y;
    airHeight = Math.max(0.85, canyon.camera.position.y - waterY);
    joinHeight = scene.descent.top;
    const measure = Math.max(0.01, 0.001 * (S.gOpen - T.entry));
    const slope = (dive.camY(T.entry + measure, joinHeight) - joinHeight) / measure;
    joinTangent = slope * (S.gOpen - T.entry) * crossLength / deepLength;
    // Allocate more of the take to the first metre on either side of the lens.
    // Integrating the curve once makes a slow frame or reversal keep the same path.
    const last = travelTime.length - 1;
    let previousWeight = 1;
    for (let i = 1; i <= last; i++) {
      const height = camYAtP(travelEase(i / last) * totalLength);
      const weight = 1 + (rhythm?.tune.surfaceWeight ?? 8) * Math.exp(-((height / 0.54) ** 2));
      travelTime[i] = travelTime[i - 1] + (previousWeight + weight) * 0.5;
      previousWeight = weight;
    }
    const duration = travelTime[last];
    for (let i = 1; i <= last; i++) travelTime[i] /= duration;
  }
  function positionAtTime(time) {
    let lo = 0, hi = travelTime.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (travelTime[mid] < time) lo = mid; else hi = mid;
    }
    const t = (lo + (time - travelTime[lo]) / (travelTime[hi] - travelTime[lo])) / (travelTime.length - 1);
    return travelEase(t) * totalLength;
  }
  function timeAtPosition(p) {
    let t = 0.5 - Math.sin(Math.asin(1 - 2 * clamp01(p / totalLength)) / 3);
    if (rhythm) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (travelEase(mid) < clamp01(p / totalLength)) lo = mid; else hi = mid;
      }
      t = (lo + hi) / 2;
    }
    const index = t * (travelTime.length - 1);
    const i = Math.min(travelTime.length - 2, Math.floor(index));
    return travelTime[i] + (travelTime[i + 1] - travelTime[i]) * (index - i);
  }
  function pToG(p) {
    if (p <= crossLength) return T.entry * clamp01(p / crossLength);
    return T.entry + clamp01((p - crossLength) / deepLength) * (S.gOpen - T.entry);
  }
  function gToP(g) {
    if (g <= T.entry) return crossLength * clamp01(g / T.entry);
    return crossLength + deepLength * clamp01((g - T.entry) / (S.gOpen - T.entry));
  }
  function camYAtP(p) {
    if (p <= crossLength) return optics.crossingHeight(p / crossLength, airHeight, joinHeight, joinTangent);
    return dive.camY(pToG(p), joinHeight);
  }

  /* ---------------------------------------------------------------- Input (wheel, keyboard, touch) */
  const norm = e => {
    let d = e.deltaY || 0;
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= innerHeight;
    return Math.max(-240, Math.min(240, d));
  };
  const silkFlow = html.hasAttribute('data-rise-silk-flow');
  const live = () => S.state === 'gorge';
  const ready = () => S.stage === 'ready' && J && scopeReady();
  const atTop = () => J && S.state === 'canyon' && +J.target <= FROM() + (silkFlow ? 0.015 : 0.004) && +J.progress <= FROM() + (silkFlow ? 0.14 : 0.03);
  const eat = e => { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); };

  let lastInput = 0, pendingDirection = 0, emergeCarry = 0;
  let cutPhase = 1, cutVelocity = 0, inputSum = 0, lastDeltaAt = -Infinity;

  // A notch, a short trackpad stroke or a swipe starts one continuous take.
  // Additional samples in the same direction do not restart its clock.
  function push(direction) {
    lastInput = now();
    const target = direction > 0 ? totalLength : 0;
    if (target !== S.pT) bindFadingUI();
    S.pT = target;
    S.gT = pToG(S.pT);
    kick();
  }

  function begin() {
    if (!scene || !scene.ready || !dive) return false;
    bindFadingUI();
    setXsUi(1);
    S.state = 'gorge';
    S.p = S.pT = S.v = S.uc = 0;
    S.g = S.gT = S.drawn = 0;
    cutPhase = cutVelocity = 0;
    previousHeight = airHeight;
    burstAt = splashAt = -100;
    S.waterline = optics.sampleWaterline(airHeight);
    paintOpacity(0);
    html.setAttribute('data-xs-gorge', 'in');
    html.setAttribute('data-rise', 'under');
    show(true);
    kick();
    return true;
  }

  function input(d, e) {
    if (!d) return false;
    const t = now();
    if (t - lastDeltaAt > 160 || Math.sign(inputSum) !== Math.sign(d)) inputSum = 0;
    lastDeltaAt = t;
    inputSum += d;
    const intent = Math.abs(inputSum) >= 7;
    if (intent) inputSum = 0;
    if (live()) {
      eat(e);
      if (silkFlow && ready()) {
        if (d > 0) emergeCarry = Math.min(0.58, Math.max(0.22, emergeCarry + (S.pT === 0 && cutPhase < 0.72 ? Math.min(240, d) / 900 : 0)));
        else if (d < 0) emergeCarry = 0;
      }
      if (intent) {
        if (ready()) push(-d); else pendingDirection = -Math.sign(d);
      }
      return true;
    }
    if (!ready()) return false;
    if (S.state === 'arming') { eat(e); return true; }
    if (d < 0 && atTop()) {
      eat(e);
      if (intent && begin()) {
        if (silkFlow && J) { J.velocity = 0; J.target = FROM(); }
        emergeCarry = 0;
        push(1);
      }
      return true;
    }
    if (tdOK() && td.cooling()) { eat(e); return true; }
    if (tdOK() && (td.on || (d > 0 && atHold() && +J.progress >= H() - Math.max(0.02, +td.tune.early || 0)) || (d < 0 && S.state === 'after' && td.atRest()))) {
      eat(e);
      td.wheel(d);
      return true;
    }
    if (TD) return false;
    if (d > 0 && atHold()) { eat(e); handover(); return true; }
    return false;
  }

  addEventListener('wheel', e => {
    if (e.target?.closest?.('[data-flow2-panel]')) e.stopImmediatePropagation();
    else input(norm(e), e);
  }, { capture: true, passive: false });
  addEventListener('keydown', e => {
    if (e.target?.closest?.('input,textarea,[contenteditable]')) return;
    const k = e.key, down = ['ArrowDown', 'PageDown', ' ', 'End'].includes(k), up = ['ArrowUp', 'PageUp', 'Home'].includes(k);
    if (!down && !up) return;
    input((k === 'PageDown' || k === ' ' || k === 'PageUp' ? 300 : 100) * (down ? 1 : -1), e);
  }, { capture: true });

  let touchY = null, finger = null, ownsSwipe = false;
  const touchControl = target => target?.closest?.('button,a,input,textarea,select,[role="dialog"],[contenteditable="true"]');
  function moveTouch(y, e) {
    if (touchY == null) return;
    const dy = touchY - y;
    touchY = y;
    if (input(dy * T.touchGain, e)) ownsSwipe = true;
  }
  const endTouch = () => { touchY = finger = null; ownsSwipe = false; };
  if (window.PointerEvent) {
    // The canyon uses Pointer Events too. Give one gesture to one camera.
    addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || !e.isPrimary || touchControl(e.target)) return;
      finger = e.pointerId; touchY = e.clientY; inputSum = 0;
      ownsSwipe = live();
      if (ownsSwipe) e.stopImmediatePropagation();
    }, { capture: true, passive: true });
    addEventListener('pointermove', e => {
      if (e.pointerId === finger) moveTouch(e.clientY, e);
    }, { capture: true, passive: false });
    const release = e => { if (e.pointerId === finger) endTouch(); };
    addEventListener('pointerup', release, { capture: true, passive: true });
    addEventListener('pointercancel', release, { capture: true, passive: true });
    addEventListener('touchmove', e => { if (ownsSwipe) eat(e); }, { capture: true, passive: false });
  } else {
    addEventListener('touchstart', e => {
      if (!touchControl(e.target)) { touchY = e.touches[0]?.clientY ?? null; inputSum = 0; }
    }, { capture: true, passive: true });
    addEventListener('touchmove', e => { if (e.touches.length === 1) moveTouch(e.touches[0].clientY, e); }, { capture: true, passive: false });
    addEventListener('touchend', endTouch, { capture: true, passive: true });
    addEventListener('touchcancel', endTouch, { capture: true, passive: true });
  }

  /* ---------------------------------------------------------------- Hand-overs */
  function setCover(on) { if (on === S.cover) return; S.cover = on; window.__FLOW2_COVER__ = on; }
  let canvasOpacity = '';
  function paintOpacity(value) {
    const style = value.toFixed(4);
    if (!canvas || canvasOpacity === style) return;
    canvasOpacity = style;
    canvas.style.opacity = style;
  }
  function show(on) {
    if (!canvas) return;
    canvas.style.display = on ? 'block' : 'none';
    ui.classList.toggle('is-on', on);
    if (!on) {
      layoutSea(0, 0, 0);
      setXsUi(1);
      clearTimeout(show.t);
      show.t = setTimeout(() => {
        if (S.state === 'gorge') return;
        html.removeAttribute('data-xs-gorge');
        html.style.removeProperty('--xs-ui');
        lastUiStr = '';
        html.setAttribute('data-rise', 'canyon');
      }, 900);
    } else {
      clearTimeout(show.t);
    }
  }

  function back(fromScroll = false) {
    if (S.state !== 'gorge') return;
    S.state = 'canyon';
    S.p = S.pT = S.v = S.uc = 0;
    S.g = S.gT = 0;
    dropDive = 0;
    setCover(false);
    paintOpacity(0);
    show(false);
    if (silkFlow && fromScroll && J && emergeCarry > 0) {
      const carry = emergeCarry; emergeCarry = 0;
      J.target = Math.min(J.max, Math.max(J.target, FROM() + carry));
    } else {
      emergeCarry = 0;
    }
  }

  /* One clock drives both directions and never samples a canvas from the other GL context. */
  let raf = 0, lastT = 0, clockSec = 0;
  let previousHeight = NaN, burstAt = -100, burstAmount = 0, splashAt = -100;
  let neededCanyonFrame = 0;
  let waitingForCanyon = false;
  const renderArgs = {
    camY: -14, camX: 0, surf: 1.14, surfY: 0, ceil: 1,
    glow: 1, deep: 0, time: 0, live: true, descent: true,
    drop: { r: T.dropR, opacity: 0 },
    waterline: {}
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function advanceCut(dt) {
    const target = S.pT;
    if (S.p === target && cutVelocity === 0) return;
    const duration = reducedMQ.matches ? 0.48 : T.cutSeconds;
    const speed = Math.sign(target - S.p) / duration;
    const decay = Math.exp(-dt * 19);
    cutPhase = clamp01(cutPhase + speed * dt + (cutVelocity - speed) * (1 - decay) / 19);
    cutVelocity = speed + (cutVelocity - speed) * decay;
    const previous = S.p;
    S.p = positionAtTime(cutPhase);
    S.v = (S.p - previous) / dt;
    if ((cutPhase === 0 && target === 0) || (cutPhase === 1 && target === totalLength)) {
      cutVelocity = S.v = 0;
    }
    S.uc = clamp01(S.p / crossLength);
    S.g = pToG(S.p);
    S.gT = pToG(target);
  }

  function drawGorge(dt, travelDt) {
    const t0 = now();
    const alive = !reducedMQ.matches;
    const y = S.pre ? S.openY : camYAtP(S.p);
    const sample = optics.sampleWaterline(y);
    S.waterline = sample;
    if (!S.pre) {
      const downwardSpeed = (previousHeight - y) / travelDt;
      if (alive && ((previousHeight > 0.72 && y <= 0.72) || (previousHeight < -0.43 && y >= -0.43))) {
        splashAt = clockSec;
      }
      if (alive && sample.proximity > 0.45 && downwardSpeed > 0.38 && clockSec - burstAt > 1.5) {
        burstAt = clockSec;
        burstAmount = smooth(0.38, 2.0, downwardSpeed);
      }
      previousHeight = y;
      const dropTarget = dropSubmersion(S.uc, y);
      if (linkedDrop()) dropDive = dropTarget;
      else dropDive += (dropTarget - dropDive) * (1 - Math.exp(-dt / 0.085));
      if (Math.abs(dropTarget - dropDive) < 0.001) dropDive = dropTarget;
    }

    // Unpark the canyon before the first frame that can show it, including direct seeks.
    const approachingSurface = rhythm?.overlapCopy && alive && !S.pre && S.pT === 0;
    const unparkHeight = approachingSurface ? -2.45 : -1.40;
    if (S.cover && y > unparkHeight) {
      neededCanyonFrame = waterView.frames + 1;
      setCover(false);
    }
    waitingForCanyon = !S.pre && !sample.fullyUnder && waterView.frames < neededCanyonFrame;
    const opacity = waitingForCanyon ? 1 : sample.oceanOpacity;
    if (!waitingForCanyon && opacity > 0.0001) {
      const match = 1 - smooth(4, 10.5, -y);
      const canyonLens = engine.canyon?.camera;
      const size = lite && innerWidth < innerHeight ? 65 : 62;
      const fov = (canyonLens?.fov ?? 64) * (1 - 0.14 * smooth(0.9, 3.4, -y));
      renderArgs.camY = y;
      const basePitch = waterView?.basePitch ?? opening.pitch;
      renderArgs.pitch = basePitch + (optics.underwaterPitch(-y) - basePitch) * sample.ceilingLook;
      renderArgs.surf = 1.14 + Math.max(0, -y - 2.8) * 0.08;
      renderArgs.ceil = 0.92 + 0.08 * smooth(2.1, 5.0, -y);
      renderArgs.deep = dive ? smooth(0, 1, dive.u(S.g)) : 0.25;
      renderArgs.time = alive ? clockSec : 0;
      renderArgs.live = alive;
      renderArgs.waterline.fov = size + (fov - size) * match;
      renderArgs.waterline.shallow = match;
      renderArgs.waterline.sun = waterView?.sunLocal ?? opening.sun;
      renderArgs.waterline.sunColor = waterView?.sunColor;
      renderArgs.waterline.advance = optics.advanceAtHeight(y);
      renderArgs.waterline.spray = alive ? burstAmount * (1 - smooth(0.15, 1.1, clockSec - burstAt)) : 0;
      renderArgs.waterline.shiftY = canyonLens?.projectionMatrix.elements[9] * match || 0;
      scene.render(renderArgs);
      if (!html.hasAttribute('data-rise-scene')) html.setAttribute('data-rise-scene', '');
      S.drawn++;
    }
    paintOpacity(opacity);
    if (!S.pre && S.stage === 'ready' && sample.fullyUnder && y <= unparkHeight - .25 && S.drawn > 0) setCover(true);
    if (!S.pre) {
      setXsUi(1 - smooth(-0.38, 0.82, -y));
      if (!sample.fullyUnder && now() - lastInput < 1400) window.__FLOW2_IDLE_HOLD__ = true;
    }
    // Retire the underwater sentence during the ascent. The next heading's
    // reveal waits for the dry lens instead of playing invisibly underwater.
    const copyFade = rhythm && !S.pre ? 1 - s5(S.openY * .7, -1.6, y) : 1;
    layoutSea(y, smooth(0.12, 1.58, -y), copyFade);
    S.frames++;
    S.ms ??= [];
    S.ms.push(+(now() - t0).toFixed(2));
    if (S.ms.length > 120) S.ms.shift();
  }

  function frame(t) {
    raf = 0;
    if (scene && (S.state === 'open' || S.state === 'close')) {
      lastT = 0;
      drawOpen();
      if (S.state === 'open' || S.state === 'close') kick();
      return;
    }
    if (!scene || !live() || document.hidden) { lastT = 0; return; }
    const elapsed = lastT ? Math.max(0.001, (t - lastT) / 1000) : 1 / 60;
    const dt = Math.min(0.0625, elapsed);
    // One slow frame should not stretch the whole ascent. The water simulation
    // keeps its short timestep; camera travel can catch up by at most 1/8 s.
    const travelDt = rhythm?.overlapCopy && !reducedMQ.matches ? Math.min(.125, elapsed) : dt;
    lastT = t;
    clockSec += dt;
    if (!S.pre) advanceCut(travelDt);
    if (!S.pre && S.pT === 0 && S.p === 0) {
      back(true);
      lastT = 0;
      return;
    }
    const settled = (S.pre || (Math.abs(S.p - S.pT) < 0.06 && Math.abs(S.v) < 0.8)) && now() - lastInput > 1100;
    drawGorge(dt, travelDt);
    window.__RISE_MOTION_SAMPLE__?.();
    if (!reducedMQ.matches || !settled || waitingForCanyon) kick();
    else lastT = 0;
  }

  document.addEventListener('visibilitychange', () => {
    lastT = 0;
    if (!document.hidden && live()) kick();
  });

  /* ---------------------------------------------------------------- Start: the first shot uses the canyon's measured banks */
  async function start() {
    buildDom(); ui.classList.add('is-on');
    S.stage = 'scene';
    const t0 = now();
    const [mod, waterline, entry, bubble] = await Promise.all([
      import(GORGE + 'dg-scene.js?v=' + STAMP.scene),
      import(HERE + 'index3-waterline.js?v=' + STAMP.optics),
      import(HERE + 'opening-shot.js?v=1'),
      import(HERE + 'rise-bubble-logo.js?v=11-published').catch(error => { console.warn('rise bubble logo: unavailable', error); return null; })
    ]);
    optics = waterline;
    scene = mod.createGorge({ canvas, tune: { depth: T.depth }, phone: false,
      riseWaterline: true, seaVideo: SEA_VIDEO_URL, gpuTimer: Q.get('gorgeGpu') === '1', dpr: renderScale(), texTier: uwTexTier, oceanSurface: UWQ === 'low' ? './ocean-surface-n-512.webp' : undefined, mono: 'RL Mono',
      warmDrop: !!(bubble && window.__FLOW2_DROP__), onUnderwaterFrame: (shot, light) => bubbleLogo?.update(shot, light) });
    await scene.load();

    const sts = scene.descent && scene.descent.stations || [];
    const sy = n => { const x = sts.find(q => q.name === n); return x ? +x.y : NaN; };
    stationY = ['insight', 'discipline', 'strategies'].map(sy);
    if (Q.get('riseBeats') !== 'all') stationY = [stationY[0], NaN, NaN];
    const want = Q.get('riseFrom') || 'insight';
    const authoredY = Number.isFinite(sy(want)) ? sy(want) : -Math.abs(parseFloat(want));
    const fallbackY = Number.isFinite(sy('insight')) ? sy('insight') : -14;
    S.openY = Math.min(-4.65, Math.max((scene.descent?.bottom ?? -56) + 1,
      Number.isFinite(authoredY) ? authoredY : fallbackY));
    layoutSea(S.openY, 1, 1);
    opening = { pitch: entry.openingShot.pitch, sun: new scene.THREE.Vector3().fromArray(entry.openingShot.sun) };
    const ocean = scene.ocean;
    if (ocean?.dials && html.hasAttribute('data-rise-published')) ocean.dials.rays = 0;
    if (ocean?.lightingRows) window.__FLOW2_PANEL__?.add({
      id: 'rise-water-light', title: '水下光影', key: 'z', tune: ocean.dials,
      rows: ocean.lightingRows, onChange: () => { if (S.drawn) kick(); },
      restoreSaved: saved => {
        const values = { ...saved };
        // Older settings stored texture frequency. Size is its reciprocal.
        for (const [frequencyKey, sizeKey] of [['surfaceScale', 'surfaceRippleSize'], ['causticScale', 'bedRippleSize']]) {
          const frequency = values[frequencyKey];
          if (!(sizeKey in values) && Number.isFinite(frequency) && frequency > 0) values[sizeKey] = 1 / frequency;
        }
        return values;
      }
    });
    if (bubble && ocean?.u.uRiseFogDensity) {
      try {
        bubbleLogo = bubble.createRiseBubbleLogo({
          gorge: scene, sun: opening.sun, copy: sea.blocks[0], redraw: kick,
          station: { y: fallbackY, z: -optics.advanceAtHeight(fallbackY), pitch: optics.underwaterPitch(-fallbackY) },
          sampleDrop: out => {
            if (!waterView || !engine.canyon?.camera) return 0;
            const radius = window.__FLOW2_DROP__?.sampleHandoff?.(engine.canyon.camera, dropDive, out) ?? 0;
            if (radius) waterView.toUnderwater(out, out);
            return radius;
          }
        });
      } catch (error) { console.warn('rise bubble logo: unavailable', error); }
    }
    scene.fitWaterEdges(entry.openingShot.edges);
    await scene.warm({
      ...renderArgs, camY: S.openY, surf: 2, deep: 0.25, live: false,
      pitch: optics.underwaterPitch(-S.openY),
      waterline: { sun: opening.sun, fov: 62, advance: optics.advanceAtHeight(S.openY) }
    });
    S.sceneMs = Math.round(now() - t0); S.sinceNav = Math.round(now());
    kick();

    S.stage = 'engine';
    for (let i = 0; i < 900 && !(window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey); i++) await new Promise(r => setTimeout(r, 50));
    study = window.__MONTIS_STUDY__; if (!study) throw new Error('Canyon engine did not start');
    await study.ready;
    for (let i = 0; i < 400 && !scopeReady(); i++) await new Promise(r => setTimeout(r, 50));
    J = study.journey;
    if (html.dataset.renderMode === 'text') { S.stage = 'off: text mode'; S.state = 'off'; show(false); return; }

    S.stage = 'dive';
    const crossing = installCrossing();
    const [dm] = await Promise.all([import(GORGE + 'dg-dive.js?v=' + STAMP.dive), crossing]);
    dive = await dm.createDive({ gorge: scene, T, S, Q: DQ, externalCrossing: true, forestCircle: CIRCLE });
    if (!dive.descent) throw new Error('No underwater descent path');
    wireDrop();
    installHold();

    if (dive.stationY && dive.stationY.length) stationY = dive.stationY.slice();
    if (Q.get('riseBeats') !== 'all') stationY = [stationY[0], NaN, NaN];

    {
      let lo = T.entry, hi = T.travel;
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2;
        if (dive.camY(m, scene.descent.top) > S.openY) lo = m; else hi = m;
      }
      S.gOpen = (lo + hi) / 2;
    }
    initMapping();
    bindFadingUI();
    S.p = S.pT = totalLength;
    S.v = 0;
    S.uc = 1;
    S.g = S.gT = S.gOpen;
    S.pre = false;
    S.drawn = 0;
    previousHeight = S.openY;
    S.prep = Math.round(now() - t0) + ' ms';
    S.info = scene.info;
    S.stage = 'ready'; html.setAttribute('data-rise-ready', '');
    if (TD) import(HERE + 'td-transition.js?v=' + STAMP.td).then(m => m.createTransition({
      Q, engine, study, getJ: () => J, H, P1, html, reduced: reducedMQ, lite, base: HERE,
      canStart: () => S.state === 'canyon' && S.stage === 'ready' && tdOK(),
      self: fn => { S.self = true; try { fn(); } finally { S.self = false; } }
    })).then(made => { td = api.td = made; }).catch(error => { note('td: ' + (error?.message || error)); console.warn('rise td: left out (the stroke of lift-cut plays)', error); });
    if (pendingDirection) { push(pendingDirection); pendingDirection = 0; }
    kick();

    setInterval(() => {
      if (!J || S.stage !== 'ready') return;
      const p = +J.progress;
      if (S.state === 'after' && p < H() - 0.05) S.state = 'canyon';
      else if (S.state === 'canyon' && p > P1() + (OUT === 'stroke' ? 0.3 : 0.05)) S.state = 'after';   /* MASTER: under the stroke the valley flies on up to .2 past picture one; 'after' at +.05 switched the drop off in ONE frame while the wipe's soft edge was still crossing it (measured: brush .73). Now only once the journey has really moved to the view from above */
    }, 300);

    addEventListener('resize', () => {
      if (!scene) return;
      scene.setSize(innerWidth, innerHeight, renderScale());
      kick();
    }, { passive: true });
  }

  start().catch(error => {
    S.stage = 'failed: ' + (error?.message || error); console.warn('rise: left out', error);
    bubbleLogo?.dispose(); bubbleLogo = null;
    S.state = 'off'; setCover(false);
    if (canvas) show(false);
    else { html.removeAttribute('data-xs-gorge'); html.style.removeProperty('--xs-ui'); html.setAttribute('data-rise', 'canyon'); }
  });

  /* ---------------------------------------------------------------- Live QA hooks */
  api.scene = () => scene;
  api.dive = () => dive;
  api.seek = g => {
    if (S.stage !== 'ready') return false;
    if (S.state !== 'gorge' && !begin()) return false;
    S.g = S.gT = Math.max(0, Math.min(S.gOpen, g));
    S.p = S.pT = gToP(S.g);
    S.v = 0;
    cutVelocity = 0;
    cutPhase = timeAtPosition(S.p);
    S.uc = clamp01(S.p / crossLength);
    previousHeight = camYAtP(S.p);
    dropDive = dropSubmersion(S.uc, previousHeight);
    kick();
    return true;
  };
  api.back = () => back();
  api.circleHold = ms => { S.circleHold = ms == null ? null : +ms; kick(); };
  api.hold = () => (J ? +H().toFixed(4) : null);
  api.stats = () => {
    const a = (S.ms || []).slice().sort((x, y) => x - y), gq = (scene && scene.info.gpu || []).slice().sort((x, y) => x - y);
    const curDepth = S.state === 'gorge' && S.waterline ? +S.waterline.height.toFixed(3) : airHeight ?? S.openY;
    return {
      state: S.state, stage: S.stage, pre: S.pre,
      g: +S.g.toFixed(1), gT: +S.gT.toFixed(1), gOpen: +(+S.gOpen).toFixed(1),
      p: +S.p.toFixed(1), pT: +S.pT.toFixed(1), uc: +S.uc.toFixed(4), waterline: S.waterline,
      entry: T.entry, openY: S.openY, depth: curDepth, cover: S.cover, canyonFrames: waterView?.frames ?? 0,
      cpuMsMedian: a[a.length >> 1], gpuMsMedian: gq.length ? +gq[gq.length >> 1].toFixed(2) : null,
      frames: S.frames, sceneMs: S.sceneMs, prep: S.prep, notes: S.notes,
      ocean: !!(scene && scene.ocean), hold: J ? +H().toFixed(3) : null, ck: +(+S.ck).toFixed(3), snap: S.snap,
      drop: (() => { const SG = window.__FLOW2_SEAGULL__; return SG && SG.ctx && SG.ctx.state && SG.ctx.state.drop || null; })(),
      dropOn: !!(window.__FLOW2_SEAGULL__ && window.__FLOW2_SEAGULL__.ctx && window.__FLOW2_SEAGULL__.ctx.drop && window.__FLOW2_SEAGULL__.ctx.drop.on)
    };
  };
})();
