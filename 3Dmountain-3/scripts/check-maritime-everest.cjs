/* Functional regression for the Maritime art-direction pass.
   node scripts/check-maritime-everest.cjs [http://127.0.0.1:5613/index1-3-maritime.html]
   Uses real browser input. Three contexts run sequentially to avoid GPU contention.
   Mobile is browser emulation, not a physical-device performance measurement. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const url = process.argv[2] || 'http://127.0.0.1:5613/index1-3-maritime.html';
const out = path.resolve('.qa/maritime-everest');
const modes = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'reduced', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }
];
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const reports = [];
  try {
    for (const { name, ...options } of modes) {
      const context = await browser.newContext({ ...options, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const report = { mode: name, checks: [], errors: [], resources: [] };
      reports.push(report);
      page.on('pageerror', error => report.errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
      page.on('response', response => { if (response.status() >= 400) report.resources.push(`${response.status()} ${response.url()}`); });
      page.on('requestfailed', request => report.resources.push(`${request.failure()?.errorText} ${request.url()}`));
      const check = (condition, text) => { assert.ok(condition, `${name}: ${text}`); report.checks.push(text); };
      const blur = () => page.evaluate(() => document.activeElement?.blur());
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 60000 });
        await page.waitForFunction(() => +getComputedStyle(document.querySelector('#loader')).opacity < .01);
        check(await page.evaluate(() => document.documentElement.dataset.renderMode === 'webgl'), 'loader resolves to the interactive scene');
        check(await page.evaluate(() => !document.querySelector('.letters-panel:not([hidden])') && document.documentElement.dataset.tuning !== 'true'), 'plain URL opens with workshops hidden');
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal page overflow');
        if (name === 'reduced') {
          check(await page.evaluate(() => { const s = window.__MONTIS_STUDY__; return matchMedia('(prefers-reduced-motion: reduce)').matches && !s.entry.running && s.entry.done; }), 'reduced motion bypasses the entry choreography');
        }
        await page.locator('.fi-menu-toggle').click();
        await page.waitForFunction(() => document.querySelector('#fi-menu').open);
        check(await page.evaluate(() => document.querySelector('#fi-menu').contains(document.activeElement)), 'opening menu moves keyboard focus into the dialog');
        const target = await page.evaluate(() => window.__MONTIS_STUDY__.journey.target);
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(120);
        check(await page.evaluate(value => window.__MONTIS_STUDY__.journey.target === value, target), 'scrolling the menu does not move the journey');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#fi-menu').open);
        check(await page.evaluate(() => document.activeElement === document.querySelector('.fi-menu-toggle')), 'Escape restores focus to the menu trigger');
        await blur();
        await page.keyboard.press('l');
        await page.locator('.letters-panel:not([hidden])').waitFor({ state: 'visible' });
        await blur(); await page.keyboard.press('l');
        await page.waitForFunction(() => document.querySelector('.letters-panel').hidden);
        report.checks.push('L explicitly opens and hides letter controls');
        await page.keyboard.press('t');
        await page.waitForFunction(() => document.documentElement.dataset.tuning === 'true' && document.querySelector('#tunerBody').children.length > 0);
        await page.keyboard.press('t');
        await page.waitForFunction(() => document.documentElement.dataset.tuning === 'false');
        report.checks.push('T explicitly opens and hides scene controls');
        // Typing in an editable surface must not trigger hidden design shortcuts.
        await page.evaluate(() => { const el = document.createElement('div'); el.id = 'qa-editable'; el.contentEditable = 'true'; el.style.cssText = 'position:fixed;z-index:100;top:2px;left:2px'; document.body.append(el); el.focus(); });
        await page.keyboard.type('tl');
        check(await page.evaluate(() => document.documentElement.dataset.tuning === 'false' && document.querySelector('.letters-panel').hidden), 'typing in contenteditable does not open workshops');
        await page.evaluate(() => document.querySelector('#qa-editable').remove());
        await page.evaluate(async () => { const s = window.__MONTIS_STUDY__; await s.ready; s.skipEntry(); });
        await page.keyboard.press('End');
        await page.waitForFunction(() => { const s = window.__MONTIS_STUDY__; return s.journey.progress > s.journey.max - .08; }, null, { timeout: 20000 });
        check(await page.evaluate(() => { const p = window.__MONTIS_STUDY__.canyon.camera.position; return [p.x, p.y, p.z].every(Number.isFinite); }), 'keyboard navigation reaches a finite final scene');
        await page.screenshot({ path: path.join(out, `${name}-finale.png`) });
        await page.keyboard.press('Home');
        await page.waitForFunction(() => window.__MONTIS_STUDY__.journey.progress < .08, null, { timeout: 20000 });
        report.checks.push('Home returns to the opening scene');
        check(report.errors.length === 0, 'no JavaScript or shader console errors');
        check(report.resources.length === 0, 'no failed HTTP resources');
        console.log(`PASS ${name}: ${report.checks.length} checks`);
      } catch (error) {
        report.failure = error.stack;
        await page.screenshot({ path: path.join(out, `${name}-failure.png`) }).catch(() => {});
        throw error;
      } finally { await context.close(); }
    }
  } finally {
    await fs.writeFile(path.join(out, 'experience.json'), JSON.stringify({ url, reports }, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
