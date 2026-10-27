'use strict';
/* QA · "does it come back to the top CLEANLY?" from the footer (and from the ocean), by every route that exists: Home key, Escape, header brand,
   rail 01, top-nav ABOUT, MENU > 01, BACK TO TOP, footer left links (Knowledge), EXPLORE in the footer, long wheel-up.
   After each route: wait until the journey is at p=0 and the world is closed, then 1 s / 4 s / 8 s later take a screenshot and compare it with a freshly loaded top
   (mean RGB difference + L*): a big difference after 8 s = the page did not restore (dim / world canvas still over the hero / logo mark left on screen).
   The lead's navigation-matrix probe covers "did it get there"; this one covers "does it look like the top".
   Run: node scripts/index1-5/probe.cjs --script scripts/index1-5/probes/qa/return-to-top.probe.cjs --out qa-return-top --timeout 1500 [--phone]
   Env QA_ROUTES="home,esc,brand,..." QA_FROM="footer,h:1" */
const Q = require('./_qa.cjs'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
module.exports = async ({ page, L, vp, log }) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-rtt-')); const dir = path.join(Q.ROOT, '.qa', 'index1-5', 'qa-interaction'); fs.mkdirSync(dir, { recursive: true });
  const css = () => page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { });
  const waitReady = async () => { await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 120000, polling: 250 }); await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; }); await css(); await page.mouse.move(vp.width / 2, vp.height / 2); };
  const reload = async () => { await page.reload({ waitUntil: 'commit' }); await waitReady(); };
  const routes = (process.env.QA_ROUTES || 'home,esc,brand,rail0,topnav0,menu0,backtotop,flink0,explore,wheelup').split(','); const froms = (process.env.QA_FROM || 'footer').split(',');
  await css(); await page.waitForTimeout(2500);
  const baseFile = path.join(tmp, 'base.jpg'); await L.capture(page, baseFile, 70);
  await L.fly(page, 'max'); await page.waitForTimeout(3500); const baseMaxFile = path.join(tmp, 'basemax.jpg'); await L.capture(page, baseMaxFile, 70); await L.fly(page, 0); await page.waitForTimeout(500);
  const worldNow = () => page.evaluate(() => { const r = document.querySelector('#fiWorld'), c = document.querySelector('.fiw-canvas'); const cs = getComputedStyle(r); return { rootClass: r.className.replace(/\s+/g, ' ').slice(0, 80), hiddenAttr: r.hidden, inert: r.inert, opacity: cs.opacity, visibility: cs.visibility, display: cs.display, canvasVisible: c.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }), canvasStyleVis: c.style.visibility, bodyClass: document.body.className.replace(/\s+/g, ' ').slice(0, 120) }; });
  const rows = []; let ws = null;
  for (const from of froms) {
    for (const route of routes) {
      await reload(); ws = (await L.enterWorld(page, vp)).state;
      await Q.goState(page, L, vp, from, ws);
      const s0 = await Q.study(page); const t0 = Date.now(); let click = null;
      const key = async k => { await page.keyboard.press(k); };
      switch (route) {
        case 'home': await key('Home'); break;
        case 'esc': await key('Escape'); break;
        case 'brand': click = await Q.tryClick(page, '.fi-brand'); break;
        case 'rail0': click = await Q.tryClick(page, '.fi-rail [data-chapter="0"]'); break;
        case 'topnav0': click = await Q.tryClick(page, '.fi-topnav [data-chapter="0"]'); break;
        case 'menu0': click = await Q.tryClick(page, '.fi-menu-toggle'); await page.waitForTimeout(500); if (click.ok) click = await Q.tryClick(page, '.fi-menu-links [data-chapter="0"]'); break;
        case 'backtotop': await L.jumpWorld(page, ws.maxY); await page.waitForTimeout(1200); click = await Q.tryClick(page, '.fiw-top'); break;
        case 'flink0': await L.jumpWorld(page, ws.maxY); await page.waitForTimeout(1200); click = await Q.tryClick(page, '.fiw-menu [data-chapter-link="0"]'); break;
        case 'explore': await L.jumpWorld(page, ws.maxY); await page.waitForTimeout(1200); click = await Q.tryClick(page, '.fi-explore'); break;
        case 'wheelup': for (let i = 0; i < 260; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(30); } break;
      }
      // wait for p=0 & world closed (max 25 s)
      let arrived = false; for (let i = 0; i < 125; i++) { const s = await Q.study(page); if ((route === 'esc' ? s.p > s.max - .1 : s.p < 0.02) && !(s.world && s.world.open) && !(s.cards && s.cards.open)) { arrived = true; break; } await page.waitForTimeout(200); }
      const tArr = Date.now() - t0; const shots = {};
      for (const [label, wait] of [['1s', 1000], ['4s', 3000], ['8s', 4000]]) { await page.waitForTimeout(wait); const f = path.join(tmp, `${from}-${route}-${label}.jpg`); await L.capture(page, f, 70); shots[label] = f; }
      const s1 = await Q.study(page), w = await worldNow();
      const stats = await L.imageStats(page.context(), [route === 'esc' ? baseMaxFile : baseFile, shots['1s'], shots['4s'], shots['8s']], 0);
      const row = { from, route, click: click ? (click.ok ? 'ok' : click.err) : '-', before: Q.short(s0), arrived, arrivedMs: tArr, after: Q.short(s1), L: stats.map(x => x.lstar), diffVsFreshTop: stats.map(x => x.diff), world: w };
      const dim = stats[3].diff != null && stats[3].diff > 22;   // water drop scenes move a lot between captures (drop wobble, sun), so only gross differences are flagged
      row.flag = !arrived ? 'DID NOT ARRIVE' : (w.canvasVisible && w.display !== 'none' && w.opacity !== '0' && w.visibility !== 'hidden') ? 'WORLD CANVAS STILL VISIBLE' : dim ? 'LOOKS DIFFERENT FROM A FRESH TOP (diff ' + stats[3].diff + ')' : '';
      rows.push(row);
      if (row.flag) { const keep = path.join(Q.EVID, `rtt-${from.replace(':', '')}-${route}-8s.jpg`); fs.mkdirSync(Q.EVID, { recursive: true }); fs.copyFileSync(shots['8s'], keep); }
      fs.writeFileSync(path.join(dir, 'return-to-top' + (vp.phone ? '-phone' : '') + '.json'), JSON.stringify({ rows }, null, 1));
    }
  }
  fs.copyFileSync(baseFile, path.join(Q.EVID, 'rtt-baseline-fresh-top.jpg'));
  return { ok: rows.every(r => !r.flag), flagged: rows.filter(r => r.flag).map(r => `${r.from}/${r.route}: ${r.flag}`), table: rows.map(r => `${r.from}/${r.route} arrived=${r.arrived}(${r.arrivedMs}ms) diff=${r.diffVsFreshTop.join('/')} L=${r.L.join('/')} canvasVisible=${r.world.canvasVisible}`) };
};
