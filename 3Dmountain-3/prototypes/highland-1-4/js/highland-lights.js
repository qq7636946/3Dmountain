/* index1-4 · light lines (client, 2026-10-22: 到山谷時候我要有條光線保持第一人稱視角，最後拉升，這些線條往河流出去匯集;
   references: thin gold light trails racing low over a mountain valley's water, a cyan one over a night sea).
   · down in the glen and the canyon (first person) a few lines of light run with the camera, low over the water,
     entering at the bottom of the frame and streaming ahead into the valley, pulses flowing away from the eye
   · at the lift they leave the camera: light races out along every river — paths A, B, C, D — down to the
     confluence and the trunk, where the lines gather side by side into one band running into the island's bay
   · on the STRATEGIES panels each path brightens in turn (A 10.66, B 11.38, C 12.10, D 12.82); at the end all four
   Flat ribbons on the water (so they lie in perspective like the references), depth-tested (rock hides them),
   faded by the scene fog. Premultiplied "over", not additive: the highland's water is pale silver, and pure
   additive light on it only bleaches to white (QA 2026-10-22: the lines read as pale rails); an opaque warm halo
   keeps them gold on silver, and the HDR core sits far above the page bloom's threshold so only it glows. */
const PALETTES = {
  gold: { core: [1.0, .88, .62], halo: [1.0, .58, .14] },
  cyan: { core: [.85, .97, 1.0], halo: [.2, .7, 1.0] },
  // 客戶 2026-10-22：第一人稱光線要藍色的 不要橘色光 — a white-hot core in an ice-blue glow
  ice: { core: [.9, .97, 1.0], halo: [.22, .58, 1.0] },
  confluence: { core: [.84, .94, 1.0], halo: [.25, .52, .72] }
};
const VERT = /* glsl */`
  attribute vec3 aPrev, aNext; attribute float aSide, aS, aMerge;
  uniform float uMinW, uPxW;   // half-width: at least uMinW world units, else uPxW pixels
  varying float vSide, vS, vDepth, vMerge;
  void main() {
    vec3 t = aNext - aPrev; t.y = 0.; t = normalize(t + vec3(1e-5, 0., 0.));
    vec3 side = vec3(-t.z, 0., t.x);
    float d = distance(cameraPosition, position);
    vec3 p = position + side * aSide * max(uMinW, d * uPxW);   // never thinner than a pixel or so
    vSide = aSide; vS = aS; vDepth = d; vMerge = aMerge;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
  }`;
const FRAG = /* glsl */`
  uniform vec3 uCore, uHalo; uniform float uTime, uTail, uHead, uSoft, uBright, uSeed, uFlow, uPeriod, uFog, uMergedGain;
  varying float vSide, vS, vDepth, vMerge;
  void main() {
    float a = clamp(1. - abs(vSide), 0., 1.);   // pow() of a rounding-negative gives NaN, which the bloom spreads into black blocks
    float core = pow(a, 14.), glow = pow(a, 3.2), haze = a * a;
    float win = smoothstep(uTail, uTail + uSoft, vS) * (1. - smoothstep(uHead - uSoft, uHead, vS));
    float ph = fract(vS / uPeriod - uTime * uFlow + uSeed);
    float pulse = .55 + 2.1 * pow(ph, 16.) + .35 * pow(ph, 3.);                       // bright streaks racing along
    float head = smoothstep(uHead - uSoft * 2.5, uHead - uSoft * .6, vS);            // a brighter comet head
    float k = uBright * win * exp(-uFog * uFog * vDepth * vDepth * .8);
    k *= mix(1., uMergedGain, vMerge); // conserve light as four waterways become one
  #ifdef XRAY
    k *= .26; core *= .4;   // the stretch behind a ridge: a soft glow through the mist (not a wire draped over the peaks), so all four paths read as converging
  #endif
    float e = k * (pulse + head * 1.4);
    vec3 c = uCore * core * 3.2 * e + uHalo * (glow * .95 + haze * .2) * e;
    float alpha = clamp((glow * .6 + haze * .18) * k, 0., .65);
    gl_FragColor = vec4(c, alpha);                                                     // premultiplied: c + dst·(1 − alpha)
  }`;

