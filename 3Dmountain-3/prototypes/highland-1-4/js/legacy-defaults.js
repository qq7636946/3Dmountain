/* index1-4 · settings objects of index1-1's procedural canyon (built by prototypes/highland-1-4/build.cjs from the
   shared modules named below — do not hand-edit). main.js only reads them; the canyon itself is not loaded here. */
// from js/water-journey-scene-463.js
export const WATERSHED_STYLE_DEFAULTS = Object.freeze({
  rockColor: '#899baa', skyColor: '#8fa5ba', mistColor: '#c2cdd6',
  exposure: 1, haze: 1, relief: 1
});
// from js/water-journey-scene-463.js
export const SHORELINE_DEFAULTS = Object.freeze({
  foam: .75,        // 岸邊浪花蕾絲：水面側與岩石側同一條接觸線
  shallow: .8,      // 淺水透亮：越靠岸越淺、越亮
  reflect: .55,     // 岸壁倒影：近岸水面映出山壁的暗色
  wet: 1,           // 濕岩帶：水線上方被水打濕的深色帶
  micro: 1,         // 岩面紋理：世界座標的法線擾動，依像素足跡淡出，不會閃
  strata: 1,        // 岩層層理：沉積層的橫向層階
  crease: 1,        // 岩縫陰影：凹處（溝、縫、層階下緣）壓暗
  frost: .55,       // 高處霜色：高而平的坡面帶一點霜白（在遠霧/銀色色域內）
  pebbles: 0,       // 岸邊小碎石與碎石扇：使用者不要（在山壁上讀成一顆顆暗點），1 = 放回
  foamColor: '#e9f0f4'
});
// from js/water-journey-scene-463.js
export const RELIEF_DEFAULTS = Object.freeze({
  ridge: 1,       // 山脊銳利：主稜線的刀鋒感（ridged multifractal 的權重）
  erosion: 1,     // 沖蝕溝紋：順著坡往下的沖蝕溝（幾何 + 著色）
  ridgeFrost: 1,  // 稜線霜白：只落在凸起稜線與高處的霜
  layers: 1,      // 遠山層次：一層一層往後退的空氣透視
  bankWater: 1,   // 近岸水色：近岸水面的深色反射提亮、壓平，不再是一塊塊深藍
  aerialGrain: 1,  // 空拍岩面顆粒：空拍時 22 單位等向小凹凸的保留比例（1＝舊的皺紙感，.3＝從高空看的岩面）
  ridgeFine: 1,    // 山脊細碎（重整生效）：近處網格最細的兩層稜紋（91／190 單位）保留多少；0＝不再像皺紙，1＝舊的樣子
  tone: 1,         // 稜谷明暗層級：以 72／216 單位的地形尺度上明暗（稜亮、谷暗），不再逐頂點雜點
  branching: 0,    // 分枝沖蝕溝（重整生效）：0＝index4-6-1 的細密順坡溝紋；1＝主溝＋支溝、間距不一、岩性軟硬不同
  gullySpan: 440,  // 主溝間距（重整生效）：坡面主沖蝕溝的間距，另有 1/2、1/4 的支溝匯進來
  erodibility: 1,  // 岩性差異（重整生效）：軟岩溝深、硬岩幾乎不破，同一座山上的溝深淺不一
  facet: 0,        // 山峰稜面（重整生效）：每座近山從山頂放射 3–5 道刀鋒稜，稜間是凹下的坡面
  asym: 0,         // 山坡不對稱（重整生效）：一側陡壁、一側長坡
  rockBands: 1,    // 岩帶：45° 以上的陡壁出現斷續的深色岩層帶（空拍）
  snow: .6,        // 雪溝積雪：雪積在平台與沖蝕溝裡、沿溝往下延伸（空拍）；霧裡的雪，不是白漆
  snowLine: 600,   // 雪線高度（世界單位）：山抬高之後雪線跟著上移，雪只留在高處
  lift: 1.4,       // 山體抬高（重整生效）：近處山體的高度倍數（像把山體高度拉到 1.8 的高度，但不拉尖；LOGO 環山與遠山不動）
  peakRound: .8,   // 山頂圓潤（重整生效）：0＝刀鋒尖頂，1＝圓潤的稜頂＋同樣陡的山坡
  crestSoft: .1,   // 稜線柔化（重整生效）：稜紋的刀鋒稍微圓一點，高山上不會冒出一根根尖刺
  density: 1,      // 山的數量（重整生效）：河與河之間的空地補上更多山體
  slopeCap: 1.15,  // 河谷坡度上限（重整生效）：從河邊往上最陡約 49°，兩河之間是山脊不是尖塔；0＝不限
  crestTame: .35,  // 山頂不尖（重整生效）：稜紋細節在高山上只按比例長三分之一，山高但頂不會長成針（1＝舊的比例）
  valleyReach: .9,  // 谷坡寬度（重整生效）：河谷兩側爬升到整座山高所需的距離；越小山谷越陡、河間的山體越厚實（不會被削成尖塔）
  farSoft: .08,    // 遠山稜線柔化（重整生效）：遠處網格的刀鋒稜線圓一點，不再是一根根針
  horizon: .6,     // 地平線霧化：越遠的山越淡、山腳沉進霧裡，一層一層往後退，不再像剪紙
  valley: 0,       // 谷底寬度（重整生效）：河在一片谷底上蜿蜒（谷軸較直、下游較寬、山夾處較窄），不再是兩條跟著河彎的路肩
  fan: 1,          // 沖積扇（重整生效）：谷壁腳下往谷底攤開的扇狀堆積，打破山腳與谷底之間那條乾淨的線
  gap: 1           // 環山峽口（重整生效）：河穿過環山的峽谷在外坡腳張開成漏斗，谷內山嘴交錯，不再是兩道平行的牆
});
// from js/water-journey-scene-463.js
export const CANYON_VIEW_DEFAULTS = Object.freeze({
  height: 2.4,      // 視角高度：鏡頭離水面的高度
  lookAhead: 29,    // 前視距離：沿河道往前看的距離（越短越低頭看水、越長越望向峽谷深處）
  lookHeight: 2.9,  // 視線高度：注視點的高度（比鏡頭高 = 微微仰視）
  pitch: 0,         // 俯仰角（度）：在注視點上再加的仰角，正值抬頭、負值低頭
  fov: 0,           // 視野偏移（度）：加在 64° 起始視野上
  fovRamp: 5,       // 視野漸寬（度）：進峽谷後視野慢慢張開的幅度（原本 64 → 69）
  lateral: 0,       // 左右偏移：離河道中線的距離，正值往右岸
  bank: 1,          // 彎道側傾：轉彎時鏡頭側傾的倍數
  bob: 1            // 起伏晃動：貼水前進時上下起伏的倍數
});
// from js/water-confluence-fx-463.js
export const WATERSHED_FLOW_DEFAULTS = Object.freeze({
  count: 1, width: .065, brightness: 1, speed: 1, glow: .65,
  color: '#dcecf4', mist: .6, coreTint: 0,
  // Light-line shaping (read only when a page passes flowConfig; pages that
  // omit it keep the original seven blue filaments untouched):
  // core = crispness of the white-hot centre, halo = width of the soft
  // falloff that spills over the water, pulse = travelling comet packets,
  // sparkle = sun glints riding the current, join = extra light where rivers
  // meet, meander = how much the strands braid, depth = fade into valley haze.
  core: .6, halo: .7, pulse: .85, sparkle: .5, join: 1, meander: .6, depth: .75,
  // The comet head (光束頭) and its train, all 1 = the look as designed:
  // headSize = how long the head is along the river, headBright = how hot it
  // burns, headGlow = the halo it throws, headWidth = how thick it is across,
  // tail = length of the fading train behind it, spacing = gap between packets.
  headSize: 1, headBright: 1, headGlow: 1, headWidth: 1, tail: 1, spacing: 1,
  // launch = how the light comes out as the valley opens (0: fades in everywhere at once, as before; 1: runs down
  // the rivers from their sources to the confluence), launchGlow = how hot its leading reach burns,
  // surge = how much it quickens and brightens while the page is being scrolled (the page writes _surge, 0–1).
  launch: 0, launchGlow: 1.5, surge: 0
});
// from js/water-canyon-watershed-463.js
export const WATERSHED_TERRAIN_DEFAULTS = Object.freeze({height:1,ridge:1,relief:1});
