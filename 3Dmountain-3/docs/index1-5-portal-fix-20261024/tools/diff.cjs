'use strict';
/* diff.cjs — region-by-region mean L* of two frames (and the difference), for the cut pair p4.73 vs p4.745.
   node docs/index1-5-portal-fix-20261024/tools/diff.cjs a.jpg b.jpg [cols=6] [rows=4] [--json out.json]
   Prints a grid of ΔL* (b − a), the largest |ΔL*| over the grid, the whole-frame ΔL* and the mean absolute pixel difference. */
const fs = require('node:fs');
const { chromium } = require(process.env.I15_PLAYWRIGHT || 'C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const args = process.argv.slice(2).filter(a => !a.startsWith('--json')), ji = process.argv.indexOf('--json');
const [fa, fb, colsS = '6', rowsS = '4'] = args;
if (!fa || !fb) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(2); }
(async () => {
  const src = f => { const b = fs.readFileSync(f); return `data:${b[0] === 0x89 ? 'image/png' : 'image/jpeg'};base64,${b.toString('base64')}`; };
  const browser = await chromium.launch({ headless: true, executablePath: process.env.I15_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await (await browser.newContext()).newPage();
  const res = await page.evaluate(async ({ a, b, cols, rows }) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const [A, B] = await Promise.all([load(a), load(b)]);
    const get = im => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    const da = get(A), db = get(B), w = da.width, h = da.height;
    const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    const Ls = d => { const o = new Float32Array(w * h); for (let i = 0, j = 0; i < d.length; i += 4, j++) { const Y = .2126 * lin(d[i]) + .7152 * lin(d[i + 1]) + .0722 * lin(d[i + 2]); o[j] = Y > .008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; } return o; };
    const la = Ls(da.data), lb = Ls(db.data);
    const grid = []; let all = 0, abs = 0;
    for (let r = 0; r < rows; r++) { const row = []; for (let c = 0; c < cols; c++) { let sa = 0, sb = 0, n = 0; for (let y = Math.floor(r * h / rows); y < Math.floor((r + 1) * h / rows); y++) for (let x = Math.floor(c * w / cols); x < Math.floor((c + 1) * w / cols); x++) { sa += la[y * w + x]; sb += lb[y * w + x]; n++; } row.push({ a: sa / n, b: sb / n, d: (sb - sa) / n }); } grid.push(row); }
    for (let i = 0; i < la.length; i++) { all += lb[i] - la[i]; abs += Math.abs(lb[i] - la[i]); }
    return { w, h, grid, whole: all / la.length, meanAbs: abs / la.length };
  }, { a: src(fa), b: src(fb), cols: +colsS, rows: +rowsS });
  const f = v => (v >= 0 ? ' ' : '') + v.toFixed(1);
  console.log(`${fa}\n  vs ${fb}\n  size ${res.w}x${res.h}`);
  res.grid.forEach(r => console.log('  ' + r.map(c => f(c.d).padStart(6)).join('')));
  const maxAbs = Math.max(...res.grid.flat().map(c => Math.abs(c.d)));
  console.log(`  whole ΔL* ${f(res.whole)}   max|ΔL*| over grid ${maxAbs.toFixed(1)}   mean|ΔL*| per pixel ${res.meanAbs.toFixed(2)}`);
  if (ji > 0) fs.writeFileSync(process.argv[ji + 1], JSON.stringify(res, null, 1));
  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 5000))]); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
