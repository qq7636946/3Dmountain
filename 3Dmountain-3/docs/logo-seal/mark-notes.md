# LOGO 水玻璃（材質專家）筆記 — 2026-10-24（客戶調整值 ＋ 品牌藍）

檔案：`prototypes/index1-5/world-logo-mark.js`（介面 A）、`prototypes/index1-5/lab/logo-mark.html`（實驗頁）。
證據：`docs/logo-seal/evidence/mark/`（實驗頁 yaw 0/45/90/180/270、與 ref-6 並排、真實頁面 `real-*`：桌機／手機、前視 lh:0.5、側視 ls:0.35、followDaylight 0／1）。

## 做法
- **幾何是「充氣」，不是擠出倒角**：每一段的高度由「到輪廓的距離 ÷ 該段的局部半寬（中軸線）」決定，超橢圓剖面、輪廓處切線垂直、
  正面隆起（`crown`）、尖端自然收細；正反面共用輪廓頂點，法線解析式計算，邊緣連續。
  圓角的環是依「法線轉過的角度」等分排列（所以 edgeCurve 6、厚度 0.4 這種很陡的邊也不會鋸齒）。
  網格有頂點預算（桌機每片 3 萬頂點、約 14 萬三角形；`edgeSegments` 超過 12 只會把間距收緊一點），分段 yield。
- **材質**：MeshPhysicalMaterial（transmission、ior、attenuation、clearcoat、sheen、dispersion、iridescence）＋ onBeforeCompile：
  每頂點光學厚度、柔邊光＋亮線、內部水紋焦散（有視差，掠視角會淡出）、折射微擾、內部散射光。
- **品牌藍**：SVG 的 path 顏色（`path.color`，b 明顯大於 r）判定藍色片；`images/logo.svg` 本身沒有任何顏色（兩個 path 都是預設黑），
  所以退而求其次：**含最上緣的那一個 path（左上弧形葉片）就是品牌藍**。幾何上多一個頂點屬性 `aBrand`（x＝是否藍片，y＝沿葉片的漸層位置），
  shader 依它混合底色（#009ae1 → #005f9e 漸層）、吸收色／吸收距離、內部藍光、焦散與邊緣光的偏藍。`brandBlue=0` 就是整片清透玻璃。
  若之後 SVG 補上 `fill`，會自動以 SVG 為準（不需改程式）。
- **手機降級**：`look.small` 沒給時，模組自己用世界模組同一個判斷（螢幕短邊 < 700 或記憶體 < 4 GB）；降級＝圓角環 5、約 2.7 萬三角形、關色散與雙面折射。

## 渲染器假設（整合）
- 折射的是同一個場景裡「不透明」的物件；NoToneMapping、sRGB 輸出；`bgDisplay=1` 表示背景是顯示色直接寫入（世界的 ShaderMaterial 就是）。
- 玻璃輸出 alpha 恆為 1（`bgAlpha=0`）。環境貼圖請讓 +Z 半球也有亮度，下半球不要純黑。

## 已知限制
- 客戶這組值在滑桿極端（size 1.6、厚度 0.4、焦散 1.5、邊緣亮線 3）：邊緣亮線在掠視角是次像素寬，桌機偶爾呈點狀；焦散在正面偏強。
- 脊柱頂端兩個尖角有極小的細節瑕疵（放大 2 倍才看得到）。
- `size` 1.6 讓符號比整合面板的「符號 大小倍率 1.0」再大 60%，手機直式幾乎填滿寬度。
