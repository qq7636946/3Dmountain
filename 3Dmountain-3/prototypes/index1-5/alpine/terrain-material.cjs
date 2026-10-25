#!/usr/bin/env node
/* Alpine terrain & material patch — index1-5-alpine → index1-5 (2026-10-23).

   usage:  node terrain-material.cjs <js-dir> [--dry]
   e.g.    node prototypes/index1-5-alpine/patches/terrain-material.cjs prototypes/index1-5/js

   Applies anchored edits to the generated files in <js-dir>:
     water-canyon-watershed-463.js  load-time drainage erosion, 14-unit desktop grid, aAlpine + aAlpine2 attributes
     index1-5-terrain.js            installs the alpine terrain material (alpine-terrain-material.js), loads the maps
     water-journey-scene-463.js     builds / updates / disposes the canyon grass tufts (alpine-canyon-tufts.js)
   highland-material.js is NOT edited (listed so a run reports it).
   Every anchor must occur exactly once, or the run stops before writing anything. Line endings are
   detected and restored (CRLF-safe). A file already carrying the ALPINE-TERRAIN marker is skipped.

   New files to copy next to the patched ones (no query strings on their imports):
     js/alpine-terrain-params.js    ALPINE_TERRAIN dials + ALPINE_TERRAIN_ROWS (panel rows)
     js/alpine-erosion.js           priority-flood + stream-power + talus erosion on the baked grid
     js/alpine-terrain-material.js  rock / scree / snow / glacier / grass / forest shader (live uniforms)
   and the generated textures in images/alpine/:
     rock-1024.webp / rock-512.webp (mobile), scree-512.webp, snow-512.webp   tools/bake-alpine-textures.cjs
     erosion-height-512.png / -256.png (mobile), erosion-normal-1024.webp     tools/bake-erosion-detail.cjs
     tuft-atlas.webp (canyon grass clumps, 512 x 256 RGBA data, ~29 KB)    tools/bake-tuft-atlas.cjs
   and js/alpine-canyon-tufts.js (instanced canyon grass clumps; the journey hook below builds / updates it).
   The erosion tiles are derived from "Snowy Mountain V2 - Terrain" by artfromheath (Sketchfab), CC BY 4.0 —
   keep the credit wherever the site lists its 3D sources. */
'use strict';
const fs = require('fs'), path = require('path');
const MARK = 'ALPINE-TERRAIN';

