# index1-5：卡牌到地球時關閉「全站日照」（2026-10-24）

客戶：「卡牌到地球時候就關閉全站日照這個效果」。
對照圖：[地球段 原本／關日照](index1-5-world-daylight-off/earth-before-after-20261024.jpg)、[換手那一格 原本／關日照](index1-5-world-daylight-off/handover-before-after-20261024.jpg)。

## 「全站日照」是什麼
tuner 的「全站太陽／場景時間 Scene Time」（`CONFIG.sceneDaylight`，第一列「全站日照（1 開／0 原手動光）」）。它讓天空、太陽、雲、海、介面右上角的 SCENE TIME 小時鐘，隨捲動從日出走到藍調。

## 現在的行為
- 卡牌段照舊（場景時間 15.7 → 16.4 點）。
- **地球一打開（卡牌最後一張後的第一格滾輪）就關閉**，地球、海洋章節、LOGO 收尾、頁尾全程都是原本手動調的光：
  - 雲層從暖色黃昏變回白灰、地球回到原本的藍、海洋與湖景用自己的參數。
  - 右上角 SCENE TIME 小時鐘隨之隱藏（它在日照關掉時本來就會隱藏）。
- **倒著捲回卡牌**：地球一關閉，日照就回來，時間和原本同一格（16.36 點），整段是捲動位置的函數，沒有任何狀態。
- 換手那一格前後幾乎一樣：當時整個畫面被卡牌蓋住，主場景不畫；唯一看得到的是小時鐘消失。

## 怎麼做的（只動 index1-5）
- 新小幫手 `prototypes/index1-5/world-daylight-off-build.cjs`，在 `build.cjs` 清單裡接在 `light-specks-build.cjs` 後面。
- `scene-daylight.js`（index1-5 自己的複本）新增 `suppressSceneDaylight(flag)`；flag 為真時 `setSceneTime()` 的行為等於「全站日照 = 0」，所以每個用到日照的模組（地球、海洋、湖景、介面）都自己走它們原本的關閉路徑。
- `main.js` 每幀：`suppressSceneDaylight(world.open && worldOff)`。
- **客戶自己的「全站日照」數值不會被改寫**；tuner 的值一直是 1，只是在地球段被暫停。共用的 `js/` 完全沒動，其他頁不受影響。

## 參數
tuner「全站太陽／場景時間 Scene Time」最後一列：**卡牌→地球 關閉全站日照（1 關／0 地球也照跑）**，預設 1。拉到 0 就是原本的樣子（地球段繼續從 16.4 點走到藍調）。

## 驗證
- 滾輪逐格進地球：日照開 → 地球一打開（y 56）關、時鐘隱藏、`data-scene-daylight="off"`；逐格倒回：8 格後世界關閉、日照回來、小時 16.36。
- 地球 y 0–1250、全球段、海洋第 1 章、頁尾：關日照／原本逐點對照。主控台錯誤 0。
- 建置前先 dry-run：產出與來源只差這個小幫手的兩處，保留了另一個 session 剛加的 camera-guide。

## 還原
- 只關效果：把上面那列拉到 0。
- 整個拿掉：從 `build.cjs` 清單刪掉 `'world-daylight-off-build.cjs'`，再跑 `node prototypes/index1-5/build.cjs`。
