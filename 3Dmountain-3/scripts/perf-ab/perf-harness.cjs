// A/B performance + visual-parity harness for index4-6-3.html (real GPU, deterministic stepping).
//
//   node perf-harness.cjs --base http://127.0.0.1:5200/__base__/ --label baseline --profile desktop
//   node perf-harness.cjs --base http://127.0.0.1:5199/          --label opt      --profile desktop
//
// Options: --profile desktop|desktop1x|phone  --frames 90  --settle 60  --scenarios a,b,c
//          --png <dir> (save full-res PNG per scenario)  --raf 120 (also run a rAF-cadence pass)
//          --ui-png (also capture fully revealed logo/finale interface with --png)
//          --boot N (cold-load N times, report time-to-ready/bytes)  --throttle (Slow-4G + 4x CPU for --boot)
//          --sweep (leak test: walk all scenarios twice, compare memory counters)
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const argv = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next !== undefined && !next.startsWith('--')) { argv[a.slice(2)] = next; i++; } else argv[a.slice(2)] = true;
}
const BASE = argv.base || 'http://127.0.0.1:5199/';
const LABEL = argv.label || 'run';
const PROFILE = argv.profile || 'desktop';
const PAGE = argv.page || 'index4-6-3.html';
const FRAMES = Number(argv.frames || 90);
const SETTLE = Number(argv.settle || 150);
const RAF_FRAMES = Number(argv.raf || 0);
const BOOT = Number(argv.boot || 0);
const SWEEP = !!argv.sweep;
const THROTTLE = !!argv.throttle;
const PNG_DIR = argv.png ? path.resolve(argv.png) : null;
const OUT = argv.out ? path.resolve(argv.out) : path.join(__dirname, `perf-${LABEL}-${PROFILE}.json`);
const SCEN = (argv.scenarios || 'hero,disperse,logo,transition,zoom,canyon,water-transition,rivers,finale').split(',');
const QUERY = argv.query || 'tune=0';

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36';
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  desktop1x: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  desktop4k: { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 }, // stress: GPU-bound passes become visible on a fast GPU
  desktop150: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 },  // what-if: DPR cap 1.5
  desktop125: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 }, // what-if: DPR cap 1.25
  desktopTiny: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 0.5 }, // ~1/11 of the pixels: what is left is vertex/fixed cost
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: MOBILE_UA }
};

const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r2 = x => (x === null || x === undefined || Number.isNaN(x)) ? null : Math.round(x * 100) / 100;

const LAUNCH_ARGS = [
  '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl',
  '--enable-precise-memory-info', '--js-flags=--expose-gc',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-frame-rate-limit', '--disable-gpu-vsync'
];

// ---- code that runs inside the page -------------------------------------------------------------
function installInPage() {
  const raw = window.requestAnimationFrame.bind(window);
  window.__rawRaf = raw;
  window.__rafFrozen = false;
  window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); });
}

