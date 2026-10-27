# Highland Confluence — 2026-10-23

目前頁面：index1-4.html。這輪調整僅在本機；以下記錄取代 README 舊版預設與路線說明。

## 視覺與動線

- 預設 confluence 色調介於原 sunny 與 maritime：冷藍灰水色、暖灰岩石、米白文字。開場水滴恢復 maritime 式深藍反射與較低虹彩。
- 山景在 A WIDER PERSPECTIVE 的 q=8.96（camera -300,1020,-3700）完成拉升，後續直接進卡牌；移除預設旅程中後續四段山景巡遊。
- 中央島以解碼後高度場雕除，半徑 600、過渡 120、海床 -16。相機碰撞、岸線與地形共用修改後資料。原始 Blender 與壓縮高度資產保留。
- 移除階梯地形以及岩層週期色帶；岩石改用連續礦物色、斜向雜訊與微表面，避免岩壁照片自帶水平條紋。草地仍用照片細節。
- 冰藍細光流貼水、受山體遮擋；多路流線在出海口縮成單一主流，避免穿山線與合流亮度暴增。
- 卡牌導覽先等待場景到位與卡牌就緒，再啟動霧中轉場；反向滾動可退回。一般開啟不自動打開調參面板。
- 手機空拍章節列改深色，峽谷內保留淺色，改善天空背景上的對比。

## 檔案與建置

- prototypes/highland-1-4/build.cjs：唯一建置入口。
- confluence-build.cjs：預設參數、縮短路線、卡牌導航與介面副本補丁。
- js/highland-scene.js：高度場雕除、場景色調與材質載入。
- js/highland-terrain-worker.js：移除週期階梯與中央島密度加成。
- js/highland-material.js：v5 無水平條紋岩面。
- js/highland-lights.js：貼水與合流光線。
- highland.css：文字、色調及手機章節列。

執行 `node prototypes/highland-1-4/build.cjs` 重建生成檔；勿直接編輯產出的 js/main.js 或 js/finnovation-interface.js。
`?look=sunny`、`?look=overcast` 保留色調比較，但新版地形與材質共用，並非完整舊版還原。動工前備份位於 _archive/backups/highland-confluence-20261022/。

## 驗證

- Chrome headless + D3D11：桌機 1440×900、手機模擬 390×844。
- 兩種尺寸：載入完成、q=8.96 終點、中央海床 -16、調參面板關閉、無橫向溢出。
- 實際點擊 EXPLORE OUR STRATEGIES：卡牌 open=true、transition=1；反向 wheel 後 open=false、transition=0。
- 本輪 JavaScript / console error 陣列皆空；新版岩面與手機文字已看截圖確認。
- 桌機 terrain detail 1,910,272 triangles，aerial light 1,036,800；手機 detail 583,936，light 359,168。倒影保留輕量材質與輕量地形。
- 刪除 4 個不使用貼圖的載入（檔案仍保留），桌機資產大小合計 2,137,578 bytes。未將此數字當作整站實測傳輸量或分數改善。
- 個別桌機執行曾記錄高度檔 net::ERR_ABORTED，但場景最終成功載入並通過高度與地形檢查；未聲稱所有網路請求均無異常。
- 尚未執行新版 Lighthouse、實機手機 GPU / FPS 測試，也不以桌機手機模擬代替實機效能結論。
- QA：.qa/highland-confluence/nav-check.cjs、desktop-nav.json、phone-nav.json 及對應 hero/finale/cards/canyon 截圖；field-check.json 記錄島嶼雕除範圍。

## 2026-10-23 第二段：獨立雙螺旋

- 使用者要求：水滴維持螺旋往上，不包文字；文字也獨立旋轉上升。
- `free-helix-build.cjs` 產生 index1-4 專用的水滴與字母模組，保留共用 js/ 版本。`build.cjs` 新增 water-logo-letters.js 的本頁副本與 import 重接。
- 純水滴沒有 glyph、沒有破裂或送字效果；主水滴 .115、螺旋半徑 1.30，後段逐顆上升離場，避免遮住已排成的字標。
- 字母依章節進度沿獨立螺旋上升，再展開到原字標位置；收尾使用五次平滑曲線，反向捲動沿相同路線返回。減少動態偏好會取消環繞、縮短上升距離。
- Chrome 桌機、390×844 手機模擬、reduced-motion：逐段進度及反向返回檢查，水滴 glyph 數全為 0、無破裂、可完成成字、無橫向溢出、無 JavaScript / console error。QA 圖與 JSON：.qa/highland-confluence/free-helix-*。
- 調整前備份：_archive/backups/highland-free-helix-20261023/。

