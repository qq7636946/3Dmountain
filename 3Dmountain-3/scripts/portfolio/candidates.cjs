// A contact sheet of candidate card pictures, loaded the way the slider loads them (cross-origin, square crop).
//   node candidates.cjs out.jpg id1 id2 ...        (Pexels photo ids)
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const [out, ...ids] = process.argv.slice(2);
const url = id => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=640&h=640`;
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await (await browser.newContext({ viewport: { width: 1320, height: 900 } })).newPage();
  await page.setContent('<body style="margin:0;background:#222;font:600 13px system-ui;color:#fff"><div id="g" style="display:grid;grid-template-columns:repeat(6,220px);gap:0"></div></body>');
  const result = await page.evaluate(async list => {
    const g = document.getElementById('g'), rows = [];
    await Promise.all(list.map(([id, src]) => new Promise(done => {
      const cell = document.createElement('div'); cell.style.cssText = 'position:relative;width:220px;height:220px;overflow:hidden';
      const img = new Image(); img.crossOrigin = 'anonymous'; img.style.cssText = 'width:220px;height:220px;object-fit:cover;display:block';
      const tag = document.createElement('span'); tag.textContent = id; tag.style.cssText = 'position:absolute;left:4px;top:4px;background:rgba(0,0,0,.7);padding:2px 6px';
      cell.append(img, tag); g.append(cell);
      const t = setTimeout(() => { rows.push([id, 'timeout']); done(); }, 25000);
      img.onload = () => { clearTimeout(t); rows.push([id, img.naturalWidth + 'x' + img.naturalHeight]); done(); };
      img.onerror = () => { clearTimeout(t); tag.textContent = id + ' ✗'; rows.push([id, 'FAILED']); done(); };
      img.src = src;
    })));
    return rows;
  }, ids.map(id => [id, url(id)]));
  console.log(result.map(r => r.join(':')).join('  '));
  const g = await page.$('#g'); fs.writeFileSync(out, await g.screenshot({ type: 'jpeg', quality: 78 }));
  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 8000))]); process.exit(0);
})();
