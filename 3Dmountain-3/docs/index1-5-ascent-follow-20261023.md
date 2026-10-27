# index1-5：Ascent 字體色調、Highland 岩材與第一人稱光流（2026-10-23）

入口 `index1-5.html`，專屬程式與樣式在 `prototypes/index1-5/`。

- 移除水珠內部照片與照片下載，保留純水珠和獨立螺旋液態字。水滴／字標模組取自 `index1-4-ascent`；章節文案、Jost 500 字重、象牙白字、石板藍玻璃與開場調色也對齊 Ascent。後段卡牌圖片保留。
- 原本 `index1-5` 的峽谷、匯流地形、鏡頭路線與河道完整保留。岩石改用 `index1-4` 的 slate 多尺度貼圖、triplanar 裂面法線與植被材質，直接共用三張既有貼圖。小岩石降低法線深度，濕岩加粗糙度下限與高光抗鋸齒，避免近岸白色方格閃點。
- 加入五條冰藍流光，沿原河道跟隨第一人稱鏡頭。拉升時延展至下游，交疊淡入既有匯流光效；回捲可恢復。手機光帶寬度減少 20%、亮度減少 15%。幾何只建一次；五個 draw calls，無新增離屏 render target，啟動預編譯。
- 使用本頁獨立的 look 儲存鍵與快取版本；編輯面板改成明確 URL 參數才開啟。

## 重建

`node prototypes/index1-5/build.cjs`

建置讀取共享 root `js/` 作原始來源，套用 style/material/lightflow 三個 helper，輸出本頁 local 模組。請編輯 helper 與 adapter，不要手改 generated main/journey/watershed/drop/letter/glass/highland-material。

## 驗證

- Chrome D3D11：桌面 1440×900、手機 390×844，開場／字標／峽谷／低空河道／匯流／結尾六階段。主控台與載入失敗均 0；沒有水平溢出；水珠照片請求 0。
- 水珠 `loadAssets()` 主動呼叫也會跳過照片；下捲開卡牌、上捲退回山景皆通過，回到峽谷五條光流恢復。
- 獨立光線 shader 編譯、有限頂點、正反向 reveal 測試通過。
- `index1-4.html`、`index1-4-ascent.html`、共享 main/journey/watershed 的 SHA-256 與工作開始時一致。
- 圖片／JSON／驗證腳本：`.qa/index1-5/`。未重跑 PageSpeed 或宣稱 FPS 分數。

原始入口備份：`_archive/backups/index1-5-20261023/index1-5.original.html`。
