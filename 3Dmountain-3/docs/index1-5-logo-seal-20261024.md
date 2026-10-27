# index1-5 LOGO 收尾（Logo Seal）— 整合說明（2026-10-24）

客戶：「新增一個區塊，轉場方式跟地球到橫移一樣，這新區塊在橫移以下出現，中間是 LOGO1 的 LOGO 平旋轉一圈，結尾如圖（6.webp）」。
需求與介面見 `docs/logo-seal/BRIEF.md`；材質／場景專家的備忘在 `docs/logo-seal/mark-notes.md`、`lake-notes.md`。

## 做了什麼
海洋橫移（四個策略章）之後、頁尾之前，多一個區塊：
1. **波浪轉場**：全幅 WebGL 水波由下往上掃過，帶泡沫亮線、飛沫，海面與湖景各被折射（沒有任何圓形遮罩）；往回捲倒放。
2. **黃昏湖**（場景專家）＋ **LOGO 1 玻璃符號**（材質專家），水面有倒影。
3. **符號隨滾動從水面升起，同時平旋轉一圈**（第二輪新增，founderssa 做法）：波浪過後湖面先出現，符號沉在水下；旋轉開始時它升出水面（水線漣漪、倒影同步由湖景畫），升到 `riseEnd` 完全升起，旋轉繼續到結尾（緩入緩出，停在正面＋`restYaw`）；同一個時鐘，往回捲倒放（先轉回去、再沉回水裡）。減少動態：不升起（rise＝1）。
4. 轉完後文字依序出現：`THE FINNOVATION SPIRIT`／`FINNOVATION`／`恒灝創新`／`匯聚科技知識，連結金融價值。`（**暫用，等客戶核可**），然後頁尾升上來；文字在頁尾升上來時先淡出。
5. 最後一個策略章的按鈕原本寫 CONTACT 直接跳頁尾，現在寫 `THE SPIRIT` 並前往這個區塊（`?logoseal=0` 時維持 CONTACT → 頁尾）。

## 檔案
| 檔案 | 說明 |
|---|---|
| `prototypes/index1-5/world-logo.js` | 區塊本體：時鐘、延遲建立、離屏複製、波浪合成 shader、文字（`createWorldLogo`） |
| `prototypes/index1-5/world-logo.css` | 文字與版面（鍵在 `#fiWorld.fisl-on`） |
| `prototypes/index1-5/world-logo-build.cjs` | 建置 helper：對世界模組的錨點補丁、HTML 區塊、CONFIG、面板、搬運模組。**文案只在這支檔案頂端的 `COPY`**，改完 `node prototypes/index1-5/build.cjs` |
| `prototypes/index1-5/world-logo-mark-stub.js`／`world-logo-scene-stub.js` | 暫代檔。正式的 `world-logo-mark.js`／`world-logo-scene.js` 存在就用正式的（`LOGOSEAL_STUBS=1 node …/build.cjs` 強制用暫代檔，除錯整合用） |
| `prototypes/index1-5/build.cjs` | 只改兩處：helper 清單在 `world-ocean-build.cjs` 後加 `'world-logo-build.cjs'`；呼叫改成 `({main,drops,letters,glass,html,extra})`（讓 helper 能補丁 `extra['finnovation-world.js']`，其他 helper 行為不變） |
| `scripts/index1-5/lib.cjs`、`world-shot.cjs`、`README.md` | world-shot 新點位 `l:`／`lw:`／`ls:`／`lh:`（既有行為不變） |
| `scripts/index1-5/probes/logo-seal-*.probe.cjs` | 驗收腳本（behaviour／perf／shots／wheel） |
| 備份 | `_archive/backups/index1-5-logo-seal-20261024/`（build.cjs、lib.cjs、world-shot.cjs、README.md、index1-5.html、建置前的 `js/`） |

