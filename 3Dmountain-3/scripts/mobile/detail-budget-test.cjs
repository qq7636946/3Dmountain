/* Execute the source detail modules with local Three.js; no browser/WebGL. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '../..'), DIR = path.join(ROOT, 'prototypes/index1-5');
const read = name => fs.readFileSync(path.join(DIR, name), 'utf8').replace(/\r\n/g, '\n');
async function main() {
  global.innerWidth = 390; global.innerHeight = 844;
  let mainPage = true;
  global.document = { documentElement: { matches(selector) {
    assert.equal(selector, '[data-look="index1-5"]:not([data-opening-refinement])'); return mainPage;
  } } };
  const threeUrl = pathToFileURL(path.join(ROOT, 'prototypes/sweet-potato-study-20261022/vendor/three.module.js')).href;
  const THREE = await import(threeUrl);
  const load = name => import('data:text/javascript;base64,' + Buffer.from(read(name).replace("from 'three'", 'from ' + JSON.stringify(threeUrl)) + '\n//# sourceURL=mobile-detail-' + name).toString('base64'));
  const { createLightSpecks } = await load('light-specks.js');
  const { createOpeningLungeBlur } = await load('opening-lunge-blur.js');
  const stripHeader = s => s.replace(/^\/\* index1-5 generated[^\n]*\*\/\n/, '');
  for (const file of ['light-specks.js', 'opening-lunge-blur.js']) assert.equal(stripHeader(read('js/' + file)), read(file));
  const built = require('../../prototypes/index1-5/mobile-detail-build.cjs')({ main: 'UNCHANGED', extra: { other: 'keep' } });
  assert.equal(built.main, 'UNCHANGED'); assert.equal(built.extra.other, 'keep');
  assert.equal(built.extra['light-specks.js'], fs.readFileSync(path.join(DIR, 'light-specks.js'), 'utf8'));

  const camera = new THREE.PerspectiveCamera(50, 390 / 844, .1, 100);
  camera.position.z = 10; camera.updateMatrixWorld();
  const oldGeometry = new THREE.BufferGeometry(), oldMaterial = new THREE.ShaderMaterial();
  let disposedGeometry = 0, disposedMaterial = 0;
  oldGeometry.addEventListener('dispose', () => disposedGeometry++); oldMaterial.addEventListener('dispose', () => disposedMaterial++);
  const oldPoints = new THREE.Points(oldGeometry, oldMaterial), config = {};
  const specks = createLightSpecks({ points: oldPoints, small: true, getConfig: () => config });
  specks.update({ time: 0, camera, width: 390, height: 844 });
  assert.equal(disposedGeometry, 1); assert.equal(disposedMaterial, 1);
  assert.equal(specks.state.capacity, 320); assert.equal(specks.state.layers, 1);
  assert.equal(specks.state.sprites, 141); assert.equal(specks.points.geometry.attributes.position.count, 320);
  const bytes = Object.values(specks.points.geometry.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0);
  assert.equal(bytes, 10240); assert.ok(specks.points.geometry.attributes.aLayer.array.every(layer => layer === 0));
  config.count = 1e9; specks.update({ time: .016, camera }); assert.equal(specks.state.sprites, 320);
  config.enabled = 0; specks.update({ time: .032, camera }); assert.equal(specks.state.sprites, 0); assert.equal(specks.points.visible, false);
  config.enabled = 1; config.opacity = 0; specks.update({ time: .048, camera }); assert.equal(specks.state.sprites, 0);
  config.opacity = 1; specks.update({ time: .064, opacity: 0, camera }); assert.equal(specks.state.sprites, 0);
  specks.dispose();
  const lake = createLightSpecks({ small: true, mode: 'lake' }); lake.update({ time: 0, camera }); assert.equal(lake.state.sprites, 113); lake.dispose();
  const desktop = createLightSpecks({ small: false }); desktop.update({ time: 0, camera });
  assert.equal(desktop.state.capacity, 2200); assert.equal(desktop.state.layers, 2); assert.equal(desktop.state.sprites, 1280); desktop.dispose();
  mainPage = false;
  const refinement = createLightSpecks({ small: true }); refinement.update({ time: 0, camera });
  assert.equal(refinement.state.phoneBudget, false); assert.equal(refinement.state.capacity, 1000);
  assert.equal(refinement.state.layers, 2); assert.equal(refinement.state.sprites, 614);
  assert.equal(Object.values(refinement.points.geometry.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0), 64000); refinement.dispose();
  const refinementLake = createLightSpecks({ small: true, mode: 'lake' }); refinementLake.update({ time: 0, camera }); assert.equal(refinementLake.state.sprites, 492); refinementLake.dispose();
  mainPage = true;
  console.log('PASS phone specks: 10,240-byte geometry/320 allocated vertices/141 default sprites; disabled drawRange=0; desktop and old-buffer disposal preserved');
  console.log('PASS refinement-page no downgrade: 1,000-capacity dual layers, 64,000-byte geometry, 614 opening/492 lake sprites');

  function makePass() { return { uniforms: {}, material: { defines: {}, fragmentShader: '    void main(){\nvec4 c=texture2D(tDiffuse,vUv);\n}', needsUpdate: false } }; }
  const pass = makePass(), options = {}, hero = new THREE.Group();
  const blur = createOpeningLungeBlur({ pass, camera, small: true, getConfig: () => options });
  assert.equal(pass.material.defines.LUNGE_TAPS, 3); assert.equal(pass.material.defines.LUNGE_MASKS, 3);
  assert.match(pass.material.fragmentShader, /uLungeBounds\[LUNGE_MASKS\]/); assert.match(pass.material.fragmentShader, /i<LUNGE_MASKS/);
  assert.equal(pass.uniforms.uLungeBounds.value.length, 3); assert.equal(blur.state.recordCapacity, 33);
  blur.update({ dt: .016, stage: .4, velocity: .5, hero, width: 390, height: 844 });
  hero.position.x = .5; blur.update({ dt: .016, stage: .4, velocity: .5, hero, width: 390, height: 844 });
  assert.equal(blur.state.count, 1); assert.ok(blur.state.maxMotionPixels > 0); assert.ok(pass.uniforms.uLungeMotion.value[0].x > 0);
  options.enabled = 0;
  const forbiddenSecondary = { get group() { throw Error('Disabled blur touched hierarchy'); } };
  blur.update({ dt: .016, stage: .4, velocity: .5, secondary: forbiddenSecondary });
  assert.equal(blur.state.count, 0);
  for (let i = 0; i < 8; i++) blur.update({ dt: .016, stage: .4, velocity: .5, secondary: forbiddenSecondary });
  assert.doesNotMatch(createOpeningLungeBlur.toString().match(/function clear\(\)\{[^\n]+/)[0], /for\s*\(/);
  options.enabled = 1; hero.position.x = -.5;
  blur.update({ dt: .016, stage: .4, velocity: .5, hero, width: 390, height: 844 });
  assert.equal(blur.state.count, 0, 'Reenabled history starts clean without a stale streak');
  hero.position.x = -.3; blur.update({ dt: .016, stage: .4, velocity: .5, hero, width: 390, height: 844 });
  assert.equal(blur.state.count, 1);
  console.log('PASS phone lunge: 3 masks/3 taps/33 records, hero direction retained, disabled path no hierarchy or record loop, clean reenable');

  for (const profile of [
    { small: true, main: true, budget: true, first: 8, secondary: 24, masks: 3, shaderMasks: 3, taps: 3, records: 33 },
    { small: true, main: false, budget: false, first: 24, secondary: 128, masks: 6, shaderMasks: 8, taps: 5, records: 153 },
    { small: false, main: true, budget: false, first: 24, secondary: 128, masks: 8, shaderMasks: 8, taps: 8, records: 153 }
  ]) {
    const { small } = profile; mainPage = profile.main;
    const group = new THREE.Group(), meshes = [], matrixUpdates = [];
    const geometry = new THREE.BufferGeometry(), material = new THREE.ShaderMaterial({ uniforms: { uOpacity: { value: 1 }, uBlurOn: { value: 0 } } });
    for (let i = 0; i < 128; i++) {
      const drop = new THREE.Mesh(geometry, material); drop.position.x = (i % 8 - 3.5) * .1;
      const update = drop.updateWorldMatrix.bind(drop); drop.updateWorldMatrix = (...args) => { matrixUpdates.push(i); return update(...args); };
      group.add(drop); meshes.push(drop);
    }
    const localPass = makePass(), localBlur = createOpeningLungeBlur({ pass: localPass, camera, small, getConfig: () => ({ maxPixels: 1e9, maskCount: 1e9 }) });
    localBlur.update({ dt: .016, velocity: .5, secondary: { group, meshes }, width: 390, height: 844 });
    assert.equal(matrixUpdates.length, profile.secondary);
    assert.ok(matrixUpdates.every(i => i < profile.secondary));
    matrixUpdates.length = 0; group.position.x = .3;
    localBlur.update({ dt: .016, velocity: .5, secondary: { group, meshes }, width: 390, height: 844 });
    assert.equal(localBlur.state.phoneBudget, profile.budget);
    assert.equal(localBlur.state.count, profile.masks); assert.equal(localBlur.state.spiralCount, profile.masks);
    assert.equal(localBlur.state.samples, profile.taps); assert.equal(localBlur.state.recordCapacity, profile.records);
    assert.equal(localPass.material.defines.LUNGE_TAPS, profile.taps); assert.equal(localPass.material.defines.LUNGE_MASKS, profile.shaderMasks);
    assert.equal(localPass.uniforms.uLungeLimit.value, small ? 26 : 48);
    assert.ok(localBlur.state.maxMotionPixels <= (small ? 26 : 48));
    const instanceGeometry = new THREE.BufferGeometry(); instanceGeometry.setAttribute('instanceExtra', new THREE.InstancedBufferAttribute(new Float32Array(128 * 3).fill(1), 3));
    const instances = new THREE.InstancedMesh(instanceGeometry, material, 128); let firstReads = 0;
    for (let i = 0; i < 128; i++) instances.setMatrixAt(i, new THREE.Matrix4());
    const getMatrixAt = instances.getMatrixAt.bind(instances); instances.getMatrixAt = (...args) => { firstReads++; return getMatrixAt(...args); };
    localBlur.update({ dt: .016, stage: .4, velocity: .5, mesh: instances, width: 390, height: 844 });
    assert.equal(firstReads, profile.first);
    instances.geometry.dispose(); geometry.dispose(); material.dispose();
  }
  console.log('PASS main phone scans 8/24 transforms with 3 taps; refinement retains 24/128, 6 active masks, 153 records, 5 taps; desktop unchanged; CONFIG cannot exceed phone caps');
  console.log('All mobile detail budget checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
