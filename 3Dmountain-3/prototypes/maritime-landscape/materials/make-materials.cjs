#!/usr/bin/env node
/* Render the Maritime PBR material sets headlessly on the GPU and write them to disk.

   node prototypes/maritime-landscape/materials/make-materials.cjs [options]
     --size 1024             master size (rendered at 2x, averaged down)
     --only a,b              material ids (default: all)
     --out <dir>             default images/maritime/materials
     --previews              also render previews (preview.html) and the contact sheet
     --previews-only         previews and sheet from the files already on disk
     --sheet <file>          contact sheet path (default docs/maritime-landscape/materials-<date>.jpg)

   Needs Playwright and a local Chrome: PLAYWRIGHT=<path to playwright> CHROME=<chrome.exe>.
   Files are served to the page from the project folder through a request route, so no server
   is needed; three.js comes from the CDN like the site itself. */
const fs = require('fs');
const path = require('path');
const PW = process.env.PLAYWRIGHT || 'C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { chromium } = require(PW);

const HERE = __dirname;
const PROJECT = path.resolve(HERE, '../../..');
const ORIGIN = 'http://maritime.local';
const rel = p => path.relative(PROJECT, p).split(path.sep).join('/');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const flag = k => args.includes('--' + k);
const size = +opt('size', 1024);
const outDir = path.resolve(PROJECT, opt('out', 'images/maritime/materials'));
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const sheetPath = path.resolve(PROJECT, opt('sheet', `docs/maritime-landscape/materials-${today}.jpg`));