## 時鐘（都以螢幕高為單位，面板「LOGO 收尾 Logo Seal」可調）
世界捲動 `y` →（`wave` 1.7 ＋ `spin` 1.8 ＋ `hold` 0.9）：波浪從海洋最後一章還沒完全離開時（`waveLead` .25）開始；旋轉在波浪走了 `spinStart` .7 時開始；旋轉完成後停留。區塊高度 ≈ 4.64 螢幕，頁尾與 `maxY` 自動接在後面。往回捲時鐘對稱（只和 y 有關）。
**升起（rise）**：湖景 `update({q, time, rise})`，0＝完全沉在水下（看不到）、1＝結尾位置。`rise` 以旋轉進度 `q_spin` 計：`riseStart`（預設 0，旋轉一開始就升）到 `riseEnd`（預設 .62）之間，用緩出曲線（`riseEase` 0 線性／1 到頂前明顯變慢，預設 .9），`riseEnd` 之後恆為 1；波浪期間（旋轉開始前）恆為 0。`yaw` 照舊同時轉。實測：q_spin 0／.125／.25／.375／.5／.625 的 rise ＝ 0／.46／.75／.90／.97／1。
`q_wave`／`q_spin`／`yaw`／`rise`／`q`（給湖景與符號；`q` 在停留開始處＝1＝結尾構圖）／文字進度，可在 `world.state.logo.sample` 讀到。

## 面板與旗標
- 面板群組 **「LOGO 收尾 Logo Seal」**（桌機 `?tune=1` 或 `T`，共 150 列）＝我的 29 列（波浪長度／提早／方向／波長／波高／前緣柔和與起伏／浪峰／飛沫／兩邊折射、旋轉開始／長度／完成點／緩動／結尾角度、**符號升起 開始／完成／緩出**、停留、文字時機／位置／大小／顯示、符號大小／上下、時間流速、**跟全站日照**、**建置時機**）＋ 材質專家的 `MARK_ROWS`（CONFIG.logoMark）＋ 場景專家的 `LAKE_ROWS`（CONFIG.logoLake）。即時生效，雙擊標籤還原。
- `?logoseal=0`：整個區塊移除，頁面回到原本（頁尾位置、CONTACT 按鈕、世界段行為都跟加入前一樣；實測 `at.footer` 9696＝舊值）。
- **跟全站日照**（`logoSeal.followDaylight`，預設 0）：全站有一個隨捲動的太陽（`scene-daylight.js`，別人的系統），走到這裡已是 18.8–19.5 時的藍調。客戶要的 ref-6 是黃昏，所以預設區塊內**不跟**：呼叫湖景 `update()` 的那一瞬間把共用的 `enabled` 暫時關掉再還原（不改 `scene-daylight.js`、不影響海面與其他段；海面與頁首的 SCENE TIME 仍照全站時鐘）。設 1＝跟全站（藍調，較暗）。
- 減少動態：沒有波浪、旋轉與升起，符號固定在結尾位置（rise＝1），文字淡入；海面與湖景改成「**海面先淡成水色、湖景再從水色淡入**」兩段（總長度不變），任何時刻畫面上最多只有一個圓環（海面最後一格保留的水中 LOGO 水印不會透過玻璃符號）。
- 手機：`small`（較少漣漪層與微塵）、直式構圖由場景專家的 `small`／aspect 處理，文字縮小置中在下。

## 渲染方式（給之後改的人）
波浪經過時：世界照常畫海面到畫布 → 複製成貼圖；湖景畫到畫布 → 複製成貼圖；全幅 shader 把兩張經波浪合成。這樣兩邊的色彩處理（背景直接寫顯示色、玻璃由 three 輸出 sRGB）都和直接畫在畫面上完全一致。波浪前與波浪後各只畫一個。順序：`mark.update` → `lake.update` → `renderer.render(lake.scene)`；符號放在 `lake.markAnchor`（外包一層 holder 做大小／上下調整）；`lake.onEnvironment` → `mark.setEnvironment`；湖景的寬高傳實際繪製像素。

