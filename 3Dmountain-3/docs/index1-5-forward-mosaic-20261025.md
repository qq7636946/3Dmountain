# index1-5 · 第二區塊 3D 文字 → 山谷河流：動態模糊＋毛玻璃馬賽克 2026-10-25

## 做了什麼
- LOGO 向前轉場（3D「Finnovation」字飛過去 → 山谷河流）原本只有動態模糊（共用的 `js/water-forward-transition.js`，**沒有改**）。
- 新增一個 index1-5 專用的後製 pass：毛玻璃馬賽克（大小不一的柔邊玻璃方塊、各自錯位放大、霧面顆粒、玻璃邊光、紅藍色散），**排在動態模糊前面**，所以模糊會把方塊邊緣一起拉糊，兩個效果合在一起。
- 跟動態模糊同一個時鐘：飛行進度的包絡 × 捲動速度；停手就跟模糊一起清掉（`hold` 可以讓停住時保留一些）。方塊跟著飛行變大，一塊一塊出現又消失。
- 減少動態：完全沒有。

## 檔案
- `prototypes/index1-5/forward-mosaic.js`（pass 本體、預設值、調整列）
- `prototypes/index1-5/forward-mosaic-build.cjs`（patch main.js：import、`CONFIG.forwardMosaic`、composer 插入、每幀 update、調整面板「LOGO 向前轉場」加列、`__MONTIS_STUDY__.forwardMosaic`）
- `prototypes/index1-5/build.cjs`：helper 清單最後加 `forward-mosaic-build.cjs`（改前備份 `_archive/backups/logoseal-glass-20261025/build.cjs.before-forward-mosaic`）

## 參數（CONFIG.forwardMosaic，調整面板「LOGO 向前轉場」）
amount 1（0＝只剩原本的模糊）｜hold 0｜size .34｜split .6｜shift .5｜magnify .14｜frost .9｜seam .7｜ride .9｜chroma .5｜darken .12｜tint #3f7fe0

## 驗證
- 滾輪中截圖：`.qa/index1-5/fwd-mosaic-motion/sheet.jpg`（桌機）、`fwd-mosaic-motion-phone/sheet.jpg`
- check 0 錯誤；飛行段滾輪中幀時間：馬賽克關 p50 8.3／p95 8.4 ms，開 p50 8.3／p95 8.4 ms，0 幀超過 20 ms。

## 加上：FOUR PATHS → 卡牌（同日）
- 原本只有霧淡出。現在同一個模組再開一個實例 `bridgeMosaic`（`CONFIG.bridgeMosaic`），跟著過場進度 `portfolio.transition` 走：毛玻璃方塊＋**自帶放射動態模糊**（這段沒有共用模糊）＋色散；過場中段最強（約 0.03–0.95），卡牌出來時退掉。
- 時鐘：過場進度的包絡 × 過場本身的速度；`hold .35` 讓停手時留一點。卡牌在自己的 canvas 上，所以卡牌保持清楚，只有後面的山谷變馬賽克。
- 調整面板「卡牌轉場 Cards」加了同一組馬賽克列（多一個「放射動態模糊」，預設 0.3；向前轉場那組預設 0）。
- 第一次使用不卡：前兩幀用 0 強度先畫一次（畫面不變），讓 shader 在載入時就編好。
- 驗證：`.qa/index1-5/bridge-mosaic/sheet.jpg`、`bridge-mosaic-phone/sheet.jpg`；check 0 錯誤；過場中 p50 8.3／p95 8.4 ms，最差 16.7 ms，0 幀超過 20 ms（未預熱前有一幀 50 ms，已修）。
