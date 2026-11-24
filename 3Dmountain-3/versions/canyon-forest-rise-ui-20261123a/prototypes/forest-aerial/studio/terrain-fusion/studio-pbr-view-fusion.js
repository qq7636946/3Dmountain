/* studio-pbr-view-fusion.js — SNAPSHOT (2026-11-24 ~13:50) of prototypes/valley-261124/studio-pbr-view-261124.js (client: 「261124.html俯視山谷 移過來
   index1-5-canyon-forest-rise-ui.html」): the -ui page's view from above, delegated to by flow2-studio-pbr-view.js (?fusion=0 = ours).
   Changes: paths, our compressed terrain copy, the forest off (canopyCover 0), its own panel storage, the current falls stamp. */
import * as THREE from 'three';
import { createForestFlow } from '../../flow2-scene-flow.js?v=pbr-01-perf1';
import { createForestBirds } from '../../flow2-scene-birds.js?v=timed-passes1';
import { createRiverBeams } from '../../flow2-river-beams.js?v=studio-confluence-20261121-1-perf1';
import { createStudioTerrainPbrLayer } from './terrain-pbr-fusion.js?v=f10-k11';
import { createLakeLogoVideo } from './lake-logo-video.js?v=f10-1';
import { createLakeConvergence } from './lake-convergence.js?v=c6';
import { layerOpacity } from './layer-opacity.js?v=o1';   /* 2026-11-24 client: 「這都要可以調透明度」 */   /* 2026-11-24 client: 「湖泊中間加入 這樣的設計代表匯集」 */
import { bindAtmosphereArrival } from '../studio-highland-ecology.js?v=weather1-bank1-fast1';
import { createTributaryNetwork, createTributaryNetworkAsync } from '../studio-tributary-network.js?v=meadow-riffles1-optR';
import { createStudioCartography } from '../studio-cartography.js?v=strategy-beacons-20261121-2-perf1-falls1';
import { createStudioLightCurtain } from '../studio-light-curtain.js?v=confluence-20261121-1-falls1-dir2';
import { createStudio3DLines } from '../studio-3d-lines.js?v=ridge-banks1-fast1-falls2-redo1';

const CLOCK = 10.18;
/* 2026-11-21 (client: 「俯視山谷初始 參數統一」): the client's copied JSON is the starting look. Before: _archive/backups/td-params-20261121/
   2026-11-22 (client: 「俯視山谷初始數據使用這個」): their second export — arrival 3.25 s, the grass and rock colours, grass PBR 0, contours on (.4);
   the panel's storage moved to preset-4 so values kept in a browser do not cover it. Before: _archive/backups/td-params-20261122/
   2026-11-23 (client: 「俯視山谷參數初始改成這樣」, third export): contours off, the floating 3D logo off, the 3D lines off; everything else as before;
   panel storage preset-5. Before: _archive/backups/td-params-20261123/ */
/* FOV: 2026-11-24 a 25 → 14 narrowing with the turn was tried; then the client: 「FOV 不要動」 + their JSON (fov 15.6): one fixed fov again.
   entryFov (optional, ?) would bring the narrowing back: the code stays, unused. */
