# Hubtown 絲滑捲動與轉場研究 → index1-5 實作規格

2026-10-24 ｜ 範圍：只研究與提案，**沒有改任何網站程式**（`index1-5.html`、`js/`、`prototypes/index1-5/` 都沒動）｜ 研究對象：<https://hubtown.co.in/>（只觀察行為與數字，沒有下載或抄任何素材、原始碼）
客戶原話：「讀取這網頁 https://hubtown.co.in/ 絲滑跟轉場請抄他的」。
依 2026-10-19 的規則（先稽核、量測、提案，視覺／動態改動等明確同意後才做），第四節的每一項「動到看起來或動起來」的改動都**等你說好再做**。

證據圖：`docs/smooth-flow/evidence/hubtown/`（7 張 jpg）｜ 量測腳本：`scripts/index1-5/probes/smooth/`｜ 原始數據：`.qa/index1-5/smooth/`

---

## 零、一頁結論（最重要的 10 個數字／規則）

1. **Hubtown 的絲滑不是「捲動比較軟」**：首頁用 **Lenis 1.3.8**，一格滾輪 = **100 px、不限幅、可累加、上下對稱**；補間是指數 lerp——首頁 **lerp ≈ 0.04（τ ≈ 413 ms，63 % 424 ms／95 % 1207 ms／99 % 1749 ms）**，內頁 **lerp 0.1（τ ≈ 167 ms，63 % 174／95 % 482／99 % 699 ms）**。第一個畫面在滾輪後 ≤ 15 ms 就動（指數補間沒有「起步」）。
2. **3D 鏡頭直接等於 Lenis 的捲動位置，沒有第二層補間**（原生跳 300 px，鏡頭在下一幀 6.7 ms 就到）。所以鏡頭速度 = 捲動速度 × 一條固定的鐘形曲線，永遠連續。
3. **整部電影 2800 vh = 25 200 px（28 螢幕）、6 章**：每章 400–500 vh（3600–4500 px，約 40–50 格滾輪）；每章文字整章釘住。我們的旅程 13.07 單位 = 100 格滾輪、10 張字卡，每張卡只有 **5–13 格**可讀。**停留預算差 4–8 倍**。
4. **每章的鏡頭速度是鐘形**（第 1 章：0.17 → 1.93（約 2100 px）→ 1.31（3000 px）單位／100 px；第 6 章尾端每 300 px 速度減半，「停泊」到 0）。章末有約 25 % 的**停泊段**，文字在那裡讀。
5. **場景切換是「藏在 0.9 秒 shader 溶解下面的硬切」**：捲動到門檻 → 一個**時間驅動**的 `uProgress` 0→1（**875 ms**，近線性緩進緩出 `cubic-bezier(.2,.25,.55,.8)`），同時 `uMaxDistort 1.43→0.13`、`uBendAmount −0.05→−0.98`、`bloomRadius 0.21→0.64`、`vignetteRadius 0.20→0.40`、一個 ≈ 250–400 ms 的暗場，鏡頭就在暗場中間瞬間換位（一幀 ≈ 25 ms 的成本被溶解吃掉）。**停手後轉場照樣播完**。
6. **文字是時間驅動、不跟捲動**：舊章文字在切點前後 **≈ 0.3 秒**淡出；新章標題在切點後 **640 ms** 才開始，**逐字隨機亂序**淡入，**1.38 秒**；內文每行 **translateY 30 px → 0、opacity 0 → 0.6，0.95 秒，行距延遲 ≈ 115 ms**，緩動 ≈ `cubic-bezier(.2,.05,.1,.95)`（power3–4.out）。
7. **滾輪從不吸附**（5 種停手位置、停 3 秒以上，0 px 位移）；只有「原生捲動」（拖滾軸、鍵盤、錨點）才會被拉到最近的停泊點（目標以 ≈ 900 px/s 前進，再接 τ 0.41 s 的尾巴）。
8. **停手後的滑行**：Hubtown 首頁停手 0.5 秒後速度還有 **30 %**（我們的旅程 3 %、卡牌 2 %、地球 4 %、橋 23 %、海洋 19 %）。「重」的尾巴就是質感。
9. **整部電影跑完沒有任何 > 25 ms 的幀**（2142 幀，p50 8.3、worst 24.9 ms，切點那一幀就是最差值）；我們同樣方法的 flow.cjs：9 個 hitch，最大 **2 642 ms**（LOGO 湖面首次建立）、275 ms（海洋首次建立）、66／83 ms（旅程 p 10.5–10.7）。
10. **我們各段的「手感常數」彼此不一致**：旅程 ω 10.5、地球 ω 9.5、海洋 ω 6、橋 ω 5.5、卡牌條 ω 12；停手後 0.5 秒的剩餘速度 2 %–23 % 跳來跳去。**過章節邊界時手感會突然換檔**，這才是我們最大的「不絲滑」，不是數值本身慢或快。

**我們最大的 5 個差距**：(1) 每章停留預算只有 1/4–1/8；(2) 五套不同的彈簧、沒有共同的「重量」；(3) 首次進海洋／LOGO 湖面的一次性建置卡頓（0.7–2.6 秒）；(4) 章節文字是跟 p 擦洗（停手就停在半透明），不是時間驅動；(5) 硬切沒有溶解遮罩，換場景是靠 p 的 smootherstep 把兩邊都放大縮小。

---

## 一、(a) Hubtown 的技術與數字

### 1-1 技術棧（來自頁面自己載入的 script／網路清單／全域變數）

