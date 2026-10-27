# index1-1：上升螺旋與字母交接

2026-10-16。只在 `index1-1.html` 的 `data-letter-direction="rising-helix"` 啟用。

- 參照 `index2.html` 的 SPIRAL：半徑 1.2、螺距 .18、每章一圈、傾斜 −8°／−7°，加入尾部半徑及深度差。
- 不再把低處水滴壓在同一個水平面；水滴從水面附近淡入，沿螺旋往上，尾聲加速旋出。
- 降低清水珠密度及破裂膨脹量，保留 11 顆字母水滴。
- 破裂 .66 秒，28–58% 進度交接水中字形與獨立字母；交接完成後開始 1.05 秒飛行。
- 換手使用實際水中字母的姿態／偏心；水殼消失後保留校正，避免跳回近似姿態。
- 位置使用五次平滑曲線；縮小翻身與上拋，尺寸獨立緩動，落位後再融合。
- 淡入中的字母不寫入深度，完全透明時不繪製，避免切穿水殼。
- 參數面板用獨立儲存鍵，不覆蓋或刪除其他頁面的既有調參。

`index.html`、`index1-2.html` 未開啟此模式；`index2.html` 保持照片螺旋。

備份：`_archive/backups/letters-index1-1-20261016/`。
畫面比對：`.qa/letters-index1-1/reference-sheet.jpg`、`refined-sheet.jpg`。
驗證：`node scripts/logo-letters/check-directed.cjs`（先以本機 port 5611 啟動預覽）。
