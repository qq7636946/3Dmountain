# 高地草坡／銀白藍反射 — 2026-10-21

本機入口：`http://127.0.0.1:5502/index1-3-maritime.html?view=canyon`

上一輪藍海比較：`http://127.0.0.1:5502/index1-3-maritime.html?view=canyon&look=textured-blue`

## 變更

- 延用兩張原有岩層／植被 WebP，不新增圖片下載與材質記憶體。
- 原藍青植被在 shader 內以亮度重映射成苔綠／橄欖草坡；陡壁使用深灰石質，草覆蓋範圍及海拔提高。
- 降低山體 lift（2.2 → 1.55）、尖頂細紋與細碎侵蝕；主地形網格密度不變。山形改成較厚實的草覆肩坡，並非重建河道。
- 夕橘與高飽和藍光改成偏中性的陰天光、灰綠遠霧；保留雲貼圖但降低其夕色。
- 水體以銀白／灰白為主。藍色來自反射方向及漂動雲隙，不是整片底色；保留現有波形、流速、岸邊泡沫。
- 為符合藝術方向，銀白水模式的最低反射權重設 .30；這是風格化材質，不宣稱是完整物理海水模擬。雲隙為程序化天空近似，不是場景平面反射追蹤。
- 空拍仍保留部分動態反射，不完全壓成單一水色色帶；湖面沿用自己的波紋材質及新的水色參數。
- 開場環境、玻璃水滴反射配色同步；未更改水滴模型或動畫。
- 白水上的主文案使用深墨綠字，空拍綠山上維持白字；按鈕調成灰綠玻璃。版面結構與文案未改。
- 螢幕顆粒 .055 → .018，使岩層與水面更乾淨。

## 保持不變

相機路徑、滾動時間軸、LOGO 湖輪廓、五河拓樸、影片、其他頁面和根目錄共用 JS 未修改。
桌機山體＋近岸仍為 306,720 三角面，手機 182,572；沒有再增加面數。

## 驗證範圍

- Chrome／RTX 5060 Laptop／ANGLE D3D11。
- 桌機 1440×900、手機模擬 390×844：峽谷、山脊、俯瞰、終章、返回峽谷，無 JS／shader／HTTP 錯誤；position／normal 均為有限值。
- 實際 wheel 事件前進及反向通過（7.494 → 8.0168758 → 7.494）。
- 開場水滴與海面額外截圖；上一輪 textured-blue 比較模式正常載入。
- 本機 5502 入口 HTTP 200。僅本機檔案，沒有部署。
- 圖片／報告位於 `.qa/maritime-textures/highland-*`。行動尺寸為瀏覽器模擬，未實測手機 GPU／FPS。

## 修改前備份

`_archive/backups/maritime-highland-20261021/` 保留本輪前的 HTML、main.js、terrain-texture-detail.js、兩份山體模組與 maritime.css。復原請先比較後續使用者改動，勿整個資料夾覆蓋。

主要改動位置：

- `prototypes/maritime-landscape/js/main.js`：HIGHLAND 配置、銀白水面／藍色雲隙反射。
- `prototypes/maritime-landscape/js/terrain-texture-detail.js`：草地／岩石重新配色與覆蓋。
- `prototypes/maritime-landscape/js/water-journey-scene-463.js`：將 highland 設定傳給材質。
- `prototypes/maritime-landscape/maritime.css`：文字對比、按鈕與 UI 配色。
- `index1-3-maritime.html`：快取版本。

執行測試使用既有 `scripts/check-maritime-textures.cjs`，新增 `--blue` 比較及 `--hero` 開場截圖選項；測試伺服器為 5613，交付後關閉，不影響使用者的 5502 Live Server。