| 項目 | 觀察 |
|---|---|
| 框架 | Nuxt 3（Vue 3；`_nuxt/*.js`、`__NUXT_DATA__`、`.nuxt-route-announcer`），SSR + 客戶端接管，路由預取 `_payload.json` |
| 平滑捲動 | **Lenis 1.3.8**（`window.lenisVersion = "1.3.8"`）；`html/body` 都 `overflow:hidden`，真正的捲動容器是 `div.js-page-scroll`（`overflow-y: scroll`，帶 `lenis` class），首頁 `scrollHeight 25 260 px`、`/about` 6 156 px |
| 3D | **Three.js r179**（`window.__THREE__ = "179"`），WebGL2，一張全螢幕 canvas（1440×900，DPR 1）；`scene_1..4.glb`、`map*.glb`、KTX2（basis transcoder）、Draco、EXR 高度圖 |
| 後製 | 自製 shader 鏈：bloom（`luminosityThreshold`、`bloomRadius`、`bloomStrength`）＋ vignette ＋ noise ＋ distort／bend（`uMaxDistort`、`uBendAmount`）＋ 轉場進度（`uProgress`）＋ 光線揭示（`uRevealProgress`、`uLineLightRevealProgress`）；`uNormalizedDelta`（捲動速度）也進 shader |
| 標籤 | `CSS2DRenderer`（`.js-css2drenderer`）疊在 canvas 上 |
| 時間軸 | 頁面帶 Theatre.js bundle（`__TheatreJS_CoreBundle`，只露出 `_studio`）；**不能確認**鏡頭是不是用它編的（沒有 GSAP／ScrollTrigger 全域，可能已打包進 chunk） |
| 聲音 | `ambient-loop.wav`、`hover.wav`、`click.wav`、`modal-open.wav`、**`home-transition.wav`**（轉場有音效；預設靜音，要點「Click to enable audio」） |
| 載入 | 點狀進度條 →「Loading content」→「100% Loaded」→「Ready to Explore」；冷啟動（無頭 Chrome、無快取）到首頁可互動 **≈ 13.7 秒**（載入 40 多個 KTX2／GLB） |
| 版面 | 左側章節導覽 6 項（FUTURE / INNOVATION / COLLABORATION / EXCELLENCE / PURPOSE / LEGACY，目前章亮點），底部「SCROLL TO EXPLORE」，右下 CHAT WITH US |
| 註 | Marker.io 回饋小工具在無頭模式報 403（與捲動無關，忽略） |

### 1-2 捲動系統數字（同一台機器、同一個無頭 Chrome、真的 wheel 事件，`probes/smooth/hubtown-snap.cjs`）

| 項目 | 首頁（電影） | 內頁（/about） | 備註 |
|---|---|---|---|
| lerp（推得） | **≈ 0.04** | **0.1**（Lenis 預設） | Lenis 1.3 用 `damp(λ = lerp×60, dt)`，τ = 1/(60·lerp) |
| 時間常數 τ | **≈ 413 ms** | **≈ 167 ms** | 一格 100 px 的 63 % 時間：424／174 ms |
| 一格 100 px：63／95／99 % | **424／1207／1749 ms** | **174／482／699 ms** | 內頁在內建瀏覽器（120 Hz）量到 173／498／706 ms，環境一致 |
| 起步延遲 | ≤ 15 ms（下一幀） | ≤ 15 ms | 指數補間沒有 ease-in；峰值速度在 t = 0 |
| 每格行程 | 100 px，**不限幅**（deltaY 1000 → 1000 px） | 同 | `wheelMultiplier = 1` |
| 累加 | 5 格 @100 ms → 500 px；50 ms 一格連滾 2 秒 → 4000 px；60 筆×8 px（觸控板式）→ 480 px | 同 | 完全線性、無加速度曲線、無門檻 |
| 5 格 @100 ms 停手後 | 還剩 321／500 px（64 %），95 % 在 **1248 ms** | 還剩 201／500（40 %），95 % 在 498 ms | |
| 反向 | −500／−500 px，t95 361 vs 359 ms | — | 上下**完全對稱** |
| 停手後 0.5 秒的剩餘速度（連滾 1 秒後停） | **≈ 30 %**（τ 0.41 s 的指數尾巴） | ≈ 5 % | 模型值；實測 5 格停手曲線吻合 |
| 滾輪吸附 | **無**（5 種停手位置，停 3 s 後位移 0 px） | 無 | `probes/smooth/hubtown-snap2.cjs` |
| 原生捲動（`scrollTop =`）的後續 | 在「停泊區」（約 3600–5500、6000–8400、10800–12000、14400–17300、21600–22800 px）會自動滑到最近停泊點：目標 ≈ 900 px/s 前進，再接 τ 0.41 s 尾巴；距離 584–2904 px，耗時 3.2–5.8 s；其他區（鏡頭行進段）不吸 | — | 只在原生捲動（拖滾軸、鍵盤、錨點）出現；**滾輪永遠不吸** |
| 觸控／觸控板（小 delta） | 觸控板式小 delta 走同一條 lerp；**真的觸控沒有量**（無頭桌機沒有觸控慣性；Lenis 預設 `syncTouch:false` 時觸控是瀏覽器原生捲動） | | |
| 鏡頭是否再補間 | **沒有**：scrollTop 跳 1500 → 1800，鏡頭 z 在下一幀（6.7 ms）就到 | — | 所以鏡頭速度是「捲動速度 × 固定曲線」 |
| 影格 | 整部電影（2000 px/s 連滾到底）2142 幀：p50 8.3、p99 8.5、**worst 24.9 ms**，沒有 > 25 ms；最差那一幀剛好在第一個切點 | | 同機同瀏覽器；我們 flow.cjs 的 p50/p95 也是 8.3/8.4 |

