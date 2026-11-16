/* Flow2 valley, fifth round: the river's waves (director C, 2026-11-14). index1-5-flow2.html only. ?v5water=0 leaves it out.
   Client: 「河道海浪1倍」 — the river's waves doubled; waves like the sea. The third round gave the river deep water and wave normals,
   the fourth fine ripples, shallows and a lap line: still a calm sheet, no wave had a body. This gives the waves bodies.

   1. SWELL WITH A BODY. Five trains (26 m down to 6.7 m) that travel DOWN the river with the current, written in the river's own
      coordinates (distance along it, offset across it), so their crests turn with every bend and spread or crowd on the outside
      and inside of a bend. Near the lens they are real geometry: the river's mesh is subdivided (2 × 2, high tier) and the
      vertices rise and fall (sharpened Gerstner crests, about half a metre crest to trough at most, a metre where they stack),
      so crests hide the troughs behind them and catch the light; past ~260 m the same trains go on as normals and, once a pixel
      can no longer hold them, as roughness (they still darken the far water and widen the sun's path, never shimmer). The slope
      of every train feeds the third round's own surface, so the faces, the mirrored canyon and the sun on the water all ride
      the swell; the crest tint takes their height.
   2. THE WATER ANSWERS THE VALLEY. The swell dies toward the banks and round the stones in the water (the river's own
      shore distance field), steepens into shorter chop where the river narrows, goes glassy on the inside of bends, and
      changes slowly from stretch to stretch (no repeating stamp). Where it meets a bank or a stone a thin lace breathes with the
      swell (more when a crest arrives); small white caps only on the steepest crests in the narrows. Never a band, nothing on
      a clock of its own, nothing finer than a pixel.
   3. THE WASH. The fourth round's lap line runs up and back with the incoming swell.
   4. WITHOUT THE MIRROR. flow2-valley.js takes its mirrored canyon away when frames run late (~4 s); the third and fourth rounds'
      water went with it and a pale river with a white band was left. Now the water keeps going: the mirrored picture is
      replaced by a painted canyon (sky above, the walls' darker band, wider across the river than along it), the waves, the
      shore and the colours stay. The values that file stops sending (fog, water colours) are sent from here meanwhile.
   Quality tiers (flow2-quality.js .start): high as above; medium = the original mesh (no subdivision), shorter reach; low = off
   (the third round is not installed there). A step down while running shortens the reach (uniforms only).
   Eases out before the lens leaves the canyon (journey 9.6 → 10.3); "reduce motion" stills it.
   Live: window.__FLOW2_VALLEY5_WATER__.tune / .state; panel 「河面」 (key W). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('v5water') === '0') return;
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const T = {
    amount: num('v5waterAmt', 1),       // all of it (0 = the river as the fourth round left it)
    swell: {
      height: num('v5swell', 1.3),      // the swell's height (×): 1.3 ≈ 0.6–0.9 m crest to trough, more where trains stack
      length: 1,                        // its wavelength (×)
      speed: .8,                        // its speed (× deep-water waves of that length)
      reach: 260,                       // how far (m) the vertices carry it (beyond: normals only)
      crest: 1,                         // how much its crests take the third round's paler crest tint
      body: .35                         // crests lighter, troughs darker (the swell's own light and shade)
    },
    valley: {
      calm: 6,                          // the swell dies within this many metres of a bank or a stone
      narrows: .6,                      // extra chop where the river narrows
      lee: .55,                         // calm on the inside of bends
      patches: .3                       // slow change of the swell from stretch to stretch
    },
    shore: { lace: .5, wash: 1, caps: .35 },   // the lace at banks and stones, the lap line's run-up, white caps in the narrows
    fallback: 1                         // keep the waves and a painted canyon when flow2-valley.js takes its mirror away
  };
  const state = { water: 'not built yet', mesh: 'not built yet', fallback: 'mirror on' };
  window.__FLOW2_VALLEY5_WATER__ = { tune: T, state };
  if ((innerWidth < 760 && !document.documentElement.hasAttribute('data-flow2-phone-full'))) { state.water = state.mesh = 'small screen: off'; return; }
  const QL = window.__FLOW2_QUALITY__, tier = QL?.start || 'high';
  let reachScale = tier === 'medium' ? .6 : 1, lowNow = tier === 'low';
  try { QL?.on?.(({ level }) => { reachScale = level === 'high' ? 1 : .6; lowNow = level === 'low'; state.tier = level; }); } catch (error) { }
  state.tier = tier;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ---------- the river's own coordinates, and a finer mesh near the lens ---------- */
  /* aV5R = (s: metres along the river, n: metres across it (+ right of the flow), tangent x, z); aV5S = (half width, curvature, 1, 0) */
  function prepare(THREE, mesh, k) {
    const g = mesh.geometry, info = mesh.userData?.journeyRiver;
    if (!info || !g.attributes.position || !g.attributes.uv) return 'the river mesh is not the expected grid';
    const L = info.lengthSegments, W = info.widthSegments, cols = W + 1, rows = L + 1;
    const P = g.attributes.position.array;
    if (P.length !== rows * cols * 3) return 'the river mesh is not the expected grid';
    /* per row: centre, tangent, arc length, half width, curvature */
    const cx = new Float64Array(rows), cz = new Float64Array(rows), tx = new Float64Array(rows), tz = new Float64Array(rows), s = new Float64Array(rows), hw = new Float64Array(rows), kap = new Float64Array(rows);
    for (let r = 0; r < rows; r++) {
      const a = r * cols * 3, b = (r * cols + W) * 3;
      cx[r] = (P[a] + P[b]) / 2; cz[r] = (P[a + 2] + P[b + 2]) / 2; hw[r] = Math.hypot(P[b] - P[a], P[b + 2] - P[a + 2]) / 2;
      if (r) s[r] = s[r - 1] + Math.hypot(cx[r] - cx[r - 1], cz[r] - cz[r - 1]);
    }
    for (let r = 0; r < rows; r++) {
      const r0 = Math.max(0, r - 1), r1 = Math.min(L, r + 1); let dx = cx[r1] - cx[r0], dz = cz[r1] - cz[r0]; const l = Math.hypot(dx, dz) || 1; tx[r] = dx / l; tz[r] = dz / l;
    }
    for (let r = 0; r < rows; r++) {
      const r0 = Math.max(0, r - 3), r1 = Math.min(L, r + 3);
      const a0 = Math.atan2(tx[r0], -tz[r0]), a1 = Math.atan2(tx[r1], -tz[r1]); let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      kap[r] = da / Math.max(1e-3, s[r1] - s[r0]);
    }
    const kL = k, kW = k, L2 = L * kL, W2 = W * kW, cols2 = W2 + 1, rows2 = L2 + 1, n2 = rows2 * cols2;
    const names = Object.keys(g.attributes), src = {}, dst = {};
    for (const name of names) { const at = g.attributes[name]; src[name] = { a: at.array, n: at.itemSize }; dst[name] = new Float32Array(n2 * at.itemSize); }
    const R5 = new Float32Array(n2 * 4), S5 = new Float32Array(n2 * 4);
    for (let r2 = 0; r2 < rows2; r2++) {
      const fr = r2 / kL, r0 = Math.min(L - 1, Math.floor(fr)), tr = fr - r0, r1 = r0 + 1;
      const ccx = cx[r0] + (cx[r1] - cx[r0]) * tr, ccz = cz[r0] + (cz[r1] - cz[r0]) * tr, ss = s[r0] + (s[r1] - s[r0]) * tr;
      let ttx = tx[r0] + (tx[r1] - tx[r0]) * tr, ttz = tz[r0] + (tz[r1] - tz[r0]) * tr; const tl = Math.hypot(ttx, ttz) || 1; ttx /= tl; ttz /= tl;
      const hh = hw[r0] + (hw[r1] - hw[r0]) * tr, kk = kap[r0] + (kap[r1] - kap[r0]) * tr;
      for (let c2 = 0; c2 < cols2; c2++) {
        const fc = c2 / kW, c0 = Math.min(W - 1, Math.floor(fc)), tc = fc - c0, c1 = c0 + 1, i = r2 * cols2 + c2;
        const i00 = r0 * cols + c0, i01 = r0 * cols + c1, i10 = r1 * cols + c0, i11 = r1 * cols + c1;
        const w00 = (1 - tr) * (1 - tc), w01 = (1 - tr) * tc, w10 = tr * (1 - tc), w11 = tr * tc;
        for (const name of names) {
          const { a, n } = src[name], d = dst[name];
          for (let q = 0; q < n; q++) d[i * n + q] = a[i00 * n + q] * w00 + a[i01 * n + q] * w01 + a[i10 * n + q] * w10 + a[i11 * n + q] * w11;
        }
        const px = dst.position[i * 3], pz = dst.position[i * 3 + 2];
        R5[i * 4] = ss; R5[i * 4 + 1] = (px - ccx) * (-ttz) + (pz - ccz) * ttx; R5[i * 4 + 2] = ttx; R5[i * 4 + 3] = ttz;
        S5[i * 4] = hh; S5[i * 4 + 1] = kk; S5[i * 4 + 2] = 1; S5[i * 4 + 3] = 0;
      }
    }
    if (k > 1) {
      const out = new THREE.BufferGeometry();
      for (const name of names) { const at = g.attributes[name]; out.setAttribute(name, new THREE.BufferAttribute(dst[name], at.itemSize, at.normalized)); }
      const idx = new Uint32Array(L2 * W2 * 6); let c = 0;
      for (let r = 0; r < L2; r++) for (let q = 0; q < W2; q++) { const a = r * cols2 + q, b = a + cols2; idx[c++] = a; idx[c++] = a + 1; idx[c++] = b; idx[c++] = a + 1; idx[c++] = b + 1; idx[c++] = b; }
      out.setIndex(new THREE.BufferAttribute(idx, 1));
      out.setAttribute('aV5R', new THREE.BufferAttribute(R5, 4)); out.setAttribute('aV5S', new THREE.BufferAttribute(S5, 4));
      out.computeBoundingBox(); out.computeBoundingSphere();
      mesh.geometry = out;
      mesh.userData.journeyRiver = { ...info, lengthSegments: L2, widthSegments: W2, v5: 'subdivided ' + k + ' × ' + k + ' by flow2-valley5-water.js (was ' + L + ' × ' + W + ')' };
      g.dispose();
      return 'subdivided ' + k + ' × ' + k + ' (' + (L2 * W2 * 2) + ' triangles)';
    }
    g.setAttribute('aV5R', new THREE.BufferAttribute(R5, 4)); g.setAttribute('aV5S', new THREE.BufferAttribute(S5, 4));
    return 'original mesh (' + (L * W * 2) + ' triangles)';
  }

  /* ---------- GLSL ---------- */
  /* the five trains: (direction across the flow in radians, wavelength m, height m, phase) */
  const TRAINS = [[.10, 26, .26, 0], [.48, 17.5, .2, 1.7], [-.38, 12.6, .16, 3.1], [.72, 9.1, .12, 4.4], [-.80, 6.7, .09, 5.9]];
  const glslTrains = TRAINS.map(([th, l, a, p]) => `vec4(${th.toFixed(3)},${l.toFixed(2)},${a.toFixed(3)},${p.toFixed(2)})`).join(',');
  const V_PARS = `attribute vec4 aV5R,aV5S;
uniform vec4 uV5W,uV5W2,uV5W3;uniform float uV5Mo;
varying vec4 vV5R;varying vec3 vV5G;
const vec4 V5TR[5]=vec4[5](${glslTrains});
/* flow2 valley5 water: how much swell this point of the river carries (banks, stones, narrows, bends, stretches) */
vec2 v5Gate(vec4 r,vec4 sh,float bank){
  float g=smoothstep(.5,uV5W2.y,bank);
  float wide=sh.x/1.34;
  float narrow=1.-smoothstep(16.5,21.5,wide);   /* the canyon's middle runs 16-22 m half-wide: only its pinches count */
  float inner=smoothstep(.0015,.008,sh.y*sign(r.y))*smoothstep(.2,.85,abs(r.y)/max(sh.x,1.));
  g*=1.-uV5W3.y*inner;
  g*=1.+uV5W3.z*(sin(r.x*.0213+1.3)*sin(r.x*.0069+r.y*.043+.4));
  return vec2(g,narrow);
}
`;
  const V_MAIN = `
      /* flow2 valley5 water (flow2-valley5-water.js): the swell as geometry near the lens (the river's own coordinates) */
      vV5R=aV5R;vV5G=vec3(0.);
      if(uV5W.x>.001&&uRiverSurface>.5&&aV5S.z>.5){
        vec2 v5g=v5Gate(aV5R,aV5S,aShore.y);vV5G=vec3(v5g,0.);
        float v5near=uV5W.x*(1.-smoothstep(uV5W2.x*.55,uV5W2.x,length(cameraPosition-world.xyz)));
        if(v5near>.001){
          vec2 v5t=aV5R.zw,v5n=vec2(-v5t.y,v5t.x);float v5tt=uSeaTime*uV5Mo;vec3 v5d=vec3(0.);
          for(int i=0;i<5;i++){
            vec4 w=V5TR[i];float k=6.2831853/(w.y*uV5W.z),a=w.z*uV5W.y*v5g.x*(1.+v5g.y*uV5W2.z*float(i)*.25);
            vec2 D=vec2(cos(w.x),sin(w.x));float ph=k*dot(D,aV5R.xy)-sqrt(9.81*k)*uV5W.w*v5tt+w.w;
            v5d.y+=a*sin(ph);v5d.xz+=(D.x*v5t+D.y*v5n)*(.8*a*cos(ph));
          }
          world.xyz+=v5d*v5near;vV5G.z=v5d.y*v5near;
        }
      }
`;
  const F_PARS = `uniform vec4 uV5W,uV5W2,uV5W3,uV5F,uV5F2;uniform float uV5Mo;
varying vec4 vV5R;varying vec3 vV5G;
const vec4 V5TR[5]=vec4[5](${glslTrains});
`;
  const F_FUNC = `
    /* flow2 valley5 water: the canyon painted into the water when the mirrored picture is gone (sky above, the walls' band,
       nearer across the river than along it) */
    vec3 v5Sky(vec3 R,vec2 t){
      vec2 h=R.xz/max(length(R.xz),1e-4),sd=vec2(-t.y,t.x);
      float across=abs(dot(h,sd)),wallE=mix(.07,.6,across*across);
      vec3 sky=mix(uF2Fog.rgb*1.04,uF2Fog.rgb*vec3(.66,.78,.98),smoothstep(0.,.75,R.y));
      vec3 rock=uF2Fog.rgb*vec3(.27,.30,.35)*(.8+.4*smoothstep(-.2,.6,dot(h,normalize(uF3Sun.xz+vec2(1e-4)))));
      return mix(rock,sky,smoothstep(wallE-.09,wallE+.09,R.y));
    }
`;
  const A_DECL = 'float f3w=0.,f3sig=0.,f3sky=1.;vec3 f3n=vec3(0.,1.,0.);';
  const G_DECL = `
      /* flow2 valley5 water: the swell's height at this point without the bank's calm (the wash), and its steepness (the caps) */
      float v5hb=0.,v5st=0.,v5hc=0.;`;
  const A_GUARD = 'if(uF3W.x>.001&&uRiverSurface>.5&&uF2Water.x>.001){';
  const A_W = 'f3w=clamp(uF3W.x*uF2Water.x*(1.-uJourneyNight),0.,1.);';
  const A_REFL = 'f3R=min(f3R,uF2Fog.rgb*2.2+.15);';
  const A_NORMAL = 'f3n=normalize(vec3(nrm.x-f3sl.x,nrm.y,nrm.z-f3sl.y));';
  const A_MIX = 'col=mix(col,f3col,f3w);';
  const A_COL = 'vec3 f3col=mix(f3body,f3R,clamp(f3F*uF3W.w+uF3B.y,0.,1.));';
  const A_LAP = 'float v4in=vShore.y+';
  const G_SLOPE = `/* flow2 valley5 water: the swell's slope (the same trains as the vertices), its height for the crest tint; once a pixel can
           no longer hold a train it is kept as variance (roughness) */
        if(uV5W.x>.001&&dot(vV5R.zw,vV5R.zw)>.25){
          vec2 v5t=vV5R.zw/max(length(vV5R.zw),1e-4),v5n=vec2(-v5t.y,v5t.x);float v5tt=uSeaTime*uV5Mo,v5den=1.;vec2 v5sl=vec2(0.);float v5h=0.;
          for(int i=0;i<5;i++){
            vec4 w=V5TR[i];float k=6.2831853/(w.y*uV5W.z),a0=w.z*uV5W.y*(1.+vV5G.y*uV5W2.z*float(i)*.25),a=a0*vV5G.x;
            vec2 D=vec2(cos(w.x),sin(w.x));float ph=k*dot(D,vV5R.xy)-sqrt(9.81*k)*uV5W.w*v5tt+w.w;
            float keep=1.-smoothstep(.7,2.,f3px*k);
            v5sl+=D*(a*k*cos(ph)*keep);v5h+=a*sin(ph)*keep;v5den-=.8*k*a*sin(ph)*keep;
            v5hb+=a0*sin(ph);
            f3va+=(1.-keep*keep)*.55*(a*k)*(a*k);
          }
          v5sl/=max(v5den,.4);
          v5st=length(v5sl);v5hc=v5h;
          f3sl+=(v5sl.x*v5t+v5sl.y*v5n)*uV5W.x;
          f3hg+=v5h*.17*uV5W3.x*uV5W.x;
        }
        `;
  const G_FOAM = `
      /* flow2 valley5 water: a thin lace where the water meets a bank or a stone, breathing with the swell; small white caps on
         the steepest crests in the narrows. Moves with the water, fades before it is finer than a pixel */
      if(f3w>.001&&uV5W.x>.001&&(uV5W3.w>.001||uV5F.z>.001)){
        float v5px=fwidth(vWorld.x)+fwidth(vWorld.z)+1e-3,v5vis=(1.-smoothstep(.12,.55,v5px))*f3w*uV5W.x;
        if(v5vis>.002){
          vec2 v5q=vWorld.xz+uF3Flow.xy*uSeaTime*uV5Mo;
          float v5br=seaNoise(v5q*1.7+vec2(3.7,1.1))*.6+seaNoise(v5q*4.3+vec2(9.2,5.5))*.4;
          float v5edge=(1.-smoothstep(0.,.55+.5*v5br,vShore.y-max(v5hb,0.)*1.4))*smoothstep(.36,.62,v5br)*(.45+.55*smoothstep(-.05,.2,v5hb));
          float v5cap=smoothstep(.34,.6,v5st)*vV5G.y*smoothstep(.55,.8,v5br)*smoothstep(.08,.2,v5hb);
          float v5f=clamp(v5edge*uV5W3.w+v5cap*uV5F.z,0.,.75)*v5vis;
          vec3 v5fc=uShoreFoamColor*mix(.45,1.,smoothstep(.2,.7,dot(uF2Fog.rgb,vec3(.33))))*V5SUN;
          col=mix(col,v5fc,v5f);
        }
      }
`;

  function river(args) {
    const { THREE, seaMaterial, journey, canyon } = args;
    if (!THREE || !seaMaterial?.isShaderMaterial) { state.water = 'no canyon river'; return; }
    if (tier === 'low') { state.water = state.mesh = 'low tier: the page\'s river (no swell)'; return; }
    if (!/^on/.test(window.__FLOW2_VALLEY3_WATER__?.state?.water || '')) { state.water = 'the third round\'s water is not on here: no swell'; return; }
    let vs = seaMaterial.vertexShader, fs = seaMaterial.fragmentShader;
    if (vs.includes('aV5R')) { state.water = 'already installed'; return; }
    const onceV = a => vs.split(a).length === 2, onceF = a => fs.split(a).length === 2;
    if (!onceV('world.xyz+=d;') || !onceV('void main(){') || !vs.includes('attribute vec3 aShore;')) { state.water = 'the river\'s vertex shader has changed: left as it is'; return; }
    if (!onceF(A_DECL) || !onceF(A_NORMAL) || !onceF('void main(){')) { state.water = 'the river shader has changed: left as it is'; return; }
    /* the mesh first (if it fails, nothing is changed) */
    const mesh = canyon?.river?.mesh;
    if (!mesh || mesh.material !== seaMaterial) { state.water = 'the main river mesh was not found'; return; }
    const t0 = performance.now();
    const how = prepare(THREE, mesh, tier === 'high' ? 2 : 1);
    if (!/^subdivided|^original/.test(how)) { state.water = state.mesh = how; return; }
    state.mesh = how + ' in ' + Math.round(performance.now() - t0) + ' ms';
    seaMaterial.defaultAttributeValues = { ...(seaMaterial.defaultAttributeValues || {}), aV5R: [0, 0, 0, 0], aV5S: [0, 0, 0, 0] };
    vs = vs.replace('void main(){', () => V_PARS + '    void main(){').replace('world.xyz+=d;', () => 'world.xyz+=d;' + V_MAIN);
    const done = ['swell'], skipped = [];
    const sun = fs.includes('float v5sun') ? 'v5sun' : '1.';
    fs = fs.replace('void main(){', () => F_FUNC + '    void main(){').replace(A_DECL, () => A_DECL + G_DECL).replace(A_NORMAL, () => G_SLOPE + A_NORMAL);
    const put = (name, a, b) => { if (onceF(a)) { fs = fs.replace(a, () => b); done.push(name); } else skipped.push(name); };
    /* without the mirror: the third round's water stays (f3w alive), its mirrored picture painted */
    put('fallback', A_GUARD, 'if(uF3W.x>.001&&uRiverSurface>.5&&max(uF2Water.x,uV5F.x)>.001){');
    put('fallback amount', A_W, 'f3w=clamp(uF3W.x*max(uF2Water.x,uV5F.x)*(1.-uJourneyNight),0.,1.);');
    put('painted canyon', A_REFL, A_REFL + 'if(uV5F.y>.001)f3R=mix(f3R,v5Sky(reflect(-V,f3n),vV5R.zw),uV5F.y);');
    put('body', A_COL, A_COL + '\n        f3col*=1.+clamp(v5hc/.32,-1.,1.)*uV5F2.x*uV5W.x;');
    put('lace', A_MIX, A_MIX + G_FOAM.replace('V5SUN', 'mix(.5,1.,' + sun + ')'));
    put('wash', A_LAP, A_LAP + '(max(v5hb,-.25)*uV5F.w)+');
    seaMaterial.vertexShader = vs; seaMaterial.fragmentShader = F_PARS + fs;
    const U = {
      uV5W: { value: new THREE.Vector4() }, uV5W2: { value: new THREE.Vector4() }, uV5W3: { value: new THREE.Vector4() },
      uV5F: { value: new THREE.Vector4() }, uV5F2: { value: new THREE.Vector4() }, uV5Mo: { value: 1 }
    };
    Object.assign(seaMaterial.uniforms, U); seaMaterial.needsUpdate = true;
    state.water = 'on (' + done.join(', ') + ')' + (skipped.length ? ' · not found: ' + skipped.join(', ') : '');
    /* every frame: the dials, and the fallback */
    const V = window.__FLOW2_VALLEY__, fogColor = new THREE.Color();
    let fall = 0, last = 0;
    (function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(.1, Math.max(0, ((now || 0) - last) / 1000)); last = now || 0;
      const p = +journey?.progress, cam = canyon?.camera, camY = cam ? cam.position.y : 0;
      const LF = window.__FLOW2_LIFT_FADE__, riverDial = Number.isFinite(p) ? 1 - smooth(LF ? LF[0] : 9.6, LF ? LF[1] : 10.3, p) : 1, high = 1 - Math.min(1, Math.max(0, (camY - 34) / 116));
      const A = lowNow ? 0 : Math.min(1, Math.max(0, +T.amount || 0)) * riverDial;
      U.uV5W.value.set(A, T.swell.height, T.swell.length, T.swell.speed);
      /* 2026-11-15 (lead): the river's light beams (canyon.followLights, ribbons at a fixed height ≈ 1.4 m) were cut by the swell's
         crests into dashes; they ride above the waves by the swell's own amplitude (back to 0 with the waves) */
      const FL = canyon?.followLights?.group; if (FL) { const lift = A * T.swell.height * .9; if (Math.abs(FL.position.y - lift) > .005) { FL.position.y = lift; FL.updateMatrixWorld(true); } }
      U.uV5W2.value.set(T.swell.reach * reachScale, T.valley.calm, T.valley.narrows, 0);
      U.uV5W3.value.set(T.swell.crest, T.valley.lee, T.valley.patches, T.shore.lace);
      U.uV5Mo.value = still.matches ? 0 : 1;
      /* the mirror gone (flow2-valley.js: 'going' / 'taken away'): ease the painted canyon in over its own 1.2 s */
      const test = window.__FLOW2_VALLEY5_WATER__.testFallback === true;   // captures: stand in for a retreat (set __FLOW2_VALLEY__.tune.water = 0 too)
      const gone = (test || /^(going|taken away)/.test(V?.state?.mirror || '')) && T.fallback > .5;
      fall = gone ? Math.min(1, fall + dt / 1.2) : 0;
      const keep = fall > 0 ? fall * high * riverDial * (test ? 1 : (V?.tune?.water ?? 1)) : 0;
      U.uV5F.value.set(keep, fall, T.shore.caps, T.shore.wash); U.uV5F2.value.set(T.swell.body, 0, 0, 0);
      if (fall > 0 && seaMaterial.uniforms.uF2Fog) {
        const fog = canyon?.scene?.fog; if (fog?.color) { fogColor.copy(fog.color); seaMaterial.uniforms.uF2Fog.value.set(fogColor.r, fogColor.g, fogColor.b, fog.density ?? .001); }
        const t = V?.tune; if (t) { try { seaMaterial.uniforms.uF2Deep.value.set(...t.deep); seaMaterial.uniforms.uF2Shallow.value.set(...t.shallow); seaMaterial.uniforms.uF2Tone.value.set(t.clarity, t.floor, t.swell); } catch (error) { } }
        state.fallback = 'painted canyon (the mirror is ' + (V?.state?.mirror || '?') + ')';
      } else if (state.fallback !== 'mirror on') state.fallback = 'mirror on';
    })();
    document.documentElement.dataset.flow2Valley5Water = 'on';
  }

  /* ---------- the panel ---------- */
  try {
    window.__FLOW2_PANEL__?.add({
      id: 'v5water', title: '河面', key: 'w', tune: T, rows: [
        ['總量', 'amount', 0, 1, .01],
        ['— 浪 —'],
        ['浪高', 'swell.height', 0, 2.5, .01], ['浪長', 'swell.length', .5, 2, .01], ['浪速', 'swell.speed', 0, 2, .01],
        ['立體浪的距離（公尺）', 'swell.reach', 60, 400, 10], ['浪峰變淺', 'swell.crest', 0, 2, .01], ['浪峰亮、浪谷暗', 'swell.body', 0, 1, .01],
        ['— 跟著河道 —'],
        ['岸邊與石頭旁平靜（公尺）', 'valley.calm', 1, 20, .5], ['窄處浪更碎', 'valley.narrows', 0, 1.5, .01],
        ['彎道內側平靜', 'valley.lee', 0, 1, .01], ['一段一段的變化', 'valley.patches', 0, .6, .01],
        ['— 岸邊 —'],
        ['岸邊與石頭的白邊', 'shore.lace', 0, 1, .01], ['拍岸的水線', 'shore.wash', 0, 2, .01], ['窄處的小白浪', 'shore.caps', 0, 1, .01]
      ]
    });
  } catch (error) { }

  const prev = window.__FLOW2_CANYON_LIGHT__;
  window.__FLOW2_CANYON_LIGHT__ = { ...(prev || {}), install(args) { try { prev?.install?.(args); } finally { try { river(args || {}); } catch (error) { state.water = 'failed: ' + (error?.message || error); console.warn('flow2 valley5 water: the river stays as it was', error); } } } };
})();
