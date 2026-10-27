// Real-wheel camera log for the canyon flight (index1-5). No screenshots: only a per-rAF log of the canyon camera, so the
// wheel cadence is exact. Run through the shared lock:
//   node scripts/index1-5/with-lock.cjs "node scripts/index1-5/probes/camera/wheellog.cjs --out .qa/index1-5/camera/before --query racing=0"
// options: --from 4.8  --notches 42  --interval 180  --dy 100  --reverse 0|1  --settle 1500  --query "racing=0"  --w --h
//          --js file.js (evaluated in the page before the run, e.g. to set CONFIG.canyonView.racing; applyConfig is called after)
// writes <out>-log.json: { meta, frames:[t,prog,x,y,z,dx,dy,dz,fov,rightY,target,phase], series:{...analysis...} }
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2), flag = (k, d) => args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d;
const OUT = flag('out', '.qa/index1-5/camera/run'), QUERY = flag('query', ''), BASE = flag('base', 'http://127.0.0.1:5621/index1-5.html');
const FROM = Number(flag('from', 4.8)), NOTCH = Number(flag('notches', 42)), IV = Number(flag('interval', 180)), DY = Number(flag('dy', 100));
const REV = flag('reverse', '0') === '1', SETTLE = Number(flag('settle', 1500)), W = Number(flag('w', 1440)), H = Number(flag('h', 900));
const js = flag('js', null) ? fs.readFileSync(flag('js'), 'utf8') : '';
const url = BASE + '?tune=0' + (QUERY ? '&' + QUERY.replace(/^&/, '') : '');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage(); p.setDefaultTimeout(150000);
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await p.goto(url, { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { polling: 250 });
  await p.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
  if (js) console.log('js ->', JSON.stringify(await p.evaluate(js)));
  await p.evaluate(f => { const s = window.__MONTIS_STUDY__; s.journey.target = Math.min(f, s.journey.max); }, FROM);
  await p.waitForFunction(f => { const s = window.__MONTIS_STUDY__; return Math.abs(s.journey.progress - Math.min(f, s.journey.max)) < .005; }, FROM, { polling: 100 });
  await p.waitForTimeout(SETTLE);
  await p.mouse.move(W / 2, H / 2);
  await p.evaluate(() => {
    const s = window.__MONTIS_STUDY__; window.__log = []; window.__phase = 0;
    const d = new (s.canyon.camera.position.constructor)();
    const U = s.canyonMotion.pass.uniforms.uShift.value, st = s.canyonMotion.state;
    const tick = t => { const c = s.canyon.camera; c.getWorldDirection(d); window.__log.push([Math.round(t * 100) / 100, s.journey.progress, c.position.x, c.position.y, c.position.z, d.x, d.y, d.z, c.fov, c.matrixWorld.elements[1], s.journey.target, window.__phase, +U.x.toFixed(4), +U.y.toFixed(4), +U.z.toFixed(4), +st.shift.toFixed(4), +st.envelope.toFixed(3)]); if (window.__log.length < 30000) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const t0 = Date.now(); let notch = 0, nextNotch = 0, phase = 'down';
  const total = NOTCH * IV + 2500, totalRev = REV ? NOTCH * IV + 2500 : 0;
  while (Date.now() - t0 < total + totalRev) {
    const el = Date.now() - t0;
    if (phase === 'down' && el >= total) { phase = 'up'; notch = 0; nextNotch = el; await p.evaluate(() => { window.__phase = 1; }); }
    if (notch < NOTCH && el >= nextNotch) { await p.mouse.wheel(0, phase === 'down' ? DY : -DY); notch++; nextNotch += IV; }
    await p.waitForTimeout(4);
  }
  const probe = await p.evaluate(() => {
    const s = window.__MONTIS_STUDY__, c = s.canyon;
    return { shift: s.journeyClock ? null : null, pathLength: c.stats.pathLength, racing: s.CONFIG.canyonView.racing ?? null, view: { ...s.CONFIG.canyonView }, max: s.journey.max };
  });
  // lateral offset per frame (in-page: needs the curve)
  const frames = await p.evaluate(() => window.__log);
  const off = await p.evaluate(() => {
    const s = window.__MONTIS_STUDY__, c = s.canyon, L = c.stats.pathLength, out = [];
    for (const f of window.__log) {
      const clock = s.journeyClock(f[1]); const route = Math.max(0, Math.min(1, (clock - 1.404) / 6.596)); let r = route; if (r > .9) { const u = (r - .9) / .1; r = .9 + .1 * (u + u * u - u * u * u); }
      const t = r * .865, pt = c.curve.getPointAt(t), tg = c.curve.getTangentAt(t), w = c.widthAt(t);
      const nx = -tg.z, nz = tg.x, lat = (f[2] - pt.x) * nx + (f[4] - pt.z) * nz;
      out.push([+t.toFixed(5), +lat.toFixed(3), +w.toFixed(3), +(tg.x).toFixed(4), +(tg.z).toFixed(4)]);
    }
    return out;
  });
  fs.writeFileSync(OUT + '-log.json', JSON.stringify({ meta: { url, from: FROM, notches: NOTCH, interval: IV, dy: DY, probe }, frames, off }));
  console.log('frames', frames.length, 'errors', JSON.stringify(errs.slice(0, 4)), '->', OUT + '-log.json');
  await Promise.race([b.close(), new Promise(r => setTimeout(r, 8000))]); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
