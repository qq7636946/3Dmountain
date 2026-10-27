# scripts/logo-letters — LOGO 章節「字母誕生」的驗證與量測

全部用真實 GPU 的 Chrome（Playwright）。大多數工具會凍結頁面的 rAF、用 `__MONTIS_STUDY__.step()` 逐幀推進，所以結果可重現；
`feel.cjs`、`panel-test.cjs` 則是讓頁面用自己的迴圈即時跑，量的是人實際感受到的東西。
章節時鐘 `t`：0＝LOGO 章節開始、1＝結束；負數是水滴進場；大於 1 是往前轉場；−1.083 是頁面最上方。

```bash
node scripts/logo-letters/overlay-server.cjs . 5611        # 先把專案架起來（另開一個終端機）
```

| 工具 | 用途 |
|---|---|
| `overlay-server.cjs <root> <port> [overlay]` | 靜態伺服器；給了 `overlay` 資料夾時，同路徑的檔案以它為準——可以在不動專案的情況下試改 `js/`，也可以把備份疊上去重現舊版 |
| `chapter-shots.cjs` | 把章節拍成一張連續畫面：`--t "0,0.1,0.3"` 靜止點，或 `--run "0:1:480" --every 40` 模擬等速捲動（每幀 1/60 秒）；`--ui` 連 DOM 介面一起拍、`--crop "x,y,w,h"` 放大局部、`--profile desktop\|desktop1x\|wide\|phone`、`--exp "<js>"` 臨時改 CONFIG |
| `verify-letters.cjs` | 功能檢查：`default`（預設流程、切換照片↔字母、字標重建）、`swirl`（螺旋同向旋轉、一路上升、只有字母水滴會破、轉到章節最後、互不穿插）、`timing`（破開／飛入的時間不隨捲動快慢改變、往回捲倒著播、螺旋的慣性、跳進章節直接是完成狀態）、`variants`（`?logo=1/2`）、`reduced`（減少動態）、`phone`；加 `--ref <舊版網址>` 再做兩組逐像素比對：`photoParity`（照片模式）、`index2` |
| `feel.cjs` | **滾輪手感**：即時播放、用真的滾輪事件一格一格轉（`--notch 250` ＝每 250 ms 一格），量螺旋轉速的均勻度、每個字破開與飛入實際花多久、有沒有停在半空。`--out x.jpg` 另存每一格的畫面 |
| `flight.cjs` | 等速捲動下，逐幀追一個字母從水滴裡到落位的螢幕軌跡，找速度突跳的地方（`--letter 3 --rate 0.12`） |
| `panel-test.cjs <base> <輸出前綴>` | 參數面板的操作測試（出現、切換、滑桿、複製、重新整理後保留、收合、換邊、L、與大面板同步）並截圖 |
| `clearance.cjs` | 整章掃描任兩顆水滴表面之間的距離；改了水滴群的編排（`composeCrowd`）或大小之後跑一次。`--exp "window.__MONTIS_STUDY__.CONFIG.logoDrops.crowd=1.6"` 連備用水滴一起驗 |
| `gpu-time.cjs` | 各時間點每幀的 GPU／CPU 毫秒、draw call、三角形；`--scroll` 是邊捲邊量 |
| `hitch.cjs` | 冷啟動後第一次從頁首捲到章節結束，列出最慢的幾幀；`programs.cjs` 列出途中才被編譯的 shader（＝預熱沒涵蓋到的） |

```bash
node scripts/logo-letters/verify-letters.cjs --base http://127.0.0.1:5611/ --only default,swirl,timing
node scripts/logo-letters/feel.cjs           --base http://127.0.0.1:5611/ --notch 333
node scripts/logo-letters/panel-test.cjs     http://127.0.0.1:5611/ .qa/letters/panel
node scripts/logo-letters/clearance.cjs      --base http://127.0.0.1:5611/
node scripts/logo-letters/chapter-shots.cjs  --base http://127.0.0.1:5611/ --out .qa/letters --label now --ui
node scripts/logo-letters/gpu-time.cjs       --base http://127.0.0.1:5611/ --label now --profile desktop

# 和「字母誕生之前」的版本比（把備份疊在專案上，就是舊版）
node scripts/logo-letters/overlay-server.cjs . 5612 _archive/backups/letters-20261010
node scripts/logo-letters/verify-letters.cjs --base http://127.0.0.1:5611/ --ref http://127.0.0.1:5612/ --only photoParity

# 看前幾輪長什麼樣
node scripts/logo-letters/overlay-server.cjs . 5613 _archive/backups/letters-round1-20261010   # 第一輪：一格一格的旋轉階梯
node scripts/logo-letters/overlay-server.cjs . 5614 _archive/backups/letters-round2-20261010   # 第二輪：連續螺旋，動作綁捲動
```

`verify-letters.cjs` 每一組要一兩分鐘，一次跑一兩組就好。這些工具預設帶 `?tune=0`，所以參數面板不會出現在截圖裡；要看面板用 `panel-test.cjs`。
