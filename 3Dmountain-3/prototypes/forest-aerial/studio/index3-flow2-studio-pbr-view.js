import * as THREE from 'three';
import { createForestFlow } from '../index3-flow2-scene-flow.js?v=pbr-01-perf1';
import { createForestBirds } from '../index3-flow2-scene-birds.js?v=timed-passes2';
import { createRiverBeams } from '../index3-flow2-river-beams.js?v=studio-confluence-20261121-1-perf1';
import { createStudioTerrainPbrLayer } from './index3-studio-terrain-pbr-layer.js?v=ridge-banks2-fast1-cmp1-falls9-dir2';
import { bindAtmosphereArrival } from './index3-studio-highland-ecology.js?v=weather1-bank1-fast1';
import { createTributaryNetwork, createTributaryNetworkAsync } from './index3-studio-tributary-network.js?v=meadow-riffles1-optR';
import { createStudioCartography } from './studio-cartography.js?v=strategy-beacons-20261121-2-perf1-falls1';
import { createStudioLightCurtain } from './index3-studio-light-curtain.js?v=confluence-20261121-1-falls1-dir2';
import { createStudio3DLines } from './studio-3d-lines.js?v=ridge-banks1-fast1-falls2-redo1';

const CLOCK = 10.18;
/* 2026-11-21 (client: 「俯視山谷初始 參數統一」): the client's copied JSON is the starting look. Before: _archive/backups/td-params-20261121/
   2026-11-22 (client: 「俯視山谷初始數據使用這個」): their second export — arrival 3.25 s, the grass and rock colours, grass PBR 0, contours on (.4);
   the panel's storage moved to preset-4 so values kept in a browser do not cover it. Before: _archive/backups/td-params-20261122/
   2026-11-23 (client: 「俯視山谷參數初始改成這樣」, third export): contours off, the floating 3D logo off, the 3D lines off; everything else as before;
   panel storage preset-5. Before: _archive/backups/td-params-20261123/ */
const CAMERA = { entryAzimuth: 70.31, azimuth: 323.44, tilt: 63.832, distance: 22.056, fov: 22, tx: .23, tz: -.03, arrivalSeconds: 3.25 };
const PBR = {
  style: 1, grassSat: 1.28, grassCoverage: 85, grassTuftCount: 4800, grassPbr: 0,
  grassColor: '#7a9086', grassTipColor: '#76a27f', grassMossColor: '#7b8e86', grassDryColor: '#9dc8b4',
  grassMossCoverage: 59, grassDryCoverage: 62, grassTipCoverage: 64, rockColor: '#7d7d7d', rockLayerColor: '#b4b5bb',
  rockSlope: .88, biomeContrast: 1.06, cavityDepth: .44, strataStrength: 1.4, shoreWet: 1.3, relief: 1.03,
  waterDeep: '#0a182c', waterShallow: '#264468', waterSpeed: 1.1, waterWave: 1.48, waterClear: .94, whitewater: 1, waterGlow: .88,
  sunIntensity: 1.83, sunShadow: .6, sunRays: .39, sunAzimuth: 62, sunElevation: 24,
  mist: .16, cloudStrength: .07, valleyMist: .11, mistHeight: .13, contourOpacity: .4, contourInterval: .04,
  cloudShadow: .9, mistColor: '#dfe6ec', airWhite: .5,
  layers: { tributaries: true, contours: false, terrainStyle: true, water: true, sunbeams: false, atmosphere: true, clouds: true, gulls: true }
};
/* 261124 FUSION (2026-11-24, client: 「森林拿掉 其他照這個檔案的山谷 261124.html，參數值也要上」): on the -ui page the land is the fused terrain
   (terrain-fusion/terrain-pbr-fusion.js: a snapshot of 261124.html's single-pass Magic Valley + 山谷 erosion land) with that page's values,
   and the forest canopy off (canopyCover 0). ?fusion=0 = our own land and values. The rise page is unchanged. */
