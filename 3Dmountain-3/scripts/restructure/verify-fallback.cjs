// Fallback behaviour parity (the SEO/readability safety net): JS disabled, and "module failed to load".
//   node scripts/restructure/verify-fallback.cjs <baseUrlA> <baseUrlB> <manifest.json> [page=index.html]
// For each build: (1) JavaScript disabled -> <noscript> loads the readable stylesheet; (2) the 3D module graph fails (one import is aborted)
// -> the module <script> fires `error` -> showFinnovationText() switches to text mode and loads the readable stylesheet.
// Compares request sets (old path mapped through the manifest), the render mode, and full-page screenshots pixel by pixel.
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const [urlA, urlB, manifestPath, pageName = 'index.html'] = process.argv.slice(2);
const moves = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).moves;
const mapOld = p => { const q = p.replace(/^\//, ''); for (const m of moves) { if (q === m.from) return m.to; if (q.startsWith(m.from + '/')) return m.to + q.slice(m.from.length); } return q; };
let fails = 0; const line = (ok, s) => { console.log((ok ? '  OK   ' : '  FAIL ') + s); if (!ok) fails++; };

async function run(browser, base, mode) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, javaScriptEnabled: mode !== 'nojs' });
  const page = await ctx.newPage(); page.setDefaultTimeout(60000);
  const reqs = [];
  page.on('response', r => { if (r.url().startsWith(base)) reqs.push({ path: new URL(r.url()).pathname, status: r.status() }); });
  if (mode === 'modulefail') await page.route(u => /water-journey-scene-463\.js$/.test(u.pathname), r => r.abort());
  await page.goto(base + pageName + '?tune=0', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(mode === 'modulefail' ? 4000 : 2500);
  const info = mode === 'nojs' ? {} : await page.evaluate(() => ({ renderMode: document.documentElement.dataset.renderMode || '', booting: document.body.classList.contains('is-booting'), readableLink: !!document.getElementById('finnovation-readable') }));
  if (mode !== 'nojs') await page.addStyleTag({ content: '#gl{visibility:hidden!important}' }).catch(() => {});   // with JS disabled page.evaluate/addStyleTag would just wait
  const shot = (await page.screenshot({ animations: 'disabled', fullPage: true, caret: 'hide' })).toString('base64');
  const readable = reqs.filter(r => /readable\.css$/.test(r.path)).map(r => r.status);
  await ctx.close();
  return { reqs, info, shot, readable };
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const helper = await (await browser.newContext()).newPage(); await helper.setContent('<canvas></canvas>');
  const pixelDiff = (a, b) => helper.evaluate(async ([a, b]) => { const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; }); const [ia, ib] = await Promise.all([load(a), load(b)]); if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] }; const px = i => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; }; const A = px(ia), B = px(ib); let n = 0, max = 0; for (let i = 0; i < A.length; i += 4) { let m = 0; for (let c = 0; c < 3; c++) { const d = Math.abs(A[i + c] - B[i + c]); if (d > m) m = d; } if (m) n++; if (m > max) max = m; } return { w: ia.width, h: ia.height, differingPixels: n, maxDiff: max }; }, [a, b]);
  for (const mode of ['nojs', 'modulefail']) {
    console.log(`\n=== fallback: ${mode === 'nojs' ? 'JavaScript disabled' : 'module graph fails to load'} (${pageName}) ===`);
    const A = await run(browser, urlA, mode), B = await run(browser, urlB, mode);
    const sA = new Set(A.reqs.map(r => mapOld(r.path))), sB = new Set(B.reqs.map(r => r.path.replace(/^\//, '')));
    const missing = [...sA].filter(k => !sB.has(k));
    line(missing.length === 0, `every original request still happens at its new path (${sA.size} -> ${sB.size})${missing.length ? ' MISSING ' + missing.join(', ') : ''}`);
    line(A.readable.length > 0 && B.readable.length > 0 && B.readable.every(s => s === 200), `readable stylesheet loaded with 200: A=${JSON.stringify(A.readable)} B=${JSON.stringify(B.readable)}`);
    if (mode === 'modulefail') line(JSON.stringify(A.info) === JSON.stringify(B.info) && B.info.renderMode === 'text', `text mode engaged identically: A=${JSON.stringify(A.info)} B=${JSON.stringify(B.info)}`);
    const pd = await pixelDiff(A.shot, B.shot);
    line(pd.differingPixels === 0, `full-page screenshot pixel-identical ${JSON.stringify(pd)}`);
  }
  await browser.close();
  console.log(fails ? `\nFALLBACK: ${fails} check(s) FAILED` : '\nFALLBACK: all checks passed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