const PAGE_API = `(() => {
  const S = () => window.__MONTIS_STUDY__;
  const nextRaf = () => new Promise(r => window.__rawRaf(r));
  const api = {
    scenarioProgress(name) {
      const s = S(), C = s.CONFIG;
      const shift = Math.max(0, s.logoChapterEnd() - C.disperse.handoff * 2.6) + s.forwardLength() - .572;
      const logoStart = C.logo.at * 2.6;
      const map = {
        hero: 0, disperse: .52,
        logo: logoStart + C.logo.length * .44,
        transition: s.logoChapterEnd() - .16,
        zoom: s.logoChapterEnd() + s.forwardLength() * .55,
        canyon: 4.6 + shift, 'water-transition': 8.7 + shift, rivers: 10.98 + shift,
        finale: s.journey.max
      };
      if (!(name in map)) throw new Error('unknown scenario ' + name);
      return map[name];
    },
    jump(name) { const s = S(); const p = api.scenarioProgress(name); s.journey.progress = s.journey.target = p; return p; },
    memory() {
      const s = S(), r = s.renderer;
      return { geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: r.info.programs ? r.info.programs.length : null,
               heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 100) / 100 : null };
    },
    async scenario(name, frames, settle, wantPng) {
      const s = S(), r = s.renderer, gl = r.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const progress = api.jump(name);
      s.step(settle, 1 / 60);
      // 1) draw-call / triangle accounting for exactly one whole frame (all passes)
      r.info.autoReset = false; r.info.reset();
      s.step(1, 1 / 60);
      const counts = { calls: r.info.render.calls, triangles: r.info.render.triangles, points: r.info.render.points, lines: r.info.render.lines };
      r.info.autoReset = true; r.info.reset();
      // 2) allocation pass (no harness objects in the loop): sum of positive heap deltas = bytes allocated
      if (window.gc) window.gc();
      let alloc = 0, gcs = 0, prev = performance.memory.usedJSHeapSize;
      for (let i = 0; i < frames; i++) {
        s.step(1, 1 / 60);
        const h = performance.memory.usedJSHeapSize;
        if (h >= prev) alloc += h - prev; else gcs++;
        prev = h;
      }
      // 3) timing pass: CPU submit time, drained time (readPixels is the real sync point — Chrome's
      //    gl.finish() is only a flush), GPU time (timer query, harvested one by one)
      const cpu = [], wall = [], pending = [], gpu = [];
      const sink = new Uint8Array(4);
      const harvest = () => {
        while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
          const q = pending.shift();
          const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
          const v = gl.getQueryParameter(q, gl.QUERY_RESULT);
          if (!disjoint) gpu.push(v / 1e6);
          gl.deleteQuery(q);
        }
      };
      for (let i = 0; i < frames; i++) {
        let q = null;
        if (ext) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
        const t0 = performance.now();
        s.step(1, 1 / 60);
        const t1 = performance.now();
        if (ext) gl.endQuery(ext.TIME_ELAPSED_EXT);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sink);
        const t2 = performance.now();
        cpu.push(t1 - t0); wall.push(t2 - t0);
        if (q) { pending.push(q); harvest(); }
      }
      if (ext) {
        for (let tries = 0; tries < 300 && pending.length; tries++) { await nextRaf(); harvest(); }
        for (const q of pending) gl.deleteQuery(q);
      }
      // 4) pixels: pin the scene clock (test-only hook injected by the harness, identical for A and B) so
      //    grain / waves are comparable, then grab one frame in the same task (buffer is not preserved)
      if (window.__setSceneTime) window.__setSceneTime(1000);
      s.step(1, 1 / 60);
      const c = r.domElement;
      let src = c;
      while (src.width / 2 >= 192) { // exact 2x2 box averages, so per-pixel grain is averaged away
        const t = document.createElement('canvas'); t.width = Math.floor(src.width / 2); t.height = Math.floor(src.height / 2);
        const x = t.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, t.width, t.height);
        src = t;
      }
      const small = document.createElement('canvas'); small.width = 192; small.height = Math.max(1, Math.round(192 * c.height / c.width));
      const ctx = small.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, small.width, small.height);
      const px = ctx.getImageData(0, 0, small.width, small.height).data;
      let bin = ''; for (let i = 0; i < px.length; i += 4096) bin += String.fromCharCode.apply(null, px.subarray(i, Math.min(px.length, i + 4096)));
      const png = wantPng ? c.toDataURL('image/png') : null;
      return { progress, counts, alloc, gcs, cpu, wall, gpu, thumb: { w: small.width, h: small.height, b64: btoa(bin) }, png,
               canvas: { w: c.width, h: c.height }, mem: api.memory() };
    },
    // Per-pass GPU breakdown: wraps every composer pass (and any top-level renderer.render outside a pass,
    // e.g. logoGlass.capture / canyon blend target) in its own timer query. Needs the test-only exposure patch.
    async passProfile(name, frames, settle) {
      const s = S(), r = s.renderer, gl = r.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) throw new Error('no timer query');
      if (!s.composer) throw new Error('composer not exposed (patch missing)');
      api.jump(name); s.step(settle, 1 / 60);
      const passes = s.composer.passes;
      const labels = passes.map((p, i) => i + ':' + p.constructor.name + (p.constructor.name === 'ShaderPass' || p.constructor.name === 'Pass' ? '[' + Object.keys(p.uniforms || p.material?.uniforms || {}).filter(k => k !== 'tDiffuse').slice(0, 3).join(',') + ']' : ''));
      const enabled = passes.map(p => !!p.enabled);
      const describe = a => a && a.isScene ? (a === s.canyon.scene ? 'canyon.scene' : 'scene') : (a && a.isMesh ? 'quad:' + (a.material && a.material.type) : (a && a.type) || '?');
      let depth = 0, current = null; const frameQs = [];
      const origRender = r.render.bind(r);
      r.render = function (...a) {
        if (depth === 0) {
          const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); depth++;
          try { return origRender(...a); } finally { depth--; gl.endQuery(ext.TIME_ELAPSED_EXT); frameQs.push(['extra:' + describe(a[0]), q]); }
        }
        return origRender(...a);
      };
      const restore = [];
      passes.forEach((p, i) => {
        const o = p.render; restore.push(() => { p.render = o; });
        const ob = o.bind(p);
        p.render = (...args) => {
          if (depth) return ob(...args);
          const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); depth++;
          try { return ob(...args); } finally { depth--; gl.endQuery(ext.TIME_ELAPSED_EXT); frameQs.push([labels[i], q]); }
        };
      });
      const sink = new Uint8Array(4); const acc = {}; let totals = [];
      for (let f = 0; f < frames; f++) {
        frameQs.length = 0;
        s.step(1, 1 / 60);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sink);
        for (let t = 0; t < 50 && !frameQs.every(([, q]) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)); t++) await nextRaf();
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        let sum = 0;
        for (const [label, q] of frameQs) {
          if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !disjoint) { const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; (acc[label] = acc[label] || []).push(ms); sum += ms; }
          gl.deleteQuery(q);
        }
        if (!disjoint) totals.push(sum);
      }
      r.render = origRender; restore.forEach(fn => fn());
      const med = a => { const x = [...a].sort((p, q) => p - q); return x.length ? x[x.length >> 1] : null; };
      const rows = Object.entries(acc).map(([label, a]) => ({ label, ms: med(a), n: a.length })).sort((p, q) => q.ms - p.ms);
      return { enabled: labels.map((l, i) => l + (enabled[i] ? '' : ' (off)')), totalMs: med(totals), rows };
    },
    async rafPass(name, frames) {
      const s = S();
      api.jump(name); s.step(40, 1 / 60);
      await nextRaf();
      const interval = [], cpu = [];
      let last = performance.now();
      for (let i = 0; i < frames; i++) {
        await nextRaf();
        const t0 = performance.now();
        s.step(1, 1 / 60);
        cpu.push(performance.now() - t0);
        interval.push(t0 - last); last = t0;
      }
      return { interval, cpu };
    },
    async sweep(names, settle) {
      const s = S(); const snaps = [];
      for (let round = 0; round < 3; round++) {
        for (const n of names) { api.jump(n); s.step(settle, 1 / 60); await nextRaf(); }
        api.jump('hero'); s.step(settle, 1 / 60);
        if (window.gc) { window.gc(); await new Promise(r => setTimeout(r, 50)); window.gc(); }
        snaps.push(api.memory());
      }
      return snaps;
    }
  };
  window.__perf = api;
})()`;

