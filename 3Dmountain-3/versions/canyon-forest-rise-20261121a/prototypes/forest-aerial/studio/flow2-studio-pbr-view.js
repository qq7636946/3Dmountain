import * as THREE from 'three';
import { createForestFlow } from '../flow2-scene-flow.js?v=pbr-01-perf1';
import { createForestBirds } from '../flow2-scene-birds.js?v=timed-passes1';
import { createRiverBeams } from '../flow2-river-beams.js?v=studio-confluence-20261121-1-perf1';
import { createStudioTerrainPbrLayer } from './studio-terrain-pbr-layer.js?v=sward-colors2-rise3-perf2-ktx2-clouds2';
import { bindAtmosphereArrival } from './studio-highland-ecology.js?v=weather1';
import { createTributaryNetwork } from './studio-tributary-network.js?v=meadow-riffles1';
import { createStudioCartography } from './studio-cartography.js?v=strategy-beacons-20261121-2-perf1';
import { createStudioLightCurtain } from './studio-light-curtain.js?v=confluence-20261121-1';
import { createStudio3DLines } from './studio-3d-lines.js?v=ln3';

const CLOCK = 10.18;
const CAMERA = { entryAzimuth: 70.31, azimuth: 323.44, tilt: 64.547, distance: 13.028, fov: 29.1, tx: .23, tz: .14, arrivalSeconds: 4.1 };
const PBR = {
  style: 1, grassSat: 1.26, grassCoverage: 63, grassTuftCount: 4800, grassPbr: .79,
  grassColor: '#346b5d', grassTipColor: '#8e9a89', grassMossColor: '#405a39', grassDryColor: '#adadad',
  grassMossCoverage: 45, grassDryCoverage: 62, grassTipCoverage: 64, rockColor: '#454f63', rockLayerColor: '#b4b5bb',
  rockSlope: .88, biomeContrast: 1.04, cavityDepth: .48, strataStrength: 1, shoreWet: 1.12, relief: 1.5,
  waterDeep: '#0a182c', waterShallow: '#264468', waterSpeed: 1.1, waterWave: 1.48, waterClear: .94, whitewater: 1, waterGlow: .88,
  sunIntensity: 1.36, sunShadow: .6, sunRays: .39, sunAzimuth: 62, sunElevation: 24,
  mist: .2, cloudStrength: .22, valleyMist: .13, mistHeight: .27, contourOpacity: 0, contourInterval: .04,
  cloudShadow: .9, mistColor: '#dfe6ec', airWhite: .5,   /* 2026-11-21 (client: 「雲霧要白一點」「雲霧反射出來的影子在山谷上也要做出」) */
  layers: { tributaries: true, contours: false, terrainStyle: true, water: true, sunbeams: true, atmosphere: true, clouds: true, gulls: true }
};
const CURTAIN = {
  enabled: true, showTributaries: true, showLogo: true, height: .68, speed: .3, brightness: .6, progress: 1,   /* client's values 2026-11-20 (垂直光幕與中央LOGO 初始參數) */
  scanIntensity: 1.2, pulseStrength: .9, color: '#88ccf8', contactColor: '#d9f2ff', logoScale: 1.4, logoHeight: 1.26, logoRotation: 326
};
/* 2026-11-21 (client: 「雲霧要白一點 或是開顏色調整參數給我」): the clouds' and valley banks' colours (studio-clouds.js uniforms).
   Before: lit #f8f7f1, shade #a2afba, brightness 1, contrast 1. */
const CLOUD_LOOK = { lit: '#ffffff', shade: '#e1e8ee', bright: 1.18, contrast: .85 };
const { clamp, degToRad, euclideanModulo, lerp, smoothstep, smootherstep } = THREE.MathUtils;

