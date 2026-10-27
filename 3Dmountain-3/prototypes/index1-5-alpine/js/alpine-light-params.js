/* index1-5-alpine：天空、雲、打光的即時參數（everest.suraj.work 的低角度金色側逆光）。
   一個扁平、可變的物件：場景每一幀都讀它，所以調參面板直接改這裡的值就會即時生效。
   匯入時一律寫成 `import { ALPINE_LIGHT } from './alpine-light-params.js';`（不加查詢字串），
   每個匯入者才會拿到同一個實例。顏色是 '#rrggbb'（sRGB，與 CSS 相同）。 */
export const ALPINE_LIGHT = {
  // 太陽：方位 0 = 正前方（沿河往下游、-Z），負值往左、正值往右；高度是離地平線的仰角。
  sunAzimuth: -40,
  sunElevation: 16,
  sunColor: '#ffdcb8',
  sunIntensity: 4.4,
  // 逆光邊緣：沿太陽方位、貼著地平線的暖光，只打亮面向太陽的稜線與雪面（不投影）。
  rimStrength: 1.1,
  rimColor: '#ffc690',
  // 陰影（天空補光）：背光面被天空照亮的冷藍灰。
  shadowColor: '#7f9de0',
  shadowStrength: 2.6,
  fillShare: .5,         // 陰影面直接補光（不受地形 AO 壓暗）佔陰影補光強度的比例
  groundColor: '#6f6a66',
  ambient: .4,           // 環境反射光（IBL）：越低明暗對比越強
  // 天空：天頂 → 中段 → 地平線的三段漸層。
  skyZenith: '#0d2f6e',
  skyMid: '#3b74b9',
  skyHorizon: '#cbd8e6',
  hazeHeight: .24,       // 地平線霧帶高度（0–1，仰角的 sin）
  skyGrain: .55,         // 天空底片顆粒
  sunSize: 1,            // 太陽圓盤大小
  glowSize: 1,           // 太陽光暈大小
  glowStrength: 1,       // 太陽光暈強度
  flare: .45,            // 鏡頭橫向光芒
  // 霧與空氣透視
  fogColor: '#b9c9dc',
  fogNear: 1,            // 近景霧濃度（峽谷內，倍數）
  fogFar: 1.15,          // 遠景霧濃度（空拍，倍數）
  // 雲
  cloudAmount: 1,        // 雲量（2 = 全部雲團）
  cloudHeight: 230,      // 雲層高度：谷中雲團整體上下移（230 = 依地形放置的原位）
  cloudSoftness: .55,    // 雲邊柔和
  cloudDrift: 1,         // 雲飄速度
  cloudLit: '#fff0e0',   // 受光面
  cloudShade: '#7487a6', // 背光面
  cloudSea: 1,           // 地平線遠方雲海
  skyClouds: .8,         // 高空積雲
  // 空氣中的細雪／冰晶
  particles: 1,
  // 整體亮度（乘在所有光、天空與雲上）
  brightness: 1
};

/* 調參面板列：[中文標籤, key, min, max, step]；顏色列只有 [標籤, key]。 */
export const ALPINE_LIGHT_ROWS = [
  ['太陽方位（度）', 'sunAzimuth', -180, 180, 1],
  ['太陽高度（度）', 'sunElevation', 1, 60, .5],
  ['陽光顏色', 'sunColor'],
  ['陽光強度', 'sunIntensity', 0, 8, .05],
  ['逆光邊緣強度', 'rimStrength', 0, 5, .05],
  ['逆光邊緣顏色', 'rimColor'],
  ['陰影補光顏色', 'shadowColor'],
  ['陰影補光強度', 'shadowStrength', 0, 5, .05],
  ['陰影面直接補光比例', 'fillShare', 0, 1.5, .01],
  ['地面反光顏色', 'groundColor'],
  ['環境反射光', 'ambient', 0, 1.5, .01],
  ['天頂顏色', 'skyZenith'],
  ['天空中段顏色', 'skyMid'],
  ['地平線顏色', 'skyHorizon'],
  ['地平線霧帶高度', 'hazeHeight', .03, .8, .01],
  ['天空顆粒', 'skyGrain', 0, 2, .05],
  ['太陽大小', 'sunSize', .3, 4, .05],
  ['光暈大小', 'glowSize', .2, 4, .05],
  ['光暈強度', 'glowStrength', 0, 3, .05],
  ['鏡頭光芒', 'flare', 0, 2, .05],
  ['霧色', 'fogColor'],
  ['近景霧濃度', 'fogNear', 0, 4, .05],
  ['遠景霧濃度', 'fogFar', 0, 4, .05],
  ['雲量', 'cloudAmount', 0, 2, .05],
  ['雲層高度', 'cloudHeight', 60, 700, 5],
  ['雲邊柔和', 'cloudSoftness', .05, 1.5, .05],
  ['雲飄速度', 'cloudDrift', 0, 5, .1],
  ['雲受光面顏色', 'cloudLit'],
  ['雲背光面顏色', 'cloudShade'],
  ['遠方雲海', 'cloudSea', 0, 2, .05],
  ['高空積雲', 'skyClouds', 0, 2, .05],
  ['飄雪粒子量', 'particles', 0, 3, .05],
  ['整體亮度', 'brightness', .3, 2, .01]
];

/* 預設值的副本，給「重設」用。 */
export const ALPINE_LIGHT_DEFAULTS = Object.freeze({ ...ALPINE_LIGHT });

// 除錯／擷取腳本用：同一個實例。
if (typeof globalThis !== 'undefined') globalThis.__ALPINE_LIGHT__ = ALPINE_LIGHT;
