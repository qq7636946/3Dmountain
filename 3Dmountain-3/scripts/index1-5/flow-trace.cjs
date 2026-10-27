'use strict';
/* flow-trace.cjs — flow.cjs's wheel run with a CPU profile attached: for every hitch frame (> --hitch ms) and long task
   (> --long ms) it lists the heaviest functions (self time, and inclusive time) that ran inside that window, so each
   hitch gets a named cause instead of a number. Same recorder and wheel cadence as flow.cjs.
   Usage: node scripts/index1-5/flow-trace.cjs [--dir down|up|both] [--interval 120] [--delta 100] [--max 700] [--phone] [--query "&flowfix=0"]
          [--hitch 25] [--long 40] [--out NAME] [--noprofile]
   Output: .qa/index1-5/<NAME>/trace.json (+ stdout digest). Numbers from a profiled run are slightly worse than flow.cjs's. */
const path = require('node:path');
const L = require('./lib.cjs');

const RECORDER = () => {
  const S = window.__MONTIS_STUDY__, frames = [], longs = [];
  window.__FLOW__ = { frames, longs, lastInput: -1e9, on: true };
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) longs.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: false }); } catch { }
  addEventListener('wheel', () => { window.__FLOW__.lastInput = performance.now(); }, { capture: true, passive: true });
  let last = performance.now();
  const tick = now => {
    if (!window.__FLOW__.on) return;
    const j = S.journey, P = S.portfolio, W = S.world;
    let sec = 'journey', clock = j.progress, y = 0, tr = 0, strip = 0;
    if (P && P.open) { tr = P.transition || 0; strip = P.strip || 0; sec = tr < .999 ? 'bridge' : 'cards'; clock = tr < .999 ? tr : 1 + strip; }
    if (W && W.open) { try { y = W.state.y; } catch { } sec = 'world'; clock = y; }
    frames.push([Math.round(now), Math.round((now - last) * 10) / 10, sec, Math.round(clock * 10000) / 10000, now - window.__FLOW__.lastInput < 260 ? 1 : 0]);
    last = now; requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/* --gl: every WebGL call that blocks the main thread >= 1.5 ms (compile/link/upload/readback...), with its canvas, on the page clock */
const GL_INIT = () => {
  const log = window.__GLLOG__ = [];
  const tag = c => { try { if (!c) return '?'; const p = c.parentElement; return (c.id || c.className || (p && (p.id || p.className)) || 'canvas') + ''; } catch { return '?'; } };
  const shName = new WeakMap(), progName = new WeakMap();
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i += 7) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
  const fp = src => { const us = [...src.matchAll(/uniform\s+(?:highp\s+|mediump\s+|lowp\s+)?\w+\s+(u[A-Z]\w*)/g)].map(m => m[1]); const nm = /#define SHADER_NAME (\S+)/.exec(src); return (nm ? nm[1] : '') + '#' + hash(src) + '(' + us.slice(0, 3).join(',') + ')'; };
  const nameOf = p => (progName.get(p) || []).join('+');
  const names = ['linkProgram', 'compileShader', 'getProgramParameter', 'getProgramInfoLog', 'getShaderParameter', 'getShaderInfoLog', 'texImage2D', 'texSubImage2D', 'texStorage2D', 'texImage3D', 'generateMipmap', 'readPixels', 'finish', 'bufferData', 'bufferSubData', 'checkFramebufferStatus', 'copyTexSubImage2D', 'blitFramebuffer', 'compressedTexImage2D', 'getExtension', 'getParameter', 'getUniformLocation', 'getActiveUniform', 'getSupportedExtensions'];
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    const ss = C.prototype.shaderSource; C.prototype.shaderSource = function (sh, src) { try { shName.set(sh, fp(src)); } catch { } return ss.call(this, sh, src); };
    const at = C.prototype.attachShader; C.prototype.attachShader = function (p, sh) { try { const a = progName.get(p) || []; a.push(shName.get(sh) || '?'); progName.set(p, a); } catch { } return at.call(this, p, sh); };
    for (const n of names) {
      const f = C.prototype[n]; if (typeof f !== 'function') continue;
      C.prototype[n] = function (...a) {
        const t = performance.now(); const r = f.apply(this, a); const d = performance.now() - t;
        if (d >= 1.5 || n === 'linkProgram') { let extra = ''; if (n === 'linkProgram' || n === 'getProgramInfoLog' || n === 'getProgramParameter') extra = ' <' + nameOf(a[0]) + '>'; log.push([Math.round(t), +d.toFixed(1), n + extra, tag(this.canvas)]); }
        return r;
      };
    }
  }
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...r) { const t = performance.now(); const v = gc.call(this, type, ...r); const d = performance.now() - t; if (/webgl/.test(type)) log.push([Math.round(t), +d.toFixed(1), 'getContext ' + type, tag(this)]); return v; };
};