### 1-3 電影結構（`probes/smooth/hubtown-map.cjs`）

總高 2800 vh = 25 200 px（`scrollHeight` 25 260）。DOM 是一串 `pointer-events-none` 的長區塊，每個區塊裡有一個 `sticky top-0 h-[100vh]` 面板釘住文字：

| 章 | 名稱 | 區塊 | 長度 | 主要運動 |
|---|---|---|---|---|
| 1 | FUTURE | `js-home:first`，400 vh | 3600 px（≈ 4 螢幕） | 立方體＋水面：鏡頭 z 80 → 35.5 緩慢推進、立方體自轉；標題 WE BUILD THE FUTURE OF REAL ESTATE 一直釘著 |
| 2 | INNOVATION | `js-home:second`，400 vh | 3600 px | 切到發光河谷（硬切，約在 scrollTop 3350）；標題 WE LEAD THE WAY IN DEVELOPMENT |
| 3 | COLLABORATION | `js-home:third` 的上半，500 vh | 4500 px | 硬切到光束（約 6540）；標題 WE WORK WITH A NETWORK OF EXPERTS |
| 4 | EXCELLENCE | 同一個 1000 vh 外殼的下半，500 vh | 4500 px | 場景內連續進行（鏡頭沒有大跳）→ 方塊城市；標題 TO BUILD WHAT OTHERS CAN ONLY IMAGINE |
| 5 | PURPOSE | `js-home:fourth` 上半，500 vh | 4500 px | 硬切（約 14000–14770，切點有 RGB 分離＋放射扭曲的溶解）；標題 SHAPE THE LAND WITH PURPOSE |
| 6 | LEGACY | 同外殼下半，500 vh | 4500 px | 場景內連續；鏡頭速度尾端「停泊」到 0（22 800 px 之後每 300 px 減半）；之後接頁尾 |

鏡頭速度 per scroll（單位／100 px，`hubtown-film.cjs`，2000 px/s 連滾）：
第 1 章 0.17、0.59、0.99、1.35、1.63、1.82、1.91、**1.93**（2100）、1.81、1.58、1.31（3000）｜第 2 章 3.2 → **12.6**（5700）→ 10.1（6300）→（切點）｜第 3–4 章 0.4–1.5 小幅起伏｜第 5–6 章 1.15 → **1.81**（18 000）→ 0.73（20 700）→ 0.26（21 900）→ 0.04（23 100）→ 0。
**每章都是鐘形、沒有階梯**；速度突變只發生在切點，而那裡被溶解遮住。

---

## 二、(b) 轉場文法（規則 + 數字，可套用到每一段）

### 2-1 規則

| # | 規則 | Hubtown 數字 | 套用到我們 |
|---|---|---|---|
| R1 | **一條捲動軸、一個重量**：全站同一個補間（Lenis），不同區段只換「增益」不換「手感」 | 首頁 τ 0.41 s、內頁 τ 0.167 s（兩種「重量」，在頁面層級切換，不在章節層級） | 全旅程／橋／卡牌／地球／海洋／LOGO／頁尾共用一套 `silk` 補間（第三節） |
| R2 | **3D 位置 = 平滑後的捲動位置**，不再補第二層 | 跳 300 px → 鏡頭 6.7 ms 到位 | 鏡頭、水、光都讀同一個 `progress`；不要在 scene 內再疊 `damp` |
| R3 | **每章 400–500 vh，其中鏡頭行進 ≈ 75 %、停泊 ≈ 25 %**；速度走鐘形，進章 ease-in、出章指數停泊 | 見 1-3 | 每張字卡至少 **30–40 格滾輪**（目前 5–13），章末 25 % 速度降到 < 5 % |
| R4 | **硬切要有溶解遮罩，而且溶解是時間驅動**，不跟捲動擦洗 | 875 ms；`uProgress` ≈ `cubic-bezier(.2,.25,.55,.8)`；`uMaxDistort` 1.43 → 0.13（ease-out）；`uBendAmount` −0.05 → −0.98；`bloomRadius` 0.21 → 0.64；`luminosityThreshold` 0.20 → 0.08；`vignetteRadius` 0.20 → 0.40；暗場 ≈ +250…+400 ms；光線揭示 `uRevealProgress` 0.02 → 0.77 約 1.1 s、S 形，到 ≈ 3 s 才完全 | 只用在「確實硬切」的地方（第四節 C8），其餘維持現有連續運鏡 |
| R5 | **重疊**：舊章文字在切點**前** ≈ 200 ms 開始淡出、切點後 ≈ 110 ms 清空；新章文字在切點**後 640 ms** 開始（等溶解過 70 %）；導覽點亮在 +640…+820 ms 交叉 180 ms | 見 R6 | 舊 0.3 s／新 0.64 s 延遲 |
| R6 | **文字揭示配方**：標題逐字隨機亂序淡入（0→1，**1.38 s**，≈ `cubic-bezier(.2,.05,.1,.95)`）；內文每行 `translateY 30 px → 0`＋`opacity 0 → 0.6`（**0.95 s**，行距延遲 **≈ 115 ms**，同一緩動）；按鈕在標題結束前後淡入（≈ +1.35 s 起，1.2 s）；沒有遮罩／clip，沒有模糊 | 實測：第一行 878–1716 ms、第二行 995–1834、第三行 1053–1955，標題 695–2017（皆相對切點） | 我們現有「story-line 遮罩滑上來」維持，改成**時間驅動**、延遲／行距照此 |
| R7 | **停手不停播**：溶解、文字、光線揭示都是時間驅動，滾輪停了照播（0.9 s 溶解＋最長 3 s 光線尾巴）；鏡頭本身仍跟捲動 | 見上 | 同 |
| R8 | **滾輪不吸附、不鎖、不吞格**：任何位置停手就停在那裡；只有原生捲動才被拉到停泊點 | 5 次停手位移 0 px | 不加吸附；也不要有「章節閘門」吞滾輪 |
| R9 | **速度連續**：除了被溶解遮住的切點，鏡頭速度對捲動位置沒有不連續 | 見 1-3 | 章與章之間的交接（旅程→橋→卡牌→地球）要有同樣的連續性（第三節） |

