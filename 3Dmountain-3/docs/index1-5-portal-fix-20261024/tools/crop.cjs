'use strict';
/* crop.cjs — pixel-exact crops (nearest-neighbour zoom) laid out as one labelled sheet. No page, no GPU: a blank headless tab.
   node docs/index1-5-portal-fix-20261024/tools/crop.cjs <out.jpg> <cols> <zoom> "label|file|x,y,w,h" ["label|file|x,y,w,h" …]
   x,y,w,h are in the source image's own pixels (a 2x phone shot has twice the CSS numbers). */
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.I15_PLAYWRIGHT || 'C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [out, colsS, zoomS, ...specs] = process.argv.slice(2);
if (!out || !specs.length) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(2); }
(async () => {
  const cells = specs.map(s => { const [label, file, box] = s.split('|'); const [x, y, w, h] = box.split(',').map(Number); const buf = fs.readFileSync(file); const mime = buf[0] === 0x89 ? 'image/png' : 'image/jpeg'; return { label, x, y, w, h, src: `data:${mime};base64,${buf.toString('base64')}` }; });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.I15_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await (await browser.newContext()).newPage();
  const url = await page.evaluate(async ({ cells, cols, zoom }) => {
    const ims = await Promise.all(cells.map(c => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = c.src; })));
    const gap = 4, head = 22, cw = Math.max(...cells.map(c => c.w)) * zoom, ch = Math.max(...cells.map(c => c.h)) * zoom + head;
    const C = Math.min(cols, cells.length), R = Math.ceil(cells.length / C);
    const cv = document.createElement('canvas'); cv.width = C * cw + (C - 1) * gap; cv.height = R * ch + (R - 1) * gap;
    const x = cv.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, cv.width, cv.height); x.imageSmoothingEnabled = false;
    cells.forEach((c, i) => { const cx = (i % C) * (cw + gap), cy = Math.floor(i / C) * (ch + gap); x.drawImage(ims[i], c.x, c.y, c.w, c.h, cx, cy + head, c.w * zoom, c.h * zoom); x.fillStyle = '#e8e8e8'; x.font = '600 14px sans-serif'; x.fillText(c.label, cx + 4, cy + 15); });
    return cv.toDataURL('image/jpeg', .9);
  }, { cells, cols: +colsS, zoom: +zoomS });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log(path.resolve(out));
  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 5000))]); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