const ROWS = [
  ['— 鏡頭與進場 —'],
  ['進場方位（度）', 'camera.entryAzimuth', 0, 360, .01],
  ['定鏡方位（度）', 'camera.azimuth', 0, 360, .01],
  ['傾角（度）', 'camera.tilt', 1, 84, .001],
  ['鏡頭距離', 'camera.distance', 4, 25, .001],
  ['視野 FOV（度）', 'camera.fov', 10, 50, .1],
  ['注視點 X', 'camera.tx', -5, 5, .01], ['注視點 Z', 'camera.tz', -2.8, 2.8, .01],
  ['蔓延時間（秒）', 'camera.arrivalSeconds', 1.5, 10, .1],
  ['— 草坡、岩壁與河岸 —'],
  ['草地覆蓋率（％）', 'pbr.grassCoverage', 0, 100, 1],
  ['草地飽和度', 'pbr.grassSat', .2, 2, .01], ['草地材質強度', 'pbr.grassPbr', 0, 1.6, .01],
  ['草地底色', 'pbr.grassColor', 'color'], ['草尖', 'pbr.grassTipColor', 'color'],
  ['濕苔', 'pbr.grassMossColor', 'color'], ['枯草', 'pbr.grassDryColor', 'color'],
  ['草尖範圍（％）', 'pbr.grassTipCoverage', 0, 100, 1],
  ['濕苔範圍（％）', 'pbr.grassMossCoverage', 0, 100, 1],
  ['枯草範圍（％）', 'pbr.grassDryCoverage', 0, 100, 1],
  ['岩石底色', 'pbr.rockColor', 'color'], ['岩層顏色', 'pbr.rockLayerColor', 'color'],
  ['岩坡分界', 'pbr.rockSlope', .45, .98, .01], ['地貌對比', 'pbr.biomeContrast', 0, 1.8, .01],
  ['凹處深度', 'pbr.cavityDepth', 0, 1, .01], ['岩層強度', 'pbr.strataStrength', 0, 1.4, .01],
  ['河岸濕潤感', 'pbr.shoreWet', 0, 1.8, .01], ['地形起伏', 'pbr.relief', .65, 2, .01],
  ['— 河流與湖面 —'],
  ['深水色', 'pbr.waterDeep', 'color'], ['淺水色', 'pbr.waterShallow', 'color'],
  ['水流速度', 'pbr.waterSpeed', 0, 3, .01], ['水波強度', 'pbr.waterWave', .1, 2.5, .01],
  ['水面清澈度', 'pbr.waterClear', 0, 1.3, .01], ['白浪強度', 'pbr.whitewater', 0, 1.5, .01],
  ['水面光幕倒映', 'pbr.waterGlow', 0, 1.6, .01],
  ['— 陽光、雲與霧 —'],
  ['太陽亮度', 'pbr.sunIntensity', .2, 2.2, .01], ['山影強度', 'pbr.sunShadow', 0, 1.2, .01],
  ['陽光光束', 'pbr.sunRays', 0, 1.2, .01], ['太陽方位（度）', 'pbr.sunAzimuth', 0, 360, 1],
  ['太陽仰角（度）', 'pbr.sunElevation', 3, 85, 1],
  ['遠景霧', 'pbr.mist', 0, 1.2, .01], ['雲層強度', 'pbr.cloudStrength', 0, .6, .01],
  ['谷底霧', 'pbr.valleyMist', 0, 1.2, .01], ['霧層高度', 'pbr.mistHeight', .1, 1.8, .01],
  ['— 雲霧顏色與雲影 —'],
  ['雲亮面顏色', 'cloudLook.lit', 'color'], ['雲暗面顏色', 'cloudLook.shade', 'color'],
  ['雲霧亮度', 'cloudLook.bright', .4, 1.8, .01], ['雲霧立體感', 'cloudLook.contrast', .2, 2, .01],
  ['谷底霧顏色', 'pbr.mistColor', 'color'], ['遠景霧白度', 'pbr.airWhite', 0, 1, .01, 'percent'],
  ['雲影濃度（投在山谷）', 'pbr.cloudShadow', 0, 1, .01, 'percent'],
  ['— 左側雲霧 —'],
  ['左側雲霧', 'leftFog.enabled', 'checkbox'], ['濃度', 'leftFog.density', 0, 2, .01, 'percent'],
  ['水平範圍', 'leftFog.scale', .35, 1.8, .01, 'percent'], ['厚度', 'leftFog.thickness', .25, 2, .01, 'percent'],
  ['位置 X', 'leftFog.x', -2.5, 2.5, .01], ['高度偏移', 'leftFog.y', -1.2, 1.4, .01], ['位置 Z', 'leftFog.z', -2.5, 2.5, .01],
  ['— 垂直光幕與中央 LOGO —'],
  ['垂直光幕', 'curtain.enabled', 'checkbox'], ['支流光幕', 'curtain.showTributaries', 'checkbox'],
  ['中央 LOGO', 'curtain.showLogo', 'checkbox'],
  ['光幕高度', 'curtain.height', .1, 1.8, .02], ['流動速度', 'curtain.speed', 0, 1.5, .02],
  ['光幕亮度', 'curtain.brightness', 0, 2, .02], ['路線進度（uProgress）', 'curtain.progress', 0, 1, .01, 'percent'],
  ['測繪掃描格線', 'curtain.scanIntensity', 0, 1.2, .01, 'percent'], ['流光脈衝強度', 'curtain.pulseStrength', 0, 2, .01],
  ['中央 LOGO 大小', 'curtain.logoScale', .4, 3.5, .05], ['LOGO 光牆高度', 'curtain.logoHeight', 0, 1.4, .02],
  ['LOGO 旋轉角度', 'curtain.logoRotation', 0, 360, 1],
  ['光幕色', 'curtain.color', 'color'], ['貼地底線', 'curtain.contactColor', 'color'],
  ['— 3D Line 地形線條 —'],
  ['3D Line 線條', 'lines3d.enabled', 'checkbox'], ['線條不透明度', 'lines3d.opacity', 0, 1, .01, 'percent'],
  ['地形線色', 'lines3d.color', 'color'], ['水域線色', 'lines3d.accentColor', 'color'],
  ['— 圖層與標籤 —'],
  ['河流光束', 'riverBeams.on', 'checkbox'],
  ['支流', 'pbr.layers.tributaries', 'checkbox'], ['等高線', 'pbr.layers.contours', 'checkbox'],
  ['等高線透明度', 'pbr.contourOpacity', 0, .8, .01], ['等高線間距', 'pbr.contourInterval', .04, .22, .005],
  ['動態水面', 'pbr.layers.water', 'checkbox'], ['陽光光束', 'pbr.layers.sunbeams', 'checkbox'],
  ['空氣透視', 'pbr.layers.atmosphere', 'checkbox'], ['山嶺雲層', 'pbr.layers.clouds', 'checkbox'],
  ['海鷗', 'pbr.layers.gulls', 'checkbox'], ['投資策略標籤', 'cartography.labels', 'checkbox']
];

