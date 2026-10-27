# Maritime 山體貼圖／低面數版本 — 2026-10-21

入口：`index1-3-maritime.html`。只修改該頁使用的 maritime 分支；根目錄 `js/main.js`、其他 HTML、影片、文字版面與動畫時間軸均未修改。

## 視覺與實作

- 依使用者的海岸片岩、銀灰岩石、藍青植被參考，透過 imagegen 產生兩張獨立材質來源圖。不是把參考畫面直接貼到山上。
- 岩面採世界座標三向投影，陡壁不會像單純俯視 UV 一樣垂直拉長。
- 48／173 世界單位雙尺度混合，鏡像重複；減少單一圖樣規律，並非保證完全看不出重複。
- 緩坡依幾何法線、海拔與低頻分布混入短草／苔原貼圖；不是新增大量草葉模型。
- 由貼圖亮度推估細微凹凸和粗糙度，保留水線濕岩、侵蝕溝明暗與遠霧。這是藝術性 bump，不是真實掃描的高度圖，也不是獨立烘焙的 normal map。
- 自訂 sampler 明確做 sRGB → linear 解碼；mipmap、遠距凹凸衰減和 2×／4× anisotropy 降低遠處細紋閃爍。
- 貼圖就緒後跳過原本近岸 27-cell 微裂縫搜尋；其餘大型地形／侵蝕結構保留。
- 桌機使用 1024²，觸控／輕量模式使用 512²。所有山石材質共用這兩張貼圖，場景清理時一併 dispose。
- 任一貼圖失敗時退回原程序材質；此時保留低面數網格，不因載入錯誤重建整個場景。

保留原本夕光，所以受光面仍帶少量暖色；沒有為追求參考圖顏色而重做天空、海面、霧或環境光。原有全畫面顆粒效果也保留。

## 網格比較

只統計主山體與近岸主網格；不代表整個網站所有 draw pass 的面數。

| 模式 | 修改前 | 修改後 | 減少 |
| --- | ---: | ---: | ---: |
| 桌機主山體 | 455,868 | 197,600 | 56.7% |
| 桌機近岸 | 221,760 | 109,120 | 50.8% |
| 桌機合計 | 677,628 | 306,720 | 54.7% |
| 手機主山體 | 230,160 | 123,692 | 46.3% |
| 手機近岸 | 114,080 | 58,880 | 48.4% |
| 手機合計 | 344,240 | 182,572 | 47.0% |

河流頂點數保持原值：桌機 84,232、手機 35,258。五條河、河道曲線、LOGO 湖輪廓的生成方法未變。

地形採樣變稀時同步限制高頻幾何噪聲，以避免尖刺；大型形狀保留，但頂峰／小凹凸不可能逐頂點相同。抽樣最高點桌機約 2753 → 2684，手機約 2707 → 2591。

這不是「FPS 增加 55%」的宣稱。新增貼圖會增加取樣及顯存；完整 GPU frame-time 尚未做統計量測。

## 資產

位置：`images/maritime/terrain/`

| 檔案 | bytes |
| --- | ---: |
| coastal-slate-1024.webp | 455498 |
| blue-heath-1024.webp | 546550 |
| coastal-slate-512.webp | 114136 |
| blue-heath-512.webp | 132414 |

每次只載入對應尺寸的兩張圖：桌機約 979 KiB、輕量約 241 KiB。PNG 原圖是製作來源，不由網頁載入。一般 RGBA8 加 mipmap 約新增 10.7 MiB／2.7 MiB 材質顯存；不是 WebP 傳輸大小。

影像生成 brief（內容摘要，供重製）：

1. **Coastal slate**：正交俯視、可重複的海岸風化片岩 base-color。銀灰岩層、低飽和藍灰、少量灰褐礦物脈，細裂縫、片狀顆粒；均勻漫射光，沒有場景透視、地平線、物件、草、字樣、強陰影或高光。
2. **Blue heath**：正交俯視、可重複的密集短草與苔原 base-color。粉霧藍、灰青綠、銀色細尖和少量灰色土壤；短纖維、不做長草叢。均勻漫射光，沒有地平線、物件、雪、文字、投影或鏡面光。

## 驗證

測試腳本：`scripts/check-maritime-textures.cjs`。
使用獨立靜態測試伺服器 5613，避免 Live Server 因截圖／資產輸出重載頁面。

- Chrome + ANGLE D3D11，RTX 5060 Laptop GPU。
- 1440×900 桌機、390×844 手機模擬、1024×768 觸控平板模擬。
- 峽谷、山脊、俯瞰、終章、返回峽谷五個位置皆完成截圖。
- 正常載入無 JS／shader 錯誤、無 HTTP 失敗；最終桌機／平板檢查 position 和 normal 緩衝均為有限值。
- 桌機／手機五個抽樣位置的相機座標與修改前完全一致。
- 實際 wheel 事件前進／反向：progress 7.494 → 8.0168758 → 7.494，通過。
- 阻擋兩張 WebP 的失敗測試：只有預期的兩筆網路錯誤，材質狀態為 fallback，場景仍正常渲染。
- `terrainTextures=0` 比較模式：回到原始網格統計及程序材質，無執行錯誤。
- 截圖及 JSON：`.qa/maritime-textures/`。手機和平板為瀏覽器模擬，並非實體裝置效能驗證。

執行例：

```powershell
node scripts/logo-letters/overlay-server.cjs . 5613
node scripts/check-maritime-textures.cjs after --motion
node scripts/check-maritime-textures.cjs after --mobile
node scripts/check-maritime-textures.cjs after --tablet
node scripts/check-maritime-textures.cjs fallback --missing
node scripts/check-maritime-textures.cjs original --original
```

## 比較與復原

新版本：`http://127.0.0.1:5502/index1-3-maritime.html?view=canyon`

原材質／原面數比較：`http://127.0.0.1:5502/index1-3-maritime.html?view=canyon&terrainTextures=0`

修改前四個檔案完整備份：`_archive/backups/maritime-textured-20261021/`，內部維持專案相對路徑。
需要永久還原時，只還原這四個檔案；不要覆蓋之後產生的其他使用者改動。

新材質入口：`prototypes/maritime-landscape/js/terrain-texture-detail.js`。
主網格密度：`water-journey-scene-463.js` 的 longitudinal／lateral；遠景密度：`water-canyon-watershed-463.js` 的 terrainSpacing／channelSpacing／FAR_DZ。