const CLIENT_PRESET_20261124 = {"azimuth":323.44,"tilt":63.832,"distance":21.86,"fov":15.6,"target":[0.14,-0.03],"entryAzimuth":70.31,"arrivalSeconds":6,"pbr":{"style":1,"grassSat":1.58,"grassCoverage":70,"grassColor":"#88bfa5","grassTipColor":"#caecd6","grassMossColor":"#a4c1b9","grassDryColor":"#a9c1be","grassMossCoverage":64,"grassDryCoverage":64,"grassTipCoverage":66,"rockColor":"#737373","rockLayerColor":"#c7c7c7","grassPbr":0.91,"rockSlope":0.89,"biomeContrast":1.24,"cavityDepth":0.46,"strataStrength":1.4,"shoreWet":1.3,"relief":1.1,"waterDeep":"#496b97","waterShallow":"#1a3456","waterSpeed":1.05,"waterWave":1,"waterClear":1.32,"whitewater":1.18,"waterGlow":0.88,"waveScale":1.2,"riverDetail":1.38,"sunIntensity":1.86,"sunShadow":1.01,"sunRays":0.46,"sunAzimuth":47,"sunElevation":24,"mist":0.27,"cloudStrength":0.05,"cloudShadow":0.14,"airWhite":0.8,"mistColor":"#dfe6ec","valleyMist":0.02,"mistHeight":0.1,"contourOpacity":0.4,"contourInterval":0.04,"detailFusion":0.94,"erosionRelief":2,"erosionAlbedo":1.5,"erosionAO":1.6,"canopyCover":1.5,"canopyRelief":1.21,"meadowGrain":0.76,"colorVariety":0.79,"alpineAccents":0.81,"layers":{"tributaries":true,"contours":false,"terrainStyle":true,"water":true,"sunbeams":false,"atmosphere":true,"clouds":true,"gulls":true},"grassTuftCount":4800},"cartography":{"labels":true,"beacons":{"enabled":true,"particles":true,"count":48,"height":1.2,"width":0.88,"brightness":1.4,"filaments":1.07,"halo":0.79,"particleSize":0.98,"particleBrightness":1.64,"speed":0.79,"color":"#b5e6ff"}},"curtain":{"enabled":false,"showTributaries":false,"showLogo":false,"height":0.26,"speed":0.22,"brightness":0.36,"progress":1,"scanIntensity":0.84,"pulseStrength":1.38,"color":"#88ccf8","contactColor":"#d9f2ff","logoScale":1.55,"logoHeight":0.44,"logoRotation":320,"refinedRivers":true},"riverDesign":{"on":false,"bright":0.98,"coreWidth":0.95,"halo":0.82,"haloWidth":10,"wide":0.75,"speed":0.85,"spacing":2.5,"packetLength":1,"pulse":1.3,"filaments":1.1,"sparkDensity":0.24,"glint":1,"tribBright":0.4,"softClip":1.45,"colour":"#e3f7ff","glow":"#68bded"},"leftFog":{"enabled":false,"density":0.13,"scale":0.55,"thickness":0.87,"x":0.02,"y":-0.86,"z":0},"cloudLook":{"lit":"#ffffff","shade":"#e1e8ee","bright":1.09,"contrast":1.07},"floatingLogo":{"enabled":false,"height":1.31,"gap":0.1,"offsetX":0.53,"offsetY":-1.53,"offsetZ":-0.76,"yaw":0,"pitch":0,"roll":0,"depth":1,"rotate":true,"reverse":false,"period":18,"opacity":0.56,"transmission":1,"roughness":0.6,"volume":2,"ior":2.33,"dispersion":1.65,"envIntensity":1.72,"rimStrength":5.15,"caustic":2.38,"tint":"#ffffff","brandBlue":0.72,"brandBlueColor":"#143e6b","light":1.7,"maxBright":3},"logoVideo":{"enabled":false,"yaw":323.4,"tilt":0,"roll":0,"scale":2.62,"stretchY":1.38,"offsetX":0.02,"offsetZ":-0.04,"height":0.009,"opacity":0.96,"filterStrength":0.92,"contrast":1.32,"brightness":1.08,"glow":0.42,"feather":0.36,"speed":1,"tintDeep":"#041426","tintMid":"#124a61","tintFoam":"#e4f6ff","clipBeams":true,"clipRadius":0.8},"convergence":{"enabled":false,"size":1.15,"core":0,"rings":0.16,"tiers":1.1,"speed":0.24},"lines3d":{"enabled":false,"opacity":0.18,"color":"#d4e6ff","accentColor":"#76c4ff"}};
/* MORE ANGLES (2026-11-24, client: 「給我多一點能控制的角度」): aim height, roll, lens shift, pointer parallax, entry tilt / distance, drag framing */
const CAMERA = { entryAzimuth: 70.31, azimuth: 323.44, tilt: 63.832, distance: 22.056, fov: 22, tx: .23, tz: -.03, arrivalSeconds: 3.25,
  ty: .105, roll: 0, shiftX: 0, shiftY: 0, swayX: 3.15, swayY: 1.35, entryTilt: 0, entryDist: 0, drag: false };
