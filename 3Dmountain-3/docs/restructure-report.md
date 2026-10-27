# index.html 架構分析與資料夾整理報告

2026-10-10 ｜ 範圍：`index.html`（正式頁面）、`index2.html`、整個 `3Dmountain-3/` 資料夾

## 0. 結論

| 問題 | 結論 |
|---|---|
| index.html 能不能拆成 HTML 架構、而前台設計與特效**一模一樣**？ | **可以，而且已完成並驗證**。`index.html` 從 11,036 行／533 KB 縮成 **389 行／23.5 KB（只剩 HTML）**；CSS 與 JS 各自成檔。抽出的內容與原本**逐字相同**，唯一的改動是 10 處資產路徑。 |
| 資料夾能不能整理成 js／css／images？ | **已完成**。根目錄從 77 個項目縮成 20 個（5 個檔案＋15 個資料夾）。**沒有刪除任何檔案**，不用的都搬到 `_archive/`，可用一個指令全部還原。 |
| 前台有沒有變？ | 沒有。網路請求、console、DOM、全部元素的計算樣式、截圖、3D 畫面、備援模式，都和原版逐項比對過（§3）。 |

## 1. 原本的 index.html 是什麼

不是「沒有 HTML 架構」——HTML 層早就存在（`<header>`、`<nav>`、`<main>` 內 10 篇 `<article>`、`<footer>`、`<dialog>` 選單、JSON-LD、
Open Graph、無 JS 時的純文字備援），而且文案是靜態的、搜尋引擎看得到。問題是**比例**：

| 區段 | 行數 | 大小 | 佔比 |
|---|---|---|---|
| `<head>`（meta／SEO／預載） | 101 | 5 KB | 0.9 % |
| 內嵌 CSS（4 個 `<style>`） | 2,501 | 57 KB | 22.7 % |
| `<body>` 的 HTML | 247 | 15 KB | 2.2 % |
| 備援小腳本＋importmap | 27 | 1 KB | 0.2 % |
| **內嵌模組 JS** | **8,155** | **408 KB** | **73.9 %** |

所以打開檔案只看到 JS。真正由 JS 生成的 DOM 只有：**調參面板**（約 50 個 `createElement`，開發用，正式網址預設不顯示）、
已停用的舊版「故事面板」（`mountJourneyStory({ enabled:false })`，死碼）、以及幾個離屏畫布。3D 場景本質就是 JS，不可能變成靜態 HTML。

## 2. 做了什麼

### 2.1 HTML／CSS／JS 分離（零改寫）
| 原本 | 現在 |
|---|---|
| 內嵌 `<style>` ×4 | `css/base.css`（1,040 行）· `css/journey-story.css`（207）· `css/interface.css`（949）· `css/glass-refinement.css`（301），依原順序以 `<link>` 載入，層疊順序不變 |
| `finnovation-readable.css` | `css/readable.css`（無 JS／WebGL 失敗時的文字版面，由 `<noscript>` 與 `showFinnovationText()` 載入） |
| 內嵌 `<script type="module" id="journeyModule">` | `js/main.js`（8,151 行）；HTML 以 `src` 載入並 `modulepreload`，`onerror="showFinnovationText()"` 備援保留 |
| 根目錄 15 支正在使用的模組 | `js/`（同一層，所以彼此的 `./x.js?v=` 匯入與 `new URL(..., import.meta.url)` 的 Worker 都不用改） |

被改的 10 處路徑：`logo.svg`（icon 與 3D logo）、`text_logo2/3.svg`、`logo.mp4`、`drop_of_water`、`finnovation-readable.css`（2 處）、
`slide-assets/`（2 個模組）。其餘位元組完全不動。

### 2.2 資料夾整理
```
index.html  index2.html  sitemap.xml  README.md
css/   js/   images/(含 slides/)   media/   models/   docs/
_archive/  backups(1010_bk, backups) · demos · legacy-js(21 支) · models(10 個素材包, 124 MB) · misc · pre-restructure(被改過的原檔)
scripts/  dist/ build/ worker/ .openai/(Codex Sites，原位不動)  .qa/(1.3 GB 驗證截圖，原位不動)
```
`index2.html` 保留在根目錄並更新路徑（Codex Sites 的 `worker/index.js` 會把網站根路徑導向它）。

### 2.3 一併更新的工具
- `scripts/seo/check-seo.mjs`：路徑更新，並改成**不受排版影響**（它在搬動前就已經壞了——`index.html` 被排版成多行後，`<meta>`、`<noscript>` 的單行比對全部失敗）。
- `scripts/seo/build-static-interface.mjs`、`scripts/build-logo-worker.cjs`：路徑更新（預設目標改為 `index.html`）。
- 新增 `scripts/stamp-assets.mjs`：CSS／JS 獨立成檔後必須有的快取版本戳記（`?v=<內容雜湊>`）；日後改完 `css/` 或 `js/main.js` 執行一次即可。
- 新增 `scripts/restructure/`：遷移腳本、`undo.cjs`（還原）、`verify-parity.cjs`／`verify-fallback.cjs`（驗證）。

## 3. 驗證（原版 vs 新結構，真實 GPU Chrome）

