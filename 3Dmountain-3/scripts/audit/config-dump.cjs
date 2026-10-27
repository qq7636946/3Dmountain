// Dump the live CONFIG of both pages and list every setting that differs (colours as hex).   node config-dump.cjs <base> <out.json>
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const [base = 'http://127.0.0.1:5641/', out = 'config-diff.json'] = process.argv.slice(2);
const PAGES = { bk: '_archive/backups/1010_bk/index.html?tune=0', now: 'index1-1.html?tune=0&letters=0' };
const shut = t => Promise.race([t.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const dumps = {};
  for (const [tag, url] of Object.entries(PAGES)) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await context.newPage(); page.setDefaultTimeout(150000);
    await page.goto(base + url, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.CONFIG && document.body.classList.contains('is-ready'), null, { timeout: 150000, polling: 250 });
    dumps[tag] = await page.evaluate(() => {
      const flat = {}, seen = new Set();
      const walk = (o, prefix, depth) => {
        if (o === null || typeof o !== 'object' || seen.has(o) || depth > 4) return; seen.add(o);
        if (o.isColor) { flat[prefix] = '#' + o.getHexString(); return; }
        if (o.isVector2 || o.isVector3) { flat[prefix] = [o.x, o.y, o.z].filter(v => v !== undefined).map(v => +v.toFixed(4)).join(','); return; }
        for (const [k, v] of Object.entries(o)) {
          const key = prefix ? prefix + '.' + k : k;
          if (typeof v === 'number') flat[key] = +v.toFixed(5); else if (typeof v === 'string' || typeof v === 'boolean') flat[key] = v;
          else if (Array.isArray(v)) { if (v.length <= 12 && v.every(x => typeof x !== 'object')) flat[key] = v.join(','); }
          else walk(v, key, depth + 1);
        }
      };
      walk(window.__MONTIS_STUDY__.CONFIG, '', 0);
      return flat;
    });
    await shut(context);
  }
  const keys = [...new Set([...Object.keys(dumps.bk), ...Object.keys(dumps.now)])].sort();
  const diff = keys.filter(k => String(dumps.bk[k]) !== String(dumps.now[k])).map(k => ({ key: k, bk: dumps.bk[k], now: dumps.now[k] }));
  fs.writeFileSync(out, JSON.stringify({ diff, bk: dumps.bk, now: dumps.now }, null, 1));
  const groups = {}; for (const d of diff) { const g = d.key.split('.')[0]; (groups[g] ??= []).push(d); }
  for (const [g, list] of Object.entries(groups)) console.log(g.padEnd(22), list.length + ' differ', list.filter(d => d.bk !== undefined && d.now !== undefined).slice(0, 8).map(d => d.key.slice(g.length + 1) + ' ' + d.bk + '→' + d.now).join(' | ').slice(0, 330),
    list.some(d => d.bk === undefined) ? ' [+' + list.filter(d => d.bk === undefined).length + ' new]' : '', list.some(d => d.now === undefined) ? ' [-' + list.filter(d => d.now === undefined).length + ' gone]' : '');
  await shut(browser); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
