# ASCENT：夜藍＋香檳金（index1-3-everest.html，2026-10-22）

參考：everest.suraj.work —— 深夜藍底、香檳金重點、單一太陽、底片調色、介面讓位給畫面。
圖：[另一版 EVEREST vs ASCENT](maritime-landscape/ascent-vs-everest-20261022.jpg)｜[整段旅程](maritime-landscape/ascent-journey-20261022.jpg)｜[手機](maritime-landscape/ascent-phone-20261022.jpg)

## 為什麼是另一個頁面

另一個工作階段同時在 `index1-3-maritime.html` 做它的 EVEREST 版（灰藍、低彩度）。為了不互相覆蓋，我複製了一份獨立的頁面與程式：

- 頁面：`index1-3-everest.html`
- 程式：`prototypes/maritime-everest/`（複製時間 2026-10-22 約 00:00，包含當時的山體貼圖、高地與 EVEREST 設定）
- `index1-3-maritime.html` 和它的資料夾我都沒有再動（只有 10-21 23:49 加過一個預設關閉的「底片調色」功能，畫面不變）

## 色調設計

- **開場（藍色時刻）**：深夜藍天空、深藍海；海平線上**一條細細的金線**（不是一整片橘帶）；低處的雲帶淡金邊；水滴反射的房間調亮，比較像玻璃、比較不會有髒斑。
- **峽谷（黃昏前）**：天空三段漸層「金→淡藍→夜藍」，不經過咖啡色；遠山是有空氣感的藍灰剪影；岩石是中性礦物色，向陽面淡金、背光面偏天空藍；水是深藍帶金色反光（不再用銀白水面模式，那會讓開場的海像沙丘、峽谷的水偏紫）。
- **空拍（金色時刻）**：山頂**積雪**接到夕陽變成金白色，陰影是藍色；天邊是金色；河流光是淡金色。
- **底片調色**（畫面最後一道）：輕微 S 曲線、暗部偏夜藍、亮部偏香檳金、黑位微提、暗角。
- **介面**：象牙白字、香檳金（`#d9bc85`）小標、章節記號、進度線、載入畫面；玻璃面板改帶夜藍。字型沿用複製時的襯線大標。

## 調整

`?tune=1` 或 T：
- 「底片調色 Film」：強度、S 曲線、暗部色/染色、亮部色/染色、黑位、暗角。
- 「寫實山海 Maritime」：新增 峽谷天空中段色、山頂積雪、雪線高度、雪線柔和、陡坡留雪、雪色。
- 「島嶼與雲 Horizon」：金線（地平線餘暉）強度、高度、厚度。

## A/B

- `index1-3-everest.html` → ASCENT（預設）
- `index1-3-everest.html?look=everest` → 複製當下的 EVEREST 版
- `index1-3-maritime.html` → 另一個工作階段持續在做的版本

## 改了什麼（全部在副本裡）

| 檔案 | 內容 |
|---|---|
| `prototypes/maritime-everest/js/main.js` | `ASCENT` 色票（預設）、雪的設定與每幀更新、峽谷天空三段漸層、ASCENT 不用銀白水面、底片調色開啟 |
| `prototypes/maritime-everest/js/terrain-texture-detail.js` | 山體貼圖加積雪（依高度、坡度、岩面紋理斷開） |
| `prototypes/maritime-everest/ascent.css` | 夜藍＋香檳金介面 |
| `prototypes/maritime-everest/everest.css` | 複製自 `css/maritime-everest.css`（凍結在複製當下） |
| `index1-3-everest.html` | 指向副本 |
| `prototypes/maritime-everest/patch-e1/e2/e3-*.cjs` | 修改腳本 |

## 驗證

- 桌機 1440×900：8 個位置；手機 390×844：開場、峽谷、空拍。主控台 0 錯誤。
- 截圖用無頭 Chrome（GPU）直接跳到各位置，不是實際滾輪；效能沒有量到可靠數字（新增：天空/海面每像素多一次貼圖讀取、一個全螢幕調色、山體多幾行雪的計算，沒有新增模型或繪製次數）。
- 已知小問題（複製來的貼圖造成）：峽谷近處岩壁在某些角度有細碎的像素閃爍紋。

## 退回

整個副本是新檔：不要的話把 `index1-3-everest.html` 和 `prototypes/maritime-everest/` 移到 `_archive/` 即可，不影響其他頁面。
