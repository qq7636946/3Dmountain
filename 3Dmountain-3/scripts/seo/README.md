# Finnovation SEO 與靜態內容

正式入口及 canonical：`https://qq7636946.github.io/3Dmountain/3Dmountain-3/index3.html`。
`index4-6-3.html` 是編輯來源；發佈時同步到 `index3.html`，兩頁都指向同一個 canonical，sitemap 只列正式入口。

## 修改文案後

`finnovation-interface.js` 的 `renderJourneyInterface()` 是互動介面與初始 HTML 的共同來源；業務文案沿用 `water-journey-story.js`。正常啟動復用既有節點，其他舊頁面沒有靜態介面時才動態建立。

```sh
node scripts/seo/build-static-interface.mjs
node scripts/seo/check-seo.mjs
```

檢查會驗證 metadata 一致性、JSON-LD 引用、圖片尺寸、canonical/sitemap、單一 h1/main 以及靜態內容是否同步。發佈副本可以加上 `index3.html` 參數再檢查一次。

`finnovation-readable.css` 只在停用 JavaScript 或主模組/WebGL 啟動失敗時載入。它將同一份內容排列成文字頁，不提供不同的搜尋引擎專用內容。正常3D頁面不下載此 CSS 或兩張社群圖片。

## Metadata 與資產

- HTML head：title、description、robots、canonical、Open Graph、Twitter Card。
- JSON-LD：Organization、WebSite、WebPage。只使用頁面已公開的名稱、理念、網址與標誌；不虛構地址、電話、社群帳號、評分或金融執照。
- `images/finnovation-social-card.png`：1200×630 分享圖。
- `images/finnovation-logo.png`：512×512 品牌標誌。
- `sitemap.xml`：只列 canonical，內容更新時才更新 lastmod。

更換正式網域時，須同步 metadata、JSON-LD、品牌首頁連結、sitemap 及檢查腳本內的 URL。

## 收錄與提交

Sitemap 可在 Google Search Console 提交為：
`https://qq7636946.github.io/3Dmountain/3Dmountain-3/sitemap.xml`。

尚未代為登入或提交 Search Console。未在專案子路徑建立 robots.txt，因為 robots.txt 必須位於網域根目錄；此專案並不控制 `https://qq7636946.github.io/robots.txt`。不加入 keywords/revisit-after 等無助於此實作的標籤，也不保證特定排名、站名或複合搜尋結果。

參考：[Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)、[Organization 結構化資料](https://developers.google.com/search/docs/appearance/structured-data/organization)、[Sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、[Open Graph](https://ogp.me/)。