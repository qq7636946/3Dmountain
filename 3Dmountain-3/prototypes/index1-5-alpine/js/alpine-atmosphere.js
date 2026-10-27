/* index1-5-alpine: sky, sun, light rig, fog and air particles for the canyon / watershed world.
   Reference: everest.suraj.work: a deep blue zenith with film grain over a pale luminous horizon band,
   a low golden sun just over a ridge (disc, halo, faint lens streak), warm rim light on the sunlit
   ridges and snow, cool blue-grey shade, a cloud sea on the horizon and fine ice in the air.
   Everything here reads ALPINE_LIGHT every frame, after the scene's own per-frame light code, so it is
   the last word on sky / fog / light colours and the tuner changes them live.
   Lights: the shadowed sun, an unshadowed warm rim skimming from the sun's azimuth, and a cool fill from the
   opposite side (direct light, so the terrain's baked AO cannot crush the shade to black) plus hemisphere / IBL.
   Cost: the sky dome's fragment shader (already drawn), one Points draw, one extra light, no new render pass.
   The shadow map stays static: it is re-baked only when the sun moves or the camera leaves / returns to the
   canyon floor (a tight corridor fit, then the wide aerial fit). */
import { ALPINE_LIGHT } from './alpine-light-params.js';

// Fallbacks for a bad tuner value: the defaults as loaded, before any tuning.
const DEFAULTS = { ...ALPINE_LIGHT };

const SKY_VERTEX = `varying vec3 vDirection;
void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.99999;}`;