## 2026-10-23 岩面精細度與統一水體風格

參考：https://everest.suraj.work/ 及使用者附圖的冷灰藍、深色岩面、明亮稜線。使用本站既有岩石素材，保留這個高地世界與海灣敘事。

- 山體材質升級為 alpine-v7。以本站既有 coastal-slate 圖的兩組斜向世界座標投影呈現近距離裂隙與較大的碎岩塊，搭配自動 mipmap、各向異性過濾及像素覆蓋範圍衰減；移除以高度反覆分層的作法，避免環狀岩層。
- 碎岩顏色、微表面法線與粗糙度分開控制；增加不規則幾何岩脊，但沿用原本頂點與三角形數量。
- 曝光稜線有破碎淡色礦物沉積，背光保留冷灰藍；降低過強環境補光，拉開受光面與背光面。調整陰影偏差，避免細碎地形產生斑點。
- 開場水滴以球體兩次折射與水的 Fresnel 取代金屬 F0；不增加 transmission render pass。降低噪聲高光與虹彩。
- 開場水面、螺旋水滴、河面統一為冷灰藍色；減少青綠色偏、泡沫及過強水面扭曲，同步水波速度。保留第二段純水滴、獨立旋升字母的設定。
- 材質只新增載入一張既有 WebP：桌機 455,498 bytes / 手機 114,136 bytes；取消未使用的草地 roughness 貼圖請求。反射保留輕量地形與省略照片的材質。
- 新建置補丁 alpine-water-build.cjs；其他調整位於 highland-material.js、highland-scene.js、highland-terrain-worker.js、confluence-build.cjs。仍以 build.cjs 重建。
- 修改前備份：_archive/backups/highland-alpine-material-20261023/。

驗證：Chrome headless + D3D11，桌機 1440×900 與手機模擬 390×844；五個位置：開場、水滴螺旋、峽谷、出口、俯瞰。無 JavaScript / console error、無橫向溢出。實際卡牌按鈕進入後 transition=1，反向 wheel 退回 transition=0；山景結束 q=8.96 不變。桌機與手機截圖已視覺檢查。

GPU 計時用 EXT_disjoint_timer_query_webgl2，每個固定位置 40 幀。基準與最終結果保存在 .qa/highland-confluence/material-before.json、material-final-desktop.json；手機模擬在 material-final-phone.json。這些是開發機、固定畫面測量，不能當作真實手機 FPS、Lighthouse 分數或動態捲動保證。未執行本輪實機 GPU 測試。

## 2026-10-23 第二次重作：律動與真實雪山

本節取代前文山景尾段構圖、雪線與相機的說明。使用者要求水滴水浪參考 index1-1，山景更接近 Everest 參考圖。

- 水浪恢復 index1-1 原始律動：swell3.5 / calm.42 / timeScale.85 / detail1.8 / foam.75 / spray.9。漣漪 strength1 / speed1.05 / damping.86 / wavelength2.30；水滴保留原本頻率1.15、速度.60，增加低頻變形與呼吸，並保留隨法線移動的高光。第二段仍是純水滴與獨立旋升字母。
- 參考站採用地理高程。此次從 Mapzen/AWS 公開 Terrarium 資料獨立擷取同區域的 DEM；沒有使用參考站的處理後圖片、衛星貼圖或程式。872×758 全尺寸高程 gzip849,892 bytes，436×379 手機版239,140 bytes；原始資料與處理說明見 source/prepare-dem.cjs、assets/everest-dem.json、source/attribution.md。
- 峽谷與匯流保留原始高地地形；q7.95–8.85 用不透明像素漸變轉成完整真實高程雪山。這次有調整故事尾段：最終不再停在海灣匯流構圖，會升入完整雪山山群後接卡牌。前景山群外圍以鏡射延伸與低密度網格連續至遠方，避免矩形裁切邊界。
- q8.96 最終 camera[-300,2300,-4800] / yaw168 / pitch-24 / FOV60，取代舊[-300,1020,-3700]。地形視覺使用場景縮放，非測量用地理座標展示。
- alpine-v8 材質使用中性深岩石、分岔侵蝕紋理與稜線積雪。實際光照、岩石照片與攝影機構圖仍是本網站的版本，不能稱為參考站的逐像素複製。
- highland-valley-clouds.js 用單次 instanced draw 呈現深度測試的流動雲帶；減少動態偏好會停止雲的流動。手機只用一半雲帶與較低地形密度。
- 雪山批次合併；完全進入雪山後停止水面倒影及被遮住的河流光線，退回時恢復。原始地形 source/.dz/Blender 未覆寫。
- 資料署名已加到頁面選單底部，Mapzen / USGS；來源 https://registry.opendata.aws/terrain-tiles/ ，格式與來源條件 https://github.com/tilezen/joerd/blob/master/docs/attribution.md 。

