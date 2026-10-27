# index1-5 · 轉場加 igloo.inc 的細節 2026-10-25

## igloo.inc 的轉場是什麼（看我們自己錄的 75 幀：`.qa/index1-5/igloo/`）
- **像素拉絲／錯位**：邊緣（地平線、物體輪廓、霧的邊）碎成一列一列的小段，有的把第一個像素拉長整段、有的左右錯開、有的變粗格子（輪廓變成階梯狀）；也有往上拉的直條。
- **彩虹色散**：沿邊緣一道薄膜彩虹（橘→藍→紫），亮處更明顯。
- **冷霧**：場景被冷白色的霧吞掉、霧一團一團滾動，霧後換場景。
- **往中心的放射模糊、底片顆粒、整體去色偏冷。**
- 以上都會**閃**（每秒換好幾次圖案），所以停著也是活的。

## 做了什麼（全部只在 index1-5，共用檔沒動）
1. **地球 → 海洋「刷過去」那段**（主要需求）：`world-dive-fx.js`，畫在世界段每幀最後。海洋的水波（`world-ocean.js`，沒改）照常掃過，但它的前緣被一道**冷霧帶**蓋住並跟著走，前緣附近有像素拉絲／錯位／階梯格、往上拉的直條、彩虹色散、往中心的模糊、顆粒、變冷。只在浪橫越畫面時出現（往回捲一樣）。減少動態：沒有。
2. **卡牌 → 地球 雲層**：同一個模組，雲層捲進來到撕開之間，加輕量的拉絲＋色散＋顆粒（沒有霧帶，雲層本身就是霧）。
3. **第二區塊 3D 字 → 山谷、FOUR PATHS → 卡牌**（`forward-mosaic.js` 兩個實例）：毛玻璃方塊的邊緣加 igloo 拉絲／錯位＋顆粒。
4. **原則段 → LOGO 毛玻璃**（`world-logo.js` glass）：同樣加拉絲／錯位＋顆粒。

## 參數（都在調整面板）
- 「海洋章節 Ocean」最上面：`worldDive` — amount（0＝原本的水波）、fog、band、glitch、block、dispersion、radial、grain、cold、flicker、deck（卡牌→地球那段，0 關）、fogColor。
- 「LOGO 向前轉場」／「卡牌轉場 Cards」：`glitch`、`grain`（各自一組）。
- LOGO 毛玻璃：`glassGlitch`、`glassGrain`。

## 檔案
- 新：`prototypes/index1-5/world-dive-fx.js`、`world-dive-fx-build.cjs`（patch 本頁的 finnovation-world.js 副本與 main.js；build.cjs helper 清單最後）。
- 改：`forward-mosaic.js`、`world-logo.js`、`world-logo-build.cjs`。備份 `_archive/backups/igloo-20261025/`、`_archive/backups/logoseal-glass-20261025/build.cjs.before-world-dive`。

## 驗證
- 截圖：`.qa/index1-5/dive-igloo-b/`（刷過去）、`dive-igloo-off/`（原本）、`igloo-site-a/`（雲層、LOGO、刷過去）、`fwd-mosaic-motion/`、`bridge-mosaic/`；全部 0 錯誤，check 0 錯誤。
- 效能：刷過去段滾輪中 p50 8.3／p95 8.4 ms；開效果最差 17 ms，不增加卡頓。第一次經過刷過去段有一幀 67 ms，是**原本就有的海洋首次建置**（效果關掉也一樣），不是這次加的。

## 沒做（可再加）
- igloo 的**文字亂碼解碼**（標題換段時字元亂跳再定住）——之前字體特效被要求還原過，所以先不動。
- 海洋 04 → 原則段（`world-principles.js`，別的工作階段的檔）。

## 客戶回饋後（同日）：有雜訊的轉場都拿掉
- 卡牌 → 地球：回到原本的雲層（`worldDive.deck` 0）。
- 地球 → 海洋：雜訊（拉絲／錯位／直條／顆粒）全關，改成**毛玻璃馬賽克方塊**沿浪前緣（新參數 `mosaic`、`mosaicSize`、`mosaicShift`、`mosaicZoom`、`mosaicSeam`）；保留冷霧帶、彩虹色散、往中心的模糊、變冷。畫面邊緣改成鏡像取樣（不再有邊緣拉長的條紋）。
- LOGO 毛玻璃：`glassGlitch`、`glassGrain`、`glassFrost` 全 0（只剩馬賽克＋動態模糊）。
- 第二區塊 3D 字 → 山谷、FOUR PATHS → 卡牌：`glitch`、`grain`、`frost` 全 0；放射模糊改成均勻 12 取樣（沒有逐像素亂數）。FOUR PATHS → 卡牌自帶的模糊關掉（`blur` 0，長模糊會出現漣漪殘影），色散降到 .15：只剩乾淨的毛玻璃方塊。
- 雜訊參數都還在面板上（預設 0），要找回某一段的效果可以單獨開。
- 截圖：`.qa/index1-5/dive-mosaic-b/`、`bridge-mosaic/`、`logo-nonoise/`、`dive-mosaic-a/`（含卡牌→地球 y:450）；check 0 錯誤。
