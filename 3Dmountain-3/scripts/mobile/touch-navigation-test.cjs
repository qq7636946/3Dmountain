/* Node-only behavioral tests: execute shipped input handlers with a minimal DOM.
   No browser, network, WebGL, or duplicated journey routing implementation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/\r\n/g, '\n');
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
class Hub {
  constructor() { this.listeners = new Map(); this.now = 0; }
  addEventListener(type, fn, options) { const list = this.listeners.get(type) || []; list.push({ fn, options }); this.listeners.set(type, list); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(entry => entry.fn !== fn)); }
  emit(type, props = {}) {
    this.now += 16;
    const event = { type, pointerType: 'touch', pointerId: 1, isPrimary: true, cancelable: true, clientX: 100, clientY: 500, detail: 1,
      preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...props };
    const list = [...(this.listeners.get(type) || [])].sort((a, b) => Number(b.options === true) - Number(a.options === true));
    for (const { fn } of list) { fn(event); if (event.stopped) break; }
    return event;
  }
}
class Node {
  constructor(tag = 'div', classes = '', parent = null, attrs = {}) {
    this.tag = tag; this.classes = classes.split(' '); this.parent = parent; this.attrs = attrs; this.style = {}; this.inert = false;
  }
  closest(selector) {
    const match = node => selector.split(',').some(part => {
      const s = part.trim();
      if (s.startsWith('.')) return node.classes.includes(s.slice(1));
      if (s.startsWith('#')) return node.attrs.id === s.slice(1);
      if (s.startsWith('[contenteditable]')) return 'contenteditable' in node.attrs && node.attrs.contenteditable !== 'false';
      if (s === '[role="dialog"]') return node.attrs.role === 'dialog';
      if (s.startsWith('[')) return s.slice(1, -1) in node.attrs;
      return node.tag === s;
    });
    for (let n = this; n; n = n.parent) if (match(n)) return n;
    return null;
  }
  contains(node) { for (; node; node = node.parent) if (node === this) return true; return false; }
}
function panelAt({ width = 390, left = 0, top = 0, max = 400, overflow = 'auto' } = {}) {
  const panel = new Node('article', 'fiwo-panel', null, { 'data-mobile-scroll': '' });
  Object.assign(panel, { scrollTop: top, scrollHeight: 300 + max, clientHeight: 300,
    ownerDocument: { defaultView: { innerWidth: width, getComputedStyle: () => ({ overflowY: overflow }) } },
    getBoundingClientRect: () => ({ left, right: left + width }) });
  return panel;
}
function extract(source, name) {
  const start = source.indexOf(name); assert.ok(start >= 0, 'Source anchor exists: ' + name);
  const brace = source.indexOf('{', start); let depth = 1, end = brace + 1;
  for (; depth && end < source.length; end++) { if (source[end] === '{') depth++; else if (source[end] === '}') depth--; }
  assert.equal(depth, 0); return source.slice(start, end);
}
async function main() {
  const source = read('prototypes/index1-5/mobile-touch-navigation.js');
  const touch = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const snap = await import('data:text/javascript;base64,' + Buffer.from(read('prototypes/index1-5/ocean-panel-snap.js')).toString('base64'));
  const mainSource = read('prototypes/index1-5/js/main.js');
  const worldSource = read('prototypes/index1-5/js/finnovation-world.js');
  const portfolioSource = read('prototypes/index1-5/js/portfolio-epilogue-polish.js');
  const build = require('../../prototypes/index1-5/mobile-touch-build.cjs');
  assert.equal(build.patchMain(mainSource), mainSource); assert.equal(build.patchWorld(worldSource), worldSource);
  assert.equal(source, read('prototypes/index1-5/js/mobile-touch-navigation.js').replace(/^\/\* index1-5 generated[^\n]*\*\/\n/, ''));

  const body = new Node(), ui = new Node('div', 'finnovation-ui', body, { 'data-journey-ui': '' });
  const copy = new Node('main', 'fi-copy', ui), heading = new Node('h2', '', copy), text = new Node('span', '', heading);
  const cta = new Node('button', '', copy), ctaText = new Node('span', '', cta);
  const canvas = new Node('canvas', '', body); canvas.setPointerCapture = () => {};
  const header = new Node('header', 'fi-header', ui), footer = new Node('footer', 'fi-footer', ui);
  ui.querySelectorAll = () => [copy, header, footer];
  const worldRoot = new Node('section', '', body, { 'data-world-ui': '' });
  const worldText = new Node('p', '', worldRoot);
  let menu = false, calls = [];
  const hub = new Hub(); global.window = hub;
  const dispose = touch.mountJourneyTouchNavigation({ canvas, uiRoot: ui, eventRoot: hub, blocked: () => menu, viewportHeight: () => 844, advance: (...args) => calls.push(args) });
  assert.equal(copy.style.touchAction, 'none'); assert.equal(header.style.touchAction, 'none'); assert.equal(footer.style.touchAction, 'none');
  const start = (target, extra) => hub.emit('pointerdown', { target, ...extra });
  const move = (target, y, extra) => hub.emit('pointermove', { target, clientY: y, ...extra });
  const end = (target, type = 'pointerup') => hub.emit(type, { target });
  start(text); move(text, 495); assert.equal(calls.length, 0); move(text, 450);
  assert.equal(calls.length, 1); assert.equal(calls[0][1], text); assert.ok(Math.abs(calls[0][0] - 50 * 1.9 / (844 * .8)) < 1e-9); end(text);
  assert.equal(hub.listeners.get('pointermove')[0].options.passive, false);
  console.log('PASS visible heading/text descendants drive journey; correct units and nonpassive move');
  calls = [];
  for (const target of [new Node('input', '', copy), new Node('div', 'letters-panel', body), new Node('div', 'lgp', body), new Node('p', '', new Node('aside', 'fi-grade', body)), new Node('div', '', new Node('div', '', body, { id: 'tuner' })), new Node('button', '', new Node('nav', 'fi-rail', ui)), new Node('p', '', new Node('dialog', '', body)), worldText]) {
    start(target); move(target, 350); end(target);
  }
  menu = true; start(text); move(text, 300); end(text); menu = false;
  assert.equal(calls.length, 0);
  start(text); menu = true; move(text, 300); menu = false; end(text); assert.equal(calls.length, 0);
  console.log('PASS menus, editor panels, native inputs, chapter rail, and world own their gestures');
  start(ctaText); end(ctaText); assert.ok(!hub.emit('click', { target: ctaText }).defaultPrevented);
  start(ctaText); move(ctaText, 400); end(ctaText);
  assert.equal(calls.length, 1); assert.ok(hub.emit('click', { target: cta }).defaultPrevented);
  assert.ok(!hub.emit('click', { target: cta, detail: 0 }).defaultPrevented);
  calls = []; start(text); move(text, 497, { clientX: 230 }); end(text); assert.equal(calls.length, 0);
  start(text); end(text, 'pointercancel'); move(text, 300); assert.equal(calls.length, 0);
  start(text); start(text, { isPrimary: false, pointerId: 2 }); move(text, 300); end(text); assert.equal(calls.length, 0);
  console.log('PASS CTA taps work, drags suppress ghost clicks, horizontal cards stay independent, cancel/multitouch reset');
  dispose(); assert.equal(copy.style.touchAction, undefined);

  for (const width of [320, 390]) {
    const panel = panelAt({ width, left: 18, top: 100 }), inner = new Node('p', '', panel);
    assert.equal(touch.consumeMobileScroll(inner, 60), 0); assert.equal(panel.scrollTop, 160);
    assert.equal(touch.consumeMobileScroll(inner, 300), 60); assert.equal(panel.scrollTop, 400);
    assert.equal(touch.consumeMobileScroll(inner, -450), -50); assert.equal(panel.scrollTop, 0);
    assert.equal(touch.consumeMobileScroll(inner, -10), -10);
  }
  assert.equal(touch.consumeMobileScroll(new Node('p', '', panelAt({ overflow: 'visible' })), 70), 70);
  assert.equal(touch.consumeMobileScroll(new Node('p', '', panelAt({ left: -390 })), 70), 70);
  assert.equal(touch.consumeMobileScroll(new Node('p', '', panelAt({ max: 0 })), 70), 70);
  console.log('PASS 320/390px inner copy scroll, gutter/partial position, forward/reverse boundary remainder, desktop/offscreen guards');

  function worldHarness(eventRoot, carry) {
    global.window = eventRoot;
    const viewport = new Hub();
    const begin = worldSource.indexOf('  const toPixels =');
    const finish = worldSource.indexOf('  // ---------- navigation ----------', begin);
    const input = worldSource.slice(begin, finish);
    const take = extract(worldSource, 'take(delta, source, target)');
    return new Function('mountMobileTouchNavigation', 'consumeMobileScroll', 'createOceanPanelSnap', 'viewport', 'performance', 'carry', 'clamp', `
      let open = true, y = 0, yt = 0, vy = 0, runs = 0, closes = 0;
      const mobilePerformance = false;
      const H = 844, maxY = 500, reducedMotion = false, ocean = { active: false, swipe: 1.3 };
      const run = () => { runs++; }, close = () => { open = false; y = yt = vy = 0; samples = []; closes++; }, epilogue = () => null;
      ${input}
      return { ${take}, viewport, enter(delta = 0) { open = true; y = yt = 0; if(delta) scrollPx(toPixels(delta), 'wheel'); },
        get open() { return open; }, get state() { return { y, yt, samples: samples.length, runs, closes }; },
        settle() { y = yt; }, setY(value) { y = yt = value; }, setOcean(active) { ocean.active = active; }, dispose: disposeWorldTouch };
    `)(touch.mountMobileTouchNavigation, touch.consumeMobileScroll, snap.createOceanPanelSnap, viewport, { now: () => eventRoot.now }, carry, clamp);
  }
  const worldHub = new Hub(); let carried = [];
  const world = worldHarness(worldHub, delta => carried.push(delta));
  let mainMoves = 0;
  const off = touch.mountJourneyTouchNavigation({ canvas, uiRoot: ui, eventRoot: worldHub, blocked: () => false, viewportHeight: () => 844, advance: () => mainMoves++ });
  const worldDown = target => { world.viewport.emit('pointerdown', { target }); worldHub.emit('pointerdown', { target }); };
  worldDown(worldText); worldHub.emit('pointermove', { target: worldText, clientY: 400 });
  assert.equal(mainMoves, 0); assert.equal(world.state.yt, 100); assert.equal(world.state.runs, 1);
  worldHub.emit('pointercancel', { target: worldText }); assert.equal(world.state.samples, 0); assert.equal(world.state.yt, 100);
  const reading = panelAt({ top: 100 }), paragraph = new Node('p', '', reading); reading.parent = worldRoot;
  world.setY(0); worldDown(paragraph); worldHub.emit('pointermove', { target: paragraph, clientY: 400 });
  assert.equal(reading.scrollTop, 200); assert.equal(world.state.yt, 0);
  worldHub.emit('pointermove', { target: paragraph, clientY: 100 }); assert.equal(reading.scrollTop, 400); assert.equal(world.state.yt, 100);
  worldHub.emit('pointercancel', { target: paragraph });
  assert.equal(world.take(100 / Math.max(720, 844 * .85), 'wheel', paragraph), true); assert.equal(world.state.yt, 200);
  world.setY(0); worldDown(worldText); worldHub.emit('pointermove', { target: worldText, clientY: 600 });
  assert.equal(world.open, false); assert.equal(carried.length, 1);
  worldHub.emit('pointermove', { target: worldText, clientY: 700 }); assert.equal(carried.length, 2, 'Original world swipe continues after close');
  worldHub.emit('pointerup', { target: worldText });
  world.enter(); world.setOcean(true); worldDown(worldText); worldHub.emit('pointermove', { target: worldText, clientX: 0, clientY: 499 }); assert.equal(world.state.yt, 130);
  worldHub.emit('pointercancel', { target: worldText }); world.dispose(); off();
  console.log('PASS actual world handlers: no duplicate main movement, nested copy scroll/carry, wheel route, cancel, horizontal ocean, continuous reverse handoff');

  // Execute the shipped advanceJourney and takeBridge bodies, with only their
  // renderer/physics dependencies stubbed, to verify cross-scene ownership.
  const routeHub = new Hub(); global.window = routeHub;
  const journey = { progress: 9.9, target: 10, max: 10, velocity: 0 };
  let advance;
  const routedWorld = worldHarness(routeHub, delta => advance(delta, 'touch'));
  routedWorld.setY(0); // Close it by one real reverse request before starting.
  routedWorld.take(-.1, 'touch');
  const env = { assetsReady: true, dropTouch: { grabbed: false }, portfolioNavPending: false, journey, performance: { now: () => routeHub.now }, THREE: { MathUtils: { clamp } }, world: routedWorld, portfolio: null };
  advance = new Function('env', 'with(env) { ' + extract(mainSource, 'function advanceJourney(delta, source, target)') + '; return advanceJourney; }')(env);
  const pf = { failed: false, open: false, prepared: true, quiet: 0, bt: 0, amount: 0, velocity: 0, drag: null, UNITS: 6900,
    performance: env.performance, state: () => journey, span: () => .4, run() {}, load() { throw Error('Unexpected load'); },
    beginBridge() { pf.open = true; pf.bt = 0; }, close() { pf.open = false; pf.bt = 0; }, carry: delta => advance(delta),
    onEnd: delta => routedWorld.enter(delta), slider: { progress: 0, scrollBy(pixels) {
      const next = clamp(this.progress - pixels / 6900, 0, 1), changed = next !== this.progress; this.progress = next; return changed;
    } } };
  pf.take = new Function('env', 'with(env) { ' + extract(portfolioSource, 'function takeBridge(delta)') + '; return takeBridge; }')(pf); env.portfolio = pf;
  const routeDispose = touch.mountJourneyTouchNavigation({ canvas, uiRoot: ui, eventRoot: routeHub, blocked: () => false, viewportHeight: () => 844, advance: (delta, target) => advance(delta, 'touch', target) });
  routeHub.emit('pointerdown', { target: text }); let py = 500; const seen = new Set();
  for (let i = 0; i < 12; i++) {
    py -= 160; routeHub.emit('pointermove', { target: text, clientY: py });
    journey.progress = journey.target; pf.amount = pf.bt; routedWorld.settle();
    if (pf.open) seen.add('cards'); if (routedWorld.open) seen.add('world');
  }
  routeHub.emit('pointerup', { target: text });
  assert.ok(seen.has('cards')); assert.ok(seen.has('world')); assert.ok(routedWorld.state.yt > 0);
  routedWorld.viewport.emit('pointerdown', { target: worldText }); routeHub.emit('pointerdown', { target: worldText }); py = 500;
  for (let i = 0; i < 20; i++) {
    py += 160; routeHub.emit('pointermove', { target: worldText, clientY: py });
    journey.progress = journey.target; pf.amount = pf.bt; routedWorld.settle();
  }
  routeHub.emit('pointercancel', { target: worldText });
  assert.equal(routedWorld.open, false); assert.equal(pf.open, false); assert.ok(journey.target < 9.8, 'Same reverse swipe reaches main journey');
  routeDispose(); routedWorld.dispose();
  console.log('PASS shipped main → bridge/cards → world and world → cards → main routing without lifting the gesture');
  console.log('All mobile input routing checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
