# LOGO 收尾區塊（Logo Seal）— 共同簡報（2026-10-24）

客戶要的（原話，傳給 hk5.5 的最新需求）：
「現在要新增一個區塊，轉場方式跟地球到橫移一樣，這新區塊在橫移以下出現，中間是 LOGO1 的 LOGO 平旋轉一圈，結尾如圖（6.webp），用 LOGO1 下去做，但 LOGO 的質感材質還要再調整，你自己找一組這方面專業團隊處理。」
之後客戶要我接手完成、**直接接在 index1-5.html**（不是原型）。hk5.5 只做了稽核文件與一個獨立原型（`docs/logo1-block-audit-20261024.md`、`prototypes/logo1-block/`），沒有接進頁面。

參考圖（本資料夾）：
- `ref-6-logo-end-pose.webp`：**結尾姿態**。LOGO 1 玻璃符號（透明的鑄造玻璃，弧形、有厚度的斜切邊，淡藍灰色，亮邊）正面朝向鏡頭，浮在黃昏藍紫天空與霧中遠山之上，左上有暖色太陽光暈，下方是起伏的藍色水面，空中有小水滴。這是主場景「LOGO 章節」的畫面；新區塊要像是它的安靜版回聲（呼應開場，把整個旅程收回來）。
- `ref-5-hubtown-lake.webp`：**構圖參考**（別人的網站，只借構圖不借設計）：暗藍湖面、左右兩側山坡、湖心地平線上一個發光物件、水面倒影與細小光點、物件下方是大標題與一段內文。

## 位置與轉場
- 位置：index1-5 世界段（`#fiWorld`）裡，海洋橫移（RESPONSIBILITY／四個策略章）**之後、頁尾（contact）之前**。
- 轉場：同「地球 → 海洋」的做法：**全幅 WebGL 水波**由滾動驅動，帶泡沫亮線、折射，把海洋橫移段最後一格的畫面掃走，露出新場景。**不可以用圓形遮罩**（客戶明確說過）。往回捲會倒放。
- 新場景：低機位看向地平線的黃昏湖（色調跟山谷／開場一致：藍紫天空、暖色低太陽在左上、霧中遠山、水面有細浪與太陽閃點、空中有微塵／水滴），**LOGO 1 玻璃符號站在湖心上方**，水面有倒影。
- LOGO 動態：隨滾動繞垂直軸平旋轉**一圈**（ease in-out），結尾回到正面（= ref-6 的姿態）並停住；旋轉量與滾動同一個時鐘（往回捲會倒轉）。
- 文字（下方，版型像 ref-5）：小標 `THE FINNOVATION SPIRIT`、大標 `FINNOVATION`＋中文 `恒灝創新`、一行內文（暫用站內既有句子「匯聚科技知識，連結金融價值。」）。**這些字是暫用，等客戶核可**；全部放在一處好改。不要新增按鈕或連結。
- 減少動態：沒有波浪，改淡入淡出；符號靜止在正面。
- 手機：直式構圖（符號縮小置中偏上，文字在下），解析度與粒子數降級。

## 團隊與檔案所有權（只改自己的檔案；別人的檔案只讀）
| 角色 | 交付檔 | 說明 |
|---|---|---|
| 材質專家 | `prototypes/index1-5/world-logo-mark.js`（＋實驗頁 `prototypes/index1-5/lab/logo-mark.html`） | LOGO 1 幾何與材質（見下「介面 A」） |
| 場景專家 | `prototypes/index1-5/world-logo-scene.js`（＋實驗頁 `prototypes/index1-5/lab/lake-scene.html`） | 黃昏湖場景（見下「介面 B」） |
| 整合工程師 | `prototypes/index1-5/world-logo.js`、`world-logo.css`、`world-logo-build.cjs`、對 `build.cjs` 的最小修改、`-stub.js` 暫代檔 | 轉場、時鐘、DOM、面板、接進 index1-5 |
| 總指揮（我） | 驗收、`docs/index1-5-logo-seal-20261024.md` | |

共同規則：
- 專案根：`G:\我的雲端硬碟\2026_專案資料夾\2607_恒灝\site\3Dmountain-3`（Google Drive 同步，Windows；Bash 用正斜線）。靜態伺服器（不會自動重新整理）：`http://127.0.0.1:5621/`。不要用 5502 截圖。
- 回覆與文件用**繁體中文**，程式識別字英文。
- **不可以**手改 `prototypes/index1-5/js/*`（建置產物）、共用的 `js/`、`css/`、其他頁面、`presets/*.json`；**不可以**刪任何檔案、不可以 git commit/fetch；不下載檔案、不新增文案連結。
- **只有整合工程師可以執行建置**（`node prototypes/index1-5/build.cjs`）。材質／場景專家用自己的實驗頁測試（實驗頁直接 import 自己的模組，用 index1-5.html 同一組 importmap：three@0.170.0 與 three/addons，從 jsdelivr）。
- 一次只開一個瀏覽器：用 `scripts/index1-5/lib.cjs` 的鎖（`acquireLock`／`releaseLock`、`launchBrowser`；先讀該檔），或用現成工具；Chrome 路徑與 GPU 參數見 `scripts/index1-5/README.md`。
- 世界段的其他人（海洋段）已在 12:08 之後沒有再改，但 `world-ocean*.js/cjs/css`、`js/finnovation-world.js` 一律**只讀**；整合用「新檔案＋錨點補丁」（`once(source, anchor, replacement)`，錨點必須剛好出現一次）。
- 所有可調的數值做成參數（面板列格式：`['中文標籤', 'key', 最小, 最大, 步進]`，顏色只寫 `['標籤','key']`），預設值寫在模組裡。客戶看重：每個視覺／動態都能調。
- 性能：桌機 60 fps 不掉；沒進入該區塊時完全不繪製、不佔 GPU 記憶體（延遲建立）。手機降級。
- 成品要能 `?logoseal=0` 一鍵關閉整個區塊（頁面回到原本）。