### 2-2 可直接貼的緩動與時間

```
--silk-dissolve:  875ms  cubic-bezier(.20,.25,.55,.80)     /* uProgress，近線性、兩端柔 */
--silk-out:       cubic-bezier(.20,.05,.10,.95)             /* 文字、位移、光線尾巴（≈ power3–4.out） */
舊章文字淡出:      300ms，起點 = 切點 −200ms，ease-in 到 0
新章標題:          delay 640ms，duration 1380ms，字元亂序 stagger（隨機排列，總散開 ≈ 700ms）
內文每行:          delay 640ms + 行號×115ms，duration 950ms，translateY(30px)→0，opacity 0→0.6
按鈕:              delay 1350ms，duration 1200ms，opacity 0→1
```

---

## 三、(c) Hubtown vs 我們（逐段）

我們的數字來自 `probes/smooth/ours-notch.cjs`（真實滾輪、逐幀記錄各段時鐘；`.qa/index1-5/smooth/ours-notch-1/ours.json`、`ours-notch-2/ours.json`）與既有的 `.qa/index1-5/flow-base/flow.json`（`probes/smooth/ours-flow-boundaries.cjs` 分析）。

### 3-1 一格 100 px 的反應（t = 滾輪事件後多少 ms 到達最終行程的 63 / 95 / 99 %）

| 段落 | 補間（程式位置） | 每格行程 | 63 % | 95 % | 99 % | 峰值速度時間 | 5 格後還剩 | 停手 0.5 s 剩餘速度 |
|---|---|---|---|---|---|---|---|---|
| **Hubtown 首頁** | Lenis lerp ≈ 0.04 | 100 px = 0.40 % 全片 | 424 | 1207 | 1749 | 0 ms | 64 % | 30 % |
| **Hubtown 內頁** | Lenis lerp 0.1 | 100 px | 174 | 482 | 699 | 0 ms | 40 % | 5 % |
| 我們：旅程（p 0.3／3.6／8.9／11.13 四處同值） | `stepJourneyMotion` 臨界阻尼 **ω 10.5**（`js/water-journey-story.js:54`） | 0.1307 單位 = 全程 1 % | **200** | **450** | **625** | 83–141 ms | 36–38 % | 3 % |
| 我們：橋（旅程終點 → 卡牌） | `portfolio-epilogue.js` `tick()`；index1-5 的 `CONFIG.mist.follow` = **ω 4.2**（`cards-bridge-build.cjs`；程式預設 5.5，:147） | 0.10 橋／格（`transition` 0→1 要 ~10 格） | 525 | 1141 | 1591 | 241 ms | **70 %** | 23 % |
| 我們：卡牌條 | `portfolio-slider.js` `createSpring` **ω 12**（:34）；輸入 `travel` 直接累加（`scrollBy`，:582）、`UNITS 6900`（`portfolio-epilogue.js:18`） | `travel` 立即 +；畫面走 ω 12 的彈簧 | ≈175（模型） | ≈392 | ≈550 | ≈83 | ≈43 % | 2 % |
| 我們：地球／全球段（world g:0.5） | `finnovation-world.js` `frame()` **ω 9.5**（:581） | 100 px | 250 | 550 | 766 | 125 ms | 46 % | 4 % |
| 我們：海洋章節（h:0.5／2／3） | `world-ocean.js` `omega(y)` → **ω 6**（`worldOcean.ease`，:39／:444） | 100 px | 358 | 791 | 1108 | 158–183 ms | 57 % | 19 % |
| 我們：LOGO 段（l:0.5） | 同海洋 ω 6 | 100 px | 358 | 791 | 1108 | 158 ms | 57 % | 19 % |
| **我們：首次到 h:1（海洋第 1 站）的第一格** | 同上 + 一次性建置 | 100 px | **1066** | 1491 | 1808 | 1058 ms | — | — |

讀法：
- 單看**數字**，我們的旅程（63 % 200 ms、95 % 450 ms）其實比 Hubtown 首頁**快很多**，接近它的內頁；Hubtown 首頁是刻意的「重」。
- **真正的差別是不一致**：旅程 3 % → 橋 23 % → 卡牌 2 % → 地球 4 % → 海洋 19 %。每過一個邊界，手感就換檔。
- 峰值速度時間：Hubtown 在 0 ms（立刻有回饋，之後減速）；我們的臨界阻尼在 80–180 ms 才到峰值（有一個很短的「軟起步」）。兩種都不壞，但**混用**才怪。

### 3-2 行程預算（停留）

| | Hubtown 首頁 | 我們的旅程 |
|---|---|---|
| 總長（以 100 px 一格） | 25 200 px = **252 格** | 13.07 單位 / 0.1307 = **100 格** |
| 章數 | 6 | 10 張字卡（`STORY_CHAPTERS`，`js/water-journey-story.js:3`） |
| 每章／每卡可讀的格數 | **36–45 格**（整章釘住） | 5–13 格（perspective 9.6 格；four paths 6.1；ai 4.9；public／private 4.9；derivatives 6.4） |
| 鏡頭「停泊」 | 每章尾約 25 % | 沒有統一的停泊曲線（見 `docs/index1-5-camera-20261024.md` 的路徑，該次只調鏡頭角度） |

