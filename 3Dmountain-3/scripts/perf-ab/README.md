# perf-ab：index4-6-3 的 A/B 效能與畫面對照工具

用**真實 GPU**（headless Chrome + ANGLE/D3D11）量測，並用頁面內建的 `__MONTIS_STUDY__.step()` 逐幀確定性推進，
所以「優化前 vs 優化後」可以逐章節比較 draw call、GPU 時間、每幀配置量與畫面像素差。

依賴：本機 Chrome、`C:/Users/lee/.cache/codex-runtimes/.../playwright`（和其他 scripts 相同的 Playwright 路徑；換電腦請改各檔第 1～3 行的 require 路徑）。

## 用法

```bash
# 1) 伺服器：同時服務專案根目錄（/）與基準快照（/__base__/，找不到的檔案會回退到根目錄）
node scripts/perf-ab/static-server2.cjs . 5200 backups/opt-20261001-baseline

# 2) 量測（--profile: desktop = 1440x900@DPR2→1.65 | desktop1x | desktop4k 壓力 | phone = 390x844@DPR3，觸發 DROPLET_LITE）
node scripts/perf-ab/perf-harness.cjs --base http://127.0.0.1:5200/__base__/ --label base --profile desktop --frames 90 --raf 90 --png .qa/perf/png --out .qa/perf/base-desktop.json
node scripts/perf-ab/perf-harness.cjs --base http://127.0.0.1:5200/          --label opt  --profile desktop --frames 90 --raf 90 --png .qa/perf/png --out .qa/perf/opt-desktop.json

# 3) 比對（表格：draw calls / 三角形 / CPU / GPU / 每幀配置 + 縮圖像素差 PSNR）
node scripts/perf-ab/compare.cjs .qa/perf/base-desktop.json .qa/perf/opt-desktop.json
```

其他旗標：`--passes 40 --only-passes`（逐 pass GPU 時間）、`--sweep`（捲動洩漏掃描：geometries/textures/programs/JS heap 是否持平）、
`--boot 3 [--throttle]`（冷啟動時間與傳輸量；`--throttle` = Slow-4G + 4× CPU）、`--scenarios hero,canyon`。

## 其他工具

| 檔案 | 用途 |
|---|---|
| `heap-profile.cjs <baseUrl> [scenarios] [frames]` | Chrome 取樣式 heap profiler，列出每幀垃圾的來源函式（含已被 GC 的短命物件） |
| `prog-probe.cjs <baseUrl> [scenarios]` | 統計 three 每幀對哪些材質重新執行 `getParameters()`（材質在 Mesh／InstancedMesh 間交錯造成的 program 抖動） |
| `gpumem.cjs <baseUrl> <desktop\|phone> [scenarios]` | 用 Windows「GPU Process Memory」計數器量 Chrome 行程樹的專用顯存 |
| `motion-ab.cjs <baseUrlA> <baseUrlB>` | **捲動中**對照：靜態章節裡景深動態模糊／前進轉場等 pass 是關閉的，這支沿同一條確定性軌跡逐幀擷取、列出當下啟用的 pass 並比對像素（已固定場景時鐘；請一併跑「基準 vs 基準」當對照組） |

## 注意

- 量測時會由 Playwright 攔截 HTML，**僅在測試中**注入 `window.__setSceneTime` 與少量內部變數的唯讀暴露（不改動檔案本身），
  讓畫面比對能固定時間（顆粒／水波相位），且兩個版本注入的內容完全相同。
- 雜訊底線：同一版本跑兩次，logo／transition／zoom／canyon 逐位元相同；hero／disperse 會因頁面啟動時跑了不同幀數而有 0.03～0.3 的平均差（模擬相位）。
  判讀時請先和「基準對基準」比。

## 2026-10-04 分階段啟動測試

本次基準為 `.qa/perf-20261004/baseline/`，不是 10/1 的舊備份。用 `static-server2.cjs . 5204 .qa/perf-20261004/baseline` 比較。

- `--boot N --noscen` 分開記錄 `heroReadyMs`（首屏可操作）、`chapterReadyMs`（後續章節貼圖與 shader 準備完成）及兩個時點的傳輸量。延後載入的照片仍計入完整章節的傳輸量。
- 場景／像素比較會先等待 `window.__MONTIS_STUDY__.ready`，再凍結 rAF、推進測試時鐘；舊版本沒有此 Promise 時直接繼續。
- `boot-profile.cjs` 回報最長任務及 `heroTbtMs` / `chapterTbtMs`：導航到對應時點的 `sum(max(0, longTaskDuration - 50))`。這是診斷用阻塞時間，**不是 Lighthouse 正式 TBT 或 PageSpeed 分數**。
- `phone` 只有手機尺寸、UA、觸控、網路及 CPU 模擬，GPU 仍是測試電腦。`--raf` 預設關閉 vsync，不能拿它宣称一般 60 Hz 的實機 FPS。
- 測試結果會先存檔才關閉 Chrome，避免 Windows 暫存設定檔清理卡住時丟失測量。
