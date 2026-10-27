# 黃昏湖場景 `world-logo-scene.js` — 整合備忘（場景專家，2026-10-24）

檔案：`prototypes/index1-5/world-logo-scene.js`（介面 B）、實驗頁 `prototypes/index1-5/lab/lake-scene.html`（`http://127.0.0.1:5621/prototypes/index1-5/lab/lake-scene.html`，面板有所有參數，`複製 JSON`）。
證據圖：`docs/logo-seal/evidence/lake/`（`lake-desktop-q0/q50/q100`、`lake-phone-q0/q50/q100`、`compare-ref6-vs-lake`、`lake-desktop-nomark`、`lake-desktop-q100-placeholder`、`lake-daylight-1770/1850`、`lab-panel`）。

## 全站日照（別人加進來的，我沒動）
`world-logo-scene.js` 現在 `import { getSceneDaylight } from './scene-daylight.js'`（2026-10-24 14:34 由他人加入，檔案 `prototypes/index1-5/scene-daylight.js`；建置必須把它一起帶進 js/）。`getSceneDaylight().enabled` 為真時，每幀 `update()` 會用全站太陽（天空、地平線、霧、水色、太陽方向與顏色）蓋掉我的黃昏預設；為假時完全用 `LAKE_DEFAULTS`（= ref-6 的黃昏）。該模組自己的預設狀態是 enabled＝true、6.25 時（清晨），所以**沒呼叫 `setSceneTime` 的環境會看到清晨色**。實驗頁預設把它關掉（只看 LAKE_DEFAULTS），`?daylight=1&hour=17.7` 或面板「全站日照」可預覽（17.7 日落、18.5 藍調）。整合時請確認區塊內 `setSceneTime(hour)` 的時間落在 17–18.5，否則不會是 ref-6 的黃昏。

## 呼叫方式
```js
import { createLakeScene, LAKE_DEFAULTS, LAKE_ROWS } from './world-logo-scene.js';
const lake = createLakeScene({ THREE, renderer, width: 繪製緩衝寬, height: 繪製緩衝高, palette, assetBase, small, reducedMotion });
lake.markAnchor.add(mark.group);              // 符號放這裡；anchor 已依畫面算好位置與縮放（符號高度 1 → 畫面高度 34%）
mark.setEnvironment(lake.environment);        // 玻璃的環境貼圖
lake.onEnvironment = tex => mark.setEnvironment(tex);   // 重要：遠山貼圖載入後（以及改了天空／太陽／遠山／水色參數後）會重烘，換新貼圖
// 每一幀：
mark.update({ yaw, time, q });  lake.update({ q, time });  renderer.render(lake.scene, lake.camera);
lake.setSize(w, h);  lake.setLook({ ...部分鍵 });  lake.dispose();
```
- `width/height` = 你實際繪製的像素大小（RT 或畫布的繪製緩衝），不是 CSS 大小。`setSize` 同義。
- `palette` 的 `deep/lit/ink/foam/glint/sun` 會蓋掉對應預設（`glint`→`glintColor`、`sun`→`sunColor`）；之後 `setLook` 仍可再改。
- `assetBase`：放 `opening-range.webp` 的資料夾網址（結尾 `/`）。沒給時依序試 `new URL('../assets/', import.meta.url)`（建置後 js/ 旁的 assets）和 `./assets/`。找不到只會少了遠山（console.warn），不會壞。
- `update({q,time})`：q 0→1 = 鏡頭由後方 6% 推進到結尾構圖（**LAKE_DEFAULTS 的構圖＝q 1＝ref-6 結尾姿態**）＋光線微變（太陽高 2°、柔光略弱、曝光 +5% 於 q 0）；time = 秒，漣漪／微塵／鏡頭微晃。`reducedMotion` 時一律以 q=1、固定時間，完全靜止。
- `lake.ready`／`lake.whenReady()`：遠山貼圖載入完成。`lake.warm()`：預先編譯 shader（區塊進場前呼叫，避免第一幀卡）。
- 一切在 `createLakeScene` 才建立；`dispose()` 釋放 RT、PMREM、貼圖、幾何、材質（已測：建立／銷毀 6 輪後 `renderer.info.memory` 與 programs 都回到 0）。