### 3-3 邊界連續性與停手後滑行（flow.cjs 既有基線，120 ms 一格，從頁首滾到頁尾再滾回來）

| 邊界 | 方向 | 前一段最後移動 → 後一段第一次移動 | 兩段都沒動的空檔 | 速度（格／秒）前 → 後 | 備註 |
|---|---|---|---|---|---|
| 旅程 → 橋 | 下 | −8 ms → +34 ms | **42 ms** | 0.53 → 0.13 | 速度掉到 1/4：橋的 ω 5.5 比旅程慢一倍 |
| 橋 → 卡牌 | 下 | −117 → +67 ms | **184 ms** | 0.01 → 0.07 | 部分是量測假象：橋的時鐘用 `amount ≥ .999` 才換標籤，彈簧尾巴要 ≈ 1.6 s；實際卡牌條已在吃輸入 |
| 卡牌 → 地球 | 下 | −158 → +18 ms | **176 ms** | 0.00 → 0.43 | `onEnd?.(delta)` 要 `slider.progress ≥ 1 && amount ≥ .97` 才交棒（`portfolio-epilogue.js:191`），當格不帶餘量 |
| 地球 → 卡牌 | 上 | −9 → +150 ms | **159 ms** | −0.02 → −0.04 | `world.scrollPx` 要 `y < 2`（彈簧完全回到頂）才 `close()`（`finnovation-world.js:610`），尾巴約 0.66 s |
| 卡牌 → 橋 | 上 | −200 → +9 ms | **209 ms** | 0 → −0.17 | |
| 橋 → 旅程 | 上 | −8 → +150 ms | **158 ms** | −0.62 → −0.14 | |

每個交接大約吞掉 **1–2 格**（flow.cjs 一格 120 ms），而且一邊是 ω 9.5、一邊是 ω 5.5 的彈簧，速度不連續。Hubtown 沒有這種邊界：同一條 Lenis 軸到底。

### 3-4 卡頓（flow.cjs，往下一次）

| 位置 | 幀時間 | 原因（推測；`flow-fix-build.cjs` 檔頭描述的同類事件） |
|---|---|---|
| 旅程 p 0.90 | 33 ms | 一次性著色器／貼圖 |
| 旅程 p 10.49 / 10.70 | 67 / 83 ms | 同上 |
| 橋 0.92 | 33 ms | 卡牌條建置 |
| 世界 y 1610 / 2980 | 33 / 58 ms | 地球 |
| 世界 y 4975（海洋首次） | **275 ms** | 海洋建置（`world-ocean.js` `bake()`） |
| 世界 y 5031（LOGO 湖面首次） | **2 642 ms**（長任務 2 648 ms） | LOGO 湖面首次建立 |
| 往上 | 只有 1 個 25 ms | |

Hubtown：2142 幀、0 個 > 25 ms。我們往上的路徑已經很乾淨，往下的**首次進入**（海洋／LOGO）是最大的單一破壞。`prototypes/index1-5/flow-fix-build.cjs`（檔案已存在、檔頭註明要修這幾個點）在寫這份文件時**還沒登錄進 `build.cjs` 的清單**，`docs/smooth-flow/hitch-fix.md` 也還沒有；**它登錄進來後請重跑 `flow.cjs` 確認**，本研究的基線數字是修之前的。

---

## 四、(d) 實作提案

### 4-1 共用的「輸入 → 動作」平滑器（`silk`）

**目標**：全站一個手感；各段只調「增益」（每格走多遠）和「重量」（τ／ω）兩個旋鈕，進參數面板（L），符合「給客戶旋鈕」的慣例。

```
輸入    wheel / key / touch / 按鈕 → 統一成「格」(notch = 100 px)；deltaMode 換算、clamp ±400 px（維持現狀）
累加    一個全域目標 T（以「格」計），各段把 T 換成自己的時鐘；上下對稱、不限幅（旅程現有 ±1.25 單位的追趕上限留著，只防暴衝）
補間    兩級，與幀率無關（解析式）：
          lead += (T − lead) · (1 − e^(−dt/τ1))           // Lenis 式指數跟隨，給「重的尾巴」
          臨界阻尼彈簧 ω2 把 progress 拉向 lead              // 沿用現有 stepJourneyMotion 的解析式，給柔起步
        預設 silk B：τ1 = 0.22 s、ω2 = 12   →  63 % 404 ms／95 % 862 ms／99 % 1217 ms，峰值 225 ms，停手 0.5 s 剩 24 %
讀取    各段只讀 progress（旅程單位／橋 0–1／卡牌 travel／world y px）；場景內不再疊第二層 damp（規則 R2）
```

模型比較（`probes/smooth/model-filters.cjs`；圖 `evidence/hubtown/ht-vs-ours-notch.jpg`）：

| 候選 | 63 % | 95 % | 99 % | 峰值 | 5 格後還剩 | 停手 0.5 s 剩餘 | 用途 |
|---|---|---|---|---|---|---|---|
| Hubtown 首頁（指數 τ 0.417） | 413 | 1246 | 1917 | 4 ms | 65 % | 30 % | 目標感覺 |
| Hubtown 內頁（指數 τ 0.167） | 163 | 496 | 767 | 4 ms | 41 % | 5 % | |
| 我們旅程（ω 10.5） | 204 | 450 | 629 | 92 ms | 47 % | 3 % | 現況 |
| 我們橋（ω 5.5） | 388 | 862 | 1204 | 179 ms | 69 % | 23 % | 現況 |
| **silk A（τ1 .15＋ω2 14）** | 308 | 633 | 879 | 179 | 63 % | 11 % | 偏輕，卡牌條用 |
| **silk B（τ1 .22＋ω2 12）** | 404 | 862 | 1217 | 225 | 72 % | 24 % | **預設，全站** |
| silk C（τ1 .30＋ω2 11） | 500 | 1113 | 1596 | 263 | 79 % | 37 % | 最接近 Hubtown 首頁的「重」 |
| crit ω 8 | 267 | 592 | 829 | 125 | 56 % | 8 % | 只修橋／海洋、不動旅程的最小改法 |

