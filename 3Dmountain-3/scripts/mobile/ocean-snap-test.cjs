/* Node-only: shipped controller and actual generated world input callbacks. */
const assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), DIR = path.join(ROOT, 'prototypes/index1-5');
const read = file => fs.readFileSync(path.join(DIR, file), 'utf8').replace(/\r\n/g, '\n');
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
class Clock {
  constructor() { this.now = 0; this.jobs = new Map(); this.serial = 0; }
  setTimeout(fn, delay) { const id = ++this.serial; this.jobs.set(id, { fn, at: this.now + delay }); return id; }
  clearTimeout(id) { this.jobs.delete(id); }
  tick(ms) {
    const end = this.now + ms;
    while (true) {
      const next = [...this.jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.now = next[1].at; this.jobs.delete(next[0]); next[1].fn();
    }
    this.now = end;
  }
}
function extract(source, name) {
  const start = source.indexOf(name); assert.ok(start >= 0);
  const brace = source.indexOf('{', start); let depth = 1, end = brace + 1;
  for (; depth; end++) { if (source[end] === '{') depth++; else if (source[end] === '}') depth--; assert.ok(end < source.length); }
  return source.slice(start, end);
}
async function main() {
  const load = file => import('data:text/javascript;base64,' + Buffer.from(read(file) + '\n//# sourceURL=' + file).toString('base64'));
  const { nearestOceanStop, createOceanPanelSnap } = await load('ocean-panel-snap.js');
  const { consumeMobileScroll } = await load('mobile-touch-navigation.js');
  const { oceanPanelState, oceanProgress } = await load('world-ocean-scroll.js');
  const oceanSource = read('world-ocean.js'), worldSource = read('js/finnovation-world.js');
  const stopExpression = oceanSource.match(/const stopY = ([^;]+);/)[1];
  const at = { resp: 5000, stop: Math.round(568 * 1.1) }, N = 4;
  const stopY = new Function('at', 'clamp', 'N', 'return ' + stopExpression)(at, clamp, N);
  const stops = Array.from({ length: N }, (_, i) => stopY(i));
  for (let i = 0; i < N; i++) {
    const progress = oceanProgress((stops[i] - at.resp) / at.stop, N);
    assert.ok(Math.abs(oceanPanelState({ index: i, progress, width: 320, count: N }).x) < .1, 'Existing stopY aligns a whole card');
  }
  assert.equal(nearestOceanStop((stops[1] + stops[2]) / 2, stops, -1), stops[1]);
  assert.equal(nearestOceanStop((stops[1] + stops[2]) / 2, stops, 1), stops[2]);
  for (const outside of [0, at.resp - 500, stops[0] - 1, stops[N - 1] + 1, 9000]) assert.equal(nearestOceanStop(outside, stops), null);
  console.log('PASS actual ocean stopY/N alignment, forward/reverse nearest/ties, globe/dive/tail exclusion');

  const clock = new Clock(); let position = stops[1] + 150, enabled = true, moved = [];
  const snap = createOceanPanelSnap({ enabled: () => enabled, getPosition: () => position, getStops: () => stops,
    moveTo: stop => { position = stop; moved.push(stop); }, timers: clock });
  snap.input(100, 'wheel'); clock.tick(120); position = stops[1] + 400; snap.input(250, 'wheel');
  clock.tick(179); assert.deepEqual(moved, []); clock.tick(1); assert.deepEqual(moved, [stops[2]]);
  position = stops[2] - 450; snap.input(-450, 'touch'); clock.tick(1000); assert.equal(moved.length, 1);
  snap.finish(); clock.tick(180); assert.equal(position, stops[1]);
  position += 100; snap.input(100, 'wheel'); snap.cancel(); clock.tick(1000); assert.equal(moved.length, 2);
  enabled = false; snap.input(10, 'wheel'); assert.equal(clock.jobs.size, 0);
  console.log('PASS single debounced wheel timer, no snap while touching, reverse release, cancellation and disabled scope');

  function worldHarness({ mobilePerformance = true, width = 320, height = 568 } = {}) {
    const timer = new Clock(), viewport = {}, slot = {};
    const begin = worldSource.indexOf('  const toPixels ='), finish = worldSource.indexOf('  // ---------- navigation ----------', begin);
    const input = worldSource.slice(begin, finish), take = extract(worldSource, 'take(delta, source, target)'), scrollTo = extract(worldSource, 'scrollTo(value)');
    const api = new Function('createOceanPanelSnap', 'consumeMobileScroll', 'mountMobileTouchNavigation', 'viewport', 'performance', 'clamp', 'stops', 'scope', `
      let open = true, y = stops[0], yt = y, vy = 0, runs = 0;
      const H = scope.height, maxY = 10000, reducedMotion = false, mobilePerformance = scope.mobilePerformance;
      const ocean = { N: stops.length, stopY: i => stops[i], active: true, swipe: 2 };
      const run = () => { runs++; }, close = () => { open = false; oceanSnap.cancel(); }, epilogue = () => null, carry = null;
      ${input}
      return { ${take}, ${scrollTo}, get position() { return yt; }, setY(value) { y = yt = value; }, close,
        get runs() { return runs; }, cancel: () => oceanSnap.cancel() };
    `)(options => createOceanPanelSnap({ ...options, timers: timer }), consumeMobileScroll,
      options => { slot.handlers = options; return () => {}; }, viewport, { now: () => timer.now }, clamp, stops, { mobilePerformance, width, height });
    return { api, timer, handlers: slot.handlers };
  }
  const world = worldHarness();
  const panel = { scrollTop: 100, scrollHeight: 700, clientHeight: 300, inert: false,
    ownerDocument: { defaultView: { innerWidth: 320, getComputedStyle: () => ({ overflowY: 'auto' }) } },
    getBoundingClientRect: () => ({ left: 0, right: 320 }) };
  const paragraph = { closest: () => panel };
  world.handlers.onStart(); world.handlers.onDelta({ dx: 0, dy: 100, axis: 'y', target: paragraph }); world.handlers.onEnd({ cancelled: false });
  world.timer.tick(500); assert.equal(panel.scrollTop, 200); assert.equal(world.api.position, stops[0]); assert.equal(world.timer.jobs.size, 0);
  panel.scrollTop = 390;
  world.handlers.onStart(); world.handlers.onDelta({ dx: 0, dy: 510, axis: 'y', target: paragraph }); world.handlers.onEnd({ cancelled: false });
  world.timer.tick(180); assert.equal(panel.scrollTop, 400); assert.equal(world.api.position, stops[1]);
  world.api.setY(stops[2]); panel.scrollTop = 10;
  world.handlers.onStart(); world.handlers.onDelta({ dx: 0, dy: -510, axis: 'y', target: paragraph }); world.handlers.onEnd({ cancelled: false });
  world.timer.tick(180); assert.equal(panel.scrollTop, 0); assert.equal(world.api.position, stops[1]);
  world.api.setY(stops[1]); world.api.take(200 / 720, 'wheel'); assert.equal(world.timer.jobs.size, 1);
  panel.scrollTop = 100; world.api.take(70 / 720, 'wheel', paragraph); assert.equal(world.timer.jobs.size, 0);
  world.timer.tick(500); assert.equal(world.api.position, stops[1] + 200, 'Reading inner copy does not steal its scroll to snap');
  console.log('PASS shipped world input: long copy consumes first, both boundary remainders snap, inner reading cancels pending alignment');

  for (const initial of [1000, at.resp - 100, stops[3] + 60]) {
    world.api.setY(initial); world.api.take(20 / 720, 'wheel'); world.timer.tick(500);
    assert.equal(world.api.position, initial + 20); assert.equal(world.timer.jobs.size, 0);
  }
  world.api.setY(stops[3] - 10); world.api.take(100 / 720, 'wheel'); world.timer.tick(500); assert.equal(world.api.position, stops[3] + 90);
  world.api.setY(stops[0] + 10); world.api.take(-100 / 720, 'wheel'); world.timer.tick(500); assert.equal(world.api.position, stops[0] - 90);
  world.api.setY(stops[1]); world.api.take(100 / 720, 'wheel'); world.api.scrollTo(1000); world.timer.tick(500); assert.equal(world.api.position, 1000);
  world.api.setY(stops[1]); world.api.take(100 / 720, 'wheel'); world.handlers.onEnd({ cancelled: true }); assert.equal(world.timer.jobs.size, 0);
  const gateExpression = worldSource.match(/const mobilePerformance = ([\s\S]+?);/)[1];
  const actualGate = (width, shortScreen, coarse, mainPage = true) => new Function('document', 'innerWidth', 'shortScreen', 'window', 'return ' + gateExpression)(
    { documentElement: { matches: () => mainPage } }, width, shortScreen, { matchMedia: () => ({ matches: coarse }) });
  assert.equal(actualGate(1280, 1080, false), false, 'Fine-pointer desktop short window uses the existing desktop budget');
  assert.equal(actualGate(844, 390, true), true, 'Landscape phone uses the existing mobile budget');
  assert.equal(actualGate(320, 568, true, false), false, 'Refinement page remains excluded by the world gate');
  for (const scope of [{ mobilePerformance: false }, { width: 1440, height: 900, mobilePerformance: false }, { width: 1280, height: 640, mobilePerformance: actualGate(1280, 1080, false) }]) {
    const other = worldHarness(scope); other.api.setY(stops[1]); other.api.take(200 / Math.max(720, (scope.height || 568) * .85), 'wheel'); other.timer.tick(500);
    assert.equal(other.api.position, stops[1] + 200); assert.equal(other.timer.jobs.size, 0);
  }
  const landscape = worldHarness({ width: 844, height: 390, mobilePerformance: actualGate(844, 390, true) });
  landscape.api.setY(stops[1]); landscape.api.take(200 / 720, 'wheel'); landscape.timer.tick(180); assert.equal(landscape.api.position, stops[1]);
  const helper = require('../../prototypes/index1-5/mobile-ocean-snap-build.cjs');
  assert.equal(helper.patchWorld(worldSource), worldSource);
  assert.equal(read('js/ocean-panel-snap.js').replace(/^\/\* index1-5 generated[^\n]*\*\/\n/, ''), read('ocean-panel-snap.js'));
  console.log('PASS ocean exits/globe/dive/tail stay free; shared world gate preserves refinement/1280x640 desktop and includes landscape phone');
  console.log('All ocean reading alignment checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
