# Highland World — 2026-10-22

把定稿圖（`../highland-keyvisual-20261022/`，「Between land & light.」）的島，用 Blender 延伸成一整片山脈：海灣、群山到地平線、海灣谷地、四條分岔的河道（Four Paths）、一段峽谷。**材質與設計完全沿用定稿圖**。獨立原型，**沒有修改正式網站、定稿圖或材質研究頁**。

## 成品（renders/）

| 檔案 | 說明 |
|---|---|
| `highland-world-01-close` | 原本的近景構圖：島完全不變，背後多了延伸的群山與霧（另有含標題版 `-caption.jpg`） |
| `highland-world-02-four-paths-aerial` | 高空：四條河道穿過山脈，匯入海灣，島在中間，遠方是海與外島（對應網站圖一的規模） |
| `highland-world-03-loch-valley` | 主谷：沿海灣谷地往內看，兩側層狀岩峰（對應圖二） |
| `highland-world-04-canyon` | 峽谷：B 河道的峽谷內，高聳的層狀岩壁、岩層平台上的苔（對應圖三） |
| `contact-sheet.jpg` | 四張並排 |
| `world-map-top-down.png` | 整個世界的俯視地形圖（上 = 南／海） |
| `blender-preview-paths.png` | 直接用 Blender（EEVEE）開 .blend 算出的預覽，證明場景可用 |

PNG 3436×1640；JPG 同尺寸。

## 2026-10-22 晚：五條河匯流看得清楚（客戶：五條河流匯集應該要調整成這樣）

- 河道位置、島、海灣都**沒有移動**；只改匯流處，讓從空中（網頁 PERSPECTIVE、STRATEGIES 與 Blender 的 paths 鏡頭）看得到五條河匯成一點：
  - 匯流點（主河＋A／B／C）挖一個半徑約 78 的水潭，D 河口一個約 58 的水潭（俯視圖上的兩個深色圓點）。
  - 五個河口加寬（主河 36→44、A 30→40、B 28→38、C 30→40、D 30→38），上游寬度不變。
  - 匯流點周圍 1250 單位內的山「順勢降向匯流點」（高度 × 0.14 → 1，邊緣不規則），原本擋住匯流點的是峽谷北段西側崖頂（高約 430–500），現在兩個空拍鏡頭到匯流點與五個河口的視線全部暢通（以高度場逐點做視線檢查）。峽谷鏡頭的岩壁略低，仍是深峽谷。
- `shots.json`／.blend 新增 `persp` 鏡頭（= index1-4 PERSPECTIVE 停留畫面），可直接在 Blender 檢查。`world-meta.json` 多了 `confluence` 欄位。
- 圖：`renders/confluence-before-after-paths.jpg`、`confluence-before-after-blender.jpg`、`confluence-top-down-compare.jpg`、`confluence-02-paths-aerial.jpg`、`confluence-05-perspective.jpg`。舊的 `highland-world-0*`、`world-map-top-down.png` 是修改前的畫面。
- **index1-4 網頁沒有更新**（它用自己打包的高度圖 `highland-1-4/assets/*.dz`）；要同步需重新打包高度圖並讓光線改走新的河口。
- 修改前備份：`_archive/backups/highland-world-blender-before-confluence-20261022/`（blender、assets、renders 全部）。復原＝把三個資料夾複製回來。

## 怎麼做的

1. **Blender**（`blender/build_world.py`，Blender 5.2 無頭執行，約 50 秒）
   - 從 `_archive/models/snowy_mountain_v2_-_terrain` 的原始網格，以 BVH 射線取樣出 1025² 高度（研究版是 513²），與研究版比對誤差 RMS ≈ 0.04 原始單位。
   - 島放回定稿圖的原位（world x = 60·mx、z = −60·my、高 = 68·h − 32），海岸改成圓角＋不規則邊，從空中不再是方形島。
   - 周圍 4800×4800 的山脈：底層用脊狀雜訊，主體是從**同一份原始地形**隨機取窗、旋轉、縮放、鏡射後以平滑最大值拼合（約 100 塊），所以每條山脊都保有原素材的侵蝕特徵；越遠的山越高。
   - 海灣與南邊海岸留海；主谷＋四條分岔河道＋西側海灣谷以各自的距離場刻到海平面以下，谷壁加雜訊（扶壁、凹進），谷與谷用平滑聯集相接（沒有接縫）。B 河道中段先把山整體抬高，再切出峽谷。
   - 輸出：`assets/world-height-4097.bin`（Float32，1.17 單位／格，row 0 = z +1200）、`world-height-1025.bin`、`world-meta.json`（網格、河道、授權）、`shots.json`（四個鏡位）、`blender/highland-world.blend`（地形、海面、四台相機、近似材質）、`assets/highland-world-513.glb`。
2. **成像**（`index.html` + `world.js` + `terrain-material-world.js`）：定稿圖同一套材質與岩層刻劃、天空、霧、銀色水面。地形切成 300 單位的區塊，依離鏡頭距離決定密度（主體處與定稿圖同為 1.17 單位），邊緣有裙邊，不同密度不會裂縫；世界外以鏡射延續，地平線不會斷。原島的烘焙侵蝕法線只用在島內。

開啟：`http://localhost:5178/prototypes/highland-world-20261022/?shot=close|paths|valley|canyon`（`&text=0` 無標題、`&light=overcast` 陰天）。每張約 170 萬頂點、250 萬三角面，是出圖用設定，不是手機即時版。

重建：`blender -b --factory-startup --python blender/build_world.py`；Blender 預覽：`blender -b blender/highland-world.blend --python blender/render_preview.py -- Cam_paths out.png`。

## 注意

- .blend 裡的材質是**近似版**（坡度苔草＋雜訊岩色）；定稿外觀是 three.js 那一套（岩層刻劃、平台苔、雨痕等），兩者不同。要在 Blender 內做到同樣外觀需另外製作節點材質。
- 若要放進網站，需要另做輕量版（降低網格與高度圖解析度）並經同意。

## 授權

地形來源 “Snowy Mountain V2 - Terrain” by artfromheath（CC BY 4.0，發布時須保留署名與授權連結）；延伸地形同樣是其衍生作品。岩壁／草地貼圖 Poly Haven（CC0）；three.js r170（MIT）。