## 驗證結果（本機無頭 Chrome，RTX 4070）
- `check.cjs`（桌機＋手機）：29 個檔案語法 0 錯、頁面錯誤 []；`tuner.cjs`、`config.cjs`：群組與預設都在。
- 往年修復的世界段探測（Tab 不亂跑、聲音鈕、EXPLORE、STRATEGIES、卡牌）全過；EXPLORE 現在多一站（策略 → 區塊停留 → 頁尾）。
- `logo-seal-behaviour`：旋轉端點精確 0／2π（`yaw === 2π`），單調、兩端慢中間快；往回捲同一 y 同一畫面；區塊內 Tab 不會把畫面帶回海洋（海洋章節 `inert`），進頁尾時才跟著動；頁首白字、章節軌隱藏、聲音鈕可點；context lost → restore 後繼續畫；關閉世界後 GPU 資源釋放。
- 效能（`logo-seal-perf`，真實滾輪連續快速滾動，見已知限制 1）：進入區塊後**波浪／旋轉／停留／頁尾的幀時間最大 8.6 ms（平均 8.3 ms，無慢幀）**，手機 390×844 同；沒有區塊時同樣的滾動 0 個長任務（對照基準）。
- 升起：`logo-seal-behaviour` 通過（rise 在旋轉開始為 0、`riseEnd` 起恆為 1、單調、緩出；往回捲同一 y 同一值）；真實湖景升起（水線漣漪、倒影同步）桌機在 `followDaylight` 0／1 兩種背景都正常（`.qa/index1-5/logo-rise-f0|f1/sheet.jpg`）。
- 證據：`docs/logo-seal/evidence/integration/`（1440×900 完整一輪＋sheet、1920×1080、手機 390×844、減少動態、真實滾輪往下／往回捲）。

## 已知限制（要客戶／總指揮知道）
1. **一次性卡頓（第二輪已大幅改善，玻璃那一段還沒好）**：根因是顯示卡第一次畫時才編譯 shader 變體（`getProgramInfoLog` 等編譯完成，一次 200–900 ms）。做法：湖景與符號在**進入海洋橫移段後**（`prepare` .1 螢幕）就於閒置幀建立；`precompile` 用 `renderer.compileAsync` 在背景把玻璃的 DoubleSide／BackSide、畫到 render target（倒影、穿透 pass）的變體一個個編好；預熱拆成「湖面→符號→整個波浪」三幀。舊玻璃材質上實測：湖面首次繪製 255→**8–21 ms**、波浪合成 3→**4 ms**、符號 620→**8–12 ms**；連續快速滾輪從海洋第 1 章一路滾進區塊，進入區塊後（波浪／旋轉／停留／頁尾）**0 個長任務、幀時間最大 8.6 ms**（桌機與 390×844 手機都是）。**但材質專家剛換成「平板鑄造玻璃」之後，符號的首次繪製又多出 `logo-mark water-glass physical` 的 3 個我沒預編到的變體（桌機約 0.6–0.85 s、手機約 0.4 s 的單次卡頓，發生在海洋段、進區塊之前）**——還沒找到是哪個狀態差異（look／環境貼圖／透射設定在 precompile 之後又變了），建議材質專家把這個材質的 `defines`／`customProgramCacheKey` 固定，或提供 `warm()`；`state.newPrograms` 可看每一幀新增的 program 名稱。另外兩個建立步驟自己就超過 50 ms：`createLakeScene` 同步約 70–300 ms（新版冰湖變重）、符號幾何有一個約 56 ms 的區塊（`delaunayFlips`），不是我這邊能切的。
2. **three.js 不會釋放穿透材質的渲染目標**（每次建置留下約 50 MB 顯示記憶體，我們的程式自己沒有洩漏，用 `transmission=0` 實測 0 增長）。所以湖景建好後**開著世界就一直保留**，只在世界關閉時釋放；來回捲不會重建。
3. 湖景建立（`createLakeScene`＋`createLogoMark`）在閒置幀分步做，約 1 秒內完成；若有人一進世界就直接跳到區塊（`CONTACT`/`THE SPIRIT` 按鈕、EXPLORE 連按），湖景未好時先畫海面，好了才換上。
4. 右上角「SCENE TIME … BLUE HOUR」小面板（日照系統）在區塊內仍顯示 19:xx 藍調，湖景預設是黃昏——要一致就把「跟全站日照」設 1，或請日照系統在區塊內停止顯示。
5. 減少動態：已改成「海面先淡成水色、湖景再淡入」，`world-shot --reduced` 在波浪 0.25／0.5／0.75 的畫面各只有一個圓環（0.5＝純水色）。
6. 頁尾（日照系統的深色版）升上來時，文字在 0.38 螢幕內淡出；頁尾本身的樣式不是這個區塊的。

