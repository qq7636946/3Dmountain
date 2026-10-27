# index1-4-ascent：照 index1-1 的路線與光流、maritime 水滴、Everest 色調（2026-10-23）

頁面：`index1-4-ascent.html`（程式在 `prototypes/highland-1-4-ascent/`）。
這是 index1-4 在 2026-10-23 09:12 的副本。index1-4 那時還有另一個工作階段在改，為了不互相覆蓋，這一輪全部做在副本裡；`index1-4.html` 和 `prototypes/highland-1-4/` 都沒有動。
圖：[原本／新版](highland-ascent/before-after-20261023.jpg)｜[整段旅程](highland-ascent/journey-20261023.jpg)｜[接卡牌的轉場](highland-ascent/bridge-to-cards-20261023.jpg)｜[手機](highland-ascent/phone-20261023.jpg)

## 客戶要求與處理

| 客戶說 | 做了什麼 |
|---|---|
| 第一人稱進山谷後「往上拉升又回頭」，邏輯很怪，應該直接通向匯集的大海 | 全程只往一個方向（北、順著水流）前進，不再轉身 |
| 山的路徑照 index1-1，光流也是 | 跟 index1-1 一樣：LOGO 溶接後直接在峽谷水面上第一人稱前進，IDEAS／CONVERGENCE／VALUE 三章都在峽谷裡；A WIDER PERSPECTIVE 往前升高，往前往下看河流匯合：A、C 從左右下角進來，B 在正下方，D 從右側匯入，主河道再流向海灣和海。光流順著各條河流進匯流點，再沿主河道流過海灣、一路流到海平線，被霧氣吃掉，沒有斷點 |
| 匯流到卡牌要完美流暢，光線不要好像突然斷掉卡住 | 轉場從約 1.4 秒改成約 3 秒：鏡頭繼續往前推，先起霧（顏色是山景的藍灰霧），光線在霧裡繼續流，霧夠濃才讓卡牌浮出；卡牌底色從近白改成同一個藍灰 |
| 水滴用 index1-3-maritime 去修 | 開場兩段（水滴、LOGO）改用 index1-3-maritime 的實際參數：石板藍房間、石板藍水面（倒影 .92、閃光 .25）、maritime 的鏡面水滴（不再用折射水球）、核心光、海平線高度、調色。文字改成象牙白，玻璃面板改成石板藍 |
| 前面兩段跟後面色調搭不上 | 山景天空從很飽和的藍，收到介於 Everest 深藍和 maritime 石板藍之間 |
| 整體藍色、山形精緻度照 Everest；山的材質要跟 index1-4 類似；雪少一點；精緻度更高但不要一圈一層 | 岩石恢復 index1-4 的材質，另外加了順著坡往下的細節（岩肋、沖蝕溝、崖底碎石、稜線），沒有任何隨高度分層的環紋；雪只留在最高的山頂和稜線（約 2%）；雲改成柔和的雲團，只在最後升起時出現 |
| （昨天）五條河匯流要看得清楚 | 把昨天 Blender 改好的匯流地形（匯流水潭、山勢往匯流點降低）打包進副本的高度圖 |

## 章節對照（q＝山景時鐘）

| 章節 | 畫面 |
|---|---|
| 01 KNOWLEDGE、02 INNOVATION | maritime 風格的水滴與海 |
| LOGO 溶接（1.40） | 直接落到 B 河峽谷上游的水面 |
| IDEAS（1.98–3.86）、CONVERGENCE（4.70）、VALUE（5.88–6.85） | 第一人稱順流穿過峽谷，五條光線跟著鏡頭 |
| A WIDER PERSPECTIVE（7.6–8.96） | 往前升到匯流點南側上空，俯看五河匯流、光流流向海灣與海；手機版鏡頭再往下一點 |
| 卡牌 | 約 3 秒的霧中轉場 |

## 改了什麼（全部在副本）

| 檔案 | 內容 |
|---|---|
| `js/highland-scene.js` | 路線（`patch-r1`…`r4`）、`ascent` 色調、天空曲線、高空／低空切換、固定鏡頭除錯鉤子 |
| `js/highland-lights.js` | 光流延伸到海、第一人稱光線從峽谷開始（`patch-l1-flow.cjs`） |
| `js/highland-material.js`、`js/highland-valley-clouds.js` | 材質細節（順坡向）、少量山頂雪、柔和雲團（組員兩輪 look-dev） |
| `js/main.js` | maritime 開場（`patch-h1-maritime-drop.cjs`）、轉場速度與霧色（`patch-b1-bridge.cjs`）、設定存檔鍵改成本頁專用 |
| `highland.css` | 開場改象牙白字、石板藍玻璃 |
| `assets/world-height-*.dz`、`world-meta.json` | 匯流地形（由 Blender 世界重新打包；`source/*.u16`） |
| `index1-4-ascent.html` | 指向副本，`data-hl-ascent` |

## 驗證

- 桌機 1440×900：開場、LOGO、峽谷、匯流、結尾共 13 個位置；手機 390×844：6 個位置；接卡牌的轉場用真實滾輪錄 8 秒。主控台 0 錯誤。
- 截圖用不會自動重整的靜態伺服器（`node scripts/logo-letters/overlay-server.cjs <專案> 5621`）。Live Server 在檔案變動時會重整頁面，截圖會跳回開場。
- 效能沒有重新量測；沒有新增繪製步驟或貼圖，雲是原本的一次 instanced draw。
- 已知：某些坡面有淡淡的點狀線，原本就有（網格造成）；從正上方看，峽谷左側一座平頂山的雪會像一頂白帽。

## 退回

整份是新檔案：不要的話，把 `index1-4-ascent.html` 和 `prototypes/highland-1-4-ascent/` 移到 `_archive/`，其他頁面完全不受影響。