// Each edit: { find, replace } (exact, once) or { afterLineWith, insert } (insert after the line containing it).
const PATCHES = {
  'water-canyon-watershed-463.js': [
    { afterLineWith: 'export { WATERSHED_FLOW_DEFAULTS } from',
      insert: `// ${MARK} (index1-5-alpine 2026-10-23): load-time drainage erosion and the alpine dials.
import { ALPINE_TERRAIN } from './alpine-terrain-params.js';
import { erodeAlpineGrid, alpineRange } from './alpine-erosion.js';
` },
    { find: 'const LG=refined&&!!R&&!!logoTerrain?.enabled;',
      replace: `const LG=refined&&!!R&&!!logoTerrain?.enabled;
  // ${MARK}: desktop core grid 14 units by default (meshDetail 1.3; 1 = 20, .8 = the old 24). Mobile keeps 36.
  const ALPINE_ON=!!R&&!LG,CORE_DX=lite?36:ALPINE_ON?Math.round(24-(Math.max(.8,Math.min(1.5,Number(ALPINE_TERRAIN.meshDetail)||1))-.8)*20):24;` },
    { find: 'const gridSpacingAt=(x,z)=>Math.abs(x)>=3200||z>1800?135:z>=-7000?(lite?36:24):',
      replace: 'const gridSpacingAt=(x,z)=>Math.abs(x)>=3200||z>1800?135:z>=-7000?CORE_DX:' },
    { find: 'const spacing=lite?36:24;', replace: 'const spacing=CORE_DX;' },
    // The ground between the named massifs becomes a continuous ridge net (alpine-erosion.js alpineRange).
    { find: '    return LG?logoMass(x,z,mass):mass;',
      replace: '    return LG?logoMass(x,z,mass):ALPINE_ON?alpineRange(wx,wz,mass,spacing,Number(ALPINE_TERRAIN.range)||0):mass;' },
    { find: 'const stride=R?13:10;', replace: `const stride=R?14:10; // ${MARK}: channel 13 = the erosion's height change` },
    { find: 'return lerp(lerp(hillside,samples[offset+7],samples[offset+8]),mass,samples[offset+9]);',
      replace: 'return lerp(lerp(hillside,samples[offset+7],samples[offset+8]),mass,samples[offset+9])+(R?samples[offset+13]||0:0);' },
    { find: 'function sampleHeight(x,z,channels=channelsAt(z)){return heightFromSample(makeHeightSample(x,z,channels));}',
      replace: `function sampleHeight(x,z,channels=channelsAt(z)){return heightFromSample(makeHeightSample(x,z,channels))+alpineDeltaAt(x,z);}
  // ${MARK}: the erosion's height change at (x,z), bilinear on the grid (0 before it has run).
  let alpine=null;
  function alpineDeltaAt(x,z){
    if(!alpine)return 0;
    const W=xs.length,bs=(arr,v,desc)=>{let a=0,b=arr.length-1;if(desc?v>=arr[0]:v<=arr[0])return[0,0,0];if(desc?v<=arr[b]:v>=arr[b])return[b,b,0];while(b-a>1){const m=(a+b)>>1;if(desc?arr[m]>v:arr[m]<v)a=m;else b=m;}return[a,b,(v-arr[a])/(arr[b]-arr[a])];};
    const [a,b,u]=bs(xs,x,false),[c,d,t]=bs(zs,z,true),D=(i,j)=>alpine.delta[i*W+j];
    return lerp(lerp(D(c,a),D(c,b),u),lerp(D(d,a),D(d,b),u),t);
  }` },
    { find: '  // Triangulation. Near ground keeps the alternating diagonals.',
      replace: `  // ${MARK}: drainage erosion on the baked grid (alpine-erosion.js). A node is eroded as far as its
  // height is mountain mass (d height / d mass: 0 on river beds, banks and the canyon's support), so
  // the beds, banks and the camera route stay exactly where they were; the rivers are the base level.
  if(ALPINE_ON&&heightSamples){
    const N=xs.length*zs.length,hgt=new Float64Array(N),wgt=new Float32Array(N);
    for(let k=0;k<N;k++){const o=k*stride;hgt[k]=positions[k*3+1];wgt[k]=clamp((1-heightSamples[o+9])*(1-heightSamples[o+8])*heightSamples[o+4]+heightSamples[o+9]);}
    const result=yield* erodeAlpineGrid({xs,zs,height:hgt,weight:wgt,lite,erosion:Number(ALPINE_TERRAIN.erosion)||0,ridgeSharp:Number(ALPINE_TERRAIN.ridgeSharp)||0,relief:Number(ALPINE_TERRAIN.relief)||0,fine:Number(ALPINE_TERRAIN.fineErosion??1)||0});
    sliceStart=performance.now();maxHeight=0;
    for(let k=0;k<N;k++){heightSamples[k*stride+13]=result.delta[k];const y=positions[k*3+1]+result.delta[k];positions[k*3+1]=y;maxHeight=Math.max(maxHeight,y);}
    alpine=result;
  }
  // Triangulation. Near ground keeps the alternating diagonals.` },
    { find: "geo.setAttribute('terrainAO',new THREE.BufferAttribute(terrainAO,1));",
      replace: `geo.setAttribute('terrainAO',new THREE.BufferAttribute(terrainAO,1));
  // ${MARK}: per-vertex (drainage, wide drainage, scree, rib) for the alpine material.
  if(alpine){const n=positions.length/3,a=new Float32Array(n*4);for(let k=0;k<n;k++){a[k*4]=alpine.flow[k];a[k*4+1]=alpine.flowWide[k];a[k*4+2]=alpine.scree[k];a[k*4+3]=alpine.rib[k];}geo.setAttribute('aAlpine',new THREE.BufferAttribute(a,4));
    const b=new Float32Array(n*2);for(let k=0;k<n;k++){b[k*2]=alpine.relH[k];b[k*2+1]=alpine.vshade[k];}geo.setAttribute('aAlpine2',new THREE.BufferAttribute(b,2));}` },
    { find: 'ref=lite?36:24;', replace: 'ref=CORE_DX;' },
    // Bank slabs sit on the eroded ground (sample[13] carries the change through later slider edits).
    { find: 'sample=makeHeightSample(x,z),y=heightFromSample(sample);',
      replace: 'sample=makeHeightSample(x,z),y=(sample[13]=alpineDeltaAt(x,z),heightFromSample(sample));' },
    { find: 'if(R)stats.reliefBuildMs=Math.round(performance.now()-buildStart);',
      replace: 'if(R)stats.reliefBuildMs=Math.round(performance.now()-buildStart);\n  if(alpine)stats.alpine={erosionMs:alpine.ms,iterations:alpine.iterations,coreSpacing:CORE_DX,realDetail:alpine.realDetail};' }
  ],
  'index1-5-terrain.js': [
    // round 4: phones load 512 copies of the meadow photo (images/alpine/grass-*-512.webp)
    { find: `  load('grassColor',new URL('aerial_grass_rock-color-1024.webp',tex).href,true);
  load('grassNormal',new URL('aerial_grass_rock-normal-1024.webp',tex).href,false);`,
      replace: `  load('grassColor',lite?new URL('../../../images/alpine/grass-color-512.webp',import.meta.url).href:new URL('aerial_grass_rock-color-1024.webp',tex).href,true);
  load('grassNormal',lite?new URL('../../../images/alpine/grass-normal-512.webp',import.meta.url).href:new URL('aerial_grass_rock-normal-1024.webp',tex).href,false);` },
    { afterLineWith: "import { createTerrainMaterial } from './highland-material.js",
      insert: `// ${MARK} (index1-5-alpine 2026-10-23): the alpine material and the real-erosion detail tile.
import { installAlpineTerrain } from './alpine-terrain-material.js';
import { loadAlpineDetail } from './alpine-erosion.js';
` },
    { afterLineWith: "load('grassNormal',",
      insert: `  // ${MARK}: generated detail maps (tools/bake-alpine-textures.cjs, tools/bake-erosion-detail.cjs).
  const alp=new URL('../../../images/alpine/',import.meta.url);
  load('alpineRock',new URL('rock-'+(lite?512:1024)+'.webp',alp).href,false);
  load('alpineScree',new URL('scree-512.webp',alp).href,false);
  load('alpineSnow',new URL('snow-512.webp',alp).href,false);
  load('alpineErosion',new URL('erosion-normal-1024.webp',alp).href,false);
  load('alpineTuft',new URL('tuft-atlas.webp',alp).href,false);
  jobs.push(loadAlpineDetail(new URL('erosion-height-'+(lite?256:512)+'.png',alp).href));
` },
    { find: 'export function installIndex15Terrain(THREE,{rockMaterial,terrainMaterial,lite=false}){',
      replace: `// ${MARK}: the canyon rock and the watershed terrain take the alpine material; the highland one stays as a fallback.
export function installIndex15Terrain(THREE,{rockMaterial,terrainMaterial,lite=false}){
  return installAlpineTerrain(THREE,{rockMaterial,terrainMaterial,lite,maps:getSet(THREE,lite).maps});
}
export function installIndex15TerrainHighland(THREE,{rockMaterial,terrainMaterial,lite=false}){` }
  ],
  'highland-material.js': [],
  // round 5: canyon grass tufts (alpine-canyon-tufts.js) — built on the shore banks once their rims are laid
  // onto the watershed, updated with the journey (distance / aerial fade, wind), disposed with it.
  'water-journey-scene-463.js': [
    { afterLineWith: "import { createCanyonWatershedBuilder } from './water-canyon-watershed-463.js",
      insert: `import { createCanyonTufts } from './alpine-canyon-tufts.js';   // ${MARK}
` },
    { find: `  if (rimBlend) blendBankRims(watershed.terrainAt);
`,
      replace: `  if (rimBlend) blendBankRims(watershed.terrainAt);
  const canyonTufts=createCanyonTufts(THREE,{banks:shoreBankMeshes,curve,widthAt,lite});if(canyonTufts)scene.add(canyonTufts.mesh);   // ${MARK}
` },
    { find: "    followLights.update(t, time, reduceMotion, u, camera, scene.fog.density, innerHeight);",
      replace: `    canyonTufts?.update(camera,u,time,reduceMotion);
    followLights.update(t, time, reduceMotion, u, camera, scene.fog.density, innerHeight);` },
    { find: "    followLights.dispose();",
      replace: "    followLights.dispose();canyonTufts?.dispose();" }
  ]
};