## 還原
- 暫時：網址加 `?logoseal=0`。
- 永久：把 `'world-logo-build.cjs'` 從 `prototypes/index1-5/build.cjs` 的清單拿掉，並把呼叫改回 `({main,drops,letters,glass,html})`，再 `node prototypes/index1-5/build.cjs`；或用備份 `_archive/backups/index1-5-logo-seal-20261024/`。

## 總指揮收尾調整（2026-10-24 15:30）
- **玻璃質感預設改得更清透**（`world-logo-mark.js` 的 `MARK_DEFAULTS`）：厚度 .14→.2、吸收色 #8fa9ca→#cfdcee、吸收距離 .6→1.6、折射厚度 2.2→1.5、柔邊光 1.5→2、邊緣亮線 1.6→2.2、內部散射光 .35→.5、水紋焦散 .1→.04。原因：原本偏灰偏暗，對照 ref-6（淡藍清透）差很多。對照圖 `docs/logo-seal/evidence/final-material-compare.jpg`（左＝ref-6，中＝調整前，右＝調整後）。
- **結尾停的角度**：新參數 `logoSeal.restYaw`（度，預設 10）。轉完一圈後多停在 10°，這樣才看得到玻璃的厚度；0＝正對。`probes/logo-seal-behaviour.probe.cjs` 已改成檢查「360° ＋ restYaw」。
- **日照**：`daylight-build.cjs`（日照系統，別的對話）在最後把 `CONFIG.logoSeal.followDaylight = 1`，所以區塊現在跟全站藍調（19:25，深藍夜景，接近 ref-5 的暗湖）；面板 `logoSeal.followDaylight` 設 0 就是 ref-6 的黃昏亮景（有暖色太陽）。對照 `docs/logo-seal/evidence/final-daylight-compare.jpg`（左、中＝藍調，右＝黃昏）。預設留在日照系統的選擇，等客戶決定。
- 備份：`_archive/backups/index1-5-logo-seal-tune-20261024/`（world-logo.js、world-logo-build.cjs、world-logo-mark.js）。

## 第三輪（2026-10-24 晚）玻璃首次繪製卡頓
- 原因：湖景用材質自己的裁切平面（水線）切符號，three 的 compile() 不計材質自己的裁切平面，預編的變體和實際繪製的不同（key 第 50 欄 numClippingPlanes 0≠1），首次繪製時重編 3 個變體。
- 修法（world-logo.js precompile）：先 frame() 讓湖景掛上裁切平面，再先畫一個帶同樣數量裁切平面的小 dummy（只畫進 8×8 離屏目標），讓 renderer 的裁切狀態＝實際繪製時，再 compileAsync 畫面／離屏、雙面／背面各變體。結果：符號首次繪製 845→6–8 ms，預熱時新編譯的程式 3→0（state.newPrograms）。
- 還剩：createLakeScene 同步約 270–280 ms、符號幾何約 60–80 ms 各一次（在海洋段、進區塊前；進區塊後 0 長任務）。這兩個在場景／材質專家的程式裡，需要他們拆成多個閒置幀。