const PBR = {
  style: 1, grassSat: 1.28, grassCoverage: 85, grassTuftCount: 4800, grassPbr: 0,
  grassColor: '#7a9086', grassTipColor: '#74a886', grassMossColor: '#6d8a82', grassDryColor: '#9bb8b4',
  grassMossCoverage: 59, grassDryCoverage: 62, grassTipCoverage: 64, rockColor: '#7a828a', rockLayerColor: '#bcc6d0',
  rockSlope: .88, biomeContrast: 1.08, cavityDepth: .44, strataStrength: 1.4, shoreWet: 1.3, relief: 1.03,
  /* RIVERS (2026-11-24, client: 「河流還是不夠好 繼續修」 → 三項一起修): deeper channels, brighter clearer shallows, more river detail (was #061829 / #165266, clear 1.04, white 1.05, waves 1.0, detail 1.0) */
  waterDeep: '#04111d', waterShallow: '#2a8590', waterSpeed: 1.05, waterWave: 1.0, waterClear: 1.32, whitewater: 1.18, waterGlow: .88,
  waveScale: 1.2, riverDetail: 1.38,
  sunIntensity: 1.83, sunShadow: .6, sunRays: .39, sunAzimuth: 62, sunElevation: 24,
  mist: .16, cloudStrength: .07, valleyMist: .11, mistHeight: .13, contourOpacity: .4, contourInterval: .04,
  cloudShadow: .9, mistColor: '#dfe6ec', airWhite: .5,
  detailFusion: 1.0, erosionRelief: 1.12, erosionAlbedo: .86, erosionAO: .88,
  canopyCover: 0,   /* the client: 「森林拿掉」 */ canopyRelief: 1.08, meadowGrain: .68,
  colorVariety: 1.0, alpineAccents: 1.0,
  satDrape: .8, satScale: 1, satContrast: 1,   /* SATELLITE DRAPE (2026-11-24, client: 「做衛星感色塊」) */
  layers: { tributaries: true, contours: false, terrainStyle: true, water: true, sunbeams: false, atmosphere: true, clouds: true, gulls: true }
};
const CURTAIN = {
  enabled: false, showTributaries: true, showLogo: false, height: .3, speed: .3, brightness: .6, progress: 1,
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
  ['鏡頭距離', 'camera.distance', 4, 40, .001],
  ['視野 FOV（度）', 'camera.fov', 5, 50, .1],
  ['注視點 X', 'camera.tx', -5, 5, .01], ['注視點 Z', 'camera.tz', -2.8, 2.8, .01],
  ['蔓延時間（秒）', 'camera.arrivalSeconds', 1.5, 10, .1],
  ['— 鏡頭角度（更多）—'],
  ['拖曳取景（拖曳＝轉角度・Shift 拖曳＝平移・Alt 上下拖曳＝遠近）', 'camera.drag', 'checkbox'],
  ['注視點高度', 'camera.ty', -.3, 1.2, .001],
  ['鏡頭滾轉（度）', 'camera.roll', -30, 30, .1],
  ['畫面左右平移（構圖）', 'camera.shiftX', -.5, .5, .001],
  ['畫面上下平移（構圖）', 'camera.shiftY', -.5, .5, .001],
  ['滑鼠視差：左右（度）', 'camera.swayX', 0, 15, .05],
  ['滑鼠視差：上下（度）', 'camera.swayY', 0, 8, .05],
  ['進場額外傾角（度，進場時加上、到位歸零）', 'camera.entryTilt', -40, 40, .1],
  ['進場額外距離（倍，進場時加上、到位歸零）', 'camera.entryDist', -.6, 2, .01],
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
  ['— 材質細節融合（Magic Valley + 山谷侵蝕）—'],
  ['融合細節總強度', 'pbr.detailFusion', 0, 1.5, .01],
  ['山谷侵蝕浮雕法線', 'pbr.erosionRelief', 0, 2.0, .01],
  ['山谷岩紋色彩融合', 'pbr.erosionAlbedo', 0, 1.5, .01],
  ['山谷溝壑陰影 AO', 'pbr.erosionAO', 0, 1.6, .01],
  ['森林樹冠覆蓋率', 'pbr.canopyCover', 0, 1.5, .01],
  ['森林樹冠立體法線', 'pbr.canopyRelief', 0, 2.0, .01],
  ['草坡細紋顆粒', 'pbr.meadowGrain', 0, 1.5, .01],
  ['多色地貌豐富度', 'pbr.colorVariety', 0, 1.8, .01],
  ['冷紫石楠／銀灰藍岩比重', 'pbr.alpineAccents', 0, 1.8, .01],
  ['衛星感色塊強度（0＝關）', 'pbr.satDrape', 0, 2, .01], ['衛星感色塊大小（大＝細碎）', 'pbr.satScale', .25, 4, .01], ['衛星感色塊色彩對比', 'pbr.satContrast', 0, 2, .01],
  ['— 河流與湖面 —'],
  ['深水色', 'pbr.waterDeep', 'color'], ['淺水色', 'pbr.waterShallow', 'color'],
  ['水流速度', 'pbr.waterSpeed', 0, 3, .01], ['水波強度', 'pbr.waterWave', .1, 2.5, .01],
  ['波紋精細倍率', 'pbr.waveScale', .4, 2.2, .01], ['河道流絲與激流細節', 'pbr.riverDetail', 0, 1.8, .01],
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
  ['中央 LOGO', 'curtain.showLogo', 'checkbox'], ['中央 LOGO 透明度', 'opacity.centralLogo', 0, 1, .01],
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
  ['河流光束', 'riverBeams.on', 'checkbox'], ['河流光束透明度', 'opacity.riverBeams', 0, 1, .01],
  ['支流', 'pbr.layers.tributaries', 'checkbox'], ['等高線', 'pbr.layers.contours', 'checkbox'],
  ['等高線透明度', 'pbr.contourOpacity', 0, .8, .01], ['等高線間距', 'pbr.contourInterval', .04, .22, .005],
  ['動態水面', 'pbr.layers.water', 'checkbox'], ['陽光光束', 'pbr.layers.sunbeams', 'checkbox'],
  ['空氣透視', 'pbr.layers.atmosphere', 'checkbox'], ['山嶺雲層', 'pbr.layers.clouds', 'checkbox'],
  ['海鷗', 'pbr.layers.gulls', 'checkbox'], ['投資策略標籤', 'cartography.labels', 'checkbox']
];

