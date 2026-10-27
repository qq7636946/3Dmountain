# index1-5 優化團隊作業規範（2026-10-25）

目標：index1-5 在**不改設計與動畫**下做到最順、最輕。桌機畫面必須與優化前**視覺相同**；手機可降低看不清楚的細節（解析度、取樣、層數、貼圖大小），但看起來仍要正確。

資料：基準 `docs/perf/index1-5-baseline-20261025.md`；審查 67 項 `docs/perf/index1-5-audit-findings-20261025.md`（完整證據與做法：`.qa/index1-5/perf-audit-results.json`，索引 0 載入／1 旅程GPU／2 世界GPU／3 CPU-DOM）。優化前備份：`_archive/backups/index1-5-perf-before-20261025-20261025-2330/`（還原：`node scripts/index1-5/restore.cjs "<資料夾>" --yes`）。

## 五個工作組，各一個 helper 檔（只改自己的）
| 組 | helper | 範圍 |
|---|---|---|
| boot | `prototypes/index1-5/perf-boot-build.cjs` | 載入路徑：首屏前下載、模組圖、重複載入、未使用的模組／素材、開機長任務 |
| firstpass | `prototypes/index1-5/perf-firstpass-build.cjs` | 「第一次經過」的卡頓：卡牌建立、湖景／GLB 建立、貼圖上傳、俯衝首幀、世界進場首幀 |
| cover | `prototypes/index1-5/perf-cover-build.cjs` | 被蓋住／看不到仍在跑的工作（暫停旅程、卡牌 loop、被蓋的畫布、重複繪製、影片、多餘的複製與 target） |
| phone | `prototypes/index1-5/perf-phone-build.cjs` | 只影響手機：DPR、取樣、鏡像大小、素材變體、shader 取樣數 |
| cpu | `prototypes/index1-5/perf-cpu-build.cjs` | 主執行緒：版面讀取、每幀配置／DOM 寫入、閒置 loop、CSS 變數、小的 GPU 清理 |

build.cjs 最後會依序跑這五個檔。helper 契約：`({main,drops,letters,glass,html,extra,journey,watershed,ui}) => 同樣這些（可改）＋ extra:{ '檔名.js': 原始碼 }`；用「錨點字串只出現一次」的 `once(src, anchor, replacement)` 修補**產生出來的文字**（main.js、extra['finnovation-world.js']、extra['world-ocean.js'] 等；先看 build.cjs 與各 `*-build.cjs` 怎麼組出來）。新的本機模組請用 `perf-*.js`（放 `prototypes/index1-5/`，在 helper 的 `extra` 裡隨檔出貨）。helper 丟錯誤時 build 會跳過它並印 `PERF HELPER SKIPPED: …`（所以每次建置都要看輸出有沒有這行）。

## 建置與驗證流程（共用瀏覽器與建置輸出，一律走鎖）
- 單獨建置自己這組：`PERF_ONLY=<組名>`，例如 boot。**瀏覽器與建置必須在同一次鎖內**，指令用 cmd 語法（`set VAR=值&& …`，`&&` 前不要空格）：
  `node scripts/index1-5/with-lock.cjs "set PERF_ONLY=boot&& node prototypes/index1-5/build.cjs && node scripts/index1-5/check.cjs --no-build"`
- 鎖裡不能用 heredoc；要跑的探針腳本先寫成檔案；`--query` 裡的 `&` 要加引號。靜態伺服器 `http://127.0.0.1:5621`（沒回應時：`node scripts/logo-letters/overlay-server.cjs "G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3" 5621` 背景執行）。一律帶 `--query logopanel=0`。
- 排隊會很久：**把自己這組的改動寫完再驗證**，不要改一行就跑一輪；驗證失敗再用 `PERF_OFF` 或註解法二分。
- 畫面不變比對：用 `scripts/index1-5/parity.cjs`（用法見檔頭）；基準畫面在 `.qa/index1-5/parity-base-*/`。桌機超出雜訊門檻就是失敗，要修正或撤回。
- 量數字：`.qa/index1-5/perf-baseline-tools/perf-baseline.cjs`（`--mode sections|wheel|throttle|boot`、`--profile desktop|stress|phone`、`--rate 4`）。GPU 計時有雜訊，同處至少量兩次取中位數；桌機 1440×900 多半停在 8.3 ms（120 Hz），要看差別請用 `--profile stress`（2560×1440）。
- 手機：390×844 模擬（`--phone`）；GPU 在這台是 RTX 4070，真手機慢得多，所以看「工作量」（像素、取樣、draw、位元組、長任務）而不是只看毫秒。

