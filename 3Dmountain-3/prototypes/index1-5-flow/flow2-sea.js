/* Flow2 beads and the sea (2026-11-10): the string of beads and the waves answer each other. index1-5-flow2.html only.
   Client: 「這些水滴跟浪的互動太差」. The opening's flow is unchanged; this only adds what happens where bead and water meet.

   What was wrong: the string's path dips under the sea. The drops module hides a bead by fading it as it nears the sea's level
   (y = 0), but the opening draws its sea lower on the screen than it lies (CONFIG.sea.screenDown, a shear in view space: at
   17 units away the drawn surface is 0.6 lower). So a bead turned into a pale ghost while still above the water it is seen
   against, and the water never noticed it.

   Now:
   1. Waterline. The drops module is told a sea level below the drawn surface, so a bead stays solid all the way down and the
      drawn waves themselves cut it (the depth buffer does it, exactly along the wave), instead of fading in mid-air.
   2. Rings. A bead breaking the surface, up or down, rings the sea there (the page's own ripple field: the water really
      dents); while it rides half in the water it keeps sending small ones.
   3. Reflection. The opening sea's shader gets the beads as spheres: each is mirrored in the water under it, bent by the
      waves like everything else the sea mirrors, and gone a few units above the water.
   The sea's shear is undone for each bead before any of this is worked out, so rings and reflections land under the bead
   as it is drawn.

   main.js calls install() when it has made the opening sea's material (before it is compiled), seaLevel() for the drops,
   and frame() after the drops are placed. ?sea=0 leaves all of it out. */
