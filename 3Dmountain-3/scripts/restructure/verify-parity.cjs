// Runtime parity of two builds of the same page (e.g. the project before and after the restructure).
//   node scripts/restructure/verify-parity.cjs <baseUrlA> <baseUrlB> <manifest.json> [--pages index.html,index2.html] [--profiles desktop,phone]
// In a real GPU Chrome it compares:
//   (1) every request, old path mapped through the manifest -- including the lazy ones triggered by scrolling through all chapters,
//       opening section two and the ?logo=2 / ?logo=3 / ?orb=mesh variants,
//   (2) console errors/warnings and page errors,
//   (3) the DOM (tags, attributes except style, text) -- the only allowed differences are the two edits made on purpose,
//   (4) the computed style of EVERY element (all standard properties; animations cancelled; per-frame --custom-properties ignored),
//   (5) pixels of the DOM layer (canvas hidden, CSS animations disabled) at rest and with the menu open.
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const argv = process.argv.slice(2); const pos = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const [urlA, urlB, manifestPath] = pos;
const PAGES = opt('pages', 'index.html,index2.html').split(','), PROFILES = opt('profiles', 'desktop,phone').split(',');
const moves = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).moves;
const mapOld = p => { const q = p.replace(/^\//, '').replace(/^\.\//, ''); for (const m of moves) { if (q === m.from) return m.to; if (q.startsWith(m.from + '/')) return m.to + q.slice(m.from.length); } return q; };
const PROF = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };

const SNAP = () => {
  const els = [document.body, ...document.body.querySelectorAll('*')];
  const sig = els.map(e => { const attrs = [...e.attributes].filter(a => a.name !== 'style').map(a => a.name + '=' + a.value).sort().join('|'); const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').slice(0, 80); return e.tagName + '|' + attrs + '|' + own; });
  const inl = els.map(e => e.getAttribute('style') || '');
  document.getAnimations().forEach(a => { try { a.cancel(); } catch {} });
  const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  const comp = els.map(e => { const cs = getComputedStyle(e); let s = ''; for (const p of cs) { if (p.startsWith('--')) continue; s += p + ':' + cs.getPropertyValue(p) + ';'; } return fnv(s); });
  return { n: els.length, sig, inl, comp };
};
const DETAIL = idx => { const els = [document.body, ...document.body.querySelectorAll('*')]; return idx.map(i => { const cs = getComputedStyle(els[i]); const o = {}; for (const p of cs) { if (p.startsWith('--')) continue; o[p] = cs.getPropertyValue(p); } return { i, tag: els[i].tagName.toLowerCase(), cls: String(els[i].className && els[i].className.baseVal !== undefined ? els[i].className.baseVal : els[i].className).slice(0, 60), props: o }; }); };
const LAZY = async () => {   // scroll through every chapter with the real render loop, then open section two
  const S = window.__MONTIS_STUDY__; if (!S || !S.journey || !S.CONFIG) return 'study API missing';
  const wait = ms => new Promise(r => setTimeout(r, ms)); const C = S.CONFIG;
  const shift = Math.max(0, S.logoChapterEnd() - C.disperse.handoff * 2.6) + S.forwardLength() - .572;
  const stops = [.5, C.logo.at * 2.6 + C.logo.length * .44, S.logoChapterEnd() - .16, S.logoChapterEnd() + S.forwardLength() * .55, 4.6 + shift, 8.7 + shift, 10.98 + shift, S.journey.max];
  for (const p of stops) { S.journey.progress = S.journey.target = p; await wait(1300); }
  if (S.openSectionTwo) { S.openSectionTwo(); await wait(3000); if (S.closeSectionTwo) S.closeSectionTwo(true); }
  return 'ok';
};
// differences made ON PURPOSE by the restructure: the <source> path, and the module <script> (inline text -> src)
const normSig = s => { if (s.startsWith('SOURCE|')) return s.replace(/src=([^|]*)/, (m, v) => 'src=' + mapOld(v)); if (s.startsWith('SCRIPT|') && s.includes('id=journeyModule')) return s.split('|').filter(x => !x.startsWith('src=')).slice(0, 3).join('|'); return s; };

async function capture(browser, base, pageName, profile, query, full) {
  const ctx = await browser.newContext({ ...PROF[profile] });
  const page = await ctx.newPage(); page.setDefaultTimeout(180000);
  const reqs = [], cons = [], errs = [];
  page.on('response', r => { const u = new URL(r.url()); reqs.push({ path: u.pathname, status: r.status(), local: r.url().startsWith(base), host: u.host }); });
  page.on('requestfailed', r => { const u = new URL(r.url()); reqs.push({ path: u.pathname, status: 'FAILED', local: r.url().startsWith(base), host: u.host }); });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') cons.push(m.type() + ': ' + m.text().replace(/https?:\/\/[^\s)'"]+/g, '<url>').slice(0, 160)); });
  page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(base + pageName + '?tune=0' + query, { waitUntil: 'load' });
  let ready = true;
  try { await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 120000, polling: 250 }); } catch { ready = false; }
  await page.waitForTimeout(4500);
  const out = { ready, reqs, cons, errs, states: {}, page, ctx };
  if (full) {
    const grab = async name => { const snap = await page.evaluate(SNAP); await page.addStyleTag({ content: '#gl{visibility:hidden!important}' }).catch(() => {}); const png = await page.screenshot({ animations: 'disabled', caret: 'hide' }); out.states[name] = { snap, png: png.toString('base64') }; };
    await grab('rest');
    const toggle = page.locator('.fi-menu-toggle').first();
    if (await toggle.count()) { try { await toggle.click({ timeout: 5000 }); await page.waitForTimeout(1500); await grab('menu-open'); await page.keyboard.press('Escape'); await page.waitForTimeout(500); } catch (e) { out.menuError = String(e).slice(0, 100); } }
  }
  out.lazy = await page.evaluate(LAZY).catch(e => 'lazy error: ' + String(e).slice(0, 80));
  return out;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const helper = await (await browser.newContext()).newPage(); await helper.setContent('<canvas></canvas>');
  const pixelDiff = (a, b) => helper.evaluate(async ([a, b]) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(a), load(b)]); if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
    const px = i => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
    const A = px(ia), B = px(ib); let n = 0, max = 0, sum = 0; for (let i = 0; i < A.length; i += 4) { let m = 0; for (let c = 0; c < 3; c++) { const d = Math.abs(A[i + c] - B[i + c]); sum += d; if (d > m) m = d; } if (m > 0) n++; if (m > max) max = m; }
    return { w: ia.width, h: ia.height, differingPixels: n, maxDiff: max };
  }, [a, b]);
  let failures = 0, checks = 0;
  const line = (ok, s) => { checks++; console.log((ok ? '  OK   ' : '  FAIL ') + s); if (!ok) failures++; };
  for (const pageName of PAGES) for (const profile of PROFILES) {
    const variants = opt('variants') ? opt('variants').split(',').map(v => v === 'default' ? '' : v) : (pageName === 'index.html' && profile === 'desktop') ? ['', '&logo=2', '&logo=3', '&orb=mesh'] : [''];
    for (const query of variants) {
      const full = query === '';
      console.log(`\n=== ${pageName}${query ? '?' + query.slice(1) : ''} @ ${profile} ===`);
      const A = await capture(browser, urlA, pageName, profile, query, full), B = await capture(browser, urlB, pageName, profile, query, full);
      line(A.ready && B.ready, `reached is-ready: A=${A.ready} B=${B.ready}   scroll-through: A=${A.lazy} B=${B.lazy}`);
      const mapA = new Map(A.reqs.filter(r => r.local).map(r => [mapOld(r.path), r.status])), mapB = new Map(B.reqs.filter(r => r.local).map(r => [r.path.replace(/^\//, ''), r.status]));
      const missing = [...mapA.keys()].filter(k => !mapB.has(k)), extra = [...mapB.keys()].filter(k => !mapA.has(k));
      line(missing.length === 0, `requests (incl. lazy): all ${mapA.size} original requests happen again at their new paths (B makes ${mapB.size})${missing.length ? '  MISSING: ' + missing.join(', ') : ''}`);
      if (extra.length) console.log('       new-only requests: ' + extra.join(', '));
      const bad = r => r.status === 'FAILED' || r.status >= 400; const badA = A.reqs.filter(bad), badB = B.reqs.filter(bad);
      line(badB.length <= badA.length, `failed requests: A=${badA.length} B=${badB.length}${badB.length ? '  ' + badB.map(r => r.status + ' ' + r.path).slice(0, 4).join(', ') : ''}`);
      // Google Fonts serves Noto Sans TC as many unicode-range slices, fetched lazily as text is painted: their count varies run to run, so they are informational
      const ext = R => new Set(R.filter(r => !r.local && r.host !== 'fonts.gstatic.com').map(r => r.host + r.path)), cA = ext(A.reqs), cB = ext(B.reqs);
      const fA = A.reqs.filter(r => r.host === 'fonts.gstatic.com').length, fB = B.reqs.filter(r => r.host === 'fonts.gstatic.com').length;
      line([...cA].every(k => cB.has(k)) && [...cB].every(k => cA.has(k)), `external requests (three.js, addons, font CSS): A=${cA.size} B=${cB.size}   (font slices, informational: A=${fA} B=${fB})`);
      const uniq = a => [...new Set(a)].sort().join('\n');
      line(uniq(A.cons) === uniq(B.cons) && A.errs.length === B.errs.length, `console warnings/errors identical: A=${A.cons.length}/${A.errs.length} B=${B.cons.length}/${B.errs.length}${uniq(A.cons) !== uniq(B.cons) ? '\n       A:' + uniq(A.cons).slice(0, 300) + '\n       B:' + uniq(B.cons).slice(0, 300) : ''}`);
      for (const st of Object.keys(A.states)) {
        if (!B.states[st]) { line(false, `state ${st} missing in B`); continue; }
        const a = A.states[st].snap, b = B.states[st].snap;
        const sd = []; for (let i = 0; i < Math.min(a.n, b.n); i++) if (normSig(a.sig[i]) !== normSig(b.sig[i])) sd.push(i);
        line(a.n === b.n && sd.length === 0, `[${st}] DOM identical on ${a.n} elements (tags, attributes, text; the 2 intentional edits are whitelisted)${sd.length ? ' -- ' + sd.length + ' differ' : ''}`);
        for (const i of sd.slice(0, 3)) console.log(`       #${i}\n         A: ${a.sig[i].slice(0, 200)}\n         B: ${b.sig[i].slice(0, 200)}`);
        const bd = []; for (let i = 0; i < Math.min(a.n, b.n); i++) if (a.comp[i] !== b.comp[i]) bd.push(i);
        line(bd.length === 0, `[${st}] computed style identical on all ${a.n} elements (${bd.length} differ)`);
        if (bd.length) { const [da, db] = [await A.page.evaluate(DETAIL, bd.slice(0, 6)), await B.page.evaluate(DETAIL, bd.slice(0, 6))]; for (let k = 0; k < da.length; k++) { const diffs = Object.keys(da[k].props).filter(p => da[k].props[p] !== db[k].props[p]).slice(0, 4).map(p => `${p}: ${da[k].props[p]} -> ${db[k].props[p]}`); console.log(`       #${da[k].i} <${da[k].tag} class="${da[k].cls}"> ${diffs.join(' | ')}`); } }
        const pd = await pixelDiff(A.states[st].png, B.states[st].png);
        line(pd.differingPixels === 0, `[${st}] screenshot of the DOM layer (canvas hidden) pixel-identical ${JSON.stringify(pd)}`);
      }
      await A.ctx.close(); await B.ctx.close();
    }
  }
  await browser.close();
  console.log(failures ? `\nPARITY: ${failures} of ${checks} checks FAILED` : `\nPARITY: all ${checks} checks passed`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(2); });