## 介面 A：`world-logo-mark.js`（材質專家）
```js
export const MARK_DEFAULTS = { /* 所有數值，JSON 可序列化 */ };
export const MARK_ROWS = [ ['中文標籤', 'key', min, max, step], ... ];   // 同 alpine-light-params.js 的列格式
export async function createLogoMark({ THREE, SVGLoader, svgUrl, renderer, look }) {
  // svgUrl = images/logo.svg（LOGO 1）。回傳：
  return { group,            // THREE.Group，原點置中，高度正規化為 1，正面朝 +Z（yaw=0 即結尾姿態）
           setLook(look),    // look = { ...MARK_DEFAULTS 的任何鍵 }，即時生效
           setEnvironment(texture), // 場景專家給的環境貼圖（PMREM 後的天空／湖），可為 null
           update({ yaw, time, q }), // yaw：弧度，由整合工程師依滾動給；你負責套到 group.rotation.y 與任何隨 yaw／time 的細微變化
           dispose() };
}
```
目標質感：**水做的玻璃**——邊緣圓潤（大圓角、厚度有水滴般的表面張力感，不是切割壓克力的平面斜邊）、透光折射、淡藍灰吸收色、清漆高光、邊緣亮線，旋轉時折射與高光流動；結尾正面的剪影與色調要接近 ref-6。可用 MeshPhysicalMaterial（transmission／thickness／ior／attenuation／clearcoat）加自訂 onBeforeCompile 細節；注意 transmission 需要場景有可折射的背景（湖景）。

## 介面 B：`world-logo-scene.js`（場景專家）
```js
export const LAKE_DEFAULTS = { ... };  export const LAKE_ROWS = [ ... ];
export function createLakeScene({ THREE, renderer, width, height, palette, assetBase, small, reducedMotion }) {
  // palette = { deep, lit, ink, foam, glint, sun } 十六進位字串（整合工程師從 CONFIG.watershedWater／alpineLight 讀來的山谷色）
  return { scene, camera,
           markAnchor,       // THREE.Object3D：LOGO 群組要加到這裡（世界座標由你決定；高度約畫面 36–42%、佔畫面高度 ~34%）
           environment,      // THREE.Texture | null：給符號折射／反射用（天空＋太陽＋遠山）
           update({ q, time }),  // q：0–1 區塊進度（0＝剛被浪帶進來，1＝結尾），time：秒
           setSize(w, h), setLook(look), dispose() };
}
```
內容：天空漸層（藍紫，左上暖色低太陽光暈與柔光）、遠山（可用 `prototypes/index1-5/assets/opening-range.webp`，讀 `opening-world.js` 看怎麼取樣；或程序生成剪影＋霧層）、湖面（細浪、天空反射、太陽閃點，**閃點不要像雪花雜訊**：集中在太陽反射帶、柔化高光）、符號倒影（可用鏡像＋漣漪扭曲＋菲涅耳衰減，或平面反射 RT；手機降級）、空中微塵／水滴（少量、慢）、輕微暗角。色調貼近 ref-6 與開場。

## 介面 C：整合（整合工程師）
- `world-logo-build.cjs`：helper，接在 `world-ocean-build.cjs` 之後（`build.cjs` 的清單加一項，並**讓 helper 能讀寫 `extra`**：把呼叫改成 `require('./'+n)({main,drops,letters,glass,html,extra})`，其他 helper 不受影響）。它對 `extra['finnovation-world.js']`（world-ocean-build 已補丁過的世界模組）做錨點補丁，並新增 `extra['world-logo.js']`、`extra['world-logo-mark.js']`、`extra['world-logo-scene.js']`（檔案存在就用正式版，否則用 stub），在 html 的世界段 DOM 裡於 contact 之前插入區塊 `<section data-world-part="logo">…`，在 index1-5.css／world-logo.css 加樣式（比照 world-ocean-build 的內容雜湊連結法），在 tuner 加群組「LOGO 收尾 Logo Seal」（桌機 `?tune=1` 或 `T`），CONFIG 預設值。
- 時鐘：區塊長度（螢幕高為單位）＝波浪 W＋旋轉 R＋停留 H，皆為參數；`y`（世界捲動）→ `q_wave`, `q_spin`；往回捲對稱。轉場期間把「海洋最後一格」與「湖景」各畫進離屏 RT，用水波合成 shader（泡沫亮線、折射、羽化前緣，不可有圓形遮罩）；區塊之外只畫該畫的那一個，區塊未啟用時完全不畫。
- 頁首／介面：區塊內頁首維持白字（深色場景）；進度列／聲音鈕沿用海洋段規則；`.fi-footer` 等不新增。
- 手機、減少動態、`?logoseal=0`、鍵盤 Tab 不會讓畫面亂跑（參考 `.fiwo-pin` 的處理）、`context lost` 不當機。
- 驗證用 `scripts/index1-5/` 的工具（check／world-shot／wheel／probe／perf／tuner／config）；擴充 world-shot 的點位也可以，但不要改既有行為。