| 項目 | 結果 |
|---|---|
| JS 語法 | 16 個檔案全部通過 |
| 你的 SEO 檢查（`check-seo.mjs`） | 新舊版面都 passed |
| `index.html` 本體 diff | 排除移出的區塊後，只差 4 行路徑＋1 行 `modulepreload` |
| 網路請求 | 原版每一個請求（含捲過全部章節、開啟第二區塊影片、`?logo=2/3`、`?orb=mesh` 才會觸發的）都在新路徑出現；新增的只有 4 個 CSS 與 `js/main.js`；零 404 |
| console | 警告／錯誤與原版完全相同（0 個） |
| DOM | 326 個元素的標籤、屬性、文字相同（僅有兩處刻意修改） |
| **計算樣式** | **全部 326 個元素、所有標準屬性：0 差異**（桌機與手機） |
| DOM 層截圖 | **逐像素相同**（靜止與選單展開，桌機與手機） |
| 3D 畫面 | logo／transition／zoom／canyon 與原版**逐位元相同**；hero／rivers／finale 差異落在原版自己兩次之間的雜訊內；draw call、三角形、GPU 時間相同 |
| 備援模式 | JS 關閉、模組載入失敗兩種情境：文字模式一致啟動，整頁截圖**逐像素相同** |
| 套用到真實資料夾後 | 與驗證過的預演版**逐位元組相同**；SEO 檢查 passed；連續 4 次載入 2–3 秒進入 `is-ready`、零錯誤 |

驗證抓到並修掉的兩個問題：`index2.html` 的 logo SVG 寫法（`url:'logo.svg'`）與主頁不同、路徑漏改（3 個 404）；
以及我自己的比對一開始把每幀變動的 CSS 變數算進去造成誤報。最終比對曾有一次載入失敗，當時我誤判為外部 CDN 連線瞬斷——**那其實是下面 §3.1 的真正 bug 偶發出現**。

### 3.1 事後發現的問題：載入畫面永遠停在 FORMING ATMOSPHERE（已修正）
- **症狀**：在 Live Server（`127.0.0.1:5502/3Dmountain-3/index.html`）頁面卡在載入畫面，`is-ready` 永遠不來，也不會退到文字備援。
- **根因**：我為 `js/main.js` 加的 `<link rel="modulepreload">` 位在 `<head>`，而 import map 還留在 `<body>` 最後面。瀏覽器一預載主模組就去解析 `'three'`，
  此時 import map 尚未註冊，之後註冊的會被忽略 → `TypeError: Failed to resolve module specifier "three"`。這個錯誤**不會**觸發 `<script onerror>`，所以備援沒啟動。
  原本主程式內嵌在 HTML 裡，順序天生正確；是抽成外部檔之後我引入的競態（CSS 載入越慢、越容易輸）。
- **為什麼我的測試沒抓到**：本機極快、且比對時一律帶 `?tune=0`，競態剛好贏；唯一一次輸掉（見上）被我誤判為網路瞬斷。
- **修正**：(1) import map 移到 `<head>` 最前面，並加註解；(2) 在小備援腳本加一個只針對「模組載入失敗類錯誤」的 `error` 監聽（尚未 `is-ready` 時才動作），
  讓同類問題退到可讀的文字頁，而不是永遠的載入畫面；(3) 遷移腳本同步修正，重跑會產生相同的 HTML。
- **新增驗證**：`scripts/restructure/verify-race.cjs`（刻意拖慢 CSS／JS／全部）。修正前 CSS 慢 1.5 秒＝100% 重現卡住；修正後 CSS 慢、JS 慢、全部慢、無延遲，
  每一輪都正常開啟；用舊版面加監聽也確認會自動退到文字頁；你的實際網址不帶參數連載 4 次、兩種備援模式都通過。

## 4. 你需要知道的

1. **發佈到 GitHub Pages**：除了 `index.html`（另存為 `index3.html`）與 `sitemap.xml`，現在要一起上傳 `css/ js/ images/ media/ models/`。
2. **改完 CSS／JS 要跑 `node scripts/stamp-assets.mjs`**，否則使用者的瀏覽器可能最多 10 分鐘內拿到舊檔（GitHub Pages 的快取）。
3. **本機的 `.git`（Codex Sites 儲存庫）**：我沒有執行任何 git 指令。被搬動的少數受追蹤檔案（`drop_of_water/`、`river_water_runtime/`、`snowy_mountain_v2_-_terrain/`、`logo.svg` 等）會顯示成刪除＋新增，commit 前請留意。
4. **Codex Sites**：`dist/ build/ worker/ .openai/` 完全沒動；若它的發佈流程只複製固定檔案，新資料夾需要被納入——這點我無法從這裡驗證。
5. `build-static-interface.mjs` 仍會把整個檔案改寫成 LF（既有行為），執行後行尾會變。

## 5. 刻意沒做（可選的下一步）
- 把**調參面板**（數百行 JS，目前仍在 `js/main.js` 裡）拆成只有 `?tune=1`／本機才載入的模組：訪客少下載、少解析。
- 刪除已停用的舊故事面板（CSS 207 行＋相關 JS）。
- 模組去掉 `-463` 後綴、用 esbuild 打包成單一檔案（減少請求層級；Worker 已經是 esbuild 產物）。
- `.qa/`（1.3 GB）移出雲端硬碟。
- 先前討論的 GPU／啟動優化（Bloom 半解析度、canyon 關 Bloom／凍結陰影、先出 hero 再建 canyon）尚未實作。

## 6. 還原
```bash
node scripts/restructure/undo.cjs        # 乾跑，列出計畫
node scripts/restructure/undo.cjs --yes  # 實際還原：原始 index.html、模組與所有搬動過的檔案回到原位
```
