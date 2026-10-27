// Dump the canyon centreline (arc-length samples) + river half-width for offline design. node dumpcurve.cjs out.json
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path');
(async () => {
  const out = process.argv[2] || '.qa/index1-5/camera/curve.json'; fs.mkdirSync(path.dirname(out), { recursive: true });
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.setDefaultTimeout(150000);
  await p.goto('http://127.0.0.1:5621/index1-5.html?tune=0', { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { polling: 250 });
  await p.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
  const r = await p.evaluate(() => { const c = window.__MONTIS_STUDY__.canyon, L = c.stats.pathLength, N = 4096, pts = [], w = [];
    for (let i = 0; i <= N; i++) { const t = i / N, q = c.curve.getPointAt(t); pts.push([+q.x.toFixed(3), +q.z.toFixed(3)]); w.push(+c.widthAt(t).toFixed(3)); }
    return { L, N, pts, w }; });
  fs.writeFileSync(out, JSON.stringify(r)); console.log('curve', r.L, r.N, '->', out);
  await Promise.race([b.close(), new Promise(r => setTimeout(r, 8000))]); process.exit(0);
})();