const writeDataUrl = (file, url) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); };

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await ctx.route(ORIGIN + '/**', route => {
    const f = path.join(PROJECT, decodeURIComponent(new URL(route.request().url()).pathname));
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ path: f });
    return route.fulfill({ status: 404, body: 'not found: ' + f });
  });
  const logs = [];
  const watch = page => {
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  };
  const page = await ctx.newPage(); watch(page); page.setDefaultTimeout(240000);
  await page.goto(ORIGIN + '/' + rel(path.join(HERE, 'generator.html')));
  await page.waitForFunction(() => window.__generatorReady === true);
  const all = await page.evaluate(() => window.MATERIALS);
  const only = opt('only', '') ? opt('only', '').split(',') : Object.keys(all);
  const report = {};

  if (!flag('previews-only')) {
    for (const name of only) {
      const r = await page.evaluate(([n, s]) => window.generateMaterial(n, s), [name, size]);
      const dir = path.join(outDir, name);
      for (const [map, url] of Object.entries(r.maps)) writeDataUrl(path.join(dir, `${name}_${map}.png`), url);
      /* Web copies: WebP at 1024 and 512 (normal and data maps at high quality). */
      const web = await page.evaluate(async ({ maps, size }) => {
        const res = {};
        for (const [map, url] of Object.entries(maps)) {
          const img = new Image(); img.src = url; await img.decode();
          for (const s of [Math.min(1024, size), 512]) {
            const c = document.createElement('canvas'); c.width = c.height = s;
            const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, s, s);
            res[`${map}-${s}`] = c.toDataURL('image/webp', map === 'basecolor' ? .9 : .95);
          }
        }
        return res;
      }, { maps: r.maps, size });
      for (const [key, url] of Object.entries(web)) writeDataUrl(path.join(dir, 'web', `${name}_${key}.webp`), url);
      fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(r.meta, null, 2));
      report[name] = r.meta;
      console.log(`${name}: ${r.meta.ms} ms, height ${(r.meta.heightMeters.range * 100).toFixed(1)} cm${r.meta.jacobian ? ', J p1 ' + r.meta.jacobian.p1.toFixed(3) + ' p10 ' + r.meta.jacobian.p10.toFixed(3) : ''}`);
    }
  }

  if (flag('previews') || flag('previews-only')) {
    const shots = path.join(path.dirname(sheetPath), 'materials');
    fs.mkdirSync(shots, { recursive: true });
    const pv = await ctx.newPage(); watch(pv); pv.setDefaultTimeout(240000);
    const preview = rel(path.join(HERE, 'preview.html'));
    const shoot = async (query, file, w = 1600, h = 900) => {
      await pv.setViewportSize({ width: w, height: h });
      await pv.goto(`${ORIGIN}/${preview}?${query}`);
      await pv.waitForFunction(() => window.__previewReady === true, null, { timeout: 240000 });
      await pv.waitForTimeout(200);
      await pv.screenshot({ path: file, type: 'jpeg', quality: 90 });
      return file;
    };
    const renders = {};
    for (const name of Object.keys(all)) renders[name] = await shoot(`mat=${name}&root=${encodeURIComponent(rel(outDir))}`, path.join(shots, `${name}.jpg`));
    renders.coastClose = await shoot(`scene=coast&shot=close&root=${encodeURIComponent(rel(outDir))}`, path.join(shots, 'coast-close.jpg'));
    renders.coastWide = await shoot(`scene=coast&shot=wide&root=${encodeURIComponent(rel(outDir))}`, path.join(shots, 'coast-wide.jpg'));

    /* Contact sheet. */
    const b64 = f => 'data:image/' + (f.endsWith('.png') ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(f).toString('base64');
    const rows = Object.entries(all).map(([name, m]) => {
      const dir = path.join(outDir, name);
      const meta = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
      const maps = m.maps.filter(k => !['roughness', 'ao'].includes(k));
      const first = path.join(dir, `${name}_${maps[0]}.png`);
      const tiles = maps.map(k => `<figure><img src="${b64(path.join(dir, `${name}_${k}.png`))}"><figcaption>${k}</figcaption></figure>`).join('');
      return `<section><h2>${m.label}<span>每張 ${m.tile} m × ${m.tile} m · ${meta.size}² · 高度 ${(meta.heightMeters.range * 100).toFixed(1)} cm</span></h2>
        <div class="maps">${tiles}<figure><div class="tile" style="background-image:url(${b64(first)})"></div><figcaption>2×2 無縫檢查</figcaption></figure></div>
        <img class="render" src="${b64(renders[name])}"></section>`;
    }).join('');
    const sheet = await ctx.newPage();
    await sheet.setViewportSize({ width: 1480, height: 1000 });
    await sheet.setContent(`<html><head><style>
      body{margin:0;background:#101316;color:#e3e7ea;font:13px/1.45 "Segoe UI","Noto Sans TC",sans-serif;padding:22px}
      h1{font-size:20px;font-weight:600;margin:0 0 4px} p.lead{margin:0 0 16px;color:#9aa4ad;max-width:1100px}
      .hero{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:22px} .hero img{width:100%;border-radius:4px;display:block}
      .hero figcaption,figcaption{color:#9aa4ad;font-size:12px;margin-top:3px}
      section{margin:0 0 26px} h2{font-size:15px;font-weight:600;margin:0 0 8px} h2 span{font-weight:400;color:#9aa4ad;margin-left:12px;font-size:12px}
      .maps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:8px} figure{margin:0}
      .maps img,.tile{width:100%;aspect-ratio:1;display:block;border-radius:3px;background-size:50% 50%;background-repeat:repeat}
      .render{width:100%;border-radius:4px;display:block}
    </style></head><body>
      <h1>Maritime 程序化 PBR 材質（${today}）</h1>
      <p class="lead">四組可無縫重複的材質，每組的 normal／AO／粗糙度／高度都由同一個真實高度場推導，不是由顏色亮度猜出來的。上：用這四組材質（三向投影）鋪在一座海岸島嶼上的測試場景。下：每組的貼圖、2×2 無縫檢查，以及球體與平面上的光照預覽。</p>
      <div class="hero"><figure><img src="${b64(renders.coastClose)}"><figcaption>近景：岩壁、草坡、礫石灘、海面與岸邊浪花</figcaption></figure>
      <figure><img src="${b64(renders.coastWide)}"><figcaption>遠景：同一場景，同一組材質</figcaption></figure></div>
      ${rows}</body></html>`);
    await sheet.waitForTimeout(400);
    fs.mkdirSync(path.dirname(sheetPath), { recursive: true });
    await sheet.screenshot({ path: sheetPath, type: 'jpeg', quality: 84, fullPage: true });
    console.log('sheet', rel(sheetPath));
  }
  fs.mkdirSync(outDir, { recursive: true });
  if (Object.keys(report).length) fs.writeFileSync(path.join(outDir, 'last-run.json'), JSON.stringify({ size, report, logs }, null, 2));
  if (logs.length) console.log('console:', logs.slice(0, 12).join('\n'));
  await browser.close();
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
