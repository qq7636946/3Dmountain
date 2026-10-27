# 尾聲延伸（index1-1）：霧中過場 → 卡牌 → 穿雲見地球 → 理念 → 頁尾

2026-10-19（同日第二輪：過場改成一個連續動作、霧可調、最後一段改用影片）｜ 範圍：只有 `index1-1.html`（`<html data-epilogue="world">`）。`index.html` 行為不變（已驗證：仍是原本的淡入卡牌、捲完就停，也不會下載任何尾聲延伸的檔案）。
參考：mont-fort.com 的「Global Connectivity → Sustainability → footer」結構與版面（只參考結構與設計，文字、圖片、程式都是自己的）。
畫面：[world/bridge.jpg](world/bridge.jpg)（山谷→卡牌）｜[world/mist-panel.jpg](world/mist-panel.jpg)（霧的三種預設）｜[world/responsibility-video.jpg](world/responsibility-video.jpg)（影片背景）｜[world/flow.jpg](world/flow.jpg)（卡牌→頁尾全程）｜[world/planet.jpg](world/planet.jpg)｜[world/responsibility.jpg](world/responsibility.jpg)｜[world/phone.jpg](world/phone.jpg)｜[world/grade-presets.jpg](world/grade-presets.jpg)（色調三種預設）

## 行為

1. **山谷 → 卡牌（一個連續動作，跟著捲動走）**：最後一章之後繼續往下捲，鳥瞰鏡頭一路沿視線滑進山谷（越接近卡牌越慢），山谷的空氣同時均勻變濃、退成卡牌底色（不再有「霧從下方湧上來」的第二段）；霧到一半，中間那張卡牌先從霧的深處出現、兩側依序跟上，越遠越朦朧，迎面飛到定位，標題淡入。最後一格滾輪剩下的量直接接著捲卡牌，中間不停頓；往回捲照原路倒回去。
2. **卡牌**：操作同前（滾輪／上下滑動捲卡牌、左右拖曳）。
3. **卡牌最後一張之後**繼續往下捲：雲層從四周捲入蓋住卡牌 → 置身雲中（全白）→ 雲從中央撕開，看到太空中的地球（地平線在左上角發光），台北（HQ）與亞太市場的標籤貼在地球上；大標「ROOTED IN TAIPEI…」隨捲動上來，地球同時由台灣上空往西轉向亞洲 → 鏡頭抬向太空、地球從右下沉出 → 深色 → **責任（RESPONSIBILITY）**四個編號區塊，背景是 `media/logo.mp4` 的水面漣漪影片（重新編碼成無縫循環，調成深藍綠讓白字讀得清楚；影片載入前先顯示同一畫面的靜態照片）→ 白色 **footer**。
4. 往上捲全部倒回；在地球段最上方再往上捲，就回到卡牌（卡牌停在最後一張，可繼續往回）。
5. 鍵盤：方向鍵／PageUp／PageDown／空白鍵捲動；`End` 到頁尾；`Home` 回到開頭；`Tab` 可逐一走到頁尾連結（自動捲到看得見）；ESG 分頁可用左右鍵切換。
6. 手機：手指拖曳 1:1 跟手、放開有慣性；在地球段最上方往下拉回卡牌。
7. 左側章節列（GLOBAL REACH／RESPONSIBILITY／CONTACT，寬螢幕才顯示）；深色段落時頁首文字自動轉白，到白色頁尾轉回深色。原本的左側章節軌、下方進度列在尾聲中隱藏。
8. 減少動態（系統「減少動態效果」）：不下載 GSAP、不做穿雲動畫（簡單淡入淡出）、最後一段用靜態照片不播影片，文字全部直接顯示。
9. 頁尾的章節連結（Knowledge…Strategies）與 BACK TO TOP 會收起尾聲、飛回對應章節。

## 檔案