## 渲染契約（整合必讀）
1. **符號倒影是自動的**：場景的 `onBeforeRender`（每次 `renderer.render(lake.scene, …)` 一次）會先用鏡像鏡頭把「天空＋markAnchor 裡的一切」畫進半解析 HalfFloat RT（有深度貼圖），再轉成 premultiplied＋mip 貼圖給水面採樣。所以：**符號的姿態要在 render 之前更新好**；放進 markAnchor 的任何 Object3D 都有倒影，不需要 clone。要關：`setLook({reflStrength:0})`（鏡像 pass 就不跑，約省 1 ms）。符號材質必須寫深度（預設即是），倒影遮罩靠深度判斷。
2. **輸出色彩**：預設 `outputDisplay = 1`：背景（天空＋水）寫「顯示色」（原始 sRGB 數字，同 `js/finnovation-world.js`、同材質專家的 `bgDisplay = 1`）。不需要、也不使用色調映射（背景自己在 shader 內軟削頂，沒有純白）。若你的管線是線性（HalfFloat RT、之後自己轉 sRGB），設 `outputDisplay: 0`，並讓材質專家把 `bgDisplay` 設 0。
3. **畫進 RT 時**：three 對任何 RT 一律輸出線性（玻璃如此）；背景則照 `outputDisplay`。已用 `?rt=1`（HalfFloat RT → 全螢幕拷貝 + sRGB）驗證兩條路徑影像一致（用 `outputDisplay: 0`）。8-bit RT 請把 `texture.colorSpace = SRGBColorSpace`（硬體編碼）並用 `outputDisplay: 0`。
4. 玻璃折射看到的是不透明的背景（backdrop 是 opaque 全螢幕，renderOrder −100，深度 1.0）；微塵是 transparent（不被折射，會被符號遮住）。
5. 相機：投影有「鏡頭位移」（地平線放在畫面 `horizon` 高度，垂直線不歪）。我覆寫了 `camera.updateProjectionMatrix`，所以你照常設 `camera.aspect` 再呼叫它也安全，但請改用 `lake.setSize(w,h)`。不要自己動 `camera.position/rotation`（`update` 每幀會設）。
6. 光：場景內有一盞暖色方向光（太陽方向）與一盞天光填充（HemisphereLight），只影響玻璃；`scene.environment` 已設為環境貼圖，`scene.environmentIntensity` = `envIntensity`。

## 手機／降級（`small: true`）
3 層漣漪、1 層取樣、鏡像 RT 同樣半解析（0.5）但像素本來就少、環境 PMREM 128、微塵上限 160；直式（aspect < 1.15）自動切到手機構圖（視角、地平線、符號高度／大小、太陽方位收攏都有獨立參數）。

## 量測（RTX 4070，無頭 Chrome，含 GPU 同步；含正式符號）
1440×900：3.5 ms／幀（不含倒影 2.4 ms）；1920×1080：3.9 ms；2560×1440：5.7 ms；手機 390×844@2：3.4 ms。弱顯卡請對 `small` 或降 `waterScale` 以外的負擔（主要在水面 shader）。

## 客戶規則對照
- 閃點：只在太陽下方的柔光帶內（`glintBand`、`glintFocus`），柔高光＋滾降（`glintKnee`），漣漪八度只畫「一個像素解析得了的」，所以沒有雪花亮點。
- 沒有任何圓形遮罩；全部可調（`LAKE_ROWS`）。


---

# 新增（2026-10-24 下午）：升起 rise、冰湖白晝 glacier — 對照 founderssa.com 的做法

## 參考站研究（只看畫面，不抄碼；截圖 12 張在 `docs/logo-seal/evidence/founders/`）
頁面全長約 9744 px（Lenis 平滑捲動），最後一段從 scrollY 約 7900 開始：
1. **7900–8000**：淡藍底上一個圓角視窗，裡面是冰湖（卡片／視窗），地平線上有一顆很小、半透明的球，水面有小小的倒影。
2. **8100**：視窗展開成滿版（水波感的邊緣；無圓形遮罩），球仍在遠處、很小；**8300–8500**：球逐漸變大、變近。
3. **8650（半沉）**：球只露出上半，被水線**一刀橫切成筆直的線**（沒有看到亮環／擴散同心圓，只有一條乾淨的切線）；倒影只鏡射水面以上那一截，**緊貼著水線往下接**，邊緣被橫向波紋撕成鋸齒（水平方向的位移，不是整體晃動），愈往下愈淡、愈模糊，亮度低於球本體（被水色稀釋）。
4. **8800（剛好貼水）→ 8950 → 9127（升起）**：球往上離水，球底與倒影頂之間出現空隙（就是平面鏡像：空隙＝2×離水高度）；倒影**與球同步**，大小形狀隨球變；球在這一段大小不變（拉近發生在更早），**位移只有約半個到 0.7 倍球徑**。
5. 環境：天空淡藍到近白、細絲狀高雲；兩側低矮的雪丘（藍影白頂，邊緣有被水面扭曲的倒影帶）；水面近白、鏡面般亮、**幾乎沒有閃點**；左上有一顆小藍色玻璃珠／光點；沒有看到空中飄浮微塵。
6. 標題「Unlock Your Potential」在左下，按鈕在其下；文字與球不重疊。

