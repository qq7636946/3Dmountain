# index1-5 QA 工具組（`scripts/index1-5/`）

**用途：不用自己寫瀏覽器腳本，就能驗證 `index1-5.html`——建置健康檢查、截圖對照表、參數試值、滾輪手感、卡牌轉場、效能、參數面板、備份與還原。**

## 開始之前

1. **一律在專案根目錄執行**（下面的指令都是從根目錄打的）：
   `G:\我的雲端硬碟\2026_專案資料夾\2607_恒灝\site\3Dmountain-3`
2. **本機伺服器要開著**（不會自動重整；已經在跑就跳過）：
   ```
   node scripts/logo-letters/overlay-server.cjs "G:\我的雲端硬碟\2026_專案資料夾\2607_恒灝\site\3Dmountain-3" 5621
   ```
   確認：<http://127.0.0.1:5621/index1-5.html>。**不要用 5502**（Live Server 存檔就重整）。
3. **改了 `prototypes/index1-5/` 的來源或 helper，要先建置**才看得到：`node prototypes/index1-5/build.cjs`（或 `check.cjs` 會幫你跑）。`prototypes/index1-5/js/` 是產生的，不能手改。
4. **一次只跑一個瀏覽器**：工具會自動排隊（鎖檔在 `%TEMP%\montis-index1-5-qa-browser.lock`），看到「排隊中」就等；確定沒有別的在跑才用 `--no-lock`。

## 輸出位置

| 東西 | 位置 |
|---|---|
| 截圖、對照表、紀錄 | `.qa/index1-5/<--out 名稱>/`；沒給 `--out` 就是 `.qa/index1-5/<工具>-yyyymmdd-hhmmss/` |
| 每次都有 | 單張截圖 `.jpg`、`sheet.jpg`（有標籤的對照表）、`run.json`（參數、網址、到達位置、錯誤、L*） |
| 備份 | `_archive/backups/index1-5-<卡號>-<yyyymmdd-hhmm>/`（含 `BACKUP.json`） |

工具印出的路徑都是完整路徑，可以直接拿去開圖。

## 共通規則

- **位置 p**（`journey.progress`）：`0` 開場、`1.12` 爆開、`2.96` 字成形、`3.6` 字標定形、`4.6` 一鏡到底、`5.56`／`8.9` 峽谷、`11.13`／`12.3` 升空、`max`（≈13.07）FOUR PATHS。卡牌、地球、海洋、頁尾在旅程**之後**，用 `world-shot.cjs`、`cards.cjs`、`wheel.cjs --world`。
- **視窗**：預設桌機 1440×900；`--phone` ＝ 390×844 手機模擬（觸控、2 倍像素）；`--w` 小於 700 也自動當手機。
- **截圖工具預設帶 `?tune=0`**（不開面板）；`--query "&logolook=original"` 加別的旗標（`--query` 優先）。
- **改參數試看**：`--set "group.key=值,group.key=#hex"`，執行中寫進 `CONFIG` 再呼叫 `window.index4.applyConfig()`。
  - 標「重整生效」的參數要加 `--early`（在場景建立前寫入；只影響這次截圖，不改任何檔案）。
  - 群組或鍵打錯會直接停（結束碼 2）；確定要新增 CONFIG 沒有的鍵才加 `--allow-new`。群組與鍵名用 `config.cjs` 查。
- **L\***：每張截圖都算中位明度 L\*（0–100，團隊用的亮度量尺；例：開場 55、山谷 35–47）。`sweep.cjs` 另外算 **Δ**＝和同列第一張的平均 RGB 差（0 ＝ 完全一樣；看起來差不多時拿來判斷參數到底有沒有作用）。
  畫面本身一直在動，所以**同一個值重拍也有 Δ**（實測：p 12.3 空拍約 2、p 8.9 峽谷河面約 7、海洋章節約 10）。要知道這次的雜訊多大，就把目前值也放進 `--values`（例如目前 7 → `--values "7,4,9"`）；Δ 沒有明顯大過那一格，就是看不出差別。海洋段的 Δ 幾乎都是浪在動，要看圖。