export function createLightLines(THREE, { flight, flightLength, rivers, ground = () => -1e9, colour = 'gold' } = {}) {
  const confluence = colour === 'confluence';
  const pal = PALETTES[colour] || PALETTES.gold;
  const group = new THREE.Group(); group.name = 'highland-light-lines';
  const shared = { uCore: { value: new THREE.Vector3(...pal.core) }, uHalo: { value: new THREE.Vector3(...pal.halo) }, uTime: { value: 0 }, uFog: { value: .0004 } };

  function ribbon(points, opts) {
    const n = points.length, pos = new Float32Array(n * 6), prev = new Float32Array(n * 6), next = new Float32Array(n * 6),
      side = new Float32Array(n * 2), sArr = new Float32Array(n * 2), merge = new Float32Array(n * 2), idx = [];
    let s = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) s += points[i].distanceTo(points[i - 1]);
      const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k; pos.set([p.x, p.y, p.z], j * 3); prev.set([a.x, a.y, a.z], j * 3); next.set([b.x, b.y, b.z], j * 3);
        side[j] = k ? 1 : -1; sArr[j] = s;
        merge[j] = opts.merge ? THREE.MathUtils.smoothstep(p.z, -1250, -500) : 0;
      }
      if (i < n - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aPrev', new THREE.BufferAttribute(prev, 3));
    geo.setAttribute('aNext', new THREE.BufferAttribute(next, 3)); geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    geo.setAttribute('aS', new THREE.BufferAttribute(sArr, 1)); geo.setAttribute('aMerge', new THREE.BufferAttribute(merge, 1)); geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      uniforms: { ...shared, uTail: { value: 0 }, uHead: { value: 0 }, uSoft: { value: opts.soft }, uBright: { value: 0 }, uSeed: { value: opts.seed },
        uMergedGain: { value: opts.mergedGain ?? 1 }, uFlow: { value: opts.flow }, uPeriod: { value: opts.period }, uMinW: { value: opts.minW }, uPxW: { value: 0 } }
    });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; group.add(mesh);
    if (opts.xray) {   // same geometry and uniforms, drawn only where something stands in front of it
      const ghost = new THREE.Mesh(geo, mat.clone());
      Object.assign(ghost.material, { uniforms: mat.uniforms, defines: { XRAY: '' }, depthFunc: THREE.GreaterDepth });
      ghost.frustumCulled = false; ghost.renderOrder = 4; mesh.add(ghost);
    }
    return { mesh, mat, length: s, pxW: opts.pxW };
  }

  // ---- first person: five lines on lanes across the water, weaving gently, following the flight ----
  const trails = [];
  const N = Math.ceil(flightLength / 3), lanes = [-9, -3.8, .6, 4.4, 9.6];
  lanes.forEach((lane, k) => {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, s = u * flightLength, p = flight.getPointAt(u), t = flight.getTangentAt(u);
      const nx = -t.z, nz = t.x, l = Math.hypot(nx, nz) || 1;
      const off = lane * (.75 + .3 * Math.sin(s * .0042 + 1.1)) + 3.6 * Math.sin(s * .0067 + k * 1.7) + 1.6 * Math.sin(s * .021 + k * 2.3);
      const x = p.x + nx / l * off, z = p.z + nz / l * off;
      pts.push(new THREE.Vector3(x, confluence ? 1.5 + .2 * k : Math.max(1.4 + .35 * k + .5 * Math.sin(s * .017 + k), ground(x, z) + 1.6), z));
    }
    trails.push({ ...ribbon(pts, { seed: k * .37, flow: confluence ? 1.0 : 1.25, period: 110 + 25 * k, soft: confluence ? 42 : 30, minW: confluence ? .2 : .26, pxW: k === 2 ? (confluence ? 3.8 : 5) : (confluence ? 2.8 : 3.6) }), k });
  });

  // ---- the four paths, each flowing downstream to the confluence, then along the trunk into the bay ----
  const smoothLine = (xz, y = 1.5) => new THREE.CatmullRomCurve3(xz.map(([x, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal').getSpacedPoints(Math.max(8, Math.round(lineLength(xz) / 6)));
  const lineLength = xz => xz.reduce((a, p, i) => i ? a + Math.hypot(p[0] - xz[i - 1][0], p[1] - xz[i - 1][1]) : 0, 0);
  const trunkDown = rivers.TRUNK.slice().reverse().concat(confluence
    ? [[-30, -500], [-20, -280], [0, 0], [30, 300], [70, 600]]
    : [[-30, -500], [-10, -455]]);   // confluence → bay → the island's shore
  const paths = [
    { key: 'A', xz: rivers.A.slice().reverse(), lane: -7.5, q: 10.66 },
    { key: 'B', xz: rivers.B.slice().reverse(), lane: -2.5, q: 11.38 },
    { key: 'C', xz: rivers.C.slice().reverse(), lane: 2.5, q: 12.10 },
    { key: 'D', xz: rivers.D.slice().reverse(), lane: 7.5, q: 12.82, joinZ: -1320 }
  ];
  const flows = [];
  for (const P of paths) {
    const trunk = P.joinZ ? trunkDown.filter(p => p[1] > P.joinZ) : trunkDown;
    const raw = smoothLine(P.xz.concat(trunk));
    // side by side on the shared trunk: each path keeps its own lane once it has joined
    const joinS = lineLength(P.xz);
    let s = 0;
    const pts = raw.map((p, i) => {
      if (i) s += p.distanceTo(raw[i - 1]);
      const a = raw[Math.max(0, i - 1)], b = raw[Math.min(raw.length - 1, i + 1)], tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
      const off = P.lane * THREE.MathUtils.smoothstep(s, joinS - 80, joinS + 60)
        * (confluence ? 1 - THREE.MathUtils.smoothstep(p.z, -1250, -500) : 1);
      const x = p.x - tz / l * off, z = p.z + tx / l * off;
      return new THREE.Vector3(x, confluence ? p.y : Math.max(p.y, ground(x, z) + 1.6), z);
    });
    flows.push({ ...ribbon(pts, { seed: flows.length * .23, flow: confluence ? .46 : .55, period: 160, soft: 60, minW: confluence ? .85 : 1.1, pxW: confluence ? 3.8 : 4.5, xray: !confluence, merge: confluence, mergedGain: confluence ? .25 : 1 }), q: P.q, stagger: flows.length * .12 });
    // a fainter companion strand
    const twin = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1; const off = 1.6 * (confluence ? 1 - THREE.MathUtils.smoothstep(p.z, -1250, -500) : 1); const x = p.x - tz / l * off, z = p.z + tx / l * off; return new THREE.Vector3(x, confluence ? 1.5 : Math.max(1.5, ground(x, z) + 1.6), z); });
    flows.push({ ...ribbon(twin, { seed: flows.length * .23 + .5, flow: confluence ? .5 : .62, period: 130, soft: 60, minW: confluence ? .45 : .6, pxW: confluence ? 1.8 : 2.4, merge: confluence, mergedGain: confluence ? 0 : 1 }), q: P.q, stagger: (flows.length - 1) * .12, twin: true });
  }

  const sm = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  return {
    group,
    update(q, time, camera, flightS, fogDensity, viewportH) {
      shared.uTime.value = time; shared.uFog.value = fogDensity;
      const pxPerUnit = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * .5)) / Math.max(1, viewportH);
      // first person: in from the glen, out at the lift
      const fp = sm(2.7, 3.5, q) * (1 - sm(6.95, 7.65, q));
      for (const T of trails) {
        const u = T.mat.uniforms;
        u.uBright.value = fp * [.75, 1, 1.2, .9, .7][T.k] * (confluence ? .85 : 1);
        u.uTail.value = flightS - 30 - T.k * 4;
        u.uHead.value = flightS + 360 + 150 * Math.sin(time * .55 + T.k * 1.3) + 40 * T.k;
        u.uPxW.value = pxPerUnit * T.pxW;
        T.mesh.visible = fp > .001;
      }
      // the rivers: revealed from their far ends down to the bay while the camera rises, then held
      let focus = 0; for (const F of flows) focus = Math.max(focus, Math.exp(-Math.pow((q - F.q) / .38, 2)));
      for (const F of flows) {
        const u = F.mat.uniforms;
        const reveal = confluence ? sm(6.8 + F.stagger * .15, 8.65 + F.stagger * .15, q)
          : sm(6.9 + F.stagger * .5, 9.2 + F.stagger * .5, q);
        const mine = Math.exp(-Math.pow((q - F.q) / .38, 2));
        const end = confluence ? sm(8.25, 8.96, q) : sm(13.2, 13.8, q);
        u.uTail.value = -60; u.uHead.value = reveal * (F.length + 120);
        u.uBright.value = reveal * (confluence ? (F.twin ? .4 : 1.25) : (F.twin ? .6 : 1.6))
          * (confluence ? .85 + .25 * end : .85 + 1.1 * mine - .4 * (focus - mine) + .4 * end);
        u.uPxW.value = pxPerUnit * F.pxW;
        F.mesh.visible = reveal > .001;
      }
    }
  };
}