function digest(profile, offsetMs, windows, topN) {
  const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
  const nm = n => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber + 1}`;
  const skip = s => /^\((idle|program|root)\)/.test(s);
  // sample times on the page clock
  const times = new Array(profile.samples.length); let t = profile.startTime;
  for (let i = 0; i < times.length; i++) { t += profile.timeDeltas[i] || 0; times[i] = offsetMs + (t - profile.startTime) / 1000; }
  return windows.map(w => {
    const self = new Map(), incl = new Map(); let total = 0, idle = 0, program = 0, gc = 0;
    for (let i = 0; i < times.length; i++) {
      if (times[i] < w.a || times[i] > w.b) continue;
      const dt = (profile.timeDeltas[i + 1] ?? profile.timeDeltas[i] ?? 0) / 1000, n = byId.get(profile.samples[i]); if (!n) continue;
      const name = nm(n);
      if (/^\((idle)\)/.test(name)) { idle += dt; continue; }
      if (/^\(program\)/.test(name)) program += dt; else if (/^\(garbage collector\)/.test(name)) gc += dt;
      total += dt; self.set(name, (self.get(name) || 0) + dt);
      const seen = new Set();
      for (let m = n, k = 0; m && k < 40; k++, m = byId.get(parent.get(m.id))) { const s = nm(m); if (skip(s) || seen.has(s)) continue; seen.add(s); incl.set(s, (incl.get(s) || 0) + dt); }
    }
    const top = (m, k) => [...m].filter(([s]) => !/^\((idle|root)\)/.test(s)).sort((x, y) => y[1] - x[1]).slice(0, k).map(([s, v]) => `${v.toFixed(1)}ms ${s}`);
    return { ...w.info, busyMs: +total.toFixed(1), idleMs: +idle.toFixed(1), programMs: +program.toFixed(1), gcMs: +gc.toFixed(1), self: top(self, topN), incl: top(incl, topN) };
  });
}

L.main('flow-trace', {
  usage: 'flow-trace.cjs [--dir both|down|up] [--interval 120] [--delta 100] [--max 700] [--phone] [--query "&x=1"] [--hitch 25] [--long 40] [--out NAME] [--noprofile] [--early "group.key=v"]', timeout: 1800,
  spec: { dir: 'value', interval: 'value', delta: 'value', max: 'value', w: 'value', h: 'value', phone: 'bool', query: 'value', reduced: 'bool', out: 'value', hitch: 'value', long: 'value', noprofile: 'bool', top: 'value', inclN: 'value', early: 'value', gl: 'bool', trace: 'bool' },
}, async o => {
  const dir = String(o.dir || 'both'), every = Number(o.interval) || 120, delta = Number(o.delta) || 100, maxN = Number(o.max) || 700;
  const hitchMs = Number(o.hitch) || 25, longMs = Number(o.long) || 40, topN = Number(o.top) || 10;
  const out = L.outDir('flow-trace', o.out);
  const sets = o.early ? L.parseSets(o.early, 'early') : [];
  let s;
  if (o.gl) {
    await L.acquireLock('flow-trace', o);
    const vp0 = L.viewport(o), browser = await L.launchBrowser({ autoplay: true });
    s = await L.newPage(browser, vp0, { reduced: !!o.reduced });
    await s.context.addInitScript(GL_INIT);
    s.earlyRoute = sets.length ? await L.installEarlySets(s.page, sets) : null;
    s.url = L.pageUrl({ tune: '0' }, o.query);
    L.note(`flow-trace(gl): ${s.url}`);
    s.ms = await L.loadPage(s.page, s.url); L.note(`ready ${s.ms.ready} ms, journey ${s.ms.journey} ms`);
    if (s.earlyRoute) s.early = await L.readEarly(s.page, s.earlyRoute);
    Object.assign(s, { browser, vp: vp0 });
  } else s = await L.openSession('flow-trace', o, { autoplay: true, early: sets.length ? sets : null });
  const { page, log, vp, context } = s;
  await page.waitForTimeout(1500);
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.evaluate(RECORDER);
  let cdp = null, offset = 0;
  const run = async (sign, label) => {
    if (!o.noprofile) {
      cdp = await context.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 400 });
      const a = await page.evaluate(() => performance.now()); await cdp.send('Profiler.start'); const b = await page.evaluate(() => performance.now()); offset = (a + b) / 2;
    }
    let tcdp = null, tevents = [], tsync = 0;
    if (o.trace) {
      tcdp = await context.newCDPSession(page); tcdp.on('Tracing.dataCollected', e => { for (const v of e.value) tevents.push(v); });
      await tcdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,v8.execute,gpu,gpu.angle,disabled-by-default-gpu.service,viz,cc', transferMode: 'ReportEvents' });
      tsync = await page.evaluate(() => { performance.mark('ff-sync'); return performance.now(); });
    }
    const n0 = await page.evaluate(() => window.__FLOW__.frames.length), l0 = await page.evaluate(() => window.__FLOW__.longs.length);
    let n = 0, still = 0, prev = null;
    for (; n < maxN; n++) {
      await page.mouse.wheel(0, sign * delta); await page.waitForTimeout(every);
      if (n % 5 === 4) {
        const st = await page.evaluate(() => { const S = window.__MONTIS_STUDY__, j = S.journey, W = S.world; let y = 0, maxY = 0, open = false; try { if (W && W.open) { open = true; y = W.state.y; maxY = W.state.maxY; } } catch { } return { p: j.progress, open, y, maxY }; });
        const key = JSON.stringify([Math.round(st.p * 1000), st.open, Math.round(st.y)]);
        const atEnd = sign > 0 ? (st.open && st.maxY > 0 && st.y >= st.maxY - 2) : (!st.open && st.p < .002);
        still = key === prev ? still + 1 : 0; prev = key;
        if (atEnd || still >= 6) break;
      }
    }
    await page.waitForTimeout(1600);
    let profile = null;
    if (cdp) { profile = (await cdp.send('Profiler.stop')).profile; await cdp.detach().catch(() => { }); }
    const data = await page.evaluate(([n0, l0]) => ({ frames: window.__FLOW__.frames.slice(n0), longs: window.__FLOW__.longs.slice(l0) }), [n0, l0]);
    const wins = [];
    data.frames.forEach((f, i) => { if (i && f[1] > hitchMs) wins.push({ a: f[0] - f[1] - 4, b: f[0] + 4, info: { kind: 'frame', ms: f[1], sec: f[2], clock: f[3], t: f[0] } }); });
    for (const [t, d] of data.longs) if (d >= longMs) wins.push({ a: t - 2, b: t + d + 2, info: { kind: 'longtask', ms: d, t } });
    const rep = profile ? digest(profile, offset, wins, topN).map((r, i) => ({ ...r, gl: wins[i].info.gl, trace: wins[i].info.trace, gpuTrace: wins[i].info.gpuTrace })) : wins.map(w => w.info);
    if (tcdp) {
      const done = new Promise(r => tcdp.once('Tracing.tracingComplete', r)); await tcdp.send('Tracing.end'); await done; await tcdp.detach().catch(() => { });
      const sync = tevents.find(e => e.name === 'ff-sync');
      if (sync) {
        const offset = sync.ts / 1000 - tsync, main = tevents.filter(e => e.pid === sync.pid && e.tid === sync.tid && e.ph === 'X' && e.dur >= 1500);
        const gpuEv = tevents.filter(e => e.pid !== sync.pid && e.ph === 'X' && e.dur >= 2500);
        const tname = new Map(); for (const e of tevents) if (e.ph === 'M' && e.name === 'thread_name') tname.set(e.pid + ':' + e.tid, e.args.name);
        for (const w of wins) {
          const a = (w.info.t - (w.info.ms || 0) - 4 + offset) * 1000, b = (w.info.t + 4 + offset) * 1000;
          w.info.gpuTrace = gpuEv.filter(e => e.ts + e.dur >= a && e.ts <= b).sort((x, y) => y.dur - x.dur).slice(0, 7).map(e => `${(e.dur / 1000).toFixed(1)}ms ${e.name} [${tname.get(e.pid + ':' + e.tid) || e.tid}]`);
          w.info.trace = main.filter(e => e.ts + e.dur >= a && e.ts <= b && !/^(RunTask|ThreadControllerImpl::RunTask|ThreadControllerImpl::DoWork)$/.test(e.name)).sort((x, y) => y.dur - x.dur).slice(0, 9)
            .map(e => { const d = e.args && (e.args.data || e.args.beginData) || {}; const hint = d.functionName || d.url || d.type || d.frame || ''; return `${(e.dur / 1000).toFixed(1)}ms ${e.name}${hint ? ' ' + String(hint).split('/').pop().slice(0, 40) : ''}`; });
        }
      }
    }
    const gl = o.gl ? await page.evaluate(() => window.__GLLOG__ || []) : null;
    if (gl) {
      for (const w of wins) { const a = w.info.t - (w.info.ms || 0) - 6, b = w.info.t + 6; w.info.gl = gl.filter(g => g[0] >= a && g[0] <= b && (g[1] >= 1.5 || /^linkProgram/.test(g[2]))).sort((x, y) => y[1] - x[1]).slice(0, 10).map(g => `${g[1]}ms ${g[2]} [${g[3]}]`); }
    }
    const extra = await page.evaluate(() => {
      const out = { measures: performance.getEntriesByType('measure').filter(e => e.duration > 5).map(e => [e.name, Math.round(e.startTime), Math.round(e.duration)]) };
      try { const g = window.__MONTIS_STUDY__.world.state.logo; if (g) out.logo = { log: g.log, timings: g.timings, newPrograms: g.newPrograms, glassFound: g.glassFound }; } catch { }
      try { out.marks = performance.getEntriesByType('mark').filter(e => /^flowfix|^ff:/.test(e.name)).map(e => [e.name, Math.round(e.startTime)]); } catch { }
      try { out.flowfix = window.__FLOWFIX__ ? JSON.parse(JSON.stringify(window.__FLOWFIX__)) : null; } catch { }
      return out;
    });
    if (gl) extra.glAll = gl.filter(g => g[0] >= (data.frames[0]?.[0] || 0) - 500 && (g[1] >= 8 || /^linkProgram/.test(g[2]))).map(g => `${g[0]} ${g[1]}ms ${g[2]} [${g[3]}]`);
    return { label, notches: n, rep, frames: data.frames.length, extra };
  };
  const res = {};
  if (dir !== 'up') res.down = await run(1, 'down');
  if (dir !== 'down') { if (dir === 'up') await page.evaluate(() => { const j = window.__MONTIS_STUDY__.journey; j.target = j.max; }); res.up = await run(-1, 'up'); }
  await page.evaluate(() => { window.__FLOW__.on = false; });
  for (const k of Object.keys(res)) { const x = res[k].extra; if (!x) continue; console.log(`== ${k} extra: measures ${JSON.stringify(x.measures)}`); if (x.logo) console.log(`   logo log ${JSON.stringify(x.logo.log)} timings ${JSON.stringify(x.logo.timings)} newPrograms ${JSON.stringify(x.logo.newPrograms)}`); if (x.flowfix) console.log('   flowfix ' + JSON.stringify(x.flowfix)); if (x.glAll) console.log('   glAll(>=8ms) ' + x.glAll.join(' ; ')); }
  L.writeJson(path.join(out, 'trace.json'), { url: s.url, viewport: vp, interval: every, res, logs: L.logJson(log) });
  for (const k of Object.keys(res)) {
    console.log(`== ${k}: ${res[k].notches} notches, ${res[k].frames} frames`);
    for (const r of res[k].rep) {
      console.log(`-- ${r.kind} ${r.ms}ms @${r.t} ${r.sec || ''} ${r.clock ?? ''} busy ${r.busyMs ?? '?'}ms (program ${r.programMs ?? '?'} gc ${r.gcMs ?? '?'} idle ${r.idleMs ?? '?'})`);
      if (r.gpuTrace && r.gpuTrace.length) console.log('   gpu: ' + r.gpuTrace.join(' | '));
      if (r.trace && r.trace.length) console.log('   trace: ' + r.trace.join(' | '));
      if (r.gl && r.gl.length) console.log('   gl: ' + r.gl.join(' | '));
      if (r.self) { console.log('   self: ' + r.self.slice(0, 7).join(' | ')); console.log('   incl: ' + r.incl.slice(0, +o.inclN || 9).join(' | ')); }
    }
  }
  console.log('json', L.abs(path.join(out, 'trace.json')));
  L.printLog(log);
  return log.errors.length ? 1 : 0;
});