- **結束碼**：`0` 通過｜`1` 有錯（頁面錯誤、位置沒到、檢查失敗）｜`2` 指令打錯／被拒絕｜`3` 超時（`--timeout 秒數` 可調）。
- 每個工具都有 `--help`。頁面錯誤（pageerror、console.error）一律印在 `errors [...]` 那一行；favicon 404 這種無害的會列在 `ignored`。

## 工具

### 1. `check.cjs` — 建置＋語法＋頁面健康檢查（一行 JSON）
建置 → 每個 `prototypes/index1-5/js/*.js` 和 `alpine-ui.js` 用 ES module 語法檢查（一般的 `node --check` 抓不到）→ 載入頁面、走到 5.56 和終點 → 收集頁面錯誤。
```
node scripts/index1-5/check.cjs --no-build
node scripts/index1-5/check.cjs --phone
```
別人正在截圖時用 `--no-build`。輸出例：`{"ok":true,"build":"skipped","syntax":[],"errors":[],"ms":{"ready":6262,"journey":9024},…}`

### 2. `shot.cjs` — 旅程位置截圖＋對照表
```
node scripts/index1-5/shot.cjs --at "0,2.96,8.9,max" --out S3-grass-before
node scripts/index1-5/shot.cjs --at "8.9,12.3" --set "alpineLight.sunIntensity=5,alpineLight.skyZenith=#203a70" --out S3-light-try
node scripts/index1-5/shot.cjs --at "12.3" --early --set "relief.lift=2" --out S3-lift-2
node scripts/index1-5/shot.cjs --at "0,3.6" --phone --query "&logolook=original"
```
其他：`--cols 4`、`--js 檔案.js`（在頁面裡執行，之後 applyConfig）、`--reduced`（減少動態）、`--wait 毫秒`（到位後等多久再截，預設 2600）。

### 3. `sweep.cjs` — 一個參數試多個值，給客戶挑
同一位置，第一格是「目前值」，後面每個值一格；多個位置就每個位置一列。
```
node scripts/index1-5/sweep.cjs --set-key alpineLight.sunIntensity --values "4,7,9" --at "12.3" --out light-sun
node scripts/index1-5/sweep.cjs --set-key relief.lift --values "0.8,1.6,3" --at "12.3" --early --out lift
node scripts/index1-5/sweep.cjs --set-key worldOcean.glint --values "0.8,1.6,2.4" --points "h:1"
```
`--early` 每個值重新載入一次（「重整生效」的參數要用；比較慢）。`--no-base` 不拍目前值。檔名 `v-<位置>-<格號>-<值>.jpg`（格號 0＝目前值）。

### 4. `world-shot.cjs` — 地球、波浪轉場、海洋章節、頁尾
```
node scripts/index1-5/world-shot.cjs --points "g:0.9,d:0.5,h:0,h:1,h:3,end" --out S6-ocean
node scripts/index1-5/world-shot.cjs --points "d:0.3,d:0.6,h:0" --phone --set "worldOcean.glint=2"
```
點的寫法：`g:<0–1>` 地球「全球」段、`d:<0–1>` 波浪俯衝、`h:<n>` 海洋第 n 章（0 起算，小數＝兩章之間）、`u:<n>` 同 h 不加偏移、`f:<px>` 頁尾往上 px、`y:<px>` 原始 y、`end` 頁尾。預設 `g:0.5,d:0.5,h:0,h:1,h:2,h:3,end`。也支援 `--reduced`、`--early`、`--js`、`--wait`（預設 900）。

LOGO 收尾段（2026-10-24，`?logoseal=0` 時這幾種點會報錯）：`l:<0–1>` 整段（波浪開始 → 停留結束）、`lw:<0–1>` 只看波浪（0＝浪剛進來、1＝浪過完）、`ls:<0–1>` 只看旋轉（0＝0°、1＝360°）、`lh:<0–1>` 只看停留（文字出現）。湖景是延遲建立的，這幾種點會先跳到區塊前、等建好再跳過去；`run.json` 每點多一個 `logo`（qWave／qSpin／yaw／ready）。例：`node scripts/index1-5/world-shot.cjs --points "lw:0,lw:0.25,lw:0.5,lw:0.75,lw:1,ls:0.5,lh:0.5" --out logo-wave`。
區塊專用的驗收腳本在 `scripts/index1-5/probes/logo-seal-*.probe.cjs`（用法寫在各檔開頭）：`behaviour`（時鐘端點、往回捲、Tab、EXPLORE、保留／釋放、context lost）、`perf`（長任務與幀時間）、`shots`（取證截圖，波浪 q／旋轉 0–360°／停留；`LOGOSEAL_ONLY` 可只拍幾張）、`wheel`（真實滾輪連拍，往下與往回捲）。

