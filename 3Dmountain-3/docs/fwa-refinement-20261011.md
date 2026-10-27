# FINNOVATION：效能與互動細節優化（2026-10-11）

入口為 index.html。本輪保留既有美術、玻璃材質、水滴字母動畫、模型細分和渲染解析度，處理執行成本與操作連續性。未新增套件、素材或網路服務。

## 實測

同一台 Windows／Chrome／RTX 4070，修改前原始檔案保存在 .qa/fwa-20261011/baseline。每場景預先推進 150 幀，再取 90 幀。手機欄位是 390 × 844 的瀏覽器模擬，仍使用桌機 GPU，不能當作手機實機 FPS。

| 場景 | 修改前 KB／幀 | 修改後 KB／幀 | 暫存配置減少 |
|---|---:|---:|---:|
| 桌機 Logo | 233.8 | 183.0 | 21.8% |
| 桌機峽谷 | 59.5 | 45.8 | 23.0% |
| 手機尺寸 Logo | 192.1 | 150.3 | 21.8% |
| 手機尺寸峽谷 | 56.0 | 45.5 | 18.7% |

Logo 與峽谷的繪製呼叫、三角形數及 GPU 時間維持相同；改善主要在 CPU 與暫存配置，並非減少模型細節。桌機 Logo CPU 中位時間本次為 1.3 → 1.0 ms，但短時間計時會受系統負載影響，不據此宣稱固定 FPS 增幅。首屏載入時間未證實改善；本輪沒有公開網址的 PageSpeed 分數。

## 程式與介面

- js/main.js：移除兩次不必要的 Logo 子樹世界矩陣遍歷；玻璃折射與主畫面共用同一幀矩陣，離開渲染區段時恢復自動更新，保留非同步預熱行為。其他章節不額外更新未使用場景。
- js/water-logo-drops.js：使用已更新的矩陣與逆矩陣求座標；快取不變的色彩來源，再複製已解析的色彩至水滴 uniform。仍支援可變 Color 與即時調色。
- 滾輪：在頁首、章節列、CTA 和頁尾上仍能繼續場景；選單、參數面板、輸入欄與水平手勢保留自己的操作。
- 鍵盤：聚焦導覽按鈕後仍可用 PageUp／PageDown、方向鍵、Home／End。Space 保留原生按鈕操作；章節切換時焦點不留在 inert 的文案中。
- js/finnovation-interface.js：選單同步標記當前章節；橫向章節列在尺寸改變時重新對齊目前項目。
- css/interface.css：手機章節目標至少 44px；橫向觸控裝置使用水平章節列；短視窗選單改兩欄，關閉區置頂。選單 hover 使用 transform，減少 padding 動畫造成的排版工作。保留 reduced-motion 規則與安全區域間距。
- index.html：更新 build-version、CSS 和主模組快取雜湊；主模組也更新修改過的相依模組 URL。

## 驗證

- scripts/perf-ab/verify-refinements.cjs：通過 Loading 階段介面透明／品牌隱藏、導覽上滾輪、鍵盤導覽、Space 開啟選單而不推進旅程、選單捲動隔離、Escape 關閉與焦點返回、章節狀態與焦點、手機直橫向尺寸、一般 localhost 頁面及參數面板捲動、reduced motion、模組載入失敗的文字降級。
- scripts/restructure/verify-race.cjs：不帶查詢參數，23 個本機 CSS／JS 請求各延遲 1200ms，仍進入 WebGL；無 page error／console error。
- scripts/seo/check-seo.mjs：通過 metadata、canonical、三種結構化資料、10 個靜態章節與社群圖片驗證。
- 靜態畫面比較：兩種尺寸的 Logo／峽谷 192px 縮圖差異為 0；全尺寸峽谷 PNG 雜湊一致。開場浮動粒子存在自然差異。
- 動態比較：Logo → 前進 → 峽谷 → 河流的路徑／啟用後製一致。水滴動態差異與「原版對原版」控制組同量級，不宣稱每一動態像素完全一致。
- Node 語法檢查：三個修改過的 JS 模組通過。

## 查核與重跑

詳細數據、截圖及控制組結果在 .qa/fwa-20261011/。comparison-desktop.md、comparison-phone.md 為完整比較；before/、after/ 為畫面。

本機展示網址：http://127.0.0.1:5211/index.html?tune=0

重跑操作測試：

    node scripts/perf-ab/verify-refinements.cjs http://127.0.0.1:5211/
    node scripts/seo/check-seo.mjs

本輪更新本機檔案，尚未發布這輪變更至 GitHub Pages。
