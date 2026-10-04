# index4-6-3.html 效能分析與優化報告

## 2026-10-04：載入與主執行緒優化

本輪以當日工作目錄中的版本為基準，備份在 `.qa/perf-20261004/baseline/`。下方 10/1 的數字是前一輪成果，不能當作本輪新改善。

已套用的變更：

- 保留原有地形密度、浮點計算順序、DPR 上限 1.65 與後處理效果。地形噪聲使用可釋放的 Float64 格點快取，略過會被替代掉的河岸高度計算。
- 同步／非同步地形入口使用同一個 generator。目標頁面使用非同步入口，在主要建模迴圈以約 6 ms 的工作預算讓出主執行緒；單列及未切分的 shader 工作仍可能更久，不能解讀為所有任務都小於 6 ms。
- 首屏渲染完成即可顯示；Logo 照片與後段 shader 分階段準備。尚未完成時保留導覽目的地，在章節邊界等待，直接預覽則先等準備完成。
- 不下載從未顯示的舊河流 GLTF；停用的卡片照片不提前下載。照片的錯誤與 dispose 路徑保留。
- Google Fonts 樣式表不再阻擋首屏；提早連接 three.js CDN 並 preload 核心 module。
- 調參工具預設延後建立，按 **T** 或使用 **?tune=1** 才開啟，保留原有控制項。停用永久隱藏的舊故事介面，靜止時跳過新介面的重複更新。
- Logo 材質重用 uniform 對照、色彩與 relief 設定快取；resize 每幀合併，先調整畫布再渲染；隱藏分頁停止主動畫與待執行的環境貼圖重烘。

### 本輪量測結果

手機尺寸／UA／觸控、Slow 4G（1.6 Mbps、150 ms）、4× CPU 降速，每組三個獨立 Chrome 冷啟動，以下採中位數：

| 指標 | 10/4 修改前 | 本輪完成版 | 改善 |
|---|---:|---:|---:|
| 首屏可見 | 30.981 s | 18.438 s | −40.5% |
| 全部章節準備完成 | 30.992 s | 25.065 s | −19.1% |
| 首屏傳輸量 | 3,226 KB | 1,850 KB | −42.7% |
| 全部章節傳輸量 | 3,226 KB | 2,918 KB | −9.5% |
| 首屏／全部章節請求數 | 63／63 | 40／57 | −23／−6 |

原始資料：`base-phone-boot.json`、`opt-phone-boot.json`。六輪 console errors、page errors 與失敗請求皆為 0。章節準備完成時間是 shader／貼圖可以安全切入的時間，首屏並不需要等待它。

另外以 4× CPU、無網路降速做單次啟動 profile，最長主執行緒任務 **16.039 → 1.670 s（−89.6%）**；到完整準備完成的累積阻塞 **22.420 → 4.995 s（−77.7%）**。累積阻塞為 navigation 到 ready 之間每個 long task 超出 50 ms 的部分加總，這是自訂診斷，**不是 Lighthouse 的官方 TBT**。本輪仍有約 1.7 秒長任務，不能宣稱所有裝置已完全消除卡頓。原始資料：`base-boot-profile-4x.txt`、`opt-boot-profile-4x.txt`。

shader 暖機改用與正式渲染一致的 HalfFloat 目標。呼叫 compileAsync 後立即恢復 renderer target，再等待編譯完成，避免編譯等待期間首屏動畫誤畫進暖機目標，也避免進入正式 HDR 管線時重編譯。

### 畫面與功能驗證

- **幾何完全一致**：23 個物件、30,492,372 bytes 的 attributes、indices、instances 與位置資料，原版、新版同步及非同步建模的 SHA-256 相同（`geometry-parity.json`）。
- 四章節桌機畫面比對：Logo、峽谷逐位元相同；hero／finale 縮圖的平均像素差分別為 0.123／0.143（0–255），涉及動畫／粒子相位，沒有宣稱所有章節逐像素相同。四章 draw calls、三角形數相同。
- 最終 Logo／finale 完整 UI 截圖已確認 loader 消失、導覽、文案與 CTA 完整，見 `png/opt-desktop-logo-ui.png`、`png/opt-desktop-finale-ui.png`。
- 導覽、回首頁、照片延後載入、390↔1440 resize、分頁隱藏／恢復、直接 `?view=logo`／`?view=finale` 預覽、手機 reduced-motion 與真實觸控輸入通過，page errors 為 0（`smoke.json`、`supplemental-smoke.json`）。
- 首屏只有 342 個 DOM 節點；調參 UI 第一次開啟才建立 881 個 input，重開不重複建立。隱藏分頁的 renderer 呼叫數為 0，恢復後正常繼續。