function registerControls(tune, { studio, curtain, cartography, lines3d, floatingLogo, applyRouteProgress, applyBeamOutline, applyLeftFog, applyCloudLook }) {
  const panel = window.__FLOW2_PANEL__?.add({
    id: 'rise-studio-pbr', storageId: 'rise-studio-pbr-preset-2', title: '俯視山谷 PBR', key: 'p', tune,
    rows: [...(tune.riverBeams ? ROWS : ROWS.filter(row => row[1] !== 'riverBeams.on')),
      ...(tune.riverBeams?.filaments !== undefined ? [['— 河道流光設計 —'],
        ['河流整體亮度', 'riverBeams.bright', 0, 2, .01], ['核心光線寬度', 'riverBeams.coreWidth', .4, 3, .05],
        ['柔光強度', 'riverBeams.halo', 0, 2, .01], ['柔光寬度', 'riverBeams.haloWidth', 2, 24, .5],
        ['水面散光', 'riverBeams.wide', 0, 2, .01], ['流光速度', 'riverBeams.speed', 0, 3, .01],
        ['流光間距', 'riverBeams.spacing', .5, 5, .05], ['流光尾長', 'riverBeams.packetLength', .4, 1.8, .02],
        ['流光強度', 'riverBeams.pulse', 0, 2.5, .01], ['雙股細光絲', 'riverBeams.filaments', 0, 2, .01],
        ['水面星點密度', 'riverBeams.sparkDensity', 0, .6, .01, 'percent'], ['水面星點亮度', 'riverBeams.glint', 0, 2.5, .01],
        ['支流亮度', 'riverBeams.tribBright', 0, 1.2, .01], ['高光上限', 'riverBeams.softClip', .5, 2.5, .05],
        ['河流核心色', 'riverBeams.colour', 'color'], ['河流柔光色', 'riverBeams.glow', 'color']] : []),
      ...(tune.cartography.beacons ? [['— 四大策略光幕與亮點 —'],
        ['策略光幕開關', 'cartography.beacons.enabled', 'checkbox'],
        ['光幕高度', 'cartography.beacons.height', .25, 1.4, .01], ['光幕寬度倍率', 'cartography.beacons.width', .5, 2, .01],
        ['光幕亮度', 'cartography.beacons.brightness', 0, 2, .01], ['上升細光絲', 'cartography.beacons.filaments', 0, 2, .01],
        ['底部光環', 'cartography.beacons.halo', 0, 2, .01], ['策略光幕色', 'cartography.beacons.color', 'color'],
        ['浮升亮點開關', 'cartography.beacons.particles', 'checkbox'], ['每柱亮點數量', 'cartography.beacons.count', 0, 48, 1],
        ['亮點大小', 'cartography.beacons.particleSize', .4, 2, .01], ['亮點亮度', 'cartography.beacons.particleBrightness', 0, 2.5, .01],
        ['光絲與亮點流速', 'cartography.beacons.speed', 0, 1.5, .01]] : []),
      ...(tune.floatingLogo ? [['— 光幕上方 3D LOGO —'], ['3D LOGO 開啟／關閉', 'floatingLogo.enabled', 'checkbox'],
        ['左右位置 X', 'floatingLogo.offsetX', -3, 3, .01], ['上下位置 Y', 'floatingLogo.offsetY', -2, 3, .01],
        ['前後位置 Z', 'floatingLogo.offsetZ', -3, 3, .01],
        ['LOGO 高度', 'floatingLogo.height', .3, 2.5, .01], ['離光幕頂端', 'floatingLogo.gap', 0, 1.5, .01],
        ['模型厚度倍率', 'floatingLogo.depth', .2, 3, .01],
        ['水平角度（度）', 'floatingLogo.yaw', -180, 180, 1], ['前後傾斜（度）', 'floatingLogo.pitch', -80, 80, 1],
        ['左右傾斜（度）', 'floatingLogo.roll', -90, 90, 1],
        ['循環旋轉開關', 'floatingLogo.rotate', 'checkbox'], ['反向旋轉', 'floatingLogo.reverse', 'checkbox'],
        ['旋轉一圈（秒）', 'floatingLogo.period', 6, 40, .5],
        ['— 3D LOGO 玻璃與光線 —'], ['整體顯示濃度', 'floatingLogo.opacity', 0, 1, .01],
        ['玻璃透光', 'floatingLogo.transmission', 0, 1, .01], ['表面霧度', 'floatingLogo.roughness', 0, .6, .005],
        ['折射厚度', 'floatingLogo.volume', 0, 2, .01], ['折射率', 'floatingLogo.ior', 1, 2.33, .01],
        ['彩色邊光', 'floatingLogo.dispersion', 0, 3, .01], ['環境反射', 'floatingLogo.envIntensity', 0, 4, .01],
        ['邊緣亮度', 'floatingLogo.rimStrength', 0, 8, .05], ['水紋焦散', 'floatingLogo.caustic', 0, 3, .01],
        ['玻璃底色', 'floatingLogo.tint', 'color'], ['品牌藍濃度', 'floatingLogo.brandBlue', 0, 1, .01],
        ['品牌藍顏色', 'floatingLogo.brandBlueColor', 'color'], ['主光亮度', 'floatingLogo.light', 0, 5, .05],
        ['高光上限', 'floatingLogo.maxBright', .3, 3, .05]] : [])],
    onChange(key) {
      if (key.startsWith('pbr.')) studio.apply();
      else if (key.startsWith('curtain.')) {
        curtain.apply();
        studio.syncCurtain();
        if (key === 'curtain.logoScale' || key === 'curtain.logoRotation') applyBeamOutline();
      }
      else if (key.startsWith('cartography.')) cartography.apply();
      else if (key.startsWith('lines3d.')) lines3d.apply();
      else if (key.startsWith('leftFog.')) applyLeftFog();
      else if (key.startsWith('cloudLook.')) applyCloudLook();
      else if (key.startsWith('floatingLogo.')) floatingLogo?.apply();
      applyRouteProgress(key === 'curtain.progress');
    },
    displayValue: key => key === 'curtain.progress' ? curtain.uniforms.uProgress.value : undefined,
    serialize() {
      const { entryAzimuth, azimuth, tilt, distance, fov, tx, tz, arrivalSeconds } = tune.camera;
      const position = new THREE.Vector3().setFromSphericalCoords(distance, degToRad(tilt), degToRad(azimuth))
        .add(new THREE.Vector3(tx, .105, tz)).toArray().map(v => +v.toFixed(3));
      return {
        view: 'topdown-studio-pbr', clock: CLOCK, azimuth, tilt, distance, fov,
        target: [tx, tz], position, window: [innerWidth, innerHeight],
        pbr: tune.pbr, cartography: tune.cartography, curtain: tune.curtain, entryAzimuth, arrivalSeconds,
        riverBeams: !!tune.riverBeams?.on,
        ...(tune.riverBeams?.filaments !== undefined ? { riverDesign: Object.fromEntries(
          ['on', 'bright', 'coreWidth', 'halo', 'haloWidth', 'wide', 'speed', 'spacing', 'packetLength', 'pulse',
            'filaments', 'sparkDensity', 'glint', 'tribBright', 'softClip', 'colour', 'glow'].map(key => [key, tune.riverBeams[key]])) } : {}),
        leftFog: tune.leftFog, cloudLook: tune.cloudLook, floatingLogo: tune.floatingLogo,
        lines3d: { enabled: !!tune.lines3d.enabled, opacity: tune.lines3d.opacity, color: tune.lines3d.color, accentColor: tune.lines3d.accentColor }
      };
    }
  });
  // The panel restores saved values synchronously on registration.
  curtain.apply();
  studio.apply();
  cartography.apply();
  lines3d.apply();
  applyBeamOutline();
  applyLeftFog();
  applyCloudLook();
  floatingLogo?.apply();
  return panel;
}