// ---- node side ------------------------------------------------------------------------------------
async function newSession(browser, profile, patch = true) {
  const context = await browser.newContext({ ...PROFILES[profile], ignoreHTTPSErrors: true });
  await context.addInitScript(installInPage);
  const page = await context.newPage();
  page.setDefaultTimeout(240000);
  // Test-only instrumentation, applied identically to every build under test: expose a setter for the
  // scene clock so a frame can be captured at a pinned time (grain/wave phase would otherwise differ
  // between runs because the page ran a different number of boot frames each time).
  if (patch) await page.route(u => u.pathname.endsWith('/' + PAGE), async route => {
    const resp = await route.fetch();
    const body = await resp.text();
    let patched = body.replace('let sceneTime = 0;', 'let sceneTime = 0; window.__setSceneTime = v => { sceneTime = v; };');
    if (patched === body) console.warn('!! sceneTime hook NOT applied (marker not found) — pixel comparisons will be noisy');
    // expose a few internals for the per-pass profiler (read-only use; not part of the shipped page)
    const before = patched;
    patched = patched.replace('window.__MONTIS_STUDY__ = { canyonMotion,', 'window.__MONTIS_STUDY__ = { composer, renderTarget, grainPass, bloom, logoGlass, canyonTarget, journeyBlend, canyonMotion,');
    if (patched === before) console.warn('!! internals exposure NOT applied — --passes will not work');
    await route.fulfill({ response: resp, body: patched });
  });
  const log = { errors: [], warnings: [], pageErrors: [], failed: [], requests: [] };
  page.on('console', m => {
    const t = m.type();
    if (t === 'error') log.errors.push(m.text().slice(0, 300));
    else if (t === 'warning') log.warnings.push(m.text().slice(0, 300));
  });
  page.on('pageerror', e => log.pageErrors.push(String(e).slice(0, 400)));
  page.on('requestfailed', r => log.failed.push(r.url().slice(0, 200) + ' :: ' + (r.failure() && r.failure().errorText)));
  page.on('crash', () => log.pageErrors.push('PAGE CRASH'));
  page.on('requestfinished', async r => {
    try { const s = await r.sizes(); log.requests.push({ url: r.url(), type: r.resourceType(), bytes: s.responseBodySize + s.responseHeadersSize, body: s.responseBodySize }); } catch {}
  });
  return { context, page, log };
}