| 檔案 | 內容 |
|---|---|
| `js/finnovation-world.js`（新） | 尾聲延伸本體：一張固定的 WebGL 畫布（three.js）畫天空、地球（色調圖＋區域高解析圖＋雲＋大氣光暈）、穿越的雲層、海洋照片；文字是一般 HTML，放在只由程式捲動的容器裡（所以 GSAP ScrollTrigger 可以直接用）；捲動彈簧、手機觸控慣性、鍵盤焦點、章節列、ESG 分頁 |
| `css/world.css`（新） | 24 欄格線版面、各段字級、手機版；由模組自己載入，不影響首頁載入 |
| `js/finnovation-grade.js`（新） | 整頁色調（見下）：GLSL 與 JS 共用的色相／彩度／冷暖／紫綠 |
| `js/finnovation-grade-panel.js`（新） | 「畫面調整」面板：色調／霧／影片三頁（需要時才下載） |
| `js/portfolio-epilogue.js` | 新增 `bridge` 模式（捲動推進的過場，最後一格的餘量直接接卡牌）、`onEnd`（卡牌捲完交棒）、`setExit`（下一段接手時卡牌淡出並停止繪製）、`grade`、`mist` |
| `js/portfolio-slider.js` | 新增 `mist`（空氣均勻變濃成底色，中央略早、帶緩慢起伏）與 `approach`（卡牌從霧的深處迎面飛來，越遠越朦朧，飛入時不留殘影）兩種選用模式；預設關閉，其他頁的畫法完全不變 |
| `js/main.js` | `data-epilogue="world"` 開關、`CONFIG.mist`／`CONFIG.video`、過場時鳥瞰鏡頭推進與霧（`applyBridgeView`）、捲動依序交給 尾聲延伸→卡牌→旅程、卡牌浮出後才載入尾聲延伸、主畫面最後一道加上色調、畫面調整面板 |
| `index1-1.html` | `data-epilogue="world"`；`WORLD_EPILOGUE_START…END` 之間是三段的 HTML（文字直接改這裡） |
| `images/world/` | 地球色調圖（全球 2K＋亞太高解析／手機版）、雲、海洋照片（影片的替身，見「素材」） |
| `media/ocean-loop-720.mp4`／`ocean-loop-480.mp4`（新） | 最後一段的背景影片：由 `media/logo.mp4` 重新編碼的無縫循環（原檔保留不動） |
| `scripts/world/` | `build-world-assets.cjs`（重做貼圖）、`build-world-video.cjs`（重做影片）、`stamp-world.mjs`（模組版本號）、驗證腳本（`film-bridge`、`film-world`、`interact-world`、`perf-world`） |

## 待客戶提供／確認（頁面上以橘色或 `data-todo` 標示）

- **頁尾聯絡資料**：總部地址、電話、Email；合作洽詢與加入我們的 Email；Privacy policy、Terms of use 的頁面連結。
- **地球上的城市**：`js/finnovation-world.js` 的 `MARKETS`（目前假設總部在台北，另標 12 個主要市場）。若不是台北或想換城市，改這張表即可。
- **文案**：地球段大標、責任四段（紀律與合規、負責任的資本／ESG、科技與誠信、人與社群）都是依網站語氣寫的草稿，涉及公司實際做法的描述（例如「研究、交易與風險控管各司其職」）請客戶確認屬實再上線。

## 畫面調整面板（色調／霧／影片）

本機網址或網址加 `?grade=1` 會出現在右下角，任何時候按 `C` 開關（`?grade=0` 或 `?tune=0` 不自動開）。三個分頁，每頁有三個預設、「重設本頁」；調過的值記在這台瀏覽器。滿意後按「複製參數」，把整段（grade／mist／video／portfolio.base／watershedStyle.haze）貼給工程師寫進 `js/main.js`，就成為正式預設。

| 分頁 | 可調 | 對應 |
|---|---|---|
| 色調 | 色相（偏紫↔偏青）、彩度、冷暖、紫綠；預設 原始／偏藍／更藍 | `CONFIG.grade`（見下節） |
| 霧 | 霧色（也是卡牌底色）、鏡頭推進、山谷霧、開始起霧、霧到全白、霧的起伏、中央先霧、卡牌出現、卡牌距離、過場格數、跟隨柔順、山谷退場（2026-10-19 第二輪，取代「過場長度」）、遠景霧感（山谷章節本身的霧）；卡牌之後的雲層濃度、雲層柔和、地球雲量；預設 淡霧／預設／濃霧 | `CONFIG.mist`、`CONFIG.portfolio.base`、`CONFIG.watershedStyle.haze` |
| 影片 | 亮度、影片原色（越高越接近影片本身的淺藍）、播放速度；預設 沉穩／預設／明亮 | `CONFIG.video` |

## 色調（客戶 2026-10-19：整體偏紫，往藍一點）

- 一組參數同時作用在：主場景（最後一道後製）、卡牌的雲霧底（照片本身不變色）、地球段（天空、地球、雲、海洋照片的調色）。HTML 文字顏色不受影響。
- `js/main.js` 的 `CONFIG.grade`：index1-1 預設「偏藍」`{ hue: -7, sat: 1.04, temp: -0.12, tint: 0 }`，其他頁是原色。實測平均色相 211° → 207°（往青藍、遠離紫）。
- 調整方式見上一節「畫面調整面板」的「色調」頁。

## 素材與授權

| 檔案 | 來源 | 大小 |
|---|---|---|
| `earth-2k.jpg` | `_archive/models/earth_B`「Earth」by Alan Zimmerman，**CC BY 4.0（須標示作者，頁尾已加）**；翻正（原檔上下顛倒）、轉成單一灰階色調 | 254 KB |
| `earth-asia.jpg`／`earth-asia-m.jpg` | 同上，只取鏡頭會看到的亞太區（東經 40–180、南緯 50–北緯 62），桌機用原圖解析度、手機用一半 | 867 KB／249 KB |
| `clouds-2k.jpg` | 程式產生（在球面上取樣的雜訊，沒有接縫） | 345 KB |
| `media/ocean-loop-720.mp4`／`ocean-loop-480.mp4` | 專案原有的 `media/logo.mp4`（1280×720、5 秒、約 29 Mbit/s、18 MB）在瀏覽器裡重新編碼成 H.264（約 2.6／1.2 Mbit/s）；最後 1.1 秒與開頭交叉淡化，循環時不跳（接縫處的畫面差異和一般相鄰兩格同等級）；24 fps、3.96 秒 | 1.31 MB／619 KB |
| `ocean-2400.jpg`／`ocean-1280.jpg` | 專案原有的 `images/bg.jpg` 縮圖（影片載入前與「減少動態」時用） | 488 KB／173 KB |
| GSAP 3.13.0（ScrollTrigger、SplitText） | jsDelivr；GSAP 現為免費授權（含商用） | 約 52 KB（壓縮後） |

