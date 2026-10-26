/* One scroll-driven sun. Imported WITHOUT a query so the opening, valley and world share this instance.
   Colours are Three linear RGB; CSS/display-referred shaders must convert on output. No wall-clock animation:
   stopping holds the sun, and returning to an earlier scroll position restores exactly the same light. */
import * as THREE from 'three';

export const DAYLIGHT_DEFAULTS = Object.freeze({ enabled: 1, /* Client 2026-10-25: daylight enabled; retain the manually selected hour. */ auto: 0, hour: 12, azimuth: 0, elevation: 1, sun: 1, sky: 1, warmth: 1, exposure: 1 });
export const DAYLIGHT_ROWS = [
  ['全站日照（1 開／0 原手動光）', 'sceneDaylight', 'enabled', 0, 1, 1],
  ['跟隨捲動（0＝手動預覽時間）', 'sceneDaylight', 'auto', 0, 1, 1],
  ['手動 場景時間（小時）', 'sceneDaylight', 'hour', 5.5, 20, .05],
  ['太陽 方位偏移（度）', 'sceneDaylight', 'azimuth', -90, 90, .5],
  ['太陽 升起高度倍率', 'sceneDaylight', 'elevation', .25, 1.6, .01],
  ['太陽 光照倍率', 'sceneDaylight', 'sun', 0, 2, .01],
  ['山谷 天空補光倍率', 'sceneDaylight', 'sky', .4, 1.8, .01],
  ['夕照 暖色比例', 'sceneDaylight', 'warmth', 0, 1.5, .01],
  ['開場／山谷 曝光倍率', 'sceneDaylight', 'exposure', .65, 1.3, .01]
];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const C = hex => new THREE.Color(hex);
// Artist-controlled sky/light stops: the same grey-blue rock is warmed by light, rather than recoloured per chapter.
const STOPS = [
  [5.5, '#243c5d', '#697e99', '#b1a8ae', '#a2afbd', '#ffbb88', '#eee0d4', '#6f819b', '#7c94ae', '#416374', 1.3, 1.55],
  [7.0, '#29496d', '#7799b3', '#c6c9c9', '#b6c6d1', '#ffd3a6', '#f5e9db', '#8095ab', '#90a6bf', '#4d7483', 3.4, 1.7],
  [11.5, '#2d5682', '#7299b9', '#c4d2dd', '#b7c9d7', '#ffebce', '#f0f1ec', '#7e96b1', '#91a9c1', '#527a8b', 5.1, 1.8],
  [15.0, '#304e75', '#7a94af', '#c0c7cd', '#b1c1cd', '#ffddae', '#f1e6d8', '#7c91a8', '#8ca4bd', '#4b7083', 4.5, 1.75],
  [16.4, '#344d70', '#8794a7', '#c7b5a9', '#b4b9c3', '#ffc895', '#efdbc9', '#7c8ba6', '#8b9cb5', '#496a7d', 3.2, 1.65],
  [17.7, '#2b405f', '#7b7e98', '#c39c8a', '#a3a8ba', '#ffaf7c', '#dbc3bc', '#6b7d9c', '#8196b2', '#3c596e', 1.65, 1.55],
  [18.5, '#20334f', '#536b8c', '#9190a6', '#7c91ab', '#f3b99b', '#a8b7cc', '#4d6586', '#728eb1', '#304b65', .05, 1.45],
  [20.0, '#13263d', '#2d4668', '#657e9e', '#657f9f', '#cad7ed', '#8da6c5', '#3e587b', '#6888ae', '#29425e', 0, 1.35]
].map(([hour, top, mid, horizon, fog, sun, cloudLit, cloudShade, shadow, sea, intensity, fill]) =>
  ({ hour, top: C(top), mid: C(mid), horizon: C(horizon), fog: C(fog), sun: C(sun), cloudLit: C(cloudLit), cloudShade: C(cloudShade), shadow: C(shadow), sea: C(sea), intensity, fill }));
