/* =============================================================================================
   FLOW · bubble — the drop. One main body (sphere that can draw itself into a teardrop, wobble,
   and take in smaller drops with a dent and a ring) and an instanced cloud of small drops.
   Shading: refraction through a solid water sphere (entry and exit, three indices for
   dispersion, sampled from the rendered world, so the scene appears inverted inside, like the
   reference drop), blended with an almost unbent soap film. As a portal the drop shows another
   camera's view instead (the next scene: rays leaving the drop are read as directions in that
   camera's frame, so it appears inverted, as through a ball lens); a thin-film interference colour on
   the reflection (the iridescent rim); a studio "softbox" highlight up-left and the sun.
   ============================================================================================= */
import * as THREE from 'three';
import { GLSL_SKY } from './world.js';

const MAX_IMPACTS = 8;

const VERT = /* glsl */`
uniform float uMorph, uWobble, uTime;
uniform vec4 uImp[${MAX_IMPACTS}];
uniform float uImpPh[${MAX_IMPACTS}];
varying vec3 vWorld, vNrm, vCenter;
varying float vRadius, vFilmY;
vec3 shapeP(vec3 n) {
  vec3 P = n;
#ifndef SMALL
  float th = acos(clamp(n.y, -1., 1.));
  vec2 hz = n.xz / max(length(n.xz), 1e-5);
  float rr = sin(th) * pow(sin(th * .5), 1.35);
  vec3 tear = vec3(hz.x * rr * 1.32, cos(th) * 1.16 + .16, hz.y * rr * 1.32);
  P = mix(n, tear, uMorph);
#endif
  float w = uWobble * (sin(dot(n, vec3(3.1, 1.7, 2.3)) + uTime * 1.3) * .5 + sin(dot(n, vec3(-2.3, 3.7, 1.1)) * 1.7 - uTime * 1.7) * .3 + sin(dot(n, vec3(1.3, -2.1, 4.1)) * 2.3 + uTime * 2.1) * .2);
#ifndef SMALL
  for (int i = 0; i < ${MAX_IMPACTS}; i++) {
    float a = 1. - dot(n, uImp[i].xyz);
    w += uImp[i].w * (exp(-a * 10.) * .12 + sin(a * 24. - uImpPh[i]) * exp(-a * 4.5) * .025);
  }
#endif
  return P * (1. + w);
}
void main() {
  mat4 M = modelMatrix;
#ifdef USE_INSTANCING
  M = modelMatrix * instanceMatrix;
#endif
  vec3 n = normalize(position);
  vec3 P = shapeP(n);
  vec3 t1 = normalize(cross(abs(n.y) < .98 ? vec3(0., 1., 0.) : vec3(1., 0., 0.), n));
  vec3 t2 = cross(n, t1);
  float e = .012;
  vec3 Pa = shapeP(normalize(n + t1 * e)), Pb = shapeP(normalize(n + t2 * e));
  vec3 N = normalize(cross(Pa - P, Pb - P));
  if (dot(N, P) < 0.) N = -N;
  vec4 wp = M * vec4(P, 1.);
  vWorld = wp.xyz;
  vNrm = normalize(mat3(M) * N);
  vCenter = (M * vec4(0., 0., 0., 1.)).xyz;
  vRadius = length(M[0].xyz);
  vFilmY = n.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */`
