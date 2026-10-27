// Camera pose at given journey positions (deterministic: progress is set directly and the page is stepped).
//   node pose.cjs --base http://127.0.0.1:5621/index1-5.html --query "racing=0" --at "4.7,4.8,5.014,..." --out file.json [--reduced]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2), flag = (k, d) => args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d;
const BASE = flag('base', 'http://127.0.0.1:5621/index1-5.html'), QUERY = flag('query', ''), OUT = flag('out', null), REDUCED = args.includes('--reduced');
const AT = flag('at', '4.7,4.736,4.8,5.014,5.854,7.594,7.694,9.744,9.794').split(',').map(Number);
const url = BASE + '?tune=0' + (QUERY ? '&' + QUERY.replace(/^&/, '') : '');
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: REDUCED ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage(); p.setDefaultTimeout(150000);
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto(url, { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { polling: 250 });
  await p.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
  const res = await p.evaluate(async (AT) => {
    const s = window.__MONTIS_STUDY__, J = s.journey, c = s.canyon.camera, out = {}; const d = new c.position.constructor();
    for (const pp of AT) {
      s.skipEntry?.(); J.velocity = 0; J.progress = J.target = pp;
      for (let i = 0; i < 4; i++) { s.step(1, 1 / 60); }
      c.getWorldDirection(d);
      out[pp] = { pos: [c.position.x, c.position.y, c.position.z], dir: [d.x, d.y, d.z], up: [c.up.x, c.up.y, c.up.z], fov: c.fov, rightY: c.matrixWorld.elements[1], progress: J.progress };
    }
    return { out, view: { ...s.CONFIG.canyonView }, lat: s.CONFIG.canyonMotion.lateralBlur ?? null };
  }, AT);
  if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(res)); }
  console.log(JSON.stringify({ view: res.view, lat: res.lat, errors: errs.slice(0, 3) }));
  await Promise.race([b.close(), new Promise(r => setTimeout(r, 8000))]); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
