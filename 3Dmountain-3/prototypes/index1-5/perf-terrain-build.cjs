/* index1-5 optimisation 2026-11-03, stream "terrain" (客戶：「第一階段全做加第 5 項」). Boot time: the terrain is computed on the main thread at
   every load (~6.5 s of the 8 s to ready on the RTX test machine, 32 s with the CPU 4x slower). Same numbers, less work; nothing is
   approximated, so the terrain is the same to the last bit:
     massif-bins   reliefMass / massifSample visited every massif (~150) for every sample and skipped all but a few on a box test
                   (|dx|,|dz| > 4.3 radii). The massifs are binned once by that box (padded by 1 unit); a sample visits its bin's list,
                   which holds every massif that can pass the test, in the original order, and the test itself is kept.
     hypot-table   alpine-erosion.js's distTo() called Math.hypot for every node × neighbour × pass; a step's length depends only on the
                   column's and the row's spacing, of which a grid has a handful: the same Math.hypot values, looked up.
   Runs in build.cjs's perf loop (it is handed `watershed`); an item whose anchor is missing is skipped with a warning. */
'use strict';
const log = (...a) => console.log('perf-terrain:', ...a);
function must(s, a, b, n = 1) {
  const c = s.split(a).length - 1;
  if (c !== n) throw new Error(`anchor found ${c}x (want ${n}): ${a.slice(0, 80)}`);
  return s.split(a).join(b);
}
function item(name, fn) { try { const out = fn(); log('applied', name); return out; } catch (e) { log('ITEM SKIPPED', name, '—', e.message); return null; } }

function patchWatershed(s) {
  if (s.includes('/* PERF_TERRAIN */')) return s;
  return item('massif-bins', () => {
    let t = must(s, '  const smoothMax=(a,b,k)=>{const h=Math.max(0,k-Math.abs(a-b))/k;return Math.max(a,b)+h*h*k*.25;};',
      `  const smoothMax=(a,b,k)=>{const h=Math.max(0,k-Math.abs(a-b))/k;return Math.max(a,b)+h*h*k*.25;};
  /* PERF_TERRAIN massif-bins (perf-terrain-build.cjs): the massifs that can pass the 4.3-radius box test at (wx,wz), in their own order */
  const MASSIF_BIN=480,NO_MASSIFS=[];let massifBins=null,massifBinsFor=-1;
  const massifsNear=(wx,wz)=>{
    if(massifBinsFor!==massifs.length){massifBins=new Map();massifBinsFor=massifs.length;
      for(const p of massifs){const r=4.3*p.radius+1,x0=Math.floor((p.x-r)/MASSIF_BIN),x1=Math.floor((p.x+r)/MASSIF_BIN),z0=Math.floor((p.z-r)/MASSIF_BIN),z1=Math.floor((p.z+r)/MASSIF_BIN);
        for(let a=x0;a<=x1;a++)for(let b=z0;b<=z1;b++){const k=a*65536+b;let l=massifBins.get(k);if(!l)massifBins.set(k,l=[]);l.push(p);}}}
    return massifBins.get(Math.floor(wx/MASSIF_BIN)*65536+Math.floor(wz/MASSIF_BIN))||NO_MASSIFS;
  };`);
    const loop = '    let mass=48;\n    for(const p of massifs){\n      const dx=(wx-p.x)/p.radius,dz=(wz-p.z)/p.radius;\n      if(Math.abs(dx)>4.3||Math.abs(dz)>4.3)continue;';
    t = must(t, loop, loop.replace('for(const p of massifs){', 'for(const p of massifsNear(wx,wz)){'), 2);
    return t;
  }) || s;
}
function patchErosion(s) {
  if (!s || s.includes('/* PERF_TERRAIN */')) return s;
  return item('hypot-table', () => must(s, '  const distTo = (i, j, n) => Math.hypot(xs[j + DJ[n]] - xs[j], zs[i + DI[n]] - zs[i]);',
    `  /* PERF_TERRAIN hypot-table (perf-terrain-build.cjs): the same Math.hypot values, looked up (a step only depends on the column's and the row's spacing) */
  const stepIds = (vals, len, D) => { const ids = new Int32Array(len * 8), seen = new Map(), list = []; for (let a = 0; a < len; a++) for (let n = 0; n < 8; n++) { const v = vals[a + D[n]] - vals[a]; let id = seen.get(v); if (id === undefined) { id = list.length; seen.set(v, id); list.push(v); } ids[a * 8 + n] = id; } return { ids, list }; };
  const SX = stepIds(xs, W, DJ), SZ = stepIds(zs, H, DI), NZ = SZ.list.length, HYP = new Float64Array(SX.list.length * NZ);
  for (let a = 0; a < SX.list.length; a++) for (let b = 0; b < NZ; b++) HYP[a * NZ + b] = Math.hypot(SX.list[a], SZ.list[b]);
  const distTo = (i, j, n) => HYP[SX.ids[j * 8 + n] * NZ + SZ.ids[i * 8 + n]];`)) || s;
}
module.exports = state => {
  const extra = { ...state.extra };
  if (extra['alpine-erosion.js']) extra['alpine-erosion.js'] = patchErosion(extra['alpine-erosion.js']);
  else log('ITEM SKIPPED hypot-table — alpine-erosion.js is not among the local modules');
  return { ...state, watershed: patchWatershed(state.watershed), extra };
};
module.exports.patchWatershed = patchWatershed; module.exports.patchErosion = patchErosion;
