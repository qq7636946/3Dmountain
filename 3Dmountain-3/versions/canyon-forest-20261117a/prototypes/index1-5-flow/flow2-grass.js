/* Flow2 valley grass (2026-11-14): fine grass and wild flowers in the valley. index1-5-flow2.html only.
   Client: 「加入一些這樣精緻的草」 (reference: a meadow of thin single blades, light tips over dark roots, soft patches, small flowers),
   then 「草皮…在山谷邊也要有一點」 (green on the valley sides too) and 「分布太密集太集中」+ a panel of dials (flow2-grass-panel.js).
   ?grass=0 leaves it out. Desktop drawing only (not on the phone / lighter path).

   What it is, in this canyon's own drawing:
   1. WHERE. The canyon is steep: the gentle ground the flight can see is the low rock shelf at the foot of both walls (from 1.25 m
      above the river: below is the river's wet band), toe slopes where the canyon opens, and the rims of ledges and benches. The two
      bank meshes are read back from the GPU exactly as the wall shader displaces them (alpBankDisp) and measured by slope, height
      and what the eye can see from the river.
   2. GROUND (carries the mass). One link in the walls' program draws turf: on the shelves as scattered patches of many sizes
      (never one solid ribbon), and on the valley sides on every face gentle enough to hold soil, thinner and patchier with height,
      duller and cooler than the shore, carrying the rock's own light and shade.
   3. BLADES (the texture on it). Single blades (11 vertices, tapering to a point, each leaning its own way) in loose tussocks with
      bare gaps, single tufts trailing off beyond each patch, tufts on the rims the eye can see; lit by the scene's lights, fogged by
      the walls' own haze, normals turned towards up; light tips over dark roots; wind as slow travelling waves.
   4. FLOWERS. Small heads (red, pink, violet, white) in loose drifts at blade height.
   Nothing sparkles: a blade is never drawn thinner than about one pixel (farther off, fewer blades, each a pixel wide and nearer the
   ground's colour, until only the ground is left); every pattern is read from a mip-mapped tile. Under "reduce motion" the wind
   stands still. Gone before the lens has climbed out of the canyon (journey 9.7 -> 10.5).

   How: main.js calls window.__FLOW2_FINE_JOURNEY__.canyon() when the canyon is built, before its shaders compile; this file adds
   itself to that call. The walls' program gets one link (uniform prefix uGrass, attribute aGrassM, cache key '|flow2-grass-2',
   anchors on base-shader lines only, no sampler added: its patterns come from the erosion tile that program already reads; a missing
   anchor leaves the walls as they were). Scatter runs in slices of a few milliseconds; the blades' own program is compiled after
   the valley is live. 3 draw calls; only a window of instances along the river is drawn.
   Live: window.__FLOW2_GRASS__ = { tune, defaults, state, whenReady, set(key, value), reset(), diff() }. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('grass') === '0') return;
  const BASE = document.currentScript?.src || new URL('prototypes/index1-5-flow/flow2-grass.js', document.baseURI).href;
  const DEFAULTS = {
    amount: 1,            // all of it (0 = none)
    /* colour (sRGB albedo) */
    tip: '#86a85a', root: '#1f3a22', dry: '#b0b468', cool: '#4f8f66',
    dryShare: .5,         // how much of the grass is the drier colour (0 = none, 1 = most)
    ground: '#3c6238',    // the turf under and beyond the blades on the shelves
    wallColour: '#3a5840',// the turf on the valley sides
    flowerColours: ['#d0444e', '#e394ae', '#9480d6', '#f0f2ec'],
    gain: .88,            // brightness of all of it
    backlight: .42,       // tips lit from behind when the sun is ahead
    /* density */
    density: 1,           // blades per square metre, as a factor (1 = about 30 where a tussock stands)
    nearBoost: 1,         // extra blades close to the lens (1 = none; 2 = twice as many within about 12 m)
    far: 240,             // metres: beyond it only the ground is drawn
    minPixels: 1.15,      // a blade is never drawn thinner than this many device pixels
    /* distribution */
    coverage: 1,          // how much of the plantable ground is green (lower = fewer, smaller patches)
    scatter: .7,          // 0 = solid meadows that follow the ground ... 1 = scattered patches of every size
    patch: 1,             // size of the patches and tussocks (1 = tussocks of 1-4 m, patches of 3-30 m)
    gap: .5,              // bare ground between the tussocks (0 = blades everywhere on the turf)
    band: 1,              // how far from the shore the meadow reaches (1 = about 30-50 m)
    wall: 1,              // turf on the valley sides (0 = the shore only)
    wallTop: 74,          // metres above the water where the sides' green has thinned to nothing
    wallSlope: 58,        // degrees: the steepest face that still holds turf (the limit itself is broken by noise)
    lowest: 1.25,         // metres above the water: nothing below (the wet band is the river's)
    /* shape */
    height: 1,            // 1 = about 0.4-1.6 m, taller tufts to 2 m: tall shore grass, so it reads from the river
    heightVar: 1,         // how much height differs between patches, tussocks and blades
    width: 1,             // 1 = about 3.4 cm at the foot
    bend: 1,              // how far a blade leans over by itself
    /* flowers */
    flowers: 1,           // 0 = none, 2 = twice as many
    flowerSize: 1,
    flowerDrift: .7,      // 0 = spread evenly ... 1 = in tight drifts
    /* wind */
    wind: 1, windSpeed: 3.2, windDir: [.3, .95],   // strength, metres per second the waves travel, towards (x, z)
    debug: 0              // 1 = show the planted share on the walls
  };
  const clone = v => JSON.parse(JSON.stringify(v));
  const T = clone(DEFAULTS), KEY = 'flow2-grass-tune-1';
  const take = from => { if (!from || typeof from !== 'object') return; for (const k of Object.keys(DEFAULTS)) { const v = from[k], d = DEFAULTS[k]; if (v === undefined || v === null) continue; if (Array.isArray(d)) { if (Array.isArray(v) && v.length === d.length && v.every((x, i) => typeof x === typeof d[i])) T[k] = v.slice(); } else if (typeof v === typeof d && (typeof v !== 'number' || Number.isFinite(v))) T[k] = v; } };
  try { take(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { }
  try { if (Q.get('grassTune')) take(JSON.parse(Q.get('grassTune'))); } catch { }
  for (const [param, key] of [['grassAmt', 'amount'], ['grassDensity', 'density'], ['grassHeight', 'height'], ['grassWidth', 'width'], ['grassWind', 'wind'], ['grassFlowers', 'flowers'], ['grassWall', 'wall']]) { const v = parseFloat(Q.get(param)); if (Number.isFinite(v)) T[key] = v; }
  const state = { grass: 'waiting for the canyon', ground: 'waiting for the canyon', haze: '-', ready: false };
  /* quality tiers (flow2-quality.js): the tier the page STARTED at decides how many blades are planted and the wind's detail; a
     step down while the page runs only thins what is drawn (a uniform) and shortens the reach (never a new scatter or compile).
     Every factor multiplies the client's own values (their stored dials are never overwritten).
       high   as designed · medium   half the blades and flowers, 72 % of the reach, one-octave wind
       low    the green ground (turf) and a sparse ring of tufts within about 45 m of the lens; no flowers */
  const QL = window.__FLOW2_QUALITY__, QSTART = QL?.start || 'high';
  const QF = { high: { dens: 1, reach: 1, flowers: 1 }, medium: { dens: .5, reach: .72, flowers: .5 }, low: { dens: .22, reach: .19, flowers: 0 } };
  const qStart = QF[QSTART] || QF.high, qNow = () => QF[QL?.level] || qStart;
  state.quality = QSTART;
  QL?.on?.(({ level }) => { state.quality = QSTART + ' (now ' + level + ')'; });
  let resolveReady; const whenReady = new Promise(r => { resolveReady = r; });
  const api = window.__FLOW2_GRASS__ = { tune: T, defaults: clone(DEFAULTS), state, whenReady };
  const cl = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

  /* ------------------------------------------------------------------ shared drawing rules (walls, blades and the planting evaluate the same) */
  const U = {
    uGrassA: { value: [0, 0, 1, 1] },          // shown (0-1; 2 = debug), time, wind, flowers
    uGrassB: { value: [.5, 0, 0, .88] },       // dry share, -, -, gain
    uGrassC: { value: [1, .53, 74, .001] },    // the valley sides: amount, slope limit (cosine), height where it is gone; metres per pixel at 1 m
    uGrassD: { value: [1, .7, 1, .5] },        // coverage, scatter, patch size, gap between tussocks
    uGrassRoot: { value: [.03, .07, .04] }, uGrassTip: { value: [.27, .45, .14] }, uGrassDry: { value: [.45, .5, .22] }, uGrassCool: { value: [.2, .36, .2] },
    uGrassGround: { value: [.05, .12, .04] }, uGrassWallC: { value: [.04, .1, .05] }
  };
  const UB = {
    uGrassLod: { value: [34, 240, .001, .95] },     // distance at which a blade is one pixel wide, far end, pixel floor per metre of distance, blade height
    uGrassWind: { value: [.3, .95, 3.2, .034] },    // wind direction x z, speed, blade width
    uGrassE: { value: [1, 1, 1, 1] },               // height variation, own bend, near boost, flower size
    uGrassBack: { value: .42 }, uGrassGrow: { value: 0 },
    uGrassQ: { value: [1, 1, 1, 1] },   // quality: share of the planted blades drawn (a step down while the page runs)
    uGrassSeed: { value: [0, .16, 0, 0] }, uGrassSeedC: { value: [.36, .27, .2] },   // seed heads: amount (0 = none), share of blades; colour
    uGrassFl: { value: new Float32Array(12) }
  };
  const SHARED = `
uniform vec4 uGrassA,uGrassB,uGrassC,uGrassD;uniform vec3 uGrassRoot,uGrassTip,uGrassDry,uGrassCool,uGrassGround,uGrassWallC;
/* The one noise behind every rule: the height channel of the page's own erosion tile (branching ridges over hollows), read at the
   mip level of the pixel's (or the blade's) footprint: nothing new to load or bind, and it cannot alias in the distance. */
float f2gT(vec2 at,float tile,float foot){tile*=uGrassD.z;return pow(clamp((textureLod(alpineErosion,at/tile,log2(max(foot*1024./tile,1.))).b-.3)*2.,0.,1.),.6);}
/* three readings of a place: tiles of 150 m, 37 m and 420 m. Everything below is built from these. */
vec3 f2gBase(vec2 xz,float foot){return vec3(f2gT(xz+vec2(55.,17.),150.,foot),f2gT(mat2(.8,.6,-.6,.8)*xz+vec2(26.,11.),37.,foot),f2gT(mat2(.6,-.8,.8,.6)*xz+vec2(160.,90.),420.,foot));}
/* broad soft patches: x = fresh (0) to dry (1), y = cooler and darker */
vec2 f2gPatch(vec3 n){return vec2(smoothstep(.36,.72,n.x*.75+n.z*.25+(uGrassB.x-.5)*.7),smoothstep(.4,.76,n.z*.7+(1.-n.x)*.3));}
vec3 f2gTipC(vec2 pt){return mix(mix(uGrassTip,uGrassDry,pt.x*.85),uGrassCool,pt.y*.55*(1.-pt.x*.6))*mix(1.,.78,pt.y*(1.-pt.x));}
vec3 f2gRootC(vec2 pt){return uGrassRoot*mix(vec3(1.),vec3(1.14,1.06,.88),pt.x*.5)*mix(1.,.9,pt.y);}
vec3 f2gGroundC(vec2 pt){return uGrassGround*mix(vec3(1.),vec3(1.2,1.1,.82),pt.x*.55)*mix(1.,.8,pt.y*(1.-pt.x));}
/* The shore meadow: the ground's own share m (per wall vertex, per blade) carved by the fine and the broad reading into patches
   of many sizes (uGrassD.y: how scattered), more or fewer of them (uGrassD.x); turf where it passes .5 */
float f2gEdge(float m,vec3 n){return m+(uGrassD.x-1.)*.45+((n.y-.5)*.55+(n.x-.5)*.45)*(.25+1.25*uGrassD.y);}
/* Green on the valley sides: turf where this passes .5. On every face gentle enough to hold soil (the limit, uGrassC.y, is broken
   by the noise; gullies hold a little more), nearly everywhere low, thinner and patchier with height, gone by uGrassC.z; here and
   there a tongue climbs a steeper wall foot from the shelf. up = the face's upness, ero = the wall's own gully depth. */
float f2gWall(vec3 p,float up,float ero,vec3 n,float foot){
  float tongue=smoothstep(.55,.8,n.z)*(1.-smoothstep(5.,17.,p.y));
  float lim=uGrassC.y+(n.x-.5)*.2-.1*tongue;
  float hold=smoothstep(lim-.12,lim+.12,up-min(ero,0.)*.5);
  float high=1.-smoothstep(10.,uGrassC.z,p.y+(n.x-.5)*28.);
  /* (patches by a reading laid on the face itself, height included: on steep ground one laid flat would run down it in streaks) */
  float pn=f2gT(vec2(p.x+p.z*.71,p.y*1.4+p.z*.37)+vec2(9.,31.),46.,foot);
  return hold*smoothstep(1.3,2.4,p.y)*clamp(.5+(pn-mix(.96,.14,high)+.2*tongue+(uGrassD.x-1.)*.3)*2.2,0.,1.)*step(.002,high)*uGrassC.x;
}
`;
  /* blades only: height in broad patches, tussocks (clumps of 1 to 4 m, taller and a little lighter than the grass between), and a
     smooth noise for the wind */
  const SHARED_BLADES = `
float f2gTall(vec3 n){return mix(.6,1.3,smoothstep(.2,.8,(1.-n.z)*.55+(1.-n.x)*.45));}
float f2gClump(vec2 xz,float foot){float c=smoothstep(.2,.8,f2gT(mat2(.6,.8,-.8,.6)*xz+vec2(3.,7.),19.,foot)*.6+f2gT(xz+vec2(11.,5.),7.,foot)*.4);return c*c*(1.+.5*smoothstep(.55,.85,f2gT(xz+vec2(40.,2.),61.,foot)));}
float f2gHash(vec2 p){uvec2 q=uvec2(ivec2(floor(p))+ivec2(40000));uint n=q.x*1597334677u^q.y*3812015801u;n=(n^(n>>15u))*2246822519u;n^=n>>13u;return float(n>>8u)*(1./16777216.);}
float f2gNoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(f2gHash(i),f2gHash(i+vec2(1.,0.)),u.x),mix(f2gHash(i+vec2(0.,1.)),f2gHash(i+vec2(1.,1.)),u.x),u.y);}
`;

  /* ------------------------------------------------------------------ the walls: turf on the shelves and on the valley sides (one link in their program) */
  const WALL_ANCHOR = '      diffuseColor.rgb*=alpAlbedo;';
  const WALL_NEEDS = ['vec3 Nr=Ng;', 'float eroH=0.;', 'float rockFlatL=', 'float camD=', 'float foot=', 'vec3 N0=', 'float aLuma(', 'vec3 rock='];
  const WALL_GLSL = `
      #ifdef OPAQUE
      /* flow2 grass (flow2-grass.js): turf on the shelves (the meadow's own ground) and on the valley sides */
      float f2gKo=0.,f2gKso=0.,f2gMo=0.;
      if(uGrassA.x>.001&&(vGrassM>.02||(uGrassC.x>.001&&P.y>1.3&&P.y<uGrassC.z+16.&&N0.y>(P.y<17.?.2:.3)))){
        /* (edges are softened by the pixel's footprint, measured outside this branch: no derivative in here, so it stays a real branch) */
        float f2gOn=min(uGrassA.x,1.),f2gE=min(foot*.3,.25)+.04,f2gUp=smoothstep(.6,.8,N0.y);
        vec3 f2gN=f2gBase(P.xz,foot);
        float f2gM=vGrassM>.02?f2gEdge(vGrassM,f2gN):0.;
        float f2gKs=smoothstep(.5-f2gE,.5+f2gE,f2gM)*f2gUp;                                   /* the shore meadow */
        /* the sides: by the wall's broad slope, a little by its fine relief close to the lens (small ledges), more in its gullies */
        float f2gKw=N0.y>.2?smoothstep(.45-f2gE*1.6,.55+f2gE*1.6,f2gWall(P,N0.y+(Nr.y-N0.y)*.4*(1.-smoothstep(.06,.4,foot)),eroH,f2gN,foot)):0.;
        float f2gK=max(f2gKs,f2gKw)*f2gOn;f2gKo=f2gK;f2gKso=f2gKs*f2gOn;f2gMo=f2gM;
        alpAlbedo*=1.-.3*smoothstep(.36,.5,f2gM)*f2gUp*f2gOn*(1.-f2gK);   /* a darker soil line just outside the turf */
        if(f2gK>.001){
          vec2 f2gP=f2gPatch(f2gN);
          float f2gSide=1.-f2gKs/max(max(f2gKs,f2gKw),1e-4);                                  /* 0 = shore meadow, 1 = valley side */
          /* on the sides: its own duller, cooler colour, in two greens in soft patches, steeper = darker, and carrying the rock's own
             light and shade (hollows darker, ribs lighter): never flat paint */
          vec3 f2gCw=uGrassWallC*mix(vec3(1.),vec3(1.16,1.08,.86),f2gP.x*.5)*clamp(pow(aLuma(rock)/rockFlatL,.7),.5,1.4)
            *mix(.72,1.16,smoothstep(.25,.75,f2gN.x*.5+f2gN.y*.5))*mix(.7,1.,smoothstep(.42,.72,N0.y));
          vec3 f2gC=mix(f2gGroundC(f2gP)*mix(.8,1.12,f2gN.y),f2gCw,f2gSide)*uGrassB.w;   /* (the turf itself a little lighter and darker in small patches) */
          vec3 f2gNt=normalize(N0+vec3(0.,mix(1.,.4,f2gSide),0.));float f2gR=.96;
          /*PL_TURF*/
          alpAlbedo=mix(alpAlbedo,f2gC,f2gK);alpRough=mix(alpRough,f2gR,f2gK);alpWet*=1.-f2gK;
          alpN=normalize(mix(alpN,f2gNt,f2gK*mix(1.,.55,f2gSide)));
        }
        if(uGrassA.x>1.5)alpAlbedo=vec3(vGrassM,f2gKs,f2gKw);
      }
      /*PL_ROCK*/
      #endif
`;
  const count = (s, a) => s.split(a).length - 1;
  const cap = { erosion: null, relief: null, disp: null, haze: null, seen: false };
  const DISP_FALLBACK = `
        float alpBankH(vec3 p,vec3 n){
          vec3 w=pow(abs(n),vec3(4.));w/=max(dot(w,vec3(1.)),1e-4);
          float h=textureLod(alpineErosion,vec2(p.z,p.y*.62)/64.,0.).b*w.x+textureLod(alpineErosion,p.xz/64.,0.).b*w.y+textureLod(alpineErosion,vec2(p.x,p.y*.62)/64.,0.).b*w.z;
          float f=textureLod(alpineErosion,vec2(p.z,p.y*.7)/21.+.37,0.).b*w.x+textureLod(alpineErosion,p.xz/21.+.37,0.).b*w.y+textureLod(alpineErosion,vec2(p.x,p.y*.7)/21.+.37,0.).b*w.z;
          return clamp(h*.72+f*.28-.28,0.,1.);
        }
        vec4 alpBankDisp(vec3 p,vec3 n){
          float amp=6.*uCliffRelief*smoothstep(3.,14.,p.y)*(1.-smoothstep(.62,.9,n.y));
          if(amp<=.001)return vec4(n,0.);
          vec3 t1=normalize(cross(n,abs(n.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.))),t2=cross(n,t1);
          float e=1.6,h0=alpBankH(p,n),h1=alpBankH(p+t1*e,n),h2=alpBankH(p+t2*e,n);
          vec3 p0=n*h0*amp,p1=t1*e+n*h1*amp,p2=t2*e+n*h2*amp;
          vec3 nn=normalize(cross(p1-p0,p2-p0));if(dot(nn,n)<0.)nn=-nn;
          return vec4(nn,h0*amp);
        }`;
  /* the walls' own haze (alpine-atmosphere.js, as flow2-valley3-far.js left it), copied from their compiled shader so the
     blades fog exactly like the ground they stand on; anything unexpected in it and the blades use the scene's plain fog */
  function takeHaze(f, uniforms) {
    const a = f.indexOf('#ifdef USE_FOG\n  {'); if (a < 0) return 'no haze block';
    const b = f.indexOf('gl_FragColor.rgb = mix( gl_FragColor.rgb, alpCol, alpAmt );', a); if (b < 0) return 'haze block has no end';
    const c = f.indexOf('#endif', b); if (c < 0 || c - a > 6000) return 'haze block has no end';
    const block = f.slice(a, c + 6), bare = block.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const names = [...new Set(bare.match(/\bu[A-Z]\w*\b/g) || [])];
    let decl = ''; const us = {};
    for (const n of names) {
      const m = f.match(new RegExp('uniform\\s+(?:(?:highp|mediump|lowp)\\s+)?(\\w+)\\s+[^;]*\\b' + n + '\\b[^;]*;'));
      if (!m || !uniforms[n]) return 'haze uniform not found: ' + n;
      decl += 'uniform ' + m[1] + ' ' + n + ';\n'; us[n] = uniforms[n];
    }
    const known = /^(ifdef|ifndef|if|else|endif|define|USE_FOG|FOG_EXP2|float|vec2|vec3|vec4|exp|pow|max|min|abs|mix|dot|clamp|length|smoothstep|texture2D|normalize|sqrt|log|fogDensity|fogNear|fogFar|fogColor|vFogDepth|vAlpWorld|cameraPosition|gl_FragColor|rgb|xyz|xy|xz|zw|x|y|z|w|r|g|b|a|alp\w*|e\d*)$/;
    for (const w of bare.match(/[A-Za-z_]\w*/g) || []) if (!known.test(w) && !names.includes(w)) return 'haze block uses ' + w;
    return { block, decl, uniforms: us };
  }
  function walls(built) {
    const seen = new Set();
    built.scene.traverse(object => {
      for (const material of [].concat(object.material || [])) {
        if (!material?.userData?.alpineTerrain || seen.has(material) || typeof material.onBeforeCompile !== 'function') continue;
        seen.add(material);
        const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
        material.onBeforeCompile = function (shader, renderer) {
          compile.call(this, shader, renderer);
          const f = shader.fragmentShader, v = shader.vertexShader;
          /* the walls' full program only (not the phone's, not the mountains seen from the air, not the shore stones) */
          if (!f.includes('#define ALP_BANK\n') || f.includes('#define ALP_LITE\n') || f.includes('uGrassA')) return;
          if (!cap.seen) {
            cap.seen = true; cap.erosion = shader.uniforms.alpineErosion || null; cap.relief = shader.uniforms.uCliffRelief || null;
            const a = v.indexOf('float alpBankH('), b = a < 0 ? -1 : v.indexOf('#endif', a), src = b > a ? v.slice(a, b) : '';
            cap.disp = src.includes('vec4 alpBankDisp(') && src.length < 4000 ? src : null;
            const haze = takeHaze(f, shader.uniforms); cap.haze = typeof haze === 'string' ? null : haze; state.haze = typeof haze === 'string' ? 'the scene\'s plain fog (' + haze + ')' : 'the walls\' own';
          }
          if (Q.get('grassGround') === '0') { state.ground = 'off (?grassGround=0)'; return; }
          const ok = WALL_NEEDS.every(n => f.includes(n)) && /uniform sampler2D[^;]*\balpineErosion\b/.test(f) && count(f, WALL_ANCHOR) === 1 && count(f, 'void main() {') === 1 && count(v, 'void main() {') === 1 && count(v, '#include <begin_vertex>') === 1;
          if (!ok) { state.ground = 'the wall shader has changed: left as it was'; return; }
          /* the plants module's ground (flow2-plants.js: turf texture, moss, straw, soil): spliced into this link when it is on and its
             own base-shader names are all there; otherwise the link is exactly the afternoon's */
          const PW = window.__FLOW2_PLANTS__?.wall, plOk = !!PW && (PW.needs || []).every(n => f.includes(n)) && (PW.needsV || []).every(n => v.includes(n));
          let wall = WALL_GLSL;
          if (plOk) wall = wall.replace('/*PL_TURF*/', () => PW.turf || '').replace('/*PL_ROCK*/', () => PW.rock || '');
          shader.fragmentShader = f.replace('void main() {', () => SHARED + 'varying float vGrassM;\n' + (plOk ? PW.pars || '' : '') + 'void main() {').replace(WALL_ANCHOR, () => wall + WALL_ANCHOR);
          shader.vertexShader = v.replace('void main() {', () => 'attribute float aGrassM;varying float vGrassM;\n' + (plOk ? PW.vpars || '' : '') + 'void main() {').replace('#include <begin_vertex>', () => '#include <begin_vertex>\n      vGrassM=aGrassM;' + (plOk ? PW.vbody || '' : ''));
          for (const k of Object.keys(U)) shader.uniforms[k] = U[k];
          if (plOk) for (const k of Object.keys(PW.uniforms || {})) shader.uniforms[k] = PW.uniforms[k];
          if (PW) PW.state = plOk ? 'on' : 'the wall shader has changed: plants ground left out (' + [...(PW.needs || []).filter(n => !f.includes(n)), ...(PW.needsV || []).filter(n => !v.includes(n))].join(', ') + ')';
          state.ground = 'on';
        };
        material.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|flow2-grass-3' + (window.__FLOW2_PLANTS__?.wall ? '|flow2-plants-' + (window.__FLOW2_PLANTS__.wall.version || 1) : ''); };
        material.needsUpdate = true;
      }
    });
    if (!seen.size) state.ground = 'no terrain material found';
  }

  /* ------------------------------------------------------------------ small tools */
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const h2 = (x, y) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /* work in slices: each pause waits for the next drawn frame (never several slices in one frame) */
  const nextFrame = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(go); setTimeout(go, 160); });
  const pageLive = () => !!document.body?.classList.contains('is-ready') && document.documentElement.dataset.flow2Still !== 'on';
  /* (while the still picture covers the page nothing is drawn: longer slices; once the valley is live, short ones) */
  const slicer = () => { let t = performance.now(), worst = 0; return { get worst() { return worst; }, mark() { t = performance.now(); }, async rest(force) { const d = performance.now() - t, live = pageLive(); if (d > (live ? 4 : 7) || force) { worst = Math.max(worst, d); await nextFrame(); t = performance.now(); } } }; };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------ once: the ground as the walls' shader really draws it */
  let ctx = null, groundResolve = null;
  api.ground = new Promise(r => { groundResolve = r; });
  async function prepare({ THREE, renderer, canyon }) {
    const S = slicer();
    const banks = canyon.scene.children.filter(m => m.userData?.rim && /shore detail/.test(m.name || '')).sort((a, b) => (/West/.test(a.name) ? 0 : 1) - (/West/.test(b.name) ? 0 : 1));
    if (banks.length !== 2) { state.grass = 'the two banks were not found: nothing planted'; return null; }
    const { rows, columns: cols } = banks[0].userData.rim;
    if (banks[1].userData.rim.rows !== rows || banks[1].userData.rim.columns !== cols || !cap.erosion?.value) { state.grass = 'the banks are not as expected: nothing planted'; return null; }
    /* 1. the banks exactly as the wall shader displaces them: its own function, run on the GPU, read back once (positions, shading normals) */
    state.grass = 'reading the ground';
    const P = new Float32Array(rows * 2 * cols * 4), N = new Float32Array(rows * 2 * cols * 4);
    {
      const target = new THREE.WebGLRenderTarget(cols, rows * 2, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      const scene = new THREE.Scene(), eye = new THREE.Camera(), mode = { value: 0 };
      const material = new THREE.ShaderMaterial({
        uniforms: { alpineErosion: cap.erosion, uCliffRelief: cap.relief || { value: 1 }, uMode: mode }, depthTest: false, depthWrite: false,
        vertexShader: `attribute vec2 aCell;uniform sampler2D alpineErosion;uniform float uCliffRelief,uMode;varying vec4 vOut;${cap.disp || DISP_FALLBACK}
          void main(){vec3 n=normalize(normal);vec4 bd=alpBankDisp(position,n);vOut=uMode<.5?vec4(position+normal*bd.w,bd.w):vec4(bd.xyz,1.);gl_Position=vec4(aCell*2.-1.,0.,1.);gl_PointSize=1.;}`,
        fragmentShader: 'varying vec4 vOut;void main(){gl_FragColor=vOut;}'
      });
      const made = [];
      banks.forEach((bank, k) => {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', bank.geometry.attributes.position); g.setAttribute('normal', bank.geometry.attributes.normal);
        const cell = new Float32Array(rows * cols * 2);
        for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { cell[(i * cols + j) * 2] = (j + .5) / cols; cell[(i * cols + j) * 2 + 1] = (i + k * rows + .5) / (rows * 2); }
        g.setAttribute('aCell', new THREE.BufferAttribute(cell, 2));
        const points = new THREE.Points(g, material); points.frustumCulled = false; scene.add(points); made.push(g);
      });
      await S.rest(true);
      try { await renderer.compileAsync(scene, eye); } catch { }
      S.mark(); await S.rest(true);
      for (const [m, into] of [[0, P], [1, N]]) {
        const was = renderer.getRenderTarget(); mode.value = m;
        renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, eye); renderer.setRenderTarget(was);
        if (renderer.readRenderTargetPixelsAsync) await renderer.readRenderTargetPixelsAsync(target, 0, 0, cols, rows * 2, into);
        else renderer.readRenderTargetPixels(target, 0, 0, cols, rows * 2, into);
        S.mark(); await S.rest(true);
      }
      target.dispose(); material.dispose(); for (const g of made) { g.deleteAttribute('position'); g.deleteAttribute('normal'); g.dispose(); }
    }
    if (!(Math.abs(P[4 * (cols * 300 + 5)]) + Math.abs(P[4 * (cols * 300 + 5) + 2]) > 0)) { state.grass = 'the ground could not be read: nothing planted'; return null; }
    /* 2. the erosion tile's height channel, for the planting to read the same patterns the shaders read */
    let ero = null;
    try {
      const tex = cap.erosion.value, img = tex.image, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, w, h).data, v = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) v[i] = d[i * 4 + 2];
      ero = { v, w, h, flip: tex.flipY !== false };
    } catch (error) { ero = null; state.tile = 'could not be read: the planting ignores the patterns'; }
    S.mark(); await S.rest(true);
    const curve = canyon.curve, widthAt = canyon.widthAt;
    const cen = new Float32Array(rows * 2), half = new Float32Array(rows);
    for (let i = 0; i < rows; i++) { const c = curve.getPointAt(i / (rows - 1)); cen[i * 2] = c.x; cen[i * 2 + 1] = c.z; half[i] = widthAt(i / (rows - 1)); if (!(i & 63)) await S.rest(); }
    const lat = j => Math.pow(j / (cols - 1), 1.62) * 250;
    return { THREE, renderer, canyon, banks, rows, cols, P, N, ero, cen, half, latJ: Float32Array.from({ length: cols }, (_, j) => lat(j)), index: banks.map(b => b.geometry.index.array), step: curve.getLength() / (rows - 1) };
  }

  /* ------------------------------------------------------------------ the scatter: where turf may be (per wall vertex) and every blade and flower.
     Repeatable: the panel's distribution dials call it again; stale() says a newer call has started. */
  const RF = .3, LAST = 545, D0REF = 36;
  let lastRules = null;   /* far-set rank; no blade beyond this row (never near enough to show one); the reference one-pixel distance */
  async function scatter(stale) {
    const S = slicer(), t0 = performance.now();
    const { rows, cols, P, N, ero, cen, half, latJ, index } = ctx;
    const patch = cl(T.patch, .3, 4, 1), cov = cl(T.coverage, 0, 2, 1), sca = cl(T.scatter, 0, 1, .7), gap = cl(T.gap, 0, 1, .5), band = cl(T.band, .2, 3, 1);
    const wallAmt = cl(T.wall, 0, 1.5, 1), wallCos = Math.cos(cl(T.wallSlope, 20, 80, 58) * Math.PI / 180), wallTop = cl(T.wallTop, 20, 160, 74), lowest = cl(T.lowest, .6, 6, 1.25);
    const boost = cl(T.nearBoost, 1, 4, 1), DENS = 30 * cl(T.density, .05, 4, 1) * boost * qStart.dens, RIM = .22, drift = cl(T.flowerDrift, 0, 1, .7);
    let JMAX = 2; while (JMAX < cols - 2 && latJ[JMAX] < Math.min(100, 56 * band)) JMAX++;
    let JW = JMAX; while (JW < cols - 2 && latJ[JW] < 100) JW++;
    /* the shaders' rules, on the CPU (the tile read at its finest level) */
    const E = ero?.v, EW = ero?.w || 1, EH = ero?.h || 1, flip = ero?.flip;
    const eT = E ? (ax, ay, tile) => {
      tile *= patch; let u = ax / tile, v = ay / tile; u -= Math.floor(u); v -= Math.floor(v);
      const x = u * EW - .5, y = (flip ? 1 - v : v) * EH - .5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const xa = (x0 + EW) % EW, xb = (x0 + 1 + EW) % EW, ya = (y0 + EH) % EH, yb = (y0 + 1 + EH) % EH;
      const t = (((E[ya * EW + xa] * (1 - fx) + E[ya * EW + xb] * fx) * (1 - fy) + (E[yb * EW + xa] * (1 - fx) + E[yb * EW + xb] * fx) * fy) / 255 - .3) * 2;
      return t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(t, .6);
    } : () => .5;
    const n3 = [0, 0, 0];
    lastRules = () => ({ eT, base, n3, edge: m => edge(m), wallF: (x, y, z, up) => wallF(x, y, z, up), clump: (x, z) => clump(x, z) });
    const base = (x, z) => { n3[0] = eT(x + 55, z + 17, 150); n3[1] = eT(.8 * x - .6 * z + 26, .6 * x + .8 * z + 11, 37); n3[2] = eT(.6 * x + .8 * z + 160, -.8 * x + .6 * z + 90, 420); };
    const edge = m => m + (cov - 1) * .45 + ((n3[1] - .5) * .55 + (n3[0] - .5) * .45) * (.25 + 1.25 * sca);
    const wallF = (x, y, z, up) => {
      const tongue = smooth(.55, .8, n3[2]) * (1 - smooth(5, 17, y)), lim = wallCos + (n3[0] - .5) * .2 - .1 * tongue;
      const hold = smooth(lim - .12, lim + .12, up), high = 1 - smooth(10, wallTop, y + (n3[0] - .5) * 28); if (high < .002) return 0;
      const pn = eT(x + z * .71 + 9, y * 1.4 + z * .37 + 31, 46);
      return hold * smooth(1.3, 2.4, y) * Math.min(1, Math.max(0, .5 + (pn - (.96 + (.14 - .96) * high) + .2 * tongue + (cov - 1) * .3) * 2.2)) * wallAmt;
    };
    const clump = (x, z) => { const c = smooth(.2, .8, eT(.6 * x - .8 * z + 3, .8 * x + .6 * z + 7, 19) * .6 + eT(x + 11, z + 5, 7) * .4); return c * c * (1 + .5 * smooth(.55, .85, eT(x + 40, z + 2, 61))); };

    /* 1. per wall vertex: M = the shore meadow's share (broad and soft: the shader carves it into patches), R = the sides' rims and slopes in view */
    const M = [new Float32Array(rows * cols), new Float32Array(rows * cols)], R = [new Float32Array(rows * cols), new Float32Array(rows * cols)];
    const tmp = new Float32Array(rows * cols), cellOK = new Float32Array(rows * cols);
    for (let k = 0; k < 2; k++) {
      const o = k * rows * cols, m = M[k], r = R[k];
      const X = n => P[(o + n) * 4], Y = n => P[(o + n) * 4 + 1], Z = n => P[(o + n) * 4 + 2];
      cellOK.fill(0);
      for (let i = 0; i < rows - 1; i++) {
        for (let j = 0; j < JMAX; j++) {
          const a = i * cols + j, b = a + cols, c = a + 1, d = b + 1; let ar = 0, ny = 0;
          for (let s = 0; s < 2; s++) {
            const p = s ? b : a, q = s ? d : b;
            const ux = X(q) - X(p), uy = Y(q) - Y(p), uz = Z(q) - Z(p), vx = X(c) - X(p), vy = Y(c) - Y(p), vz = Z(c) - Z(p);
            const nx = uy * vz - uz * vy, nyy = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, nyy, nz);
            ar += l * .5; ny += Math.abs(nyy) * .5;
          }
          cellOK[a] = smooth(.55, .8, ny / Math.max(ar, 1e-6));
        }
        if (!(i & 31)) { await S.rest(); if (stale()) return null; }
      }
      for (let i = 0; i < rows; i++) {
        /* along the river: fuller and thinner reaches (never a hard gap: the patches themselves leave the bare rock) */
        const along = .5 + .5 * smooth(.2, .5, vnoise(i * .021 + k * 31.7, 3.1) * .62 + vnoise(i * .068 + k * 11.3, 9.4) * .38 + .2 * smooth(30, 48, i) * (1 - smooth(150, 185, i)));
        const ends = smooth(40, 47, i) * (1 - smooth(rows - 46, rows - 30, i));   /* (the journey starts at row 50) */
        const ex = cen[i * 2], ez = cen[i * 2 + 1]; let horizon = -9;
        /* low shelves everywhere; toe slopes higher where the canyon opens (entrance, outlet) */
        const top = 8 + 9 * Math.max(1 - smooth(60, 100, i), smooth(520, 570, i)), endsR = i >= 46 && i <= LAST ? smooth(46, 52, i) * (1 - smooth(LAST - 12, LAST, i)) : 0;
        for (let j = 0; j <= JW; j++) {
          const n = i * cols + j, y = Y(n), dx = Math.hypot(X(n) - ex, Z(n) - ez);
          if (j <= JMAX) {
            let slope = 0, w = 0;
            for (let q = 0; q < 4; q++) { const ii = i - (q & 1), jj = j - (q >> 1); if (ii < 0 || jj < 0 || ii >= rows - 1 || jj >= JMAX) continue; slope += cellOK[ii * cols + jj]; w++; }
            m[n] = (w ? slope / w : 0) * smooth(lowest - .05, lowest + .4, y) * (1 - smooth(top - 3, top, y)) * (1 - smooth(30 * band, 52 * band, latJ[j])) * smooth(-.07, 0, Math.atan2(y + .8 - 2.4, dx) - horizon) * along * ends;
          }
          /* the sides: gentle by the wall's own shading normal (as its shader judges), in view from the river: rims of ledges and
             benches, crests and faces of toe slopes; a bench's top behind its rim is not */
          r[n] = endsR > 0 ? smooth(-.045, .005, Math.atan2(y + 1.1 - 2.4, dx) - horizon) * smooth(.4, .6, N[(o + n) * 4 + 1]) * smooth(3.2, 4.6, y) * (1 - smooth(wallTop - 18, wallTop, y)) * (1 - smooth(80, 100, latJ[j])) * endsR : 0;
          horizon = Math.max(horizon, Math.atan2(y - 2.4, dx));
        }
        if (!(i & 31)) { await S.rest(); if (stale()) return null; }
      }
      /* broad soft edges (two passes along the river, two across), then the hard limits again */
      for (let pass = 0; pass < 4; pass++) {
        const across = pass & 1;
        for (let i = 0; i < rows; i++) for (let j = 0; j <= JMAX; j++) {
          const n = i * cols + j, a = across ? (j > 0 ? m[n - 1] : m[n]) : (i > 0 ? m[n - cols] : m[n]), b = across ? (j < JMAX ? m[n + 1] : m[n]) : (i < rows - 1 ? m[n + cols] : m[n]);
          tmp[n] = m[n] * .5 + (a + b) * .25;
        }
        for (let i = 0; i < rows; i++) for (let j = 0; j <= JMAX; j++) m[i * cols + j] = tmp[i * cols + j];
        await S.rest(); if (stale()) return null;
      }
      for (let i = 0; i < rows; i++) for (let j = 0; j <= JMAX; j++) { const n = i * cols + j; m[n] = Math.min(1, m[n] * 1.45) * smooth(lowest - .05, lowest + .3, Y(n)); }
      await S.rest(); if (stale()) return null;
    }

    /* 2. planting, row by row along the river (so a window of rows is a run of instances) */
    const rand = rng(20261114), cellsPerRow = cols - 1;
    /* a blade the lens never comes near enough to draw is not made: the share kept, by the nearest the flight passes */
    const keepAt = (i, j, y) => { const d = Math.max(8, Math.hypot(half[i] * .8 + latJ[j], y - 2.4)); return Math.min(1, 1.25 * Math.max(D0REF / (d * boost), 1 - smooth(.35 * D0REF, D0REF, d))); };
    const tri = {};
    const triInfo = (k, i, j, s) => {
      const o = k * rows * cols, at = (i * cellsPerRow + j) * 6 + s * 3, ix = index[k], a = ix[at], b = ix[at + 1], c = ix[at + 2], m = M[k], r = R[k];
      const ma = m[a], mb = m[b], mc = m[c], ra = r[a], rb = r[b], rc = r[c];
      const meadow = Math.max(ma, mb, mc) >= .08, rim = wallAmt > .001 && Math.max(ra, rb, rc) >= .35;
      if (!meadow && !rim) return false;
      const ax = P[(o + a) * 4], ay = P[(o + a) * 4 + 1], az = P[(o + a) * 4 + 2], ux = P[(o + b) * 4] - ax, uy = P[(o + b) * 4 + 1] - ay, uz = P[(o + b) * 4 + 2] - az, vx = P[(o + c) * 4] - ax, vy = P[(o + c) * 4 + 1] - ay, vz = P[(o + c) * 4 + 2] - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l < 1e-5 || Math.abs(ny) / l < .3) return false;
      const steep = .35 + .65 * smooth(.34, .7, Math.abs(ny) / l);
      tri.a = a; tri.b = b; tri.c = c; tri.o = o; tri.area = l * .5; tri.k = meadow ? steep : 0; tri.kr = rim ? steep * (ra + rb + rc) / 3 : 0;
      tri.ax = ax; tri.ay = ay; tri.az = az; tri.ux = ux; tri.uy = uy; tri.uz = uz; tri.vx = vx; tri.vy = vy; tri.vz = vz; tri.ma = ma; tri.mb = mb; tri.mc = mc; tri.ra = ra; tri.rb = rb; tri.rc = rc;
      return true;
    };
    /* how many at the most (so the buffers are made once; what the rules turn away is never written) */
    let most = 0, mostF = 0;
    for (let i = 0; i < Math.min(rows - 1, LAST); i++) {
      for (let k = 0; k < 2; k++) for (let j = 0; j < JW; j++) for (let s = 0; s < 2; s++) if (triInfo(k, i, j, s)) { most += tri.area * (tri.k + tri.kr * RIM) * DENS * keepAt(i, j, tri.ay) + 2; mostF += tri.area * tri.k * 7 + 1; }
      if (!(i & 15)) { await S.rest(); if (stale()) return null; }
    }
    const capacity = Math.ceil(most) + 4096, flowerCap = Math.ceil(mostF) + 1024;
    const sets = [0, 1].map(() => ({ f: new Float32Array(capacity * 4), b: new Uint8Array(capacity * 8), cap: capacity, n: 0, row: new Uint32Array(rows + 1) }));
    const fl = { f: new Float32Array(flowerCap * 4), b: new Uint8Array(flowerCap * 4), n: 0, row: new Uint32Array(rows + 1) };
    let turf = 0, sides = 0;
    await S.rest(true); if (stale()) return null;
    for (let i = 0; i < rows - 1; i++) {
      sets[0].row[i] = sets[0].n; sets[1].row[i] = sets[1].n; fl.row[i] = fl.n;
      if (i >= LAST) continue;
      const tall = Math.round(255 * smooth(28, 52, half[i]));   /* taller, reed-like, where the river is wide and the shore far */
      for (let k = 0; k < 2; k++) for (let j = 0; j < JW; j++) for (let s = 0; s < 2; s++) {
        if (!triInfo(k, i, j, s)) continue;
        const keep = keepAt(i, j, tri.ay), want = tri.area * tri.k * DENS * keep, wantR = tri.area * tri.kr * RIM * DENS * keep;
        let n = Math.floor(want); if (rand() < want - n) n++;
        let nr = Math.floor(wantR); if (rand() < wantR - nr) nr++;
        const { a, b, c, o } = tri;
        /* (first the meadow's blades, then the tufts of the sides: these carry no meadow share and stand taller) */
        for (let q = 0; q < n + nr; q++) {
          let u = rand(), v = rand(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
          const side = q >= n, w = 1 - u - v, s1 = rand(), s2 = rand(), s3 = rand(), s4 = rand(), rank = rand() * keep;
          const x = tri.ax + tri.ux * u + tri.vx * v, y = tri.ay + tri.uy * u + tri.vy * v, z = tri.az + tri.uz * u + tri.vz * v;
          let nx = N[(o + a) * 4] * w + N[(o + b) * 4] * u + N[(o + c) * 4] * v, ny = N[(o + a) * 4 + 1] * w + N[(o + b) * 4 + 1] * u + N[(o + c) * 4 + 1] * v, nz = N[(o + a) * 4 + 2] * w + N[(o + b) * 4 + 2] * u + N[(o + c) * 4 + 2] * v;
          const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          let m = 0;
          base(x, z);
          if (side) {
            if (tri.ra + (tri.rb - tri.ra) * u + (tri.rc - tri.ra) * v < .3) continue;
            if (wallF(x, y, z, ny) < .42) continue;
            if (clump(x, z) < gap * (.3 + .7 * s4) * .3 - .06) continue;
          } else {
            m = tri.ma + (tri.mb - tri.ma) * u + (tri.mc - tri.ma) * v; if (m < .03) continue;
            /* single tufts trail off beyond a patch's edge; between the tussocks the ground is left bare */
            if (edge(m) < .5 - .2 * s2 * s2 - .06) continue;
            if (clump(x, z) < gap * (.3 + .7 * s4) * .6 - .06) continue;
          }
          const set = sets[rank < RF ? 1 : 0]; if (set.n >= set.cap) continue;
          const e = set.n * 4, g = set.n * 8;
          set.f[e] = x; set.f[e + 1] = y; set.f[e + 2] = z; set.f[e + 3] = rank;
          set.b[g] = s1 * 256; set.b[g + 1] = s2 * 256; set.b[g + 2] = side ? 0 : Math.max(8, Math.min(255, m * 255)); set.b[g + 3] = s3 * 256;
          set.b[g + 4] = Math.round((nx * .5 + .5) * 255); set.b[g + 5] = Math.round((nz * .5 + .5) * 255); set.b[g + 6] = s4 * 256; set.b[g + 7] = side ? 215 : tall;
          set.n++; if (side) sides++; else turf++;
        }
        /* flowers: loose drifts, each mostly one colour, only where grass stands (twice the default are planted: the amount dial hides the rest) */
        if (!(tri.k > 0)) continue;
        const cx = tri.ax + (tri.ux + tri.vx) / 3, cz = tri.az + (tri.uz + tri.vz) / 3;
        const dn = vnoise(cx * .085 + 5.5, cz * .085 + 1.5) * .7 + vnoise(cx * .29, cz * .29 + 8.5) * .3, lo = .56 * drift;
        const dr = smooth(lo, lo + .24, dn) * (.3 + .7 * drift);
        if (dr > 0 && fl.n < flowerCap - 16) {
          const wantF = tri.area * tri.k * 7 * dr * Math.min(1, keep * 1.4); let nf = Math.floor(wantF); if (rand() < wantF - nf) nf++;
          const tone = vnoise(cx * .04 + 17.3, cz * .04 + 4.4);
          for (let q = 0; q < nf; q++) {
            let u = rand(), v = rand(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
            const m = tri.ma + (tri.mb - tri.ma) * u + (tri.mc - tri.ma) * v, x = tri.ax + tri.ux * u + tri.vx * v, z = tri.az + tri.uz * u + tri.vz * v;
            base(x, z); if (edge(m) < .52 || clump(x, z) < gap * .3) continue;
            const e = fl.n * 4; let colour = tone < .36 ? 0 : tone < .52 ? 1 : tone < .7 ? 2 : 3; if (rand() < .22) colour = Math.floor(rand() * 4);
            fl.f[e] = x; fl.f[e + 1] = tri.ay + tri.uy * u + tri.vy * v; fl.f[e + 2] = z; fl.f[e + 3] = rand();
            fl.b[e] = rand() * 256; fl.b[e + 1] = colour * 64 + 32; fl.b[e + 2] = Math.max(8, Math.min(255, m * 255)); fl.b[e + 3] = rand() * 256;
            fl.n++;
          }
        }
      }
      await S.rest(); if (stale()) return null;
    }
    for (const s of [...sets, fl]) for (let i = rows - 1; i <= rows; i++) s.row[i] = s.n;
    return { M, R, near: sets[0], far: sets[1], fl, turf, sides, ms: Math.round(performance.now() - t0), slice: +S.worst.toFixed(1) };
  }

  /* ------------------------------------------------------------------ the meshes */
  function makeMeshes() {
    const { THREE } = ctx, IB = THREE.InstancedInterleavedBuffer, IA = THREE.InterleavedBufferAttribute;
    const bladeShape = (() => { const p = [], ix = [], L = 5; for (let l = 0; l < L; l++) p.push(-.5, l / L, 0, .5, l / L, 0); p.push(0, 1, 0); for (let l = 0; l < L - 1; l++) { const a = l * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } ix.push((L - 1) * 2, (L - 1) * 2 + 1, L * 2); return { p: new Float32Array(p), ix }; })();
    const flowerShape = (() => { const p = [0, 0, 1], ix = []; for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI * 2 + .26; p.push(Math.cos(a) * .5, Math.sin(a) * .5, 0); ix.push(0, 1 + q, 1 + (q + 1) % 6); } return { p: new Float32Array(p), ix }; })();
    const VERT_PARS = `
      attribute vec4 aA;attribute vec4 aB;attribute vec4 aC;
      uniform vec4 uGrassLod,uGrassWind,uGrassE,uGrassSeed,uGrassQ;uniform vec3 uGrassFl[4],uGrassSeedC;uniform float uGrassKind,uGrassGrow;uniform sampler2D alpineErosion;
      varying vec3 vF2gCol;varying float vF2gT;varying vec3 vAlpWorld;
      vec3 f2gPos;
      ${SHARED}${SHARED_BLADES}
      vec2 f2gBend(vec3 root,vec2 lean,out float gust){
        vec2 wd=uGrassWind.xy;float tm=uGrassA.y*uGrassWind.z;
        gust=f2gNoise(root.xz*.042-wd*tm*.042)*.62+f2gNoise(root.xz*.115-wd*tm*.144+vec2(7.3,2.1))*.38;
        gust=smoothstep(.28,.82,gust);
        return lean+wd*(.03+.34*gust)*uGrassA.z;
      }
      /* the share of blades drawn at this distance: all of them up to where a blade is one pixel wide, then fewer (each drawn a
         pixel wide); with a near boost, the extra ones only close to the lens */
      float f2gDens(float d){return clamp(max(uGrassLod.x/(d*uGrassE.z),1.-smoothstep(uGrassLod.x*.35,uGrassLod.x,d)),0.,1.)*uGrassQ.x;}`;
    const BLADE = `
      vec3 gRoot=aA.xyz;float gT=position.y;
      vec3 gNrm=vec3(aC.x*2.-1.,0.,aC.y*2.-1.);gNrm.y=sqrt(max(1.-dot(gNrm.xz,gNrm.xz),.04));
      vec3 gTo=cameraPosition-gRoot;float gD=length(gTo);
      float gShow=smoothstep(0.,.35,1.-aA.w/max(f2gDens(gD),1e-4))*(1.-smoothstep(uGrassLod.y*.7,uGrassLod.y,gD))*min(uGrassA.x,1.)*uGrassGrow;
      float gFoot=gD*uGrassC.w;vec3 gN=f2gBase(gRoot.xz,gFoot);
      float gWb=step(aB.z,.02);   /* planted on a rim of the valley side (no meadow share): the sides' own rule decides */
      float gThr=.5-.2*aB.y*aB.y;   /* single tufts trail off beyond a patch's edge */
      float gEdge=gWb>.5?smoothstep(.44,.6,f2gWall(gRoot,gNrm.y,0.,gN,gFoot)):smoothstep(gThr-.05,gThr+.07,f2gEdge(aB.z,gN))*smoothstep(.5,.74,gNrm.y);
      float gCl=f2gClump(gRoot.xz,gFoot);
      gEdge*=smoothstep(-.05,.08,gCl-uGrassD.w*(.3+.7*aC.z)*mix(.6,.3,gWb));   /* loose tussocks, bare ground between them */
      vec3 gPt=vec3(f2gPatch(gN),f2gTall(gN));
      float gVar=gPt.z*mix(.62,1.5,min(gCl,1.2))*(.55+.9*aB.x*aB.x+.25*aB.w);
      float gH=min(uGrassLod.w*mix(.95,gVar,uGrassE.x)*(1.+.6*aC.w),2.3*uGrassLod.w)*mix(.7,1.,gEdge)*step(.02,gEdge)*gShow;
      /* a share of the blades carry a seed head (more of them on the drier patches): they stand above the tussock, a thin stalk
         with a spindle of seed at its top (the blade's top two levels), straw to purple-brown */
      float gSeedK=step(1.-uGrassSeed.y*(.7+.8*gPt.x),fract(aB.x*13.71+aB.w*7.33+aC.z*3.17))*step(.001,uGrassSeed.x)*(1.-gWb*.6);
      gH*=1.+.3*gSeedK*min(uGrassSeed.x,1.5);
      float gOn=step(.001,gH);
      float gW=uGrassWind.w*(.7+.6*aC.z),gWmin=uGrassLod.z*gD,gCover=clamp(gW/max(gWmin,1e-6),0.,1.);
      float gWt=max(gW*mix(pow(1.-gT,.7)*(.72+.28*smoothstep(0.,.18,gT)),mix(.42,2.3,smoothstep(.62,.78,gT))*(1.-smoothstep(.82,1.,gT)*.85),gSeedK),gWmin*(1.-.4*gT));
      vec2 gSide=normalize(vec2(-gTo.z,gTo.x)+vec2(1e-5,0.));
      float gYaw=(aB.y-.5)*1.1*gCover,gcy=cos(gYaw),gsy=sin(gYaw);gSide=vec2(gSide.x*gcy-gSide.y*gsy,gSide.x*gsy+gSide.y*gcy);
      float gLa=aB.w*6.2831853+aB.x*3.,gGust;
      vec2 gBend=f2gBend(gRoot,vec2(cos(gLa),sin(gLa))*(.08+.4*aB.y*aB.y)*uGrassE.y,gGust);
      float gB2=min(dot(gBend,gBend),1.);
      f2gPos=gRoot-vec3(0.,.05,0.)*gOn+vec3(gBend.x*gT*gT,gT*(1.-.3*gB2*gT),gBend.y*gT*gT)*gH+vec3(gSide.x,0.,gSide.y)*(position.x*gWt*gOn);
      objectNormal=normalize(gNrm+vec3(0.,1.,0.)-vec3(gBend.x,0.,gBend.y)*.4*gT);
      vec3 gRc=f2gRootC(gPt.xy),gTc=f2gTipC(gPt.xy);
      vec3 gCol=mix(gRc*.62,gTc*(1.+.1*gGust*uGrassA.z)*mix(.92,1.12,min(gCl,1.))*(1.+.22*smoothstep(.55,1.,gT)),smoothstep(.12,.95,gT))*(.88+.24*aC.z);
      gCol=mix(gCol,uGrassSeedC*(.8+.45*fract(aB.y*9.13))*mix(1.,1.25,gPt.x),gSeedK*smoothstep(.6,.7,gT));
      /* (farther than a pixel-wide blade can show its own colours, it takes the colour of the ground it stands on) */
      vec3 gOut=mix(mix(f2gGroundC(gPt.xy),gCol,mix(.6,1.,gCover)),mix(uGrassWallC*1.35,gCol*vec3(.74,.8,.84),mix(.5,.8,gCover)),gWb);
      vF2gCol=gOut*uGrassB.w;vF2gT=gT*gT*mix(.5,1.,gCover)*(1.-.5*gWb);`;
    const FLOWER = `
      vec3 gRoot=aA.xyz;
      vec3 gTo=cameraPosition-gRoot;float gD=length(gTo);
      float gSize=(.09+.08*aB.x*aB.x)*uGrassE.w,gSmin=uGrassLod.z*2.1*gD,gCover=clamp(gSize/max(gSmin,1e-6),0.,1.);
      float gDens=clamp(uGrassLod.x*2.2/gD,0.,1.)*uGrassQ.x;
      float gShow=smoothstep(0.,.35,1.-aA.w/max(gDens,1e-4))*(1.-smoothstep(uGrassLod.y*.45,uGrassLod.y*.62,gD))*min(uGrassA.x,1.)*uGrassGrow*step(aA.w*2.,uGrassA.w);
      float gFoot=gD*uGrassC.w;vec3 gN=f2gBase(gRoot.xz,gFoot);
      float gEdge=smoothstep(.48,.6,f2gEdge(aB.z,gN));
      vec3 gPt=vec3(f2gPatch(gN),f2gTall(gN));
      float gVar=gPt.z*mix(.62,1.5,min(f2gClump(gRoot.xz,gFoot),1.2))*(.82+.4*aB.w);
      float gH=uGrassLod.w*mix(.95,gVar,uGrassE.x)*mix(.7,1.,gEdge)*step(.02,gEdge)*step(.001,gShow),gGust;
      vec2 gBend=f2gBend(gRoot,vec2(0.),gGust)*.8;
      vec3 gDir=gTo/max(gD,1e-4);vec2 gSide=normalize(vec2(-gDir.z,gDir.x)+vec2(1e-5,0.));
      vec3 gUpv=normalize(vec3(0.,1.,0.)-gDir*gDir.y);
      float gS=max(gSize,gSmin)*gShow*step(.001,gH);
      f2gPos=gRoot+vec3(gBend.x,1.-.25*dot(gBend,gBend),gBend.y)*gH+(vec3(gSide.x,0.,gSide.y)*position.x+gUpv*position.y)*gS;
      objectNormal=normalize(vec3(0.,1.,0.)+gDir*.6);
      vec3 gFc=uGrassFl[int(min(aB.y*4.,3.))]*(.86+.28*aB.w);
      gFc=mix(gFc,mix(gFc,vec3(.86,.72,.3),.75),position.z*.8);
      vF2gCol=mix(f2gGroundC(gPt.xy),gFc,mix(.3,1.,gCover))*uGrassB.w;vF2gT=.5*gCover;`;
    /* blades and flowers are one program (one compile): the kind is a uniform */
    const BODY = `vec3 objectNormal;
      if(uGrassKind<.5){${BLADE}
      }else{${FLOWER}
      }`;
    const haze = cap.haze;
    /* below the high tier the wind is one smooth travelling wave (one noise octave instead of two) */
    const PARS = QSTART === 'high' ? VERT_PARS : VERT_PARS.replace('gust=f2gNoise(root.xz*.042-wd*tm*.042)*.62+f2gNoise(root.xz*.115-wd*tm*.144+vec2(7.3,2.1))*.38;', 'gust=f2gNoise(root.xz*.042-wd*tm*.042);');
    /* director C's cloud shadows (flow2-valley5-light.js): the sun is dimmed under a passing cloud exactly as on the ground below
       (same function, same uniform object, the same line of three's lights as C's own link); without C's module: nothing */
    const CL = window.__FLOW2_VALLEY5_LIGHT__?.cloud, LFB = THREE.ShaderChunk?.lights_fragment_begin || '', CLA = '? getShadow( directionalShadowMap[ i ]';
    const cloudOk = !!(CL && typeof CL.glsl === 'string' && CL.uniforms?.uV5LCl && LFB.split(CLA).length === 2);
    state.clouds = cloudOk ? 'on' : 'no cloud shadows (light module off or changed)';
    const makeMaterial = (kind, name) => {
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .96, metalness: 0, side: THREE.DoubleSide, fog: true });
      material.name = 'Flow2 meadow ' + name;
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, U, UB, haze ? haze.uniforms : {}, { uGrassKind: { value: kind }, alpineErosion: cap.erosion });
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + PARS)
          .replace('#include <beginnormal_vertex>', BODY).replace('#include <begin_vertex>', 'vec3 transformed=f2gPos;')
          .replace('#include <project_vertex>', '#include <project_vertex>\n      vAlpWorld=f2gPos;');
        let f = shader.fragmentShader.replace('#include <common>', '#include <common>\n      varying vec3 vF2gCol;varying float vF2gT;varying vec3 vAlpWorld;uniform float uGrassBack;\n' + (haze ? haze.decl : ''))
          .replace('#include <map_fragment>', 'diffuseColor.rgb=vF2gCol;')
          .replace('#include <normal_fragment_maps>', 'normal=normalize(vNormal);')
          .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        /* light through the tips when the sun is ahead of the lens */
        reflectedLight.directDiffuse+=directionalLights[0].color*diffuseColor.rgb*(RECIPROCAL_PI*uGrassBack*vF2gT*pow(max(-dot(normalize(vViewPosition),directionalLights[0].direction),0.),2.));
      #endif`);
        if (haze) f = f.replace('#include <fog_fragment>', haze.block);
        if (cloudOk) { Object.assign(shader.uniforms, { uV5LCl: CL.uniforms.uV5LCl }); f = f.replace('#include <common>', () => '#include <common>'+String.fromCharCode(10) + CL.glsl).replace('#include <lights_fragment_begin>', () => 'float v5lCl=1.-uV5LCl.x*v5lCloud(vAlpWorld.xz);'+String.fromCharCode(10) + LFB.replace(CLA, '? v5lCl * getShadow( directionalShadowMap[ i ]')); }
        shader.fragmentShader = f;
      };
      material.customProgramCacheKey = () => (cloudOk ? 'cl-' : '') + 'flow2-grass-meadow' + (haze ? '-haze' : '') + (QSTART === 'high' ? '' : '-w1') + '-6';
      return material;
    };
    const makeSet = (shape, stride, material, name) => {
      const set = { g: null, n: 0, start: -1, count: 0, rows: null };
      const mesh = set.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
      mesh.name = 'Flow2 meadow · ' + name; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;   /* the walls' cast shadow (flow2-valley5-light.js) darkens the blades too */ mesh.renderOrder = 1; mesh.matrixAutoUpdate = false; mesh.visible = false;
      /* a new scatter: new buffers (uploaded when first drawn), the old ones let go */
      set.load = data => {
        const n = data.n, g = new THREE.InstancedBufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(shape.p, 3)); g.setIndex(shape.ix);
        const fb = new IB(data.f.subarray(0, Math.max(1, n) * 4), 4, 1), bb = new IB(data.b.subarray(0, Math.max(1, n) * stride), stride, 1);
        /* once on the GPU the copy in memory is let go (the window only moves an offset, it never uploads again) */
        for (const buffer of [fb, bb]) buffer.onUpload(function () { this.array = null; });
        const old = set.g; Object.assign(set, { g, fb, bb, n, rows: data.row, start: -1, count: 0 });
        mesh.geometry = g; set.window(0, 0); old?.dispose();
      };
      set.window = (start, length) => {
        const { g, fb, bb, n } = set; if (!g) return;
        start = Math.max(0, Math.min(n, start)); length = Math.max(0, Math.min(n - start, length));
        if (start !== set.start) {
          /* the same buffers, read from another instance on: nothing is uploaded when the window moves */
          g.setAttribute('aA', new IA(fb, 4, start * 4, false)); g.setAttribute('aB', new IA(bb, 4, start * stride, true));
          g.setAttribute('aC', new IA(bb, 4, start * stride + (stride > 4 ? 4 : 0), true));
          set.start = start;
        }
        g.instanceCount = length; set.count = length; mesh.visible = length > 0;
      };
      return set;
    };
    const bladeMaterial = makeMaterial(0, 'blades');
    return { near: makeSet(bladeShape, 8, bladeMaterial, 'near blades'), far: makeSet(bladeShape, 8, bladeMaterial, 'far blades'), flowers: makeSet(flowerShape, 4, makeMaterial(1, 'flowers'), 'flowers') };
  }
  /* a finished scatter goes on show: the walls' share, then the three meshes on successive frames (each uploads when first drawn) */
  async function adopt(result, staged) {
    const { THREE, banks } = ctx;
    banks.forEach((bank, k) => {
      const have = bank.geometry.getAttribute('aGrassM');
      if (have && have.array.length === result.M[k].length) { have.array.set(result.M[k]); have.needsUpdate = true; }
      else bank.geometry.setAttribute('aGrassM', new THREE.BufferAttribute(result.M[k], 1));
    });
    for (const [set, data] of [[live.far, result.far], [live.near, result.near], [live.flowers, result.fl]]) { set.load(data); if (staged) await nextFrame(); }
    state.blades = result.near.n + result.far.n; state.bladesOnShelves = result.turf; state.bladesOnSides = result.sides; state.flowers = result.fl.n;
    state.megabytes = +((state.blades * 24 + result.fl.n * 8) / 1048576).toFixed(1); state.scatterMs = result.ms; state.worstSliceMs = result.slice;
  }

  /* ------------------------------------------------------------------ the first build, and scatters asked for later (the panel) */
  let live = null, job = 0, timer = 0, busy = null, pending = false;
  async function build(handles) {
    const t00 = performance.now();
    ctx = await prepare(handles); if (!ctx) return;
    state.grass = 'planting';
    const result = await scatter(() => false);
    if (!result) return;
    groundResolve({ ctx, result, rules: lastRules && lastRules() });
    const sets = makeMeshes();
    /* The ground is there from the first live frame when all this was done while the still picture was up (else it fades in).
       The blades' own program is compiled only once the valley is live: while the page compiles the canyon's programs one more
       program in the queue makes the visitor wait longer; afterwards it costs nothing. */
    const early = !pageLive(); state.builtBeforeLive = early;
    live = { ...sets, bornGround: early ? -1e12 : performance.now() + 50, bornBlades: Infinity, added: false, row: -1, stage: 0 };
    await adopt(result, false);
    state.buildMs = Math.round(performance.now() - t00);
    state.grass = 'ground on, blades come when the valley is live';
    while (!pageLive()) await nextFrame();
    for (let q = 0; q < 4; q++) await nextFrame();
    /* compiled in the kind of target the canyon is really drawn in (linear, no tone mapping), with the canyon's lights */
    const { THREE, renderer, canyon } = ctx, warm = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true }), tc = performance.now();
    {
      const was = renderer.getRenderTarget(); let wait = null;
      try { renderer.setRenderTarget(warm); wait = renderer.compileAsync(live.near.mesh, canyon.camera, canyon.scene); } catch (error) { wait = null; } finally { renderer.setRenderTarget(was); }
      try { await wait; } catch { }
    }
    warm.dispose(); state.compileMs = Math.round(performance.now() - tc);
    await nextFrame();
    for (const set of [live.far, live.near, live.flowers]) canyon.scene.add(set.mesh);
    api.meshes = [live.near.mesh, live.far.mesh, live.flowers.mesh];
    live.added = true; live.bornBlades = performance.now() + 30;
    state.grass = 'growing in';
    if (pending) { pending = false; rescatter(0); }   /* (a dial moved while the first scatter ran) */
  }
  /* the distribution changed: scatter again after a short pause, in the same slices; the old blades stay until the new are ready */
  function rescatter(pause = 300) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!ctx || !live?.added) { pending = true; return; }
      const id = ++job; state.scattering = true;
      if (busy) await busy;
      if (id !== job) return;
      busy = (async () => {
        try { const result = await scatter(() => id !== job); if (result && id === job) { await adopt(result, true); try { api.onScatter?.({ ctx, result, rules: lastRules && lastRules() }); } catch (error) { console.warn('flow2 grass: plants follow-up failed', error); } } }
        catch (error) { console.warn('flow2 grass: the new scatter failed, the old one stays', error); }
      })();
      await busy; busy = null;
      if (id === job) state.scattering = false;
    }, pause);
  }
  const SCATTER_KEYS = new Set(['density', 'nearBoost', 'coverage', 'scatter', 'patch', 'gap', 'band', 'wall', 'wallTop', 'wallSlope', 'lowest', 'flowerDrift']);
  api.diff = () => { const out = {}; for (const k of Object.keys(DEFAULTS)) if (k !== 'debug' && JSON.stringify(T[k]) !== JSON.stringify(DEFAULTS[k])) out[k] = clone(T[k]); return out; };
  const save = () => { try { const d = api.diff(); if (Object.keys(d).length) localStorage.setItem(KEY, JSON.stringify(d)); else localStorage.removeItem(KEY); } catch { } };
  /* the one way in for the panel (and the console): write a value; it is kept for the next load, and what needs a new scatter gets one */
  api.set = (key, value, index) => {
    if (!(key in DEFAULTS)) return false;
    if (Array.isArray(T[key]) && Number.isInteger(index)) T[key][index] = value; else T[key] = value;
    save(); if (SCATTER_KEYS.has(key)) rescatter();
    return true;
  };
  api.reset = () => { for (const k of Object.keys(DEFAULTS)) T[k] = clone(DEFAULTS[k]); try { localStorage.removeItem(KEY); } catch { } rescatter(50); };
  api.rescatter = () => rescatter(0);

  /* ------------------------------------------------------------------ every frame */
  let colours = '', clock = 0, lastT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!live || !ctx) return;
    const { THREE, renderer, canyon, cen, rows, step } = ctx, { near, far, flowers } = live;
    const a = U.uGrassA.value, b = U.uGrassB.value, c = U.uGrassC.value, d = U.uGrassD.value, lod = UB.uGrassLod.value, w = UB.uGrassWind.value, e = UB.uGrassE.value;
    const key = [T.root, T.tip, T.dry, T.cool, T.ground, T.wallColour, ...T.flowerColours].join();
    if (key !== colours) {
      colours = key;
      const lin = (hex, fallback) => new THREE.Color(/^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback).toArray();
      U.uGrassRoot.value = lin(T.root, DEFAULTS.root); U.uGrassTip.value = lin(T.tip, DEFAULTS.tip); U.uGrassDry.value = lin(T.dry, DEFAULTS.dry); U.uGrassCool.value = lin(T.cool, DEFAULTS.cool);
      U.uGrassGround.value = lin(T.ground, DEFAULTS.ground); U.uGrassWallC.value = lin(T.wallColour, DEFAULTS.wallColour);
      UB.uGrassFl.value = new Float32Array([0, 1, 2, 3].flatMap(q => lin(T.flowerColours[q], DEFAULTS.flowerColours[q])));
    }
    const p = window.__MONTIS_STUDY__?.journey?.progress ?? 0;
    const still = reduced.matches;
    const ground = now < live.bornGround ? 0 : still ? 1 : smooth(0, 900, now - live.bornGround);
    const grown = now < live.bornBlades ? 0 : still ? 1 : smooth(0, 1250, now - live.bornBlades);
    const LF = window.__FLOW2_LIFT_FADE__, shown = ground * (1 - smooth(LF ? LF[0] : 9.7, LF ? LF[1] : 10.5, p)) * cl(T.amount, 0, 1, 1); /* flow2 unify (2026-11-14): with the lift cut on, the canyon keeps its full look up to the cut (window.__FLOW2_LIFT_FADE__, set by flow2-lift-cut.js); without it, the original window */
    UB.uGrassGrow.value = grown;
    a[0] = T.debug ? 2 : shown;
    if (!still) clock += Math.min(.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    const qn = qNow();
    a[1] = still ? 0 : clock; a[2] = cl(T.wind, 0, 4, 1); a[3] = cl(T.flowers, 0, 2, 1) * qn.flowers;
    UB.uGrassQ.value[0] = Math.min(1, qn.dens / qStart.dens);
    b[0] = cl(T.dryShare, 0, 1, .5); b[3] = cl(T.gain, 0, 3, .88);
    c[0] = cl(T.wall, 0, 1.5, 1); c[1] = Math.cos(cl(T.wallSlope, 20, 80, 58) * Math.PI / 180); c[2] = cl(T.wallTop, 20, 160, 74);
    d[0] = cl(T.coverage, 0, 2, 1); d[1] = cl(T.scatter, 0, 1, .7); d[2] = cl(T.patch, .3, 4, 1); d[3] = cl(T.gap, 0, 1, .5);
    /* a blade is one pixel wide at d0: nearer it is drawn at its own width, farther fewer blades are drawn, each a pixel wide */
    const cam = canyon.camera, hPx = renderer.domElement.height || innerHeight, focal = cam.projectionMatrix.elements[5] * hPx * .5;
    const minPx = cl(T.minPixels, .5, 4, 1.15), width = .034 * cl(T.width, .2, 5, 1), d0 = Math.max(6, width * focal / minPx), farAt = cl(T.far, 40, 600, 240) * qn.reach, boost = cl(T.nearBoost, 1, 4, 1);
    c[3] = 1 / focal;
    lod[0] = d0; lod[1] = farAt; lod[2] = minPx / focal; lod[3] = .95 * cl(T.height, .1, 4, 1);
    const wl = Math.hypot(T.windDir[0], T.windDir[1]) || 1; w[0] = T.windDir[0] / wl; w[1] = T.windDir[1] / wl; w[2] = cl(T.windSpeed, 0, 20, 3.2); w[3] = width;
    e[0] = cl(T.heightVar, 0, 2, 1); e[1] = cl(T.bend, 0, 3, 1); e[2] = boost; e[3] = cl(T.flowerSize, .2, 4, 1);
    UB.uGrassBack.value = cl(T.backlight, 0, 2, .42);
    /* the window of rows along the river that the lens can see */
    const cx = cam.position.x, cz = cam.position.z; let row = live.row, best = Infinity;
    const lo = row < 0 ? 0 : Math.max(0, row - 12), hi = row < 0 ? rows - 1 : Math.min(rows - 1, row + 12);
    for (let i = lo; i <= hi; i++) { const q = (cen[i * 2] - cx) ** 2 + (cen[i * 2 + 1] - cz) ** 2; if (q < best) { best = q; row = i; } }
    if ((row === lo && lo > 0) || (row === hi && hi < rows - 1) || best > 160000) { best = Infinity; for (let i = 0; i < rows; i++) { const q = (cen[i * 2] - cx) ** 2 + (cen[i * 2 + 1] - cz) ** 2; if (q < best) { best = q; row = i; } } }
    live.row = row;
    const high = cam.position.y > 7 || Math.sqrt(best) > 70;
    const span = (set, reach) => { if (!set.rows) return; const ahead = Math.ceil(reach / step) + 2, r0 = Math.max(0, row - (high ? ahead : 4)), r1 = Math.min(rows - 1, row + ahead); set.window(set.rows[r0], set.rows[r1] - set.rows[r0]); };
    if (!live.added || (shown * grown <= .001 && !T.debug)) { near.mesh.visible = far.mesh.visible = flowers.mesh.visible = false; }
    else {
      /* each mesh uploads its buffers when it is first drawn: the three come in on three successive frames */
      live.stage = Math.min(3, live.stage + 1);
      span(far, farAt); span(near, Math.min(farAt, d0 / (RF * boost) * 1.05)); span(flowers, farAt * .62);
      if (live.stage < 2) near.mesh.visible = false;
      if (live.stage < 3 || a[3] <= .001) flowers.mesh.visible = false;
      if (qn === QF.low) far.mesh.visible = false;   /* the low tier: only the near ring of tufts */
    }
    state.drawn = near.count + far.count; state.drawnFlowers = flowers.count; state.row = row; state.shown = +shown.toFixed(3); state.d0 = +d0.toFixed(1);
    if (!state.ready && grown >= 1) { state.ready = true; state.grass = 'on'; resolveReady(state); }
  }

  /* ------------------------------------------------------------------ for the plants module (flow2-plants.js): the same rules, uniforms and helpers */
  api.lib = { U, UB, SHARED, SHARED_BLADES, cap, smooth, h2, vnoise, rng, nextFrame, pageLive, slicer, reduced, cl, DEFAULTS, get live() { return live; } };

  /* ------------------------------------------------------------------ the dials' panel: its own file, only where a person is looking */
  function panel() {
    const want = Q.get('grassPanel');
    if (want === '0' || (navigator.webdriver && want !== '1')) return;
    const load = () => { const s = document.createElement('script'); s.src = new URL('flow2-grass-panel.js?v=2', BASE).href; s.async = true; document.head.append(s); };
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 4000 }); else setTimeout(load, 1500);
  }

  /* ------------------------------------------------------------------ start */
  function start(handles) {
    walls(handles.canyon);
    requestAnimationFrame(frame);
    const begin = performance.now();
    (function wait() {
      /* as soon as the walls' program is known (their shaders are compiling, the still picture is up) */
      if (cap.seen && cap.erosion?.value?.image) {
        build(handles).catch(error => { state.grass = 'failed: ' + (error?.message || error); console.warn('flow2 grass: nothing planted', error); })
          .finally(() => { if (!live?.added) resolveReady(state); });
        panel();
        return;
      }
      if (performance.now() - begin > 120000) { state.grass = 'the valley did not come up: nothing planted'; resolveReady(state); return; }
      setTimeout(wait, 120);
    })();
  }
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const before = host.canyon;
  host.canyon = function (handles = {}) {
    try { before?.call(this, handles); } finally {
      if (handles.lite || (innerWidth < 760 && !document.documentElement.hasAttribute('data-flow2-phone-full'))) { state.grass = state.ground = 'not on the lighter drawing'; resolveReady(state); }
      else { try { start(handles); } catch (error) { state.grass = 'failed: ' + (error?.message || error); console.warn('flow2 grass: nothing planted', error); resolveReady(state); } }
    }
  };
})();
