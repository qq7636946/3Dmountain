/* Flow2 valley, fifth round: the plants of the gorge (director B, 2026-11-14 evening). index1-5-flow2.html only.
   Client: 「草根植被1倍」 = the vegetation at its roots twice as rich (not twice as dense: the afternoon's 「太密集太集中」 still holds).
   ?plants=0 leaves all of this out (the afternoon's grass stays as it was); ?grass=0 leaves out every plant. Desktop drawing only.

   A riverside in a gorge has an order of plants by place; that order is what this draws, on the canyon's own ground (the banks as
   the wall shader displaces them, read back once by flow2-grass.js and handed over: nothing is measured twice):
   1. THE GROUND (one splice in the grass's own link in the walls' program, no sampler): the turf takes the photographed turf's own
      blade-scale texture that the base shader already computes (dark gaps, lit clumps, its normal catching the sun), it is darker
      under the tussocks, straw and a little bare soil where it runs out, damper and darker towards the water; moss cushions on the
      stone of the wall foot, moss streaks down the gullies of the lower walls.
   2. AT THE WATER: reed beds (tall stems, some with plumes, leaves arching off them), rush clumps and sedge fountains standing at
      the lap line and a little in the water: the plants that read from a lens 2.4 m above the river, dark against the bright water.
   3. ON THE SHELVES: ferns and broad-leaf plants at the wall foot and in the damp, low shrubs / dwarf willows where the shelf is
      wide, on the toe slopes and on the rims (dark rounded masses: depth and scale); seed heads above a share of the grass blades.
   4. ON THE WALLS: hanging grass on the ledges the eye can see, thinner with height.
   Every kind in three or four shapes, sizes and greens, some dry, some young; lit by the scene's lights and fogged with the walls'
   own haze (the day cycle reaches them by itself); slow travelling wind (still under "reduce motion"); a thin leaf is never drawn
   thinner than about a pixel: farther off fewer are drawn, each a pixel wide, until only the masses are left.

   How: one program (compiled after the valley is live), three draw calls (reeds & co. far-reaching, ferns & co. near, shrubs);
   only a window of instances along the river is drawn (instances sorted by bank row). Planting runs in slices that yield to the
   next frame. Live: window.__FLOW2_PLANTS__ = { tune, defaults, state, whenReady, set(key, value), reset(), diff() }.
   GRASS_STREAM (Team GR, 2026-11-17; on where flow2-grass.js streams, ?grassStream=0 = as before): the plants follow the grass's segments
   along the river and grow where the leading water drop has run (the same growth texture). They are still planted in one go (the stones'
   plants continue the rows' random sequence, so a segment cannot be planted alone without changing them): only the GPU buffers are streamed
   (a segment's buffers go up when it is near, and are let go when it is far behind). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('plants') === '0' || Q.get('grass') === '0') return;
  /* BLACK_SPECKS (Team BK, 2026-11-17; client: 「黑斑…像是螢幕壞掉」; pages with html[data-flow2-opt] only, ?bkfix=0 or ?opt=0 = as before).
     The scene is drawn with 4x MSAA: on a pixel that a thin leaf only partly covers, the GPU shades the leaf at the pixel's CENTRE, which
     often lies outside the triangle, so every varying is extrapolated; on the slivers at a blade's tip by many times its range. Three
     varyings then turned the shaded colour negative: the broad leaf's across coordinate (vPlLoc.x far past ±.5 drives the midrib
     shading factor mix(.86,1.08,1-|x|·1.6) below zero), the colour root→tip (vPlCol) and the translucency (vPlT). A negative value in
     the half-float scene buffer is black after tone mapping, and the depth motion blur smears it into the ragged dark shards the client
     saw (measured: 1–26 such pixels per frame, values to −14, all from this program; .qa/black-specks/). Each is clamped to its own
     range, and the output is kept ≥ 0. Only those extrapolated edge samples change. */
  const BKFIX = document.documentElement.hasAttribute('data-flow2-opt') && !/^(0|post)$/.test(Q.get('bkfix') || '');   /* ?bkfix=post: only main.js's net (test) */
  const bkFix = f => {
    const R = [['diffuseColor.rgb=vPlCol;', 'diffuseColor.rgb=max(vPlCol,vec3(0.));'],
      ['diffuseColor.rgb*=mix(.86,1.08,1.-abs(vPlLoc.x)*1.6)+rib*.12;', 'diffuseColor.rgb*=mix(.86,1.08,1.-min(abs(vPlLoc.x),.5)*1.6)+rib*.12;'],
      ['*.42*vPlT*', '*.42*max(vPlT,0.)*'],
      ['#include <dithering_fragment>', 'gl_FragColor.rgb=max(gl_FragColor.rgb,vec3(0.));\n#include <dithering_fragment>']];
    let n = 0; for (const [a, b] of R) if (f.split(a).length === 2) { f = f.replace(a, () => b); n++; }
    (window.__FLOW2_BK__ ||= {}).plants = n === R.length ? 'on' : 'partly on (' + n + ' of ' + R.length + ' anchors)';
    return f;
  };
  /* SHRUBS, director A (2026-11-16; client, circling the green lumps on the canyon's slopes: 「這種很醜的需要改掉」): round bushes can only
     grow where there is ground for them. The thickets dotted over the steep grassy valley sides and the silhouettes on the rims read as
     lumps stuck on the wall (they are gone); the shrubs that stay stand on flat shelf ground (slope under ~37°), sit in it, and are drawn
     as foliage: soft normals (no facets) and a broken, leafy edge that fades out before it could be finer than a few pixels.
     Seen from the river (40–150 m) even those still read as round green balls, so by default there are NO shrubs: the grass, ferns,
     reeds and hanging grass carry the banks (and the GPU is spared ~4,000 instanced crowns). ?shrubs=shelf = the shelf shrubs only, in the
     new look; ?shrubs=old = the earlier shrubs (placement and look). */
  const SHRUB_MODE = /^(old|shelf)$/.test(Q.get('shrubs') || '') ? Q.get('shrubs') : 'none';
  const OLD_SHRUBS = SHRUB_MODE === 'old';
  const SHRUB_UP = OLD_SHRUBS ? [.55, .6] : [.8, .8];   /* the least 'up' of the ground a shrub may stand on: wall foot, wide shelf */
  /* quality tiers (flow2-quality.js): high = as designed; medium = about half the instances (reeds 60 %, ferns and hanging grass
     50 %, shrubs 75 %), 72 % of the reach, no moss streaks on the walls; low = not installed (the grass's turf and sparse tufts
     only). A step down while the page runs: medium thins what is drawn and shortens the reach (uniforms, windows); low hides the
     new plants and the ground's extras. Nothing is planted again or compiled on a step. */
  const QL = window.__FLOW2_QUALITY__, QSTART = QL?.start || 'high';
  if (QSTART === 'low') return;
  const QF = { high: { dens: 1, reach: 1, shrubs: 1, on: 1, plant: { reeds: 1, ferns: 1, shrubs: 1, hangers: 1 } }, medium: { dens: .5, reach: .72, shrubs: .75, on: 1, plant: { reeds: .6, ferns: .5, shrubs: .75, hangers: .5 } }, low: { dens: 0, reach: .5, shrubs: 0, on: 0, plant: { reeds: 0, ferns: 0, shrubs: 0, hangers: 0 } } };
  const qStart = QF[QSTART] || QF.high, qNow = () => QF[QL?.level] || qStart;
  const DEFAULTS = {
    amount: 1,             // all of it (0 = the afternoon's grass alone)
    /* ground (the turf link) */
    turfTexture: 1,        // the turf's own blade-scale texture (0 = flat colour, as in the afternoon)
    tussockShade: 1,       // the turf darker under the tussocks
    straw: 1,              // straw and bare soil where the turf runs out
    damp: 1,               // turf darker and damper towards the water
    moss: 1,               // moss cushions on the stone of the wall foot
    mossStreaks: 1,        // moss streaks down the gullies of the lower walls
    mossColour: '#3d5326', strawColour: '#a39567',
    /* at the water */
    reeds: 1,              // reed beds, rush clumps and sedge fountains at the lap line
    reedHeight: 1,         // 1 = reeds about 1.5-2.8 m
    reedBeds: 1,           // how much of the shore carries reeds (1 = about half of it, in beds with gaps)
    reedColour: '#7c8e50', plumeColour: '#968579', rushColour: '#3a5530', sedgeColour: '#6f8c47',
    /* on the shelves */
    ferns: 1,              // ferns and broad-leaf plants at the wall foot and in the damp
    fernSize: 1,
    fernColour: '#5c8a3e', leafColour: '#3f6a34',
    shrubs: 1,             // low shrubs and dwarf willows
    shrubSize: 1,
    shrubColour: '#24391f', willowColour: '#4b5b41',
    seeds: 1,              // seed heads above a share of the grass blades
    seedColour: '#6b5a48',
    /* on the walls */
    hangers: 1,            // hanging grass on the ledges
    dry: .3,               // share of dry leaves among every kind
    wind: 1
  };
  const clone = v => JSON.parse(JSON.stringify(v));
  const T = clone(DEFAULTS), KEY = 'flow2-plants-tune-1';
  const take = from => { if (!from || typeof from !== 'object') return; if (from.plants && typeof from.plants === 'object') from = from.plants; for (const k of Object.keys(DEFAULTS)) { const v = from[k], d = DEFAULTS[k]; if (v === undefined || v === null) continue; if (typeof v === typeof d && (typeof v !== 'number' || Number.isFinite(v))) T[k] = v; } };
  try { if (Q.get('plantsTune')) take(JSON.parse(Q.get('plantsTune'))); } catch { }
  const state = { plants: 'waiting for the grass', ready: false, wall: '-', quality: QSTART };
  QL?.on?.(({ level }) => { state.quality = QSTART + ' (now ' + level + ')'; });
  let resolveReady; const whenReady = new Promise(r => { resolveReady = r; });
  const cl = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
  const lin = hex => { const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); const n = m ? parseInt(m[1], 16) : 0x808080; return [n >> 16 & 255, n >> 8 & 255, n & 255].map(c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }); };

  /* ------------------------------------------------------------------ 1. the ground: spliced into the grass's link in the walls' program */
  const UW = {
    uPlG: { value: [0, 1, 1, 1] },     // shown, turf texture, moss cushions, straw & soil
    uPlG2: { value: [1, 1, 1, 0] },    // damp towards the water, moss streaks, tussock shade, -
    uPlMossC: { value: lin(DEFAULTS.mossColour) }, uPlStrawC: { value: lin(DEFAULTS.strawColour) }
  };
  const WALL_PARS = `
uniform vec4 uPlG,uPlG2;uniform vec3 uPlMossC,uPlStrawC;
/* the blades' tussocks, read as the blades read them (flow2-grass.js f2gClump) */
float plClump(vec2 xz,float foot){float c=smoothstep(.2,.8,f2gT(mat2(.6,.8,-.8,.6)*xz+vec2(3.,7.),19.,foot)*.6+f2gT(xz+vec2(11.,5.),7.,foot)*.4);return c*c*(1.+.5*smoothstep(.55,.85,f2gT(xz+vec2(40.,2.),61.,foot)));}
`;
  /* inside the turf (f2gK > 0): f2gC colour, f2gNt normal, f2gR roughness; the base shader's own photographed-turf values lumR (its
     brightness around 1), chromR (its colour around grey) and Nturf (its normal), already faded by the pixel's footprint */
  const WALL_TURF = `
          if(uPlG.x>.001){
            float plSh=1.-f2gSide;
            /* the turf's own texture: dark gaps and lit clumps at blade scale, its normal catching the sun */
            float plTx=uPlG.y*uPlG.x*(1.-.45*f2gSide);
            f2gC*=mix(vec3(1.),clamp(pow(lumR,1.35),.38,1.75)*mix(vec3(1.),chromR,.22),plTx);
            f2gNt=normalize(mix(f2gNt,Nturf,.8*plTx));
            f2gNt=normalize(mix(f2gNt,normalize(mix(Nr,N0,.5)+vec3(0.,.25,0.)),.6*f2gSide*uPlG.x));
            f2gC*=mix(1.,.86,f2gSide*uPlG.x);
            /* darker under the tussocks (where the blades stand thickest) */
            f2gC*=1.-.34*uPlG2.z*uPlG.x*smoothstep(.3,.9,plClump(P.xz,foot))*plSh;
            /* straw where the turf runs out, a little bare soil in it (more near the water and at the edges) */
            float plE=1.-smoothstep(.5,.68,f2gM);
            float plDry=smoothstep(.35,.75,f2gT(P.xz*1.7+vec2(13.,5.),9.,foot));
            f2gC=mix(f2gC,uPlStrawC*(.55+.45*clamp(lumR,.5,1.5))*mix(.75,1.05,f2gN.y),uPlG.w*uPlG.x*plSh*clamp(plE*.85+plDry*.25*f2gP.x,0.,.9));
            float plSoil=smoothstep(.62,.8,f2gT(P.xz*2.3+vec2(7.,21.),6.,foot)+plE*.25+(1.-smoothstep(1.3,2.6,P.y))*.18);
            f2gC=mix(f2gC,f2gC*vec3(.62,.55,.47),uPlG.w*uPlG.x*plSh*plSoil*.75);
            /* damper, darker and a little cooler towards the water */
            float plWet=(1.-smoothstep(1.25,2.7,P.y))*uPlG2.x*uPlG.x*plSh;
            f2gC*=mix(vec3(1.),vec3(.7,.76,.74),plWet);f2gR=mix(f2gR,.78,plWet*.7);
          }
`;
  /* after the grass's block, on every wall pixel: moss cushions on the stone at the wall foot, moss streaks down the gullies */
  const WALL_ROCK = `
      if(uPlG.x>.001&&P.y>1.&&P.y<44.&&foot<1.2){
        float plOn=uPlG.x*(1.-f2gKo);
        /* moss cushions on the stone of the wall foot and the shelves' risers: rounded pads (a reading laid on the face itself),
           domed (lighter in the middle), only where water is near and the face is not overhanging */
        if(P.y<7.&&N0.y>-.2){
          vec2 plU=vec2(P.x+P.z*.71,P.y*1.25+P.z*.37);
          float plPad=f2gT(plU+vec2(5.,2.),6.5,foot)*.65+f2gT(plU*1.9+vec2(1.,8.),6.5,foot)*.35;
          float plBand=smoothstep(1.15,1.6,P.y)*(1.-smoothstep(3.,5.5,P.y))*smoothstep(-.1,.4,N0.y);
          float plM=smoothstep(.64,.74,plPad+plBand*.12-.1*max(eroH,0.)*4.)*plBand*uPlG.z*plOn*smoothstep(.1,.45,alpN.y);
          if(plM>.001){
            float plDome=smoothstep(.56,.9,plPad);
            vec3 plC=uPlMossC*mix(.55,1.15,plDome)*clamp(pow(aLuma(rock)/rockFlatL,.6),.6,1.3)*mix(.85,1.1,clamp(lumR,.6,1.4));
            alpAlbedo=mix(alpAlbedo,plC,plM);alpRough=mix(alpRough,.97,plM);alpWet*=1.-plM*.8;
            alpN=normalize(mix(alpN,normalize(alpN+N0*.6+vec3(0.,.35,0.)),plM*.7));
          }
        }
        /* moss streaks where water runs: down the fine gullies of the lower walls (dark olive, thin, broken along their length) */
        #ifdef PL_STREAKS
        if(N0.y<.75&&P.y>2.5){
          vec2 plV=vec2(P.x+P.z*.71,P.y*.22+P.z*.11);
          float plS=f2gT(plV+vec2(17.,3.),11.,foot);
          float plRun=smoothstep(.62,.8,plS)*smoothstep(-.02,-.14,gullyH*.35+eroH)*(1.-smoothstep(16.,40.,P.y))*smoothstep(2.5,4.,P.y);
          float plMs=plRun*uPlG2.y*plOn*(1.-smoothstep(.35,1.2,foot));
          alpAlbedo=mix(alpAlbedo,alpAlbedo*vec3(.6,.74,.5),plMs*.85);
        }
        #endif
      }
`;
  const api = window.__FLOW2_PLANTS__ = {
    tune: T, defaults: clone(DEFAULTS), state, whenReady,
    /* read by flow2-grass.js when the walls' program compiles (only base-shader names: a missing one leaves the ground as it was) */
    wall: { version: QSTART === 'high' ? 2 : 3, pars: (QSTART === 'high' ? '#define PL_STREAKS'+String.fromCharCode(10) : '') + WALL_PARS, turf: WALL_TURF, rock: WALL_ROCK, uniforms: UW, state: 'waiting for the walls',
      needs: ['float mossM=0.,soilM=0.,lumR=1.', 'vec3 chromR=vec3(1.),Nturf=Ng', 'float gullyH=0.', 'float eroH=0.', 'float rockFlatL=', 'vec3 rock=', 'float aLuma('] }
  };

  /* ------------------------------------------------------------------ small tools */
  const G = window.__FLOW2_GRASS__;
  if (!G || !G.ground) { state.plants = 'no grass module: nothing planted'; return; }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const h2 = (x, y) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const nextFrame = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(go); setTimeout(go, 160); });
  const pageLive = () => !!document.body?.classList.contains('is-ready') && document.documentElement.dataset.flow2Still !== 'on';
  const slicer = () => { let t = performance.now(), worst = 0; return { get worst() { return worst; }, mark() { t = performance.now(); }, async rest(force) { const d = performance.now() - t, live = pageLive(); if (d > (live ? 4 : 7) || force) { worst = Math.max(worst, d); await nextFrame(); t = performance.now(); } } }; };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------ 2. planting */
  /* kinds (a byte: kind * 32 + variant) */
  const K = { REED: 0, REEDLEAF: 1, RUSH: 2, SEDGE: 3, FERN: 4, LEAF: 5, HANG: 6, MASS: 7 };
  const LAST = 560;
  /* director A's rocks (flow2-valley5-rock.js): their footprints [x, z, radius, topY, ...] when that module is on (waited for at
     most a few seconds; without them the plants grow as before) */
  async function rockFootprints() {
    const A = window.__FLOW2_VALLEY5_ROCK__;
    if (!A || typeof A.whenReady !== 'function' || typeof A.footprints !== 'function') return null;
    try { await Promise.race([A.whenReady(), new Promise(r => setTimeout(r, 6000))]); const f = A.footprints(); return f && f.length >= 4 ? f : null; } catch { return null; }
  }
  async function plant(ground, stale) {
    const S = slicer(), t0 = performance.now();
    const rocks = ground.rocks || null, RC = 6, rockGrid = new Map();
    if (rocks) for (let q = 0; q < rocks.length; q += 4) { const r = rocks[q + 2], x0 = Math.floor((rocks[q] - r) / RC), x1 = Math.floor((rocks[q] + r) / RC), z0 = Math.floor((rocks[q + 1] - r) / RC), z1 = Math.floor((rocks[q + 1] + r) / RC); for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) { const key = a * 100003 + b; let l = rockGrid.get(key); if (!l) rockGrid.set(key, l = []); l.push(q); } }
    /* inside (or too near) a rock: pad = metres added to its radius; with a ground height y, a low slab (its top less than 'allow'
       above that ground) does not count: reeds and ferns grow up through the cracks between slabs */
    const inRock = (x, z, pad, y, allow) => { if (!rocks) return false; const l = rockGrid.get(Math.floor(x / RC) * 100003 + Math.floor(z / RC)); if (!l) return false; for (const q of l) { if (y !== undefined && rocks[q + 3] < y + allow) continue; const dx = x - rocks[q], dz = z - rocks[q + 1], r = rocks[q + 2] * .92 + pad; if (dx * dx + dz * dz < r * r) return true; } return false; };
    const { ctx, result, rules } = ground, { rows, cols, P, N, cen, half, latJ } = ctx, M = result.M, R = result.R;
    const rand = rng(20261115);
    const qp = qStart.plant, reedAmt = cl(T.reeds, 0, 2, 1) * qp.reeds, bedAmt = cl(T.reedBeds, 0, 2, 1), fernAmt = cl(T.ferns, 0, 2, 1) * qp.ferns, shrubAmt = cl(T.shrubs, 0, 2, 1) * qp.shrubs * (SHRUB_MODE === 'none' ? 0 : 1), hangAmt = cl(T.hangers, 0, 2, 1) * qp.hangers;
    const sets = {
      far: { f: [], b: [], row: new Uint32Array(rows + 1) },     // reeds, rushes, sedges (seen from far)
      near: { f: [], b: [], row: new Uint32Array(rows + 1) },    // ferns, broad leaves, hanging grass
      shrub: { f: [], b: [], row: new Uint32Array(rows + 1) }    // shrub blobs
    };
    const put = (set, x, y, z, rank, b0, b1, b2, b3, c0, c1, c2, c3) => { set.f.push(x, y, z, rank); set.b.push(b0, b1, b2, b3, c0, c1, c2, c3); };
    const B = v => Math.max(0, Math.min(255, Math.round(v * 255)));
    const kb = (kind, variant) => kind * 32 + Math.min(31, Math.floor(variant * 32));
    const X = (o, n) => P[(o + n) * 4], Y = (o, n) => P[(o + n) * 4 + 1], Z = (o, n) => P[(o + n) * 4 + 2];
    /* the ground at a fractional place of a bank's grid (bilinear over the cell) */
    const g = [0, 0, 0, 0, 1, 0];
    const at = (k, fi, fj) => {
      const i0 = Math.max(0, Math.min(rows - 2, Math.floor(fi))), j0 = Math.max(0, Math.min(cols - 2, Math.floor(fj))), a = Math.min(1, Math.max(0, fi - i0)), b = Math.min(1, Math.max(0, fj - j0)), o = k * rows * cols;
      const n00 = (o + i0 * cols + j0) * 4, n01 = n00 + 4, n10 = n00 + cols * 4, n11 = n10 + 4;
      for (let c = 0; c < 3; c++) {
        g[c] = (P[n00 + c] * (1 - b) + P[n01 + c] * b) * (1 - a) + (P[n10 + c] * (1 - b) + P[n11 + c] * b) * a;
        g[3 + c] = (N[n00 + c] * (1 - b) + N[n01 + c] * b) * (1 - a) + (N[n10 + c] * (1 - b) + N[n11 + c] * b) * a;
      }
      const l = Math.hypot(g[3], g[4], g[5]) || 1; g[3] /= l; g[4] /= l; g[5] /= l;
      return g;
    };
    const corridorOK = (i, x, z, h) => { const ex = cen[i * 2], ez = cen[i * 2 + 1]; const d = Math.hypot(x - ex, z - ez); return h <= 1.2 ? d > 5.5 : d > 10; };
    let nReed = 0, nFern = 0, nShrub = 0, nHang = 0;

    for (let i = 0; i < rows - 1; i++) {
      sets.far.row[i] = sets.far.f.length / 4; sets.near.row[i] = sets.near.f.length / 4; sets.shrub.row[i] = sets.shrub.f.length / 4;
      if (i < 8 || i >= LAST) continue;
      const ends = smooth(8, 20, i) * (1 - smooth(LAST - 20, LAST, i));
      for (let k = 0; k < 2; k++) {
        const o = k * rows * cols, m = M[k], r = R[k];
        /* ---------- at the water: reed beds, rush clumps, sedge fountains ---------- */
        let jw = -1;
        for (let j = 0; j < 9; j++) { const ya = Y(o, i * cols + j), yb = Y(o, i * cols + j + 1); if (ya < 0 && yb >= 0) { jw = j + (0 - ya) / (yb - ya); break; } }
        if (jw >= 0 && reedAmt > .001) {
          /* beds along the river with gaps; more where the bank above the water is low and gentle (mud, not a rock wall) */
          const j4 = Math.min(cols - 1, Math.ceil(jw) + 3), low = 1 - smooth(1.8, 3.6, Y(o, i * cols + j4)), gentle = smooth(.45, .8, N[(o + i * cols + j4) * 4 + 1]);
          const bed = smooth(.53 - .14 * bedAmt, .67 - .14 * bedAmt, vnoise(i * .043 + k * 17.3, 2.2) * .62 + vnoise(i * .16 + k * 5.1, 7.7) * .38 + (low * .5 + gentle * .5 - .5) * .42 + .08 * (1 - smooth(60, 110, i)));
          const want = bed * ends * (1.1 + .9 * low) * reedAmt;
          let nc = Math.floor(want); if (rand() < want - nc) nc++;
          const mix = vnoise(i * .031 + k * 9.1, 4.4);   /* which kind leads this stretch: reeds < .5 < rushes and sedges */
          /* the lip: where the bank passes 1 m above the water (the riser's top edge) */
          let jl = -1; for (let j = Math.floor(jw); j < Math.min(cols - 2, Math.floor(jw) + 6); j++) { const ya = Y(o, i * cols + j), yb = Y(o, i * cols + j + 1); if (ya < 1 && yb >= 1) { jl = j + (1 - ya) / (yb - ya); break; } }
          for (let c = 0; c < nc; c++) {
            const lip = jl > 0 && rand() < .42, fi = i + rand(), fj = lip ? jl + rand() * .9 : jw - .45 + rand() * .6;
            const p = at(k, fi, fj); if (p[1] < -.6 || p[1] > 1.8) continue;
            const cx = p[0], cy = p[1], cz = p[2];
            if (!corridorOK(i, cx, cz, 3) || inRock(cx, cz, .1, cy, .6)) continue;
            const pick = rand(), kind = mix < .52 ? (pick < .78 ? K.REED : pick < .9 ? K.RUSH : K.SEDGE) : (pick < .45 ? K.RUSH : pick < .85 ? K.SEDGE : K.REED);
            const out = Math.atan2(cz - cen[i * 2 + 1], cx - cen[i * 2]);   /* away from the river */
            const sizeC = .55 + .45 * rand(), rank0 = rand();
            /* along the shore (clumps of a bed run together) */
            const ax = -Math.sin(out), az = Math.cos(out);
            const ell = (rr, aa) => [Math.cos(aa) * rr * .62, Math.sin(aa) * rr * 1.5];
            const mass = (hMax, rad, sub) => put(sets.far, cx, cy - .06, cz, rank0 * .3, kb(K.MASS, rand()), rand() * 255, B(hMax / 3.4), rand() * 255, B(Math.min(1, rad / 1.6)), sub * 64 + 32, B(.5 + .5 * Math.cos(out)), B(.5 + .5 * Math.sin(out)));
            if (kind === K.REED) {
              const n = Math.round((18 + 24 * sizeC) * (.8 + .4 * rand())), rad = .4 + .7 * sizeC;
              mass((1.9 + 1.5 * sizeC) * cl(T.reedHeight, .3, 2.5, 1), rad, 0);
              for (let q = 0; q < n; q++) {
                const rr = rad * Math.sqrt(rand()), aa = rand() * 6.283, e = ell(rr, aa), x = cx + e[0] * Math.cos(out) + e[1] * ax, z = cz + e[0] * Math.sin(out) + e[1] * az, centre = 1 - rr / rad;
                const h = (.55 + .45 * centre) * (.7 + .3 * rand()) * sizeC, plume = rand() < .42 ? 1 : 0;
                put(sets.far, x, cy - .05 * rand(), z, Math.min(.999, rank0 * .35 + rand() * .65), kb(K.REED, plume ? .66 + .3 * rand() : .2 * rand()), rand() * 255, B(h), rand() * 255, rand() * 255, rand() * 255, B(.5 + .5 * Math.cos(out)), B(.5 + .5 * Math.sin(out)));
                /* one or two leaves off the stem, arching away from it */
                const nl = rand() < .7 ? 1 : 2;
                for (let l = 0; l < nl; l++) put(sets.far, x, cy + (.25 + .5 * rand()) * h * 2.2, z, Math.min(.999, rank0 * .35 + rand() * .65), kb(K.REEDLEAF, rand()), rand() * 255, B(.4 + .6 * rand()), rand() * 255, rand() * 255, rand() * 255, B(.5 + .5 * Math.cos(out)), B(.5 + .5 * Math.sin(out)));
              }
              nReed++;
            } else if (kind === K.RUSH) {
              const n = Math.round(22 + 30 * sizeC), rad = .14 + .22 * sizeC;
              mass(1.15 * sizeC, rad * 1.6, 1);
              for (let q = 0; q < n; q++) { const rr = rad * Math.sqrt(rand()), aa = rand() * 6.283; put(sets.far, cx + Math.cos(aa) * rr, cy - .04, cz + Math.sin(aa) * rr, Math.min(.999, rank0 * .35 + rand() * .65), kb(K.RUSH, rand()), aa / 6.283 * 255, B((.6 + .4 * rand()) * sizeC), rand() * 255, B(rr / rad), rand() * 255, B(.5 + .5 * Math.cos(out)), B(.5 + .5 * Math.sin(out))); }
              nReed++;
            } else {
              const n = Math.round(16 + 22 * sizeC), rad = .08 + .12 * sizeC;
              mass(.85 * sizeC, rad * 4.5, 2);
              for (let q = 0; q < n; q++) { const rr = rad * Math.sqrt(rand()), aa = rand() * 6.283; put(sets.far, cx + Math.cos(aa) * rr, cy - .03, cz + Math.sin(aa) * rr, Math.min(.999, rank0 * .35 + rand() * .65), kb(K.SEDGE, rand()), aa / 6.283 * 255, B((.55 + .45 * rand()) * sizeC), rand() * 255, rand() * 255, rand() * 255, B(.5 + .5 * Math.cos(out)), B(.5 + .5 * Math.sin(out))); }
              nReed++;
            }
          }
        }
        /* ---------- the riser's face above the lap line: small ferns and broad leaves out of its cracks, over the water ---------- */
        if (jw >= 0 && fernAmt > .001) {
          const want = (.35 + .5 * vnoise(i * .09 + k * 3.3, 1.7)) * fernAmt * ends * 1.7;
          let nr = Math.floor(want); if (rand() < want - nr) nr++;
          for (let q = 0; q < nr; q++) {
            const p = at(k, i + rand(), jw + .3 + rand() * 1.6); if (p[1] < .35 || p[1] > 1.6) continue;
            const cx = p[0], cy = p[1], cz = p[2]; if (!corridorOK(i, cx, cz, 1) || inRock(cx, cz, .05, cy, .35)) continue;
            const out = Math.atan2(cz - cen[i * 2 + 1], cx - cen[i * 2]) + Math.PI, fern = rand() < .7, nf = fern ? 5 + Math.floor(rand() * 4) : 3 + Math.floor(rand() * 3), sz = .5 + .45 * rand(), rank = rand(), lv = fern ? 0 : rand() < .5 ? .6 : .2;
            for (let f = 0; f < nf; f++) { const yaw = out + (rand() - .5) * 2.2; put(sets.near, cx, cy - .02, cz, rank, kb(fern ? K.FERN : K.LEAF, fern ? rand() * .85 : lv + rand() * .2), (yaw / 6.283 % 1 + 1) % 1 * 255, B(sz * (.75 + .25 * rand())), rand() * 255, B(.7 + .3 * rand()), rand() * 255, B(.5 + .5 * Math.cos(out)), B(.5 + .5 * Math.sin(out))); }
            nFern++;
          }
        }
        /* ---------- the damp lip above the riser: rosettes of big round leaves now and then ---------- */
        if (jw >= 0 && fernAmt > .001 && rand() < .22 * fernAmt * ends * (.4 + .6 * vnoise(i * .05 + k * 7.1, 5.5))) {
          let jl = -1; for (let j = Math.floor(jw); j < Math.min(cols - 2, Math.floor(jw) + 6); j++) { const ya = Y(o, i * cols + j), yb = Y(o, i * cols + j + 1); if (ya < 1.1 && yb >= 1.1) { jl = j + (1.1 - ya) / (yb - ya); break; } }
          if (jl > 0) {
            const p = at(k, i + rand(), jl + .3 + rand() * 1.2);
            if (p[1] > 1 && p[1] < 2.6 && p[4] > .5 && corridorOK(i, p[0], p[2], 1) && !inRock(p[0], p[2], .2)) {
              const cx = p[0], cy = p[1], cz = p[2], nl = 3 + Math.floor(rand() * 4), turn = rand() * 6.283, sz = .6 + .4 * rand(), rank = rand();
              for (let f = 0; f < nl; f++) { const yaw = turn + f / nl * 6.283 + (rand() - .5) * .6; put(sets.near, cx, cy - .02, cz, rank, kb(K.LEAF, .6 + rand() * .2), (yaw / 6.283 % 1 + 1) % 1 * 255, B(sz * (.8 + .2 * rand())), rand() * 255, B(.3 + .4 * rand()), rand() * 255, B(.5), B(.5)); }
              nFern++;
            }
          }
        }
        /* ---------- on the shelves: ferns and broad leaves at the wall foot, shrubs where the shelf is wide ---------- */
        for (let j = 2; j < 40; j++) {
          const n = i * cols + j, y = Y(o, n), ny = N[(o + n) * 4 + 1];
          if (y < 1.2 || latJ[j] > 70) continue;
          const mm = m[n];
          /* the wall foot: gentle here, steep or rising just outward */
          let rise = 0; for (let q = 1; q <= 3 && j + q < cols; q++) rise = Math.max(rise, Y(o, n + q) - y);
          const foot = smooth(.55, .8, ny) * smooth(1.2, 4.5, rise) * smooth(.15, .5, mm + (y < 6 ? .25 : 0));
          const dampLow = smooth(.55, .8, ny) * (1 - smooth(1.6, 3.2, y)) * smooth(.1, .4, mm);
          const cellA = Math.max(.2, (latJ[Math.min(cols - 1, j + 1)] - latJ[Math.max(0, j - 1)]) * .5) * 3.1;   /* m² this vertex stands for */
          const patchF = smooth(.38, .62, vnoise(X(o, n) * .07 + 3.3, Z(o, n) * .07 + 9.1) * .7 + vnoise(X(o, n) * .21, Z(o, n) * .21 + 4.4) * .3);
          if (fernAmt > .001) {
            const want = cellA * (foot * .4 + dampLow * .1) * patchF * fernAmt * ends;
            let nr = Math.floor(want); if (rand() < want - nr) nr++;
            for (let q = 0; q < nr; q++) {
              const p = at(k, i + rand() - .5, j + rand() - .5); if (p[1] < 1.25 || p[4] < .55) continue;
              const cx = p[0], cy = p[1], cz = p[2]; if (!corridorOK(i, cx, cz, 1) || inRock(cx, cz, .1)) continue;
              const fern = (foot > dampLow ? .75 : .35) > rand(), sz = (.65 + .35 * rand()) * (fern ? 1.45 : 1.2), rank = rand();
              const nf = fern ? 6 + Math.floor(rand() * 5) : 4 + Math.floor(rand() * 4), turn = rand() * 6.283, dry = rand() < cl(T.dry, 0, 1, .3) * .5 ? 1 : 0;
              for (let f = 0; f < nf; f++) {
                const yaw = turn + f / nf * 6.283 + (rand() - .5) * .7;
                put(sets.near, cx, cy - .03, cz, rank, kb(fern ? K.FERN : K.LEAF, dry ? .9 + .09 * rand() : rand() * .85), (yaw / 6.283 % 1 + 1) % 1 * 255, B(sz * (.75 + .25 * rand())), rand() * 255, rand() * 255, rand() * 255, B(p[3] * .5 + .5), B(p[5] * .5 + .5));
              }
              nFern++;
            }
          }
          /* a shrub nestled at the wall foot now and then (dark against the rock behind it) */
          if (shrubAmt > .001 && foot > .35 && rand() < .05 * foot * shrubAmt * ends) { const p = at(k, i + rand() - .5, j + rand() * .8 - .4); if (p[1] > 1.4 && p[4] > SHRUB_UP[0]) plantShrub(p, i, rand, .85 + .45 * rand()); }
          /* shrubs: where the shelf is wide (meadow on both sides of this vertex), on the toe slopes of the entrance and the outlet */
          if (shrubAmt > .001 && !(j & 1) && !(i & 1)) {
            const wide = Math.min(m[n], m[Math.max(0, n - 2)], m[Math.min(rows * cols - 1, n + 2)], m[Math.min(rows * cols - 1, n + 2 * cols)]);
            const toe = (1 - smooth(70, 110, i) + smooth(500, 540, i)) * smooth(.6, .85, ny) * (1 - smooth(14, 22, y));
            const thicket = smooth(.55, .75, vnoise(X(o, n) * .045 + 1.7, Z(o, n) * .045 + 5.2) * .7 + vnoise(X(o, n) * .15 + 8.8, Z(o, n) * .15) * .3);
            const p0 = (smooth(.45, .8, wide) * .28 + toe * .5) * thicket * shrubAmt * ends * 4;
            if (rand() < p0) {
              const p = at(k, i + rand() * 1.6 - .8, j + rand() * 1.6 - .8); if (p[1] < 1.4 || p[4] < SHRUB_UP[1]) continue;
              plantShrub(p, i, rand, toe > .3 ? 1.15 : 1);
            }
          }
        }
        /* ---------- the green of the valley sides: shrubs and thickets dotted through it, fewer with height ---------- */
        if (OLD_SHRUBS && shrubAmt > .001 && rules && !(i % 3)) {
          for (let j = 6; j < 64; j += 2) {
            const n = i * cols + j, y = Y(o, n), up = N[(o + n) * 4 + 1]; if (y < 3.5 || y > 90 || up < .4 || latJ[j] > 120) continue;
            const x = X(o, n), z = Z(o, n); rules.base(x, z);
            const turf = rules.wallF(x, y, z, up); if (turf < .5) continue;
            const thicket = smooth(.5, .72, vnoise(x * .03 + 7.7, z * .03 + 1.3) * .7 + vnoise(x * .11, z * .11 + 3.9) * .3);
            const cellA = Math.max(.5, (latJ[Math.min(cols - 1, j + 1)] - latJ[Math.max(0, j - 1)]) * .5) * 3.1 * 6;
            const pr = cellA / 38 * thicket * (1 - smooth(25, 85, y)) * shrubAmt * ends * smooth(.55, .8, turf);
            if (rand() < pr) { const p = at(k, i + rand() * 2 - 1, j + rand() * 2 - 1); if (p[4] > .5 && p[1] > 3) plantShrub(p, i, rand, 1.25 + .5 * rand() * (1 - smooth(20, 60, y))); }
          }
        }
        /* ---------- rims, ledges and bench edges in view: a shrub now and then as a silhouette, hanging grass ---------- */
        for (let j = 4; j < 60; j++) {
          const n = i * cols + j, rv = r[n]; if (rv < .45) continue;
          const y = Y(o, n), high = 1 - smooth(18, 70, y);
          if (OLD_SHRUBS && shrubAmt > .001 && rand() < .03 * rv * high * shrubAmt * ends) { const p = at(k, i + rand() - .5, j + rand() - .5); if (p[4] > .55) plantShrub(p, i, rand, .8 + .3 * rand()); }
          if (hangAmt > .001 && rand() < .09 * rv * (.25 + .75 * high) * hangAmt * ends) {
            const p = at(k, i + rand() - .5, j + rand() * .6 - .3); if (p[1] < 3) continue;
            const cx = p[0], cy = p[1], cz = p[2];
            const out = Math.atan2(cz - cen[i * 2 + 1], cx - cen[i * 2]) + Math.PI;   /* towards the river: off the ledge */
            const nb = 6 + Math.floor(rand() * 10), sz = (.5 + .5 * rand()) * (.6 + .4 * high), rank = rand();
            put(sets.far, cx, cy - .02, cz, rank * .3, kb(K.MASS, rand()), rand() * 255, B(.9 * sz / 3.4), rand() * 255, B(.45 / 1.6), 3 * 64 + 32, B(.5 + .5 * Math.cos(out)), B(.5 + .5 * Math.sin(out)));
            for (let q = 0; q < nb; q++) put(sets.near, cx + (rand() - .5) * .5, cy - .02, cz + (rand() - .5) * .5, rank, kb(K.HANG, rand()), ((out + (rand() - .5) * 1.4) / 6.283 % 1 + 1) % 1 * 255, B(sz * (.6 + .4 * rand())), rand() * 255, rand() * 255, rand() * 255, B(.5 + .5 * Math.cos(out)), B(.5 + .5 * Math.sin(out)));
            /* now and then a small fern on the same ledge, out over its edge */
            if (fernAmt > .001 && rand() < .35) { const nf = 3 + Math.floor(rand() * 3), fs2 = .25 + .25 * rand(); for (let f = 0; f < nf; f++) { const yaw = out + (rand() - .5) * 2; put(sets.near, cx + (rand() - .5) * .3, cy - .02, cz + (rand() - .5) * .3, rank, kb(K.FERN, rand() * .85), (yaw / 6.283 % 1 + 1) % 1 * 255, B(fs2 * (.8 + .2 * rand())), rand() * 255, B(.8 + .2 * rand()), rand() * 255, B(.5 + .5 * Math.cos(out)), B(.5 + .5 * Math.sin(out))); } }
            nHang++;
          }
        }
      }
      if (!(i & 7)) { await S.rest(); if (stale()) return null; }
    }
    for (const s of Object.values(sets)) for (let i = rows - 1; i <= rows; i++) s.row[i] = s.f.length / 4;
    /* ---------- around the shore and wall-foot stones: sedge tufts and grass at their feet, ferns in their shade ----------
       (each stone is found on its bank's grid: nearest row along the river, then across it; planted into that row's run) */
    let nStone = 0;
    if (rocks && fernAmt + reedAmt > .001) {
      const extra = { far: new Map(), near: new Map() };
      const add = (set, row, args) => { const m = extra[set]; let l = m.get(row); if (!l) m.set(row, l = []); l.push(args); };
      /* row centres in a grid of 24 m cells: the nearest row of any point in a few lookups */
      const CG = 24, cgrid = new Map(); for (let ii = 0; ii < rows; ii++) { const key = Math.floor(cen[ii * 2] / CG) * 100003 + Math.floor(cen[ii * 2 + 1] / CG); let l = cgrid.get(key); if (!l) cgrid.set(key, l = []); l.push(ii); }
      for (let q = 0; q < rocks.length; q += 4) {
        const x = rocks[q], z = rocks[q + 1], r = rocks[q + 2], top = rocks[q + 3]; if (top > 9 || r < .35 || r > 6) continue;
        /* nearest row (rocks are mostly listed along the river: search near the last hit first) */
        let best = 1e18, bi = -1; const gx0 = Math.floor(x / CG), gz0 = Math.floor(z / CG);
        for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const l = cgrid.get((gx0 + a) * 100003 + gz0 + b); if (l) for (const ii of l) { const e = (cen[ii * 2] - x) ** 2 + (cen[ii * 2 + 1] - z) ** 2; if (e < best) { best = e; bi = ii; } } }
        if (bi < 12 || bi >= LAST) continue;
        const ends = smooth(12, 24, bi) * (1 - smooth(LAST - 20, LAST, bi));
        const want = (1.2 + r * 1.6) * ends * (.45 + .55 * vnoise(x * .05 + 3.1, z * .05 + 7.3)) * Math.min(1.5, (fernAmt + reedAmt) * .5);
        let n = Math.floor(want); if (rand() < want - n) n++;
        for (let t = 0; t < n; t++) {
          const a = rand() * 6.283, rr = r * (.95 + .35 * rand()), px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
          if (inRock(px, pz, -.05)) continue;
          /* the ground there: the bank whose grid holds it (across from the row's centre) */
          const tx = cen[Math.min(rows - 1, bi + 1) * 2] - cen[Math.max(0, bi - 1) * 2], tz = cen[Math.min(rows - 1, bi + 1) * 2 + 1] - cen[Math.max(0, bi - 1) * 2 + 1], tl = Math.hypot(tx, tz) || 1;
          const fi = Math.max(0, Math.min(rows - 1.001, bi + ((px - cen[bi * 2]) * tx + (pz - cen[bi * 2 + 1]) * tz) / tl / ctx.step));
          let gp = null, gd = 1e9;
          for (let k = 0; k < 2; k++) {
            const o = k * rows * cols, d0 = Math.hypot(X(o, bi * cols) - cen[bi * 2], Z(o, bi * cols) - cen[bi * 2 + 1]), dl = Math.hypot(px - cen[bi * 2], pz - cen[bi * 2 + 1]) - d0;
            if (dl < -1.5) continue;
            const fj = Math.min(cols - 2, 84 * Math.pow(Math.max(0, dl) / 250, 1 / 1.62)), p = at(k, fi, fj), e = Math.hypot(p[0] - px, p[2] - pz);
            if (e < gd) { gd = e; gp = [p[0], p[1], p[2], p[3], p[4], p[5]]; }
          }
          if (!gp || gd > 4 || gp[1] < -.4 || gp[1] > 9) continue;
          const gy = gp[1], out = Math.atan2(pz - z, px - x), sh = gy > 1.6 && rand() < .35, rank = rand();
          if (!corridorOK(bi, px, pz, 1)) continue;
          if (sh && fernAmt > .001) {   /* a fern in the stone's shade */
            const nf = 5 + Math.floor(rand() * 4), sz = .45 + .4 * rand();
            for (let f = 0; f < nf; f++) { const yaw = out + (rand() - .5) * 2.4; add('near', bi, [px, gy - .03, pz, rank, kb(K.FERN, rand() * .85), (yaw / 6.283 % 1 + 1) % 1 * 255, B(sz * (.75 + .25 * rand())), rand() * 255, B(.45 + .4 * rand()), rand() * 255, B(gp[3] * .5 + .5), B(gp[5] * .5 + .5)]); }
          } else if (reedAmt > .001) {  /* a sedge tuft at its foot */
            const nb = 12 + Math.floor(rand() * 14), sz = .5 + .45 * rand(), rad = .08 + .1 * sz;
            for (let b = 0; b < nb; b++) { const rb = rad * Math.sqrt(rand()), ab = rand() * 6.283; add('far', bi, [px + Math.cos(ab) * rb, gy - .03, pz + Math.sin(ab) * rb, Math.min(.999, rank * .35 + rand() * .65), kb(K.SEDGE, rand()), ab / 6.283 * 255, B((.55 + .45 * rand()) * sz), rand() * 255, rand() * 255, rand() * 255, B(.5), B(.5)]); }
            add('far', bi, [px, gy - .05, pz, rank * .3, kb(K.MASS, rand()), rand() * 255, B(.8 * sz / 3.4), rand() * 255, B(Math.min(1, rad * 4.5 / 1.6)), 2 * 64 + 32, B(.5), B(.5)]);
          }
          nStone++;
        }
        if (!(q & 63)) { await S.rest(); if (stale()) return null; }
      }
      /* merge the extra plants into their rows (instances stay sorted by row for the drawing window) */
      for (const name of ['far', 'near']) {
        const m = extra[name]; if (!m.size) continue;
        const set = sets[name], f = set.f, b = set.b, nf = [], nb = [], row = new Uint32Array(rows + 1);
        for (let i = 0; i < rows - 1; i++) {
          row[i] = nf.length / 4;
          const a0 = set.row[i], a1 = set.row[i + 1];
          for (let n = a0; n < a1; n++) { nf.push(f[n * 4], f[n * 4 + 1], f[n * 4 + 2], f[n * 4 + 3]); for (let c = 0; c < 8; c++) nb.push(b[n * 8 + c]); }
          const l = m.get(i); if (l) for (const v of l) { nf.push(v[0], v[1], v[2], v[3]); nb.push(v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11]); }
          if (!(i % 48)) await S.rest();
        }
        for (let i = rows - 1; i <= rows; i++) row[i] = nf.length / 4;
        set.f = nf; set.b = nb; set.row = row;
        await S.rest(); if (stale()) return null;
      }
    }
    function plantShrub(p, i, rand, scale) {
      const gx = p[0], gy = p[1], gz = p[2]; if (!corridorOK(i, gx, gz, 3) || inRock(gx, gz, .8)) return;
      const willow = rand() < .4, size = (1.1 + 1.1 * rand()) * scale * (willow ? .85 : 1), nb = 4 + Math.floor(rand() * 5), seed = rand(), turn = rand() * 6.283, rank = rand();
      for (let q = 0; q < nb; q++) {
        const a = turn + q / nb * 6.283 + rand() * .8, rr = q === 0 ? 0 : size * (.35 + .4 * rand()) * (willow ? 1.3 : 1);
        const br = size * (q === 0 ? .62 : .38 + .22 * rand()), hy0 = (q === 0 ? .55 : .3 + .35 * rand()) * size * (willow ? .8 : 1), hy = OLD_SHRUBS ? hy0 : (q === 0 ? .46 * size : br * .55) * (willow ? .85 : 1);
        put(sets.shrub, gx + Math.cos(a) * rr, gy + hy, gz + Math.sin(a) * rr, rank, (willow ? 128 : 0) + Math.floor(rand() * 127), rand() * 255, B(br / 2.2), rand() * 255, B(willow ? .55 + .2 * rand() : .7 + .3 * rand()), B(seed * .6 + rand() * .4), B(Math.min(1, hy / 3)), B(seed));
      }
      nShrub++;
    }
    const pack = s => { const n = s.f.length / 4; return { n, f: Float32Array.from(s.f), b: Uint8Array.from(s.b), row: s.row }; };
    return { far: pack(sets.far), near: pack(sets.near), shrub: pack(sets.shrub), counts: { reedClumps: nReed, fernRosettes: nFern, shrubs: nShrub, hangers: nHang, aroundStones: nStone, rocksSeen: rocks ? rocks.length / 4 : 0 }, ms: Math.round(performance.now() - t0), slice: +S.worst.toFixed(1) };
  }

  /* ------------------------------------------------------------------ 3. drawing: one program for every kind */
  const UP = {
    uPlA: { value: [0, 0, 1, 1] },          // shown, grown, wind, dry share
    uPlAmt: { value: [1, 1, 1, 1] },        // reeds, ferns & leaves, shrubs, hanging grass
    uPlSize: { value: [1, 1, 1, 1] },       // reed height, fern size, shrub size, -
    uPlKind: { value: 0 },
    uPlQ: { value: [1, 1, 1, 1] },          // quality now against the start: share drawn (thin kinds), reach, shrubs
    uPlC: { value: new Float32Array(3 * 10) }   // colours: reed, plume, rush, sedge, fern, leaf, shrub, willow, dry, seed
  };
  const COLOUR_KEYS = ['reedColour', 'plumeColour', 'rushColour', 'sedgeColour', 'fernColour', 'leafColour', 'shrubColour', 'willowColour', null, 'seedColour'];
  const VERT_PARS = `
      attribute vec4 aA;attribute vec4 aB;attribute vec4 aC;
      uniform vec4 uGrassA,uGrassC,uGrassLod,uGrassWind;
      uniform vec4 uPlA,uPlAmt,uPlSize,uPlQ;uniform float uPlKind;uniform vec3 uPlC[10];
      varying vec3 vPlCol;varying float vPlT;varying float vPlRough;varying vec3 vAlpWorld;varying vec3 vPlLoc;varying float vPlLeaf;
      vec3 plPos;
      float plHash(vec3 p){uvec3 q=uvec3(ivec3(floor(p))+ivec3(40000));uint n=q.x*1597334677u^q.y*3812015801u^q.z*2798796415u;n=(n^(n>>15u))*2246822519u;n^=n>>13u;return float(n>>8u)*(1./16777216.);}
      float plNoise(vec3 p){vec3 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
        return mix(mix(mix(plHash(i),plHash(i+vec3(1,0,0)),u.x),mix(plHash(i+vec3(0,1,0)),plHash(i+vec3(1,1,0)),u.x),u.y),mix(mix(plHash(i+vec3(0,0,1)),plHash(i+vec3(1,0,1)),u.x),mix(plHash(i+vec3(0,1,1)),plHash(i+vec3(1,1,1)),u.x),u.y),u.z);}
      /* the grass's wind: slow travelling gusts over the whole valley (the same field, so reeds and grass bow together) */
      float plGust(vec3 root){vec2 wd=uGrassWind.xy;float tm=uGrassA.y*uGrassWind.z;
        float g=plNoise(vec3(root.xz*.042-wd*tm*.042,.5))*.62+plNoise(vec3(root.xz*.115-wd*tm*.144+vec2(7.3,2.1),1.5))*.38;return smoothstep(.28,.82,g);}`;
  /* a strip of 11 rows x 2 edges: position.x = across (-.5 .. .5), position.y = along (0 .. 1) */
  const LEAF = `
      vec3 pRoot=aA.xyz;float pT=position.y,pX=position.x;
      float pKb=aB.x*255.+.5,pK=floor(pKb/32.),pV=mod(floor(pKb),32.)/31.;
      vec3 pTo=cameraPosition-pRoot;float pD=length(pTo);
      if(pK>6.5){
        /* a whole clump seen from afar: one ribbon facing the lens with a ragged top, its stems' mass (rises in from 12 m out as the
           single stems thin out; nothing thinner than a pixel ever stands alone) */
        float sub=floor(aC.y*4.),H=aB.z*3.4,W=(.25+1.35*aC.x)*2.1;
        float reachM=(sub>2.5?150.:240.)*uPlQ.y,amtM=sub>2.5?uPlAmt.w:uPlAmt.x;
        float mk=smoothstep(38.,62.,pD)*(1.-smoothstep(reachM*.72,reachM,pD))*amtM*uPlA.x*uPlA.y*step(fract(aB.w*7.31+aB.y*3.17),.72);
        /* a tuft's outline: five leaning spikes of their own heights over deep notches */
        float col=floor(pT*10.+.5),odd=mod(col,2.),tooth=plHash(vec3(col,aB.y*255.,aB.w*255.+sub)),lean=(plHash(vec3(col+17.,aB.y*255.,3.))-.5);
        float top=mix(.42,.6,tooth)+.08*odd;
        top*=1.-pow(abs(pT-.5)*2.,2.)*.55;
        vec2 s2=normalize(vec2(-pTo.z,pTo.x)+vec2(1e-5,0.));
        float up=(pX+.5)*top*H*mk;
        float pG=plGust(pRoot);vec2 wb=uGrassWind.xy*(.04+.3*pG)*uGrassA.z*uPlA.z;
        vec3 side=vec3(s2.x,0.,s2.y)*((pT-.5)*W*.6+lean*.12*W*(pX+.5));
        if(sub>2.5){vec2 o2=vec2(aC.z,aC.w)*2.-1.;plPos=pRoot+side+vec3(o2.x,0.,o2.y)*.25*(pX+.5)*mk-vec3(0.,up*.9,0.);}
        else plPos=pRoot+side+vec3(0.,up,0.)+vec3(wb.x,0.,wb.y)*up*(pX+.5)*.6;
        plPos=mix(pRoot,plPos,step(.001,mk));
        objectNormal=normalize(vec3(-s2.y,0.,s2.x)*.0+normalize(pTo)*.55+vec3(0.,.8,0.));
        vec3 base=sub<.5?uPlC[0]:sub<1.5?uPlC[2]:uPlC[3];
        vec3 c=mix(base*.34,base*.72,smoothstep(0.,1.,pX+.5));
        vPlCol=c*(.85+.3*aB.w)*vec3(.9,.94,.94);vPlT=.35;vPlRough=.9;vPlLoc=vec3(0.);vPlLeaf=0.;
      }else{
      float pYaw=aB.y*6.2831853,pSz=aB.z,pC=aB.w,pR1=aC.x,pR2=aC.y;vec2 pOut=vec2(aC.z,aC.w)*2.-1.;
      /* per kind: length, width, angle from upright at the root and at the tip, world-fixed (1) or facing the lens (0), reach */
      float L=1.,Wd=.02,a0=.1,a1=.3,fixd=0.,reach=240.,amt=uPlAmt.x,drop=0.,trans=.6,rough=.9;
      vec3 cRoot=uPlC[0]*.5,cTip=uPlC[0];
      float dryK=step(1.-uPlA.w*.6,fract(pC*7.13+pR1*3.7));
      if(pK<.5){            /* reed stem; variant > .7: a plume at its top */
        L=mix(1.7,3.4,pSz)*uPlSize.x;Wd=.018*(.8+.4*pR2);a0=.03+.1*pR1;a1=a0+.12+.1*pR1;cRoot=uPlC[0]*.55;cTip=uPlC[0]*1.12;trans=.5;
      }else if(pK<1.5){     /* reed leaf, rooted up the stem, arching off it */
        L=mix(.35,.8,pSz)*uPlSize.x;Wd=.021*(.8+.4*pR2);a0=.6+.5*pR1;a1=a0+1.1+.9*pR2;cRoot=uPlC[0]*.8;cTip=uPlC[0]*1.05;trans=.7;
      }else if(pK<2.5){     /* rush: dark, straight, pointed */
        L=mix(.5,1.15,pSz)*mix(.9,1.1,pR1);Wd=.008*(.8+.4*pR2);a0=.05+.25*pR2*pR2;a1=a0+.08;cRoot=uPlC[2]*.6;cTip=mix(uPlC[2]*1.1,uPlC[1],.35);trans=.35;
      }else if(pK<3.5){     /* sedge fountain blade */
        L=mix(.35,1.,pSz);Wd=.011*(.8+.4*pR2);a0=.15+.5*pR1;a1=a0+1.3+1.2*pR2;cRoot=uPlC[3]*.55;cTip=uPlC[3]*1.1;trans=.75;
      }else if(pK<4.5){     /* fern frond: world-fixed, arching from the crown, pinnae as a zigzag edge */
        L=mix(.35,1.05,pSz)*uPlSize.y;Wd=mix(.1,.22,pSz)*uPlSize.y;a0=.35+.5*pR1;a1=a0+.9+.9*pR2;fixd=1.;reach=78.;amt=uPlAmt.y;cRoot=uPlC[4]*.5;cTip=uPlC[4]*mix(.9,1.25,pV);trans=.55;rough=.82;
      }else if(pK<5.5){     /* broad leaf: a short stalk, an oval blade lying out from the crown */
        L=mix(.18,.55,pSz)*uPlSize.y;Wd=mix(.08,.24,pSz)*uPlSize.y;a0=.45+.5*pR1;a1=a0+.7+.6*pR2;fixd=1.;reach=70.;amt=uPlAmt.y;cRoot=uPlC[5]*.7;cTip=uPlC[5]*mix(.9,1.15,pV);trans=.3;rough=.62;
        if(pV>.58&&pV<.9){L*=1.5;Wd*=2.;a0=.25+.3*pR1;a1=a0+1.1+.4*pR2;cTip*=.9;}
      }else{                /* hanging grass on a ledge: out over the edge, then down */
        L=mix(.35,1.3,pSz);Wd=.01*(.8+.4*pR2);a0=1.+.6*pR1;a1=a0+1.2+1.1*pR2;reach=150.;amt=uPlAmt.w;cRoot=uPlC[3]*.45;cTip=mix(uPlC[3],uPlC[1],.25)*.95;trans=.6;
      }
      if(pV>.9&&pK>3.5&&pK<5.5)dryK=1.;
      vec3 dryC=uPlC[8]*(.75+.4*pC);
      cTip=mix(cTip,dryC,dryK*.85);cRoot=mix(cRoot,dryC*.6,dryK*.6);
      /* how many are drawn at this distance: all while a leaf is wider than a pixel, then fewer (each a pixel wide) */
      float pWmin=uGrassLod.z*pD,pD0=Wd/max(uGrassLod.z,1e-6);
      reach*=uPlQ.y;
      float pDens=(fixd>.5?1.:clamp(max(pD0/pD,1.-smoothstep(pD0*.35,pD0,pD)),0.,1.))*uPlQ.x;
      float pShow=smoothstep(0.,.3,1.-aA.w/max(pDens,1e-4))*(1.-smoothstep(reach*.72,reach,pD))*amt*uPlA.x*uPlA.y;
      float pOn=step(.001,pShow);
      L*=mix(.35,1.,sqrt(min(pShow,1.)));
      /* the centre line: a circular arc from angle a0 to a1 (from upright), bowed further by the wind */
      float pG=plGust(pRoot),pWnd=uGrassA.z*uPlA.z*mix(1.,.35,fixd);
      vec2 pH=vec2(cos(pYaw),sin(pYaw));
      if(pK>5.5)pH=normalize(pOut+.7*vec2(cos(pYaw),sin(pYaw)));
      float k=a1-a0,th=a0+k*pT;k=abs(k)<1e-3?1e-3:k;
      float hs=(cos(a0)-cos(th))/k,vs=(sin(th)-sin(a0))/k;
      vec2 wb=uGrassWind.xy*(.04+.3*pG)*pWnd;
      vec3 pC0=vec3(pH.x*hs,vs,pH.y*hs)*L+vec3(wb.x,0.,wb.y)*L*pT*pT;
      vec3 pTan=normalize(vec3(pH.x*sin(th),cos(th),pH.y*sin(th))+vec3(wb.x,0.,wb.y)*2.*pT);
      /* width along the leaf */
      float w=Wd*pow(max(1.-pT,0.),.75)*(.6+.4*smoothstep(0.,.12,pT));
      vec3 cAdd=vec3(0.);
      if(pK<.5){
        w=Wd*(1.-.45*pT);
        if(pV>.6){float pl=smoothstep(.74,.85,pT);w=mix(w,Wd*mix(3.,5.2,fract(pC*5.7))*(1.-smoothstep(.86,1.,pT)*.9),pl);th+=pl*(.25+.5*pR1)*(pT-.74);cTip=mix(cTip,uPlC[1]*(.85+.3*pC),pl);cRoot=mix(cRoot,uPlC[1],pl);}
        else w*=1.-smoothstep(.9,1.,pT)*.8;
      }else if(pK<2.5&&pK>1.5){w=Wd*pow(max(1.-pT,0.),.25);}
      else if(pK<4.5&&pK>3.5){
        float env=smoothstep(0.,.3,pT)*pow(max(1.-pT,0.),.65)*1.6;
        float zz=mod(floor(pT*10.+.5),2.);
        float zig=mix(1.,mix(.18,1.,zz),1.-smoothstep(.6,1.6,uGrassLod.z*pD/max(Wd*.12,1e-4)));
        w=Wd*env*zig+.006;
      }else if(pK<5.5&&pK>4.5){
        float st=pV>.58&&pV<.9?.42:.24,bl=clamp((pT-st)/(1.-st),0.,1.);
        w=pT<st?Wd*.05:Wd*pow(sin(3.14159*bl),pV>.58&&pV<.9?.42:.6)+.004;
      }
      /* across: facing the lens for the thin kinds (never thinner than a pixel), along the leaf's own plane for the broad ones */
      vec3 pSide;
      if(fixd>.5){pSide=normalize(vec3(-pH.y,0.,pH.x));}
      else{vec2 s2=normalize(vec2(-pTo.z,pTo.x)+vec2(1e-5,0.));pSide=vec3(s2.x,0.,s2.y);}
      float wt=fixd>.5?w:max(w,pWmin*(1.-.5*pT)*step(.001,w));
      float pCover=fixd>.5?1.:clamp(w/max(pWmin,1e-6),0.,1.);
      plPos=pRoot+(pC0+pSide*pX*wt)*pOn;
      vec3 pN=normalize(cross(pSide,pTan));if(fixd<.5&&dot(pN,pTo)<0.)pN=-pN;
      objectNormal=normalize(mix(pN,vec3(0.,1.,0.),fixd>.5?.25:.55));
      vec3 col=mix(cRoot,cTip,smoothstep(.0,.9,pT))*(.85+.3*pC);
      /* far and thin: the leaf's own colour gives way to its silhouette's (darker, a little greyer) */
      vPlCol=mix(col*vec3(.62,.66,.66),col,mix(.45,1.,pCover));
      vPlT=trans*mix(.4,1.,pT);vPlRough=rough;vPlLoc=vec3(pX,pT,0.);vPlLeaf=fixd;
      }`;
  /* shrubs: lumpy blobs (several per shrub), soft foliage shading, leaf clusters that fade before a pixel can no longer hold them */
  const SHRUB = `
      vec3 pRoot=aA.xyz;vec3 pTo=cameraPosition-pRoot;float pD=length(pTo);
      float willow=step(.5,aB.x),r=(.2+2.*aB.z)*uPlSize.z,yaw=aB.y*6.2831853,hs=mix(.6,1.,aC.x),seed=aC.y*37.;
      float pShow=(1.-smoothstep(230.*uPlQ.y,320.*uPlQ.y,pD))*uPlAmt.z*uPlA.x*uPlA.y*smoothstep(0.,.25,1.-aA.w/max(clamp(210./pD,0.,1.)*uPlQ.z,1e-4));
      vec3 q=position;
      /* a knobbly crown: three sizes of lumps (the finest only near), its normal taken from the lumpy surface itself */
      float k3=1.-smoothstep(25.,70.,pD);
      vec3 t1=normalize(cross(q,abs(q.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.))),t2=cross(q,t1);
      vec3 q1=normalize(q+t1*.09),q2=normalize(q+t2*.09);
      float l0=plNoise(q*1.9+seed)*.5+plNoise(q*4.3+seed*1.7)*.3+plNoise(q*9.5+seed*.3)*.28*k3;
      float l1=plNoise(q1*1.9+seed)*.5+plNoise(q1*4.3+seed*1.7)*.3+plNoise(q1*9.5+seed*.3)*.28*k3;
      float l2=plNoise(q2*1.9+seed)*.5+plNoise(q2*4.3+seed*1.7)*.3+plNoise(q2*9.5+seed*.3)*.28*k3;
      vec3 sq=vec3(1.,hs,1.);
      vec3 p0=vec3(q.x,max(q.y,-.6),q.z)*sq*(.6+l0*.85),p1=vec3(q1.x,max(q1.y,-.6),q1.z)*sq*(.6+l1*.85),p2=vec3(q2.x,max(q2.y,-.6),q2.z)*sq*(.6+l2*.85);
      vec3 nl=normalize(cross(p1-p0,p2-p0));if(dot(nl,q)<0.)nl=-nl;
      vec3 loc=p0*r*sqrt(min(pShow,1.));
      float cy=cos(yaw),sy=sin(yaw);loc.xz=vec2(loc.x*cy-loc.z*sy,loc.x*sy+loc.z*cy);nl.xz=vec2(nl.x*cy-nl.z*sy,nl.x*sy+nl.z*cy);
      float pG=plGust(pRoot);vec2 wb=uGrassWind.xy*(.02+.06*pG)*uGrassA.z*uPlA.z*max(q.y,0.)*r;
      plPos=pRoot+loc+vec3(wb.x,0.,wb.y);
      vec3 rad=normalize(vec3(q.x,q.y*hs+.1,q.z));rad.xz=vec2(rad.x*cy-rad.z*sy,rad.x*sy+rad.z*cy);
      objectNormal=normalize(mix(nl,rad,${OLD_SHRUBS ? '.35' : '.72'}));
      /* darker low down and inside the shrub (its own shade), its colour per shrub: dark green or the willow's grey-green */
      float hv=aC.z*3.+loc.y;
      float ao=mix(.32,1.,smoothstep(-.15,1.3,hv))*mix(.62,1.,smoothstep(-.4,.7,q.y))*mix(.7,1.,smoothstep(.3,.75,l0));
      vec3 c=mix(uPlC[6],uPlC[7],willow)*(.8+.4*aC.w)*(.9+.2*aB.w);
      vPlCol=c*ao;vPlT=.25;vPlRough=willow>.5?.7:.85;vPlLoc=(loc+pRoot*.37)*7.;vPlLeaf=2.;`;
  const BODY = `vec3 objectNormal;
      if(uPlKind<1.5){${LEAF}
      }else{${SHRUB}
      }`;
  /* GRASS_STREAM: the river row rides in the rank (row + rank); a plant rises as its row has grown (flow2-grass.js gsGrow) */
  const one = (src, a, b) => { if (src.split(a).length !== 2) throw new Error('plants stream: shader anchor not found: ' + a.slice(0, 40)); return src.replace(a, () => b); };
  const GS_ROW = 'float gsRow=floor(aA.w),gsRank=aA.w-gsRow;float gsG=gsGrow(gsRow,pRoot,aB.w);gsG=gsG*gsG*(3.-2.*gsG);';
  const bodyGS = () => `vec3 objectNormal;
      if(uPlKind<1.5){${one(one(one(one(LEAF.split('aA.w').join('gsRank'), 'vec3 pRoot=aA.xyz;float pT=position.y,pX=position.x;', 'vec3 pRoot=aA.xyz;float pT=position.y,pX=position.x;' + GS_ROW),
        '*step(fract(aB.w*7.31+aB.y*3.17),.72);', '*step(fract(aB.w*7.31+aB.y*3.17),.72)*gsG;'),
        'float pOn=step(.001,pShow);', 'float pOn=step(.001,pShow)*step(.001,gsG);'), 'L*=mix(.35,1.,sqrt(min(pShow,1.)));', 'L*=mix(.35,1.,sqrt(min(pShow,1.)))*gsG;')}
      }else{${one(one(SHRUB.split('aA.w').join('gsRank'), 'vec3 pRoot=aA.xyz;vec3 pTo=cameraPosition-pRoot;float pD=length(pTo);', 'vec3 pRoot=aA.xyz;vec3 pTo=cameraPosition-pRoot;float pD=length(pTo);' + GS_ROW),
        '1e-4));\n      vec3 q=position;', '1e-4))*gsG;\n      vec3 q=position;')}
      }`;
  function makeMeshes(ground) {
    const { THREE } = ground.ctx, L = G.lib, haze = L.cap.haze, IB = THREE.InstancedInterleavedBuffer, IA = THREE.InterleavedBufferAttribute, BODY_GS = GSX ? bodyGS() : null;
    const leafShape = (() => { const p = [], ix = [], S = 10; for (let l = 0; l <= S; l++) p.push(-.5, l / S, 0, .5, l / S, 0); for (let l = 0; l < S; l++) { const a = l * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } return { p: new Float32Array(p), ix }; })();
    const shrubShape = (() => { const g0 = new THREE.IcosahedronGeometry(1, 2), pos = g0.attributes.position.array; const map = new Map(), p = [], ix = []; for (let v = 0; v < pos.length / 3; v++) { const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], key = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4); let id = map.get(key); if (id === undefined) { id = p.length / 3; map.set(key, id); p.push(x, y, z); } ix.push(id); } g0.dispose(); return { p: new Float32Array(p), ix }; })();
    /* director C's cloud shadows (flow2-valley5-light.js): the sun is dimmed under a passing cloud exactly as on the ground below
       (same function, same uniform object, the same line of three's lights as C's own link); without C's module: nothing */
    const CL = window.__FLOW2_VALLEY5_LIGHT__?.cloud, LFB = THREE.ShaderChunk?.lights_fragment_begin || '', CLA = '? getShadow( directionalShadowMap[ i ]';
    const cloudOk = !!(CL && typeof CL.glsl === 'string' && CL.uniforms?.uV5LCl && LFB.split(CLA).length === 2);
    state.clouds = cloudOk ? 'on' : 'no cloud shadows (light module off or changed)';
    const makeMaterial = (kind, name) => {
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, metalness: 0, side: THREE.DoubleSide, fog: true });
      material.name = 'Flow2 plants ' + name;
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, { uGrassA: L.U.uGrassA, uGrassC: L.U.uGrassC, uGrassLod: L.UB.uGrassLod, uGrassWind: L.UB.uGrassWind }, UP, haze ? haze.uniforms : {}, { uPlKind: { value: kind } }, GSX ? GSX.uniforms : {});
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_PARS + (GSX ? GSX.glsl : ''))
          .replace('#include <beginnormal_vertex>', GSX ? BODY_GS : BODY).replace('#include <begin_vertex>', 'vec3 transformed=plPos;')
          .replace('#include <project_vertex>', '#include <project_vertex>\n      vAlpWorld=plPos;');
        let f = shader.fragmentShader.replace('#include <common>', '#include <common>\n      varying vec3 vPlCol;varying float vPlT;varying float vPlRough;varying vec3 vAlpWorld;varying vec3 vPlLoc;varying float vPlLeaf;\n' + (haze ? haze.decl : '') + `
      float plHashF(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float plNoiseF(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
        return mix(mix(mix(plHashF(i),plHashF(i+vec3(1,0,0)),f.x),mix(plHashF(i+vec3(0,1,0)),plHashF(i+vec3(1,1,0)),f.x),f.y),mix(mix(plHashF(i+vec3(0,0,1)),plHashF(i+vec3(1,0,1)),f.x),mix(plHashF(i+vec3(0,1,1)),plHashF(i+vec3(1,1,1)),f.x),f.y),f.z);}`)
          .replace('#include <map_fragment>', `diffuseColor.rgb=vPlCol;
      if(vPlLeaf>1.5){
        /* the shrub's leaf clusters: lighter tufts and dark gaps, only while a pixel can hold them */
        float fw=length(fwidth(vPlLoc));
        ${OLD_SHRUBS ? '' : `/* a broken, leafy edge: toward the silhouette the crown thins into leaf clusters (gone at a distance, so nothing sparkles) */
        float faceV=abs(dot(normalize(vNormal),normalize(vViewPosition)));float edgeK=1.-smoothstep(.6,1.2,fw);
        float leafN=plNoiseF(vPlLoc*.5+1.3)*.62+plNoiseF(vPlLoc*1.15+4.1)*.38*(1.-smoothstep(.25,.6,fw));
        if(faceV<(1.05*leafN-.2)*edgeK||leafN<.2*edgeK*(1.-faceV*.7))discard;`}float kd=1.-smoothstep(.35,1.1,fw),kc=1.-smoothstep(1.4,4.5,fw);
        float lv=plNoiseF(vPlLoc)*.6+plNoiseF(vPlLoc*2.3+3.1)*.4,cv=plNoiseF(vPlLoc*.27+7.7);
        diffuseColor.rgb*=mix(1.,mix(.5,1.22,smoothstep(.3,.7,cv)),kc)*mix(1.,mix(.45,1.3,smoothstep(.25,.75,lv)),kd);
      }else if(vPlLeaf>.5){
        /* a broad leaf's midrib and a little sheen falling off to its edges */
        float rib=1.-smoothstep(.0,.09,abs(vPlLoc.x));
        diffuseColor.rgb*=mix(.86,1.08,1.-abs(vPlLoc.x)*1.6)+rib*.12;
      }`)
          .replace('#include <roughnessmap_fragment>', 'float roughnessFactor=vPlRough;')
          .replace('#include <normal_fragment_maps>', 'normal=normalize(vNormal)*(vPlLeaf>.5&&vPlLeaf<1.5?faceDirection:1.);')
          .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        /* light through thin leaves when the sun is ahead of the lens */
        reflectedLight.directDiffuse+=directionalLights[0].color*diffuseColor.rgb*(RECIPROCAL_PI*.42*vPlT*pow(max(-dot(normalize(vViewPosition),directionalLights[0].direction),0.),2.));
      #endif`);
        if (haze) f = f.replace('#include <fog_fragment>', haze.block);
        if (cloudOk) { Object.assign(shader.uniforms, { uV5LCl: CL.uniforms.uV5LCl }); f = f.replace('#include <common>', () => '#include <common>'+String.fromCharCode(10) + CL.glsl).replace('#include <lights_fragment_begin>', () => 'float v5lCl=1.-uV5LCl.x*v5lCloud(vAlpWorld.xz);'+String.fromCharCode(10) + LFB.replace(CLA, '? v5lCl * getShadow( directionalShadowMap[ i ]')); }
        if (BKFIX) f = bkFix(f);   /* BLACK_SPECKS */
        shader.fragmentShader = f;
      };
      material.customProgramCacheKey = () => (cloudOk ? 'cl-' : '') + 'flow2-plants' + (haze ? '-haze' : '') + (OLD_SHRUBS ? '-2' : '-3') + (BKFIX ? '-bk' : '') + (GSX ? '-gs1' : '');
      return material;
    };
    const makeSet = (shape, material, name) => {
      const set = { g: null, n: 0, start: -1, count: 0, rows: null };
      const mesh = set.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
      mesh.name = 'Flow2 plants · ' + name; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;   /* in the walls' shadow like the ground */ mesh.renderOrder = 1; mesh.matrixAutoUpdate = false; mesh.visible = false;
      set.load = data => {
        const n = data.n, g = new THREE.InstancedBufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(shape.p, 3)); g.setIndex(shape.ix);
        const fb = new IB(data.f.length ? data.f : new Float32Array(4), 4, 1), bb = new IB(data.b.length ? data.b : new Uint8Array(8), 8, 1);
        for (const buffer of [fb, bb]) buffer.onUpload(function () { this.array = null; });
        const old = set.g; Object.assign(set, { g, fb, bb, n, rows: data.row, start: -1, count: 0 });
        mesh.geometry = g; set.window(0, 0); old?.dispose();
      };
      set.window = (start, length) => {
        const { g, fb, bb, n } = set; if (!g) return;
        start = Math.max(0, Math.min(n, start)); length = Math.max(0, Math.min(n - start, length));
        if (start !== set.start) { g.setAttribute('aA', new IA(fb, 4, start * 4, false)); g.setAttribute('aB', new IA(bb, 4, start * 8, true)); g.setAttribute('aC', new IA(bb, 4, start * 8 + 4, true)); set.start = start; }
        g.instanceCount = length; set.count = length; mesh.visible = length > 0;
      };
      return set;
    };
    const mFar = makeMaterial(0, 'reeds'), mNear = makeMaterial(1, 'ferns'), mShrub = makeMaterial(2, 'shrubs');
    /* (GRASS_STREAM: one such trio per segment, the same three materials) */
    const trio = (tag = '') => ({ far: makeSet(leafShape, mFar, 'reeds, rushes, sedges' + tag), near: makeSet(leafShape, mNear, 'ferns, leaves, hanging grass' + tag), shrub: makeSet(shrubShape, mShrub, 'shrubs' + tag) });
    return { ...trio(), trio };
  }

  /* ------------------------------------------------------------------ build, re-plant, every frame */
  let live = null, ground = null, job = 0, timer = 0;
  /* GRASS_STREAM: the grass's segments (flow2-grass.js); per segment a trio of meshes made from the planted arrays when it is near */
  let GSX = null;
  const pseg = new Map(), psList = s => [s.shrub, s.far, s.near];
  const psEncode = res => { for (const s of [res.far, res.near, res.shrub]) { const f = s.f, row = s.row; for (let i = 0; i < row.length - 1; i++) for (let n = row[i]; n < row[i + 1]; n++) f[n * 4 + 3] = i + Math.min(f[n * 4 + 3], .99987); } };
  const segData = (d, i0, i1) => { const a = d.row[i0], e = d.row[i1], nR = i1 - i0, row = new Uint32Array(nR + 2); for (let l = 0; l <= nR; l++) row[l] = d.row[i0 + l] - a; row[nR + 1] = e - a; return { n: e - a, f: d.f.subarray(a * 4, e * 4), b: d.b.subarray(a * 8, e * 8), row }; };
  function psCreate(k, sets) {
    const sg = GSX.seg[k], res = live.res;
    sets ||= live.trio(' · rows ' + sg.i0 + '-' + sg.i1);
    for (const [s, d] of [[sets.shrub, res.shrub], [sets.far, res.far], [sets.near, res.near]]) { s.load(segData(d, sg.i0, sg.i1)); s.mesh.visible = false; }
    if (live.added) ground.ctx.canyon.scene.add(sets.shrub.mesh, sets.far.mesh, sets.near.mesh);
    const p = { sets, warm: 0, bytes: (sets.shrub.n + sets.far.n + sets.near.n) * 24 }; pseg.set(k, p); return p;
  }
  function psFree(k) { const p = pseg.get(k); if (!p) return; for (const s of psList(p.sets)) { s.mesh.parent?.remove(s.mesh); s.g?.dispose(); s.g = null; s.rows = null; } pseg.delete(k); }
  /* every frame: the windows clipped at the drop's growth front; segments near the lens get their buffers, those far behind let them go */
  function psFrame(row, high, rows, step, qv) {
    const cut = GSX.front + 2, win = r => { const ahead = Math.ceil(r / step) + 2, w = [Math.max(0, row - (high ? ahead : 5)), Math.min(rows - 1, row + ahead)]; w[1] = Math.min(w[1], Math.max(w[0], cut)); return w; };
    const ws = win(320 * qv[1]), wf = win(250 * qv[1]), wn = win(160 * qv[1]);
    const lo = Math.min(ws[0], wf[0], wn[0]) - GSX.BEHIND, hi = Math.max(GSX.need[1], ws[1], wf[1]);
    const segWin = (set, sg, w) => { if (!set.rows) return; const nR = set.rows.length - 2, l0 = Math.max(0, Math.min(nR, w[0] - sg.i0)), l1 = Math.max(0, Math.min(nR, w[1] - sg.i0)); set.window(set.rows[l0], set.rows[l1] - set.rows[l0]); };
    live.stage = Math.min(3, live.stage + 1);
    let drawn = 0, made = false, bytes = 0;
    for (const sg of GSX.seg) {
      let p = pseg.get(sg.k);
      if (!(sg.i1 > lo - 8 && sg.i0 <= hi + 8)) { if (p) psFree(sg.k); continue; }
      if (!p) { if (made || !(sg.i1 > lo && sg.i0 <= hi)) continue; p = psCreate(sg.k); made = true; }   /* (one new segment per frame) */
      const s = p.sets; bytes += p.bytes;
      if (!s.far.mesh.parent) ground.ctx.canyon.scene.add(s.shrub.mesh, s.far.mesh, s.near.mesh);
      segWin(s.shrub, sg, ws); segWin(s.far, sg, wf); segWin(s.near, sg, wn);
      if (live.stage < 2) s.far.mesh.visible = false;
      if (live.stage < 3) s.near.mesh.visible = false;
      /* a new segment's buffers go up one mesh per frame (drawn with no instance until its turn comes) */
      if (p.warm < 3) { psList(s).forEach((x, q) => { if (q > p.warm) x.mesh.visible = false; else if (q === p.warm && !x.mesh.visible && x.g) { x.mesh.visible = true; x.g.instanceCount = 0; } }); p.warm++; }
      for (const x of psList(s)) if (x.mesh.visible) drawn += x.count;
    }
    state.drawn = drawn; state.megabytes = +(bytes / 1048576).toFixed(2);
    state.stream = { on: true, resident: [...pseg.keys()].sort((a, b) => a - b).join(','), gpuMB: state.megabytes, cpuMB: live.res ? +(((live.res.far.n + live.res.near.n + live.res.shrub.n) * 24) / 1048576).toFixed(2) : 0 };
  }
  async function adopt(res, staged) {
    if (GSX) { psEncode(res); live.res = res; for (const k of [...pseg.keys()]) psFree(k); }   /* GRASS_STREAM: the segments come back from the new arrays as they are needed */
    else for (const [set, data] of [[live.shrub, res.shrub], [live.far, res.far], [live.near, res.near]]) { set.load(data); if (staged) await nextFrame(); }
    Object.assign(state, res.counts, { instances: res.far.n + res.near.n + res.shrub.n, plantMs: res.ms, worstSliceMs: res.slice, megabytes: +(((res.far.n + res.near.n + res.shrub.n) * 24) / 1048576).toFixed(2) });
  }
  async function build(g) {
    ground = g; state.plants = 'waiting for the rocks';
    GSX = G.lib?.stream?.on ? G.lib.stream : null;
    g.rocks = await rockFootprints();
    state.plants = 'planting';
    const res = await plant(g, () => false); if (!res) return;
    live = { ...makeMeshes(g), added: false, born: Infinity, stage: 0 };
    await adopt(res, false);
    if (GSX) psCreate(0, { far: live.far, near: live.near, shrub: live.shrub }).warm = 3;   /* the first stretch: the first trio (compiled with it) */
    state.plants = 'planted, waiting for the valley to be live';
    while (!pageLive()) await nextFrame();
    while (!(G.lib.live?.added)) await nextFrame();   /* after the grass's own program (one compile at a time) */
    for (let q = 0; q < 8; q++) await nextFrame();
    const { THREE, renderer, canyon } = g.ctx, warm = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true }), tc = performance.now();
    { const was = renderer.getRenderTarget(); let wait = null; try { renderer.setRenderTarget(warm); wait = renderer.compileAsync(live.far.mesh, canyon.camera, canyon.scene); } catch { wait = null; } finally { renderer.setRenderTarget(was); } try { await wait; } catch { } }
    warm.dispose(); state.compileMs = Math.round(performance.now() - tc);
    await nextFrame();
    if (GSX) { for (const p of pseg.values()) canyon.scene.add(...psList(p.sets).map(s => s.mesh)); }
    else for (const set of [live.shrub, live.far, live.near]) canyon.scene.add(set.mesh);
    api.meshes = [live.far.mesh, live.near.mesh, live.shrub.mesh];
    live.added = true; live.born = performance.now() + 30; state.plants = 'growing in';
  }
  function replant(pause = 300) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!ground || !live?.added) return;
      const id = ++job; state.planting = true;
      try { const res = await plant(ground, () => id !== job); if (res && id === job) await adopt(res, true); } catch (error) { console.warn('flow2 plants: re-planting failed, the old plants stay', error); }
      if (id === job) state.planting = false;
    }, pause);
  }
  G.onScatter = g => { g.rocks = ground?.rocks || null; ground = g; replant(60); };   /* the grass's ground changed (its panel): plant again on it */
  const PLANT_KEYS = new Set(['reeds', 'reedBeds', 'ferns', 'shrubs', 'hangers', 'dry']);
  api.diff = () => { const out = {}; for (const k of Object.keys(DEFAULTS)) if (JSON.stringify(T[k]) !== JSON.stringify(DEFAULTS[k])) out[k] = clone(T[k]); return out; };
  const save = () => { try { const d = api.diff(); if (Object.keys(d).length) localStorage.setItem(KEY, JSON.stringify(d)); else localStorage.removeItem(KEY); } catch { } };
  api.set = (key, value) => { if (!(key in DEFAULTS)) return false; T[key] = value; save(); if (PLANT_KEYS.has(key)) replant(); return true; };
  api.reset = () => { for (const k of Object.keys(DEFAULTS)) T[k] = clone(DEFAULTS[k]); try { localStorage.removeItem(KEY); } catch { } replant(50); };

  let colours = '';
  function frame(now) {
    requestAnimationFrame(frame);
    const shownG = G.lib?.U?.uGrassA?.value?.[0] ?? 0, amt = cl(T.amount, 0, 1, 1);
    /* the ground's share follows the grass's own fade (first frame, lift-off) */
    const qn = qNow();
    UW.uPlG.value[0] = Math.min(1, shownG) * amt * qn.on;
    UW.uPlG.value[1] = cl(T.turfTexture, 0, 2, 1); UW.uPlG.value[2] = cl(T.moss, 0, 2, 1); UW.uPlG.value[3] = cl(T.straw, 0, 2, 1);
    UW.uPlG2.value[0] = cl(T.damp, 0, 2, 1); UW.uPlG2.value[1] = cl(T.mossStreaks, 0, 2, 1); UW.uPlG2.value[2] = cl(T.tussockShade, 0, 2, 1);
    const key = [T.mossColour, T.strawColour, T.seedColour, ...COLOUR_KEYS.map(k => k && T[k])].join();
    if (key !== colours) {
      colours = key; UW.uPlMossC.value = lin(T.mossColour); UW.uPlStrawC.value = lin(T.strawColour);
      const c = UP.uPlC.value; COLOUR_KEYS.forEach((k, q) => { const v = k ? lin(T[k]) : lin('#9c8f62'); c[q * 3] = v[0]; c[q * 3 + 1] = v[1]; c[q * 3 + 2] = v[2]; });
      const sc = lin(T.seedColour); G.lib.UB.uGrassSeedC.value = sc;
    }
    /* seed heads live in the grass's blades */
    if (G.lib?.UB?.uGrassSeed) G.lib.UB.uGrassSeed.value[0] = cl(T.seeds, 0, 2, 1) * amt * qn.on;
    if (!live) return;
    const still = reduced.matches, grown = now < live.born ? 0 : still ? 1 : smooth(0, 1400, now - live.born);
    const qv = UP.uPlQ.value; qv[0] = qStart.dens ? Math.min(1, qn.dens / qStart.dens) : 0; qv[1] = qn.reach; qv[2] = qStart.shrubs ? Math.min(1, qn.shrubs / qStart.shrubs) : 0;
    const a = UP.uPlA.value; a[0] = Math.min(1, shownG) * amt * qn.on; a[1] = grown; a[2] = cl(T.wind, 0, 3, 1); a[3] = cl(T.dry, 0, 1, .3);
    const m = UP.uPlAmt.value; m[0] = Math.min(1, cl(T.reeds, 0, 2, 1)); m[1] = Math.min(1, cl(T.ferns, 0, 2, 1)); m[2] = Math.min(1, cl(T.shrubs, 0, 2, 1)); m[3] = Math.min(1, cl(T.hangers, 0, 2, 1));
    const s = UP.uPlSize.value; s[0] = cl(T.reedHeight, .3, 2.5, 1); s[1] = cl(T.fernSize, .3, 2.5, 1); s[2] = cl(T.shrubSize, .3, 2.5, 1);
    if (!live.added || a[0] * grown <= .001) { live.far.mesh.visible = live.near.mesh.visible = live.shrub.mesh.visible = false; for (const p of pseg.values()) for (const s of psList(p.sets)) s.mesh.visible = false; state.drawn = 0; return; }
    const { rows, step } = ground.ctx, cam = ground.ctx.canyon.camera, row = G.state.row ?? 0;
    const high = cam.position.y > 7;
    if (GSX) { psFrame(row, high, rows, step, qv); if (!state.ready && grown >= 1) { state.ready = true; state.plants = 'on'; resolveReady(state); } return; }   /* GRASS_STREAM */
    const span = (set, reach) => { if (!set.rows) return; const ahead = Math.ceil(reach / step) + 2, r0 = Math.max(0, row - (high ? ahead : 5)), r1 = Math.min(rows - 1, row + ahead); set.window(set.rows[r0], set.rows[r1] - set.rows[r0]); };
    live.stage = Math.min(3, live.stage + 1);
    span(live.shrub, 320 * qv[1]); span(live.far, 250 * qv[1]); span(live.near, 160 * qv[1]);
    if (live.stage < 2) live.far.mesh.visible = false;
    if (live.stage < 3) live.near.mesh.visible = false;
    state.drawn = live.far.count + live.near.count + live.shrub.count;
    if (!state.ready && grown >= 1) { state.ready = true; state.plants = 'on'; resolveReady(state); }
  }
  requestAnimationFrame(frame);
  G.ground.then(g => build(g)).catch(error => { state.plants = 'failed: ' + (error?.message || error); console.warn('flow2 plants: nothing planted', error); resolveReady(state); });
  Object.defineProperty(state, 'wall', { get() { return api.wall.state; }, enumerable: true });
})();
