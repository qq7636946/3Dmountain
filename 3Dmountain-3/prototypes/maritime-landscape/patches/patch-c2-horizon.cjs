// Colour pass C2 "horizon" (2026-10-21): generated island plates on the banner's far sea with broken
// reflections and the room's own haze, and a generated cloud band painted into montisEnv (so backdrop,
// sea and drop all see it). COBALT only; nothing loads for ?look=overcast / ?look=original.
// Every replacement asserts one unique anchor. Run from the project root.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
function edit(rel, pairs) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  for (const [label, find, repl] of pairs) {
    const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
    const n = src.split(f).length - 1;
    if (n !== 1) throw new Error(`${rel} [${label}] anchor found ${n} times`);
    src = src.replace(f, () => r);
  }
  fs.writeFileSync(file, src);
  console.log('patched', rel, pairs.length);
}

edit('prototypes/maritime-landscape/js/main.js', [
  ['config',
    `        glow: '#fffcf2', glowGain: 1.02, veil: '#8f8f91'
      };`,
    `        glow: '#fffcf2', glowGain: 1.02, veil: '#8f8f91'
      };
      /* COBALT HORIZON (2026-10-21): generated island plates on the banner's far sea, their broken
         reflections, and a generated cloud band in the banner's sky. Only the cobalt palette turns them on. */
      CONFIG.horizon = {
        islands: COBALT ? 1 : 0, scale: 1, haze: .26, hazeStep: .16, mist: .24, sat: .92, bright: 1, tint: '#ffffff',
        reflect: .32, reflectLen: .85,
        clouds: COBALT ? .75 : 0, cloudLow: .012, cloudHigh: .36, cloudSpan: 96, cloudDrift: .0035, cloudColour: .85, cloudTint: '#ffffff'
      };`],
  ['env-uniforms',
    `        uEnvKey: { value: new THREE.Vector3(1.6, 34., .71) }
      };`,
    `        uEnvKey: { value: new THREE.Vector3(1.6, 34., .71) },
        /* COBALT clouds: A.x amount (0 = no fetch), A.yz the elevation band, A.w drift; B rgb tint, B.w colour. */
        uEnvCloud: { value: null },
        uEnvCloudA: { value: new THREE.Vector4(0, .012, .36, 0) },
        uEnvCloudB: { value: new THREE.Vector4(1, 1, 1, 1) },
        uEnvCloudSpan: { value: 1.68 }
      };`],
  ['env-decl',
    `uniform vec3 uEnvCardDir,uEnvDropInk,uEnvKeyDir,uEnvKey;\n`,
    `uniform vec3 uEnvCardDir,uEnvDropInk,uEnvKeyDir,uEnvKey;
uniform sampler2D uEnvCloud;
uniform vec4 uEnvCloudA,uEnvCloudB;
uniform float uEnvCloudSpan;
`],
  ['env-clouds',
    `  c*=1.+.07*cos(az*2.+uEnvSpin)+.035*cos(az*3.-1.9);\n`,
    `  c*=1.+.07*cos(az*2.+uEnvSpin)+.035*cos(az*3.-1.9);

  /* COBALT clouds: a generated plate of dusk cloud (black = clear sky) laid over the room as a band
     of elevation and azimuth, so the backdrop draws it, the sea mirrors it and the drop wears it.
     The blur widens the fetch the way roughness does everything else here. */
  if(uEnvCloudA.x>0.){
    float cv=(d.y-uEnvCloudA.y)/max(uEnvCloudA.z-uEnvCloudA.y,1e-3);
    float cu=atan(d.x,-d.z)/uEnvCloudSpan;
    float cf=smoothstep(0.,.10,cv)*smoothstep(1.,.72,cv)*smoothstep(.62,.38,abs(cu))*uEnvCloudA.x;
    if(cf>.001){
      vec3 cs=textureLod(uEnvCloud,vec2(cu+.5+uEnvCloudA.w,clamp(cv,0.,1.)),b*7.).rgb;
      vec3 cc=mix(vec3(dot(cs,vec3(.299,.587,.114))),cs,uEnvCloudB.w)*uEnvCloudB.rgb;
      c=c*(1.-max(cs.r,max(cs.g,cs.b))*cf)+cc*cf;
    }
  }
`],
  ['islands',
    `      sea.renderOrder = 1;
      scene.add(sea);
`,
    `      sea.renderOrder = 1;
      scene.add(sea);

      /* COBALT HORIZON: two generated island plates (keyed out of a magenta ground) standing on the far
         sea, each with a broken reflection under it. They take the room's own haze toward the horizon
         and mist at the water line, and the sea's framing offset, so their feet sit on the drawn sea. */
      const horizonIslands = [], horizonTime = { value: 0 }, horizonTint = { value: new THREE.Vector3(1, 1, 1) };
      const HORIZON_ISLES = [
        { url: 'images/maritime/island-a.webp?v=1', aspect: 1024 / 579, fx: .2, fxNarrow: .14, dist: 170, h: 13, narrowScale: .9, maxFrac: .2, maxFracNarrow: .5, flip: 0 },
        { url: 'images/maritime/island-b.webp?v=1', aspect: 1280 / 289, fx: .8, fxNarrow: .9, dist: 235, h: 7.2, narrowScale: .9, maxFrac: .2, maxFracNarrow: .5, flip: 1 }
      ];
      if (COBALT) {
        const loader = new THREE.TextureLoader();
        montisEnvUniforms.uEnvCloud.value = loader.load('images/maritime/clouds-a.jpg?v=1', () => queueEnvBake());
        Object.assign(montisEnvUniforms.uEnvCloud.value, { colorSpace: THREE.SRGBColorSpace, wrapS: THREE.MirroredRepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, anisotropy: 4 });
        const vert = \`
    varying vec2 vUv;
    varying vec3 vWorld;
    void main(){
      vUv=uv;
      vec4 w=modelMatrix*vec4(position,1.);
      vWorld=w.xyz;
      gl_Position=projectionMatrix*viewMatrix*w;
    }
  \`;
        const frag = MONTIS_ENV_GLSL + MONTIS_VEIL_GLSL + \`
    uniform sampler2D uMap;
    uniform float uFlip,uReflect,uTime,uBandGain;
    uniform vec4 uIsle;
    uniform vec3 uIsleTint,uIsleSea;
    varying vec2 vUv;
    varying vec3 vWorld;
    void main(){
      vec3 view=normalize(vWorld-cameraPosition);
      vec3 sky=montisEnv(view,.05,uBandGain,0.);
      float x=mix(vUv.x,1.-vUv.x,uFlip);
    #ifdef MIRROR
      /* Below the water line: the plate upside down, pulled sideways by two slow swells and cut
         into the horizontal slivers a ruffled sea makes of a far reflection. */
      float dep=1.-vUv.y;
      float wob=sin(dep*90.+uTime*1.7+vUv.x*23.)*.5+sin(dep*37.-uTime*1.1+vUv.x*61.)*.5;
      vec4 t=texture2D(uMap,vec2(x+wob*.006*(.3+dep),dep));
      float sliver=smoothstep(-.35,.6,sin(dep*210.+uTime*2.3+wob*2.));
      float k=uReflect*(1.-smoothstep(0.,.75,dep))*(.45+.55*sliver);
      t.rgb=mix(uIsleSea,t.rgb*.62,.55);
      float mist=.25;
    #else
      vec4 t=texture2D(uMap,vec2(x,vUv.y));
      float k=1.;
      float mist=smoothstep(uIsle.y,0.,vUv.y);
    #endif
      vec3 col=t.rgb;
      float l=dot(col,vec3(.2126,.7152,.0722));
      col=mix(vec3(l),col,uIsle.z)*uIsle.w*uIsleTint;
      col=mix(col,sky,clamp(uIsle.x+mist*(1.-uIsle.x),0.,1.));
      col=montisVeil(col,view);
      gl_FragColor=vec4(max(col,vec3(0.)),t.a*k);
    }
  \`;
        HORIZON_ISLES.forEach((spec, i) => {
          const isle = { spec, ready: false, uIsle: { value: new THREE.Vector4(.26, .24, .92, 1) }, uReflect: { value: .32 } };
          const map = { value: loader.load(spec.url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; isle.ready = true; }) };
          const make = mirror => {
            const m = lowerSurfaceMaterial(new THREE.ShaderMaterial({
              transparent: true, depthTest: false, depthWrite: false, fog: false,
              defines: mirror ? { MIRROR: 1 } : {},
              uniforms: Object.assign({
                uMap: map, uFlip: { value: spec.flip }, uReflect: isle.uReflect, uTime: horizonTime,
                uBandGain: backdropUniforms.uBandGain, uIsle: isle.uIsle, uIsleTint: horizonTint, uIsleSea: seaUniforms.uMarDeep,
                uVeilOn: { value: 1 }
              }, montisEnvUniforms, montisVeilUniforms),
              vertexShader: vert, fragmentShader: frag
            }));
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, mirror ? -.5 : .5, 0), m);
            mesh.name = \`montis-isle-\${i}\${mirror ? '-mirror' : ''}\`;
            mesh.frustumCulled = false;
            mesh.renderOrder = mirror ? 1.4 : 1.5;
            mesh.visible = false;
            scene.add(mesh);
            return mesh;
          };
          isle.mesh = make(false); isle.mirror = make(true);
          horizonIslands.push(isle);
        });
      }
      const horizonFwd = new THREE.Vector3();
      /* Placed in screen terms every frame (fraction across the frame at a distance), so they keep
         their spot on any screen and follow the camera without sliding against the sea. */
      function placeHorizon() {
        if (!horizonIslands.length) return;
        const H = CONFIG.horizon, on = +H.islands > 0;
        const tNow = performance.now() / 1000;
        horizonTime.value = tNow;
        montisEnvUniforms.uEnvCloudA.value.w = (tNow * (+H.cloudDrift || 0)) % 2;
        camera.getWorldDirection(horizonFwd); horizonFwd.y = 0;
        if (horizonFwd.lengthSq() < 1e-6) horizonFwd.set(0, 0, -1);
        horizonFwd.normalize();
        const narrow = camera.aspect < 1, tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov * .5));
        for (const isle of horizonIslands) {
          const show = on && isle.ready;
          isle.mesh.visible = isle.mirror.visible = show;
          if (!show) continue;
          const s = isle.spec, d = s.dist, halfW = d * tanHalf * camera.aspect;
          let h = s.h * (+H.scale || 1) * (narrow ? s.narrowScale : 1), w = h * s.aspect;
          const maxW = 2 * halfW * (narrow ? s.maxFracNarrow : s.maxFrac) * (+H.scale || 1);
          if (w > maxW) { h *= maxW / w; w = maxW; }
          const x = ((narrow ? s.fxNarrow : s.fx) - .5) * 2 * halfW;
          const px = camera.position.x + horizonFwd.x * d - horizonFwd.z * x, pz = camera.position.z + horizonFwd.z * d + horizonFwd.x * x;
          const ry = Math.atan2(-horizonFwd.x, -horizonFwd.z);
          isle.mesh.position.set(px, 0, pz); isle.mesh.rotation.set(0, ry, 0); isle.mesh.scale.set(w, h, 1);
          isle.mirror.position.set(px, 0, pz); isle.mirror.rotation.set(0, ry, 0); isle.mirror.scale.set(w, h * (+H.reflectLen || .85), 1);
        }
      }
`],
  ['frame',
    `        // The water fan follows the final camera, without a one-frame gap.
        sea.position.set(camera.position.x, 0, camera.position.z);
        sea.updateMatrixWorld();
`,
    `        // The water fan follows the final camera, without a one-frame gap.
        sea.position.set(camera.position.x, 0, camera.position.z);
        sea.updateMatrixWorld();
        placeHorizon();
`],
  ['apply',
    `          document.documentElement.dataset.palette = COBALT ? 'cobalt' : 'overcast';`,
    `          document.documentElement.dataset.palette = COBALT ? 'cobalt' : 'overcast';
        }
        {
          /* COBALT HORIZON: islands and the cloud band. */
          const H = CONFIG.horizon, hex = h => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
          const cl = montisEnvUniforms.uEnvCloudA.value;
          cl.x = montisEnvUniforms.uEnvCloud.value ? Math.max(0, +H.clouds || 0) : 0;
          cl.y = +H.cloudLow || 0; cl.z = Math.max(cl.y + .02, +H.cloudHigh || .36);
          const ct = hex(H.cloudTint);
          montisEnvUniforms.uEnvCloudB.value.set(ct[0], ct[1], ct[2], Math.max(0, +H.cloudColour || 0));
          montisEnvUniforms.uEnvCloudSpan.value = THREE.MathUtils.degToRad(Math.max(20, +H.cloudSpan || 96));
          paletteLinear(H.tint, horizonTint.value);
          horizonIslands.forEach((isle, i) => {
            isle.uIsle.value.set(THREE.MathUtils.clamp((+H.haze || 0) + i * (+H.hazeStep || 0), 0, 1), Math.max(.001, +H.mist || 0), +H.sat, +H.bright);
            isle.uReflect.value = Math.max(0, +H.reflect || 0);
          });`],
  ['rows',
    `          ['寫實山海 Maritime', [`,
    `          ['島嶼與雲 Horizon', [
            ['島嶼（0＝關）', 'horizon', 'islands', 0, 1, 1], ['島嶼大小', 'horizon', 'scale', .3, 2, .01],
            ['島嶼遠霧', 'horizon', 'haze', 0, 1, .01], ['遠島再淡', 'horizon', 'hazeStep', 0, .5, .01], ['水線薄霧', 'horizon', 'mist', 0, .6, .01],
            ['島嶼飽和', 'horizon', 'sat', 0, 1.6, .01], ['島嶼亮度', 'horizon', 'bright', .2, 2, .01], ['島嶼色調', 'horizon', 'tint'],
            ['島嶼倒影', 'horizon', 'reflect', 0, 1, .01], ['倒影長度', 'horizon', 'reflectLen', .2, 1.5, .01],
            ['雲量（0＝關）', 'horizon', 'clouds', 0, 1.5, .01], ['雲層下緣', 'horizon', 'cloudLow', -.1, .3, .005], ['雲層上緣', 'horizon', 'cloudHigh', .1, .8, .005],
            ['雲層寬度°', 'horizon', 'cloudSpan', 40, 220, 1], ['雲飄速度', 'horizon', 'cloudDrift', 0, .03, .0005],
            ['雲的彩度', 'horizon', 'cloudColour', 0, 1.5, .01], ['雲色調', 'horizon', 'cloudTint']
          ]],
          ['寫實山海 Maritime', [`]
]);
