# index1-5 優化 第一輪結果 2026-10-26

## 一句話
審查（67 項）、基準量測、畫面比對工具都做完了；施工只留下 **cpu 組**（驗證過、有效）；boot、firstpass、cover 三組因為**無法證明桌機畫面不變**而撤回（預設關閉，程式與草稿都留著）；手機組沒做完，也關著。

## 目前線上狀態（預設建置）
- 啟用：`perf-cpu-build.cjs`（6 項，見下）。
- 不啟用：`perf-boot`、`perf-firstpass`、`perf-cover`（打開：`PERF_ON=boot,firstpass,cover`）、`perf-phone`（打開：`PERF_PHONE_ON=1`）。
- 整頁檢查（桌機＋手機）0 錯誤；建置沒有 SKIPPED。
- 優化前的 html 備份：`index1-5-優化前備份.html`（資料夾根目錄，只有 html）。完整還原（html＋js）：`node scripts/index1-5/restore.cjs "_archive/backups/index1-5-perf-before-20261025-20261025-2330" --yes`。

## 保留：cpu 組（主執行緒）
| 項目 | 做了什麼 |
|---|---|
| bridge-ink-root-var | `--alp-bridge-ink` 原本寫在 `<html>`（橋段約 25 次整頁樣式重算），改寫在唯一用到它的 `.fi-header`，數值序列不變 |
| scroll-handler-own-write | 世界段的 scroll 監聽，遇到自己寫入 scrollTop 引起的那一次事件就不再讀 scrollTop（旗標每幀清除，不會吃掉真的捲動） |
| dom-write-hygiene | 每幀無條件寫入的 class／CSS 變數／inert／opacity，值沒變就不寫（main.js、世界段、原則段） |
| flash-layer-idle | 看不見的轉場閃光層（opacity 0）改為 `visibility:hidden`，只在有閃光時才寫 transform |
| per-frame-garbage（部分） | 顏色字串解析快取、地形設定鍵值只在數字變了才重建 |
| alpine-ui-loop（部分） | 只做了上面的標題墨色寫入；`updateLabels()` 本身、閒置 loop、LOGO 面板 400 ms 計時器沒動 |

**驗證**
- 畫面：只開 cpu 組 vs 乾淨對照組（同一份 html、所有優化關閉），峽谷＋世界段 19 張，16 張在雜訊底內；3 張超標（世界 h0.5／h1.5／h3）看差異圖是**海面水波紋的相位**，文字、照片、版面完全一致。
- 效能（手機 390×844、CPU 放慢 4×，真滾輪，每個版本跑 2 次）：
  - FOUR PATHS → 卡牌（橋段）：超過 25 ms 的幀 34／18 → 7／10；p95 33.5／25.1 → 16.7／16.7 ms。
  - 整趟：超過 25 ms 的幀 75／41 → 29／30。
  - 沒變：最差一幀約 380–410 ms、超過 50 ms 的幀數、開機 ready 時間（都在雜訊內）。這些是「第一次經過」的準備工作，屬於被撤回的 firstpass／boot。
  - 橋段的 149 ms 長任務（`updateLabels`）仍在。

## 撤回的三組（草稿保留）
撤回原因一致：自動比對在湖面旋轉／停留（ls／lh）、世界過渡、峽谷 p8 出現超出雜訊底的差異，而我無法證明那只是動畫時間相位的偏移。只開 boot：6/19 張；只開 firstpass：5/19；只開 cover：4/19；只開 cpu：1/19（之後的公平對照是 3/19，皆為水波紋）。**不能確定的事，就不留在線上。**