async function waitReady(page, ms = 180000) {
  await page.waitForFunction(() => document.body && document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: ms, polling: 250 });
}

function summarize(arr) { return { median: r2(median(arr)), p95: r2(pct(arr, 0.95)), min: r2(Math.min(...arr)), max: r2(Math.max(...arr)), n: arr.length }; }

async function benchmarkBrowserPid(browser) {
  try {
    const session = await browser.newBrowserCDPSession();
    const { processInfo } = await session.send('SystemInfo.getProcessInfo');
    const pid = processInfo.find(info => info.type === 'browser')?.id || null;
    await session.detach();
    return pid;
  } catch { return null; }
}

async function runBoot(firstBrowser, checkpoint) {
  const trials = [];
  const snapshot = () => {
    const ok = trials.filter(t => t.readyMs > 0).map(t => t.readyMs);
    const chapterOk = trials.filter(t => t.chapterReadyMs > 0).map(t => t.chapterReadyMs);
    return { throttle: THROTTLE, expectedTrials: BOOT, completedTrials: trials.length, trials,
      readyMs: ok.length ? { median: median(ok), min: Math.min(...ok), max: Math.max(...ok) } : null,
      chapterReadyMs: chapterOk.length ? { median: median(chapterOk), min: Math.min(...chapterOk), max: Math.max(...chapterOk) } : null };
  };
  for (let i = 0; i < BOOT; i++) {
    // A separate Chrome also isolates the HTTP/font/shader caches between cold trials.
    const browser = i === 0 ? firstBrowser : await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: LAUNCH_ARGS });
    const browserPid = await benchmarkBrowserPid(browser);
    try {
      const { context, page, log } = await newSession(browser, PROFILE, false);
      if (THROTTLE) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      }
      const t0 = Date.now();
      await page.goto(BASE + PAGE + '?' + QUERY, { waitUntil: 'commit' });
      let readyMs = null;
      try { await waitReady(page, 300000); readyMs = Date.now() - t0; } catch { readyMs = -1; }
      const nav = await page.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0] || {};
        const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || null;
        return { dcl: n.domContentLoadedEventEnd || null, load: n.loadEventEnd || null, fcp };
      }).catch(() => ({}));
      const networkSnapshot = () => {
        const reqs = [...log.requests], bytes = reqs.reduce((sum, r) => sum + r.bytes, 0), byType = {};
        for (const r of reqs) { byType[r.type] = byType[r.type] || { n: 0, bytes: 0 }; byType[r.type].n++; byType[r.type].bytes += r.bytes; }
        const heavy = [...reqs].sort((a, b) => b.bytes - a.bytes).slice(0, 8).map(r => ({ f: r.url.split('/').slice(-2).join('/').slice(0, 70), kb: Math.round(r.bytes / 1024) }));
        return { requests: reqs.length, kb: Math.round(bytes / 1024), byType, heavy };
      };
      const hero = networkSnapshot();
      let chapterReadyMs = readyMs;
      if (readyMs > 0) {
        try { await page.evaluate(() => window.__MONTIS_STUDY__.ready); chapterReadyMs = Date.now() - t0; }
        catch { chapterReadyMs = -1; }
      }
      const chapter = networkSnapshot();
      trials.push({ readyMs, heroReadyMs: readyMs, chapterReadyMs, nav, ...hero, chapter,
        errors: log.errors.length, pageErrors: log.pageErrors, failed: log.failed });
      console.log('boot trial:', JSON.stringify({ trial: i + 1, heroReadyMs: readyMs, chapterReadyMs, heroKB: hero.kb, chapterKB: chapter.kb }));
    } catch (error) {
      trials.push({ readyMs: -1, heroReadyMs: -1, chapterReadyMs: -1, failure: String(error.stack || error) });
      console.warn('boot trial failed:', i + 1, error.message);
    } finally {
      checkpoint(snapshot());
      await closeBrowser(browser, browserPid);
    }
  }
  return snapshot();
}

