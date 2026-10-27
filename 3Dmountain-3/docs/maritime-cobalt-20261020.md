# 寫實山海原型：彩色版「COBALT」（2026-10-20）

範圍：只有 `index1-3-maritime.html`（測試頁，noindex）。正式頁 index.html / index1-1 / index1-2 / index1-3 沒動。
對照圖：[前後對照](maritime-landscape/cobalt-20261020.jpg)｜[手機、iPad](maritime-landscape/cobalt-devices-20261020.jpg)
備份：`_archive/backups/maritime-cobalt-20261020/`

## 方向

- **藍色當主調**（參考 hashgraphvc.com）：開場是深夜藍天空、地平線一圈亮藍光、鈷藍海；峽谷的水、空拍的遠霧都是藍。
- **顏色從陸地來**（參考 Mont-Fort 那張島）：向陽岩面赭黃、橄欖綠灌叢、暖色日光。藍與暖色互補，不會整片都藍。
- **一個暖色重點**：介面上只有一個沙赭色（`#e6b877`，取自向陽岩面）——小標、目前章節的記號、進度線。
- **字全部改白**，玻璃面板改成帶藍的煙霧玻璃。
- **第一幕海平面升高**：海面下移 200 px → 60 px（桌機地平線由畫面 93% 升到約 75%；手機約 70%）。
- 沒有用生成圖：這一版用 3D 本身的顏色就夠；之後要加島嶼或遠景圖再談。

## 怎麼看

| 網址 | 內容 |
|---|---|
| `index1-3-maritime.html` | 新的彩色版（預設） |
| `index1-3-maritime.html?look=overcast` | 上一版灰色寫實山海 |
| `index1-3-maritime.html?look=original` | 原本的 index1-3 |

調參數：`?tune=1` 或按 T →「寫實山海 Maritime」群組（新增 開場核心光色／開場核心光強／開場四周暗角色）；開場天空顏色在原本的房間色群組，海平面是「海面下移 px」。

## 改了什麼

| 檔案 | 內容 |
|---|---|
| `prototypes/maritime-landscape/js/main.js` | `COBALT` 旗標（`?look=overcast` 關掉）；COBALT 色票（天空、霧、岩石、植被、水、開場房間色、調色）；開場核心光與暗角改由設定讀（原本寫死）；`sea.screenDown` 60；頂端亮軌移出畫面（`chrome.railY` .34 → .48，深色天空上它是一條灰帶）；3 個新調整列 |
| `prototypes/maritime-landscape/maritime.css` | 檔尾新增 COBALT 區塊：背景、載入畫面、白字、藍色煙霧玻璃、暖色重點 |
| `index1-3-maritime.html` | `data-palette="cobalt"`；快取版本 `?v=cobalt1` |
| `prototypes/maritime-landscape/patches/patch-c1-cobalt.cjs` | 這次的修改腳本（每個替換都檢查錨點唯一） |

動畫、時間軸、鏡頭、模型都沒改，只有顏色、光色、開場海平面高度。

## 驗證

- 桌機 1440×900：6 個位置（開場、IDEAS TAKE SHAPE、VALUE IN MOTION、A WIDER PERSPECTIVE、FOUR PATHS、DERIVATIVE），主控台 0 錯誤。
- 手機 390×844、iPad 820×1180：開場、峽谷、空拍，0 錯誤，字都清楚。
- `?look=overcast` 截圖與上一版相同（灰色寫實山海保留）。
- 截圖是無頭 Chrome（GPU）＋ Live Server 5502，直接設定旅程位置後拍，不是手動捲動。

## 退回

把 `_archive/backups/maritime-cobalt-20261020/` 裡的 3 個檔案複製回原位置即可。