### 5. `wheel.cjs` — 真實滾輪手感連拍
從某個位置開始用真的滑鼠滾輪滾，固定間隔連拍；每張標上實際時間和當時位置（p、卡牌狀態、世界段 y）。
```
node scripts/index1-5/wheel.cjs --from 3.6 --notches 12 --out logo-to-valley
node scripts/index1-5/wheel.cjs --from max --notches 8 --out into-cards
node scripts/index1-5/wheel.cjs --world --notches 20 --frames 12 --every 400 --out globe
node scripts/index1-5/wheel.cjs --from 12.3 --dir up --notches 10
```
`--interval`（每格間隔，預設 140 ms）、`--delta`（每格大小，預設 120）、`--frames`（張數，預設 16）、`--every`（拍照間隔，預設 300 ms）。`run.json` 記錄每格滾輪實際送出的時間。

### 6. `cards.cjs` — 卡牌轉場導覽檢查
終點 → 往下滾 14 格（卡牌要開）→ 往上滾 18 格（要關）→ 按 FOUR PATHS 的按鈕（要開）。每步一行狀態＋截圖，最後 PASS／FAIL。
```
node scripts/index1-5/cards.cjs
node scripts/index1-5/cards.cjs --w 1280 --h 720 --out cards-720p
```

### 7. `perf.cjs` — 移動中的長任務與掉幀
停在 `--from`，飛到 `--to`，記錄長任務（>50 ms 就失敗）和 >34 ms 的幀，印一行 JSON。
```
node scripts/index1-5/perf.cjs --from 8.9
node scripts/index1-5/perf.cjs --from 0 --to 5.56 --profile
```
`--profile` 另外列出最花時間的函式、長任務裡的呼叫鏈（會讓數字稍差）。`--limit 毫秒` 改門檻。無頭 Chrome 的數字只拿來做前後比較。

### 8. `config.cjs` — 讀出頁面實際生效的 CONFIG
```
node scripts/index1-5/config.cjs --get "alpineLight.sunIntensity,relief.lift"
node scripts/index1-5/config.cjs --get worldOcean
node scripts/index1-5/config.cjs
```
不給 `--get` 就把整份寫到 `.qa/index1-5/config-<時間>/config.json`（或 `--out 檔案.json`），並列出每個群組有幾個鍵。`--phone` 看手機版的值。

### 9. `tuner.cjs` — 參數面板裡有沒有這些群組
用 `?tune=1&letters=1` 載入，列出所有群組標題（含列數），逐一比對（部分文字即可）。
```
node scripts/index1-5/tuner.cjs --groups "山景打光,山形材質,卡牌轉場"
node scripts/index1-5/tuner.cjs --groups "海洋章節" --rows "陽光強度,雪線高度"
node scripts/index1-5/tuner.cjs
```
新增面板群組的任務，做完用這個證明它在。

### 10. `compose.cjs` — 把幾張圖排成對照表（前後對照）
```
node scripts/index1-5/compose.cjs .qa/index1-5/S3-grass/before-after.jpg 2 "之前|.qa/index1-5/S3-grass-before/p-8.9.jpg" "之後|.qa/index1-5/S3-grass-after/p-8.9.jpg" --title "峽谷 p 8.9 草地前後"
```
`"標籤|檔案"`，可混用 `.jpg`／`.png`／`.webp`，大小不同不會被拉伸。

### 11. `backup.cjs` — 動手前先備份
```
node scripts/index1-5/backup.cjs S3-grass-01 --note "草地第 7 輪之前"
```
複製整個 `prototypes/index1-5/` 和 `index1-5.html` 到 `_archive/backups/index1-5-S3-grass-01-yyyymmdd-hhmm/`，驗證檔案數與大小，印出路徑和還原指令。不刪除、不覆蓋任何東西。