const SKY_FRAGMENT = `uniform vec3 zenith,horizon,uMid,uSunDir,uSunCol,uCloudLit,uCloudShade,uFogColor;
uniform float uHaze,uSunSize,uGlowSize,uGlow,uFlare,uGrain,uTime,uSkyClouds,uCloudSea,uBright,uDrift;
uniform sampler2D uNoise;
varying vec3 vDirection;
float skyHash(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
void main(){
  vec3 d=normalize(vDirection);
  float y=d.y,h=max(y,0.);
  vec3 sd=normalize(uSunDir);
  float mu=dot(d,sd);
  vec2 dh=normalize(d.xz+vec2(1e-5)),sh=normalize(sd.xz+vec2(1e-5));
  float sunSide=max(dot(dh,sh),0.);
  // Three-stop gradient: pale luminous haze band -> soft blue -> deep zenith.
  float band=smoothstep(0.,1.,clamp(h/max(uHaze,.01),0.,1.));
  vec3 col=mix(horizon,uMid,band);
  float upper=clamp((h-uHaze*.55)/max(1.-uHaze*.55,.05),0.,1.);
  col=mix(col,zenith,smoothstep(0.,1.,pow(upper,1.05)));
  // Warm haze: the light-filled air toward the sun is pale gold, mixed in (adding orange to blue turns it violet).
  vec3 warmHaze=mix(horizon,uSunCol,.42)*1.12;
  float ang=acos(clamp(mu,-1.,1.));
  float wash=clamp(uGlow*(exp(-ang/(.30*uGlowSize))*.55+pow(sunSide,5.)*exp(-h*9.)*.45),0.,.9);
  col=mix(col,warmHaze,wash);
  // Bright misty line right on the horizon.
  float line=exp(-abs(y)*42.);
  col=mix(col,mix(horizon*1.06,warmHaze,pow(sunSide,3.)*.6),line*.55);
  // High cumulus over the valleys: a plane far above, projected into the dome.
  if(uSkyClouds>.001&&y>.012){
    vec2 q=d.xz/(y+.06)*.16+vec2(uTime*.0009*uDrift,uTime*.0003*uDrift);
    vec4 c1=texture2D(uNoise,q*.55+vec2(.21,.43));
    vec4 c2=texture2D(uNoise,q*1.7+vec2(.71,.13));
    float D=c1.r*.66+c2.r*.34;
    float th=.86-.3*uSkyClouds;
    float a=smoothstep(th,th+.18,D)*smoothstep(.012,.07,y)*(1.-smoothstep(.3,.62,y));
    vec2 g=(c1.gb-.5)*.66+(c2.gb-.5)*.34*3.;
    float lit=clamp(.55+dot(-g,sh)*.9+(D-th)*1.4,0.,1.);
    vec3 cc=mix(uCloudShade,uCloudLit,lit)+uSunCol*pow(max(mu,0.),12.)*(1.-a)*.8;
    cc=mix(cc,horizon,.35*(1.-smoothstep(.02,.18,y)));
    col=mix(col,cc,a*.92);
  }
  // Distant cloud sea below the horizon (only where the terrain leaves the dome showing).
  if(y<.004){
    float dn=max(-y,.0035);
    vec2 q=d.xz/dn*.022+vec2(uTime*.0004*uDrift,0.);
    vec4 s1=texture2D(uNoise,q*.5);
    vec4 s2=texture2D(uNoise,q*1.9+.5);
    float D=s1.r*.6+s2.r*.4;
    float tops=smoothstep(.25,.75,D);
    vec2 g=(s1.gb-.5)+(s2.gb-.5)*1.5;
    float lit=clamp(.5+dot(-g,sh)*.6+tops*.35,0.,1.);
    vec3 sea=mix(uCloudShade,uCloudLit,lit)*mix(.82,1.,tops);
    sea+=uSunCol*.12*pow(sunSide,6.);
    float toLine=exp(-dn*26.);
    sea=mix(sea,horizon*1.04,toLine*.8);
    col=mix(col,sea,clamp(uCloudSea,0.,1.)*smoothstep(.004,-.004,y));
  }
  // Sun: disc, two-scale halo, a wide warm wash, and a faint horizontal lens streak.
  float r=.0115*uSunSize;
  float disc=1.-smoothstep(r*.78,r,ang);
  float halo=exp(-ang/(.022*uGlowSize))*1.1+exp(-ang/(.085*uGlowSize))*.42;
  vec3 haloCol=mix(uSunCol,vec3(1.,.97,.92),.35);
  col+=haloCol*(disc*36.+halo*uGlow);
  vec3 vd=(viewMatrix*vec4(d,0.)).xyz,vs=(viewMatrix*vec4(sd,0.)).xyz;
  if(vs.z<-.05&&vd.z<-.05&&uFlare>.001){
    // Screen-proportional offsets from the sun (tangent plane), so the streak is resolution independent.
    vec2 o=vd.xy/-vd.z-vs.xy/-vs.z;
    float streak=exp(-abs(o.y)/.0026)*exp(-abs(o.x)/.3);
    float star=exp(-abs(o.y)/.011)*exp(-abs(o.x)/.09);
    col+=uSunCol*(streak*1.2+star*.45)*uFlare;
  }
  // Fine film grain, strongest in the deep blue.
  float g1=skyHash(gl_FragCoord.xy+fract(uTime*7.31)*vec2(91.7,37.3)),g2=skyHash(gl_FragCoord.yx*1.37+fract(uTime*3.17)*vec2(13.1,71.9));
  col*=1.+(g1+g2-1.)*uGrain*.055*(1.-band*.6);
  gl_FragColor=vec4(max(col,vec3(0.))*uBright,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createAlpineAtmosphere(THREE, { scene, camera, sky, hemisphere, sunlight, rim, clouds = null, lite = false } = {}) {
  const L = ALPINE_LIGHT;
  const num = key => { const v = Number(L[key]); return Number.isFinite(v) ? v : DEFAULTS[key]; };
  const col = (key, _, out) => { try { out.set(L[key] || DEFAULTS[key]); } catch { out.set(DEFAULTS[key]); } return out; };

  /* ---------- sky dome ---------- */
  const oldSky = sky.material;
  const noise = clouds?.noise ?? null;
  const skyUniforms = {
    zenith: { value: new THREE.Color(L.skyZenith) }, horizon: { value: new THREE.Color(L.skyHorizon) }, uMid: { value: new THREE.Color(L.skyMid) },
    uSunDir: { value: new THREE.Vector3(0, .2, -1).normalize() }, uSunCol: { value: new THREE.Color(L.sunColor) },
    uCloudLit: { value: new THREE.Color(L.cloudLit) }, uCloudShade: { value: new THREE.Color(L.cloudShade) }, uFogColor: { value: new THREE.Color(L.fogColor) },
    uHaze: { value: .24 }, uSunSize: { value: 1 }, uGlowSize: { value: 1 }, uGlow: { value: 1 }, uFlare: { value: .5 }, uGrain: { value: .5 },
    uTime: { value: 0 }, uSkyClouds: { value: noise ? .8 : 0 }, uCloudSea: { value: noise ? 1 : 0 }, uBright: { value: 1 }, uDrift: { value: 1 },
    uNoise: { value: noise }
  };
  const skyMaterial = new THREE.ShaderMaterial({ name: 'Alpine sky dome', side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT });
  sky.material = skyMaterial; oldSky.dispose();

  /* ---------- light rig ---------- */
  // Lights point at the world's middle; the static shadow map is fitted to a box around everything the camera sees.
  const sunDir = new THREE.Vector3(), rimDir = new THREE.Vector3();
  // Receivers decide the shadow map's footprint (two static fits: the canyon corridor at ~1 unit per texel,
  // then the aerial world); casters anywhere toward the sun stay inside its depth range.
  const ROI = {
    canyon: new THREE.Box3(new THREE.Vector3(-800, -20, -2700), new THREE.Vector3(800, 800, 300)),
    aerial: new THREE.Box3(new THREE.Vector3(-6500, -20, -10500), new THREE.Vector3(6500, 1800, 2600))
  };
  const world = new THREE.Box3(new THREE.Vector3(-9000, -20, -12000), new THREE.Vector3(9000, 1800, 4800));
  let phase = 'canyon';
  const roiCenter = ROI.aerial.getCenter(new THREE.Vector3());
  sunlight.target.position.copy(roiCenter).setY(0); sunlight.target.updateMatrixWorld();
  const lightView = new THREE.Matrix4(), corner = new THREE.Vector3(), lightBox = new THREE.Box3();
  rim.castShadow = false;
  if (!rim.target.parent) scene.add(rim.target);
  // Cool sky fill from the side away from the sun. Direct light, so the terrain's baked AO (which multiplies
  // every indirect term: hemisphere and IBL) cannot crush the shaded faces to black; unshadowed.
  const fill = new THREE.DirectionalLight('#7f9de0', 0); fill.name = 'Alpine sky fill';
  fill.target.position.copy(sunlight.target.position); scene.add(fill, fill.target);
  const fillDir = new THREE.Vector3();
  rim.target.position.copy(sunlight.target.position); rim.target.updateMatrixWorld();
  let shadowKey = '';
  const casterBox = new THREE.Box3();
  function lightSpace(box, out) {
    out.makeEmpty();
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(lightView);
      out.expandByPoint(corner);
    }
    return out;
  }
  function fitShadow() {
    const D = 16000, roi = ROI[phase];
    sunlight.position.copy(sunlight.target.position).addScaledVector(sunDir, D);
    sunlight.updateMatrixWorld();
    lightView.lookAt(sunlight.position, sunlight.target.position, Math.abs(sunDir.y) > .99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0));
    lightView.setPosition(sunlight.position); lightView.invert();
    lightSpace(roi, lightBox); lightSpace(world, casterBox);
    const cam = sunlight.shadow.camera, pad = phase === 'canyon' ? 60 : 200;
    // Width is capped; anything outside is simply unshadowed and far off in haze.
    const halfW = Math.min(7600, (lightBox.max.x - lightBox.min.x) / 2 + pad), halfH = Math.min(7600, (lightBox.max.y - lightBox.min.y) / 2 + pad);
    const cx = (lightBox.max.x + lightBox.min.x) / 2, cy = (lightBox.max.y + lightBox.min.y) / 2;
    Object.assign(cam, { left: cx - halfW, right: cx + halfW, bottom: cy - halfH, top: cy + halfH, near: Math.max(50, -casterBox.max.z - 300), far: -Math.min(lightBox.min.z, casterBox.min.z) + 300 });
    cam.updateProjectionMatrix();
    // Texel-scaled bias: a low sun grazes the walls, so acne needs more push on the coarse aerial fit.
    const texel = 2 * halfW / Math.max(1, sunlight.shadow.mapSize.x);
    sunlight.shadow.normalBias = THREE.MathUtils.clamp(texel * 1.4, 1.2, 6);
    sunlight.shadow.bias = -THREE.MathUtils.clamp(texel * .6, .4, 3) / Math.max(1, cam.far - cam.near);
    sunlight.shadow.needsUpdate = true;
  }

  /* ---------- fine ice in the air ---------- */
  const COUNT = lite ? 260 : 900, BOX = 46;
  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) { seeds[i * 4] = Math.random(); seeds[i * 4 + 1] = Math.random(); seeds[i * 4 + 2] = Math.random(); seeds[i * 4 + 3] = Math.random(); }
  const pGeometry = new THREE.BufferGeometry();
  pGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  pGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const pUniforms = {
    uTime: { value: 0 }, uBox: { value: BOX }, uAmount: { value: 1 }, uCam: { value: new THREE.Vector3() }, uSunDir: skyUniforms.uSunDir, uSunCol: skyUniforms.uSunCol,
    uPixel: { value: 1 }, uBright: { value: 1 }, uShade: { value: new THREE.Color(L.shadowColor) }
  };
  const pMaterial = new THREE.ShaderMaterial({
    name: 'Alpine air ice', uniforms: pUniforms, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `attribute vec4 aSeed;uniform float uTime,uBox,uAmount,uPixel;uniform vec3 uCam,uSunDir;
      varying float vA,vSpark;
      void main(){
        float on=step(aSeed.w,uAmount*.34);
        vec3 drift=vec3(sin(uTime*.31+aSeed.x*40.)*1.6+uTime*1.1,-uTime*(.55+aSeed.y*.7),cos(uTime*.23+aSeed.z*30.)*1.4+uTime*.35);
        vec3 p=aSeed.xyz*uBox+drift;
        p=mod(p-uCam+uBox*.5,uBox)-uBox*.5+uCam;
        vec4 view=viewMatrix*vec4(p,1.);
        float dist=-view.z;
        vec3 V=normalize(p-cameraPosition);
        vSpark=pow(max(dot(V,uSunDir),0.),5.)*1.6+.12;
        vA=on*smoothstep(.8,2.6,dist)*(1.-smoothstep(uBox*.30,uBox*.5,dist))*(.45+.55*fract(aSeed.w*17.31));
        gl_PointSize=clamp(uPixel*(.9+aSeed.x*1.4)*14./max(dist,.5),1.,5.)*step(.001,vA);
        gl_Position=projectionMatrix*view;}`,
    fragmentShader: `uniform vec3 uSunCol,uShade;uniform float uBright;varying float vA,vSpark;
      void main(){vec2 c=gl_PointCoord-.5;float r=dot(c,c)*4.;float a=(1.-r)*(1.-r)*vA;if(a<.003)discard;
        vec3 col=mix(uShade*.5+vec3(.2),uSunCol,clamp(vSpark,0.,1.))*(.25+vSpark*.6);
        gl_FragColor=vec4(col*a*uBright*.5,1.);}`
  });
  const particles = new THREE.Points(pGeometry, pMaterial);
  particles.name = 'Alpine drifting ice'; particles.frustumCulled = false; particles.renderOrder = 30;
  scene.add(particles);

  /* ---------- per frame ---------- */
  let clock = 0, last = null, disposed = false;
  function update(reveal = 0, time = 0, reduceMotion = false) {
    if (disposed) return;
    const B = THREE.MathUtils.clamp(num('brightness', 1), .05, 4);
    const az = THREE.MathUtils.degToRad(num('sunAzimuth', -34)), el = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(num('sunElevation', 11), -5, 89));
    sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
    // Two static fits: re-baked once when the camera leaves / returns to the canyon floor.
    const camY = camera.position.y;
    if (phase === 'canyon' && camY > 120) phase = 'aerial'; else if (phase === 'aerial' && camY < 80) phase = 'canyon';
    const key = az.toFixed(4) + ',' + el.toFixed(4) + phase;
    if (key !== shadowKey) { shadowKey = key; fitShadow(); }
    // Sun (shadowed key light).
    col('sunColor', '#ffc796', sunlight.color); sunlight.intensity = Math.max(0, num('sunIntensity', 3.6)) * B;
    // Rim: same azimuth, skimming the horizon, unshadowed: sun-facing ridges and snow catch a warm edge.
    const rimEl = Math.max(.02, el * .3);
    rimDir.set(Math.cos(rimEl) * Math.sin(az), Math.sin(rimEl), -Math.cos(rimEl) * Math.cos(az));
    rim.position.copy(rim.target.position).addScaledVector(rimDir, 1000);
    col('rimColor', '#ffd2a6', rim.color); rim.intensity = Math.max(0, num('rimStrength', 1.6)) * B;
    // Shade: sky fill and ground bounce; image-based light kept low so the lit / shaded split stays strong.
    col('shadowColor', '#7b93c4', hemisphere.color); col('groundColor', '#4a4a52', hemisphere.groundColor);
    const shade = Math.max(0, num('shadowStrength', 1.05));
    hemisphere.intensity = shade * B;
    col('shadowColor', '#7b93c4', fill.color); fill.intensity = shade * Math.max(0, num('fillShare')) * B;
    const fillEl = THREE.MathUtils.degToRad(38);
    fillDir.set(-Math.cos(fillEl) * Math.sin(az), Math.sin(fillEl), Math.cos(fillEl) * Math.cos(az));
    fill.position.copy(fill.target.position).addScaledVector(fillDir, 1000);
    if ('environmentIntensity' in scene) scene.environmentIntensity = Math.max(0, num('ambient', .22)) * B;
    // Fog: the scene's own density curve, scaled near (canyon) -> far (aerial).
    col('fogColor', '#b9c9dc', scene.fog.color);
    const w = THREE.MathUtils.smoothstep(reveal, .05, .8);
    scene.fog.density *= THREE.MathUtils.lerp(Math.max(0, num('fogNear', 1)), Math.max(0, num('fogFar', 1.15)), w);
    // While the camera climbs out of the canyon the scene's canyon-floor density lingers and flattens every far
    // range into one pale cut-out; thin it with height so the ranges step back in layers instead.
    const thin = .00105 / (1 + Math.max(0, camera.position.y) / 60) + .00009;
    scene.fog.density = Math.min(scene.fog.density, thin * Math.max(1, num('fogNear', 1)) * THREE.MathUtils.lerp(1, Math.max(.2, num('fogFar', 1.15)), w));
    if (scene.background?.isColor) col('skyHorizon', '#cbd8e6', scene.background).multiplyScalar(B);
    // Sky.
    const U = skyUniforms;
    col('skyZenith', '#0b2b68', U.zenith.value); col('skyMid', '#2a5ea6', U.uMid.value); col('skyHorizon', '#cbd8e6', U.horizon.value);
    col('cloudLit', '#fff0e0', U.uCloudLit.value); col('cloudShade', '#7487a6', U.uCloudShade.value); col('fogColor', '#b9c9dc', U.uFogColor.value);
    U.uSunDir.value.copy(sunDir); col('sunColor', '#ffc796', U.uSunCol.value);
    U.uHaze.value = THREE.MathUtils.clamp(num('hazeHeight', .24), .01, 1);
    U.uSunSize.value = Math.max(.05, num('sunSize', 1)); U.uGlowSize.value = Math.max(.05, num('glowSize', 1));
    U.uGlow.value = Math.max(0, num('glowStrength', 1)); U.uFlare.value = Math.max(0, num('flare', .55));
    U.uGrain.value = Math.max(0, num('skyGrain', .55)); U.uBright.value = B;
    U.uSkyClouds.value = noise ? Math.max(0, num('skyClouds', .8)) : 0; U.uCloudSea.value = noise ? Math.max(0, num('cloudSea', 1)) : 0;
    U.uDrift.value = num('cloudDrift', 1);
    const dt = last === null ? 0 : THREE.MathUtils.clamp(time - last, 0, .1); last = time;
    if (!reduceMotion) clock += dt;
    U.uTime.value = clock;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    // Air ice.
    pUniforms.uTime.value = reduceMotion ? 0 : clock;
    pUniforms.uAmount.value = Math.max(0, num('particles', 1));
    pUniforms.uCam.value.copy(camera.position);
    pUniforms.uPixel.value = (globalThis.innerHeight || 900) / 900 * Math.min(dpr, 2);
    pUniforms.uBright.value = B; col('shadowColor', '#7b93c4', pUniforms.uShade.value);
    particles.visible = pUniforms.uAmount.value > .001;
  }
  function dispose() {
    if (disposed) return; disposed = true;
    particles.removeFromParent(); pGeometry.dispose(); pMaterial.dispose(); skyMaterial.dispose();
    fill.removeFromParent(); fill.target.removeFromParent(); fill.dispose();
  }
  return { update, dispose, sky: skyMaterial, particles, fill, sunDirection: sunDir, uniforms: skyUniforms, get phase() { return phase; } };
}
