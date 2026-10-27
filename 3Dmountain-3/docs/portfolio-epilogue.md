# 尾聲卡牌：山景與 WebGL 卡牌連續交接

2026-10-11 ｜ 範圍：`index.html`（`index2.html` 與 `_archive/` 裡的舊頁面都沒有動）
畫面：[portfolio/epilogue.jpg](portfolio/epilogue.jpg)（整段流程）｜[portfolio/settled.jpg](portfolio/settled.jpg)（靜止時）｜[portfolio/phone.jpg](portfolio/phone.jpg)（手機）

## 行為

1. 捲到最後一章（DERIVATIVE STRATEGIES）停住後，**再往下捲一格**：山景融入淺色底，卡牌以短距離位移、輕微縮放浮現，接上卡牌標題。整段共用一個可反向的時間進度，不再等待整排卡牌跑完三秒開場。
2. 之後滾輪／上下滑動是在**捲卡牌**（一格滾輪約一張卡），也可以直接**左右拖曳**或用觸控板橫向捲。
3. 捲回卡牌開頭再**往上捲一格**：卡牌淡出，回到最後一章。
4. 點左側章節、選單、BACK TO START、按 `Home` 或 `Esc`，卡牌都會自動收起。
5. 卡牌完全蓋住畫面之後，底下的 3D 場景暫停繪製（省 GPU）。

卡牌就是舊版 index3 的那一組（OGL、殘影、撕紙邊緣、捲動時的拉伸），程式搬成新模組；舊檔 `_archive/legacy-js/slider.js` 沒有改。

## 檔案

| 檔案 | 內容 |
|---|---|
| `js/portfolio-slider.js`（新） | 卡牌本體（WebGL）。和舊版的差別：圖片由外面傳入；撕邊用的扭曲貼圖改成程式自己畫（舊版連到 tismes.com 的那張圖已經 404）；OGL 改從頁面本來就在用的 jsDelivr 載入 |
| `js/portfolio-epilogue.js`（新） | 和頁面的銜接：淡入淡出、標題、開關時機、拖曳、鍵盤 |
| `js/main.js` | `CONFIG.portfolio` 設定、快到結尾才載入模組、把捲動交給卡牌、被蓋住時不畫場景（共 5 處小改動） |

兩個新模組**快到結尾（最後 3.2 個單位）才下載**，沒捲到結尾的訪客不會載到；載入失敗時就當沒有這一段，網站照常。

## 設定（`js/main.js` 的 `CONFIG.portfolio`）

| 項目 | 說明 |
|---|---|
| `on` | `1` 開、`0` 關掉整段 |
| `images` | 卡片的圖，正方形、依序排列。換成自己的圖：放進 `images/portfolio/`，把清單改成 `['./images/portfolio/a.jpg', …]`（建議 1024×1024） |
| `base` | 底色（0–1 的 RGB），現在是 `[.925, .943, .962]` |
| `lift` | 卡牌比畫面正中高多少（畫面高的比例），現在 `.055` |

標題文字（FINNOVATION PORTFOLIO／PORTFOLIO IN MOTION／拖曳或捲動，瀏覽更多）在 `js/portfolio-epilogue.js` 的 `mountPortfolio` 參數預設值裡。
修改卡牌模組後須更新 `js/main.js` 內對應的模組版本參數，再跑 `node scripts/stamp-assets.mjs` 更新頁面資源版本。

## 圖片來源

