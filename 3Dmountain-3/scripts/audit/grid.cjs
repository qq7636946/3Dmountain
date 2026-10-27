// Lay image files out in a labelled grid.   node grid.cjs <out.jpg> <cols> <cellWidth> file1[=label] file2[=label] ...
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path');
const [out, colsArg, cellArg, ...items] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await (await browser.newContext()).newPage();
  const cells = items.map(it => { const [file, label] = it.split('='); return { label: label ?? path.basename(file), data: 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64') }; });
  const sheet = await page.evaluate(async ({ cells, cols, cw }) => {
    const ims = await Promise.all(cells.map(c => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = c.data; })));
    const ch = Math.round(cw * ims[0].naturalHeight / ims[0].naturalWidth), c = document.createElement('canvas');
    c.width = cw * cols; c.height = ch * Math.ceil(ims.length / cols); const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    ims.forEach((im, i) => { const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch; x.drawImage(im, cx, cy, cw, ch);
      x.font = '600 14px system-ui'; x.fillStyle = 'rgba(0,0,0,.72)'; x.fillRect(cx + 5, cy + 5, x.measureText(cells[i].label).width + 12, 22); x.fillStyle = '#fff'; x.fillText(cells[i].label, cx + 11, cy + 21); });
    return c.toDataURL('image/jpeg', .86);
  }, { cells, cols: Number(colsArg), cw: Number(cellArg) });
  fs.writeFileSync(out, Buffer.from(sheet.split(',')[1], 'base64'));
  console.log('grid', out); await Promise.race([browser.close(), new Promise(r => setTimeout(r, 8000))]); process.exit(0);
})();