## 規則
1. 不執行 git；不刪除、不搬移任何專案檔（要丟掉的東西只能移到 `_archive/`）；不改共用的 `js/`、`css/`；不手改 `prototypes/index1-5/js/*`（建置產物）。
2. 只改自己的 helper 與新的 `perf-*.js`。若一定要改既有的本機模組（例如 world-ocean.js），改動要小、錨點明確，並在回報裡寫清楚（其他組可能在補同一個檔的別處）。
3. 桌機畫面與動畫不能變：不改任何預設值、曲線、時序、顏色、順序。「提早做、不改結果」的工作可以（例如把準備工作移到閒置時間）。
4. 手機降規要有依據：使用既有的手機判斷（`mobile-render-budget.js` 等；審查指出目前有四套不同的「手機」判斷，優先沿用同一套），降到「在 390 px 寬看不出差別」。
5. 每一項都要有證據：改前／改後的數字（工作量或毫秒）＋畫面比對結果。做不到或風險太高的項目不要硬做，在回報中標「未做」並寫原因。
6. 不要寫 `.md` 報告檔（子代理寫報告 .md 會被擋）；報告放在最後的結構化回傳；暫存輸出放 `.qa/index1-5/perf-<組名>/`。
7. 其他工作階段（GPT 等）可能同時在改專案；改檔前先看檔案現況；遇到不認得的改動不要覆蓋。
8. 結束前跑一次**不帶 PERF_ONLY** 的完整建置，確認五個 helper 都 `applied`、沒有 `SKIPPED`（如果別組的 helper 還沒好，只要自己的 applied 即可）。

---
## 目前狀態（2026-10-26 凌晨，客戶要求先停）
- 審查完成（67 項）、基準量測完成、比對工具 `scripts/index1-5/parity.cjs` 完成，桌機基準 `base`／雜訊底 `base2` 與手機基準 `base` 已拍。**手機 `base2`（雜訊底第二份）拍到一半被停掉**（`.qa/index1-5/parity-base2-phone/` 不完整）。
- 五個 helper（`perf-*-build.cjs`）仍是空的樣板；建置輸出自 23:31 起沒有變（施工團隊被停在「寫程式、等 parity-READY」之前，沒有留下未驗證的改動）。
- 要繼續：
  1. 補拍手機雜訊底：`node scripts/index1-5/with-lock.cjs "node scripts/index1-5/parity.cjs capture --name base2 --profile phone --twin-of base --force"`（約 10 分鐘）。
  2. 建立 `.qa/index1-5/parity-READY.txt`（任何內容）放行。
  3. 重新啟動「前一半」施工團隊（五組；範圍見審查報告與 TEAM-PLAN；腳本在 `C:\Users\lee\.claude\projects\...\workflows\scripts\index1-5-perf-tier1-wf_a530e2ef-5e5.js`，可用 Workflow scriptPath 重跑）。
  4. 完成後做整合建置（不帶 PERF_ONLY）、完整比對、重量基準。

---
## 更新（2026-10-26 完成第一輪）
前面「目前狀態」已過期。第一輪結果與結論見 `docs/perf/index1-5-optimisation-round1-20261026.md`：只留 cpu 組；boot／firstpass／cover 預設關閉（`PERF_ON=boot,firstpass,cover`）；phone 關閉（`PERF_PHONE_ON=1`）。比對要先做「固定時間」的截圖才可靠。