### 12. `restore.cjs` — 還原備份（會重新建置）
```
node scripts/index1-5/restore.cjs index1-5-S3-grass-01-20261024-1530
node scripts/index1-5/restore.cjs index1-5-S3-grass-01-20261024-1530 --yes
```
沒有 `--yes` 只列出會覆蓋／新增哪些檔案，不動任何東西。加 `--yes`：先把現在的狀態自動備份成 `index1-5-prerestore-<時間>`，再把備份放回去，最後跑 `node prototypes/index1-5/build.cjs`。現在多出來、備份裡沒有的檔案不會被刪，只會列出來（注意 `presets/*.diff.json` 會被套用）。只接受 `backup.cjs` 做的備份。

## 典型流程（一張任務卡）

```
node scripts/index1-5/backup.cjs S3-xxx
node scripts/index1-5/shot.cjs --at "8.9,11.13,12.3" --out S3-xxx-before
（改 prototypes/index1-5/ 的來源或 helper）
node scripts/index1-5/check.cjs
node scripts/index1-5/shot.cjs --at "8.9,11.13,12.3" --out S3-xxx-after
node scripts/index1-5/compose.cjs .qa/index1-5/S3-xxx-ba.jpg 3 "前 8.9|.qa/index1-5/S3-xxx-before/p-8.9.jpg" "前 11.13|.qa/index1-5/S3-xxx-before/p-11.13.jpg" "前 12.3|.qa/index1-5/S3-xxx-before/p-12.3.jpg" "後 8.9|.qa/index1-5/S3-xxx-after/p-8.9.jpg" "後 11.13|.qa/index1-5/S3-xxx-after/p-11.13.jpg" "後 12.3|.qa/index1-5/S3-xxx-after/p-12.3.jpg"
（有加參數）node scripts/index1-5/tuner.cjs --groups "新群組名稱"
（動到卡牌／海洋）node scripts/index1-5/cards.cjs ； node scripts/index1-5/world-shot.cjs
```

## 已知限制

- `--set` 只改這次開的瀏覽器，不會改任何檔案；要變成預設值得改來源（helper）再建置。
- 不加 `--early` 時，「重整生效」的參數寫了也不會變；`--early` 是在送出 `main.js` 時插入，靠 `const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));` 這一行當錨點，建置把它改掉的話 `--early` 會直接報錯。
- 有些參數效果很細微（例如 p 12.3 的 `alpineLight.sunIntensity` 從 2 到 9，L\* 只差幾點）：看 Δ 值，不要只看圖。
- `wheel.cjs`、`cards.cjs`、`world-shot.cjs` 進世界段都用滑鼠滾輪；手機（`--phone`）也是送滾輪，不是觸控滑動。
- 數字（載入時間、幀時間、長任務）來自這台電腦的無頭 Chrome（RTX 4070），只能做前後比較，不等於真機。
- 旅程直接設定 `journey.target`，移動比真人捲動快；看捲動手感用 `wheel.cjs`。
- 截圖前會等畫面安定（文字面板有 CSS 淡入淡出；到達某一章時金色章節字樣會淡入再淡出，`shot.cjs` 預設 2600 ms 有時還拍得到它）；水、雲、光線是會動的，同一位置兩次截圖本來就不完全一樣（見上面 Δ 的雜訊）。
- 需要 Playwright 在 `C:/Users/lee/.cache/codex-runtimes/...`、Chrome 在 `C:/Program Files/Google/Chrome/`；換機器可用環境變數 `I15_PLAYWRIGHT`、`I15_CHROME`、`I15_BASE`（伺服器網址）覆寫。

---

## 任務卡協作工具（多位 Haiku 共用同一份來源與建置輸出）

計畫與卡片在 `docs/haiku-plan/`（`plan.md` 卡片清單、`lanes.md` 併行協定、`card-format.md` 卡片格式）。下面四個工具是這套流程用的；一般單人使用上面的 1–12 號工具即可。