function apply(src, edits, file) {
  const crlf = src.includes('\r\n');
  let s = crlf ? src.replace(/\r\n/g, '\n') : src;
  for (const e of edits) {
    const key = e.find ?? e.afterLineWith;
    const count = s.split(key).length - 1;
    if (count !== 1) throw new Error(`${file}: anchor found ${count}x (need exactly 1): ${key.slice(0, 90)}`);
    if (e.find !== undefined) s = s.replace(key, () => e.replace);
    else { const at = s.indexOf(key), eol = s.indexOf('\n', at); s = s.slice(0, eol + 1) + e.insert + s.slice(eol + 1); }
  }
  return crlf ? s.replace(/\n/g, '\r\n') : s;
}

module.exports = { PATCHES, apply, MARK };
if (require.main !== module) return;
const dir = process.argv[2], dry = process.argv.includes('--dry');
if (!dir) { console.error('usage: node terrain-material.cjs <js-dir> [--dry]'); process.exit(2); }
const out = {};
for (const [file, edits] of Object.entries(PATCHES)) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) throw new Error('missing ' + p);
  const src = fs.readFileSync(p, 'utf8');
  if (!edits.length) { console.log(`${file}: no edits`); continue; }
  if (src.includes(MARK)) { console.log(`${file}: already patched (${MARK} marker) — skipped`); continue; }
  out[p] = apply(src, edits, file);
  console.log(`${file}: ${edits.length} edits OK`);
}
if (!dry) for (const [p, s] of Object.entries(out)) fs.writeFileSync(p, s);
console.log(dry ? 'dry run: nothing written' : `written: ${Object.keys(out).length} file(s)`);