function registerControls(tune, { studio, curtain, cartography, lines3d, floatingLogo, logoVideo, convergence, valleyFalls, applyOpacity, applyRouteProgress, applyBeamOutline, applyLeftFog, applyCloudLook }) {
  const panel = window.__FLOW2_PANEL__?.add({
    id: 'rise-studio-pbr', storageId: 'rise-studio-pbr-ui-client-1', title: '俯視山谷 PBR', key: 'p', tune,
    rows: [...(tune.riverBeams ? ROWS : ROWS.filter(row => row[1] !== 'riverBeams.on' && row[1] !== 'opacity.riverBeams')),
      ...(tune.convergence ? [['— 湖心匯集光 —'],
        ['顯示湖心匯集光', 'convergence.enabled', 'checkbox'], ['湖心匯集光透明度', 'opacity.convergence', 0, 1, .01],
        ['大小（世界單位）', 'convergence.size', .3, 2.2, .01],
        ['中央亮核', 'convergence.core', 0, 2.5, .01],
        ['往內收的光紋', 'convergence.rings', 0, 2.5, .01],
        ['層次光盤', 'convergence.tiers', 0, 2.5, .01],
        ['光紋速度', 'convergence.speed', 0, .6, .01], ['河光停在湖心外（半徑，0＝交會到中心）', 'convergence.beamStop', 0, 1.5, .01]] : []),
      ...(tune.valleyFalls ? [['— 山谷小瀑布 —'],
        ['顯示山谷瀑布', 'valleyFalls.enabled', 'checkbox'],
        ['瀑布數量', 'valleyFalls.count', 0, 12, 1],
        ['亮度', 'valleyFalls.bright', 0, 2, .01],
        ['寬度', 'valleyFalls.width', .4, 2.5, .01],
        ['流速', 'valleyFalls.speed', 0, 3, .01],
        ['底部水霧', 'valleyFalls.mist', 0, 2.5, .01]] : []),
      ...(tune.logoVideo ? [['— 湖心 LOGO 影片與濾鏡 —'],
        ['顯示湖心 LOGO 影片', 'logoVideo.enabled', 'checkbox'],
        ['水平旋轉角度（度）', 'logoVideo.yaw', 0, 360, .2],
        ['俯仰傾角（度）', 'logoVideo.tilt', -30, 45, .2],
        ['平面滾轉（度）', 'logoVideo.roll', -180, 180, .5],
        ['整體大小', 'logoVideo.scale', .8, 4.2, .02],
        ['縱向透視拉長', 'logoVideo.stretchY', .6, 2.0, .01],
        ['左右位置 X', 'logoVideo.offsetX', -1.5, 1.5, .01],
        ['前後位置 Z', 'logoVideo.offsetZ', -1.5, 1.5, .01],
        ['總透明度', 'logoVideo.opacity', 0, 1, .01],
        ['濾鏡水色融合度', 'logoVideo.filterStrength', 0, 1, .01],
        ['對比立體度', 'logoVideo.contrast', .4, 2.6, .01],
        ['亮度微調', 'logoVideo.brightness', .3, 2.0, .01],
        ['浪花高光暈光', 'logoVideo.glow', 0, 1.6, .01],
        ['邊緣羽化柔和度', 'logoVideo.feather', .15, .9, .01],
        ['深水暗部色', 'logoVideo.tintDeep', 'color'],
        ['湖水中調色', 'logoVideo.tintMid', 'color'],
        ['白浪高光色', 'logoVideo.tintFoam', 'color'],
        ['播放速度', 'logoVideo.speed', 0, 2, .05],
        ['河道光束於外圈匯入', 'logoVideo.clipBeams', 'checkbox'],
        ['匯入光圈半徑', 'logoVideo.clipRadius', .2, 1.6, .01]] : []),
      ...(tune.riverBeams?.filaments !== undefined ? [['— 河道流光設計 —'],
        ['河流整體亮度', 'riverBeams.bright', 0, 2, .01], ['湖心會合光點（0＝無）', 'riverBeams.meet', 0, 2, .01], ['核心光線寬度', 'riverBeams.coreWidth', .4, 3, .05],
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
      if (key.startsWith('opacity.')) { applyOpacity?.(); return; }
      if (key.startsWith('pbr.')) studio.apply();
      else if (key.startsWith('curtain.')) {
        curtain.apply();
        studio.syncCurtain();
        if (key === 'curtain.logoScale' || key === 'curtain.logoRotation' || key === 'curtain.showLogo') applyBeamOutline();
      }
      else if (key.startsWith('convergence.')) { convergence?.apply(); applyBeamOutline(); }
      else if (key.startsWith('valleyFalls.')) valleyFalls?.apply();
      else if (key.startsWith('logoVideo.')) {
        logoVideo?.apply();
        applyBeamOutline();
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
        cameraMore: { ty: tune.camera.ty, roll: tune.camera.roll, shiftX: tune.camera.shiftX, shiftY: tune.camera.shiftY, swayX: tune.camera.swayX, swayY: tune.camera.swayY, entryTilt: tune.camera.entryTilt, entryDist: tune.camera.entryDist },
        pbr: tune.pbr, cartography: tune.cartography, curtain: tune.curtain, entryAzimuth, arrivalSeconds,
        riverBeams: !!tune.riverBeams?.on,
        ...(tune.riverBeams?.filaments !== undefined ? { riverDesign: Object.fromEntries(
          ['on', 'bright', 'coreWidth', 'halo', 'haloWidth', 'wide', 'speed', 'spacing', 'packetLength', 'pulse',
            'filaments', 'sparkDensity', 'glint', 'tribBright', 'softClip', 'colour', 'glow'].map(key => [key, tune.riverBeams[key]])) } : {}),
        leftFog: tune.leftFog, cloudLook: tune.cloudLook, floatingLogo: tune.floatingLogo, logoVideo: tune.logoVideo, convergence: tune.convergence, valleyFalls: tune.valleyFalls, opacity: tune.opacity,
        lines3d: { enabled: !!tune.lines3d.enabled, opacity: tune.lines3d.opacity, color: tune.lines3d.color, accentColor: tune.lines3d.accentColor }
      };
    }
  });
  // The panel restores saved values synchronously on registration.
  curtain.apply();
  studio.apply();
  cartography.apply();
  lines3d.apply();
  logoVideo?.apply();
  convergence?.apply();
  valleyFalls?.apply();
  applyOpacity?.();
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
  /* optR slice (team R, 2026-11-21; rise page, ?optR=0 / ?perf=0 / ?optRoff=slice = in one block as before): the 0.5-0.7 s of CPU work is cut into 3 ms slices so the opening keeps drawing */
  atlas.studioHydrology = (document.documentElement.hasAttribute('data-rise-studio-pbr') && query.get('perf') !== '0' && query.get('optR') !== '0' && !(query.get('optRoff') || '').split(',').includes('slice')) ? await createTributaryNetworkAsync(atlas) : createTributaryNetwork(atlas);
  const initPbr = { ...PBR };
  if (query.get('v26') === '0' || query.get('vtex') === '0') initPbr.detailFusion = 0;
  for (const k of ['detailFusion', 'erosionRelief', 'erosionAlbedo', 'erosionAO', 'canopyCover', 'canopyRelief', 'meadowGrain', 'colorVariety', 'alpineAccents', 'waveScale', 'riverDetail']) {
    const v = query.get(k);
    if (v != null && v !== '' && Number.isFinite(+v)) initPbr[k] = +v;
  }
  const [studio, flow] = await Promise.all([
    createStudioTerrainPbrLayer(renderer, atlas, initPbr),
    query.get('wflow') === '0' ? null : createForestFlow(renderer, { reducedMotion, atlas })
  ]);
  if (!studio.terrainPatched) throw new Error('Studio PBR terrain could not be applied');
  const [curtain, beams] = await Promise.all([
    createStudioLightCurtain(atlas, { ...CURTAIN, refinedRivers: logoExperiment }),
    createRiverBeams(renderer, { atlas, reducedMotion, refined: logoExperiment, panel: false, suppressFlowCurrent: false,
      /* RIVERS (2026-11-24): a fine, soft thread of light over the water, not a neon tube (was core 1.2, inner 3.4, halo 1 × 8, wide 1.5 × 24, land halo .3, head 1.2) */
      tune: { on: true, bright: .86, coreWidth: .78, innerWidth: 2.1, halo: .62, haloWidth: 7, wide: .5, wideWidth: 18, landHalo: .08, head: .8, shimmer: .3 } })
      .catch(error => { console.warn('Rise river beams:', error); return null; })
  ]);
  studio.bindCurtain(curtain);
  if (flow) atlas.scene.add(flow.group);
  if (beams) atlas.scene.add(beams.group);
  const falls = document.documentElement.hasAttribute('data-rise-falls') ?
    await import('../falls/index.js?v=dir2-shelf24')
      .then(module => module.createStudioFalls(renderer, atlas, studio, { reducedMotion, query, beams, curtain, flow }))
      .catch(error => { console.warn('Rise falls could not be made:', error); return null; }) : null;
  if (falls) atlas.scene.add(falls.group);
  /* Unified single-pass PBR fusion (magic_valley + 山谷/textures) lives directly inside terrain-pbr-261124.js */
  const valleyDetail = null;
  const lines3d = createStudio3DLines(atlas, { studio, parts: { flow } }, { enabled: true });
  const cartography = createStudioCartography(atlas, studio, atlas.camera, {
    ...labels, compactLeaders: logoExperiment, enhancedBeacons: logoExperiment, curtain, reducedMotion
  });
  beams?.setFocus(cartography.focus);
  const floatingLogo = logoExperiment && query.get('floatingLogo') !== '0' ?
    await import('../studio-floating-logo.js?v=20261121-4-optR')
      .then(module => module.createStudioFloatingLogo(renderer, atlas, curtain, { reducedMotion, query }))
      .catch(error => { console.warn('Confluence logo could not load:', error); return null; }) : null;
  const logoVideo = !falls && query.get('logoVideo') !== '0'
    ? createLakeLogoVideo(atlas, studio, { reducedMotion, query }) : null;
  if (logoVideo) atlas.scene.add(logoVideo.group);
  const convergence = !falls ? createLakeConvergence(atlas, studio, { query, reducedMotion }) : null;   /* THE CONVERGENCE: where the four beams meet */
  if (convergence) atlas.scene.add(convergence.group);
  const valleyFalls = null;   /* 2026-11-24: small valley waterfalls tried, then the client: 「瀑布不用了」 (module kept in _archive/backups/lake-shelf-20261124/valley-waterfalls.js) */
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
    if (falls || !beams) return;   /* RISE FALLS: the light lines end at the gorge's rim (falls/index.js bindBeams), not at the mark on the lake */
    const logo = curtain.logo;
    if (curtain.config.showLogo && logo?.outlines.length) {
      logo.group.updateWorldMatrix(true, false);
      const world = logo.group.matrixWorld;
      beams.setLogoOutline(logo.outlines.map(ring => ring.map(([x, z]) => {
        outlinePoint.set(x, 0, z).applyMatrix4(world);
        return [outlinePoint.x, outlinePoint.z];
      })));
    } else if (logoVideo?.config.enabled && logoVideo.config.clipBeams) {
      beams.setLogoOutline(logoVideo.getBeamOutline());
    } else if (convergence && +convergence.config.beamStop > .01) {
      /* NO CENTRE POINT (2026-11-24, 「中間光點取消」): the four beams end on a circle round the lake's centre and never cross into one point */
      const c = atlas.lake.center, r = +convergence.config.beamStop, ring = [];
      for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; ring.push([c.x + Math.cos(a) * r, c.z + Math.sin(a) * r]); }
      beams.setLogoOutline([ring]);
    } else {
      beams.setLogoOutline([]);
    }
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
  /* CLIENT PRESET (2026-11-24 ~15:40, client: 「FOV 不要動 … 其他照這個」 + the panel's 複製參數 JSON, kept in docs/valley-detail/client-td-20261124.json):
     every value of that export is the default here: the lens (fov 15.6 fixed, distance 21.86, aim .14 / -.03, arrival 6 s), the land and water,
     forest on (canopy 1.5), the beacons, the curtain / river beams / 3D lines / left fog / floating logo / logo video / convergence as they had
     them (all off). ?clientPreset=0 = the values before. */
  if (query.get('clientPreset') !== '0') {
    const P = CLIENT_PRESET_20261124;
    const deep = (dst, src) => { if (!dst || !src) return; for (const k in src) { const v = src[k]; if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object') deep(dst[k], v); else dst[k] = v; } };
    Object.assign(framing, { azimuth: P.azimuth, tilt: P.tilt, distance: P.distance, fov: P.fov, tx: P.target[0], tz: P.target[1], entryAzimuth: P.entryAzimuth, arrivalSeconds: P.arrivalSeconds });
    delete framing.entryFov;
    deep(studio.config, P.pbr); deep(cartography.config, P.cartography); deep(curtain.config, P.curtain);
    if (beams?.tune) deep(beams.tune, P.riverDesign);
    deep(leftFog, P.leftFog); deep(cloudLook, P.cloudLook);
    if (floatingLogo?.config) deep(floatingLogo.config, P.floatingLogo);
    if (logoVideo?.config) deep(logoVideo.config, P.logoVideo);
    if (convergence?.config) deep(convergence.config, P.convergence);
    deep(lines3d.config, P.lines3d);
  }
  /* LAYER OPACITY (2026-11-24, client: 「這都要可以調透明度」): 河流光束 / 中央 LOGO / 湖心匯集光 each with an opacity dial next to its switch */
  const layerOp = { riverBeams: 1, centralLogo: 1, convergence: 1 };
  const ops = { riverBeams: layerOpacity(() => beams?.group), centralLogo: layerOpacity(() => curtain?.logo?.group), convergence: layerOpacity(() => convergence?.group) };
  const applyOpacity = () => { for (const k in ops) ops[k].set(layerOp[k]); };
  /* NO CENTRE POINT (2026-11-24, client: 「中間光點取消」): the convergence's hot core and the four beams' meeting glow are 0 by default (panel:
     湖心匯集光 › 中央亮核, 河道流光設計 › 湖心會合光點). A core value kept in this browser's panel storage is dropped once. */
  if (beams?.tune) beams.tune.meet = 0;
  try { const k = 'flow2-tune:rise-studio-pbr-ui-client-1'; if (!localStorage.getItem(k + ':nocore')) { const o = JSON.parse(localStorage.getItem(k) || '{}') || {}; delete o['convergence.core']; delete o['riverBeams.meet']; if (Object.keys(o).length) localStorage.setItem(k, JSON.stringify(o)); localStorage.setItem(k + ':nocore', '1'); } } catch (error) { }
  const panel = registerControls({
    camera: framing, pbr: studio.config, curtain: curtain.config, cartography: cartography.config,
    riverBeams: beams?.tune, lines3d: lines3d.config, leftFog, cloudLook, floatingLogo: floatingLogo?.config,
    logoVideo: logoVideo?.config, convergence: convergence?.config, valleyFalls: valleyFalls?.config, opacity: layerOp
  }, { studio, curtain, cartography, lines3d, floatingLogo, logoVideo, convergence, valleyFalls, applyOpacity, applyRouteProgress, applyBeamOutline, applyLeftFog, applyCloudLook });

  /* DRAG FRAMING (2026-11-24, 「給我多一點能控制的角度」): with 「拖曳取景」 on in the panel, drag on the picture to turn the lens (left / right =
     azimuth, up / down = tilt), Shift + drag slides the aim over the land, Alt + drag up / down moves the lens nearer / further. The sliders
     follow, and on release the values are written through the panel (kept, and in 複製參數 JSON). The page's own wheel and clicks are untouched. */
  const dragKeys = ['camera.azimuth', 'camera.tilt', 'camera.distance', 'camera.tx', 'camera.tz'];
  let drag = null;
  const onDown = e => {
    if (!framing.drag || e.button !== 0) return;
    const t = e.target; if (t && t.closest && t.closest('button, a, input, select, textarea, label, [role="button"], .f2p-root, .f2p-box, .f2p-tabs, [data-panel-id]')) return;
    drag = { x: e.clientX, y: e.clientY, az: framing.azimuth, tilt: framing.tilt, dist: framing.distance, tx: framing.tx, tz: framing.tz, shift: e.shiftKey, alt: e.altKey };
    pointer.set(0, 0); e.preventDefault(); e.stopPropagation();
  };
  const onMove = e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.alt) framing.distance = clamp(drag.dist * Math.exp(dy * .004), 4, 40);
    else if (drag.shift) {
      const a = degToRad(framing.azimuth), k = framing.distance * .0012;   /* screen right / up → over the land */
      framing.tx = clamp(drag.tx - (Math.cos(a) * dx - Math.sin(a) * dy) * k, -5, 5);
      framing.tz = clamp(drag.tz - (-Math.sin(a) * dx - Math.cos(a) * dy) * k, -2.8, 2.8);
    } else {
      framing.azimuth = euclideanModulo(drag.az - dx * .18, 360);
      framing.tilt = clamp(drag.tilt + dy * .12, 1, 84);
    }
    for (const k of dragKeys) panel?.refresh?.(k);
    e.preventDefault(); e.stopPropagation();
  };
  const onUp = e => {
    if (!drag) return; drag = null;
    /* write through the panel's own sliders: saved with the rest, marked as changed */
    for (const k of dragKeys) {
      const el = document.getElementById('rise-studio-pbr-' + k), v = k.split('.').reduce((o, p) => o?.[p], { camera: framing });
      if (el && Number.isFinite(+v)) { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    e.preventDefault?.(); e.stopPropagation?.();
  };
  addEventListener('pointerdown', onDown, true); addEventListener('pointermove', onMove, true); addEventListener('pointerup', onUp, true); addEventListener('pointercancel', onUp, true);
  const removeDrag = () => { removeEventListener('pointerdown', onDown, true); removeEventListener('pointermove', onMove, true); removeEventListener('pointerup', onUp, true); removeEventListener('pointercancel', onUp, true); };

  const gulls = !reducedMotion && query.get('birds') !== '0' ? createForestBirds(renderer, {
    atlas, camera: atlas.camera, once: false, panel: false, timedCrossings: true,
    focusDistance: () => atlas.camera.position.distanceTo(aim),
    tune: { flock: 7, solos: 2, size: 1.45, speed: 1.04, every: 5, height: 1, bright: 1.08 }   /* 2026-11-24 client 「飛鳥飛過要頻繁一點」: a flock every 5 s (was 11), two solos (was 1) */   /* lead 11-20 (client: the valley needs a flock flying over): bigger flock, more often (was flock 5, size 1.22, every 22) */
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
    const fovNow = Number.isFinite(state.fov) ? state.fov : framing.fov;   /* FOV: narrows with the turn (update() sets state.fov) */
    if (Math.abs(lens.fov - fovNow) > 1e-4) { lens.fov = fovNow; lens.updateProjectionMatrix(); }
    // The next chapter's lake dive can animate from whichever angle the visitor leaves.
    const dive = smootherstep(zoom || 0, 0, 1);
    const away = 1 - (Number.isFinite(state.turnN) ? state.turnN : 1);   /* MORE ANGLES: 1 at the entry … 0 settled */
    const polar = clamp(framing.tilt + (+framing.entryTilt || 0) * away - z * 12 + (entry?.fore || 0) * .35 - sway.y * (1 - dive) * (+framing.swayY), 1, 88);
    const distance = framing.distance * (1 + (+framing.entryDist || 0) * away) * (entry?.dist || 1) * lerp(1, .065, dive);
    aim.set(framing.tx, Number.isFinite(+framing.ty) ? +framing.ty : .105, framing.tz).lerp(falls ? falls.diveTarget : atlas.lake.center, dive);   /* RISE FALLS: the dive goes to the pool */
    orbit.set(distance, degToRad(lerp(polar, .7, dive)), degToRad(state.azimuth + x * 26 + sway.x * (1 - dive) * (+framing.swayX)));
    lens.position.setFromSpherical(orbit).add(aim);
    lens.lookAt(aim);
    if (+framing.roll) lens.rotateZ(degToRad(+framing.roll) * (1 - dive));
    lens.updateMatrixWorld();
    /* lens shift: the frame slides without turning the lens (off-axis projection); the lake dive takes it back to centre */
    { const e = lens.projectionMatrix.elements, sx = (+framing.shiftX || 0) * 2 * (1 - dive), sy = (+framing.shiftY || 0) * 2 * (1 - dive);
      if (e[8] !== sx || e[9] !== sy) { e[8] = sx; e[9] = sy; lens.projectionMatrixInverse.copy(lens.projectionMatrix).invert(); } }
    return distance;
  });

  const retainCurrent = query.get('wflowCurrent') === '1';
  const removeWaterUpdate = atlas.onUpdate(frame => {
    flow?.update(frame);
    beams?.update({ ...frame, routeProgress: state.routeProgress });
    falls?.update(frame);   /* RISE FALLS */
    valleyDetail?.update();   /* VALLEY DETAIL: follows the land's place and visibility */
    logoVideo?.update(frame);
    if (flow && beams?.group.visible && !retainCurrent) flow.uniforms.uCurrent.value = 0;
  });
  const view = {
    studio, state, cartography, curtain, beams, lines3d, floatingLogo, logoVideo, falls,
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
      state.turnN = Math.min(1, turn / Math.max(.5, smootherstep(1, .12 / CAMERA.arrivalSeconds, 3.55 / CAMERA.arrivalSeconds)));
      state.fov = reducedMotion || !Number.isFinite(+framing.entryFov) ? +framing.fov : +framing.entryFov + (+framing.fov - +framing.entryFov) * Math.min(1, turn / Math.max(.5, smootherstep(1, .12 / CAMERA.arrivalSeconds, 3.55 / CAMERA.arrivalSeconds)));   /* the turn's curve ends a hair short of 1: normalised so the fov lands exactly */   /* FOV: 25 → 14 with the turn, back the same way */
      const growth = clamp((arrivalTime * CAMERA.arrivalSeconds - .15) / (CAMERA.arrivalSeconds - .15), 0, 1);
      state.arrival = 1 - Math.pow(1 - growth, 2.45);
      studio.uniforms.uArrival.value = state.arrival;
      // Read this frame's colour, not last frame's, so light has one precise
      // handoff at every refresh rate. The sweep still covers its first beat.
      if (rhythm && !override && !(M && state.arrival < clamp(+M.lightAt || 0, 0, .98))) routeAdvance = Math.min(1, routeAdvance + dt / (M && +M.lightSeconds > .2 ? +M.lightSeconds : framing.arrivalSeconds * 0.53));
      applyRouteProgress();
      falls?.setArrival(state.arrival);
      convergence?.setArrival(state.arrival); convergence?.setRoute(state.routeProgress); valleyFalls?.setArrival(state.arrival);   /* RISE FALLS: the water comes with the land's colour */
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
      removeDrag();
      falls?.dispose();
      valleyDetail?.dispose();
      logoVideo?.dispose();
      convergence?.dispose();
      valleyFalls?.dispose();
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
