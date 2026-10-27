# 恒灝創新 FINNOVATION — 3Dmountain-3

WebGL 品牌網站（three.js r170）。入口 `index.html`；公開網址（canonical）
`https://qq7636946.github.io/3Dmountain/3Dmountain-3/index3.html`（發佈時 `index.html` 同步成 `index3.html`，見 `scripts/seo/README.md`）。

## 資料夾結構

| 路徑 | 內容 |
|---|---|
| `index.html` | **只放 HTML**：`<head>`（SEO、JSON-LD、預載）、頁面結構（canvas、介面、章節文案、`<dialog>` 選單）、importmap、極小的備援腳本 |
| `css/` | `base.css` 版面／載入畫面／第二區塊／調參面板 · `journey-story.css` 舊版故事樹（已停用，保留）· `interface.css` 介面（`fi-*`）· `glass-refinement.css` 毛玻璃 · `readable.css` 無 JS／WebGL 失敗時的純文字版面 |
| `js/` | `main.js` 場景與互動主程式（原本內嵌在 index.html 的模組）· `water-*.js`、`finnovation-*.js` 各章節與效果模組（`water-logo-drops.js` 水滴、`water-logo-letters.js` 字母組、`water-logo-letters-panel.js` 水滴字母參數面板——需要時才下載）· `water-logo-geometry-worker.bundle.js` Worker 打包檔 |
| `images/` | 分享圖與品牌標誌 · `logo.svg`、`text_logo2/3.svg`（3D logo 的向量來源）· `slides/`（照片水滴／卡牌用的圖，預設的「字母誕生」不會下載）· `world/`（index1-1 尾聲延伸的地球、雲、海洋貼圖，卡牌出現後才下載） |
| `media/` | `logo.mp4`（第二區塊背景影片）· `ocean-loop-720.mp4`／`ocean-loop-480.mp4`（由 logo.mp4 重新編碼的無縫循環，index1-1 尾聲最後一段的背景） |
| `models/` | `drop_of_water/`（只有 `?orb=mesh` 才會載入的舊水珠模型） |
| `docs/` | 報告與遷移紀錄（`restructure-manifest.json` 記錄每一次搬動） |
| `scripts/` | 檢查與建置工具（下表） |
| `_archive/` | 目前頁面沒有用到的舊頁面、舊模組、3D 素材包、示範專案、備份。**沒有刪除**，隨時可搬回 |
| `dist/` `build/` `worker/` `.openai/` | Codex Sites 託管用檔案，維持原位 |
| `.qa/` | 歷次驗證截圖（約 1.3 GB，建議移出雲端硬碟） |

`index2.html` 是較舊的頁面快照，維持在根目錄並已更新路徑（Codex Sites 的 `worker/index.js` 會把網站根路徑導向它）。

## 日常流程

```bash
npx serve .                              # 本機預覽（亦可用 .claude/launch.json 的 montis 設定）
# 改完 css/ 或 js/main.js 之後：
node scripts/stamp-assets.mjs            # 更新 index.html 裡 css/*.css、js/main.js 的 ?v=（內容雜湊），避免瀏覽器拿到舊檔
node scripts/seo/check-seo.mjs           # 檢查 metadata、JSON-LD、靜態內容是否與模板同步
```

- 修改章節文案：改 `js/finnovation-interface.js` 的 `renderJourneyInterface()`，再跑 `node scripts/seo/build-static-interface.mjs` 把靜態 HTML 同步進 `index.html`。
- 重新打包幾何 Worker：`node scripts/build-logo-worker.cjs`（輸出 `js/water-logo-geometry-worker.bundle.js`）。
- 發佈到 GitHub Pages 時，除了 `index.html`（另存為 `index3.html`）和 `sitemap.xml`，要一起上傳 `css/ js/ images/ media/ models/`。

## LOGO 章節：字母誕生

LOGO 章節（IDEAS TAKE SHAPE）是一群水滴繞著字標連續往上轉（跟著捲動、帶一點慣性，整章一圈，和 `index2.html` 的螺旋同速）：其中 11 顆裝著字標的字母，轉到字標正上方就破開、字母飛進字位，其餘的清水水滴一路轉到章節最後再升空離場——整章就是 LOGO 被組出來的過程。破開與飛入是「觸發後照秒數播完」，不被捲動快慢綁住。做法、參數與驗證結果見 `docs/logo-letters.md`。