建議：**把「重量」做成三檔旋鈕（A 輕／B 中／C 重），預設 B**；B 的 95 % 時間（862 ms）≈ 我們現在的橋、≈ Hubtown 首頁的 70 %，又保有柔起步。要完全像 Hubtown 首頁就選 C。

各段參數（**預設 B；「增益」是每格行程**）：

| 段 | 現在 | 提案 τ1／ω2 | 每格增益 |
|---|---|---|---|
| 旅程（0 → max） | ω 10.5；0.1307 單位 | 0.22／12 | **0.085 單位**（行程 +54 %，約 154 格；需同意） |
| 橋 | ω 5.5；10 格 | 0.22／12 | 10 格 → 12 格（需同意） |
| 卡牌條 | ω 12；`UNITS 6900` | 0.15／14（A） | 不變 |
| 地球／全球 | ω 9.5 | 0.22／12 | 100 px 不變 |
| 海洋（含 LOGO） | ω 6（`ease`） | 0.22／12（把 `omega(y)` 的 6 換成 silk，並拿掉 9.5↔6 的混合，改成同一組） | 不變 |
| 頁尾 | 同地球 | 0.22／12 | 不變 |

### 4-2 各邊界的交棒規則（上／下都要）

通則：**交棒時不丟輸入、不重置速度、不等彈簧收斂。**

| 邊界 | 現況問題 | 規則 |
|---|---|---|
| 旅程 → 橋（下） | `advanceJourney` 把 `target` 夾在 `max`，超出的那一格被丟掉（`js/main.js:6243`）；橋的 ω 5.5 較慢 | 超出 `max` 的餘量 `over = target + delta − max` 立即交給 `portfolio.take(over)`；橋的初始速度 = 旅程速度 × 單位換算（格／秒 → 橋／秒）；兩邊同一組 silk 參數 |
| 橋 → 卡牌（下） | 橋的標籤用 `amount ≥ .999`；`bt = 1` 時餘量已進條（OK），但 `introDone` 前條的視覺要等 | 保持餘量直進條（`takeBridge` :185）；改標籤門檻為 `bt ≥ 1`（量測才準）；`amount ≥ .97` 交棒門檻改成「條 `travel ≥ 1` 且 `lead` 已過 0.9」 |
| 卡牌 → 地球（下） | 要 `slider.progress ≥ 1 && amount ≥ .97` 才 `onEnd?.(delta)`（:191），當格餘量不帶 | `scrollBy` 回傳「未用掉的 px」，一起交給 `enterWorld(rest)`；`world.enter` 的初始速度 = 條的速度；`pendingWorldDelta` 上限 3 格維持 |
| 地球 → 海洋 → LOGO → 頁尾（下） | 同一個 world 彈簧，但 `omega(y)` 在 `dive` 段把 9.5 混到 6，等於在進海洋時**變重** | 改成同一組 silk，不再混；段與段只改增益，不改 τ／ω |
| 頁尾 → LOGO → 海洋 → 地球（上） | 連續（world 內），OK | 保持；LOGO 湖面首次建立的 2.6 s 卡頓移到「在 LOGO 前 1.9 個螢幕背景建」（`world.state.logo` 已有 lazy 建置，C1） |
| 地球 → 卡牌（上） | `world.scrollPx` 要 `y < 2` 才 `close()`（`finnovation-world.js:610`），回頂彈簧尾巴 ≈ 0.66 s 內的往上格被吃掉 | 條件改成「`yt ≤ 0` 且 `y < 40 px`」→ `close()` 並把當格餘量交給卡牌；`epilogue()?.take(rest)` |
| 卡牌 → 橋（上） | `slider.progress ≤ 0` 後累積 `back` 到 `GATE .1` 才關（:258，非橋模式）；橋模式 `next ≤ 0 → close()`（:177）直接關 | 橋模式不要有等待；餘量交給旅程 |
| 橋 → 旅程（上） | `close()` 後旅程 `journey.target` 要從 `max` 往回，初速 0 | 初始速度 = 橋速度換算；`journey.target = journey.progress`（現有 `delta * ahead < 0` 的反向重置保留） |

### 4-3 具體改動清單（8–12 項，依優先序）

> 一律以 `prototypes/index1-5/` 下的 **helper（`*-build.cjs` 對生成碼打補丁，錨點必須剛好出現 1 次）** 實作；**不手改** `prototypes/index1-5/js/*`（生成）和共用的 `js/`。新增 helper `prototypes/index1-5/smooth-input-build.cjs`，在 `build.cjs` 第 29 行清單的最後加進去（寫這份文件時清單最後是 `logo-panel-build.cjs`，`flow-fix-build.cjs` 尚未登錄；兩者都登錄後，本 helper 排在 `flow-fix` 之後）；runtime 放 `extra['smooth-input.js']`（同 `flow-fix.js` 的做法，`?smooth=0` 關閉並回到舊碼，方便 A/B）。每項都用 `scripts/index1-5/flow.cjs`＋`probes/smooth/ours-notch.cjs` 做前後對照。

