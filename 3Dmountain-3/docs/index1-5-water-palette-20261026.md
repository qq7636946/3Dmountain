# 水滴與海浪配色統一（2026-10-26）

依客戶第 5 張截圖，以現有海浪的深冷藍、銀藍反射為基準。僅套用 index1-5；不修改共用 js 原始碼或其他版本頁面。

## 變更

- 新增 `prototypes/index1-5/water-palette-build.cjs`，在原有材質預設之後套用；重新執行 build 仍保留。
- 主水滴與海浪採相同反射色頻道比例，虹彩由 .58 降為 .02；收斂白色亮核、邊光與光斑。
- 散開珠與螺旋珠沿用主珠色調，減少不同珠子的偏色、暖色閃光與霧白。
- 三種圓珠材質使用相同保留亮度的冷藍平衡，去除移動反射中的綠紫色偏。海浪及山谷不套用這個圓珠色彩函式。
- 液態字母與包覆字母的水滴，統一透光、厚處、暗環及反射帶的銀藍灰配色。
- 修改的是材質與光色，未改動幾何、鏡頭或章節時間。

## 檔案

主要來源：

- `prototypes/index1-5/water-palette-build.cjs`（新增）
- `prototypes/index1-5/build.cjs`（加入建置步驟）

實際材質輸出：

- `prototypes/index1-5/js/main.js`
- `prototypes/index1-5/js/water-logo-drops.js`

`index1-5.html` 與其他產生的模組會隨 build 更新匯入版本。比對備份並忽略版本字串後，其餘既有輸出內容一致。最後建置版本：`i15-mvop6r0i`。

## 備份與驗證

- 原始 HTML 與完整 index1-5 資料夾備份：`_archive/backups/water-palette-20261026/`。
- 當時瀏覽器面板的參數、調整前後截圖：`C:/Users/lee/.codex/visualizations/2026/10/26/finnovation-water-palette/`。
- `node prototypes/index1-5/build.cjs` 成功；原先停用的 boot / firstpass / cover 效能實驗仍停用。
- 來源與兩支材質輸出的 `node --check` 通過。
- 1440×900：檢查主水滴、分散／螺旋水滴、液態字母及海浪的實際渲染。
- 390×844：重新載入，確認 WebGL 成功與手機首屏配色。
- 瀏覽器無 JavaScript／shader 錯誤；仍有原有 raymarch 迴圈衍生數警告。
- Chrome 原有預覽已由 Live Server 自動更新；本機生效，這次未進行遠端部署。

## 河道延伸（同日）

依後續「山谷河道的浪也要跟這些統一」，將近景、升空與匯流空拍接回同一套冷藍灰／銀藍水色。

- `water-palette-build.cjs` 的 `patchRiverMain()` 統一河流反射環境、光核及暈影色，仍保留山谷太陽方向。
- 河流底色 `#203c50`、銀藍反射 `#c5dce9`、反射強度 `.82`；原本 M 面板的河流色彩參數仍可調整。
- 近景保留原反射再加入同色系調色；空拍沿用原章節轉換，但不再將水面明暗壓縮成單一色帶。遠景仍混合山谷原有距離霧。
- 僅主頁啟用 `RIVER_WATER_PALETTE`；`data-opening-refinement` 頁沿用原河流材質分支。
- 未更動浪形、幾何、鏡頭、章節時間、岸線、光流或排版；沒有增加渲染通道或貼圖。
- 已保留先前水滴與液態字母調色；河道前備份在 `_archive/backups/river-palette-20261026/`，本次直接修改前的執行檔亦留在 `.qa/river-palette-20261026/before/`。
- 目前頁面版本：`river-palette-4d256e1d1309`。實際執行檔與獨立 dry build 比對一致，HTML 除快取版本外不變。此次先更新本機預覽，未部署遠端。
- 最後以 Chrome 的桌機 1872×1007 預覽檢查 03／04／05 章節，390×844 預覽檢查 03／05 章節；兩種材質分支無 JavaScript 或 shader 錯誤。這是瀏覽器尺寸預覽，未量測實機效能。截圖為上述視覺紀錄資料夾的 `after-river-*.jpg`。