// Preserve measurements even if Chrome's temporary-profile cleanup stalls on Windows.
// The PID comes from this browser's CDP session, so a timeout never targets other Chrome sessions.
async function closeBrowser(browser, browserPid) {
  let timer;
  const closed = browser.close().then(() => true, error => {
    console.warn('Chrome close failed:', error.message);
    return false;
  });
  const done = await Promise.race([closed, new Promise(resolve => {
    timer = setTimeout(() => resolve(false), 10000);
  })]);
  clearTimeout(timer);
  if (!done && browserPid) {
    console.warn('Chrome cleanup timed out; closing only benchmark browser PID', browserPid);
    try { process.kill(browserPid); } catch (error) {
      if (error.code !== 'ESRCH') console.warn('Benchmark browser cleanup:', error.message);
    }
  }
}

(async () => {
  let browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: LAUNCH_ARGS });
  let browserPid = null;
  try {
    const session = await browser.newBrowserCDPSession();
    const { processInfo } = await session.send('SystemInfo.getProcessInfo');
    browserPid = processInfo.find(info => info.type === 'browser')?.id || null;
    await session.detach();
  } catch (error) { console.warn('Benchmark browser PID unavailable:', error.message); }
  const out = { label: LABEL, profile: PROFILE, base: BASE, frames: FRAMES, settle: SETTLE, when: new Date().toISOString(), scenarios: {} };
  try {
    if (BOOT) {
      out.boot = await runBoot(browser, partial => {
        out.boot = partial;
        fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
      });
      console.log('boot:', JSON.stringify({ throttle: THROTTLE, readyMs: out.boot.readyMs, kb: out.boot.trials.map(t => t.kb), reqs: out.boot.trials.map(t => t.requests) }));
    }
    if (!argv.noscen) {
      if (BOOT) {
        browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: LAUNCH_ARGS });
        browserPid = await benchmarkBrowserPid(browser);
      }
      const { context, page, log } = await newSession(browser, PROFILE);
      const t0 = Date.now();
      await page.goto(`${BASE}${PAGE}?${QUERY}`, { waitUntil: 'commit' });
      await waitReady(page);
      out.readyMs = Date.now() - t0;
      // Wait for background chapters before deterministic A/B stepping; older baselines return undefined.
      await page.evaluate(() => window.__MONTIS_STUDY__.ready);
      out.chapterReadyMs = Date.now() - t0;
      await page.evaluate(() => { window.__rafFrozen = true; });
      await page.evaluate(PAGE_API);
      out.gpu = await page.evaluate(() => { const gl = window.__MONTIS_STUDY__.renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
      out.pixelRatio = await page.evaluate(() => window.__MONTIS_STUDY__.renderer.getPixelRatio());
      out.memAfterBoot = await page.evaluate(() => window.__perf.memory());
      // --exp "<js>": apply a what-if tweak at runtime (nothing is written to disk), then let it settle
      if (argv.exp) { await page.evaluate(String(argv.exp)); await page.evaluate(() => window.__MONTIS_STUDY__.step(40, 1 / 60)); }
      if (PNG_DIR) fs.mkdirSync(PNG_DIR, { recursive: true });
      for (const name of SCEN) {
        if (argv['only-passes']) break;
        process.stdout.write(`[${LABEL}/${PROFILE}] ${name} ... `);
        const r = await page.evaluate(([n, f, s, png]) => window.__perf.scenario(n, f, s, png), [name, FRAMES, SETTLE, !!PNG_DIR]);
        if (PNG_DIR && r.png) { fs.writeFileSync(path.join(PNG_DIR, `${LABEL}-${PROFILE}-${name}.png`), Buffer.from(r.png.split(',')[1], 'base64')); }
        delete r.png;
        r.cpuStat = summarize(r.cpu); r.wallStat = summarize(r.wall); r.gpuStat = r.gpu.length ? summarize(r.gpu) : null;
        r.allocKBPerFrame = r2(r.alloc / FRAMES / 1024);
        delete r.cpu; delete r.wall; delete r.gpu;
        if (RAF_FRAMES) {
          const rp = await page.evaluate(([n, f]) => window.__perf.rafPass(n, f), [name, RAF_FRAMES]);
          r.raf = { interval: summarize(rp.interval), cpu: summarize(rp.cpu), fpsMedian: r2(1000 / median(rp.interval)), dropped: rp.interval.filter(x => x > 25).length };
        }
        out.scenarios[name] = r;
        console.log(`calls=${r.counts.calls} tris=${r.counts.triangles} cpu=${r.cpuStat.median}ms drain=${r.wallStat.median}ms gpu=${r.gpuStat ? r.gpuStat.median + '(n=' + r.gpuStat.n + ')' : 'n/a'}ms alloc=${r.allocKBPerFrame}KB/f gc=${r.gcs}`);
      }
      // Keep screenshots and CSS settling outside all timed scenarios so GPU idle clocks
      // cannot bias the following scenario's timer-query sample.
      if (PNG_DIR && argv['ui-png']) {
        for (const name of SCEN.filter(n => n === 'logo' || n === 'finale')) {
          await page.evaluate(n => { window.__perf.jump(n); window.__MONTIS_STUDY__.step(90, 1 / 60); }, name);
          await page.waitForFunction(() => {
            const loader = document.querySelector('#loader'), ui = document.querySelector('.finnovation-ui');
            return (!loader || Number(getComputedStyle(loader).opacity) < .001)
              && ui && Number(getComputedStyle(ui).opacity) > .999;
          });
          await page.waitForTimeout(1700);
          await page.screenshot({ path: path.join(PNG_DIR, LABEL + '-' + PROFILE + '-' + name + '-ui.png'), fullPage: true });
        }
      }
      if (argv.passes) {
        out.passes = {};
        for (const name of SCEN) {
          try {
            const pp = await page.evaluate(([n, f, s]) => window.__perf.passProfile(n, f, s), [name, Number(argv.passes) > 1 ? Number(argv.passes) : 40, 90]);
            out.passes[name] = pp;
            console.log(`\n[passes ${LABEL}/${PROFILE}] ${name}  total≈${r2(pp.totalMs)}ms\n  enabled: ${pp.enabled.join(' | ')}\n` + pp.rows.map(x => `   ${String(r2(x.ms)).padStart(6)} ms  ${x.label}`).join('\n'));
          } catch (e) { console.log('passes failed for', name, String(e).slice(0, 200)); }
        }
      }
      if (SWEEP) { out.sweep = await page.evaluate(([names, s]) => window.__perf.sweep(names, s), [SCEN, 30]); console.log('sweep:', JSON.stringify(out.sweep)); }
      out.console = { errors: [...new Set(log.errors)].slice(0, 20), warnings: [...new Set(log.warnings)].slice(0, 20), pageErrors: log.pageErrors.slice(0, 10), failed: log.failed.slice(0, 10) };
      await context.close();
    }
  } finally {
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    console.log('wrote', OUT);
    await closeBrowser(browser, browserPid);
  }
  // No background work is required after the report is persisted and our browser is closed.
  process.exit(0);
})().catch(e => { console.error('HARNESS FAIL:', e && e.stack || e); process.exit(1); });