| # | 優先 | 改什麼（位置） | 為什麼（證據） | 需同意？ |
|---|---|---|---|---|
| **C1** | P0 | **首次進入的建置搬出捲動路徑**：`flow-fix-build.cjs` 的 `extra['world-ocean.js']` `bake()` 與 `extra['world-logo*.js']`（湖面）往前移到「進地球前就在閒置時間分片」；目前 `h:1` 第一格延遲 1066 ms | flow：275 ms、**2 642 ms**；ours-notch：h:1 首格 63 % 在 1066 ms（其他位置 358 ms） | 否（不改畫面；重跑 flow.cjs 驗證；`flow-fix-build.cjs` 已寫了同方向的補丁，先看它登錄後剩什麼） |
| **C2** | P0 | **共用 `silk` 補間**：新增 `extra['smooth-input.js']`（解析式兩級補間＋ `SILK` 參數＋ `?smooth=0`）；把下列 5 處換成呼叫它：① `stepJourneyMotion` 本體（`js/water-journey-story.js:54` 生成副本；`omega=10.5`）② 橋 `tick()`（`portfolio-epilogue.js:147` `omega = bridge ? follow : 8`）③ 卡牌條 `createSpring`（`portfolio-slider.js:34`）④ `finnovation-world.js` `frame()`（:581 `omega = 9.5`）⑤ `world-ocean.js` `omega = y => mix(9.5, ease, …)`（:444） | 手感常數 5 套互不相同（3 %–23 %），邊界換檔 | **是**（動態手感；先出 A/B 與三檔旋鈕） |
| **C3** | P0 | **交棒不丟餘量**：`advanceJourney`（`js/main.js:6243`）超出 `max` 的量交給 `portfolio.take(over)`；`takeBridge`（`portfolio-epilogue.js:170–193`）與 `slider.scrollBy`（`portfolio-slider.js:582`）回傳未用掉的 px；`onEnd?.(delta)`（:191）帶餘量；`world.scrollPx`（`finnovation-world.js:608–614`）上緣的 `y < 2` 改 `y < 40` 並把餘量 `epilogue()?.take(rest)` | flow 六個邊界各吞 1–2 格（42–209 ms 空檔） | 否（不改畫面，只減少死格）；仍會先出前後對照 |
| **C4** | P1 | **交棒帶速度**：橋／world／旅程的 `velocity` 初值由上一段的速度換算（`silk` 提供 `inherit(v)`） | 旅程→橋速度 0.53 → 0.13 格／秒 | 是（動態） |
| **C5** | P1 | **停留預算（每格增益）**：`CONFIG.smooth.journeyNotch`（0.1307 → 0.085）取代 `advanceJourney` 的 `/ Math.max(720, innerHeight * .85)`（`js/main.js:8139` 的滾輪處理、`notch()` :6216 同步）；字卡時間窗 `STORY_CHAPTERS`（`js/water-journey-story.js:3`）是進度單位，會自動變長，不改文案 | 每張卡 5–13 格 vs Hubtown 36–45 | **是**（整體節奏；先出 1.0／1.3／1.54× 三檔） |
| **C6** | P1 | **字卡時間驅動**：`mountJourneyStory().update()`（`js/water-journey-story.js:34–49`）目前每幀依 `p` 寫 `--opacity/--entry/--exit/--zh`（smootherstep，淡入窗 ≤ 0.19 單位）；改為「進入 `show` 就觸發一次時間軸」：舊卡 300 ms 淡出（切點 −200 ms 起）、新標題 delay 640 ms／duration 1380 ms、行 stagger 115 ms／950 ms／translateY 30→0／opacity 0→0.6、緩動 `cubic-bezier(.2,.05,.1,.95)`；CSS 在 `prototypes/index1-5/index1-5.css`（`.story-card`、`.story-line`） | 擦洗式 → 停手會停在半透明；Hubtown 停手照播 | **是**（視覺／動態） |
| **C7** | P1 | **章末停泊曲線**：在鏡頭路徑上把每章最後 25 % 的行進量乘上指數停泊（每 300 px 速度減半）；不動鏡頭關鍵格，改在 `updateDropTransition()`（`js/main.js:6244`）把 `J.progress` 餵給鏡頭前先過 `park(p)` 單調映射（高度／yaw／水平偏移同步，免得擦出視差） | Hubtown 章末速度 → 0；我們沒有統一停泊 | **是**（鏡頭） |
| **C8** | P2 | **硬切加時間驅動溶解**：我們現有的合成通道 `journeyBlend`（`js/main.js:6076`，`composer.insertPass(journeyBlend, 1)`）加一個一次性時鐘 `uProgress`（875 ms，`cubic-bezier(.2,.25,.55,.8)`），`distort 1.43→0.13`、`bend −0.05→−0.98`、`bloomRadius .21→.64`、`vignette .20→.40`、暗場 250–400 ms；只掛在**真正換場景**的點（開場 → 山谷、山谷 → 橋），不掛在連續運鏡上 | Hubtown 三個硬切都在溶解下；切點成本被吃掉（最差 24.9 ms） | **是**（視覺） |
| **C9** | P2 | **統一滾輪換算 `wheelPx(e)`**：`js/main.js:8136` 的 wheel 處理與 `finnovation-world.js` 的 `toPixels`（:606）、`portfolio-epilogue.js` 的 `notch()` 共用同一個函式（`deltaMode`、clamp、`ctrlKey`／橫向判斷維持）；觸控 `1.9` 係數放進同一張表 | 目前三處各自換算 | 否 |
| **C10** | P2 | **觸控慣性／fling 與 silk 對齊**：`finnovation-world.js` `fling()`（:615–622，`v*.33`，上限 1.6 H）改用 silk 的 `lead` 注入；旅程的觸控（`js/main.js:8143` `1.9/…`）同理 | 觸控沒有量到、但各段 fling 規則不同 | 是（動態），在真機量 |
| **C11** | P2 | **參數面板**：`CONFIG.smooth = { weight: 'B', tau1, omega2, journeyNotch, dissolveMs, textDelay… }` 進 L 面板（群組「絲滑」），`複製參數 JSON` 可帶走 | 客戶看感覺、要旋鈕 | 否（面板本身；預設值在同意前＝現況） |
| **C12** | P3 | **像素運動探針**：`probes/smooth/` 新增 `pixel-motion.cjs`（每幀把 canvas 縮成 32×18 比對上一幀）量「眼睛真的看到的運動」；目前邊界空檔來自各段內部時鐘（橋的 `amount ≥ .999` 標籤、條的 `travel` 是目標），不是畫面 | 3-3 的「184 ms／176 ms」有一部分是量測標籤的假象 | 否 |

