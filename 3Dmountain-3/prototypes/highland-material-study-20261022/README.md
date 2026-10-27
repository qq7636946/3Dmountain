# FINNOVATION — Highland Material Study

2026-10-22 · 獨立材質／光影測試，**尚未整合或覆寫正式網站**。

## 開啟與操作

在專案現有 Live Server 開啟：
http://127.0.0.1:5502/prototypes/highland-material-study-20261022/

若使用交付副本，請以任意靜態 HTTP 伺服器提供本資料夾，再開啟 index.html；不要直接用 file:// 雙擊開啟。所有執行時依賴已本機化，不需連到 CDN。

- 「岩壁近景／高地空拍」切換構圖；滑鼠滾輪與方向鍵上下亦可切換。
- 「側光／陰天」比較凸凹、陰影和反光。
- 「暫停動態」停止水波及輕微鏡頭漂移，仍可操作視角。
- prefers-reduced-motion 預設靜止，切換鏡頭也不補間。
- 右上「製作說明」可查看面數、貼圖解析度及素材出處。
- `?quality=low` 強制輕量模式；`?view=aerial` 直接看空拍。

## 本次實作

1. 從專案已有授權的原始地形萃取 513×513 高度場，保留侵蝕山脊。降低垂直拉伸並重塑海岸；沒有使用原素材的雪白色貼圖。
2. 桌機以 256×256 網格呈現，山體 131,072 三角面；小螢幕／低記憶體裝置使用 128×128 網格，32,768 三角面。相對**原始素材的 524,288 三角面**分別減少 75%／93.75%，不是對正式場景整體效能的比較。
3. 2K（輕量為 1K）岩壁與草地成套 PBR：色彩、OpenGL 法線、粗糙度，搭配原地形烘焙侵蝕法線。色彩貼圖使用 sRGB，資料貼圖不作色彩轉換。三平面投影、坡度混合、濕岸深色、谷地遮蔽。
4. 銀白海面、局部冷藍波光、平面反射、動畫波紋、依實際高度場產生的岸邊白沫。不是海洋流體模擬，白沫也不是流體粒子。
5. 程序天空、柔化陰影、距離霧、固定兩組相機。靜態山體陰影只更新一次，避免每幀重繪陰影；反射仍需要額外場景繪製。
6. 貼圖載入失敗會顯示提示並退回基礎材質；WebGL2 或必要地形檔失敗會明確顯示錯誤。離頁釋放幾何、貼圖、反射目標及 renderer。

## 測試與限制

測試為本機 Chrome 瀏覽器自動化：1600×1000 桌機、834×1112 平板尺寸、390×844 手機尺寸、減少動態模式、故意阻擋一張法線貼圖。包括：WebGL 編譯／HTTP 錯誤、視角往返、光照切換、說明面板、版面溢出、水波暫停／恢復、幾何有限數值及資源數量。

完整結果和截圖在交付資料夾的 preview/。手機和平板是**視窗尺寸模擬，非實機 GPU 測試**；未宣稱已達特定 FPS。低畫質以螢幕寬度及可取得的記憶體資訊判斷，並非 GPU 自動基準測試。

本頁是可執行的第一版視覺驗收樣張，不是宣稱與 Everest 參考站達成同等攝影寫實。近景輪廓仍受低面數網格限制，海面是平面反射而非多重散射／真實流體；參考站的完整後製、地形資產、鏡頭敘事未複製。確認這兩個視角及材質方向後，再另行批准整合正式頁。

## 素材與授權

### 地形與侵蝕法線 — CC BY 4.0

This work is based on **“Snowy Mountain V2 - Terrain”**
https://sketchfab.com/3d-models/snowy-mountain-v2-terrain-4c70cd82edd44951b7af6c144545df34
by **artfromheath** https://sketchfab.com/artfromheath
licensed under **CC BY 4.0** https://creativecommons.org/licenses/by/4.0/

修改：原網格萃取高度場、降面、改變高度比例與海岸、換為岩石／苔地材質，原法線縮為 2K／1K 並混合新材質。原授權原文保留在 assets/terrain-license.txt；網站發布時不可移除署名與授權連結。

### PBR 貼圖 — Powered by Poly Haven / CC0

- Cliff Side: https://polyhaven.com/a/cliff_side
- Aerial Grass Rock: https://polyhaven.com/a/aerial_grass_rock
- 授權：https://polyhaven.com/license
- 原始下載 URL、MD5 校驗與來源清單見 assets/manifest.json。
- 原始 2K JPEG 下載保留於交付資料夾的 source-assets/。網站使用壓縮的 WebP，未虛增貼圖原生解析度。

### Three.js r170 — MIT

vendor/THREE-LICENSE.txt 保留授權。vendor/Water.js 及 assets/waternormals.jpg 來自同版本官方範例：
https://github.com/mrdoob/three.js/tree/r170/examples

Water.js 唯一本機擴充為 getRenderTarget()，用於釋放反射 RenderTarget。水色／岸線 shader 修改在 study.js。

## 開發檔案

- index.html / study.css：獨立測試介面，無正式站引用。
- study.js：地形生成、場景、光線、水面、相機、生命週期。
- terrain-material.js：三平面 PBR、坡面混合與侵蝕法線。
- build-assets.cjs：開發用資產整理腳本，使用此電腦既有 Sharp；不是網頁執行時依賴。
- qa.cjs：本機 Chrome 測試腳本，需此電腦 Playwright 與 5613 靜態測試伺服器。
- formal-before.json：本次開始時，正式入口和核心材質／控制程式的 SHA-256 快照。

獨立原型依 Sites 本機流程建立與驗證，未註冊站點、未上傳或發布。
