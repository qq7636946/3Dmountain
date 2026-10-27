/* index1-5 · 開場世界 Opening world (2026-10-23, visual director; client: 「山谷那段為主，整體的色調設計風格都調整跟山谷一樣」).
   Chapters 1–2 (KNOWLEDGE / INNOVATION) stand in the valley's light instead of a grey studio:
   · the same sky (cobalt above, the valley's pale haze at eye level) — CONFIG.field, set in opening-world-build.cjs;
   · the same sun: the room's core light becomes a low warm sun up-left (azimuth/elevation in the valley's convention:
     0 = straight ahead down −Z, negative = left), and through the cross-fade into chapter 3 it slides onto the screen
     position of the valley's own sun, so the light never jumps;
   · a distant range on the horizon: a band baked from the valley's own render (assets/opening-range.webp, made by
     opening-range-make.cjs) sampled INSIDE montisEnv(), so the backdrop draws it, the sea mirrors it, every drop
     reflects it and the PMREM probe bakes it — one texture lookup, no extra pass;
   · the sea tinted toward the valley's glacier water, warm glints, warm light motes like the valley's ice dust.
   The camera and framing are untouched (?opencam=valley offers the valley's camera only for review).
   This file is copied by build.cjs into prototypes/index1-5-morning-20261026/js/ (edit the copy in prototypes/index1-5-morning-20261026/, then rebuild). */
import * as THREE from 'three';
import { createLightSpecks } from './light-specks.js';

export const OPENING_WORLD_DEFAULTS = {
  sunAzimuth: -18, sunElevation: 11, sunColor: '#ffd6a8', sunStrength: 1.2, sunDisc: 2.4, sunSharp: 22000, goldHorizon: .2, goldHeight: 9,
  glintColor: '#ffe2c4', glintStrength: .74,
  follow: 1,
  rangeOpacity: .9, rangeHeight: 9, rangeWidth: 40, rangeAzimuth: 5, rangeLift: 0, rangeHaze: .13, rangeSoft: .35,
  seaTint: '#4f818f', seaTintAmount: .5,
  motes: .42, moteColor: '#ffe7c9', glintTint: '#ffd9ab',
  hemiSky: '#cfe0f4', hemiGround: '#2f5566'
};

/* [label, 'openingWorld' | other CONFIG group, key, min, max, step]; colour rows have no range. */
export const OPENING_WORLD_ROWS = [
  ['天空 畫面上緣', 'field', 'top'], ['天空 地平線霧', 'field', 'horizon'],
  ['水珠倒影 天頂', 'field', 'zenith'], ['水珠倒影 上方', 'field', 'upper'],
  ['湖面倒影 近地平線', 'field', 'lower'], ['湖面倒影 深處', 'field', 'floor'], ['墨色（最暗）', 'field', 'ink'],
  ['太陽 方位（度，負＝左）', 'openingWorld', 'sunAzimuth', -80, 40, 1], ['太陽 高度（度）', 'openingWorld', 'sunElevation', 0, 40, .5],
  ['太陽 顏色', 'openingWorld', 'sunColor'], ['太陽 強度', 'openingWorld', 'sunStrength', 0, 3, .01],
  ['太陽 圓盤亮度', 'openingWorld', 'sunDisc', 0, 8, .05], ['太陽 圓盤銳利', 'openingWorld', 'sunSharp', 1000, 80000, 100],
  ['地平線金光 強度', 'openingWorld', 'goldHorizon', 0, 2, .01], ['地平線金光 貼地（大＝薄）', 'openingWorld', 'goldHeight', 1, 40, .5],
  ['太陽 光核', 'field', 'core', 0, 6, .05], ['太陽 光暈範圍', 'field', 'coreSpread', .2, 3, .02],
  ['反光 顏色（碎光、水珠高光）', 'openingWorld', 'glintColor'], ['反光 強度', 'openingWorld', 'glintStrength', 0, 2, .01],
  ['交接 太陽對準山谷太陽', 'openingWorld', 'follow', 0, 1, .01],
  ['遠山 不透明', 'openingWorld', 'rangeOpacity', 0, 1, .01], ['遠山 高度（度）', 'openingWorld', 'rangeHeight', 1, 25, .1],
  ['遠山 寬度（度）', 'openingWorld', 'rangeWidth', 8, 120, .5], ['遠山 方位（度）', 'openingWorld', 'rangeAzimuth', -40, 40, .5],
  ['遠山 抬高（度）', 'openingWorld', 'rangeLift', -5, 10, .05], ['遠山 霧化', 'openingWorld', 'rangeHaze', 0, 1, .01],
  ['遠山 柔焦', 'openingWorld', 'rangeSoft', 0, 4, .05],
  ['湖面 色調', 'openingWorld', 'seaTint'], ['湖面 色調強度', 'openingWorld', 'seaTintAmount', 0, 1, .01],
  ['湖面 近處壓暗', 'sea', 'edge', 0, 1, .01], ['湖面 霧距（近）', 'sea', 'haze', 5, 150, 1], ['湖面 霧距（遠）', 'sea', 'hazeFar', 20, 400, 1],
  ['空氣 光點量', 'openingWorld', 'motes', 0, 1.5, .01], ['空氣 光點顏色', 'openingWorld', 'moteColor'],
  ['水面 碎光量', 'details', 'waterGlints', 0, 1, .01], ['水面 碎光顏色', 'openingWorld', 'glintTint'],
  ['天光 顏色（上）', 'openingWorld', 'hemiSky'], ['天光 顏色（下）', 'openingWorld', 'hemiGround'],
  ['四角壓暗（1 不壓）', 'openingDrops', 'veil', 0, 1, .01]
];