### 4-4 驗收（做完每一項都跑）

```
node scripts/index1-5/flow.cjs --out smooth-after                    # 往下／往上：hitch、stall、jump 都要 ≤ 基線；邊界空檔 < 1 格
node scripts/index1-5/probes/smooth/ours-notch.cjs --out smooth-after # 每段 63/95/99 %、停手剩餘速度，對照 3-1 表
node scripts/index1-5/probes/smooth/ours-flow-boundaries.cjs --dir smooth-after
node scripts/index1-5/probes/smooth/model-filters.cjs                 # 改參數前先看模型
```
通過標準：各段 63 % 在 350–450 ms、95 % 在 800–900 ms（預設 B）；停手 0.5 s 剩餘速度在各段之間相差 < 5 個百分點；邊界空檔 ≤ 1 格；沒有 > 50 ms 的幀；`?smooth=0` 完全回到舊行為。

---

## 五、方法、限制、檔案

**方法**
- 內建瀏覽器（120 Hz）只用來認技術與驗證內頁 τ（173／498／706 ms）；其餘量測都在**我們自己的無頭 Chrome（GPU）**跑，載入前先 hook WebGL（`getUniformLocation` 命名、`uniformMatrix4fv`、`cameraPosition`、`uniform1f`），每幀記錄 scrollTop、鏡頭位置、所有浮點 uniform，滾輪事件用 `WheelEvent` 在 rAF 內定時送出（Hubtown 不檢查 `isTrusted`，Lenis 接受），我們的頁面用真的 `page.mouse.wheel`。
- 全部在同一台機器同一個瀏覽器，數字只拿來互相比較。

**限制 / 沒量到**
- 真實觸控慣性（無頭桌機沒有）、Hubtown 的章節文字**離場**精確曲線（只量到 ≈ −200…+110 ms 淡出）、載入器 → 首屏的轉接時間（只看到流程，沒量數字）、第 3→4 與 5→6 章之間是場景內連續（鏡頭沒有大跳），但視覺換景的精確位置沒有定。
- 切點的捲動位置是在 1500–2000 px/s 連滾時讀到的 `scrollTop`（≈ 3350、6540、14000–14770），靜止時（原生跳到位置後等 2 秒）看到的同一個位置畫面會不同——鏡頭領先／落後 `scrollTop` 約 0.6–0.8 秒的位移；所以切點位置誤差 ±600 px。
- 「原生捲動被吸附」只在程式把 `scrollTop` 設定到位時觀察到；真人拖滾軸未測。
- 我們的卡牌條時鐘 `strip` 是**輸入累加（目標）**，不是畫面位置；3-1 表的卡牌條列用模型值。

**證據圖（`docs/smooth-flow/evidence/hubtown/`）**
| 檔案 | 內容 |
|---|---|
| `ht-static-A.jpg` … `ht-static-D.jpg` | 6 章在靜止位置的畫面（y = scrollTop；括號為原生跳位後被拉到的停泊位置） |
| `ht-cut-A.jpg` | 第 2 → 3 章切點：−405…+2205 ms 12 幀（舊字淡出、暗場、新標題逐字出現、內文上升） |
| `ht-cut-B.jpg` | 第 4 → 5 章切點：RGB 分離＋放射扭曲溶解（−410…+2116 ms） |
| `ht-vs-ours-notch.jpg` | 一格反應與停手後速度：Hubtown 首頁／內頁、我們各段、silk B |

**腳本（`scripts/index1-5/probes/smooth/`）**
`ht-lib.cjs`（WebGL hook、滾輪送出、曲線擬合）｜`hubtown-home.cjs`（首頁滾輪實驗）｜`hubtown-map.cjs`（電影長度與鏡頭／位置）｜`hubtown-film.cjs`（連滾整部、切點 uniform、每 px 鏡頭速度）｜`hubtown-sheets.cjs`＋`make-cut-sheets.cjs`＋`sheet.cjs`（畫面證據）｜`hubtown-live-analyse.cjs`（溶解與文字時序）｜`hubtown-snap.cjs`／`hubtown-snap2.cjs`（Lenis 常數、吸附）｜`ours-notch.cjs`／`ours-flow-boundaries.cjs`（我們的同法量測）｜`model-filters.cjs`／`chart-notch.cjs`（候選補間模型與圖）。
一次只開一個瀏覽器（共用 `lib.cjs` 的鎖）。

**原始數據**（`.qa/index1-5/smooth/`）：`ht-home-1/`、`ht-map-1/`、`ht-film-1/`、`ht-sheets-1/`（含 `live-*.json` 每幀 uniform 與文字時序）、`ht-snap-1/`、`ours-notch-1/`、`ours-notch-2/`、`flow-base`（既有）。
