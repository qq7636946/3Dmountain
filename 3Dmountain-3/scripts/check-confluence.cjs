const { chromium } = require('C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const base = process.argv[2] || 'http://127.0.0.1:57603/index4-6.html';
const baseline = process.argv.includes('--baseline');
if (!base.startsWith('http://127.0.0.1:')) throw Error('Use the local preview URL');
const output = path.resolve(__dirname, '../.qa/confluence');
const expectedSceneHash = 'c09e07023cb07e1dc644678229f7b92488d77adfe7c34c45ef637c8d491f5200';
const finite = (values, label) => assert(values.every(Number.isFinite), `${label} contains a non-finite value`);

async function jump(page, progress) {
  await page.evaluate(p => {
    const j = window.__MONTIS_STUDY__.journey;
    j.progress = j.target = p; j.velocity = 0;
  }, progress);
  await page.waitForTimeout(650);
}

async function readPose(page) {
  return page.evaluate(() => {
    const app = window.__MONTIS_STUDY__, c = app.canyon;
    const invalidObjects = [];
    for (const root of [c.scene]) root.traverse(o => {
      if (![...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()].every(Number.isFinite)) invalidObjects.push(o.name || o.type);
    });
    return {
      progress: app.journey.progress, target: app.journey.target, velocity: app.journey.velocity,
      camera: c.camera.position.toArray(), quaternion: c.camera.quaternion.toArray(),
      fov: c.camera.fov, near: c.camera.near, far: c.camera.far,
      mainCamera: app.camera.position.toArray(), fogDensity: c.scene.fog?.density,
      activeStory: app.brandStory.root.dataset.active,
      text: app.textFx ? { ...app.textFx.state } : null,
      stats: c.stats, invalidObjects,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }
    };
  });
}

async function inspectContinuity(page) {
  return page.evaluate(() => {
    const c = window.__MONTIS_STUDY__.canyon, w = c.watershed;
    const joins = w.descriptors.map((d, i) => {
      const p = d.curve.getPointAt(1), main = w.mainAt(d.joinZ);
      let minWidth = Infinity, maxChannelHeight = -Infinity;
      for (let j = 1; j < 40; j++) {
        const t = j / 40, sample = d.curve.getPointAt(t);
        minWidth = Math.min(minWidth, d.widthAt(t));
        maxChannelHeight = Math.max(maxChannelHeight, w.sampleHeight(sample.x, sample.z));
      }
      return { tributary: i + 1, join: p.toArray(), joinZ: d.joinZ,
        horizontalGap: Math.hypot(p.x - main.x, p.z - d.joinZ), minWidth, maxChannelHeight };
    });
    return { riverCount: c.rivers.length, tributaryCount: w.descriptors.length, joins, stats: w.stats };
  });
}