- **尾聲卡牌**：最後一章再往下捲一格，場景淡出、接上舊版 index3 的 WebGL 卡牌（`js/portfolio-epilogue.js`、`js/portfolio-slider.js`，快到結尾才下載）。圖片、底色、開關在 `js/main.js` 的 `CONFIG.portfolio`；說明見 `docs/portfolio-epilogue.md`。
- **水滴字母參數面板**：在本機網址（`127.0.0.1`／`localhost`）打開 `index.html` 會自動出現在右上角；按 `L` 隱藏／顯示，正式網址要看就按 `L` 或加 `?letters=1`。五組快速切換（節奏／液體感／水珠／冰字／水滴數量）加 107 個滑桿（含 index2 面板那幾組水滴參數：液體物理、飛濺與散珠、光線、進場），調過的值記在瀏覽器裡；滿意後按「複製參數」把數值交給工程師寫成預設值（`js/water-logo-drops.js` 的 `LOGO_DROP_DEFAULTS`、`js/water-logo-letters.js` 的 `LOGO_LETTER_DEFAULTS`）。同一批設定也在按 `T` 的大面板裡，兩邊同步。
- 想回到原本的照片水滴：大面板（`T`）最上方「水滴內容」選「照片」；要永久改就把 `js/main.js` 裡 `logoDrops: { ...LOGO_DROP_DEFAULTS, letters: 1 }` 的 `1` 改成 `0`。
- 只有 LOGO 3（全字標）有字母；`?logo=1`、`?logo=2` 自動用照片水滴。
- 改了 `js/water-logo-drops.js`、`js/water-logo-letters.js` 或 `js/water-logo-letters-panel.js`，記得換掉 `js/main.js` 裡對應 import 的 `?v=`（前兩個在檔案最上面，面板是 `import('./water-logo-letters-panel.js?v=…')`），再跑 `node scripts/stamp-assets.mjs`。
- `js/water-logo-drops.js` 也被 `index2.html` 使用：新行為一律要靠 `main.js` 傳進去的選項才啟動（`letters`），預設值不能變。
- 驗證工具在 `scripts/logo-letters/`（含滾輪手感 `feel.cjs`、面板測試 `panel-test.cjs`）；舊版都在 `_archive/backups/`：`letters-20261010/` 字母誕生之前、`letters-round1-20261010/` 第一輪（旋轉階梯）、`letters-round2-20261010/` 第二輪（動作綁捲動）。

## index1-1：尾聲延伸（卡牌之後接地球、理念、頁尾）

`index1-1.html`（`<html data-epilogue="world">`）的結尾跟 `index.html` 不同，參考 mont-fort.com 的結構：

- **山谷 → 卡牌**是一個跟著捲動走的連續動作：鏡頭一路滑進山谷、空氣均勻變濃成卡牌底色，卡牌從霧的深處迎面飛來，最後一格滾輪的餘量直接接著捲卡牌；往回捲照原路倒回。
- **卡牌捲完**繼續往下：穿過雲層 → 太空中的地球（台北 HQ 與亞太市場標籤、大標）→ 深色 → **RESPONSIBILITY** 四個編號區塊（背景是 `media/logo.mp4` 的水面漣漪循環影片）→ 白色頁尾。往上捲全部倒回，回到卡牌。
- 檔案：`js/finnovation-world.js`、`css/world.css`、`images/world/`；`js/portfolio-epilogue.js`／`js/portfolio-slider.js` 的 `bridge`／`mist`／`rise` 模式只有這頁開。文字直接改 `index1-1.html` 的 `WORLD_EPILOGUE_START…END`。
- **待客戶提供**：頁尾地址、電話、Email、隱私權與使用條款連結（頁面上橘字）；地球上的城市清單；文案請確認。
- **畫面調整面板**（本機網址或 `?grade=1` 自動出現，按 `C` 開關）：「色調」頁（`CONFIG.grade`，index1-1 預設偏藍一點）、「霧」頁（`CONFIG.mist`：過場的鏡頭推進、霧濃度與時機、卡牌飛入、雲層與地球雲量；霧色就是卡牌底色）、「影片」頁（`CONFIG.video`：亮度、原色比例、速度）。「複製參數」交給工程師寫成預設。
- 改完尾聲延伸的檔案：`node scripts/world/stamp-world.mjs`，再 `node scripts/stamp-assets.mjs index1-1.html` 與 `node scripts/stamp-assets.mjs index.html`。
- 詳細說明、素材授權（地球貼圖 CC BY 4.0，頁尾已標示）、驗證結果：`docs/world-epilogue.md`。

## 改 index.html 時的注意事項

- `<script type="importmap">` **必須留在 `<head>` 最前面，位於所有 `modulepreload` 與 module `<script>` 之前**，否則瀏覽器會忽略它、`three` 解析不到，頁面會卡在載入畫面（2026-10-10 發生過）。
- 載入畫面卡住時（`is-ready` 沒出現），先看 console 有沒有 `Failed to resolve module specifier`；模組載入失敗現在會自動退到可讀的文字頁。
- 驗證時除了 `?tune=0`，也要用**不帶參數**的網址測（本機會自動開「水滴字母」參數面板），並跑 `scripts/restructure/verify-race.cjs`（刻意拖慢檔案）。

## 網址參數與開發工具

| 參數 | 作用 |
|---|---|
| `?tune=1` / `?tune=0` | 開／不開即時調參大面板（預設不開，需要時才建立；按 `T` 切換）。`?tune=0` 也會讓水滴字母參數面板不自動出現 |
| `?letters=1` / `?letters=0` | 開／不開「水滴字母」參數面板（本機網址預設開，正式網址預設關；按 `L` 切換） |
| `?logo=2` / `?logo=3` | 指定 3D LOGO 版本 |
| `?orb=mesh` | 載入舊的 GLTF 水珠模型（預設不載入，省 3.3 MB） |
| `?grade=1` / `?grade=0` | （index1-1）開／不開「畫面調整」面板（色調／霧／影片；本機網址預設開；按 `C` 切換） |

量測與驗證（`scripts/perf-ab/README.md`、`scripts/restructure/`）：`perf-harness.cjs` 逐章節量 GPU／draw call／像素差，`verify-parity.cjs` 比對兩個版本的網路請求、DOM、全部元素的計算樣式與截圖。LOGO 章節另有 `scripts/logo-letters/`（連續畫面、功能檢查、逐像素比對、水滴互不穿插、滾輪手感、參數面板、GPU 時間、首次捲動卡頓）。

## 還原本次整理

```bash
node scripts/restructure/undo.cjs        # 先看計畫（乾跑）
node scripts/restructure/undo.cjs --yes  # 實際還原：原始 index.html、模組與所有搬動過的檔案回到原位
```