(() => {
  if (new URLSearchParams(location.search).get('sea') === '0') return;
  const T = {
    cross: .5,        // the ring a bead makes breaking the surface (× its size)
    wake: .14,        // the small rings while it rides in the water
    wakeEvery: .5,    // seconds between them
    mirror: .6,       // how much of the water's own reflection a bead's image replaces
    reach: 2.6,       // a bead this far above the water (world units) no longer shows in it: only images that touch their bead
                      // read as reflections; one seen far below its bead reads as a stray shape
    under: 1.45       // how far below the drawn surface the drops module's own fade is moved (world units). Its fade runs over
                      // about one unit (-.08…+.20 of the mark's own units, × 3.6), and a bead is up to .7 across the middle, so
                      // anything less still thins a bead whose top is above the water.
  };
  const MAX = 12;
  let U = null, S = null;
  const PARS = `uniform vec4 uF2Bead[${MAX}];\nuniform float uF2BeadA[${MAX}];\nuniform float uF2Mirror,uF2Reach;\n`;
  const ANCHOR = 'col*=1.-uDropOcclude*exp(-r2)*(.30+.70*smoothstep(.34,-.26,vWorld.y));';
  const GLSL = `
      /* flow2: the string's beads mirrored in the sea (flow2-sea.js). Spheres, met by the reflected ray; each shows the room it
         stands in, as the sea does. */
      if(uF2Mirror>.001){
        vec3 f2R=reflect(-V,nrm);
        for(int i=0;i<${MAX};i++){
          vec4 f2B=uF2Bead[i];
          if(f2B.w<=0.)continue;
          vec3 f2o=vWorld-f2B.xyz;
          float f2b=dot(f2o,f2R),f2h=f2b*f2b-dot(f2o,f2o)+f2B.w*f2B.w;
          if(f2h>0.&&f2b<0.){
            float f2s=sqrt(f2h),f2t=-f2b-f2s;
            vec3 f2n=(f2o+f2R*f2t)/f2B.w;
            vec3 f2c=montisEnv(reflect(f2R,f2n),.10,uBandGain,0.);
            float f2a=smoothstep(0.,.75,f2s/f2B.w)*(1.-smoothstep(uF2Reach*.15,uF2Reach,f2t))*uF2BeadA[i];
            col=mix(col,f2c,f2a*uF2Mirror);
          }
        }
      }
`;
  function install({ THREE, material }) {
    if (!material?.isShaderMaterial || material.fragmentShader.split(ANCHOR).length !== 2 || !material.fragmentShader.includes('vec3 montisEnv(')) {
      console.warn('flow2 sea: the opening sea shader has changed; the beads are not mirrored'); return;
    }
    U = {
      uF2Bead: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
      uF2BeadA: { value: new Array(MAX).fill(0) }, uF2Mirror: { value: 0 }, uF2Reach: { value: T.reach }
    };
    Object.assign(material.uniforms, U);
    material.fragmentShader = PARS + material.fragmentShader.replace(ANCHOR, ANCHOR + GLSL);
    material.needsUpdate = true;
  }
  /* How far below its true level the sea is drawn, at DEPTH in front of the lens. */
  const lowered = (shift, camera, depth) => shift * Math.tan(camera.fov * Math.PI / 360) * depth;
  /* The mark (and its beads with it) is moved on the screen by CONFIG.logoFraming after it has been placed, in px: how far
     down that is in the world, at the mark's own depth. The drops module does not know of it either. */
  function framed(root, camera, framing, THREE) {
    const depth = Math.max(.1, -(S.v.copy(root.position).applyMatrix4(camera.matrixWorldInverse).z));
    return (framing?.y || 0) * 2 * depth * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, innerHeight);
  }
  const state = THREE => S ??= { v: new THREE.Vector3(), s: new THREE.Vector3(), side: new Int8Array(96), seen: new Uint8Array(96), wake: new Float32Array(96), time: null, list: [] };
  /* The sea level the drops module fades its beads at: under the drawn surface at the far side of the string. */
  function seaLevel({ THREE, seaY, camera, shift, root, framing, far = 22 }) {
    state(THREE);
    return seaY - Math.max(0, lowered(shift, camera, far) - framed(root, camera, framing, THREE)) - T.under;
  }

  function frame({ THREE, logoDrops, camera, seaY, shift, root, framing, time, spawnRipple, queueRipple, reduceMotion, on }) {
    state(THREE);
    const dt = S.time === null ? 0 : Math.min(.05, Math.max(0, time - S.time)); S.time = time;
    const list = S.list; list.length = 0;
    const meshes = on ? logoDrops?.meshes : null, down = meshes ? framed(root, camera, framing, THREE) : 0;
    if (meshes) for (let i = 0; i < meshes.length && i < 96; i++) {
      const mesh = meshes[i];
      if (!mesh.visible) { S.seen[i] = 0; continue; }
      const opacity = mesh.material?.uniforms?.uOpacity?.value ?? 1;
      mesh.getWorldPosition(S.v); mesh.getWorldScale(S.s);
      S.v.y -= down;
      const r = S.s.x, depth = Math.max(.1, -S.s.copy(S.v).applyMatrix4(camera.matrixWorldInverse).z);
      /* the bead in the frame where the sea lies at its true level (the shear undone) */
      const y = S.v.y + lowered(shift, camera, depth) - seaY;
      if (opacity > .3 && !reduceMotion) {
        const side = y > 0 ? 1 : -1;
        if (S.seen[i] && side !== S.side[i] && dt > 0) { spawnRipple?.(S.v.x, S.v.z, T.cross * (.6 + r)); queueRipple?.(S.v.x, S.v.z, T.cross * .4 * (.6 + r), .18); S.wake[i] = 0; }
        else if (Math.abs(y) < r * .9) { S.wake[i] += dt; if (S.wake[i] > T.wakeEvery) { S.wake[i] = 0; spawnRipple?.(S.v.x, S.v.z, T.wake * (.6 + r)); } }
        S.side[i] = side; S.seen[i] = 1;
      } else S.seen[i] = 0;
      /* for the mirror: only what stands in or a little above the water shows in it */
      if (opacity > .05 && y > -r && y < T.reach) list.push({ x: S.v.x, y, z: S.v.z, r, a: opacity, d: depth });
    }
    if (!U) return;
    list.sort((p, q) => p.y - q.y);
    for (let i = 0; i < MAX; i++) {
      const b = list[i];
      if (b) { U.uF2Bead.value[i].set(b.x, b.y + seaY, b.z, b.r); U.uF2BeadA.value[i] = b.a; }
      else { U.uF2Bead.value[i].set(0, 0, 0, 0); U.uF2BeadA.value[i] = 0; }
    }
    U.uF2Mirror.value = list.length ? T.mirror : 0; U.uF2Reach.value = T.reach;
  }
  window.__FLOW2_SEA__ = { install, seaLevel, frame, tune: T };
})();