async function touchSwipe(page, from, to) {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= 8; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 8, y: from.y + (to.y - from.y) * i / 8 }] });
    await page.waitForTimeout(25);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const reports = [];
  try {
    const devices = baseline ? [['desktop', { width: 1440, height: 900 }]] : [
      ['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]
    ];
    for (const [name, viewport] of devices) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: name === 'mobile', hasTouch: name === 'mobile' });
      const errors = [], failed = [], shaderWarnings = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => {
        if (m.type() === 'error') errors.push(m.text());
        else if (/WebGL|shader.*(?:error|failed)|GL_INVALID/i.test(m.text())) shaderWarnings.push(m.text());
      });
      page.on('requestfailed', r => failed.push({ url: r.url(), reason: r.failure()?.errorText }));
      await page.addInitScript(() => {
        const read = Response.prototype.arrayBuffer;
        Response.prototype.arrayBuffer = async function (...args) {
          const buffer = await read.apply(this, args);
          if (buffer.byteLength === 3374304) window.__sceneTransferProof = crypto.subtle.digest('SHA-256', buffer).then(hash => ({
            bytes: buffer.byteLength, hash: [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('')
          }));
          return buffer;
        };
      });
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.__MONTIS_STUDY__ && document.body.classList.contains('is-ready'), null, { timeout: 45000 });
      await page.waitForTimeout(1500);
      const poses = [];
      const stages = baseline ? [['overview', 11.8], ['finale', 13.8]] : [
        ['hero', 0], ['canyon', 4.8], ['tributaries', 10.9], ['overview', 11.8], ['finale', 13.8], ['return', 0]
      ];
      for (const [stage, progress] of stages) {
        await jump(page, progress);
        if (stage === 'hero' || stage === 'return') await page.waitForTimeout(1200);
        const pose = await readPose(page);
        finite(pose.camera, `${name}/${stage} canyon camera`); finite(pose.quaternion, `${name}/${stage} camera quaternion`);
        finite(pose.mainCamera, `${name}/${stage} main camera`);
        assert.equal(pose.invalidObjects.length, 0, 'Invalid scene object transform');
        assert.equal(pose.horizontalOverflow, false, 'Horizontal layout overflow');
        assert(Math.abs(pose.progress - progress) < .001, `Incorrect ${stage} progress`);
        poses.push({ stage, ...pose });
        await page.screenshot({ path: path.join(output, `${baseline ? 'before-' : ''}${name}-${stage}.png`) });
      }
      const continuity = await inspectContinuity(page);
      assert.equal(continuity.riverCount, 5, 'The five-river scene lost a river');
      assert.equal(continuity.tributaryCount, 4, 'Expected four tributaries and one trunk');
      for (const join of continuity.joins) {
        finite(join.join, 'Tributary endpoint');
        assert(join.horizontalGap < .01, 'Tributary does not join the trunk');
        assert(join.minWidth > 0, 'River width collapsed');
        assert(join.maxChannelHeight < 2.5, 'Terrain blocks a tributary channel');
      }
      let navigation = null;
      if (!baseline) {
        await jump(page, 10.9);
        const before = await page.evaluate(() => window.__MONTIS_STUDY__.journey.progress);
        if (name === 'mobile') await touchSwipe(page, { x: 345, y: 690 }, { x: 345, y: 405 });
        else { await page.mouse.move(1250, 750); await page.mouse.wheel(0, 600); }
        await page.waitForTimeout(750);
        const forward = await page.evaluate(() => window.__MONTIS_STUDY__.journey.progress);
        assert(forward > before + .02, 'Native scrolling did not advance');
        if (name === 'mobile') await touchSwipe(page, { x: 345, y: 405 }, { x: 345, y: 690 });
        else await page.mouse.wheel(0, -600);
        await page.waitForTimeout(750);
        const backward = await page.evaluate(() => window.__MONTIS_STUDY__.journey.progress);
        assert(backward < forward - .02, 'Native scrolling did not reverse');
        await page.keyboard.press('Home'); await page.waitForTimeout(1800);
        const home = await page.evaluate(() => window.__MONTIS_STUDY__.journey.progress);
        assert(home < .01, 'Home did not return to the opening');
        navigation = { input: name === 'mobile' ? 'native touch swipe' : 'native wheel', before, forward, backward, home };
      }
      const proof = await page.evaluate(async () => await window.__sceneTransferProof || null);
      const telemetryOnly = failed.filter(r => r.url.endsWith('/drop_of_water/scene.bin') && r.reason === 'net::ERR_ABORTED' && proof?.hash === expectedSceneHash);
      const actionableFailed = failed.filter(r => !telemetryOnly.includes(r));
      const report = { name, baseline, url: base, capturedAt: new Date().toISOString(), poses, continuity, navigation, proof, errors, shaderWarnings, failed: actionableFailed, verifiedTransferTelemetry: telemetryOnly };
      reports.push(report);
      await fs.writeFile(path.join(output, baseline ? 'before-report.json' : 'report.json'), JSON.stringify(reports, null, 2));
      console.log(JSON.stringify({ name, baseline, poses: poses.map(p => ({ stage: p.stage, camera: p.camera, fov: p.fov, stats: p.stats })), continuity, navigation, errors, shaderWarnings, failed: actionableFailed, verifiedTransferTelemetry: telemetryOnly }, null, 2));
      await page.close();
    }
    if (reports.some(r => r.errors.length || r.shaderWarnings.length || r.failed.length)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