尾聲延伸的貼圖在卡牌完全浮出後才下載（桌機約 1.95 MB、手機約 1.0 MB）；影片要捲到離最後一段約兩個畫面時才下載（桌機 1.31 MB、手機 619 KB），只在畫面上看得到時播放，捲離就暫停。

## 效能設計

- 卡牌蓋滿畫面時主場景不畫；雲層蓋住卡牌之後卡牌也停止繪製；白色頁尾填滿畫面時地球畫布也停。同一時間最多一個大型畫面在繪製。
- 準備工作全部排進「瀏覽器空閒時一次做一件」的佇列：建立 WebGL、四張貼圖上傳（解碼在背景執行緒）、著色器編譯（compileAsync）、七個文字區塊的首次排版（大量中文字形首次塑形很耗時，分開做）、GSAP 動畫建立。每一步都有效能標記（DevTools › Performance › Timings 的「world …」）。
- 地球與雲的貼圖用單通道（R8），GPU 記憶體約為一般彩色貼圖的四分之一；解析度會依實際幀率自動降／升（上限桌機 2、小螢幕 1.75）。

## 驗證（無頭 Chrome＋實體 GPU；手機／平板為模擬尺寸與觸控，不是實機）

| 項目 | 結果 |
|---|---|
| 桌機 1440×900，用滾輪從最後一章連續捲到頁尾（含影片段） | 過場、卡牌、尾聲延伸全程約 75 fps（顯示器上限），掉幀 0 |
| 手機 390×844（DPR 2） | 過場、卡牌、尾聲延伸全程掉幀 0；手機載 480p 影片、桌機載 720p，進入該段才播放、捲離即暫停 |
| 畫面調整面板（`panel-test`） | 三個分頁的預設、霧色寫回 `CONFIG.portfolio.base`、重設本頁、複製參數皆正確，無錯誤 |
| 手機＋CPU 降速 4 倍（模擬較慢的手機） | 尾聲延伸約 74 fps；若一路不停地狂捲卡牌，準備工作來不及等到空閒，最長一次卡 0.1 秒 |
| 平板 1024×1366 | 版面與構圖正常 |
| 互動（`scripts/world/interact-world.cjs`） | 13 項全過：觸控跟手、慣性、拉回卡牌、PageDown、End、Tab 焦點、頁尾章節連結、減少動態、index.html 不受影響、各情境無錯誤 |
| `scripts/seo/check-seo.mjs` | passed |

驗證腳本需要 Playwright：`PLAYWRIGHT_CORE=<playwright-core 資料夾> node scripts/world/interact-world.cjs`（另有 `film-bridge`、`film-world --phone|--tablet`、`perf-world --phone --throttle=4`）。截圖存到系統暫存資料夾：在雲端硬碟（G:）上用 Node 刪資料夾會讓 Node 直接當掉。

## 想調整時

| 想改 | 位置 |
|---|---|
| 過場的長度、鏡頭推進、霧、卡牌飛入 | 先用面板「霧」頁調，再把複製的值寫進 `js/main.js` 的 `CONFIG.mist` |
| 霧的畫法、卡牌飛入的路徑 | `js/main.js` 的 `applyBridgeView`、`js/portfolio-slider.js` 的 `mistComposeFragment` 與 `approach` 那段 |
| 最後一段的影片 | 換片：把新影片放進 `media/`，改 `scripts/world/build-world-video.cjs` 的 `SRC` 後重跑；亮度與原色比例用面板「影片」頁 |
| 地球構圖、轉向、顏色 | `js/finnovation-world.js` 的 `frameEarth()`、`LOOK`、`MARKETS` |
| 各段長度 | `css/world.css`（`.fiw-gap` 雲層 170vh、`.fiw-global`、`.fiw-resp`） |

改完任何尾聲延伸的檔案：`node scripts/world/stamp-world.mjs`，再 `node scripts/stamp-assets.mjs index1-1.html` 與 `node scripts/stamp-assets.mjs index.html`。重做貼圖：`node scripts/world/build-world-assets.cjs`；重做影片：`node scripts/world/build-world-video.cjs`（兩者都需要 Playwright，用瀏覽器處理，不需要 ffmpeg）。

## 還原

改動前的 `js/main.js`、`js/portfolio-epilogue.js`、`js/portfolio-slider.js`、`index1-1.html` 在 `_archive/backups/world-20261019/`。複製回原位，再跑 `node scripts/stamp-assets.mjs index1-1.html` 與 `node scripts/stamp-assets.mjs index.html`，即回到改動前（新檔案可留著不影響）。
