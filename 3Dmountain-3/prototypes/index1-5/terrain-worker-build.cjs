/* index1-5 optimisation 2026-11-03, stream "terrain worker" (客戶：「Web Worker 那個也幫我做」). The terrain grid (the massifs' macro field and
   the per-vertex height samples: ~4 s of the ~8 s to ready on the RTX test machine) is computed by 2–3 module workers that start as soon
   as the settings are final, while the page builds everything else; the builder then takes their rows and goes on to the erosion, which
   needs the whole grid. Same code, same inputs: the terrain is the same bit for bit (QA: terrain-hash probe). Files: terrain-workers.js (the
   page's side), terrain-worker.js (the worker). Off without a rebuild: ?terrainworker=0. Remove: drop this name from build.cjs's perf list.
     watershed  TERRAIN_WORKER: import mode (take the rows, skip the macro field and the grid loop) and rows mode (compute only rows [r0, r1),
                plus one row either side of the macro field, hand them over, stop).
     journey    createJourneySceneAsync awaits a promise the builder yields (it waits for the workers without spinning).
     main       starts the workers after the saved landscape is applied; checks the settings key again just before the scene is built.
   Runs in build.cjs's perf loop (it is handed `watershed` and `journey`); a missing anchor skips the whole stream with a warning. */
