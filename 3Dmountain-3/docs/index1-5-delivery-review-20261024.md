# index1-5 交稿前處理與視覺會診（2026-10-24）

## A. 已處理（交稿衛生）
- 授權：頁尾署名加上地形模型「Snowy Mountain V2 - Terrain」by artfromheath（CC BY 4.0，附連結），與既有的 Earth 署名並列（`index1-5.html` 的 `.fiw-legalline`）。
- 介面減法：右下資訊列（VIEW HEIGHT…）預設移除（`?stats=1` 可叫回）；頂峰標籤移除（`?summit=1`）；右上「SCENE TIME」場景時間小面板預設關閉（`?sceneclock=1`），它是日照系統的開發讀數。
- 開發面板：「即時調參」（字母面板）與「最後一段 · 3D LOGO」面板只在本機網址（localhost／127.0.0.1）出現，正式網址不會出現（不需改）。
- 文案：FOUR PATHS 四個標籤加中文（AI 量化交易／上市櫃投資／未上市及 Pre-IPO／衍生性商品）；匯流標籤中文改「恒灝創新」。
- 檢查：建置＋語法 0 錯、桌機／手機頁面錯誤 0、卡牌開關 PASS。
- 進行中：最後一塊進場前約 0.85 s 的一次性 shader 編譯卡頓（整合工程師處理中）。

## B. 交稿前仍需客戶提供或決定
1. 頁尾聯絡資料：地址、電話、Email（目前顯示「待提供」）、Privacy／Terms 連結。
2. 正式網址：`canonical`／`og:url` 目前指向 `index3.html`，請給正式上線網址（或確認 index1-5 改名為 index.html）。
3. 作品集圖片仍直接熱連結 Pexels（約 1.4 MB），上線前建議下載到專案（需你同意下載）。
4. 最後一塊與策略章的文案核可（含「THE SPIRIT」按鈕）。
5. 實機測試：iOS Safari、Android Chrome、中階筆電。

## C. 視覺會診（提案，回覆「套用」後才改；每項都有開關可退回）
見對話中的完整報告（3 大破功點、參數級修正、可替換片段）。

## D. 已套用的視覺處理（2026-10-24 晚，客戶：「主要在視覺上先處理」）
全部可用網址加 `?visual=classic` 一次退回原樣。檔案：`prototypes/index1-5/alpine/alpine-ui.css`（VISUAL BOARD 區塊）、`alpine-ui.js`（`buildAtmos()`）、`world-ocean.css`（最後一段）。備份：`_archive/backups/index1-5-visual-board-20261024/`。
- 金色限量：斜體章名 → `rgba(246,244,238,.72)`；羅馬數字 → `clamp(120px,12vw,220px)`、描邊 `1px rgba(246,244,238,.14)`；左側章節數字改白 .7，只有目前章節是金色。
- 排版：中文行字距 .3em → .18em、透明度 .86；小標 10px／.28em；章節大標 line-height .92、字距 -.01em；左側章節列非目前章節透明度 .5。
- 章節按鈕：除了開場那顆金色主按鈕，其餘改成 11px 等寬字＋1px 底線的文字連結（hover 時底線變金）。
- 空氣感：全站一層暗角（`rgba(5,14,26,.26)`，在介面下方）＋一層底片噪點（opacity .06、overlay、每秒 6 格；減少動態時靜止）。
- 海上照片：saturate .72／contrast 1.06／brightness .94、1px 細框 `rgba(246,244,238,.18)`、去陰影、下緣 18% 漸隱進海面。
- 未套用：峽谷段文字下移、文字進場曲線、鏡頭 FOV 呼吸、LOGO 結尾回彈（動態類，另案）；LOGO 玻璃數值（有人在本日稍晚改過 MARK_DEFAULTS，尊重最新值）；頁尾（客戶說先不用）。

## E. 文案與排版（客戶文件 2026-10-24：1.主視覺 Hero、2-1 投資策略）
- 主視覺：大標＝Slogan「以知為本　恒灝創新　資本賦能　善水長流」（四句等距；桌機一行、手機直排四行）；內文「科技賦能，金融加值，創造長期產業價值。」。
- 2-1 投資策略（FOUR PATHS 那一塊）：大標題「以科技洞察市場，以紀律創造長期價值」、中標題「四大投資策略」（取代原本的 Strategies 斜體）、內文「恒灝聚焦量化研究、公開市場、成長型企業與金融工具，透過資料分析、產業理解與風險管理，建立穩健且多元的投資布局。」。
- 機制：沿用 `prototypes/index1-5/page-copy.cjs`（別的對話建立，來源是企劃簡報）；新增 `strategies` 一筆，`mark` 欄位會寫成 `data-mark`，`alpine-ui.js` 的中標題改讀它。第二塊之後其他章節仍是簡報原文，等客戶給新文件再套同一格式（大標題／中標題／內文）。
- 草地：`alpineTerrain.grass` 1 → .88、`tuftAmount` 1 → .9（客戶：「草地再少一點點」）。
- 備份：`_archive/backups/index1-5-copy-20261024/`。