### 13. `card.cjs` — 佔用檔案、上鎖建置、範圍檢查、只還原自己的檔案
```
node scripts/index1-5/card.cjs start C-45          # 讀卡片的「可改檔案」→ 檢查前置卡 → 原子佔用（被佔用 exit 5）→ 檔案備份＋雜湊基準
node scripts/index1-5/card.cjs build C-45 --then "node scripts/index1-5/check.cjs --no-build"
node scripts/index1-5/card.cjs exec C-45 --cmd "node docs/haiku-plan/evidence/C/tools/uiC.cjs"   # 沒有鎖的工具用這個包
node scripts/index1-5/card.cjs diff C-45           # 相對開工備份的差異（不需要 git）
node scripts/index1-5/card.cjs finish C-45         # 範圍檢查（越界／語法／改完沒重建）→ 釋放佔用 → 登記完成
node scripts/index1-5/card.cjs abort C-45          # 只把這張卡的檔案放回備份並重建（不用 restore.cjs）
node scripts/index1-5/card.cjs status              # 誰佔用哪些檔案、瀏覽器鎖、最近建置、已完成的卡
```
- `build` 先對自己佔用的 .cjs／.js 做語法檢查，再拿**同一把瀏覽器鎖**建置，`--then` 的命令在鎖還握著時執行（建置完驗證前插不進別人的建置）。建置失敗時：出錯檔案是自己的 → exit 1；是別人佔用的 → 自動等待重試（`--retry 5 --wait 60`），仍壞 exit 4（不要還原、不要修別人的檔案，回報）。
- 佔用、備份、紀錄：佔用在 `%TEMP%\montis-index1-5-claims\`（超過 8 小時視為過期），備份在 `_archive/backups/card-<卡號>-<時間>/`（只有該卡的檔案＋`MANIFEST.json`），建置紀錄 `.qa/index1-5/card-log.jsonl`，完成登記 `.qa/index1-5/card-done.jsonl`。
- `release <卡號> --force`、`done <卡號>` 是總指揮用的。測試用環境變數 `I15_CARD_ROOT` 可把整套搬到暫存樹。

### 14. `probe.cjs` — 在準備好的頁面裡跑卡片自帶的檢查腳本
```
node scripts/index1-5/probe.cjs --script .qa/index1-5/C-45/tab.probe.cjs --world --out C-45-after
node scripts/index1-5/probe.cjs --script my.probe.cjs --at 5.56 --phone
```
腳本是 CommonJS：`module.exports = async ({ page, L, vp, world, fly, jumpWorld, log }) => ({ ok: true, … })`。`--world` 先走進世界段並把 `world.state` 傳進來（`L.worldY(world,'h:1')` 換成 y）。回傳 `ok:false`、丟錯或頁面有錯 → exit 1。鍵盤、DOM、computed style 這類客觀驗收用它。

### 15. `validate-cards.cjs` — 卡片格式與錨點檢查（不開瀏覽器）
```
node scripts/index1-5/validate-cards.cjs                       # 全部卡
node scripts/index1-5/validate-cards.cjs --card C-45 --fresh   # 單張＋卡寫好之後哪些檔案又被改過
node scripts/index1-5/validate-cards.cjs --conflicts --coverage
```
檢查：front-matter、章節順序、可改檔案存在、每個錨點的檔案存在且錨點**剛好出現 1 次**（讀 helper 來源、正規化 CRLF）、參數表（`default: same` 時 default＝現況值）、指令的腳本與選項、驗收行有證據、depends 存在、與 `plan.md` 一致。`--conflicts`：兩張要改同一檔案的卡必須有 depends 先後；`--coverage`：卡片資料夾對 plan.md（缺卡／計畫外的卡）。結束碼 0 全過｜1 有錯｜2 指令打錯。

### 16. `make-prompts.cjs` — 組出每張卡的提示詞
```
node scripts/index1-5/make-prompts.cjs                  # 全部 → docs/haiku-plan/prompts/<卡號>.txt ＋ ALL-PROMPTS.md
node scripts/index1-5/make-prompts.cjs --card C-45
node scripts/index1-5/make-prompts.cjs --master docs/haiku-plan/prompts/00-MASTER-PROMPT-v2.md
```
`<卡號>.txt` ＝ 主提示詞本文（去掉開頭的標題與引言）＋「任務：卡號 標題」＋卡片全文；`ALL-PROMPTS.md` ＝ 依 wave／lane 的索引＋每張提示詞各一個區塊，客戶可以一次複製一張。沒通過 `validate-cards` 的卡會被略過（`--force` 例外）。