export async function createStudioPbrView(renderer, atlas, { reducedMotion, query, labels }) {
  const rhythm = window.__RISE_RHYTHM__;
  const logoExperiment = document.documentElement.hasAttribute('data-rise-floating-logo');
  const legacyMist = atlas.scene.getObjectByName('Forest legacy mist');
  if (legacyMist) legacyMist.visible = false;
  atlas.studioHydrology = createTributaryNetwork(atlas);
  const [studio, flow] = await Promise.all([
    createStudioTerrainPbrLayer(renderer, atlas, PBR),
    query.get('wflow') === '0' ? null : createForestFlow(renderer, { reducedMotion, atlas })
  ]);
  if (!studio.terrainPatched) throw new Error('Studio PBR terrain could not be applied');
  const [curtain, beams] = await Promise.all([
    createStudioLightCurtain(atlas, { ...CURTAIN, refinedRivers: logoExperiment }),
    createRiverBeams(renderer, { atlas, reducedMotion, refined: logoExperiment, panel: false, suppressFlowCurrent: false, tune: { on: true } })
      .catch(error => { console.warn('Rise river beams:', error); return null; })
  ]);
  studio.bindCurtain(curtain);
  if (flow) atlas.scene.add(flow.group);
  if (beams) atlas.scene.add(beams.group);
  const lines3d = createStudio3DLines(atlas, { studio, parts: { flow } }, { enabled: true });
  const cartography = createStudioCartography(atlas, studio, atlas.camera, {
    ...labels, compactLeaders: logoExperiment, enhancedBeacons: logoExperiment, curtain, reducedMotion
  });
  beams?.setFocus(cartography.focus);
  const floatingLogo = logoExperiment && query.get('floatingLogo') !== '0' ?
    await import('./studio-floating-logo.js?v=20261121-3-perf1')
      .then(module => module.createStudioFloatingLogo(renderer, atlas, curtain, { reducedMotion, query }))
      .catch(error => { console.warn('Confluence logo could not load:', error); return null; }) : null;
  bindAtmosphereArrival(atlas, studio.uniforms);

  const framing = { ...CAMERA };
  const leftFog = { enabled: true, density: 1, scale: 1, thickness: 1, x: 0, y: 0, z: 0 };
  const applyLeftFog = () => {
    const U = studio.mistGroup.material.uniforms;
    U.uLeftFog.value.set(leftFog.enabled ? leftFog.density : 0, leftFog.scale, leftFog.thickness);
    U.uLeftFogOffset.value.set(leftFog.x, leftFog.y, leftFog.z);
  };
  const cloudLook = { ...CLOUD_LOOK }, cloudColour = new THREE.Color();
  const applyCloudLook = () => {
    const U = studio.mistGroup.material.uniforms;
    if (!U.uCloudLit) return;
    cloudColour.set(cloudLook.lit); U.uCloudLit.value.set(cloudColour.r, cloudColour.g, cloudColour.b);
    cloudColour.set(cloudLook.shade); U.uCloudShade.value.set(cloudColour.r, cloudColour.g, cloudColour.b);
    U.uCloudTone.value.set(clamp(+cloudLook.bright || 0, 0, 3), clamp(+cloudLook.contrast || 0, 0, 3));
  };
  const outlinePoint = new THREE.Vector3();
  const applyBeamOutline = () => {
    const logo = curtain.logo;
    if (!beams || !logo?.outlines.length) return;
    logo.group.updateWorldMatrix(true, false);
    const world = logo.group.matrixWorld;
    beams.setLogoOutline(logo.outlines.map(ring => ring.map(([x, z]) => {
      outlinePoint.set(x, 0, z).applyMatrix4(world);
      return [outlinePoint.x, outlinePoint.z];
    })));
  };
  const aim = new THREE.Vector3();
  const orbit = new THREE.Spherical();
  const pointer = new THREE.Vector2();
  const sway = new THREE.Vector2();
  if (rhythm) framing.arrivalSeconds = rhythm.tune.arrivalSeconds;
  let advance = reducedMotion ? 1 : 0;
  let routeAdvance = advance, routeVisibility = 1;
  let routePreview = false, lastRoutePercent = -1;
  /* RISE HOOK (transition master, 2026-11-20). Read only while rise.js has set window.__RISE_MASTER__ (the original stroke hand-over on the rise page);
     without it everything below is exactly as before.
     - the rivers' light, the curtains and the ring's column wait for the colour (client: 「一轉過去時候 怎麼光束先出來了」): their clock starts only when the
       colour has grown to lightAt, and takes lightSeconds;
     - the 3D lines withdraw once the lens has settled (client: 「轉到定位後 3Dline就退掉」), over lineOut seconds, and are back at once when the view is left. */
  const master = () => window.__RISE_MASTER__?.tune || null;
  let lineKeep = 1, lineShown = NaN;
  function applyLineKeep(k) {
    const U = lines3d.lineMesh?.material?.uniforms?.uAlpha; if (!U) return;
    const base = clamp(+lines3d.config.opacity || 0, 0, 2), on = !!lines3d.config.enabled && k > .003;
    U.value = base * k; if (lines3d.group.visible !== on) lines3d.group.visible = on;
    lineShown = k; state.lines = k;
  }
  const state = { clock: CLOCK, azimuth: reducedMotion ? framing.azimuth : framing.entryAzimuth, arrival: advance, routeProgress: advance };
  studio.uniforms.uArrival.value = state.arrival;
  function applyRouteProgress(preview = false) {
    routePreview ||= preview;
    const target = clamp(curtain.config.progress, 0, 1);
    const progress = routePreview ? target : target * smoothstep(routeAdvance, 0, 1) * routeVisibility;
    state.routeProgress = progress;
    curtain.uniforms.uProgress.value = progress;
    studio.uniforms.uCurtainLogo.value.w = progress;
    studio.uniforms.uCurtainGlow.value = curtain.config.enabled ? curtain.config.brightness * smoothstep(progress, 0, 1) : 0;
    const percent = Math.round(progress * 100);
    if (percent !== lastRoutePercent) {
      lastRoutePercent = percent;
      panel?.refresh('curtain.progress');
    }
  }
  const panel = registerControls({
    camera: framing, pbr: studio.config, curtain: curtain.config, cartography: cartography.config,
    riverBeams: beams?.tune, lines3d: lines3d.config, leftFog, cloudLook, floatingLogo: floatingLogo?.config
  }, { studio, curtain, cartography, lines3d, floatingLogo, applyRouteProgress, applyBeamOutline, applyLeftFog, applyCloudLook });

  const gulls = !reducedMotion && query.get('birds') !== '0' ? createForestBirds(renderer, {
    atlas, camera: atlas.camera, once: false, panel: false, timedCrossings: true,
    focusDistance: () => atlas.camera.position.distanceTo(aim),
    tune: { flock: 7, solos: 1, size: 1.45, speed: 1.04, every: 11, height: 1, bright: 1.08 }   /* lead 11-20 (client: the valley needs a flock flying over): bigger flock, more often (was flock 5, size 1.22, every 22) */
  }) : null;
  if (gulls) {
    gulls.group.visible = false;
    atlas.scene.add(gulls.group);
  }

  const camera = atlas.camera;
  camera.fov = framing.fov;
  camera.near = .05;
  camera.far = 450;
  camera.up.set(0, 1, 0);
  camera.updateProjectionMatrix();
  atlas.setCameraDriver((lens, { x, z, entry, zoom }) => {
    if (lens.fov !== framing.fov) { lens.fov = framing.fov; lens.updateProjectionMatrix(); }
    // The next chapter's lake dive can animate from whichever angle the visitor leaves.
    const dive = smootherstep(zoom || 0, 0, 1);
    const polar = clamp(framing.tilt - z * 12 + (entry?.fore || 0) * .35 - sway.y * (1 - dive) * 1.35, 1, 84);
    const distance = framing.distance * (entry?.dist || 1) * lerp(1, .065, dive);
    aim.set(framing.tx, .105, framing.tz).lerp(atlas.lake.center, dive);
    orbit.set(distance, degToRad(lerp(polar, .7, dive)), degToRad(state.azimuth + x * 26 + sway.x * (1 - dive) * 3.15));
    lens.position.setFromSpherical(orbit).add(aim);
    lens.lookAt(aim);
    lens.updateMatrixWorld();
    return distance;
  });

  const retainCurrent = query.get('wflowCurrent') === '1';
  const removeWaterUpdate = atlas.onUpdate(frame => {
    flow?.update(frame);
    beams?.update({ ...frame, routeProgress: state.routeProgress });
    if (flow && beams?.group.visible && !retainCurrent) flow.uniforms.uCurrent.value = 0;
  });
  const view = {
    studio, state, cartography, curtain, beams, lines3d, floatingLogo,
    draw(r, target) { floatingLogo?.draw(r, target); },
    setPointer(x = 0, y = 0) { if (!reducedMotion) pointer.set(x, y); },
    leave() {
      floatingLogo?.leave();
      advance = routeAdvance = reducedMotion ? 1 : 0;
      routeVisibility = 1;
      routePreview = false;
      if (lineShown !== 1 && Number.isFinite(lineShown)) { lineKeep = 1; applyLineKeep(1); }   /* RISE HOOK: the lines are whole again for the next entrance */
      studio.uniforms.uEntrySurvey.value = 0;
      applyRouteProgress();
      pointer.set(0, 0);
      sway.set(0, 0);
    },
    update(dt, override, tune) {
      // A resumed/slow frame must not skip a whole entrance beat.
      if (rhythm) dt = Math.min(.05, Math.max(0, dt));
      if (!override?.warm && !override?.hold && override?.dir !== -1) advance = Math.min(1, advance + dt / framing.arrivalSeconds);
      // Finish the terrain wipe before running light along the river. The return wipe eases it out.
      studio.uniforms.uEntrySurvey.value = override && !override.reduce ? 1 : 0;
      routeVisibility = override && !override.reduce ? smoothstep(override.brush, 0.55, 1) : 1;
      const M = master();   /* RISE HOOK */
      if (!rhythm && !override && !(M && state.arrival < clamp(+M.lightAt || 0, 0, .98))) routeAdvance = Math.min(1, routeAdvance + dt / (M && +M.lightSeconds > .2 ? +M.lightSeconds : framing.arrivalSeconds * 0.53));
      const arrivalTime = override?.hold && !override.reduce ? override.brush * .29 : advance;
      const turn = smootherstep(arrivalTime, .12 / CAMERA.arrivalSeconds, 3.55 / CAMERA.arrivalSeconds);
      const arc = euclideanModulo(framing.azimuth - framing.entryAzimuth + 180, 360) - 180;
      state.azimuth = turn === 1 ? framing.azimuth : framing.entryAzimuth + arc * turn;
      const growth = clamp((arrivalTime * CAMERA.arrivalSeconds - .15) / (CAMERA.arrivalSeconds - .15), 0, 1);
      state.arrival = 1 - Math.pow(1 - growth, 2.45);
      studio.uniforms.uArrival.value = state.arrival;
      // Read this frame's colour, not last frame's, so light has one precise
      // handoff at every refresh rate. The sweep still covers its first beat.
      if (rhythm && !override && !(M && state.arrival < clamp(+M.lightAt || 0, 0, .98))) routeAdvance = Math.min(1, routeAdvance + dt / (M && +M.lightSeconds > .2 ? +M.lightSeconds : framing.arrivalSeconds * 0.53));
      applyRouteProgress();
      if (M) {   /* RISE HOOK: the 3D lines leave once the lens is in place; back quickly when the stroke takes the view away */
        const settled = !override && turn >= 1 && state.arrival >= clamp(+M.lineAt || 0, 0, 1);
        const back = override && override.dir === -1;
        if (settled) lineKeep = Math.max(0, lineKeep - dt / Math.max(.05, +M.lineOut || .9));
        else if (back) lineKeep = Math.min(1, lineKeep + dt / .22);
        const k = lineKeep * lineKeep * (3 - 2 * lineKeep);
        if (k !== lineShown || lines3d.group.visible !== (!!lines3d.config.enabled && k > .003)) applyLineKeep(k);
      }
      const easing = 1 - Math.exp(-dt * 5);
      const follow = override ? 0 : smoothstep(state.arrival, .72, 1);
      sway.set(lerp(sway.x, pointer.x * follow, easing), lerp(sway.y, pointer.y * follow, easing));
      atlas.update(CLOCK, dt, { cloud: 0, drift: tune.drift });
      floatingLogo?.update(dt, { progress: state.routeProgress, azimuth: framing.azimuth });
      cartography.update();
      if (gulls) {
        const show = studio.config.layers.gulls && studio.config.layers.terrainStyle && atlas.uniforms.uLattice.value < .35;
        if (show) gulls.update(dt);
        gulls.group.visible = !!show && gulls.state.active > 0;
      }
    },
    dispose() {
      removeWaterUpdate();
      floatingLogo?.dispose();
      lines3d.dispose();
      beams?.dispose();
      flow?.dispose();
      gulls?.dispose();
      cartography.dispose();
      curtain.dispose();
      studio.disposeTextures();
    }
  };
  view.update(0, null, { drift: 1 });
  /* PERF (strike team, 2026-11-21): the glass logo's programs and targets are prepared ahead of the first arrival (rise page; ?perf=0 = no) */
  try { setTimeout(() => { floatingLogo?.prepare?.(renderer)?.catch?.(() => { }); }, 1200); } catch (error) { }
  return view;
}