### GPU 交叉檢查與回復

峽谷在分開啟動瀏覽器的短樣本出現偏高結果，因此追加同一個 Chrome 交替三輪：基準 3.118／3.455／3.260 ms，新版 3.351／3.095／3.090 ms；中位數 3.260／3.095 ms。這些結果沒有顯示持續退步，本輪視為 **GPU 耗時同量級，不宣稱 GPU 明確提升**。各輪實測 GPU clock 約 2,775–2,790 MHz；原始資料 `canyon-interleave.json` 包含 render targets、passes 與材質 uniform 快照。主要收益來自載入、主執行緒切片與減少重複更新。

本輪如需回復，從 `.qa/perf-20261004/baseline/` 複製同名檔案回根目錄：`index4-6-3.html`、`water-journey-scene-463.js`、`water-canyon-watershed-463.js`、`water-logo-cards.js`、`water-logo-drops.js`、`water-logo-reference-glass.js`、`finnovation-interface.js`、`water-journey-story.js`。下方 10/1 回復說明僅適用於歷史版本。

此頁沒有 GSAP 或 ScrollTrigger；優化對象是原有 requestAnimationFrame、Three.js 與 DOM 更新。

本地效能資料與驗證輸出集中在 `.qa/perf-20261004/`。量測使用本機 Chrome 與 RTX 4070；手機規格為尺寸／UA／觸控加 Slow 4G、4× CPU 模擬，並非手機 GPU 實測。測試伺服器沒有 gzip/br，因此本地傳輸量不是正式主機的壓縮後傳輸量，也不是線上 PageSpeed 分數。

