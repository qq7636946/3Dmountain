/* Execute the shipped budget and renderer decisions without a browser or GPU. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), base = path.join(root, 'prototypes/index1-5');
const read = name => fs.readFileSync(path.join(base, name), 'utf8').replace(/\r\n/g, '\n');
function extract(source, anchor) {
  const start = source.indexOf(anchor); assert.ok(start >= 0, anchor);
  const open = source.indexOf('{', start); let depth = 1, end = open + 1;
  while (depth && end < source.length) { if (source[end] === '{') depth++; else if (source[end] === '}') depth--; end++; }
  assert.equal(depth, 0); return source.slice(start, end);
}
(async () => {
  const budgetSource = read('mobile-render-budget.js');
  const { selectMobileRenderBudget: select } = await import('data:text/javascript;base64,' + Buffer.from(budgetSource).toString('base64'));
  const phone = select({ active: true, width: 390, screenWidth: 390, screenHeight: 844, coarse: true });
  const landscape = select({ active: true, width: 844, screenWidth: 844, screenHeight: 390, coarse: true });
  const desktop = select({ active: true, width: 1440, screenWidth: 1440, screenHeight: 900 });
  const alternate = select({ active: false, width: 390, coarse: true });
  assert.equal(phone.mobile, true); assert.deepEqual(landscape, phone);
  assert.equal(desktop.mobile, false); assert.equal(alternate.mobile, false);
  assert.equal(phone.dpr, 1.25); assert.equal(desktop.dpr, 1.65);
  assert.equal(select({ active: true, width: 320 }).mobile, true);
  console.log('PASS phone, landscape, narrow viewport, desktop and alternate-page budget selection');

  const main = read('js/main.js'), glass = read('js/water-logo-reference-glass.js');
  const build = require(path.join(base, 'mobile-performance-build.cjs'));
  assert.equal(build.patchMain(main), main); assert.equal(build.patchGlass(glass), glass);
  assert.ok(main.includes(':not([data-opening-refinement])'));
  assert.equal((main.match(/Math\.min\(devicePixelRatio, mobileRenderBudget\.dpr\)/g) || []).length, 2);
  const dpr = new Function('devicePixelRatio', 'mobileRenderBudget', 'return ' + main.match(/Math\.min\(devicePixelRatio, mobileRenderBudget\.dpr\)/)[0]);
  assert.equal(dpr(3, phone), 1.25); assert.equal(dpr(1, phone), 1); assert.equal(dpr(3, desktop), 1.65);
  const scene = main.match(/samples: ([^\n]+)/)[1];
  assert.equal(new Function('mobileRenderBudget', 'return ' + scene)(phone), 0);
  assert.equal(new Function('mobileRenderBudget', 'return ' + scene)(desktop), 4);
  const shadow = main.match(/renderer\.shadowMap\.enabled = [^;]+;/)[0];
  const bloom = main.match(/bloom\.enabled = [^;]+;/)[0];
  const checkPass = new Function('mobileRenderBudget', 'const renderer={shadowMap:{}},bloom={};' + shadow + bloom + 'return [renderer.shadowMap.enabled,bloom.enabled];');
  assert.deepEqual(checkPass(phone), [false, false]); assert.deepEqual(checkPass(desktop), [true, true]);
  assert.equal(phone.reflectionSize ** 2 / desktop.reflectionSize ** 2, .25);
  assert.ok(main.indexOf('c.rgb=fiGrade(c.rgb);') < main.indexOf('#if MOBILE_RENDER == 0'));
  assert.ok(main.includes('#endif\n      gl_FragColor=c;'));
  console.log('PASS persistent initial/resize DPR, MSAA, shadow, reflection and postprocess execution decisions');

  const samplesLine = glass.match(/const samples=[^;]+;/)[0];
  const samples = new Function('mobile', 'config', 'THREE', samplesLine + 'return samples;');
  const THREE = { MathUtils: { clamp: (n, a, b) => Math.min(b, Math.max(a, n)) } };
  for (const edited of [4, 8, 12, 99]) assert.equal(samples(true, { samples: edited }, THREE), 4);
  assert.equal(samples(false, { samples: 8 }, THREE), 8);
  const initial = glass.match(/defines:\{SAMPLES:([^}]+)\}/)[1];
  assert.equal(new Function('mobile', 'config', 'return ' + initial)(true, { samples: 12 }), 4);
  const dimensions = [];
  const makeResize = new Function('mobile', 'target', extract(glass, 'function resize(') + ';return resize;');
  makeResize(true, { setSize: (...size) => dimensions.push(size) })(390, 844, 3);
  makeResize(false, { setSize: (...size) => dimensions.push(size) })(390, 844, 3);
  assert.deepEqual(dimensions[0], [293, 633]); assert.deepEqual(dimensions[1], [448, 971]);
  console.log('PASS optical samples survive CONFIG edits; smaller phone capture keeps desktop unchanged');

  const frame = main.slice(main.indexOf('      function frame(manual, fixedDelta) {'));
  const prefix = frame.slice(frame.indexOf('{') + 1, frame.indexOf('        const scrollDt ='));
  const runPrefix = new Function('mobileRenderBudget', 'world', 'portfolio', 'manual', `
    let sceneStopped=false,resizeFrame=0,animationFrame=0,work=0,scheduled=0,drained=0;
    const document={hidden:false},clock={getDelta(){drained++;return .016;}},tick=()=>{},requestAnimationFrame=()=>++scheduled;
    const resize=()=>{},cancelAnimationFrame=()=>{};
    function frame(){${prefix}\n work++;}
    for(let i=0;i<60;i++)frame();return {work,scheduled,drained};`);
  assert.deepEqual(runPrefix(phone, { covering: true }, { open: true }, false), { work: 0, scheduled: 60, drained: 60 });
  assert.equal(runPrefix(phone, { covering: false }, { open: true }, false).work, 60);
  assert.equal(runPrefix(phone, { covering: true }, { open: false }, false).work, 60);
  assert.equal(runPrefix(phone, { covering: true }, { open: true }, true).work, 60);
  assert.equal(runPrefix(desktop, { covering: true }, { open: true }, false).work, 60);
  console.log('PASS covered phone scene suspends work, drains elapsed time and resumes on reverse/manual input');
  console.log('Estimated main offscreen pixel ratio: ' + ((phone.dpr / desktop.dpr) ** 2).toFixed(3) + ' of prior phone cap; not an FPS measurement.');
})().catch(error => { console.error(error); process.exitCode = 1; });
