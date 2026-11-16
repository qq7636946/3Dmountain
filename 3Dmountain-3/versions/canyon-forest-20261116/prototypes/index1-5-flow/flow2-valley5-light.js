/* Flow2 valley, fifth round: light and shadow (director C, 2026-11-14). index1-5-flow2.html only. ?v5light=0 leaves it out.
   Client: 「光影還要再加強2倍」 — light and shadow twice as strong. Read as: the light MODELS the valley. You can tell where the sun
   is, what stands in it and what does not, and the shade is full of soft sky light instead of a blue-black mass.

   What the frames lacked, and what this does (no new objects, no new shader variants, no texture):
   1. THE WALLS CAST AND TAKE THE SUN'S SHADOW. The page bakes a 4096² sun shadow map, but the two canyon walls (the meshes the
      flight looks at, 2 × 110k triangles) and the shore blocks neither cast nor received it: nothing near the lens had a shadow.
      Here they do. The walls' vertices are displaced in their vertex shader (alpBankDisp, up to 6 m of relief): they cast through
      a depth material that applies the very same displacement (its GLSL and uniforms are taken from the walls' own program), so
      the shadow lies where the rock is. The map stays static (baked when the canyon starts, again only if the sun moves).
   2. THE SHADE IS LIT. Before: a frontal fill from behind the lens (it lit every face turned to the camera alike: flat) and a
      bright ground colour (overhangs as bright as ledges). Now the shade takes more sky from above (ledges and beds that face up
      catch it), the ground light is darker (overhangs and the undersides of shelves go darker), the fill turns across the canyon
      and drops low with a warmer tint: the light the sunlit wall throws back onto the shaded one. The unshadowed rim (a weak second
      sun that leaked into every shadow) steps back. The sun itself is a little stronger and a little warmer, so sun and shade split
      warm / cool. All of it as factors on the page's own values, applied right before each drawing (scene.onBeforeRender, after the
      day, the canyon light and the valley modules have written theirs), so the day cycle still moves everything.
   3. THE WATER TAKES THE SHADOW. The river samples the same shadow map: in the walls' shadow the sun's path and the sun-facing
      wave faces are cut off, and the body of the water is darker (no sun scattered in it); in the sun it is a little brighter.
      The river's sun is the real sun (it was set from another dial that pointed 37° away from it).
   4. LESS FAKE DARKNESS in the rock's own colour (the page darkened the lower walls in the albedo, a stand-in for missing light).
   Eases out as the lens climbs above the canyon (the aerial chapter keeps its look; the walls stop casting there).
   Live: window.__FLOW2_VALLEY5_LIGHT__.tune / .state; panel 「光影」 (key I). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('v5light') === '0') return;
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const T = {
    amount: num('v5lightAmt', 1),       // all of it (0 = the page as the fourth round left it)
    shadows: {
      walls: 1,                         // the canyon walls and shore blocks cast and take the sun's shadow (0 = as before)
      strength: 1                       // how much of the sun a cast shadow takes away (1 = all of it)
    },
    key: { sun: 4.2, warm: .5 },        // the sun: strength (× the page's), warmth (0 = the page's colour). The walls take it at a
                                        // grazing angle (the sun runs nearly down the canyon), so it needs the strength
    shade: {
      sky: 4,                           // the sky's light from above (hemisphere, ×): the shade's main light
      ground: .75,                      // the light from below (hemisphere ground colour, ×): overhangs and undersides go darker
      env: 1.8,                         // the image-based ambient (×)
      fill: 1,                          // the fill (×), turned: the light the sunlit wall throws back onto the shaded one
      turn: .8,                         // the fill turned from behind the lens (0) to across the canyon (1)
      low: 14,                          // the fill's height (degrees) once turned
      bounce: .45,                      // the fill's warmth (the sunlit rock it comes from)
      rim: 0                            // the unshadowed rim (×): a weak second sun that leaked into every shadow
    },
    rock: { valleyShadow: .3 },         // the page's darkening of the lower walls in the rock colour (flow2-valley.js's value .69)
    water: { shadow: 1, shade: .85, sunlit: 1.25, realSun: 1 }, // the walls' shadow on the river; the body's light in shadow / in sun (×);
                                                     // realSun: the river's sun glitter aimed at the real sun (1) or where the page had it (0: the bright path down the middle of the first screen) — added by the lead 2026-11-14 so the client can choose
    clouds: { amount: .42, cover: .5, size: 320, speed: 2.5 }   // slow cloud shadows on walls, far range and water: how much sun
                                                                 // they take, how much sky they cover, their size (m), drift (m/s)
  };
  const state = { walls: 'not built yet', light: 'not built yet', water: 'not built yet', clouds: 'not built yet', bakes: 0 };
  /* the cloud shadows: one function for every program that takes them (walls, far range, stones, the river; the plants may) */
  const CLOUD_GLSL = `
    float v5lH(vec2 p){p=fract(p*vec2(127.31,311.17));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float v5lN(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(v5lH(i),v5lH(i+vec2(1.,0.)),u.x),mix(v5lH(i+vec2(0.,1.)),v5lH(i+vec2(1.,1.)),u.x),u.y);}
    /* 0 = clear sky over this ground, 1 = under a cloud (soft edges ~a fifth of a cloud wide) */
    float v5lCloud(vec2 xz){
      vec2 p=xz/uV5LCl.z+uV5LCl.y*vec2(.6,-.8);
      float n=v5lN(p)*.62+v5lN(p*2.13+vec2(5.3,1.7))*.28+v5lN(p*4.7+vec2(2.1,8.9))*.10;
      return smoothstep(uV5LCl.w,uV5LCl.w+.16,n);
    }
`;
  const UCL = { value: [0, 0, 320, .56] };   // amount (× the canyon's dial), drift, size (m), threshold
  const API = window.__FLOW2_VALLEY5_LIGHT__ = { tune: T, state, cloud: { glsl: 'uniform vec4 uV5LCl;\n' + CLOUD_GLSL, uniforms: { uV5LCl: UCL } }, rebake() { if (ctx.sun?.shadow) { ctx.sun.shadow.needsUpdate = true; state.bakes++; } } };
  if (innerWidth < 760) { state.walls = state.light = state.water = 'small screen: off'; return; }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const ctx = { THREE: null, canyon: null, sun: null, hemi: null, fill: null, rim: null, banks: [], blocks: [], cap: null, depth: null, sea: null, A: 0, cast: false, tier: 'high', low: false };
  /* quality tiers (flow2-quality.js): high and medium as designed (the shadow map is the page's own 4096², nothing of mine is
     sized); low = the light's values only, at half their reach (no wall shadows: the walls' shadow lookups are the cost) */
  const QL = window.__FLOW2_QUALITY__;
  ctx.tier = QL?.start || 'high'; ctx.low = ctx.tier === 'low';
  try { QL?.on?.(({ level }) => { ctx.low = level === 'low' || ctx.tier === 'low'; state.tier = level; }); } catch (error) { }
  state.tier = ctx.tier;

  /* ================= 1. the walls: capture their displacement, cast and receive ================= */
  function walls(handles) {
    const { THREE, canyon, lite } = handles;
    if (lite) { state.walls = 'not on the lighter drawing'; return; }
    if (!THREE || !canyon?.scene) { state.walls = 'no canyon handed over'; return; }
    ctx.THREE ||= THREE; ctx.canyon = canyon;
    if (ctx.tier === 'low') { state.walls = 'low tier: the walls keep the page\'s light (no wall shadows)'; return; }
    canyon.scene.traverse(o => {
      if (!o.isMesh) return;
      if (o.userData?.rim && o.material?.userData?.alpineTerrain) ctx.banks.push(o);
      else if (/^Jointed shore blocks/.test(o.name || '')) ctx.blocks.push(o);
    });
    if (!ctx.banks.length) { state.walls = 'no canyon walls found'; return; }
    /* take the displacement's GLSL and its two uniforms from the walls' own program (a link that changes nothing) */
    const material = ctx.banks[0].material, compile = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, renderer) {
      compile?.call(this, shader, renderer);
      if (ctx.cap || !shader.vertexShader.includes('#define ALP_BANK\n') || shader.vertexShader.includes('#define ALP_LITE\n')) return;
      const v = shader.vertexShader, a = v.indexOf('float alpBankH('), b = a < 0 ? -1 : v.indexOf('#endif', a), src = b > a ? v.slice(a, b) : '';
      if (!src.includes('vec4 alpBankDisp(') || !shader.uniforms.alpineErosion || !shader.uniforms.uCliffRelief) { state.walls = 'the walls\' displacement was not found: they take the shadow but do not cast it'; ctx.cap = { none: true }; return; }
      ctx.cap = { src, erosion: shader.uniforms.alpineErosion, relief: shader.uniforms.uCliffRelief };
    };
    for (const o of ctx.banks) o.receiveShadow = true;
    for (const o of ctx.blocks) o.receiveShadow = true;
    state.walls = 'receiving; waiting for the walls\' program to cast';
  }
  /* the cloud shadows in the terrain's programs: the sun's term only (three's directional shadow line, found in the running
     three.js; not found = no clouds, nothing else changed). No sampler, no new program: one more link with its own cache key */
  function cloudLink(canyon) {
    const THREE = ctx.THREE, chunk = THREE?.ShaderChunk?.lights_fragment_begin || '', target = '? getShadow( directionalShadowMap[ i ]';
    if (chunk.split(target).length !== 2) { state.clouds = 'three\'s shadow line not found: no cloud shadows'; return; }
    const lit = chunk.replace(target, '? v5lCl * getShadow( directionalShadowMap[ i ]');
    const seen = new Set(); let n = 0;
    canyon.scene.traverse(o => {
      for (const material of [].concat(o.material || [])) {
        if (!material?.userData?.alpineTerrain || seen.has(material) || typeof material.onBeforeCompile !== 'function') continue;
        seen.add(material);
        const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
        material.onBeforeCompile = function (shader, renderer) {
          compile.call(this, shader, renderer);
          const f = shader.fragmentShader;
          if (f.includes('#define ALP_LITE\n') || f.includes('uV5LCl')) return;
          const a = '#include <lights_fragment_begin>', m = 'void main() {';
          if (f.split(a).length !== 2 || f.split(m).length !== 2 || !f.includes('varying vec3 tWorld;')) { state.clouds = 'a terrain program without its anchors: left without clouds'; return; }
          shader.fragmentShader = f.replace(m, () => 'uniform vec4 uV5LCl;\nfloat v5lCl=1.;\n' + CLOUD_GLSL + m)
            .replace(a, () => '/* flow2 valley5 light: cloud shadows on the sun\'s term */\n      v5lCl=uV5LCl.x>.001?1.-uV5LCl.x*v5lCloud(tWorld.xz):1.;\n' + lit);
          shader.uniforms.uV5LCl = UCL; n++; state.clouds = 'on (' + n + ' programs)';
        };
        material.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|flow2-valley5-light-1'; };
        material.needsUpdate = true;
      }
    });
    if (!seen.size) state.clouds = 'no terrain material found';
    else if (state.clouds === 'not built yet') state.clouds = 'waiting for the terrain to be drawn';
  }
  function depthMaterial() {
    const THREE = ctx.THREE, cap = ctx.cap;
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    m.name = 'flow2 valley5 · walls\' shadow depth';
    m.onBeforeCompile = shader => {
      shader.uniforms.alpineErosion = cap.erosion; shader.uniforms.uCliffRelief = cap.relief;
      shader.vertexShader = 'uniform sampler2D alpineErosion;uniform float uCliffRelief;\n' + cap.src + '\n' + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n  { vec3 v5w=(modelMatrix*vec4(position,1.)).xyz; vec3 v5n=normalize(mat3(modelMatrix)*normal); transformed+=normal*alpBankDisp(v5w,v5n).w; }');
    };
    m.customProgramCacheKey = () => 'flow2-valley5-wall-depth-1';
    return m;
  }

  /* ================= 2. the lights: factors on the page's values, right before each drawing ================= */
  const base = new Map(), wrote = new Map();
  /* a number on an object: the page's value is the base; whatever else writes it becomes the new base */
  function held(o, key, fn, name) {
    if (!o) return;
    const id = (name || o.uuid) + ':' + key, now = o[key];
    if (now !== wrote.get(id)) base.set(id, now);
    const out = fn(base.get(id));
    o[key] = out; wrote.set(id, out);
  }
  /* a colour: the same, compared by value */
  function heldColor(o, key, fn) {
    const c = o?.[key]; if (!c?.isColor) return;
    const id = o.uuid + ':' + key, w = wrote.get(id), b = base.get(id);
    if (!w || w.r !== c.r || w.g !== c.g || w.b !== c.b) base.set(id, c.clone());
    fn(c.copy(base.get(id) || b || c));
    wrote.set(id, c.clone());
  }
  const WARM_SUN = [1, .955, .875], BOUNCE = [1.06, .97, .86];
  const fillDir = [0, 0, 0];
  function findLights() {
    const scene = ctx.canyon?.scene; if (!scene) return;
    for (const o of scene.children) {
      if (o.isDirectionalLight && o.castShadow && !ctx.sun) ctx.sun = o;
      else if (o.isHemisphereLight && !ctx.hemi) ctx.hemi = o;
    }
    scene.traverse(o => { if (o.isDirectionalLight && o.name === 'Alpine sky fill') ctx.fill = o; });
    for (const o of scene.children) if (o.isDirectionalLight && o !== ctx.sun && o !== ctx.fill && !o.castShadow) ctx.rim = o;
    state.light = ctx.sun ? 'on' : 'no sun found';
  }
  function balance() {
    if (!ctx.sun) findLights();
    const sun = ctx.sun; if (!sun) return;
    const cam = ctx.canyon?.camera;
    const camY = cam ? cam.position.y : 0;
    const A = ctx.A = Math.min(1, Math.max(0, +T.amount || 0)) * (1 - smooth(40, 120, camY)) * (ctx.low ? .5 : 1);
    /* the walls cast in the canyon only (the aerial bake keeps its look): switched with the page's own shadow phase, re-baked once */
    const phase = ctx.canyon?.alpineAtmosphere?.phase || (camY > 120 ? 'aerial' : 'canyon');
    const cast = !!(ctx.cap && !ctx.cap.none && T.shadows.walls > .5 && T.amount > .001 && phase === 'canyon' && !ctx.low);
    /* taking the shadow is a uniform in three.js (no new program): only in the canyon, never on the low tier */
    const receive = T.amount > .001 && phase === 'canyon' && !ctx.low && T.shadows.walls > .5;
    if (receive !== ctx.receive) { ctx.receive = receive; for (const o of ctx.banks) o.receiveShadow = receive; for (const o of ctx.blocks) o.receiveShadow = receive; }
    if (cast !== ctx.cast) {
      ctx.cast = cast;
      if (cast && !ctx.depth) ctx.depth = depthMaterial();
      for (const o of ctx.banks) { o.castShadow = cast; if (cast) o.customDepthMaterial = ctx.depth; }
      for (const o of ctx.blocks) o.castShadow = cast;
      sun.shadow.needsUpdate = true; state.bakes++;
      state.walls = cast ? 'casting and receiving' : (phase === 'canyon' ? 'receiving only' : 'receiving only (from the air)');
    }
    held(sun.shadow, 'intensity', b => b + (Math.min(1, Math.max(0, T.shadows.strength)) - b) * (A > .001 ? 1 : 0), sun.uuid + '-shadow');
    /* low tier: no wall shadows and no fourth-round sliver fix there, so the sun is hardly raised (it would light the slivers) */
    const As = ctx.low ? A * .2 : A;
    held(sun, 'intensity', b => b * (1 + (T.key.sun - 1) * As));
    state.sunFactor = +(1 + (T.key.sun - 1) * As).toFixed(3); state.skyFactor = +(1 + (T.shade.sky - 1) * A).toFixed(3);   // for the plants: what the page's sun and sky are multiplied by here
    heldColor(sun, 'color', c => { const k = T.key.warm * A; c.setRGB(c.r * (1 + (WARM_SUN[0] - 1) * k), c.g * (1 + (WARM_SUN[1] - 1) * k), c.b * (1 + (WARM_SUN[2] - 1) * k)); });
    if (ctx.hemi) {
      held(ctx.hemi, 'intensity', b => b * (1 + (T.shade.sky - 1) * A));
      heldColor(ctx.hemi, 'groundColor', c => c.multiplyScalar(1 + (T.shade.ground - 1) * A));
    }
    const scene = ctx.canyon.scene;
    if ('environmentIntensity' in scene) held(scene, 'environmentIntensity', b => b * (1 + (T.shade.env - 1) * A));
    if (ctx.rim) held(ctx.rim, 'intensity', b => b * (1 + (T.shade.rim - 1) * A));
    if (ctx.fill) {
      const f = ctx.fill;
      held(f, 'intensity', b => b * (1 + (T.shade.fill - 1) * A));
      heldColor(f, 'color', c => { const k = T.shade.bounce * A; c.setRGB(c.r * (1 + (BOUNCE[0] - 1) * k) * (1 + .25 * k), c.g * (1 + (BOUNCE[1] - 1) * k) * (1 + .25 * k), c.b * (1 + (BOUNCE[2] - 1) * k) * (1 + .25 * k)); });
      /* turned: from the anti-sun (behind the lens, 38° up) toward across the canyon on the anti-sun side, and lower */
      const d = sun.position.clone().sub(sun.target.position).normalize();
      const az = Math.atan2(d.x, -d.z), anti = az + Math.PI, across = d.x < 0 ? Math.PI * .5 : -Math.PI * .5;
      const t = T.shade.turn * A, a = anti + (((across - anti + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;
      const el = (38 + (T.shade.low - 38) * t) * Math.PI / 180;
      fillDir[0] = Math.cos(el) * Math.sin(a); fillDir[1] = Math.sin(el); fillDir[2] = -Math.cos(el) * Math.cos(a);
      f.position.set(f.target.position.x + fillDir[0] * 1000, f.target.position.y + fillDir[1] * 1000, f.target.position.z + fillDir[2] * 1000);
      f.updateMatrixWorld();
    }
    /* the cloud shadows: drift (frozen with "reduce motion") and amount */
    const now = performance.now(), dt = Math.min(.1, Math.max(0, (now - (ctx.t || now)) / 1000)); ctx.t = now;
    if (!still.matches) ctx.drift = (ctx.drift || 0) + dt * T.clouds.speed / Math.max(40, T.clouds.size);
    UCL.value[0] = ctx.low ? 0 : Math.min(1, Math.max(0, T.clouds.amount)) * A; UCL.value[1] = ctx.drift || 0;
    UCL.value[2] = Math.max(40, T.clouds.size); UCL.value[3] = .78 - .45 * Math.min(1, Math.max(0, T.clouds.cover));
    /* the rock colour's own darkening of the lower walls (flow2-valley.js holds it: its value object is changed, and given back at 0) */
    const V = window.__FLOW2_VALLEY__;
    if (V?.ROCK && typeof V.ROCK.valleyShadow === 'number') {
      if (ctx.vsBase === undefined || Math.abs(V.ROCK.valleyShadow - (ctx.vsWrote ?? NaN)) > 1e-9) ctx.vsBase = V.ROCK.valleyShadow;
      const Ak = Math.min(1, Math.max(0, +T.amount || 0));
      V.ROCK.valleyShadow = ctx.vsWrote = ctx.vsBase + (T.rock.valleyShadow - ctx.vsBase) * Ak;
    }
  }
  function hookScene(canyon) {
    const scene = canyon.scene, before = scene.onBeforeRender;
    scene.onBeforeRender = function (...args) {
      try { before?.apply(this, args); } finally { try { balance(); } catch (error) { state.light = 'failed: ' + (error?.message || error); scene.onBeforeRender = before; console.warn('flow2 valley5 light: the light is left as it was', error); } }
    };
  }

  /* ================= 3. the river takes the walls' shadow ================= */
  const R_PARS = 'uniform sampler2D uV5LShadow;uniform mat4 uV5LShadowM;uniform vec4 uV5LSh,uV5LSh2,uV5LCl;\n';
  const R_FUNC = `
    /* flow2 valley5 light: the sun's shadow map at a point on the water (bilinear, 1.5 texels: the soft edge of a wall's shadow) */
    float v5lCmp(vec2 uv,float z){return step(z,v5lUnpack(texture2D(uV5LShadow,uv)));}
    float v5lShadow(vec3 w){
      vec4 c=uV5LShadowM*vec4(w,1.);vec3 s=c.xyz/c.w;
      if(s.x<.001||s.x>.999||s.y<.001||s.y>.999||s.z>1.)return 1.;
      float z=s.z+uV5LSh.y;vec2 g=uV5LSh2.xy*1.5,st=s.xy/g-.5,i=floor(st),f=st-i,b=(i+.5)*g;
      return mix(mix(v5lCmp(b,z),v5lCmp(b+vec2(g.x,0.),z),f.x),mix(v5lCmp(b+vec2(0.,g.y),z),v5lCmp(b+g,z),f.x),f.y);
    }
`;
  /* the RGBA depth packing of the running three.js (packing.glsl), under our own name: r160+ and the older form */
  const unpackFor = THREE => /UnpackDownscale\s*\/\s*PackFactors\.rgb/.test(THREE.ShaderChunk?.packing || '')
    ? 'float v5lUnpack(vec4 v){return dot(v,vec4((255./256.)/vec3(1.,256.,65536.),1./16777216.));}\n'
    : 'float v5lUnpack(vec4 v){return dot(v,(255./256.)/vec4(16777216.,65536.,256.,1.));}\n';
  const A_DECL = 'float f3w=0.,f3sig=0.,f3sky=1.;vec3 f3n=vec3(0.,1.,0.);';
  const A_BODY = 'f3body*=max(.35,1.+uF3L.x*dot(-f3sl,f3sh)+uF3L.y*clamp(f3hg/.05,-1.,1.));';
  const A_SUN = 'col+=uF3SunCol*min(f3g*uF3Sun.w,uF3Cap)*f3w*';
  const G_DECL = `
      /* flow2 valley5 light (flow2-valley5-light.js): is this water in the sun? (1 = sunlit, 0 = in a wall's shadow) */
      float v5sun=1.;
      if(uV5LSh.x>.001&&uRiverSurface>.5)v5sun=mix(1.,v5lShadow(vWorld),uV5LSh.x);
      if(uV5LCl.x>.001&&uRiverSurface>.5)v5sun*=1.-uV5LCl.x*v5lCloud(vWorld.xz);
`;
  function river(args) {
    const { THREE, seaMaterial, CONFIG } = args;
    if (!THREE || !seaMaterial?.isShaderMaterial) { state.water = 'no canyon river'; return; }
    if (!/^on/.test(window.__FLOW2_VALLEY3_WATER__?.state?.water || '')) { state.water = 'the third round\'s water is not on here: the river keeps no shadow'; return; }
    let fs = seaMaterial.fragmentShader;
    const once = a => fs.split(a).length === 2;
    if (fs.includes('uV5LShadow')) { state.water = 'already installed'; return; }
    if (!once(A_DECL) || !once('void main(){')) { state.water = 'the river shader has changed: left as it is'; return; }
    const done = [];
    fs = fs.replace('void main(){', () => unpackFor(THREE) + CLOUD_GLSL + R_FUNC + '    void main(){').replace(A_DECL, () => A_DECL + G_DECL); done.push('shadow');
    if (once(A_BODY)) { fs = fs.replace(A_BODY, () => 'f3body*=max(.35,1.+uF3L.x*v5sun*dot(-f3sl,f3sh)+uF3L.y*clamp(f3hg/.05,-1.,1.));\n        f3body*=mix(uV5LSh.z,uV5LSh.w,v5sun);'); done.push('body'); }
    if (once(A_SUN)) { fs = fs.replace(A_SUN, () => A_SUN + 'v5sun*'); done.push('sun path'); }
    const U = { uV5LShadow: { value: null }, uV5LShadowM: { value: new THREE.Matrix4() }, uV5LSh: { value: new THREE.Vector4() }, uV5LSh2: { value: new THREE.Vector4(1 / 4096, 1 / 4096, 0, 0) }, uV5LCl: UCL };
    seaMaterial.fragmentShader = R_PARS + fs; Object.assign(seaMaterial.uniforms, U); seaMaterial.needsUpdate = true;
    ctx.sea = seaMaterial; ctx.CONFIG = CONFIG; ctx.UW = U;
    state.water = 'on (' + done.join(', ') + ')';
    /* every river mesh: right before it is drawn, the shadow map, its matrix and the real sun */
    const W3 = window.__FLOW2_VALLEY3_WATER__;
    let wallsWas = null;
    const drawn = new Set();
    const before = () => {
      const sun = ctx.sun, map = sun?.shadow?.map?.texture || null, A = ctx.A;
      const on = map && T.water.shadow > .001 && A > .001 && ctx.cast;
      U.uV5LShadow.value = map;
      if (sun) { U.uV5LShadowM.value.copy(sun.shadow.matrix); U.uV5LSh2.value.set(1 / sun.shadow.mapSize.x, 1 / sun.shadow.mapSize.y, 0, 0); }
      U.uV5LSh.value.set(on ? T.water.shadow * A : 0, sun ? sun.shadow.bias : 0, 1 + (T.water.shade - 1) * A, 1 + (T.water.sunlit - 1) * A);
      /* the river's sun is the real sun (its azimuth); the third round's stand-in for a wall's shadow on the sun path goes */
      if (sun && seaMaterial.uniforms.uF3Sun && A > .001) {
        const d = sun.position.clone().sub(sun.target.position).normalize(), u = seaMaterial.uniforms.uF3Sun.value;
        const hl = Math.hypot(d.x, d.z) || 1, ul = Math.hypot(u.x, u.z) || 1;
        /* the third round writes its own direction every frame just before this; blend toward the real sun by water.realSun */
        const k = Math.min(1, Math.max(0, T.water.realSun ?? 1)), ox = u.x / ul, oz = u.z / ul;
        let nx = ox + (d.x / hl - ox) * k, nz = oz + (d.z / hl - oz) * k; const nl = Math.hypot(nx, nz) || 1;
        u.x = nx / nl * ul; u.z = nz / nl * ul;
      }
      if (W3?.tune?.sun) {
        if (on && wallsWas === null) { wallsWas = W3.tune.sun.walls; W3.tune.sun.walls = 0; }
        else if (!on && wallsWas !== null) { W3.tune.sun.walls = wallsWas; wallsWas = null; }
      }
    };
    args.canyon?.scene?.traverse(o => {
      if (!o.isMesh || o.material !== seaMaterial || drawn.has(o)) return; drawn.add(o);
      const own = o.onBeforeRender;
      o.onBeforeRender = function (...a) { try { before(); } catch (error) { state.water = 'failed: ' + (error?.message || error); } return own?.apply(this, a); };
    });
  }

  /* ================= the panel ================= */
  function panel() {
    window.__FLOW2_PANEL__?.add({
      id: 'v5light', title: '光影', key: 'i', tune: T, rows: [
        ['總量', 'amount', 0, 1, .01],
        ['— 陽光與影子 —'],
        ['陽光強度', 'key.sun', .5, 2.5, .01], ['陽光暖度', 'key.warm', 0, 1, .01],
        ['岩壁投影（開／關）', 'shadows.walls', 0, 1, 1], ['影子深淺', 'shadows.strength', 0, 1, .01],
        ['— 陰影裡的光 —'],
        ['天空光（從上方）', 'shade.sky', .5, 3, .01], ['下方反光', 'shade.ground', 0, 1.5, .01],
        ['對岸反射光', 'shade.fill', 0, 2, .01], ['反射光方向（橫向）', 'shade.turn', 0, 1, .01], ['反射光暖度', 'shade.bounce', 0, 1, .01],
        ['環境光', 'shade.env', .5, 2, .01], ['逆光邊緣光', 'shade.rim', 0, 1, .01],
        ['岩壁底部壓暗', 'rock.valleyShadow', 0, 1, .01],
        ['— 雲影（慢慢飄過的雲的影子）—'],
        ['雲影深淺', 'clouds.amount', 0, 1, .01], ['雲量', 'clouds.cover', 0, 1, .01], ['雲的大小（公尺）', 'clouds.size', 120, 900, 10], ['飄的速度', 'clouds.speed', 0, 10, .1],
        ['— 河面 —'],
        ['河面上的影子', 'water.shadow', 0, 1, .01], ['影子裡的水色', 'water.shade', .3, 1, .01], ['陽光下的水色', 'water.sunlit', .8, 1.4, .01], ['河面陽光反光方向（0 原本正中／1 真實太陽）', 'water.realSun', 0, 1, .01]
      ]
    });
  }

  /* ================= hooks ================= */
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const before = host.canyon;
  host.canyon = function (handles = {}) {
    try { return before?.call(this, handles); } finally {
      try { walls(handles); if (ctx.canyon && !handles.lite) hookScene(ctx.canyon); } catch (error) { state.walls = 'failed: ' + (error?.message || error); console.warn('flow2 valley5 light: the walls keep their light', error); }
      try { if (ctx.canyon && !handles.lite && ctx.tier !== 'low') cloudLink(ctx.canyon); else if (ctx.tier === 'low') state.clouds = 'low tier: off'; } catch (error) { state.clouds = 'failed: ' + (error?.message || error); }
    }
  };
  const prevLight = window.__FLOW2_CANYON_LIGHT__;
  window.__FLOW2_CANYON_LIGHT__ = { ...(prevLight || {}), install(args) { try { prevLight?.install?.(args); } finally { try { river(args || {}); } catch (error) { state.water = 'failed: ' + (error?.message || error); console.warn('flow2 valley5 light: the river keeps no shadow', error); } } } };
  try { panel(); } catch (error) { }
})();
