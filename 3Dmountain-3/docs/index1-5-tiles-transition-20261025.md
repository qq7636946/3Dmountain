# index1-5 · 海洋橫移 → LOGO 段：方塊磚轉場（參考 hubtown.co.in）2026-10-25

## 做了什麼
- 海洋橫移最後一章 → LOGO 湖景段的轉場，從「水波」改成「方塊磚」：畫面切成正方格，每格像立方柱往下沉、再帶著湖景升上來；格子邊緣發藍光，側面拉出畫面（立體擠出感），深處是深藍底。
- 隨捲動走（往下、往回捲都一樣，完全對稱）；由下往上依序（照原本 `waveAngle` 方向），加一點亂序。
- 減少動態（prefers-reduced-motion）：維持原本的淡出淡入，沒有方塊。
- 舊的水波還在：`logoSeal.transition = 0` 就回到水波。

## 檔案
- `prototypes/index1-5/world-logo.js`：COMPOSITE shader 加 `tiles()`（每個像素從畫面中心往外最多走 3 格，判斷打到柱頂或鄰格側牆）；`wave()` 傳入 uTileA/B/C、uGlow、uField；DEFAULTS 加 13 個參數。
- `prototypes/index1-5/world-logo-build.cjs`：大調整面板加 13 列（中文標籤）；「波浪轉場長度／提早開始」改名為「轉場長度／提早開始」。
- `prototypes/index1-5/logo-panel-build.cjs`：本機 LOGO 面板（左側）加一節「轉場方塊（海洋 → LOGO，Hubtown）」。
- 備份：`_archive/backups/logoseal-tiles-20261025/`（三個檔改前的版本）。

## 參數（logoSeal）
| key | 預設 | 意思 |
|---|---|---|
| transition | 1 | 1 方塊／0 水波 |
| tiles | 8 | 長邊幾格（手機直式＝高度方向 8 格） |
| tileDepth | 1.1 | 下沉深度（格寬倍數） |
| tilePersp | 1.3 | 透視距離，越小越立體 |
| tileSpread | 0.65 | 錯開程度（0 全部同時） |
| tileJitter | 0.35 | 亂序（0 照方向／1 全隨機） |
| tileGlow / tileLine | 1.1 / 1.6px | 邊緣光強度／粗細 |
| tileGlowColor / tileField | #3d8bff / #05132a | 邊緣光色／深處底色 |
| tileFog | 0.75 | 下沉時變暗（也藏住換圖那一刻） |
| tileGrid | 0.25 | 轉場進行中整面格線 |
| tileExtrude | 0.55 | 側面延伸畫面的量 |

轉場長度仍是 `wave`（1.7 螢幕高）、提早開始 `waveLead`。

## 驗證
- 截圖：`.qa/index1-5/tiles-a/`（桌機 6 點）、`tiles-phone/`、`tiles-reduced/`。
- `check.cjs --no-build`：ok、0 錯誤。

## 更新（同日）：改成毛玻璃馬賽克（預設）
- 客戶回饋：Hubtown 是「動態模糊＋毛玻璃馬賽克」，不是科技方塊。看了先前錄的 Hubtown 轉場幀（`.qa/index1-5/smooth/ht-sheets-1/live-13600-66/80/94/108.jpg`）後重做。
- `logoSeal.transition`：**2＝毛玻璃馬賽克（預設）**／1＝立體方塊／0＝水波。
- 做法：大小不一的柔邊玻璃方塊（大方塊、部分切半、再切半）各自錯位、放大；往畫面中心的放射動態模糊（9 個取樣、每像素隨機起點避免殘影）；亮處拉出光痕；光痕帶色散；中段偏品牌藍、變暗、四角先暗；方塊一塊一塊從海洋換成湖景。0 與 1 時完全是原畫面。
- 時間驅動（像 Hubtown）：捲過 `cutAt`（0.3）後自己在 `cutTime`（0.9 秒）播完；往回捲過門檻就倒著播。`cutClock 0` 改回跟著捲動。關閉世界段時重設。
- 新參數：cutClock／cutAt／cutTime、glassSize／Split／Shift／Zoom／Blur／Chroma／Frost／Dip／Bloom／BloomAt／Spread／Seam／Push／Tint。立體方塊列改名「立體方塊 …」。左側 LOGO 面板那一節改成毛玻璃參數。
- 驗證：`.qa/index1-5/glass-c/`（桌機）、`glass-phone/`、`glass-reduced/`；check 0 錯誤；轉場中 8.3 ms/幀（120 fps）無卡頓；時鐘探針：停在 0.5 時 0.9 秒內 0→1，往回 0.9 秒 1→0。
- 備份：`_archive/backups/logoseal-glass-20261025/`（毛玻璃前，含立體方塊版）。
- 未做（客戶喊停）：海洋 04 → 原則段（`world-principles.js`，別的工作階段的檔）的轉場也改馬賽克；獨立審查 workflow 中途停止，沒有結果。
