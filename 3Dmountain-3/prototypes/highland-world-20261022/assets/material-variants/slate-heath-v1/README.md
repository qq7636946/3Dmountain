# Highland World — 減綠色彩貼圖 v1

使用內建 imagegen，以現有 aerial_grass_rock 色彩貼圖製作低綠度版本；未修改原場景、原貼圖或材質程式。

檔案：slate-heath-basecolor-v1.png。灰岩／灰褐地面為主，保留少量低彩度橄欖苔色。這是色彩貼圖樣張，不是已烘焙的全世界 UV 貼圖，也不是完整 PBR 組；未驗證無縫拼接或與原法線逐像素配準。請勿當成高度圖或法線圖。

目前 terrain-material-world.js 使用程序調色，grassColor 只進入 detail() 的亮度運算；僅換此圖不會直接採用本圖的灰岩配色。後續接入需調整 grass 調色與 uMoss 混合量，並保留現有岩層、相機、水面與模型。依使用者五小時額度剩 15% 收尾的要求，本輪停在材質圖交付，尚未整合與場景驗證。

來源色彩貼圖：Poly Haven Aerial Grass Rock（CC0），本檔為 AI 編輯衍生色彩版本。

## 生成方式
內建 image_gen，非 CLI。輸入為專案 aerial_grass_rock-color-2048.webp。

## 完整提示詞

Use case: precise-object-edit.
Asset type: a single square terrain base-color/albedo texture for a Three.js mountain scene, not a landscape render and not a contact sheet.
Image 1 is the edit target: an existing overhead scanned rocky grass/moss color texture.
Primary request: reduce its dominant green, making this a more restrained cool-grey stony heath with small, desaturated grey-olive moss patches. Aim for approximately 65% neutral slate-grey mineral/earth tones, 20% muted taupe dry ground, and only 15% subdued grey-olive colour. These percentages are art direction, not exact segmentation.
Preserve the source image's top-down orthographic framing, positions of stones, tiny cracks, ground grain and overall spatial layout as closely as possible; change primarily color, do not add new large rocks or new surface shapes. Keep the source's detailed texture frequencies. Retain subtle natural variations, not a flat desaturation.
Flat diffuse albedo illumination, no baked highlights, no cast shadows, no vignette, no sky, no mountains, no horizon, no lettering or borders. Edge-to-edge, square, seamless-friendly texture with no obvious focal point. Opaque background. Request native 2048x2048 if available. Only output the one texture image.