- **boot**（`perf-boot-build.cjs`）：重複載入的 story 模組合併（57→55 個請求）、GLTFLoader／LOGO 面板／草地圖集改為用到才載、移除世界段沒用的 GSAP（原碼 `if (disposed || sectionMotion) return` 本來就走不到）、隱藏沒顯示過的 Section Two、預載整個靜態模組圖、石紋法線貼圖改分段（位元組相同，原本開機佔 324 ms／4×CPU 1.4 s；已加「玻璃第一次要畫前強制做完」保險）。**terrain-early-start 另外撤銷**（畫面差異超出雜訊、時間收益看不出來）。
- **firstpass**（`perf-firstpass-build.cjs`）：卡牌 OGL 建立（54＋72 ms）、LOGO GLB 準備（75 ms，之後無長任務）、原則段貼圖上傳、島嶼／照片／影片上傳的分段。第一次經過的卡頓大多已消失，但沒有證據證明畫面不變。
- **cover**（`perf-cover-build.cjs`）：被卡牌／世界蓋住時暫停旅程畫面與 loop、海洋影片在原則／湖／頁尾暫停、卡牌 slider 縮放時 render target 洩漏（修好）。往返測試狀態相同。
- **phone**（`perf-phone-build.cjs`）：9 項（卡牌 DPR、轉場取樣、鏡像／擷取縮小、手機關背景模糊與顆粒、原則背景與地球色調圖的手機版）都只是靜態估算，沒有在 390 px 看過；其中一項會關掉手機的顆粒，所以關著。

## 審查中被證實不對的項目
- opening-keylight-shadow：說「沒有東西接收陰影」是錯的，關掉它開場右下角會差約 50 階；基準裡 128 MB 的 4096² 貼圖其實是**峽谷太陽的陰影貼圖**（只烘一次），不是開場的燈。
- alpine-canyon-tufts 的重複載入：目前的建置已經沒有這個問題。
- 刻意沒做：手機休息時降到 60 fps（需要客戶同意）、phone-shadow-look。

## 驗證方法的限制（下一輪要先解決）
1. **動畫時鐘綁在頁面載入時間**：水、水滴、湖面的相位依載入速度而變，載入順序一改（預載、延遲載入、idle），同一個捲動位置的畫面就會不同。比對工具的雜訊底只能涵蓋「同一份程式碼」的變動，所以對「改變載入時機」的優化會誤報，也無法分辨小的真實差異。要可靠，需要**固定時間（虛擬時鐘）的截圖**：覆寫 `performance.now`／`requestAnimationFrame`，每幀固定前進 1/60 s，並以幀數而不是毫秒等待。
2. **舊基準過期**：昨晚的基準（build i15-mvnzjbah）之後素材被換過（素材雜湊變了），不能再用；之後一律用「同一份 html、所有優化關閉」的對照組（`PERF_OFF=boot,firstpass,cover,cpu`）。
3. **build.cjs 會把上一次的 index1-5.html 當模板再寫回去**：helper 寫進 html 的東西，關掉 helper 不會撤回；沒有檢查是否已存在的 helper 會每次多加一份（手機組累積了 12 份，已清除）。`index1-5-terrain.js` 等四個手工維護的模組也是原地改寫，boot 組用 extra 寫回造成檔頭註解累積 11 行（已用快照還原）。**之後 helper 一律要有起訖標記並且冪等，撤回時要同時清 html。**
4. 凍結的快照伺服器（`scripts/index1-5/frozen-server.cjs`，port 5622）對不上基準，所以不能當「優化前」參考。

## 工具與紀錄
- 比對：`scripts/index1-5/parity.cjs`（capture／noise／compare；`--sections`、`--only`、`--css` 可注入故意的改動驗證會 FAIL）。自測：同一份程式碼兩次 PASS；注入 `saturate(1.08)` FAIL。
- 量測：`.qa/index1-5/perf-baseline-tools/perf-baseline.cjs`；基準 `docs/perf/index1-5-baseline-20261025.md`；審查 `docs/perf/index1-5-audit-findings-20261025.md`。
- 二分記錄：`.qa/index1-5/bisect`、`bisect2`、`bisect3`；手機 CPU 對比：`.qa/index1-5/cpu-ab`。
- 各組原始回報：`.qa/index1-5/perf-tier1-results.json`。

## 下一輪建議順序
1. 做固定時間的截圖（上面第 1 點），把比對變成可靠的關卡。
2. 用它重新驗證 boot／firstpass／cover，逐項而不是整組（每項各自的 `PERF_BOOT_SKIP`、cover 的 bisect 開關已經有）。優先順序：firstpass（第一次經過的卡頓，最影響順暢度）→ cover → boot。
3. 手機組：先在 390 px 看過每一項再開。
4. 審查清單裡還沒碰的項目（約一半）：ocean-photo-forced-layout（手機 CPU 熱點）、tufts-vertex-cull、MSAA 深度解析、mark-nonindexed 等。
