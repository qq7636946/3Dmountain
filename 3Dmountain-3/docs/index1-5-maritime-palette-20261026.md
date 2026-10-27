# index1-5 Maritime 色調（2026-10-26）

依使用者確認：修改 `index1-5.html`，以 `index1-3-maritime.html` 及附圖作色調參考。參考頁與目前 UI 排版不修改。

## 色彩與材質

- 採參考頁最後 EVEREST preset 的霧藍灰色票：天空上緣 `#18374e`、地平線 `#aebfc9`、深水 `#294c60`、中段水色 `#7d9da9`、天空反射 `#27475e`／`#c9d4d7`。
- 海浪與河流使用參考頁的水體／Fresnel 反射配色，保留原本波浪頂點與法線。沿用兩層低頻反射色變化，無新貼圖、幾何或渲染通道。
- 主水滴、散珠、螺旋水滴與液態字母轉為銀白、低飽和灰藍反光；浮光、水下亮光及暈影使用同一色系。
- 山谷天空、雲、補光與距離霧接上參考色票；近景到空拍沿用同一水面材質與既有霧深。保留太陽方向、強度、鏡頭、章節時間、岸線及光流動態。
- 色彩覆寫在日照時鐘改變後同步一次，避免被自動日照還原；原 M 面板色彩編輯在時間未改變時保留。
- 僅主 `index1-5` 啟用新 shader 分支，排除 `data-opening-refinement`。後段世界／投資卡片開啟時停止覆寫其日照色彩。

## 來源與輸出

- 新增來源：`prototypes/index1-5/maritime-water-palette-build.cjs`。
- `build.cjs` 在先前 `water-palette-build.cjs` 之後執行新色調，重建保留設定。
- 實際輸出：`prototypes/index1-5/js/main.js`。HTML 只更新入口及 preload 的快取版本：`maritime-palette-a27c16b736e5`。
- 原版備份：`_archive/backups/index1-5-maritime-palette-20261026/`；manifest 同時記錄參考頁與排版 CSS 雜湊。
- 獨立 dry build：`.qa/maritime-palette-20261026/verified-build/`。目前為本機預覽，未部署 Git。

## 驗證

- 最後的 `.qa/maritime-palette-20261026/final-build/` 與實際 main.js 比對一致，忽略匯入快取字串；HTML 與修改前相比只有兩處 main.js 快取版本不同。
- 參考 HTML／JS、三份版型 CSS、既有水滴執行檔及前一版 palette helper 的雜湊維持不變。
- Chrome 實際 WebGL 預覽檢查首頁、水滴／液態字母、山谷近景及匯流空拍；390×844 檢查首頁、河道與空拍。兩種尺寸無 JavaScript 或 shader 錯誤。手機測試為瀏覽器尺寸預覽，非實機效能量測。
- 最後採不注入 Live Reload 的獨立靜態預覽檢查，避免其他檔案變動使場景重新載入；驗證完成後關閉 QA 分頁及伺服器，恢復瀏覽器尺寸。
- 畫面紀錄：`C:/Users/lee/.codex/visualizations/2026/10/26/finnovation-maritime-palette/` 的 `home.jpg`、`letters.jpg`、`river-close.jpg`、`river-aerial.jpg` 及 `mobile-*.jpg`。