const FUSION = document.documentElement.hasAttribute('data-rise-ui') && new URLSearchParams(location.search).get('fusion') !== '0';
if (FUSION) Object.assign(PBR, {
  grassTipColor: '#74a886', grassMossColor: '#6d8a82', grassDryColor: '#9bb8b4', rockColor: '#7a828a', rockLayerColor: '#bcc6d0', biomeContrast: 1.08,
  detailFusion: 1.0, erosionRelief: 1.12, erosionAlbedo: .86, erosionAO: .88, canopyCover: 0, canopyRelief: 1.08, meadowGrain: .68,
  colorVariety: 1.0, alpineAccents: 1.0
});
const CURTAIN = {
  enabled: false, showTributaries: true, showLogo: true, height: .3, speed: .3, brightness: .6, progress: 1,
  scanIntensity: .84, pulseStrength: 1.38, color: '#88ccf8', contactColor: '#d9f2ff', logoScale: 1.55, logoHeight: 1.4, logoRotation: 323
};
const LEFT_FOG = { enabled: true, density: .09, scale: .61, thickness: 1, x: .02, y: -.13, z: 0 };
const BEACONS = { enabled: true, particles: true, count: 34, height: 1.4, width: .98, brightness: 1.4, filaments: 1.07, halo: .79,
  particleSize: 1.16, particleBrightness: 1.55, speed: .7, color: '#b5e6ff' };
const RIVER_DESIGN = { on: true, bright: .98, coreWidth: .95, halo: .82, haloWidth: 10, wide: .75, speed: .85, spacing: 2.5, packetLength: 1,
  pulse: 1.3, filaments: 1.1, sparkDensity: .24, glint: 1, tribBright: .4, softClip: 1.45, colour: '#e3f7ff', glow: '#68bded' };
const FLOATING_LOGO = { enabled: false, height: 1.31, gap: .1, offsetX: .53, offsetY: -1.53, offsetZ: -.76, yaw: 0, pitch: 0, roll: 0, depth: 1,
  rotate: true, reverse: false, period: 18, opacity: .56, transmission: 1, roughness: .6, volume: 2, ior: 2.33, dispersion: 1.65,
  envIntensity: 1.72, rimStrength: 5.15, caustic: 2.38, tint: '#ffffff', brandBlue: .72, brandBlueColor: '#143e6b', light: 1.7, maxBright: 3 };
