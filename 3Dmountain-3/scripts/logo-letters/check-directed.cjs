// Browser regression checks for the index1-1 rising-letter choreography.
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const BASE = 'http://127.0.0.1:5611/';
const assert = (value, message) => { if (!value) throw new Error(message); };

async function waitReady(page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.waitForFunction(() => window.__MONTIS_STUDY__ && document.body.classList.contains('is-ready'), null, { timeout: 45000 });
      return;
    } catch (error) { if (attempt === 3) throw error; }
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--disable-background-timer-throttling'] });
  const results = [];
  try {
    for (const profile of (process.argv.includes('--mobile-only') ? ['mobile'] : ['desktop', 'mobile', 'reduced'])) {
      const errors = [];
      const context = await browser.newContext({ viewport: profile === 'mobile' ? { width: 390, height: 844 } : { width: 1200, height: 800 },
        deviceScaleFactor: 1, isMobile: profile === 'mobile', hasTouch: profile === 'mobile', reducedMotion: profile === 'reduced' ? 'reduce' : 'no-preference', ignoreHTTPSErrors: true });
      await context.addInitScript(() => {
        const raw = requestAnimationFrame.bind(window);
        window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); });
      });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && /shader|program|webgl/i.test(m.text())) errors.push(m.text()); });
      await page.goto(BASE + 'index1-1.html?tune=0&letters=0', { waitUntil: 'commit', timeout: 45000 });
      await waitReady(page);
      await page.evaluate(() => { window.__warmCheck = false; window.__MONTIS_STUDY__.ready.then(() => { window.__warmCheck = true; }); });
      await page.waitForFunction(() => window.__warmCheck, null, { timeout: 45000 });
      await page.evaluate(() => {
        const s = window.__MONTIS_STUDY__;
        window.__rafFrozen = true;
        window.__directedCheck = { samples: 0, fades: 0, hidden: 0, maxBoundaryJump: 0, boundarySamples: 0, failures: [] };
        // Compile/draw through the production renderer first; numerical stepping
        // below suppresses GPU draws, not the actual scene/update machinery.
        s.step(1, 1 / 60);
        window.__realRender = s.renderer.render;
        s.renderer.render = () => {};
        window.__setChapter = t => {
          s.journey.progress = s.journey.target = s.CONFIG.logo.at * 2.6 + t * s.CONFIG.logo.length;
          s.journey.velocity = 0;
        };
        window.__sampleDirected = () => {
          const r = window.__directedCheck, letters = s.brandMark.letters.letters, drops = s.brandMark.drops.state.delivery;
          r.samples++;
          for (const letter of letters) {
            const d = drops[letter.index];
            if (!d?.stage) continue;
            if (![...letter.mesh.matrix.elements, ...d.position.toArray(), ...d.quaternion.toArray(), d.scale, d.alpha, d.snap].every(Number.isFinite)) r.failures.push('nonfinite pose');
            if (d.alpha > .001 && d.alpha < .999) {
              r.fades++;
              const materials = Array.isArray(letter.mesh.material) ? letter.mesh.material : [letter.mesh.material];
              if (materials.some(m => m.depthWrite)) r.failures.push('fade writes depth');
            }
            if (d.alpha <= .001) { r.hidden++; if (letter.mesh.visible) r.failures.push('alpha-zero visible'); }
          }
        };
      });
      const setup = await page.evaluate(() => ({ directed: window.__MONTIS_STUDY__.CONFIG.logoDrops.directedHelix, letters: window.__MONTIS_STUDY__.brandMark.letters.letters.length }));
      assert(setup.directed === 1 && setup.letters > 0, profile + ': directed letters not ready');
      // Start below the first gate, then cross it slowly and stop: this exposes
      // the old actual-pose -> approximate-pose seam at the end of breakTime.
      await page.evaluate(() => { __setChapter(-.1); __MONTIS_STUDY__.step(100, 1 / 60); });
      for (let batch = 0; batch < 6; batch++) await page.evaluate(batch => {
        const s = __MONTIS_STUDY__;
        for (let j = 0; j < 20; j++) { __setChapter(-.1 + .21 * (batch * 20 + j) / 119); s.step(1, 1 / 60); __sampleDirected(); }
      }, batch);
      await page.evaluate(() => {
        const s = __MONTIS_STUDY__, r = __directedCheck, first = s.brandMark.drops.state.delivery[0];
        const breakTime = s.CONFIG.logoDrops.breakTime * (matchMedia('(prefers-reduced-motion: reduce)').matches ? .5 : 1);
        const flyTime = s.CONFIG.logoDrops.flyTime * (matchMedia('(prefers-reduced-motion: reduce)').matches ? .5 : 1);
        const boundary = breakTime * .42 / flyTime;
        let previous = first.position.clone(), previousSnap = first.snap;
        for (let i = 0; i < 160; i++) {
          s.step(1, 1 / 60); __sampleDirected();
          if (first.snap >= boundary && previousSnap < boundary) { r.boundarySamples++; r.maxBoundaryJump = Math.max(r.maxBoundaryJump, first.position.distanceTo(previous)); }
          previous.copy(first.position); previousSnap = first.snap;
        }
      });
      // Full slow forward pass and settle, then continuous reverse.
      for (let batch = 0; batch < 12; batch++) {
        await page.evaluate(batch => {
        const s = __MONTIS_STUDY__;
        for (let j = 0; j < 20; j++) { __setChapter(.11 + .85 * (batch * 20 + j) / 239); s.step(1, 1 / 60); __sampleDirected(); }
        }, batch);
        if (profile === 'mobile' && batch === 5) {
          const data = await page.evaluate(() => {
            const s = __MONTIS_STUDY__; s.renderer.render = __realRender; s.step(1, 1 / 60);
            const png = s.renderer.domElement.toDataURL('image/png');
            s.renderer.render = () => {}; return png;
          });
          const output = path.resolve('.qa/letters-index1-1/mobile.png');
          fs.mkdirSync(path.dirname(output), { recursive: true });
          fs.writeFileSync(output, Buffer.from(data.split(',')[1], 'base64'));
          console.log(JSON.stringify({ screenshot: output, chapterT: .11 + .85 * 119 / 239 }));
        }
      }
      const assembled = await page.evaluate(() => {
        const s = __MONTIS_STUDY__; s.step(240, 1 / 60); __sampleDirected();
        return { fuse: s.brandMark.drops.state.fuse, snaps: s.brandMark.drops.state.delivery.slice(0, s.brandMark.letters.letters.length).map(d => d.snap), originalVisible: s.brandMark.mesh.visible };
      });
      assert(assembled.fuse > .999 && assembled.snaps.every(n => n === 1) && assembled.originalVisible, profile + ': incomplete assembly ' + JSON.stringify(assembled));
      for (let batch = 0; batch < 10; batch++) await page.evaluate(batch => {
        const s = __MONTIS_STUDY__;
        for (let j = 0; j < 20; j++) { __setChapter(.96 - 1.06 * (batch * 20 + j) / 199); s.step(1, 1 / 60); __sampleDirected(); }
      }, batch);
      const report = await page.evaluate(() => {
        const s = __MONTIS_STUDY__; s.step(160, 1 / 60); __sampleDirected();
        s.renderer.render = __realRender; s.step(1, 1 / 60);
        return { ...__directedCheck, reverseClear: s.brandMark.drops.state.delivery.slice(0, s.brandMark.letters.letters.length).every(d => d.stage === 0 && d.snap === 0) };
      });
      assert(report.failures.length === 0 && report.reverseClear, profile + ': ' + JSON.stringify(report));
      assert(report.fades > 0 && report.hidden > 0, profile + ': fade coverage missing');
      assert(report.maxBoundaryJump < .06, profile + ': break boundary jumped ' + report.maxBoundaryJump);
      assert(errors.length === 0, profile + ': runtime/shader errors ' + errors.join('; '));
      results.push({ profile, ...report, errors, assembled });
      console.log(JSON.stringify(results[results.length - 1]));
      await context.close();
    }
    // Non-target documents must not opt in. index2 has its own inline defaults;
    // index.html resolves the same main.js but without the per-document marker.
    const page = await browser.newPage();
    const isolation = await page.request.get(BASE + 'index.html').then(r => r.text());
    const reference = await page.request.get(BASE + 'index2.html').then(r => r.text());
    assert(!/data-letter-direction\s*=\s*["']rising-helix/.test(isolation), 'index.html opted in');
    assert(!/data-letter-direction\s*=\s*["']rising-helix/.test(reference), 'index2.html opted in');
    assert(/logoDrops:\s*\{\s*\.\.\.LOGO_DROP_DEFAULTS\s*\}/.test(reference), 'index2 no longer uses unmodified photo defaults');
    console.log(JSON.stringify({ isolation: 'PASS', checked: ['index.html document opt-in absent', 'index2.html document opt-in absent and photo defaults unchanged'] }));
    console.log('PASS directed letter regression checks');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