/* A transparent texel, so every shader compiles and samples nothing until the band has loaded. */
export const OPENING_RANGE_BLANK = (() => { const t = new THREE.DataTexture(new Uint8Array([203, 216, 230, 255]), 1, 1); t.needsUpdate = true; return t; })();

/* The GLSL that samples the band lives in opening-world-build.cjs (it is spliced into MONTIS_ENV_GLSL there). */

const _c = new THREE.Color();
const lin = hex => { _c.set(hex); return new THREE.Vector3(_c.r, _c.g, _c.b); };
const smooth = x => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const RAD = Math.PI / 180;

export function createOpeningWorld({ uniforms, config, renderer, palette = (hex, v) => { const c = new THREE.Color(hex); return v.set(c.r,c.g,c.b); }, keyLight, hemiLight, airMotes, waterGlints, rebake, rangeUrl, surface = null }) {
  const lightSpecks = createLightSpecks({points:airMotes,surface,getConfig:()=>config.lightSpecks,small:Math.min(innerWidth,innerHeight)<700,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  // TEMP_RANGE_BACKGROUND_PAUSED: 暫停主頁的遠山背景圖；保留 opening-range.webp／0.webp 原檔，移除此暫停即可還原。
  const rangeBackgroundPaused = !!globalThis.document?.documentElement?.matches?.('[data-look="index1-5"]:not([data-opening-refinement])');
  const W = () => config.openingWorld;
  const hero = new THREE.Vector3(), dir = new THREE.Vector3(), q = new THREE.Vector3(), cp = new THREE.Vector3(), sd = new THREE.Vector3(), f = new THREE.Vector3();
  let sunLight = null, band = null, lastProbeHour = -100, keyWasAutomatic = false;
  const originalKeyPosition = keyLight?.position.clone(), originalHemiIntensity = hemiLight?.intensity;
  const fields = [['zenith','uEnvZenith'],['upper','uEnvUpper'],['top','uEnvField'],['horizon','uEnvHorizon'],['lower','uEnvLower'],['floor','uEnvFloor'],['ink','uEnvInk']];
  if (!rangeBackgroundPaused) new THREE.TextureLoader().load(rangeUrl, tex => {
    tex.colorSpace = THREE.NoColorSpace;   /* colour decoded in the shader; the lower half is alpha data */
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    tex.needsUpdate = true;
    band = tex; uniforms.uEnvRangeTex.value = tex;
    apply(); rebake();
  }, undefined, () => console.warn('index1-5 opening world: the distant range band did not load; the horizon stays clear.'));

  function heroDir(target) {
    const az = W().sunAzimuth * RAD, el = W().sunElevation * RAD;
    return target.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  }
  /* Everything the tuner can change; applyConfig() calls this, before the probe is re-baked. */
  function apply() {
    const C = W();
    const glow = lin(C.glintColor).multiplyScalar(C.glintStrength);
    uniforms.uEnvGlow.value.copy(glow);
    const sun = lin(C.sunColor).multiplyScalar(C.sunStrength);
    uniforms.uEnvSunTint.value.set(sun.x / Math.max(glow.x, 1e-3) - 1, sun.y / Math.max(glow.y, 1e-3) - 1, sun.z / Math.max(glow.z, 1e-3) - 1);
    uniforms.uEnvCoreDir.value.copy(heroDir(hero));
    uniforms.uEnvSunDisc.value.set(C.sunDisc, C.sunSharp, C.goldHorizon, C.goldHeight);
    const half = Math.max(1, C.rangeWidth) * .5 * RAD;
    uniforms.uEnvRangeA.value.set(band ? C.rangeOpacity : 0, C.rangeHaze, Math.tan(half), C.rangeAzimuth * RAD);
    const B = uniforms.uEnvRangeB.value;
    B.y = Math.max(.2, C.rangeHeight) * RAD; B.z = 1 / Math.max(config.scene.exposure, 1e-3); B.w = C.rangeSoft;
    if (!B.x) B.x = -2 * RAD;
    const tint = lin(C.seaTint);
    uniforms.uOpenSeaTint.value.set(tint.x, tint.y, tint.z, C.seaTintAmount);
    if (keyLight) keyLight.color.set(C.sunColor);
    if (hemiLight) { hemiLight.color.set(C.hemiSky); hemiLight.groundColor.set(C.hemiGround); }
    if (airMotes) airMotes.material.uniforms.uColor.value.set(C.moteColor);
    if (waterGlints) waterGlints.material.uniforms.uColor.value.set(C.glintTint);
  }
  /* Every frame, after the cameras have moved. MIX is the cross-fade into the valley (0 opening … 1 valley). */
  function update({ camera, canyon, mix, screenDown, portal }) {
    const C = W();
    const D = globalThis.__SCENE_DAYLIGHT__;
    lightSpecks.update({time:airMotes.material.uniforms.uTime.value,camera,screenDown,opacity:(1-mix)*Math.max(0,C.motes/.42)*(1-.65*(portal?.state.riverness||0))});
    apply();
    for (const [key, name] of fields) palette(config.field[key], uniforms[name].value);
    // Preserve the opening's actual dawn palette before the later world section
    // suppresses the daylight clock and restores its manual colours.
    if (!globalThis.__FINNOVATION_OPENING_LOOK__ && D?.enabled && D.hour <= 6.26 && mix < .01) {
      globalThis.__FINNOVATION_OPENING_LOOK__ = { field: { ...config.field }, world: { ...C }, view: { veil: config.openingDrops?.veil ?? .14, fov: config.camera.fov } };
    }
    if (D?.enabled) {
      keyWasAutomatic = true;
      if (keyLight) { keyLight.position.copy(D.sunDirection).multiplyScalar(40); keyLight.intensity = D.intensity * .55; }
      if (hemiLight) hemiLight.intensity = .6 + .25 * D.daylight;
      // Analytic glass reflections update every frame. The physical IBL is refreshed only after meaningful change,
      // via the existing debounced queue; never run a PMREM pass on every scroll frame.
      if (mix < .99 && Math.abs(D.hour - lastProbeHour) > .3) { lastProbeHour = D.hour; rebake(); }
    } else if (keyWasAutomatic) {
      keyWasAutomatic = false;
      if (keyLight) { keyLight.position.copy(originalKeyPosition); keyLight.intensity = config.scene.keyLight; }
      if (hemiLight) hemiLight.intensity = originalHemiIntensity;
    }
    /* The band stands on the sea line the viewer sees, which the opening sea draws SCREEN DOWN pixels under the true
       horizon (CONFIG.sea.screenDown): find the elevation that lands there in this camera, every frame (the push into
       the valley changes the lens). */
    camera.getWorldPosition(cp);
    camera.getWorldDirection(f); f.y = 0;
    if (f.lengthSq() > 1e-6) {
      f.normalize();
      q.copy(cp).addScaledVector(f, 1e4).project(camera);
      q.y -= 2 * (screenDown || 0) / Math.max(1, innerHeight); q.z = .5;
      q.unproject(camera).sub(cp).normalize();
      uniforms.uEnvRangeB.value.x = Math.asin(Math.max(-1, Math.min(1, q.y))) + C.rangeLift * RAD;
    }
    heroDir(hero);
    let w = 0;
    uniforms.uOpenSeaTint.value.w = C.seaTintAmount * (1 - (portal?.state.riverness || 0));
    if (portal?.state.active) {
      /* one camera move: the sun turns into the valley's sun as seen from the cut pose (the card holds that exact sky) */
      q.copy(portal.bake.sunDirO); w = smooth(portal.state.s / .85) * Math.min(1, C.follow);
    } else if (canyon && mix > .0005 && C.follow > 0) {
      if (!sunLight) canyon.scene.traverse(o => { if (!sunLight && o.isDirectionalLight) sunLight = o; });
      if (sunLight) {
        sd.copy(sunLight.position).sub(sunLight.target.position).normalize();
        canyon.camera.getWorldDirection(f);
        if (sd.dot(f) > -.2) {   /* the valley's sun in front of its camera (on screen or just off it) */
          canyon.camera.getWorldPosition(q);
          q.addScaledVector(sd, 50).project(canyon.camera);
          q.z = .5; q.unproject(camera).sub(cp).normalize();
          w = smooth(mix / .6) * Math.min(1, C.follow);
        }
      }
    }
    dir.copy(hero);
    if (w > 0) dir.lerp(q, w).normalize();
    uniforms.uEnvCoreDir.value.copy(dir);
  }
  return { apply, update, lightSpecks, get ready() { return rangeBackgroundPaused || !!band; } };
}
