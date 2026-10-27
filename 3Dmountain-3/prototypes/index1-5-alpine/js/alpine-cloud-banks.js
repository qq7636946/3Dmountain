/* index1-5-alpine: clouds that sit IN the valleys and wrap the mid-slopes (everest.suraj.work look).
   One instanced draw of soft, sun-lit cloud puffs, no depth texture, no ray march:
   - Placed once on the CPU from the real terrain: clustered by a low-frequency cloudiness field, pooled in
     the glens (below the local mean ground), climbing some way up the slopes, and kept off the five rivers
     and the canyon the camera flies down. Far away they grow larger and sparser.
   - Each puff is a camera-facing sphere impostor with a noise-eroded rim: a per-pixel sphere normal makes
     the sun side warm and bright, the far side blue-grey, and thin edges toward the sun glow (silver lining).
     Puffs are sorted back to front (only when the camera has moved) so overlaps blend correctly.
   One tileable billow texture (CPU-baked once, mipmapped) feeds the puffs and the sky dome's cumulus and
   cloud sea. Every look value is read live from ALPINE_LIGHT (amount, height, softness, drift, colours).
   Reduced motion freezes the drift. */
import { ALPINE_LIGHT } from './alpine-light-params.js';

/* Tileable billow field: R = density (fbm + inverted Worley puffs), G/B = d/du, d/dv (scaled), A = fine fbm. */
let sharedNoise = null, sharedUsers = 0;
export function getAlpineCloudNoise(THREE) {
  if (sharedNoise) { sharedUsers++; return sharedNoise; }
  const N = 256, h = new Float32Array(N * N), fine = new Float32Array(N * N);
  const hash = (x, y, s) => {
    let k = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    k = Math.imul(k ^ (k >>> 13), 1274126177); k ^= k >>> 16; return (k >>> 0) / 4294967296;
  };
  const wrap = (i, p) => ((i % p) + p) % p;
  const fade = t => t * t * (3 - 2 * t);
  const vnoise = (x, y, p, s) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = fade(x - ix), fy = fade(y - iy);
    const x0 = wrap(ix, p), x1 = wrap(ix + 1, p), y0 = wrap(iy, p), y1 = wrap(iy + 1, p);
    const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const worley = (x, y, p, s) => {
    const ix = Math.floor(x), iy = Math.floor(y); let best = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j, wx = wrap(cx, p), wy = wrap(cy, p);
      const dx = cx + hash(wx, wy, s) - x, dy = cy + hash(wx, wy, s + 7) - y;
      best = Math.min(best, dx * dx + dy * dy);
    }
    return Math.sqrt(best);
  };
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    let f = 0, a = .5, tot = 0;
    for (let o = 0, p = 4; o < 5; o++, p *= 2) { f += a * vnoise(u * p, v * p, p, 11 + o); tot += a; a *= .5; }
    f /= tot;
    const puff = 1 - Math.min(1, worley(u * 6, v * 6, 6, 3) * 1.15), puff2 = 1 - Math.min(1, worley(u * 14, v * 14, 14, 5) * 1.2);
    const value = f * .52 + puff * .33 + puff2 * .15;
    h[y * N + x] = value; lo = Math.min(lo, value); hi = Math.max(hi, value);
    let g = 0; a = .5; tot = 0;
    for (let o = 0, p = 32; o < 3; o++, p *= 2) { g += a * vnoise(u * p, v * p, p, 41 + o); tot += a; a *= .5; }
    fine[y * N + x] = g / tot;
  }
  const data = new Uint8Array(N * N * 4), at = (x, y) => h[wrap(y, N) * N + wrap(x, N)];
  const span = Math.max(1e-6, hi - lo);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    const gx = (at(x + 1, y) - at(x - 1, y)) * .5 * N / span, gy = (at(x, y + 1) - at(x, y - 1)) * .5 * N / span;
    data[i] = Math.round((h[y * N + x] - lo) / span * 255);
    data[i + 1] = Math.round(THREE.MathUtils.clamp(.5 + gx / 80, 0, 1) * 255);
    data[i + 2] = Math.round(THREE.MathUtils.clamp(.5 + gy / 80, 0, 1) * 255);
    data[i + 3] = Math.round(fine[y * N + x] * 255);
  }
  const texture = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
  texture.name = 'alpine-billow-noise';
  sharedNoise = texture; sharedUsers = 1;
  return texture;
}
function releaseAlpineCloudNoise() { if (sharedNoise && --sharedUsers <= 0) { sharedNoise.dispose(); sharedNoise = null; } }

