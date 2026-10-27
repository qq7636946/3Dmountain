# index1-5：高山岩脊與山腰流雲（2026-10-23）

依客戶提供的 Everest 山景截圖，調整 `index1-5.html` 的山景外觀。這輪在前一版 Ascent 字體色調與藍色光流之上修改；開場、水字、河道與卡牌保留。

- **山形**：在舊 1010 預設之後設定本頁的山景參數，恢復次級山群、主稜缺口、分枝侵蝕溝，收束過長的山頂平台。山形運算只在載入烘焙時執行；沿用原網格，沒有新增頂點或逐幀地形運算。河床切割、近岸取樣、鏡頭路線與品牌地形函式保持原樣。
- **岩材**：冷灰藍裸岩、較少植被、灰褐碎石坡；共用既有照片貼圖，降低大塊礦物色差與法線斜紋。保留近岸小岩石的高光抗鋸齒。
- **積雪**：只啟用主地形的高處雪，依坡度、背風與世界 XZ 座標的供雪斑塊分布，裸岩與積雪交錯；海岸石塊不積雪。避免用高度噪聲製作反覆繞山的雪帶。
- **光與霧**：降低均勻環境補光、增加方向光層次；拉升時依鏡頭高度限制均勻霧量，保留稜線清晰度。
- **雲**：桌面 19 組、手機 11 組雲團，位置參照本頁地形高度。低空是稀薄側谷雲，拉升時展開山腰與後景雲；沿時間緩慢漂移、邊緣柔化、受地形深度遮擋。全部合併為一次 instanced draw，沒有新圖片、深度貼圖或全螢幕 ray march；支援 reduced motion 與釋放資源。

## 維護

重建：`node prototypes/index1-5/build.cjs`

新增 `alpine-shape-build.cjs`、`alpine-light-build.cjs`、`clouds-build.cjs`、`js/alpine-cloud-banks.js`；更新既有 `material-build.cjs` 與 `js/index1-5-terrain.js`。所有檔案均在 `prototypes/index1-5/`，共享 root js 和 index1-4／Ascent 不改動。

備份：`_archive/backups/index1-5-alpine-20261023/`。

## 驗證

- Chrome D3D11，桌面 1440×900 與手機 390×844：開場、字標、峽谷、低空河道、匯流、結尾六階段。console errors、失敗請求與水平溢出皆 0；水珠照片請求仍 0。
- 雲層獨立 GPU 編譯／透明初始狀態／reduced motion／dispose 通過。19／11 組雲均為一次繪製，未新增網路素材。
- shape-check：三個模組語法通過；河床與河岸核心函式不變；新增 crest multiplier 在 .82–1 範圍內。
- 下捲開卡牌、上捲返回、回到峽谷光流恢復均驗證。
- 截圖與 JSON：`.qa/index1-5-alpine/`。本輪沒有重新測量 PageSpeed 或宣稱 FPS 分數。