## F. 還原與字體統一（2026-10-24 晚）
- 還原：大英文標題全部回到原樣（A DROP OF KNOWLEDGE／FOUR PATHS ONE VISION…）；新文案只放在「小字的中文標」：主視覺＝口號一行＋內文一行；2-1 投資策略＝大標題句、中標題「四大投資策略」、內文三層小字。機制：`page-copy.cjs` 的 `zhLines`（role head／mid／body）→ `<span class="fi-zh-head|mid|body">`，樣式在 `alpine-ui.css`。
- 字體統一：英文大標與斜體章名全站改為同一款網頁字 Newsreader（原本依作業系統為 Didot／Sitka Banner／Bodoni MT／Georgia）；標註與數字原本三套等寬字，全部改用 Jost（tabular 數字）；無襯線字維持 Jost＋Noto Sans TC。網址加 `?fonts=classic` 退回平台字體。字體由 Google Fonts 與 Jost 同一條連結載入（`index1-5.html` 的 `<link>`，備份在 `_archive/backups/index1-5-copy-20261024/index1-5.before-fonts.html`）。對照圖 `.qa/index1-5/fonts-compare.jpg`。

## G. 滑順手感一輪：已還原（2026-10-24 22:50，客戶：「先還原，我覺得效果沒很好」）
- 兩位工程師（hubtown 手感套用、卡頓修正）已停止；`flow-feel-build.cjs` 已從 `build.cjs` 的 helper 清單移除並重建，頁面回到這一輪之前的捲動行為。卡頓修正的 `flow-fix-build.cjs` 從未登錄。兩個檔案與 `docs/smooth-flow/` 保留（未刪除），要再試時把檔名加回 `build.cjs` 清單即可。
- 沒有還原：字體統一、中文小字文案、視覺處理、草地（客戶沒有指這幾項）。

## H. 特效還原（2026-10-24 23:00，客戶：「特效還原就好，字體那些不用」）
- 還原（預設關閉；網址加 `?atmos=1` 可叫回）：全站底片顆粒、暗角、海上照片的調色／漸隱。
- 保留：字體統一（Newsreader＋Jost）、中文小字文案、金色減量與排版、章節文字連結樣式、草地、LOGO、峽谷鏡頭／岩壁／卡片修補等先前項目。
- 已還原：滑順手感一輪（見 G）。

## I. 全站字體改 Inter（2026-10-24 23:05，客戶：「全部字體使用 inter 統一」）
- 英文／數字／標註全部 Inter（含大標題、斜體章名、世界段、LOGO 區塊、頁尾）；中文以 Noto Sans TC 墊在後面（Inter 沒有中文字）。字體連結改為 Inter（可變字重 200–700＋斜體）＋Noto Sans TC（200–500），移除 Jost／Newsreader 的載入。
- 實作：`alpine-ui.css` 的「ONE TYPE SYSTEM」區塊把四個字體變數都設成 Inter，並用 `!important` 蓋過共用樣式表裡寫死的 Jost／襯線（開發用面板除外）。`?fonts=classic` 只會取消這條強制規則，因為 Jost／Newsreader 已不再載入，舊字體不會回來；要回舊字需把備份 `_archive/backups/index1-5-copy-20261024/index1-5.before-fonts.html` 的字體連結還原。

## J. 字體與第二塊（2026-10-24 23:30）
- 字體：Inter 之後客戶改要 Montserrat（Latin）＋Noto Sans TC（中文）；字距回到正常（大標 ≈ 0、小標 .1–.16em、中文小字 .06–.08em）；全站不斜體、全站去除文字陰影（`alpine-ui.css` ONE TYPE SYSTEM 區塊，`?fonts=classic` 取消這兩條強制規則）。順手修掉樣式檔每次建置多複製一份舊區塊的問題（區塊移進 ALPINE-UI 標記內，index1-5.css 由 95KB 縮到 42KB）。
- 主視覺口號加點：以知為本・恒灝創新・資本賦能・善水長流。
- 第二塊（INSIGHT）改用 2-1 投資策略的文案排版：英文大標「INSIGHT BY TECHNOLOGY, / VALUE BY DISCIPLINE」（對應「以科技洞察市場，以紀律創造長期價值」）、小標 OUR INVESTMENT APPROACH、中文三層小字（大標題句／四大投資策略／內文）。FOUR PATHS 那一塊的文案回到原本（`page-copy.cjs` 的 strategies 一筆已移除）。

## K. 全站日照預設 0（2026-10-24 23:40）
- 客戶：「全站日照初始設定0」。`prototypes/index1-5/scene-daylight.js` 的 `DAYLIGHT_DEFAULTS.enabled` 1 → 0；實測 `sceneDaylight.enabled = 0`，開場、峽谷、空拍、海洋、LOGO 區塊都回到各自手調的光（SCENE TIME 小面板也自然隱藏）。要打開：面板「全站太陽／場景時間」的「全站日照」設 1（或預設按鈕「日出／正午／夕照／藍調／跟隨捲動」）。備份：`_archive/backups/index1-5-copy-20261024/scene-daylight.before-off.js`。
- 同日稍早：第二塊英文大標改一排「INSIGHT WITH DISCIPLINE」、內文小字刪除。