測試工具與重現方式見 [scripts/perf-ab/README.md](scripts/perf-ab/README.md)。建模切片採用 [scheduler.yield()](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield)，不支援時退回 setTimeout；shader 預編譯沿用 [Three.js compileAsync](https://threejs.org/docs/pages/WebGLRenderer.html#compileAsync)。

---


2026-10-01 ｜ 範圍：`index4-6-3.html`、`water-journey-scene-463.js`、`water-canyon-watershed-463.js`
量測環境：RTX 4070（ANGLE/D3D11）、Chrome 154 headless、three r170。桌機＝1440×900 @DPR2（程式內夾到 1.65 → 畫布 2376×1485）；手機＝390×844 @DPR3（→ 643×1392，觸發 `DROPLET_LITE`）。
**原始檔備份**：`backups/opt-20261001-baseline/`（12 個檔案，已用雜湊驗證）。

## 0. 結論

| 指標 | 優化前 | 優化後 | 變化 |
|---|---|---|---|
| GPU 每幀時間（桌機，各章節） | 1.9 – 5.0 ms | 1.3 – 3.9 ms | **−18 ～ −32 %** |
| GPU 每幀時間（手機規格） | 0.47 – 1.16 ms | 0.37 – 1.04 ms | −10 ～ −23 % |
| GPU 專用記憶體（整個 Chrome，Windows 計數器實測，hero） | 桌機 1029 MB／手機 333 MB | 734 MB／259 MB | **−295 MB（−29 %）／−74 MB（−22 %）** |
| 首次載入傳輸量 | 6.6 MB（65 請求） | 3.2 MB（63 請求） | **−51 %** |
| 手機節流（Slow-4G＋4×CPU）到可互動 | 40.7 s | 27.7 s | **−32 %** |
| canyon／rivers 每幀 three 重新查 program 次數 | 42 | 0 | −100 % |
| 每幀 JS 配置量（canyon～finale） | 38 – 44 KB | 29 – 35 KB | −19 ～ −25 % |
| draw calls／三角形 | 24–48／≤1.14 M | 不變 | — |
| 畫面 | — | **零回歸**（見 §3） | — |

> 重要前提：三位專家（Draw Call／記憶體／著色器）的**逐檔靜態稽核在中途因額度限制被停止**，沒有產出完整報告。
> 本報告改以「實測驅動」：先量出瓶頸，再只動有量測支撐的地方。§4 列出**尚未稽核**的範圍，不是「已檢查沒問題」。

## 1. 分析結果（三個角色）

### 1.1 Draw Call 與渲染管線
- **draw call 本來就很少**：每幀 24（hero）～48（logo）次，CPU 每幀約 0.3 ms。前人已用 InstancedMesh／合併處理過，**沒有可再「屠」的空間**；瓶頸在 GPU 像素成本。
- **逐 pass GPU 時間（桌機 hero，優化前）**：RenderPass 0.75｜Bloom 0.54｜**OutputPass 0.48**｜顆粒 0.13（合計 1.93 ms）。
  OutputPass 只是色調映射，卻和 Bloom 一樣貴，原因是後處理鏈的**兩張 ping-pong 緩衝都是「全解析度 HalfFloat ＋ 4× MSAA ＋ 深度貼圖」**，而 composer 之後全是全螢幕 quad——MSAA 完全無用，卻要付 4× 顯存與每個 pass 一次顏色＋深度 resolve。canvas 本身又開了 `antialias`，最後一個 pass 同樣寫進 MSAA 緩衝。
- **canyon／rivers 的材質抖動**：岩石材質同時被 2 個 `Mesh`、4 個「有 per-instance 顏色」與 1～3 個「無顏色」的 `InstancedMesh` 共用。three 依「材質 → 深度」排序，三種繪製型態交錯，`instancing`／`instancingColor` 旗標每次切換都讓 `getParameters()`＋`getProgramCacheKey()` 重跑（每幀 42 次、約 15 KB 垃圾）。
- 檢查過、沒問題：`preserveDrawingBuffer` 無；沒有任何幾何直接畫進 canvas（只有最後的全螢幕 quad）；canyon 粒子 `depthTest:false`；靜態章節裡 pass 1–4（河道溶接／景深動態模糊／游標流體／前進轉場）確實關閉，只在捲動中啟用。

### 1.2 記憶體與載入
- **沒有資源洩漏**：捲動掃描（全部章節走 3 輪再回 hero，GC 後）geometries／textures／programs／JS heap 完全持平（手機規格：48／32／57／67.7 MB；優化後 48／31／57／66.7 MB）。此掃描只在手機規格跑過。
- **GPU 記憶體**（1440×900@1.65，推算 → 實測吻合）：兩張 composer RT 約 423 MB＋canvas MSAA 約 113 MB；改後約 268 MB＋14 MB。實測整個 Chrome 行程樹少 295 MB。
- **載入 6.6 MB 的組成**：`drop_of_water/scene.bin` **3.3 MB（50 %）**、`river_water_runtime/scene.bin` 304 KB、HTML 468 KB（本機伺服器未壓縮）、12 張 `slide-assets/*.jpg` 752 KB、16 個字型檔 970 KB、`three.module.js` 257 KB。
  **`drop_of_water` 的 3.3 MB 模型在 SDF 模式下從不渲染**（被放在 layer 1，且每幀被強制 `visible=false`），卻會擋住 `assetsReady`（LoadingManager 要等全部 GLTF 載完才放行）。
- 沒有 `webglcontextlost` 自訂處理——three 內部會 `preventDefault()`，是否需要完整還原流程未驗證。

### 1.3 著色器與迴圈
- **每幀垃圾來源**（取樣式 heap profiler，含已被 GC 的短命物件；單位 KB/幀）：three `getParameters` 9.3（canyon／rivers，已消除）｜`water-logo-reference-glass.js:291 update` 3.4（**每個章節都有，連 logo 不可見時也有**）｜`beadKinematics` 3.7｜`Color.setStyle`（每幀解析色碼字串）1.9–3.9｜`updateDropTransition` 2.5｜`updateJourneyCamera` 1.8｜`updateDispersal` 1.7｜`Object.entries` 1.2。整體 25–60 KB/幀（約 2–4 MB/s），V8 scavenge 負擔小，屬 P2。
- `requestAnimationFrame(() => frame())` 每幀建立新 closure → 已改成固定的 `tick`。

## 2. 已套用的改動

| # | 位置 | 內容 | 效果 |
|---|---|---|---|
| 1 | `index4-6-3.html:1357` importmap | `three.module.js` → `three.module.min.js`（r170 build 內確有此檔） | 傳輸 257 → 168 KB（−89 KB） |
| 2 | `index4-6-3.html:1429` renderer | `antialias:false, depth:false`（canvas 只接最後的全螢幕 quad；MSAA 在場景目標上） | −約 113 MB 顯存（桌機）、顆粒 pass 0.13→0.03 ms |
| 3 | `index4-6-3.html:4524` 起 composer／`:7314` 主 pass 交接／`:9398` resize | 只有場景目標（`renderTarget`）保留 4× MSAA＋深度；composer 的 ping-pong 改為純 HalfFloat、無 MSAA、無深度；覆寫 `swapBuffers` 讓後處理永不寫回 MSAA 目標；主 pass 以 wrapper 渲染到場景目標並交接 `readBuffer`；`tDepth` 改取 `renderTarget.depthTexture`；resize 補 `renderTarget.setSize` | **−155 MB 顯存**；OutputPass 0.48→**0.06 ms**；整幀 GPU −0.6 ms |
| 4 | `water-journey-scene-463.js:449` 起、`water-canyon-watershed-463.js`（簽名、slabs、pins） | 岩石材質依繪製型態拆成 3 份（`rockMaterial`／`instancedRockMaterial`／`instancedPlainRockMaterial`），沿用既有的 `clone()`＋`onBeforeCompile`＋`customProgramCacheKey` 模式；補上對應的 `dispose()` | `getParameters` 42→0 次／幀；canyon 配置 −25 % |
| 5 | `index4-6-3.html:9380` | rAF 迴圈改用固定的 `tick` | 每幀少一個 closure |
| 6 | `index4-6-3.html:3905` | SDF 模式下不再載入 3.3 MB 的 `drop_of_water/scene.gltf`（`?orb=mesh` 可強制載入舊行為）；`rayHitsDropletSphere` 加 `orbModelSkipped` 保持與原本「模型已載入」時完全相同的 pointer 語意 | 載入 −3.3 MB；手機節流到可互動 −13 s |
| 7 | 兩個 463 模組的 `?v=` | `logo-463-38` → `logo-463-39`（避免線上舊快取） | — |

改動量：主檔 +43/−11、`scene-463` +20/−8、`watershed-463` +3/−3。**尚未 commit**（這幾個檔案本來就是 untracked）。

**回復**：把 `backups/opt-20261001-baseline/` 內的三個檔案（`index4-6-3.html`、`water-journey-scene-463.js`、`water-canyon-watershed-463.js`）複製回根目錄即可。

## 3. 驗證

**像素**（逐幀確定性，固定場景時鐘；縮圖為 2×2 逐級平均以消除顆粒）。基準對基準的雜訊底線先量過：logo／transition／zoom／canyon 兩次基準逐位元相同；hero／disperse 因頁面啟動幀數不同有兩個「模擬相位群」，群間平均差約 0.5、群內 0.01–0.22。

| 章節 | 優化 vs 原版 |
|---|---|
| logo、transition、zoom | **逐位元相同**（PSNR ∞） |
| canyon | 最大差 1/255（PSNR 93 dB） |
| hero、disperse | 優化版落在與原版相同的相位群內（差 0.006–0.22，與原版彼此的差同量級） |
| water-transition、rivers、finale | 平均差 0.05–0.25，皆在基準雜訊內 |
| **捲動中**（pass 2＋4 啟用，固定時鐘） | 平均差 **0.001、最大 1/255**（PSNR 77–96 dB）；對照組原版 vs 原版為 0.000–0.002 |

**行為**：console 錯誤 0、pageError 0；pointer hover／grab 與原版一致（見 §4-A）。
**洩漏**：優化後捲動掃描同樣持平（手機規格 geometries 48／textures 31／programs 57／heap 66.7 MB）。
**語法**：三個被改的檔案皆通過 `node --check`。

### 逐章節桌機 GPU（ms）

| 章節 | draw calls | 優化前 | 優化後 | |
|---|---|---|---|---|
| hero | 24 | 1.91 | 1.29 | −32 % |
| disperse | 24 | 2.08 | 1.52 | −27 % |
| logo | 48 | 2.10 | 1.49 | −29 % |
| transition | 36 | 1.95 | 1.35 | −31 % |
| zoom | 32 | 2.19 | 1.62 | −26 % |
| canyon | 33 | 4.04 | 3.29 | −19 % |
| water-transition | 37 | 4.57 | 3.66 | −20 % |
| rivers | 37 | 5.01 | 3.94 | −21 % |
| finale | 37 | 4.60 | 3.77 | −18 % |

> 這是 RTX 4070，GPU 本來就快；手機 GPU 通常慢 10–20 倍，同樣的比例差距在手機上是**每幀省數 ms～十幾 ms**。絕對數字請以真機為準。

## 4. 建議後續（未套用）

**A. 需要你決定的互動問題（原版就有，我沒有動）**
`dropSDF=true` 時舊 GLTF 水珠被強制隱藏，且 `rayHitsDropletSphere` 在 GLTF 存在時會直接 `return false`，結果：**單顆水珠（gather 完成後）在原版裡 hover／grab 都碰不到**，只有「珠群」狀態靠 `rayHitsCluster` 才碰得到（我用滑鼠實測：原版與 `?orb=mesh` 在 hero 靜止時整圈都沒有 `is-drop-hovered`）。程式註解寫的設計意圖是 "what is seen can be touched"。
若希望水珠隨時可 hover／grab：把 `rayHitsDropletSphere` 開頭的 `|| orbModelSkipped` 拿掉即可（半徑約 140 px 內可碰、更遠不行，已實測）。這是產品決策，所以沒有順手改。

**B. 下一個最大的 GPU 項目：Bloom**。優化後 Bloom 0.54 ms，佔 hero 整幀約 41 %（桌機）。可評估降低 mip 級數／解析度，或在強度≈0 的章節關閉；需要目視確認光暈是否可接受，建議以本工具量化。
**C. 大型地形**：canyon 以後 RenderPass 佔 2.6–3.2 ms（共 1.08 M 三角形，手機版 0.49 M）。下一步是地形分塊剔除／LOD，改動較大。
**D. 啟動**：① `slide-assets/*.jpg` 12 張（752 KB）在啟動時就載入（`water-logo-cards.js:74`、`water-logo-drops.js:917`），確認是否能延後到接近 logo 章節；② Google Fonts 16 個檔（970 KB）——Jost 5 個字重＋Noto Sans TC，可減字重並確認 `display=swap`；③ 本機伺服器沒壓縮，線上請確認 HTML／JS 有 gzip／br；④ `logo.mp4` 17.7 MB（已 `preload="none"`），可重新壓縮；⑤ `water-logo-drops.js`（90 KB）等大模組可評估動態 `import()`。
**E. 顆粒重複**：WebGL `grainPass`（已只剩 0.03 ms）與 CSS `.grain`（`inset:-60%` 的 2.2×2.2 倍視窗 fixed 層）做同一件事；`.wash` 的全螢幕 `mix-blend-mode:soft-light` 與多處 `backdrop-filter` 會讓合成器每幀混色。**headless 量測看不到合成器成本，這部分未量測**；合併進 OutputPass 可再省一個全螢幕 pass，但要目視比對。
**F. 殘餘 GC**：`water-logo-reference-glass.js:291`、`beadKinematics`、每幀 `Color.setStyle`、`Object.entries`——合計約 10–15 KB/幀，可改用預先配置的暫存物件；收益小，P2。
**G. 動態解析度**：目前 DPR 上限 1.65（手機桌機相同）。像素成本線性於面積，手機可考慮 1.25–1.5 或依幀時間自適應。

**尚未稽核（專家被中止，請勿視為「沒問題」）**：貼圖逐張的 POT／壓縮格式（`renderer.info` 只有 23–24 張貼圖且多為程式生成，KTX2 效益可能有限，但未逐張驗證）；事件監聽／計時器逐項（掃描只證明捲動路徑不累積）；每支 GLSL 的分支與精度（`dropletMaterial` 的 raymarch、sea shader、`water-logo-drops.js`）；陰影 pass 是否可停更；tuner 滑桿（`?tune=1`）路徑的重建與釋放。

## 5. 重現

工具在 `scripts/perf-ab/`（用法見該資料夾的 README）：A/B 量測 `perf-harness.cjs`＋`compare.cjs`、捲動中對照 `motion-ab.cjs`、垃圾來源 `heap-profile.cjs`、材質抖動 `prog-probe.cjs`、顯存 `gpumem.cjs`、冷啟動 `--boot [--throttle]`。