## 介面：`lake.update({ q, time, rise })`
- `rise` ∈ [0,1]，預設 1（＝結尾位置，與舊版完全相同，向下相容）。**0＝符號完全沉在水面下（不畫、不鏡像，只有靜水）**，1＝結尾。
- `rise` 先過緩動（`riseCurve`：0 線性 → 1 smootherstep），`markAnchor.position.y = 結尾高度 − (1−緩動)×riseSink×符號高度`（`riseSink` 預設 1.12，剛好整個沉下去）。
- 裁切：世界座標 y=0 的 clipping plane，套到 `markAnchor` 底下**所有材質**（每幀掃描一次，新材質下一幀吃到；平面常駐，rise=1 時 constant 設 1000＝不裁，所以不會因 rise 變動重編 shader）。`renderer.localClippingEnabled` 在建立時打開、dispose 時還原。主畫面、折射的 transmission pass、鏡像 pass 都吃得到；折射的背景（天空、水）仍正確。
- 水線效果（`contact` ＝符號是否與水面相交，離水就淡掉，結尾位置為 0）：
  · **水線亮邊 meniscus**：沿切線前緣的亮線（因為鏡頭低，水面被壓扁約 200 倍，所以亮邊最細也畫成約 2 像素）；
  · **同心漣漪環**：以符號在水面上的「腳印」為源向外擴散（腳印由鏡像覆蓋率讀回：128 格、全程在 GPU，無 CPU 讀回）；強度＝rise 的速度（|Δrise|），停下後依 `ringDecay` 秒衰減；環帶有明暗（亮脊暗谷）並扭曲倒影與天空反射；
  · **水面被推開**：腳印周圍一圈緩緩外傾的法線。
- 倒影：只含水面以上（同一個裁切）、與 rise 同步；淡出高度從「水線」起算；新增 `reflWobble`（倒影邊緣橫向鋸齒，參考站的特徵）。
- `reducedMotion`：rise 一律 1（沒有升起、沒有環）。符號完全沉下時整個 `markAnchor.visible=false`（只在我們自己隱藏時才恢復，不會蓋掉整合工程師自己設的 visible）。

## 外觀預設：`look.preset`
`LAKE_PRESETS = { dusk, glacier }`；`setLook({ preset: 'glacier' })` 或旋鈕 `glacierMode`（0/1）。**LAKE_DEFAULTS 與預設行為完全不變**（preset = 'dusk'，仍吃全站日照）。`glacier`：淡藍天空漸層到近白的地平線、細絲雲（`cloudAmount…`）、程序低矮雪丘（`hills…`，藍影白頂，也可用 opening-range.webp 以 `rangeRock`/`rangeRockMix` 重新上成冰藍白）、近白的鏡面湖（`fresnelMin` 高、`waterTint` 低）、極淡暖光、地平線柔霧（`mistAmount…`）、兩顆慢閃的小藍光點（`sparkCount…`）、較強的倒影扭動。**glacier 時自動不吃全站日照**（色彩由預設自己決定）。`setLook({ preset, reset:true })` 會把該預設的數值整組重套。
改了 preset 後 `lake.getLook()` 會回傳整組數值（含 `preset`、`glacierMode`），整合工程師的面板請在切換後重讀。

## 新增參數（LAKE_ROWS，中文標籤；皆不改變黃昏預設的畫面）
升起（11）：起始沉入深度、緩動、漣漪環 強度／間距／擴散範圍／擴散速度／衰減時間、水線亮邊 強度／寬度、水線柔光暈、水面被推開。
外觀：冰湖白晝（0/1）。冰丘（6）：強度、高度、起伏密度、表面紋理、雪色、藍影色。遠山重新上色（2）：岩色、比例。雲絲（4）：量、大小、速度、顏色。地平線柔霧（3）：量、高度、寬度。湖面：細微漣漪（最細兩層）、倒影染上水色。符號倒影：水平扭動。藍光點（4）：數量、大小、閃爍速度、顏色。

## 對照參考站的差異（誠實版）
- 參考站的球是「磨砂雪球」；我們的是水玻璃符號，水線切面會看到玻璃內部（極薄的一條，視角低時幾乎是一條線）。
- 參考站水線**沒有**明顯的 meniscus 亮環／同心圓；客戶要求有，所以我做了而且都能關（`meniscus`、`ringAmp`、`pushAmp` 設 0 就和參考站一樣是乾淨切線）。
- 參考站的雪丘比較「綿」且有大塊亮面；我是程序低丘（噪聲輪廓＋藍白漸層＋細紋），遠看接近，近看沒有他們的細節。
- 參考站幾乎沒有水面閃點與空中微塵；glacier 預設把閃點壓到 0.1、微塵降到 34 顆。
- 注意：`light-specks.js`（他人加入）在湖面畫了許多白色小點，看起來像雪花點，和客戶「不要雪花閃點」的規則衝突；那不是我的檔案，已回報總指揮。
