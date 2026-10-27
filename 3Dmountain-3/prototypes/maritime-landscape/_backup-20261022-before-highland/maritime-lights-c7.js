/* index1-3-maritime · first-person light lines (客戶 2026-10-22：index1-3-maritime 加入跟 index1-4 一樣的第一人稱藍色光線).
   Ported from prototypes/highland-1-4/js/highland-lights.js (the same shader and look: a white-hot core in an
   ice-blue glow, bright streaks racing away from the eye, a brighter comet head), cut down to the trails:
   five lines lie on the river under the camera, weaving across the water, entering at the bottom of the frame and
   streaming ahead into the canyon; they fade out as the camera rises.
   This camera flies 2.4 units over the water (index1-4's flies 17–24), so the lines sit just over the wave crests
   and their minimum width is far smaller. Premultiplied "over" with an HDR core: the core is what the bloom catches. */
const PALETTES = {
  ice: { core: [.9, .97, 1.0], halo: [.22, .58, 1.0] },
  gold: { core: [1.0, .88, .62], halo: [1.0, .58, .14] }
};
const VERT = /* glsl */`
  attribute vec3 aPrev, aNext; attribute float aSide, aS;
  uniform float uMinW, uPxW;   // half-width: at least uMinW world units, else uPxW pixels
  varying float vSide, vS, vDepth;
  void main() {
    vec3 t = aNext - aPrev; t.y = 0.; t = normalize(t + vec3(1e-5, 0., 0.));
    vec3 side = vec3(-t.z, 0., t.x);
    float d = distance(cameraPosition, position);
    vec3 p = position + side * aSide * max(uMinW, d * uPxW);
    vSide = aSide; vS = aS; vDepth = d;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
  }`;
const FRAG = /* glsl */`
  uniform vec3 uCore, uHalo; uniform float uTime, uTail, uHead, uSoft, uBright, uSeed, uFlow, uPeriod, uFog;
  varying float vSide, vS, vDepth;
  void main() {
    float a = clamp(1. - abs(vSide), 0., 1.);   // clamp first: pow() of a rounding-negative is NaN, and the bloom spreads NaN into black blocks
    float core = pow(a, 14.), glow = pow(a, 3.2), haze = a * a;
    float win = smoothstep(uTail, uTail + uSoft, vS) * (1. - smoothstep(uHead - uSoft, uHead, vS));
    float ph = fract(vS / uPeriod - uTime * uFlow + uSeed);
    float pulse = .55 + 2.1 * pow(ph, 16.) + .35 * pow(ph, 3.);
    float head = smoothstep(uHead - uSoft * 2.5, uHead - uSoft * .6, vS);
    float k = uBright * win * exp(-uFog * uFog * vDepth * vDepth * .8);
    float e = k * (pulse + head * 1.4);
    vec3 c = uCore * core * 4.6 * e + uHalo * (glow * 1.25 + haze * .35) * e;   // hotter core than index1-4's: this page's bloom is gentler
    float alpha = clamp((glow * .6 + haze * .18) * k, 0., .65);
    gl_FragColor = vec4(c, alpha);   // premultiplied: c + dst·(1 − alpha)
  }`;

/* flight: the canyon's CatmullRom curve (the camera rides it, y = 0 is the water); span: how much of it (0–1) the
   lines cover; window: [fade in from, to, fade out from, to] on the journey clock */
export function createLightLines(THREE, { flight, flightLength, span = .8, colour = 'ice', window = [1.75, 2.5, 6.3, 6.95] } = {}) {
  const pal = PALETTES[colour] || PALETTES.ice;
  const group = new THREE.Group(); group.name = 'maritime-light-lines';
  const shared = { uCore: { value: new THREE.Vector3(...pal.core) }, uHalo: { value: new THREE.Vector3(...pal.halo) }, uTime: { value: 0 }, uFog: { value: .0017 } };
  const trails = [];
  const L = flightLength * span, N = Math.ceil(L / 1.5), lanes = [-7, -3, .5, 3.6, 7.5];
  lanes.forEach((lane, k) => {
    const n = N + 1, pos = new Float32Array(n * 6), prev = new Float32Array(n * 6), next = new Float32Array(n * 6),
      side = new Float32Array(n * 2), sArr = new Float32Array(n * 2), idx = [], pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N * span, s = u * flightLength, p = flight.getPointAt(u), t = flight.getTangentAt(u);
      const nx = -t.z, nz = t.x, l = Math.hypot(nx, nz) || 1;
      const off = lane * (.75 + .3 * Math.sin(s * .006 + 1.1)) + 2.6 * Math.sin(s * .011 + k * 1.7) + 1.2 * Math.sin(s * .031 + k * 2.3);
      pts.push(new THREE.Vector3(p.x + nx / l * off, 1.15 + .07 * k + .12 * Math.sin(s * .023 + k), p.z + nz / l * off));   // just over the crests
    }
    let s = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) s += pts[i].distanceTo(pts[i - 1]);
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      for (let m = 0; m < 2; m++) {
        const j = i * 2 + m; pos.set([p.x, p.y, p.z], j * 3); prev.set([a.x, a.y, a.z], j * 3); next.set([b.x, b.y, b.z], j * 3);
        side[j] = m ? 1 : -1; sArr[j] = s;
      }
      if (i < n - 1) { const m = i * 2; idx.push(m, m + 2, m + 1, m + 1, m + 2, m + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aPrev', new THREE.BufferAttribute(prev, 3));
    geo.setAttribute('aNext', new THREE.BufferAttribute(next, 3)); geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    geo.setAttribute('aS', new THREE.BufferAttribute(sArr, 1)); geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      uniforms: { ...shared, uTail: { value: 0 }, uHead: { value: 0 }, uSoft: { value: 18 }, uBright: { value: 0 }, uSeed: { value: k * .37 },
        uFlow: { value: 1.25 }, uPeriod: { value: 70 + 16 * k }, uMinW: { value: .08 }, uPxW: { value: 0 } }
    });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; group.add(mesh);
    trails.push({ mesh, mat, k, pxW: k === 2 ? 11 : 8.5 });   // wide enough for the halo to read as glow at this low height
  });
  const sm = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  return {
    group,
    /* q: the journey clock; flightS: the camera's arc length along the curve */
    update(q, time, camera, flightS, fogDensity, viewportH) {
      shared.uTime.value = time; shared.uFog.value = fogDensity;
      const pxPerUnit = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * .5)) / Math.max(1, viewportH);
      const fp = sm(window[0], window[1], q) * (1 - sm(window[2], window[3], q));
      for (const T of trails) {
        const u = T.mat.uniforms;
        u.uBright.value = fp * [1.1, 1.4, 1.7, 1.3, 1.05][T.k];
        u.uTail.value = flightS - 6 - T.k * 2;
        u.uHead.value = flightS + 240 + 90 * Math.sin(time * .55 + T.k * 1.3) + 25 * T.k;
        u.uPxW.value = pxPerUnit * T.pxW;
        T.mesh.visible = fp > .001;
      }
    }
  };
}