const state = {
  enabled: true, hour: 6.25, phase: 'DAWN', elevation: 3, azimuth: -27, daylight: 1, dusk: 0, night: 0, intensity: 2,
  sunDirection: new THREE.Vector3(), sunColor: C('#ffd3a6'), skyTop: C('#29496d'), skyMid: C('#7799b3'), horizon: C('#c6c9c9'), fog: C('#b6c6d1'),
  cloudLit: C('#f5e9db'), cloudShade: C('#8095ab'), shadow: C('#90a6bf'), sea: C('#4d7483'), exposure: 1
};
let config = null, base = null, wasEnabled = false, lastKey = '', cssKey = '';
const tmp = new THREE.Color(), neutral = C('#f4e9da');
const hex = color => '#' + color.getHexString();
export function getSceneDaylight() { return state; }
export function configureSceneDaylight(CFG) {
  config = CFG;
  base = {};
  for (const key of ['field', 'openingWorld', 'alpineLight']) base[key] = { ...CFG[key] };
  base.portfolio = CFG.portfolio?.base?.slice();
  lastKey = ''; wasEnabled = false;
}
function publishCSS() {
  if (typeof document === 'undefined') return;
  const key = [state.enabled, state.hour.toFixed(2), state.exposure].join('|');
  if (key === cssKey) return; cssKey = key;
  const root = document.documentElement, style = root.style;
  style.setProperty('--scene-night', state.night.toFixed(4));
  style.setProperty('--scene-dusk', state.dusk.toFixed(4));
  style.setProperty('--scene-daylight', state.daylight.toFixed(4));
  style.setProperty('--scene-sky', hex(state.skyMid));
  style.setProperty('--scene-ink', state.night > .5 ? '#e3eaf3' : '#20354b');
  style.setProperty('--scene-glass', state.night > .5 ? 'rgba(40,61,84,.32)' : 'rgba(215,224,233,.22)');
  const phase = state.phase.toLowerCase(), enabled = state.enabled ? 'on' : 'off';
  if (root.dataset.scenePhase !== phase) root.dataset.scenePhase = phase;
  if (root.dataset.sceneDaylight !== enabled) root.dataset.sceneDaylight = enabled;
}
export function setSceneTime(requestedHour) {
  const P = config?.sceneDaylight || DAYLIGHT_DEFAULTS;
  const on = P.enabled > .5;
  state.enabled = on;
  if (!on) {
    if (wasEnabled && base) {
      for (const key of ['field', 'openingWorld', 'alpineLight']) Object.assign(config[key], base[key]);
      if (base.portfolio) config.portfolio.base.splice(0, 3, ...base.portfolio);
    }
    wasEnabled = false; lastKey = ''; publishCSS(); return state;
  }
  wasEnabled = true;
  const hour = clamp(P.auto > .5 ? requestedHour : P.hour, 5.5, 20);
  const key = [hour, P.azimuth, P.elevation, P.sun, P.sky, P.warmth, P.exposure].join('|');
  if (key === lastKey) return state; lastKey = key;
  state.hour = hour;
  state.phase = hour < 7.5 ? 'DAWN' : hour < 14 ? 'DAYLIGHT' : hour < 16.5 ? 'AFTERNOON' : hour < 18.3 ? 'SUNSET' : 'BLUE HOUR';
  let i = 0; while (i < STOPS.length - 2 && hour > STOPS[i + 1].hour) i++;
  const a = STOPS[i], b = STOPS[i + 1], t = smooth(a.hour, b.hour, hour);
  for (const [out, field] of [['skyTop','top'],['skyMid','mid'],['horizon','horizon'],['fog','fog'],['sunColor','sun'],['cloudLit','cloudLit'],['cloudShade','cloudShade'],['shadow','shadow'],['sea','sea']]) state[out].copy(a[field]).lerp(b[field], t);
  state.sunColor.lerp(neutral, clamp(1 - P.warmth));
  if (P.warmth > 1) state.sunColor.lerp(C('#ffb581'), (P.warmth - 1) * .3);
  const arc = (hour - 6) / 12;
  state.elevation = clamp(Math.sin(arc * Math.PI) * 48 * P.elevation, -24, 82);
  state.azimuth = -12 + clamp(arc, 0, 1.2) * 24 + P.azimuth;
  const el = state.elevation * Math.PI / 180, az = state.azimuth * Math.PI / 180;
  state.sunDirection.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  state.daylight = smooth(-5, 5, state.elevation);
  state.night = smooth(18.15, 19.7, hour);
  state.dusk = smooth(15, 17.6, hour) * (1 - smooth(18.3, 19.7, hour));
  state.intensity = lerp(a.intensity, b.intensity, t) * P.sun * state.daylight;
  state.exposure = P.exposure;
  if (config) {
    const L = config.alpineLight, W = config.openingWorld, F = config.field;
    Object.assign(L, {
      sunAzimuth: state.azimuth, sunAzimuthAerial: state.azimuth, sunElevation: state.elevation, sunElevationAerial: state.elevation,
      sunColor: hex(state.sunColor), sunIntensity: state.intensity,
      rimAzimuth: state.azimuth, rimElevation: Math.max(-6, state.elevation - 4), rimColor: hex(state.sunColor), rimStrength: .5 * state.daylight * P.sun,
      shadowColor: hex(state.shadow), shadowStrength: lerp(a.fill,b.fill,t) * P.sky, fillShare: .72,
      groundColor: hex(tmp.copy(state.shadow).multiplyScalar(.3)), ambient: .23 * P.sky,
      skyZenith: hex(state.skyTop), skyMid: hex(state.skyMid), skyHorizon: hex(state.horizon), fogColor: hex(state.fog), valleyHazeColor: hex(state.fog),
      cloudLit: hex(state.cloudLit), cloudShade: hex(state.cloudShade), hazeSunGlow: .38 * state.daylight, glowStrength: .58 * state.daylight, flare: .16 * state.daylight,
      brightness: P.exposure, sunSize: .85
    });
    Object.assign(W, {
      sunAzimuth: state.azimuth, sunElevation: state.elevation, sunColor: hex(state.sunColor), sunStrength: (.5 * P.sun + state.intensity * .17) * state.daylight,
      sunDisc: 2.6 * state.daylight, goldHorizon: (.07 + .13 * state.dusk) * state.daylight,
      glintColor: hex(state.sunColor), glintStrength: .5 + .2 * state.daylight, glintTint: hex(state.sunColor),
      seaTint: hex(state.sea), hemiSky: hex(state.shadow), hemiGround: hex(tmp.copy(state.sea).multiplyScalar(.55)), moteColor: hex(state.cloudLit)
    });
    Object.assign(F, { top: hex(state.skyTop), zenith: hex(state.skyTop), upper: hex(state.skyMid), horizon: hex(state.horizon),
      lower: hex(tmp.copy(state.sea).multiplyScalar(.8)), floor: hex(tmp.copy(state.sea).multiplyScalar(.12)), ink: '#08131f' });
    // The card canvas reads its clear colour only when mounted; keep it constant through its bridge and strip.
    // This same value also drives the canyon fog at the handover, so no white plate cuts across the sunset.
    config.portfolio.base.splice(0, 3, .66, .70, .75);
  }
  publishCSS(); return state;
}

export function journeySceneHour({ progress, clock, logoStart, logoEnd, max, portfolio = null }) {
  if (portfolio?.open) return lerp(15.7, 16.4, clamp(portfolio.transition * .35 + portfolio.strip * .65));
  if (progress < .52) return lerp(6.25, 7.05, smooth(0, .52, progress));
  if (progress < logoStart) return lerp(7.05, 8.7, smooth(.52, logoStart, progress));
  if (progress < logoEnd) return lerp(8.7, 10.2, smooth(logoStart, logoEnd, progress));
  // Hold the same sun throughout the pre-rendered valley handoff, then let the afternoon arrive during the ascent.
  if (clock < 2.35) return 10.2;
  if (clock < 6.4) return lerp(10.2, 13.7, smooth(2.35, 6.4, clock));
  return lerp(13.7, 15.7, smooth(6.4, 10.18, clock));
}

if (typeof globalThis !== 'undefined') globalThis.__SCENE_DAYLIGHT__ = state;