驗證：

- rhythm-check.cjs 實際測試60幀：水滴 ROI 平均 RGB 差4.28、海面20.42，均有明確變化；sea/ripple 參數與 index1-1 預設值對照通過，JS errors[]。
- 桌機1440×900、手機模擬390×844五段畫面：無 JS/console error、無橫向溢出。nav-check 桌機與手機：卡牌 transition1，反向回到0，open=false。
- 固定畫面40幀 GPU 開發機計時：最終雪山中位4.71ms，p955.65ms；完整雪山比舊版1.5ms的海灣俯瞰負擔增加。手機模擬仍跑在桌機GPU，不能當成實機手機速度。
- QA：rhythm-final.json、material-everest-optimized.json/png、material-everest-phone.json/png、desktop-nav.json、phone-nav.json。
- 原始獨立 DEM 數據皆有限且 gzip roundtrip/尺寸/高度範圍通過。背景生成工作在 worker 執行。語法檢查通過。
- 修改前備份 _archive/backups/highland-everest-fidelity-20261023/ 。

## 2026-10-23 白色雜點修復與預設構圖恢復

使用者指出中途停留時滿畫面白色雜點。原因是本輪以 h21(gl_FragCoord.xy) discard 做兩種地形的像素漸變，捲動停在過渡中間便永久顯示顆粒。一般透明混合又會暴露多層地形穿透與裙邊，已取消兩者。

目前預設恢復原本河谷／匯流構圖與最終相機[-300,1020,-3700]，保留 index1-1 水體律動及新版岩面。預設不再載入或生成額外 Everest DEM。移除像素裁切、降低 grain .018→.010；中途q8.45和結尾q8.96截圖已確認，無JS/console error與橫向溢出。QA material-restored-valley-*。

雪山獨立資料、材質與建模保留。只有明確網址 ?terrain=everest 才啟用實驗雪山，採直接切換而非顆粒或透明混合；它仍是實驗方案，未解決完整視覺與平滑銜接，不應當作正式預設。參考站逐像素相同的要求尚未達成。後續應先確認山景範圍，再做離屏合成轉場，不能在重疊的透明地形上直接淡化。

## 2026-10-23 液態字標

使用者在額度停點後明確指示「液態字標 開始」，本輪僅處理字標。

- 本頁增加專用 water-logo-reference-glass.js 副本，透過 liquid-wordmark-build.cjs 與 build.cjs 生成；未修改共用 js/。
- 移除霜面、冰晶及結霜殘留；折射率1.333，減少色散、雲霧夾雜及表面粗糙度，調整圓潤倒角。
- 字母輪廓距離場提供液面邊緣的凸起法線，字邊具有水珠般的圓潤高光。
- 小幅頂點變形與低頻法線流動，共用時鐘；字母成形後仍保留同一套逐字液態表面，避免切回硬玻璃。減少動態偏好下關閉流動變形。
- 原螺旋進場、反向路徑、品牌藍色筆畫保留。水滴不包文字。
- 桌機、手機模擬、reduced-motion 的正向／反向成字檢查：無 JS/console error、無橫向溢出、11個字母完成、全程水滴glyph數0。成字時組合mesh仍隱藏，11個液態字母保持可見，這是本輪有意更改的行為。
- 視覺QA：.qa/highland-confluence/free-helix-desktop-96.png、free-helix-phone-96.png。修改前建置入口備份 _archive/backups/liquid-wordmark-20261023/。