const LINES_3D = { enabled: false, opacity: .18, color: '#d4e6ff', accentColor: '#76c4ff' };
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
  ...(FUSION ? [['— 材質細節融合（Magic Valley + 山谷侵蝕）—'],
    ['融合細節總強度', 'pbr.detailFusion', 0, 1.5, .01], ['山谷侵蝕浮雕法線', 'pbr.erosionRelief', 0, 2.0, .01],
    ['山谷岩紋色彩融合', 'pbr.erosionAlbedo', 0, 1.5, .01], ['山谷溝壑陰影 AO', 'pbr.erosionAO', 0, 1.6, .01],
    ['森林樹冠覆蓋率', 'pbr.canopyCover', 0, 1.5, .01], ['森林樹冠立體法線', 'pbr.canopyRelief', 0, 2.0, .01],
    ['草坡細紋顆粒', 'pbr.meadowGrain', 0, 1.5, .01], ['多色地貌豐富度', 'pbr.colorVariety', 0, 1.8, .01],
    ['冷紫石楠／銀灰藍岩比重', 'pbr.alpineAccents', 0, 1.8, .01]] : []),
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
    id: 'rise-studio-pbr', storageId: FUSION ? 'rise-studio-pbr-ui-fusion-1' : 'rise-studio-pbr-preset-5', title: '俯視山谷 PBR', key: 'p', tune,
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
  /* 261124 PORT (2026-11-24 ~13:50, client: 「261124.html俯視山谷 移過來 index1-5-canyon-forest-rise-ui.html」): on the -ui page the whole view from
     above is 261124.html's (terrain-fusion/studio-pbr-view-fusion.js: its land, water, values and panel; forest off). ?fusion=0 = ours below. */
  if (FUSION) return (await import('./terrain-fusion/index3-studio-pbr-view-fusion.js?v=f10-48')).createStudioPbrView(renderer, atlas, { reducedMotion, query, labels });
  const rhythm = window.__RISE_RHYTHM__;
  const logoExperiment = document.documentElement.hasAttribute('data-rise-floating-logo');
  const legacyMist = atlas.scene.getObjectByName('Forest legacy mist');
  if (legacyMist) legacyMist.visible = false;
  /* optR slice (team R, 2026-11-21; rise page, ?optR=0 / ?perf=0 / ?optRoff=slice = in one block as before): the 0.5-0.7 s of CPU work is cut into 3 ms slices so the opening keeps drawing */
  atlas.studioHydrology = (document.documentElement.hasAttribute('data-rise-studio-pbr') && query.get('perf') !== '0' && query.get('optR') !== '0' && !(query.get('optRoff') || '').split(',').includes('slice')) ? await createTributaryNetworkAsync(atlas) : createTributaryNetwork(atlas);
  const [studio, flow] = await Promise.all([
    FUSION ? import('./terrain-fusion/index3-terrain-pbr-fusion.js?v=f4-k2').then(module => {
      const init = { ...PBR };
      for (const k of ['detailFusion', 'erosionRelief', 'erosionAlbedo', 'erosionAO', 'canopyCover', 'canopyRelief', 'meadowGrain', 'colorVariety', 'alpineAccents']) {
        const v = query.get(k); if (v != null && v !== '' && Number.isFinite(+v)) init[k] = +v;
      }
      return module.createStudioTerrainPbrLayer(renderer, atlas, init);
    }) : createStudioTerrainPbrLayer(renderer, atlas, PBR),
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
  /* RISE FALLS (team FW, 2026-11-23; only with html[data-rise-falls] = ?falls=1 on the -ui page while it is built; docs/falls/BRIEF-20261123.md):
     the lake of this view becomes a horseshoe waterfall. falls/index.js brings team FT's rock and FW's water and air. It is made here, after the
     terrain layer and before the atlas compiles the view's programs, so its own are compiled with them (no hitch at the arrival).
     Without the attribute falls is null and every line below that reads it does nothing. A failure only warns: the view comes as before. */
  const falls = document.documentElement.hasAttribute('data-rise-falls') ?
    await import('./falls/index3-index.js?v=dir2-shelf24')
      .then(module => module.createStudioFalls(renderer, atlas, studio, { reducedMotion, query, beams, curtain, flow }))
      .catch(error => { console.warn('Rise falls could not be made:', error); return null; }) : null;
  if (falls) atlas.scene.add(falls.group);
  /* VALLEY DETAIL (2026-11-24, -ui page only, ?vtex=0 = off): the erosion relief, streaks and meadow grain of the client's two terrain maps
     (magic_valley/, 山谷/textures/) multiplied over the live land in one light pass on the same surface (valley-detail/valley-detail.js). */
  const valleyDetail = document.documentElement.hasAttribute('data-rise-ui') && query.get('vtex') !== '0' ?
    await import('./valley-detail/index3-valley-detail.js?v=s24')
      .then(module => module.createValleyDetail(renderer, atlas, { query, fusion: FUSION }))
      .catch(error => { console.warn('Valley detail could not be made:', error); return null; }) : null;
  const lines3d = createStudio3DLines(atlas, { studio, parts: { flow } }, { enabled: true });
  const cartography = createStudioCartography(atlas, studio, atlas.camera, {
    ...labels, compactLeaders: logoExperiment, enhancedBeacons: logoExperiment, curtain, reducedMotion
  });
  beams?.setFocus(cartography.focus);
  const floatingLogo = logoExperiment && query.get('floatingLogo') !== '0' ?
    await import('./studio-floating-logo.js?v=20261121-4-optR')
      .then(module => module.createStudioFloatingLogo(renderer, atlas, curtain, { reducedMotion, query }))
      .catch(error => { console.warn('Confluence logo could not load:', error); return null; }) : null;
  bindAtmosphereArrival(atlas, studio.uniforms);

  const framing = { ...CAMERA };
  const leftFog = { ...LEFT_FOG };
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
    if (falls) return;   /* RISE FALLS: the light lines end at the gorge's rim (falls/index.js bindBeams), not at the mark on the lake */
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
  /* the client's starting values for the parts whose defaults live in shared modules (set here, so the studio page keeps its own) */
  if (cartography.config.beacons) Object.assign(cartography.config.beacons, BEACONS);
  if (beams?.tune?.filaments !== undefined) Object.assign(beams.tune, RIVER_DESIGN);
  if (floatingLogo?.config) Object.assign(floatingLogo.config, FLOATING_LOGO);
  Object.assign(lines3d.config, LINES_3D);
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
    aim.set(framing.tx, .105, framing.tz).lerp(falls ? falls.diveTarget : atlas.lake.center, dive);   /* RISE FALLS: the dive goes to the pool */
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
    falls?.update(frame);   /* RISE FALLS */
    valleyDetail?.update();   /* VALLEY DETAIL: follows the land's place and visibility */
    if (flow && beams?.group.visible && !retainCurrent) flow.uniforms.uCurrent.value = 0;
  });
  const view = {
    studio, state, cartography, curtain, beams, lines3d, floatingLogo, falls,
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
      falls?.setArrival(state.arrival);   /* RISE FALLS: the water comes with the land's colour */
      valleyDetail?.setArrival(state.arrival);   /* VALLEY DETAIL: comes with the land's colour */
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
      falls?.dispose();
      valleyDetail?.dispose();
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