export function createAlpineCloudBanks(THREE, { lite = false, sampleHeight = null, terrainAt = null, riverDistance = null, bounds = null } = {}) {
  const group = new THREE.Group(); group.name = 'index1-5-alpine-cloud-banks';
  const noise = getAlpineCloudNoise(THREE);
  const S = THREE.MathUtils.smoothstep, lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;

  /* ---------- placement (once) ---------- */
  const minX = bounds?.min?.x ?? -9000, maxX = bounds?.max?.x ?? 8940, minZ = bounds?.min?.z ?? -12000, maxZ = bounds?.max?.z ?? 4800;
  const probe = [0, 0, 0, 0];
  const groundAt = (x, z) => {
    let g = NaN;
    if (terrainAt) { try { terrainAt(x, z, probe); g = probe[0]; } catch { g = NaN; } }
    if (!Number.isFinite(g) && sampleHeight) g = sampleHeight(x, z);
    return Number.isFinite(g) ? Math.max(0, g) : 120;
  };
  let seed = 160723;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(h2(ix, iy), h2(ix + 1, iy), ux), lerp(h2(ix, iy + 1), h2(ix + 1, iy + 1), ux), uy); };
  const cloudiness = (x, z) => vn(x / 2600 + 3.1, z / 2600 + 7.7) * .62 + vn(x / 1100 + 1.3, z / 1100 + .4) * .38;
  // Coarse blurred ground: a glen is ground below its neighbourhood mean.
  const CG = 320, gx = Math.ceil((maxX - minX) / CG) + 1, gz = Math.ceil((maxZ - minZ) / CG) + 1;
  let coarse = new Float32Array(gx * gz);
  for (let j = 0; j < gz; j++) for (let i = 0; i < gx; i++) coarse[j * gx + i] = groundAt(minX + i * CG, minZ + j * CG);
  for (let pass = 0; pass < 3; pass++) {
    const next = new Float32Array(gx * gz);
    for (let j = 0; j < gz; j++) for (let i = 0; i < gx; i++) {
      let s = 0, n = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < gx && jj < gz) { s += coarse[jj * gx + ii]; n++; } }
      next[j * gx + i] = s / n;
    }
    coarse = next;
  }
  const meanAt = (x, z) => {
    const fx = clamp((x - minX) / CG, 0, gx - 1.001), fz = clamp((z - minZ) / CG, 0, gz - 1.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    return lerp(lerp(coarse[j * gx + i], coarse[j * gx + i + 1], u), lerp(coarse[(j + 1) * gx + i], coarse[(j + 1) * gx + i + 1], u), v);
  };
  const STEP = lite ? 290 : 190, MAX = lite ? 320 : 900;
  const puffs = [];
  for (let z = Math.min(maxZ, 2400); z > minZ + 300; z -= STEP) for (let x = minX + 300; x < maxX - 300; x += STEP) {
    const px = x + (rnd() - .5) * STEP, pz = z + (rnd() - .5) * STEP;
    const far = S(-pz, 3000, 10500);
    if (rnd() > lerp(1, .38, far)) continue;               // fewer, larger puffs far away
    const C = cloudiness(px, pz);
    if (C < .42) continue;
    const corridor = Math.min(1, S(Math.abs(px - 40), 420, 1100) + S(-pz, 2300, 3300));
    if (corridor < .05) continue;
    const rd = riverDistance ? riverDistance(px, pz) : 1e9;
    const clear = S(Number.isFinite(rd) ? rd : 1e9, 240, 620) * corridor;
    if (clear < .05) continue;
    const g = groundAt(px, pz), mean = meanAt(px, pz), valley = clamp((mean - g) / 200, -1.5, 1);
    // Pools in the glens; some climb the slopes; ridge tops stay mostly clear.
    const score = (C - .42) * 2.6 + valley * .55 + .08;
    const p = clear * S(score, .05, .55);
    if (rnd() > p) continue;
    const radius = lerp(175, 640, far) * (.75 + rnd() * .6);
    const y = g + radius * (.06 + rnd() * .3) + Math.max(0, valley) * 40;
    puffs.push({ x: px, y, z: pz, r: radius, rank: rnd() * .55 + (1 - p) * .45, flat: 1.45 + far * .8 + rnd() * .5,
      tone: clamp(.35 + (y - Math.min(g, mean)) / (radius * 2.6) + rnd() * .2, 0, 1), seed: rnd() * 100 });
  }
  // Keep the strongest within budget.
  puffs.sort((a, b) => a.rank - b.rank);
  if (puffs.length > MAX) puffs.length = MAX;
  const COUNT = puffs.length;

  /* ---------- draw ---------- */
  const base = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index.clone();
  for (const [name, attribute] of Object.entries(base.attributes)) geometry.setAttribute(name, attribute.clone());
  base.dispose(); geometry.instanceCount = COUNT;
  const aPuff = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 4), 4), aInfo = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 4), 4);
  aPuff.setUsage(THREE.DynamicDrawUsage); aInfo.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aPuff', aPuff); geometry.setAttribute('aInfo', aInfo);
  const writeOrder = order => {
    for (let k = 0; k < COUNT; k++) {
      const q = puffs[order[k]], a = aPuff.array, b = aInfo.array, i = k * 4;
      a[i] = q.x; a[i + 1] = q.y; a[i + 2] = q.z; a[i + 3] = q.r;
      b[i] = q.seed; b[i + 1] = q.rank; b[i + 2] = q.flat; b[i + 3] = q.tone;
    }
    aPuff.needsUpdate = true; aInfo.needsUpdate = true;
  };
  const order = Array.from({ length: COUNT }, (_, i) => i), depth = new Float32Array(COUNT);
  writeOrder(order);

  const sunDir = new THREE.Vector3(-.5, .2, -.8).normalize();
  const uniforms = {
    uNoise: { value: noise }, uTime: { value: 0 }, uSunDir: { value: sunDir }, uSunCol: { value: new THREE.Color('#ffdcb8') },
    uLit: { value: new THREE.Color(ALPINE_LIGHT.cloudLit) }, uShade: { value: new THREE.Color(ALPINE_LIGHT.cloudShade) },
    uHaze: { value: new THREE.Color('#a7b6c3') }, uFog: { value: .0001 }, uBright: { value: 1 }, uSoft: { value: .55 }, uAmount: { value: 1 },
    uAlpha: { value: 0 }, uLift: { value: 0 }, uRankScale: { value: lite ? .75 : .5 }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uBack: { value: new THREE.Vector3(0, 0, 1) }
  };
  const material = new THREE.ShaderMaterial({
    name: 'Alpine valley cloud puffs', uniforms, transparent: true, depthWrite: false, depthTest: true,
    vertexShader: `attribute vec4 aPuff,aInfo;
      uniform vec3 uRight,uUp;uniform float uTime,uAmount,uLift,uAlpha,uRankScale;
      varying vec2 vUv;varying float vSeed,vDepth,vA,vTone;varying vec3 vWorld;
      void main(){
        vUv=uv;vSeed=aInfo.x;vTone=aInfo.w;
        float on=1.-smoothstep(uAmount*uRankScale-.04,uAmount*uRankScale+.04,aInfo.y);
        vec3 c=aPuff.xyz;c.y+=uLift;
        c.x+=sin(uTime*.021+aInfo.x)*24.+uTime*1.6;c.z+=cos(uTime*.017+aInfo.x*1.3)*16.;
        float r=aPuff.w;
        vec3 w=c+uRight*(position.x*r*2.*aInfo.z)+uUp*(position.y*r*2.);
        vWorld=w;
        vec4 view=viewMatrix*vec4(w,1.);vDepth=-view.z;
        vA=on*uAlpha*smoothstep(r*.6,r*2.2,vDepth);
        gl_Position=projectionMatrix*view;
        if(vA<.002)gl_Position=vec4(2.,2.,2.,1.);
      }`,
    fragmentShader: `uniform sampler2D uNoise;uniform float uTime,uFog,uBright,uSoft;
      uniform vec3 uHaze,uSunDir,uSunCol,uLit,uShade,uRight,uUp,uBack;
      varying vec2 vUv;varying float vSeed,vDepth,vA,vTone;varying vec3 vWorld;
      void main(){
        vec2 p=vUv*2.-1.;
        vec2 o=vec2(fract(vSeed*.137),fract(vSeed*.291))+vec2(uTime*.0012,0.);
        vec4 n=texture2D(uNoise,vUv*vec2(.8,.62)+o);
        vec4 m=texture2D(uNoise,vUv*2.1+o*1.7+.5);
        float r2=dot(p,p);
        float erode=(n.r-.5)*1.0+(m.r-.5)*.45;
        // Erosion scales with the remaining body, so density always reaches zero inside the quad (no cut edges).
        float body=max(1.-r2,0.);
        float d=body+erode*1.35*sqrt(body);
        // A level, darker underside; billows on top.
        d-=smoothstep(-.3,-.95,p.y+erode*.3)*.32;
        float soft=.16+.5*uSoft;
        float a=smoothstep(0.,soft,d)*vA;
        if(a<.004)discard;
        // Sphere-impostor normal, roughened by the billow gradient.
        vec2 bump=(n.gb-.5)*1.1+(m.gb-.5)*.6;
        vec3 nv=normalize(vec3(p.x*.9+bump.x*.45,p.y*.9+bump.y*.45+.15,sqrt(max(1.-r2,0.))*.85+.25));
        vec3 N=normalize(uRight*nv.x+uUp*nv.y+uBack*nv.z);
        vec3 V=normalize(vWorld-cameraPosition);
        float ndl=dot(N,uSunDir);
        float l=clamp(ndl*.62+.42,0.,1.)*mix(.7,1.08,vTone)*mix(.82,1.,clamp(p.y*.5+.6,0.,1.));
        vec3 col=mix(uShade,uLit,smoothstep(.05,.95,l));
        float thin=1.-smoothstep(0.,soft*2.2,d);
        col+=uSunCol*pow(max(dot(V,uSunDir),0.),5.)*thin*.7;
        col+=uSunCol*.05*max(ndl,0.);
        col*=.94+.12*m.a;
        float fogAmt=1.-exp(-uFog*uFog*vDepth*vDepth);
        col=mix(col,uHaze,clamp(fogAmt*.85,0.,.9));
        gl_FragColor=vec4(col*uBright,a*.72);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Valley cloud puffs'; mesh.frustumCulled = false; mesh.renderOrder = 23; group.add(mesh);
  const camPos = new THREE.Vector3(), camDir = new THREE.Vector3(), lastPos = new THREE.Vector3(1e9, 0, 0), lastDir = new THREE.Vector3();
  mesh.onBeforeRender = (_, scene, camera) => {
    uniforms.uRight.value.setFromMatrixColumn(camera.matrixWorld, 0); uniforms.uUp.value.setFromMatrixColumn(camera.matrixWorld, 1);
    uniforms.uBack.value.setFromMatrixColumn(camera.matrixWorld, 2);
    if (scene.fog) { uniforms.uHaze.value.copy(scene.fog.color); uniforms.uFog.value = scene.fog.density; }
    // Back-to-front, re-sorted only after the camera has really moved.
    camPos.setFromMatrixPosition(camera.matrixWorld); camDir.copy(uniforms.uBack.value).negate();
    if (uniforms.uAlpha.value > .002 && (camPos.distanceToSquared(lastPos) > 400 || camDir.dot(lastDir) < .9995)) {
      lastPos.copy(camPos); lastDir.copy(camDir);
      for (let i = 0; i < COUNT; i++) { const q = puffs[i]; depth[i] = (q.x - camPos.x) * camDir.x + (q.y - camPos.y) * camDir.y + (q.z - camPos.z) * camDir.z; }
      order.sort((a, b) => depth[b] - depth[a]);
      writeOrder(order);
    }
  };

  let disposed = false, clock = 0, lastTime = null;
  return {
    group, uniforms, noise, sunDirection: sunDir,
    stats: { puffs: COUNT, drawCalls: 1, externalAssets: 0 },
    /* reveal: the aerial rise 0..1; time: seconds; camera: the canyon camera. */
    update(reveal = 0, time = 0, reduced = false, camera = null) {
      if (disposed) return;
      const L = ALPINE_LIGHT, num = (v, d) => (Number.isFinite(+v) ? +v : d);
      const az = THREE.MathUtils.degToRad(num(L.sunAzimuth, -34)), el = THREE.MathUtils.degToRad(num(L.sunElevation, 11));
      sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
      try { uniforms.uSunCol.value.set(L.sunColor || '#ffdcb8'); uniforms.uLit.value.set(L.cloudLit || '#fff0e0'); uniforms.uShade.value.set(L.cloudShade || '#7487a6'); } catch { /* bad colour string from the tuner */ }
      uniforms.uBright.value = num(L.brightness, 1);
      uniforms.uSoft.value = clamp(num(L.cloudSoftness, .55), 0, 2);
      const amount = clamp(num(L.cloudAmount, 1), 0, 2);
      uniforms.uAmount.value = amount;
      uniforms.uLift.value = num(L.cloudHeight, 230) - 230;
      // Drift is its own clock, so the speed dial never jumps the clouds; reduced motion holds them still.
      const dt = lastTime === null ? 0 : clamp(time - lastTime, 0, .1); lastTime = time;
      if (!reduced) clock += dt * num(L.cloudDrift, 1);
      uniforms.uTime.value = clock;
      // In from the rise: the canyon floor keeps a clear sky line.
      const camY = camera ? camera.position.y : 1000;
      uniforms.uAlpha.value = S(reveal, .1, .5) * S(camY, 40, 260) * Math.min(1, amount * 2);
    },
    dispose() { if (disposed) return; disposed = true; group.removeFromParent(); geometry.dispose(); material.dispose(); releaseAlpineCloudNoise(); group.clear(); }
  };
}
