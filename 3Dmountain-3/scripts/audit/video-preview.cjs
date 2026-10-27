// index1-1's RESPONSIBILITY section (the ocean video) with in-memory variants of js/finnovation-world.js (nothing on
// disk changes).   node video-preview.cjs <base> <outPrefix>
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const [base = 'http://127.0.0.1:5661/', out = 'shots/video'] = process.argv.slice(2);
const VARIANTS = {
  now: [],
  own1: [["bu.uOwnColour.value = clamp(num(V.colour, .22));", "bu.uOwnColour.value = 1;"]],
  raw: [
    ["bu.uOwnColour.value = clamp(num(V.colour, .22));", "bu.uOwnColour.value = 1;"],
    ["graded = mix(graded, ph * 0.62, uOwnColour) * uBright;", "graded = mix(graded, ph, uOwnColour) * uBright;"],
    ["graded *= mix(0.55, 1.0, v);", "graded *= mix(mix(0.55, 1.0, v), 1.0, uOwnColour);"],
    ["graded *= mix(0.8, 1.0, smoothstep(0.0, 0.55, vUv.y));", "graded *= mix(mix(0.8, 1.0, smoothstep(0.0, 0.55, vUv.y)), 1.0, uOwnColour);"],
    ["  col = fiGrade(col);\n  // written premultiplied", "  col = mix(fiGrade(col), col, uPhotoMix * uOwnColour);\n  // written premultiplied"]
  ]
};
const shut = t => Promise.race([t.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
  for (const [name, patches] of Object.entries(VARIANTS)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await context.newPage(); page.setDefaultTimeout(150000);
    const missed = [];
    await page.route(u => u.pathname.endsWith('/js/finnovation-world.js'), async route => {
      const resp = await route.fetch(); let body = await resp.text();
      for (const [f, r] of patches) { if (!body.includes(f)) missed.push(f.slice(0, 40)); body = body.split(f).join(r); }
      await route.fulfill({ response: resp, body });
    });
    await page.goto(base + 'index1-1.html?tune=0&letters=0', { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout: 150000, polling: 250 });
    await page.evaluate(() => window.__MONTIS_STUDY__.ready).catch(() => { });
    await page.mouse.move(720, 450);
    await page.keyboard.press('End');
    await page.waitForFunction(() => { const s = window.__MONTIS_STUDY__; return s.journey.progress > s.journey.max - .01; }, null, { timeout: 90000, polling: 200 });
    await page.waitForFunction(() => window.__MONTIS_STUDY__.portfolio && window.__MONTIS_STUDY__.portfolio.ready, null, { timeout: 90000, polling: 200 }).catch(() => { });
    await page.waitForTimeout(1500);
    // through the bridge and the strip into the world, then to the footer and back up to the responsibility part
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(90); }
    await page.waitForTimeout(2500);
    await page.keyboard.press('End'); await page.waitForTimeout(2500);
    for (let i = 0; i < 2; i++) { await page.keyboard.press('PageUp'); await page.waitForTimeout(1200); }
    await page.waitForTimeout(2500);
    fs.writeFileSync(`${out}-${name}.jpg`, await page.screenshot({ type: 'jpeg', quality: 84 }));
    console.log(name, 'missed', JSON.stringify(missed));
    await shut(context);
  }
  await shut(browser); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
