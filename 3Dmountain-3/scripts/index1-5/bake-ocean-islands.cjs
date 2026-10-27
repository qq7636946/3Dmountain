/* Offline island atlases for index1-5. Uses the existing valley geometry/material.
   Colour = native valley diffuse material, without baked directional lighting.
   Form = detailed erosion normal XY + height. Modest crest relief, sheltered turf.
   Alpha = signed coast distance, +/-48px at 1024px (24px at the mobile resolution).
   RGB is extended past every shore before mip generation, preventing dark transparent fringes. */
'use strict';
const fs = require('fs');
const L = require('./lib.cjs');
const sharp = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const DIR = '.qa/island-refine-20261024';
const OUT = 'prototypes/index1-5/assets/ocean';
const N = 1024, RANGE = 96;
async function coast(input) {
  const { data } = await sharp(input).resize(N, N).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const count = N * N, inner = new Float32Array(count), outer = new Float32Array(count), nearest = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const land = data[i * 4 + 3] > 127;
    inner[i] = land ? 1e5 : 0; outer[i] = land ? 0 : 1e5; nearest[i] = land ? i : -1;
  }
  function relax(a, i, j, step, extend) {
    const v = a[j] + step;
    if (v < a[i]) { a[i] = v; if (extend) nearest[i] = nearest[j]; }
  }
  for (const a of [inner, outer]) {
    const extend = a === outer;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (x) relax(a, i, i - 1, 1, extend);
      if (y) relax(a, i, i - N, 1, extend);
      if (x && y) relax(a, i, i - N - 1, 1.414, extend);
      if (x < N - 1 && y) relax(a, i, i - N + 1, 1.414, extend);
    }
    for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) {
      const i = y * N + x;
      if (x < N - 1) relax(a, i, i + 1, 1, extend);
      if (y < N - 1) relax(a, i, i + N, 1, extend);
      if (x < N - 1 && y < N - 1) relax(a, i, i + N + 1, 1.414, extend);
      if (x && y < N - 1) relax(a, i, i + N - 1, 1.414, extend);
    }
  }
  for (let i = 0; i < count; i++) {
    if (data[i * 4 + 3] <= 127 && nearest[i] >= 0) {
      const k = nearest[i] * 4;
      for (let c = 0; c < 3; c++) data[i * 4 + c] = data[k + c];
    }
    const distance = inner[i] > 0 ? inner[i] : -outer[i];
    data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, .5 + distance / RANGE)) * 255);
  }
  return sharp(data, { raw: { width: N, height: N, channels: 4 } }).png().toBuffer();
}
L.main('bake-ocean-islands', { usage: 'node scripts/index1-5/bake-ocean-islands.cjs', spec: {}, timeout: 360 }, async o => {
  fs.mkdirSync(DIR, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
  const session = await L.openSession('bake-ocean-islands', o);
  const tiles = await session.page.evaluate(async () => {
    const THREE = await import('three'), s = window.__MONTIS_STUDY__;
    const source = s.canyon.watershed.group.getObjectByName('Interlocking alpine massifs and carved confluences');
    const src = source.geometry, p = src.attributes.position, ix = src.index.array, results = [];
    for (const [tile, cx, cz, half, phase] of [[0, -450, -1300, 1400, .7], [1, 1200, -2850, 1550, 2.4]]) {
      const map = new Map(), indices = [], attributes = {};
      for (const key of Object.keys(src.attributes)) attributes[key] = [];
      function vertex(k) {
        if (map.has(k)) return map.get(k);
        const id = map.size; map.set(k, id);
        let x = p.getX(k), y = p.getY(k), z = p.getZ(k);
        const nx = (x - cx) / half, nz = (z - cz) / half, theta = Math.atan2(nz, nx);
        const radius = Math.hypot(nx, nz / .72);
        const edge = .78 + .10 * Math.sin(theta * 3 + phase) + .055 * Math.sin(theta * 7 - phase) + .025 * Math.sin(theta * 13 + phase);
        const t = THREE.MathUtils.smoothstep(radius / edge, .48, 1.10);
        y = y * 1.25 * (1 - t) - 95 * t - 12;
        for (const [key, a] of Object.entries(src.attributes)) for (let c = 0; c < a.itemSize; c++) {
          attributes[key].push(key === 'position' ? c === 0 ? x - cx : c === 1 ? y : z - cz : a.array[k * a.itemSize + c]);
        }
        return id;
      }
      for (let i = 0; i < ix.length; i += 3) {
        const ks = [ix[i], ix[i + 1], ix[i + 2]];
        if (ks.some(k => Math.abs(p.getX(k) - cx) > half * 1.08 || Math.abs(p.getZ(k) - cz) > half * 1.08)) continue;
        indices.push(...ks.map(vertex));
      }
      const geometry = new THREE.BufferGeometry();
      for (const [key, a] of Object.entries(src.attributes)) geometry.setAttribute(key, new THREE.Float32BufferAttribute(attributes[key], a.itemSize));
      geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      const material = source.material.clone();
      material.onBeforeCompile = shader => {
        source.material.onBeforeCompile(shader);
        // Exposed island crests carry less meadow than sheltered valley floors.
        // Copy these uniforms: never mutate the live valley's material settings.
        for (const [name,scale] of [['uGrass',.62],['uGrassRange',.78],['uForest',.65]])
          if(shader.uniforms[name])shader.uniforms[name]={value:shader.uniforms[name].value*scale};
        // Export the valley's diffuse material directly, without ambient-light
        // overexposure or a second baked sun. Retain its cavities and minerals.
        shader.fragmentShader = shader.fragmentShader.replace(/}\s*$/, `
          vec3 islandColour=alpAlbedo;
          float vegetation=smoothstep(.025,.14,min(islandColour.r,islandColour.g)-islandColour.b)*smoothstep(.80,1.02,islandColour.g/(islandColour.r+.001));
          islandColour=mix(islandColour,mix(islandColour,vec3(dot(islandColour,vec3(.2126,.7152,.0722))),.35)*.94,vegetation);
          gl_FragColor=linearToOutputTexel(vec4(islandColour*2.3,1.));
        }`);
      };
      material.customProgramCacheKey = () => source.material.customProgramCacheKey() + '-ocean-albedo';
      material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -1)];
      const scene = new THREE.Scene(), mesh = new THREE.Mesh(geometry, material); scene.add(mesh);
      scene.add(new THREE.AmbientLight(0xffffff, 8));
      const camera = new THREE.OrthographicCamera(-half, half, half, -half, 1, 12000);
      camera.position.set(0, 6500, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.localClippingEnabled = true; renderer.setSize(2048, 2048); renderer.setClearColor(0, 0);
      renderer.toneMapping = s.renderer.toneMapping; renderer.toneMappingExposure = s.renderer.toneMappingExposure;
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.render(scene, camera);
      const colour = renderer.domElement.toDataURL('image/png');
      const form = source.material.clone();
      form.clippingPlanes = material.clippingPlanes;
      form.onBeforeCompile = shader => {
        source.material.onBeforeCompile(shader);
        for (const [name,scale] of [['uGrass',.62],['uGrassRange',.78],['uForest',.65]])
          if(shader.uniforms[name])shader.uniforms[name]={value:shader.uniforms[name].value*scale};
        // The full erosion/rock normal, not just interpolated mesh normals.
        shader.fragmentShader = shader.fragmentShader.replace(/}\s*$/, `
          vec3 islandN=normalize(alpN);
          gl_FragColor=vec4(vec2(islandN.x,-islandN.z)*.5+.5,clamp(tWorld.y/1600.,0.,1.),1.);
        }`);
      };
      form.customProgramCacheKey = () => source.material.customProgramCacheKey() + '-ocean-detail-form-v3';
      mesh.material = form; renderer.setClearColor(new THREE.Color().setRGB(.5,.5,0), 1); renderer.toneMapping = THREE.NoToneMapping;
      renderer.render(scene, camera);
      results.push({ tile, colour, form: renderer.domElement.toDataURL('image/png'), vertices: map.size });
      renderer.dispose(); material.dispose(); form.dispose(); geometry.dispose();
    }
    return results;
  });
  const colours = [], forms = [];
  for (const tile of tiles) {
    const colour = Buffer.from(tile.colour.split(',')[1], 'base64');
    fs.writeFileSync(`${DIR}/albedo-${tile.tile}.png`, colour);
    colours.push(await coast(colour));
    forms.push(await sharp(Buffer.from(tile.form.split(',')[1], 'base64')).resize(N, N).removeAlpha().png().toBuffer());
  }
  for (const [name, images, quality] of [['valley-islands-albedo-v3.webp', colours, 90], ['valley-islands-form-v3.webp', forms, 100]]) {
    const atlas = await sharp({ create: { width: N * 2, height: N, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(images.map((input, i) => ({ input, left: i * N, top: 0 }))).png().toBuffer();
    await sharp(atlas).webp({ quality, alphaQuality: 100, lossless: name.includes('form') }).toFile(`${OUT}/${name}`);
    await sharp(atlas).resize(N,N/2).webp({ quality, alphaQuality: 100, lossless: name.includes('form') }).toFile(`${OUT}/${name.replace('.webp','-small.webp')}`);
    console.log(name, fs.statSync(`${OUT}/${name}`).size);
  }
  return session.log.errors.length ? 1 : 0;
});