'use strict';
const fs = require('fs'), path = require('path');
const log = (...a) => console.log('terrain-worker:', ...a);
function must(s, a, b) {
  const c = s.split(a).length - 1;
  if (c !== 1) throw new Error(`anchor found ${c}x: ${a.slice(0, 90)}`);
  return s.replace(a, () => b);
}
function patchWatershed(s) {
  s = must(s, '  const logoInkW=LG?new Float32Array(xs.length*zs.length):null;', `  const logoInkW=LG?new Float32Array(xs.length*zs.length):null;
  /* TERRAIN_WORKER (terrain-worker-build.cjs): the grid's rows from the page's terrain workers; inside a worker, only that worker's rows */
  const TB=globalThis.__TERRAIN_BAKE__||null,TB_N=xs.length*zs.length,TB_S=heightSamples?stride:0;
  const TB_ROWS=TB&&TB.mode==='rows'?[Math.floor(TB.split[0]*zs.length/TB.split[1]),Math.floor((TB.split[0]+1)*zs.length/TB.split[1])]:null;
  let TB_TOOK=false;
  TB?.mark?.('grid');
  if(TB&&TB.mode==='import'){
    while(TB.state==='pending')yield TB.promise;
    const parts=TB.state==='ready'?TB.parts:null,W=xs.length;
    if(parts&&parts.length&&parts[0].r0===0&&parts.at(-1).r1===zs.length&&parts.every((p,i)=>p.N===TB_N&&p.stride===TB_S&&(i===0||p.r0===parts[i-1].r1)&&p.positions.length===(p.r1-p.r0)*W*3)){
      for(const p of parts){positions.set(p.positions,p.r0*W*3);colors.set(p.colors,p.r0*W*3);if(heightSamples)heightSamples.set(p.heightSamples,p.r0*W*stride);if(logoInkW)logoInkW.set(p.logoInkW,p.r0*W);maxHeight=Math.max(maxHeight,p.maxHeight);}
      TB_TOOK=true;
    }else if(TB.state==='ready')TB.why='the rows did not fit this grid';
    TB.used=TB_TOOK;TB.parts=[];
  }`);
  s = must(s, '  if(R){\n    macroGrid=new Array(xs.length*zs.length);\n    for(let i=0;i<zs.length;i++){',
    '  if(R&&!TB_TOOK){\n    macroGrid=new Array(xs.length*zs.length);\n    for(let i=TB_ROWS?Math.max(0,TB_ROWS[0]-1):0,iEnd=TB_ROWS?Math.min(zs.length,TB_ROWS[1]+1):zs.length;i<iEnd;i++){');
  s = must(s, '  for(let i=0;i<zs.length;i++){const z=zs[i],channels=channelsAt(z);for(let j=0;j<xs.length;j++){const x=xs[j],sample=makeHeightSample(x,z,channels,preAt(i,j))',
    '  if(!TB_TOOK)for(let i=TB_ROWS?TB_ROWS[0]:0,iEnd=TB_ROWS?TB_ROWS[1]:zs.length;i<iEnd;i++){const z=zs[i],channels=channelsAt(z);for(let j=0;j<xs.length;j++){const x=xs[j],sample=makeHeightSample(x,z,channels,preAt(i,j))');
  s = must(s, '  // ALPINE-TERRAIN: drainage erosion on the baked grid (alpine-erosion.js). A node is eroded as far as its',
    `  if(TB_ROWS){const W=xs.length,[r0,r1]=TB_ROWS;TB.post({N:TB_N,stride:TB_S,r0,r1,maxHeight,positions:positions.slice(r0*W*3,r1*W*3),colors:colors.slice(r0*W*3,r1*W*3),heightSamples:heightSamples?heightSamples.slice(r0*W*stride,r1*W*stride):null,logoInkW:logoInkW?logoInkW.slice(r0*W,r1*W):null});throw TB.STOP;}   /* TERRAIN_WORKER: a worker's share ends here */
  // ALPINE-TERRAIN: drainage erosion on the baked grid (alpine-erosion.js). A node is eroded as far as its`);
  return s;
}
function patchJourney(s) {
  return must(s, '    if(globalThis.scheduler?.yield)await globalThis.scheduler.yield();\n    else await new Promise(resolve=>setTimeout(resolve,0));',
    "    if(step.value&&typeof step.value.then==='function')await step.value;   /* TERRAIN_WORKER: the builder waits for the terrain workers */\n    else if(globalThis.scheduler?.yield)await globalThis.scheduler.yield();\n    else await new Promise(resolve=>setTimeout(resolve,0));");
}
// Run whole-grid erosion and the first mesh's derived geometry in workers on Flow2 only.
function patchErosionWatershed(s) {
  const alpineImport = /^import \{ erodeAlpineGrid, alpineRange \} from '\.\/alpine-erosion\.js(\?v=[^']+)?';$/m.exec(s);
  if (!alpineImport) throw new Error('missing alpine erosion import');
  const version = alpineImport[1] || '';
  s = must(s, alpineImport[0], alpineImport[0].replace('alpineRange }', 'alpineRange, getAlpineDetailSnapshot }') +
    "\nimport { runAlpineErosionWorker, runTerrainGeometryWorker } from './terrain-workers.js" + version + "';");
  s = must(s, 'mainOverlap=null,relief=null,logoTerrain=null}) {', 'mainOverlap=null,relief=null,logoTerrain=null,erosionInWorker=false,geometryInWorker=false}) {');
  s = must(s, '  let alpine=null;', '  let alpine=null;\n  let erosionWorkerUsed=false;');
  const call = /^    const result=yield\* erodeAlpineGrid\((\{[^\n]+\})\);$/m.exec(s);
  if (!call) throw new Error('missing alpine erosion calculation');
  s = must(s, call[0], [
    '    const erosionInput=' + call[1] + ';',
    '    let result;',
    '    if(erosionInWorker){',
    '      yield runAlpineErosionWorker(erosionInput,getAlpineDetailSnapshot()).then(value => { result=value; });',
    '      erosionWorkerUsed=Boolean(result);',
    '    }',
    '    if(!result)result=yield* erodeAlpineGrid(erosionInput);',
  ].join('\n'));
  const mesh = "  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();ownedGeometries.push(geo);";
  s = must(s, mesh, [
    '  const geo = new THREE.BufferGeometry();',
    "  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));",
    "  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));",
    '  geo.setIndex(indices);',
    '  let geometryResult;',
    '  if (geometryInWorker) {',
    '    yield runTerrainGeometryWorker(positions, geo.index.array).then(result => { geometryResult = result; });',
    '  }',
    '  if (geometryResult) {',
    '    const normal = new THREE.BufferAttribute(geometryResult.normals, 3);',
    '    normal.needsUpdate = true;',
    "    geo.setAttribute('normal', normal);",
    '    geo.boundingBox = new THREE.Box3(',
    '      new THREE.Vector3().fromArray(geometryResult.boxMin),',
    '      new THREE.Vector3().fromArray(geometryResult.boxMax)',
    '    );',
    '    geo.boundingSphere = new THREE.Sphere(',
    '      new THREE.Vector3().fromArray(geometryResult.sphereCenter), geometryResult.sphereRadius',
    '    );',
    '  } else {',
    '    geo.computeVertexNormals();',
    '    geo.computeBoundingBox();',
    '    geo.computeBoundingSphere();',
    '  }',
    '  ownedGeometries.push(geo);'
  ].join('\n'));
  const stats = '  if(alpine)stats.alpine={erosionMs:alpine.ms,iterations:alpine.iterations,coreSpacing:CORE_DX,realDetail:alpine.realDetail};';
  return must(s, stats, stats + '\n  if(alpine&&erosionInWorker)stats.alpine.worker=erosionWorkerUsed;');
}
function patchErosionJourney(s) {
  const start = '  const builder=buildJourneyScene(THREE,options);\n  let step=builder.next();\n  while(!step.done){';
  s = must(s, start, [
    "  const erosionInWorker = globalThis.document?.documentElement.hasAttribute('data-flow2-aphelion')",
    "    && typeof Worker === 'function' && new URLSearchParams(globalThis.location?.search).get('terrainworker') !== '0';",
    '  const builder=buildJourneyScene(THREE,erosionInWorker',
    "    ? { ...options, erosionInWorker, geometryInWorker: THREE.REVISION === '170' }",
    '    : options);',
    '  let step=builder.next();',
    '  while(!step.done){',
  ].join('\n'));
  s = must(s, 'logoTerrain = null, lite = typeof innerWidth', 'logoTerrain = null, erosionInWorker = false, geometryInWorker = false, lite = typeof innerWidth');
  return must(s, 'rockDark,rockPale,flowConfig,terrainConfig};', 'rockDark,rockPale,flowConfig,terrainConfig,erosionInWorker,geometryInWorker};');
}
function patchMain(s) {
  s = must(s, "    import { createQualityGovernor } from './quality-governor.js';   /* QUALITY_GOVERNOR */",
    "    import { createQualityGovernor } from './quality-governor.js';   /* QUALITY_GOVERNOR */\n    import { startTerrainWorkers } from './terrain-workers.js';   /* TERRAIN_WORKER */");
  s = must(s, '      const dropSDF = true;\n', `      const dropSDF = true;
      /* TERRAIN_WORKER (terrain-workers.js): the terrain grid is computed by workers while this thread builds the rest; the settings are final here */
      const terrainOptions = () => ({ watershedStyle: CONFIG.watershedStyle, flowConfig: CONFIG.watershedFlow, terrainConfig: CONFIG.watershedTerrain, shoreConfig: CONFIG.shoreline, viewConfig: CONFIG.canyonView, reliefConfig: CONFIG.relief, logoTerrain: CONFIG.logoTerrain, lite: DROPLET_LITE });
      const terrainKey = () => JSON.stringify([terrainOptions(), ALPINE_TERRAIN]);
      const terrainBake = startTerrainWorkers({ options: terrainOptions(), alpine: ALPINE_TERRAIN, key: terrainKey() });
`);
  s = must(s, '      const canyon = await createJourneySceneAsync(THREE, { watershedStyle: CONFIG.watershedStyle,',
    '      terrainBake.check?.(terrainKey());   /* TERRAIN_WORKER: settings changed since the workers started → the builder computes the grid itself */\n      const canyon = await createJourneySceneAsync(THREE, { watershedStyle: CONFIG.watershedStyle,');
  return s;
}
module.exports = state => {
  if (state.main.includes('/* TERRAIN_WORKER */')) return state;
  try {
    const out = { ...state, watershed: patchErosionWatershed(patchWatershed(state.watershed)), journey: patchErosionJourney(patchJourney(state.journey)), main: patchMain(state.main),
      extra: { ...state.extra, 'terrain-workers.js': fs.readFileSync(path.join(__dirname, 'terrain-workers.js'), 'utf8').replace(/\r\n/g, '\n'), 'terrain-worker.js': fs.readFileSync(path.join(__dirname, 'terrain-worker.js'), 'utf8').replace(/\r\n/g, '\n'),
        'alpine-erosion-worker.js': fs.readFileSync(path.join(__dirname, 'alpine-erosion-worker.js'), 'utf8').replace(/\r\n/g, '\n'),
        'terrain-geometry-worker.js': fs.readFileSync(path.join(__dirname, 'terrain-geometry-worker.js'), 'utf8').replace(/\r\n/g, '\n') } };
    log('applied (watershed, journey, main, 4 modules)');
    return out;
  } catch (e) { log('STREAM SKIPPED —', e.message); return state; }
};