uniform sampler2D tScene, tPortal;
uniform mat4 uViewProj, uPortalProj;
uniform float uPortal, uPortalBias;
uniform vec2 uRes;
uniform float uIOR, uDisp, uDrop, uFilm, uFilmThick, uFade, uBackDist, uTime, uSoftbox, uGlow, uOpacity;
uniform vec3 uEnvGround;
${GLSL_SKY}
varying vec3 vWorld, vNrm, vCenter;
varying float vRadius, vFilmY;
vec3 env(vec3 d) {
  vec3 c = skyColor(d);
  return mix(c, uEnvGround, smoothstep(.02, -.3, d.y));
}
vec3 sceneAt(vec3 from, vec3 dir) {
  vec4 c = uViewProj * vec4(from + dir * uBackDist, 1.);
  vec2 uv = c.xy / max(c.w, 1e-4) * .5 + .5;
  float w = step(0., c.w) * clamp(smoothstep(.0, .08, min(min(uv.x, uv.y), min(1. - uv.x, 1. - uv.y)) + .08), 0., 1.);
  return mix(env(dir), texture(tScene, 1. - abs(mod(uv, 2.) - 1.)).rgb, w);
}
vec3 portalAt(vec3 dir) {
  vec3 dv = (viewMatrix * vec4(dir, 0.)).xyz;
  vec4 c = uPortalProj * vec4(dv, 1.);
  vec3 t = texture(tPortal, 1. - abs(mod(c.xy / max(c.w, 1e-4) * .5 + .5, 2.) - 1.), uPortalBias).rgb;
  return mix(env(dir), t, step(1e-4, c.w));
}
vec3 thinFilm(float cosI, float thick) {
  float n = 1.33;
  float cosT = sqrt(max(0., 1. - (1. - cosI * cosI) / (n * n)));
  vec3 lam = vec3(650., 540., 450.);
  vec3 ph = 12.566 * n * thick * cosT / lam;
  return .5 - .5 * cos(ph);
}
void main() {
  vec3 N = normalize(vNrm);
  vec3 V = normalize(vWorld - cameraPosition);
  if (dot(N, V) > 0.) N = -N;
  float NdV = clamp(dot(N, -V), 0., 1.);
  vec2 suv = gl_FragCoord.xy / uRes;
  vec3 nV = normalize((viewMatrix * vec4(N, 0.)).xyz);

  /* Refraction. Drop: entry and exit through a sphere (centre, radius), one index per channel. */
  vec3 refr;
  for (int c = 0; c < 3; c++) {
    float ior = uIOR + (float(c) - 1.) * uDisp;
    vec3 T1 = refract(V, N, 1. / ior);
    vec3 oc = vWorld - vCenter;
    float b = dot(oc, T1), cc = dot(oc, oc) - vRadius * vRadius;
    float tt = -b + sqrt(max(b * b - cc, 0.));
    vec3 P2 = vWorld + T1 * tt;
    vec3 N2 = normalize(P2 - vCenter);
    vec3 T2 = refract(T1, -N2, ior);
    if (dot(T2, T2) < 1e-4) T2 = reflect(T1, -N2);
    vec3 drop = sceneAt(P2, T2);
    if (uPortal > .001) drop = mix(drop, portalAt(T2), uPortal);
    vec2 uvS = suv - nV.xy * (.010 + .012 * float(c)) * pow(1. - NdV, 2.2);
    vec3 soap = texture(tScene, clamp(uvS, 0., 1.)).rgb;
    if (uPortal > .001) soap = mix(soap, texture(tPortal, clamp(uvS, 0., 1.), uPortalBias).rgb, uPortal);
    refr[c] = mix(soap[c], drop[c], uDrop);
  }
  /* Water absorbs a little red over its depth; the soap film does not. */
  refr *= mix(vec3(1.), vec3(.90, .97, 1.), uDrop * NdV);

  /* Reflection: environment, the softbox up-left of the camera, the sun; tinted by the film. */
  vec3 R = reflect(V, N);
  vec3 er = env(R);
  /* The softbox: a rounded rectangle up and to the left of the camera, read in the tangent
     plane around its direction; smaller on the water drop than on the soap bubble. */
  vec3 Rv = normalize((viewMatrix * vec4(R, 0.)).xyz);
  vec3 Bd = normalize(vec3(-.50, .62, .60)), Bx = normalize(cross(vec3(0., 1., 0.), Bd)), By = cross(Bd, Bx);
  float fz = dot(Rv, Bd);
  vec2 q = vec2(dot(Rv, Bx), dot(Rv, By)) / max(fz, .05);
  vec2 dq = abs(q) - mix(vec2(.34, .22), vec2(.16, .11), uDrop);
  float sd = length(max(dq, 0.)) + min(max(dq.x, dq.y), 0.) - .08;
  float box = (1. - smoothstep(-.03, .09, sd)) * step(0., fz);
  float boxGlow = (1. - smoothstep(0., .8, sd)) * step(0., fz);
  vec3 high = vec3(1.) * (box * 1.25 + boxGlow * .1) * uSoftbox;
  float thick = uFilmThick * (1. + .30 * sin(dot(N, vec3(2.1, 5.3, 1.7)) * 1.3 + uTime * .35) + .22 * sin(dot(N, vec3(-4.1, 1.3, 3.7)) - uTime * .27)) + 160. * (1. - vFilmY);
  vec3 film = thinFilm(NdV, thick);
  float F = .02 + .98 * pow(1. - NdV, 5.);
  float Fs = mix(F, min(1., F * 2.2 + .045), uFilm);
  vec3 tint = mix(vec3(1.), film * 2.1, uFilm * smoothstep(.0, .75, 1. - NdV) * .9 + uFilm * .1);
  vec3 refl = er * tint + high * mix(vec3(1.), film * 1.5, uFilm * .25);
  vec3 col = mix(refr, refl, clamp(Fs, 0., 1.)) + high * (1. - Fs) * .35;
  col += uSunColor * pow(max(dot(R, uSunDir), 0.), 600.) * 7.;
  /* A thin dark-then-bright edge where the surface turns away; a glow low inside (focused light). */
  float rim = pow(1. - NdV, 7.);
  col = mix(col, col * .62, rim * .5);
  col += vec3(1., .99, .95) * uGlow * pow(max(dot(N, vec3(0., -1., 0.)), 0.), 2.) * (.4 + .6 * NdV) * .5;
  col = mix(col, texture(tScene, suv).rgb, uFade);
  gl_FragColor = vec4(col * uOpacity, uOpacity);
}
`;

export function createBubbles(world, { quality = 1, smallCount = 40 } = {}) {
  const scene = new THREE.Scene();
  const sky = {
    uZenith: world.shared.uZenith, uHorizon: world.shared.uHorizon, uBelow: world.shared.uBelow,
    uSunDir: world.shared.uSunDir, uSunColor: world.shared.uSunColor, uSunGlow: world.shared.uSunGlow
  };
  const U = extra => ({
    tScene: { value: null }, tPortal: { value: null }, uPortal: { value: 0 }, uPortalBias: { value: 0 }, uPortalProj: { value: new THREE.Matrix4() }, uViewProj: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2(1, 1) },
    uIOR: { value: 1.333 }, uDisp: { value: .012 }, uDrop: { value: .55 }, uFilm: { value: 1 }, uFilmThick: { value: 420 },
    uFade: { value: 0 }, uBackDist: { value: 600 }, uTime: { value: 0 }, uSoftbox: { value: 1 }, uGlow: { value: .4 }, uOpacity: { value: 1 },
    uEnvGround: { value: new THREE.Color(.8, .84, .9) }, uMorph: { value: 0 }, uWobble: { value: .012 },
    uImp: { value: Array.from({ length: MAX_IMPACTS }, () => new THREE.Vector4(0, 1, 0, 0)) }, uImpPh: { value: new Array(MAX_IMPACTS).fill(0) },
    ...sky, ...extra
  });
  const blend = { transparent: true, premultipliedAlpha: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: true };
  const mainMat = new THREE.ShaderMaterial({ uniforms: U({}), vertexShader: VERT, fragmentShader: FRAG, ...blend });
  const seg = quality > .6 ? [180, 140] : [110, 84];
  const main = new THREE.Mesh(new THREE.SphereGeometry(1, seg[0], seg[1]), mainMat);
  main.frustumCulled = false;
  scene.add(main);
  const smallMat = new THREE.ShaderMaterial({ uniforms: U({ uWobble: { value: .02 }, uDrop: { value: .9 }, uFilm: { value: .55 }, uGlow: { value: .2 } }), defines: { SMALL: 1 }, vertexShader: VERT, fragmentShader: FRAG, ...blend });
  const small = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 48, 36), smallMat, smallCount);
  small.frustumCulled = false;
  small.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(small);

  /* Per-drop constants: where it floats relative to the main drop (in units of the main radius,
     in the camera's frame), its size, its drift, and when it is taken in. */
  let a = 9137; const rnd = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const drops = Array.from({ length: smallCount }, (_, i) => {
    const ang = rnd() * Math.PI * 2, rad = 1.5 + Math.pow(rnd(), .7) * 3.6;
    const merge = i < 14;
    return {
      off: new THREE.Vector3(Math.cos(ang) * rad * 1.35, Math.sin(ang) * rad * .78, (rnd() - .5) * 2.4),
      r: merge ? .07 + rnd() * .16 : .02 + Math.pow(rnd(), 2.2) * .14,
      ph: rnd() * 6.283, sp: .25 + rnd() * .45,
      merge, m0: merge ? 1.12 + (i / 14) * .62 + rnd() * .05 : 0, aer: new THREE.Vector3((rnd() - .5) * 2, (rnd() - .5) * 1.2, (rnd() - .5) * 2), aerR: .015 + Math.pow(rnd(), 2) * .06
    };
  });

  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  function update(S, p, time, camera, size) {
    camera.updateMatrixWorld();
    right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1); fwd.setFromMatrixColumn(camera.matrixWorld, 2).negate();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov * .5));
    /* Main drop, placed in the frame: screen position, distance, radius. */
    const D = S.bDist, Rb0 = S.bRadius;
    let grow = 0;
    const u = mainMat.uniforms;
    const imp = u.uImp.value, ph = u.uImpPh.value;
    for (let k = 0; k < imp.length; k++) imp[k].w = 0;
    let slot = 0;
    drops.forEach(d => { if (d.merge) { const m = smooth(d.m0, d.m0 + .16, p); grow += Math.pow(d.r, 3) * m * 5; } });
    const Rb = Rb0 * Math.cbrt(1 + grow);
    const centre = tmpP.copy(camera.position).addScaledVector(fwd, D)
      .addScaledVector(right, S.bX * D * halfH * camera.aspect).addScaledVector(up, S.bY * D * halfH);
    main.position.copy(centre);
    main.scale.setScalar(Rb);
    main.quaternion.copy(camera.quaternion);
    main.visible = S.bOn > .001 && Rb > .001;
    u.uMorph.value = S.bMorph;
    u.uWobble.value = S.bWobble;
    u.uDrop.value = S.bDrop; u.uFilm.value = S.bFilm; u.uFade.value = S.bFade; u.uOpacity.value = S.bOn;
    if (S.bDisp !== undefined) u.uDisp.value = S.bDisp;
    u.uGlow.value = S.bGlow; u.uSoftbox.value = S.bSoftbox;
    u.uBackDist.value = S.bBack;
    u.uEnvGround.value.copy(S.envGround);
    u.uTime.value = time;
    /* Small drops. */
    const su = smallMat.uniforms;
    su.uTime.value = time; su.uBackDist.value = S.bBack * .5; su.uEnvGround.value.copy(S.envGround);
    drops.forEach((d, i) => {
      let r = 0; const pos = new THREE.Vector3();
      const drift = new THREE.Vector3(Math.sin(time * d.sp + d.ph) * .18, Math.cos(time * d.sp * .8 + d.ph) * .14, 0);
      if (S.smallSky > .001) {
        const off = d.off.clone().add(drift);
        let scale = 1;
        if (d.merge) {
          const m = smooth(d.m0, d.m0 + .16, p);
          const dir = off.clone().normalize();
          const contact = dir.clone().multiplyScalar(1 + d.r * .6);
          off.lerp(contact, smooth(d.m0 - .26, d.m0 + .02, p));
          scale = 1 - m;
          const after = p - (d.m0 + .02);
          if (after > 0 && after < .34 && slot < imp.length) {
            const dw = dir.clone();
            imp[slot].set(dw.x, dw.y, dw.z, Math.sin(Math.PI * Math.min(1, after / .34)) * (.4 + d.r * 3.2) * (1 - after / .34 * .6));
            ph[slot] = after * 70; slot++;
          }
        } else {
          off.multiplyScalar(1 + smooth(1.1, 2.1, p) * .5);
        }
        r = d.r * Rb0 * scale * S.smallSky;
        pos.copy(main.position).addScaledVector(right, off.x * Rb0).addScaledVector(up, off.y * Rb0).addScaledVector(fwd, off.z * Rb0);
        /* While the main drop falls the small ones lag above it. */
        pos.addScaledVector(up, S.smallLift * (1 + d.off.z * .3) * Rb0);
      } else if (S.smallAir > .001) {
        const off = d.aer.clone().add(drift.multiplyScalar(.6));
        r = d.aerR * Rb0 * S.smallAir * 2.2;
        pos.copy(camera.position).addScaledVector(fwd, D * (1.1 + d.aer.z * .45)).addScaledVector(right, off.x * D * halfH * camera.aspect * .9).addScaledVector(up, off.y * D * halfH);
      }
      tmpS.setScalar(Math.max(r, 1e-5));
      tmpM.compose(pos, camera.quaternion, tmpS);
      small.setMatrixAt(i, tmpM);
    });
    small.instanceMatrix.needsUpdate = true;
    small.visible = (S.smallSky > .001 || S.smallAir > .001);
    for (const m of [mainMat, smallMat]) { m.uniforms.uRes.value.set(size.x, size.y); m.uniforms.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); }
    return { centre: main.position, radius: Rb };
  }
  return {
    scene, main, small, mainMat, smallMat, update,
    setScene(tex) { mainMat.uniforms.tScene.value = tex; smallMat.uniforms.tScene.value = tex; },
    setPortal(tex, amount, proj, bias = 0) {
      const u = mainMat.uniforms;
      u.tPortal.value = tex; u.uPortal.value = tex ? amount : 0; u.uPortalBias.value = bias;
      if (proj) u.uPortalProj.value.copy(proj);
      smallMat.uniforms.tPortal.value = tex || mainMat.uniforms.tScene.value;
    }
  };
}