11 張都來自 Pexels（[授權](https://www.pexels.com/license/)：可免費商用、不必標示出處），目前**直接連 Pexels 的圖檔位址**（1024×1024 裁切，合計約 1.4 MB），沒有下載到專案裡。
挑選原則：金融／數據／科技／商務，盡量不出現可辨識的人臉與品牌標誌。

| # | Pexels 編號 | 內容 | 頁面 |
|---|---|---|---|
| 1 | 2869852 | 玻璃帷幕大樓仰角 | https://www.pexels.com/photo/low-angle-photograph-of-high-rise-buildings-2869852/ |
| 2 | 159888 | 螢幕上的行情走勢圖 | https://www.pexels.com/photo/blue-and-yellow-graph-on-stock-market-monitor-159888/ |
| 3 | 3183145 | 筆電上的數據分析討論 | https://www.pexels.com/photo/photo-of-person-using-laptop-3183145/ |
| 4 | 6770610 | 筆電上的 K 線圖 | https://www.pexels.com/photo/multiple-graphs-on-a-laptop-screen-6770610/ |
| 5 | 6476254 | 團隊會議俯視 | https://www.pexels.com/photo/team-having-a-meeting-6476254/ |
| 6 | 11962493 | 藍色玻璃立面 | https://www.pexels.com/photo/close-up-on-a-skyscraper-11962493/ |
| 7 | 4960438 | 交易介面特寫 | https://www.pexels.com/photo/stock-exchange-charts-4960438/ |
| 8 | 7693683 | 商務會議中的筆電 | https://www.pexels.com/photo/using-laptop-in-a-business-meeting-7693683/ |
| 9 | 2132660 | 金融區高樓 | https://www.pexels.com/photo/high-rise-buildings-2132660/ |
| 10 | 4174746 | 信用卡線上支付 | https://www.pexels.com/photo/woman-holding-a-credit-card-and-cellphone-4174746/ |
| 11 | 7651734 | 圖表與筆電協作 | https://www.pexels.com/photo/business-people-working-together-in-front-of-their-laptops-7651734/ |

## 驗證（真實 GPU 的 Chrome，`scripts/portfolio/epilogue-test.cjs`）

| 項目 | 結果 |
|---|---|
| 流程 11 項（頁首不載入、快到結尾才預載、多捲一格才開、蓋住畫面、卡片有畫出、滾輪捲卡牌而旅程不動、拖曳、捲回開頭關閉並停在最後一章、可再開、Home 關閉、console 乾淨） | 桌機、手機尺寸、減少動態 三種都 11/11；套用後在 Live Server 網址再跑一次 11/11 |
| 既有功能（水滴字母 `verify-letters.cjs` 的 default、timing） | 25/25 |
| SEO 檢查 | 通過 |


## 2026-10-11 轉場細修

- 同一個可反向的阻尼進度驅動背景、卡牌姿態與兩段文字。淺色底稍早浮現，卡牌接著顯影；快速反向捲動會接續當下狀態，不重播開場。
- 預載時把撕邊貼圖生成拆成小批次，等待第一屏圖片準備好並預熱 WebGL 後才開啟。慢載圖期間保持山景；往回捲動能取消等待中的進場。圖片逾時或失敗使用中性底圖，其餘圖片可繼續逐張載入。
- 卡牌慣性使用秒數計算；重新開啟時清除殘影緩衝。完全蓋住山景後才停止底層場景繪製。
- 保留拖曳、觸控軸向判斷、鍵盤與減少動態模式；切換章節時不會重新顯示上一段文字。
- 本輪驗證：既有流程在桌面、手機模擬尺寸、減少動態模式各通過 11/11；新增 seam-test 通過慢載圖取消、連續進度、半途反向與 Home 文字清理。延遲 CSS/JS 的啟動檢查和 SEO 檢查通過，Chrome 無頁面錯誤。Safari／Firefox 尚未測試。
- 新增驗證：`node scripts/portfolio/seam-test.cjs`（本機伺服器 5211）；截圖與紀錄在 `.qa/portfolio-seam-20261011/`。截圖檔名為等待序列標籤，不代表精準動畫時間。

## 已知事項

- 圖片目前是外連 Pexels。正式上線建議把圖下載到 `images/portfolio/`（不受對方網站影響、也比較快）；或換成公司自己的圖。
- 多了一個外部相依：OGL（`cdn.jsdelivr.net/npm/ogl@0.0.93`，和 three.js 同一個 CDN）。
- 卡牌捲到最後一張之後再往下捲不會有動作（沒有下一段）。（`index.html`；`index1-1.html` 自 2026-10-19 起改成捲動推進的霧中過場，卡牌之後接地球、理念與頁尾，見 [world-epilogue.md](world-epilogue.md)。）
- 只在 Chrome 實測；Safari／Firefox 未測。
- 退回：`_archive/backups/portfolio-20261011/`。
