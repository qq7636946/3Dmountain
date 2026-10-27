# index1-5 基準量測 2026-10-25（優化前）

環境：RTX 4070、無頭 Chrome（ANGLE/D3D11）、120 Hz（每幀 8.33 ms）；本機伺服器未壓縮、no-store；每次冷快取。桌機 1440×900（DPR 1）、壓力 2560×1440、手機 390×844 模擬（另測 CPU 放慢 4×）。全部 0 頁面錯誤。
原始資料：`.qa/index1-5/perf-baseline-*/`；工具：`.qa/index1-5/perf-baseline-tools/`（perf-baseline.cjs、analyze-flow.cjs、report-tables.cjs）；表格：`.qa/index1-5/perf-baseline-tables.md`。

## 熱點（依影響排序）

Boot main thread (worst on phones). Phone CPU 4×: ready takes 10.3–14 s, and long tasks add 5.9 s beyond 50 ms. Desktop: a 1.4 s task about 5 s in. In order:
- Synchronous shader links on first render, about 1.1–1.3 s. The MeshPhysicalMaterial with clearcoat, iridescence and dispersion takes 616–669 ms, and the uWaterRise + uEnv* material takes 316–374 ms. They miss the compileAsync warm-up.
- The JS stone-normal texture in createReferenceLogoGlass: 324 ms desktop, 1.4 s at 4×.
- The CPU terrain/erosion build: reliefMass about 1 s, alpine-erosion about 1.3 s, erosionField, hash.
- The first big texture upload: 104–145 ms.
None of these change pixels if moved to async compile, a worker or a pre-baked asset.

GPU frame cost on desktop is dominated by the main MSAA×4 RGBA16F scene pass. It is 1.4–3.1 ms of a 2.0–3.5 ms frame at 1440×900. At 2560×1440, ascent/aerial/FOUR PATHS reach 5.5 / 6.2 / 7.8 ms p50 (p95 7.2 / 8.2 / 9.0 ms), which is at or over the 8.33 ms 120 Hz budget. That is the only GPU-bound section on desktop. Next are the full-res RGBA16F post passes (1.2–1.6 ms in the word/logo/flight frames), the 2048² RGBA8 target that is re-rendered in hero/logo/flight (0.3–0.6 ms), and in the world the LOGO lake (2.9–3.3 ms: rt 1080x675 1.4–1.55 ms plus two MSAA×4 targets) and the dive (2.4–2.6 ms). Everything still fits 120 Hz at 1440×900 on the RTX: flow p95 is 8.4 ms everywhere.

GPU memory: about 709 MB at the footer on desktop at DPR 1, and 1.30 GB at 2560×1440, from three live renderers. The main renderer keeps 365 MB for the whole session, including after the journey is hidden. That covers a 4096² RGBA8 plus 4096² depth target (128 MB, almost certainly a static shadow map), a 2048² pair (32 MB) and MSAA HalfFloat color + depth (59 MB). Cards add 83 MB and the world lake 262 MB, including MSAA×4 at 1440x900 and 1080x675 (93 MB). Phone total is 251 MB.

Phone per-frame CPU from layout reads and DOM writes (CPU 4×). burst+letters and the logo flight run at p50 16.7 ms (60 fps), the bridge at p95 41.7 ms, the ocean at p50 16.6 ms. Profiles:
- world: getBoundingClientRect 3.15 s self (world-ocean-photos.js:61 calls it every frame); the scroll handler at finnovation-world.js:718 2.35 s; light-specks onBeforeRender 1.3 s; section-motion apply/setProperty 1.0 s; '(program)' style/layout 17.4 s over a 53 s run.
- journey: alpine-ui updateLabels 2.5 s (plus the 149 ms task at the bridge); opening-portal `wanted` 2.35 s, which reads innerWidth/innerHeight and builds keyOf() every frame, a likely forced layout; '(program)' 7.3 s over 36 s.
At 1× this is only 0.4–1.4 ms per frame, so it is invisible on desktop.

First-pass hitches: lazy preparation on the main thread while the visitor scrolls, on every profile, 0 on the way back.
- Card slider creation at p≈10.5–10.9: OGL program link plus a 1024² Pexels texImage2D, 54–102 ms on desktop, 81 + 88 ms at 4×.
- LOGO glass-mark GLB prepareBlenderModel during the ocean: 72–75 ms desktop, 410–490 ms at 4×.
- Principles first render: sync link of 53 ms plus a 11–111 ms texture upload.
- World entry first frame: 142 ms desktop, 483–566 ms at 4×.
- Opening at p≈0.9: 42 ms.

Phone GPU path (only checkable on the RTX):
- Per-frame GPU stays at 2.0–2.4 ms across the journey at only 0.51 MP, against 1.3 MP on desktop, so it is a fixed cost (0.49M terrain tris, final canvas pass 1.3–1.6 ms in hero/opening) rather than pixel-bound. Real mobile GPUs are much slower, so treat the pass structure, not the milliseconds, as the guide.
- Waste specific to phones: the world LOGO lake still uses MSAA×4 (23.5 MB, plus a 1.9 ms 244x528 RGBA16F pass).
- The cards canvas is hard-coded to DPR 1.75: 682×1477 = 1.0 MP, twice the main scene, with 1024² photo textures (75 MB).
- The cards canvas also keeps drawing (1.7–1.9 ms) under the cloud deck at the top of the world.

Network:
- 148 requests, 13.5 MB on desktop and 10.0 MB on phone, uncompressed. 2.24 MB of text would be about 0.63–0.75 MB with brotli/gzip.
- 81 separate JS module requests.
- logo3d-tuned.glb is 2.1 MB on both tiers.
- 1.34 MB of fonts (18 Noto Sans TC slices, 16 during boot).
- 11 Pexels photos at 1024² (834 KB) also go to phones.
- The four ocean chapter photos are each downloaded twice (344 KB) and logo.svg twice.
- About 3.4 MB of world/card assets are prefetched during the journey. That is good for hitches but costs bytes on mobile.

Measurement caveats for the optimisation team:
- GPU timer-query numbers at light load are noisy, likely because the GPU drops to lower clocks. The same spot measured in two runs differed: canyon 2.0 vs 2.8 ms, ocean ch3 1.84 vs 0.17 ms. Compare medians over at least two runs.
- The desktop profile is DPR 1, so use 2560×1440 as the Retina proxy.
- flow.cjs --phone stops inside the card strip: its stall check (key = p, open, y) ignores the strip clock, so the phone run never reaches the world. The phone numbers here come from perf-baseline.cjs --mode wheel instead.
- flow.cjs --w 2560 --h 1440 stopped in the cards on the way up for the same reason.

## 各段幀時間

### 開場 hero/ch1-2 (p0–1)
- 桌機：Real wheel down: p50 8.3 / p95 8.4 / worst 41.7 ms, 1 frame >25 ms (p 0.908, first pass only). Wheel up is clean (worst 8.5). Parked GPU p50 2.47–2.94 / p95 4.14 ms. Of that, main MSAA×4 HalfFloat 1440x900 is 1.5 ms, full-res HalfFloat post 0.5–0.9 ms and a 2048² RGBA8 target 0.27–0.39 ms. Page JS 1.0 ms/frame, 24 draws, 0.06M tris.
- 桌機大視窗：2560×1440 wheel down: worst 33.3 ms (1 >25). Parked GPU 2.93 / 3.94 ms.
- 手機：390×844 wheel down: p50 8.3 / p95 8.4 / worst 33.4 ms (1 >25). Wheel up is clean. GPU on the RTX at DPR 1.25: 1.80–1.92 / 3.07 ms, and the final canvas pass alone is 1.3 ms. 10 draws. With CPU 4×: p50 8.4 / p95 16.7 / worst 50 ms, 2 frames >25, no long tasks. The world-entry style first frame at p 0 is 483 ms under 4×.

### 爆開＋字母 burst+letters (p1–3.6)
- 桌機：Wheel down/up: p50 8.3 / p95 8.4 / worst 8.5 ms, clean. GPU p50 2.5–2.95 / p95 4.4 ms. In the word/logo frames the full-res HalfFloat post passes are 1.15 ms and MSAA is 0.6–1.8 ms. Page JS 1.3–1.4 ms/frame (highest in the journey), 47–52 draws.
- 桌機大視窗：Clean. GPU 2.71–3.79 / 4.80 ms.
- 手機：Wheel down/up is clean (worst 9.3). GPU 2.0–2.3 / 3.2 ms (scene rt 487x1055 HalfFloat about 2 ms). JS 0.9–1.0 ms. With CPU 4×: p50 16.7 / p95 25.1 / worst 41.6 ms and 31 frames >25, so it cannot hold 120 Hz and is CPU-bound (drops/letters update, updateBrandMark, layout reads).

### LOGO 前飛＋馬賽克 flight (p3.6–4.7)
- 桌機：Wheel down: worst 16.7 ms, no >25. Wheel up is clean. GPU p50 3.17–3.45 / p95 4.68 ms (highest in the journey at 1440). Full-res HalfFloat post 1.4–1.6 ms, MSAA 0.8–1.4 ms, 2048² target 0.6 ms. JS 1.2–1.4 ms, 54 draws.
- 桌機大視窗：Clean (worst 9.0). GPU 4.55–4.89 / 5.94 ms.
- 手機：Clean (worst 8.5). GPU 2.2–2.44 / 3.55 ms. With CPU 4×: p50 16.7 / p95 25.1 / worst 33.4 ms, 12 frames >25.

### 山谷＋峽谷 valley+canyon (p4.7–11)
- 桌機：Wheel down: worst 100 ms, 2 frames >25 at p 10.50 / 10.75, first pass only. These are the card-slider (OGL) creation: a sync shader link plus a 1024² Pexels texImage2D (54 + 72 ms tasks). Wheel up is clean. GPU p50 2.0–2.86 / p95 3.4–3.9 ms (MSAA scene pass 1.8 ms), 39 draws, 1.51M tris.
- 桌機大視窗：Wheel down: worst 75 ms (2 >25, same p 10.33/10.45). GPU 3.64–4.45 / 5.35 ms.
- 手機：Wheel down: worst 100.1 ms (2 >25, same slider hitch, 82 ms long task). Up is clean. GPU 2.03–2.12 / 3.2 ms, 26 draws, 0.49M tris. With CPU 4×: p50 8.4 / p95 16.8 / worst 116.6 ms, 11 frames >25, 2 long tasks (97/117 ms; slider at p 10.71/10.78, 81 + 88 ms).

### 升空＋FOUR PATHS (p11–max)
- 桌機：Wheel down/up is clean (worst 8.6). GPU p50 2.54 → 3.17 → 3.44 / p95 5.16 ms, and the MSAA×4 scene pass grows to 3.1 ms at FOUR PATHS. 37–42 draws, 1.55M tris.
- 桌機大視窗：Wheel is clean, but the GPU is the heaviest of the whole page: ascent 5.50 / 7.18, aerial 6.16 / 8.17, FOUR PATHS 7.78 / 9.00 ms. That is at or over the 8.33 ms 120 Hz budget at Retina-class pixel counts.
- 手機：Clean. GPU 2.03–2.12 / 3.1 ms. With CPU 4×: p50 8.4 / p95 16.7 / worst 133.3 ms (1 >50, not tied to a long task).

### bridge 馬賽克→卡牌
- 桌機：Wheel down: worst 33.3 ms (2 >25, at transition 0.03 and 0.93). Up is clean.
- 桌機大視窗：Wheel down: worst 25 ms. Up is clean.
- 手機：Wheel down: worst 25 ms. Up: worst 16.7 ms. With CPU 4×: p50 8.4 / p95 41.7 / worst 66.7 ms, 34 frames >25 and 5 >50. This is the worst sustained CPU section: alpine-ui updateLabels caused a 149 ms long task at transition 0.97.

### 卡牌 strip (portfolio canvas)
- 桌機：Wheel is clean (worst 8.6). flow reports 7 down / 12 up 'stalls' of 141–183 ms: input arrives but the strip clock holds, probably notch snapping. That is a feel item, not a cost. GPU 2.1 / 3.19 ms, of which 1.79 ms is one 1440x900 RGBA8 target. 11 draws, JS 0.4 ms.
- 桌機大視窗：Clean. GPU 2.32 / 3.35 ms.
- 手機：Clean. The cards canvas renders at DPR 1.75 (682×1477, 1.0 MP, twice the main scene). GPU 2.16 / 3.09 ms. With CPU 4×: worst 191.7 ms (1 long task of 201 ms on entry, not attributed).

### 世界：雲層＋地球 clouds+planet
- 桌機：Wheel down: worst 41.7 ms. The world-entry first frame is 141.8 ms (worldprof). Up is clean. GPU: cloud deck 0.10, planet 0.13–0.17 ms. At y=4 the cards canvas is still drawing (1.5–1.8 ms) because covering starts at 0.4 × the clouds height.
- 桌機大視窗：Wheel down: worst 33.4 ms. GPU 0.30–0.32 ms.
- 手機：Wheel down: worst 24.9 ms. GPU 0.03–0.05 ms (plus cards 1.67–1.88 at the top). With CPU 4×: worst 91.6 ms, 3 long tasks (max 116), and a 566 ms first frame at world entry.

### 世界：俯衝 dive fog+mosaic
- 桌機：Wheel down: worst 33.3 ms (1 >25). Up is clean. GPU 2.41–2.6 / 3.86 ms: canvas pass 1.35–1.49, full-res RGBA8 target 0.84–0.99, 512² 0.08. 11 draws.
- 桌機大視窗：Wheel down: worst 16.7 ms. GPU 2.92–3.03 / 4.06 ms.
- 手機：Wheel down: worst 33.4 ms (1). GPU 2.36–2.42 / 3.6 ms (canvas 1.4, 487x1055 rt 0.8). With CPU 4×: p95 16.7 / worst 41.7 ms, no long tasks.

### 世界：海洋章節 ocean
- 桌機：Wheel down: worst 108.3 ms (2 >25 at y 5105 / 8473, first pass only). (1) world-logo-mark prepareBlenderModel (GLB toNonIndexed/applyMatrix) ran during the ocean as a 72–75 ms task. (2) The principles first render: sync shader link 53 ms + texture upload. Up is clean. GPU is spiky: p50 0.17–1.84 / p95 3.1–3.4 ms (canvas 1.1–1.6, 512² 0.1–0.3). Two runs at the same spot disagree, which looks like video/reflection frames.
- 桌機大視窗：Wheel down: worst 100 ms (2 >25 at y 7709 / 13301). GPU 0.38–0.66 / 2.42 ms.
- 手機：Wheel down: worst 91.7 ms (2 >25, 80/95 ms long tasks). GPU 0.07–1.88 / 3.76 ms. With CPU 4×: p50 16.6 / p95 25 / worst 533 ms, 34 frames >25. Long tasks: 410–490 ms prepareBlenderModel at y≈4770, plus 144 ms. Per-frame getBoundingClientRect (world-ocean-photos.js:61) and the scroll handler (finnovation-world.js:718) dominate the CPU.

### 世界：principles
- 桌機：Wheel down: worst 24.9 ms. Up is clean. GPU 0.08 ms (1 draw).
- 桌機大視窗：Clean. GPU 0.16 ms.
- 手機：Wheel down: worst 25 ms. GPU 0.03 ms. With CPU 4×: worst 141.6 ms. Long tasks of 115 ms (sync compile 54 + texSubImage2D 48) and 124 ms (texSubImage2D 111, the c-bg-v1.webp upload).

### 世界：LOGO 湖 wave/spin/hold
- 桌機：Wheel is clean (worst 8.5). GPU: wave 0.31; spin and hold 2.89–3.33 / 4.14 ms. That breaks down as rt 1080x675 HalfFloat 1.4–1.55, canvas 0.45, MSAA×4 1440x900 0.35, MSAA×4 1080x675 0.25–0.34. 11 draws, 0.48M tris.
- 桌機大視窗：Clean (up worst 9.2). GPU 3.97–4.12 / 5.2 ms.
- 手機：Clean. GPU: wave 0.12; spin/hold 2.58–2.64 / 3.72 ms. The 244x528 HalfFloat target alone costs 1.9 ms (shader/vertex-bound, 0.24M tris). The lake still uses MSAA×4 on phone. With CPU 4×: p95 16.7 / worst 41.7 ms.

### 頁尾 footer
- 桌機：At maxY the lake is still drawn underneath. GPU 2.84–3.34 / 4.05 ms, the same as the lake hold. flow never labels a separate footer at 1440×900 because footer top 16030 > maxY 15969.
- 桌機大視窗：GPU 4.15 / 5.31 ms. flow wheel down: one 333 ms 'stall' at the very end (y 23931).
- 手機：Wheel down/up is clean. The world stops drawing at the footer (0 GPU, CPU 0.2 ms). With CPU 4× it is clean.

## 載入
Time to ready, cold browser each run:
- Desktop 1440×900: body.is-ready in 6.1–7.9 s (check.cjs 7.8 s); journey usable (__MONTIS_STUDY__.ready) in 10.7–14.0 s.
- 2560×1440: 7.0–7.3 s / 12.5–12.7 s.
- Phone 390×844: 3.2–3.8 s / 6.5–8.8 s. check.cjs's phone run reuses the same browser, so its shader cache is warm.
- Phone with CPU 4× (applied before navigation): 10.3–14.0 s / 14.1–19.4 s.
- Flights from check.cjs: 5.56 in 767 ms, max in 834 ms on both. The only warning is a D3D X3595 "gradient instruction in a loop" from one shader on both profiles.

Bytes, measured from navigation to the footer (fly through every section, cards, world, jump to the end). Uncompressed local server:
- Desktop, 148 requests, 13.54 MB transferred (12.33 MB decoded): image 40 files 6,555 KB; js 81 files 2,263 KB; model 1 file 2,121 KB; font 20 files 1,337 KB; video 1 file 1,310 KB; css 3 files 223 KB; html 51 KB.
- Desktop by phase: boot 94 requests / 5,162 KB; journey 36 / 3,392 KB (world textures and Pexels card photos prefetched during the journey); world 18 / 5,307 KB.
- Desktop by host: local 98 / 11,434 KB; fonts.gstatic 18 / 1,201 KB (Noto Sans TC slices, 16 during boot); images.pexels.com 11 / 834 KB (1024² card photos); cdn.jsdelivr 20 / 325 KB (three, OGL, gsap, addons); fonts.googleapis 68 KB.
- Phone, 148 requests, 9.99 MB: image 3,609 KB, video 619 KB (ocean-loop-480), everything else the same. Boot 3,714 KB, journey 2,458 KB, world 4,052 KB.
- The phone tier already swaps terrain textures to 512, earth-asia-m, ocean-1280, islands -small and the 480p video. It still loads logo3d-tuned.glb (2.1 MB), c-bg-v1.webp (478 KB), clouds-2k (345 KB), earth-2k (254 KB), all 11 Pexels photos at 1024² and the 1.2 MB of Noto Sans TC fonts.
- Text resources: the 65 local js/css/html files total 2,242 KB raw. On a compressing host that would be about 750 KB gzip or 628 KB brotli (estimate from the local files).

Biggest files on desktop: logo3d-tuned.glb 2,121 KB (world); ocean-loop-720.mp4 1,310 KB (world, 206 range request); earth-asia.jpg 867 KB; valley-islands-form-v3.webp 642 KB; main.js 575 KB (189 KB gzip); aerial_grass_rock-normal-1024.webp 549 KB (boot); ocean-2400.jpg 488 KB; principles c-bg-v1.webp 478 KB; coastal-slate-1024.webp 445 KB; aerial_grass_rock-color-1024.webp 411 KB; clouds-2k.jpg 345 KB; erosion-height-512.png 282 KB.

Problems:
- Loaded twice on both tiers: the four ocean chapter photos (responsibility-team-800, governance-architecture-800, strategy-growth-800 and strategy-derivatives-800, each ×2, 344 KB wasted) and logo.svg ×2.
- Nothing failed.
- media/logo.mp4 (18 MB, preload=none) was never requested, which is correct.

Network numbers are cold-cache and uncompressed; they are not production transfer sizes.

## 長任務
- Boot, desktop: about 1.4 s (1,396–1,415 ms) at about 5.0 s after start; phone CPU 4×: 1,532 ms at about 8.7 s. Most of it is synchronous shader-link waits at first render (getUniforms → getProgramInfoLog). The two big programs are a MeshPhysicalMaterial (uniforms include clearcoat, iridescence, dispersion, specularColor; one of main.js's drop/orb/splash/cluster/droplet materials) at 669 ms (616 ms on phone ×4), and a material with uWaterRise, uWaterRiseColor and uEnv* (light-specks.js / main.js) at 374 ms (316 ms). Smaller ones: uEnv* (opening-portal / opening-world) 38–40 ms, forward-mosaic uInvProj 20 ms, uFocus/uA/uTint 39 ms, opening-lunge-blur uLunge* 21 ms, 'Water-born rising light' 33 ms, PMREM / SphericalGaussianBlur 21–29 ms. The compile runs in the GPU process, so CPU throttling barely changes it.
- Boot, desktop: 475–567 ms at about 0.3 s; phone CPU 4×: 1,883 ms. createReferenceLogoGlass → stoneNormalTexture builds the stone normal map in JS noise (jsFbm/jsNoise/jsHash/hash2, water-logo-reference-glass.js:134–194): 324 ms desktop and 1,396 ms at 4×. Also getContext 74 ms.
- Boot terrain build slices: 110–185 ms ×3 on desktop and 128–297 ms ×4 at CPU 4×. Over the whole boot, reliefMass (water-canyon-watershed-463.js:452) takes 997 / 1,085 ms self; erodeAlpineGrid, boxMean and distTo (alpine-erosion.js) about 1.3 s; erosionField 336 ms; latticeHash; hash (water-journey-scene-463.js:179) 273–551 ms.
- Boot, first big texture upload: texSubImage2D 104 ms desktop / 145 ms at CPU 4×, inside 140–201 ms tasks at about 10.9 / 13.9 s.
- Phone CPU 4× boot overall: 35 long tasks, longest 2,022 ms, 5.9 s in total beyond 50 ms. Desktop boot: 7–19 long tasks, longest 1.4–2.2 s.
- First pass through the journey, p about 10.5–10.9 (canyon): the card strip slider is created (portfolio-slider.js createSlider → OGL from cdn.jsdelivr +esm). That is a sync getProgramParameter of 29–31 ms plus a texImage2D of a 1024² Pexels photo at 67–68 ms. Tasks of 54 + 72 ms on desktop and 81 + 88 ms on phone ×4; flow shows 75–100 ms hitches there on every profile. The slider's warm() later uploads another 18–128 ms (texImage2D) on idle.
- First pass through the world, ocean at y about 4,770–5,050: world-logo-mark.js prepareBlenderModel processes the LOGO GLB (toNonIndexed, applyMatrix4, rebuild) on the main thread. 72–75 ms on desktop, 410–490 ms on phone CPU 4×, which gives the 533 ms worst frame.
- First pass, ocean → principles at y about 7,900–8,500: the principles first render does a sync shader link (53–54 ms) plus texSubImage2D (11 ms desktop; 48 and 111 ms at 4×, the c-bg-v1.webp upload). Tasks of 69 ms on desktop and 115 + 124 ms at 4×.
- World entry first frame (y = 0): 141.8 ms on desktop, 483–566 ms on phone CPU 4×. No JS attribution, so most likely GPU / compile.
- Bridge at transition 0.97, phone CPU 4×: a 149 ms task in alpine-ui.js updateLabels.
- Cards entry, phone CPU 4×: a 201 ms task, not attributed.
- On the second (upward) pass, desktop, phone and stress all have 0 hitches. Every hitch is a first-pass preparation cost.

## 記憶體
Per-canvas GPU memory estimate: level 0 × format, ×4/3 when mipmapped, × samples for MSAA. Driver padding is not counted.

Desktop 1440×900 @1, from ready to footer:
- main 350 → 365 MB the whole session. The main renderer stays alive and keeps all of it while the world is shown.
  - renderer.info: geometries 73 → 79, textures 49 → 50, programs 50 → 51. Live GL objects: 54 textures, 245 buffers, 27 FBOs.
  - Largest allocations:
    - a 4096² RGBA8 texture plus a 4096² depth renderbuffer: 128 MB, almost certainly a shadow map. It is never re-rendered in the sampled sections.
    - a 2048² RGBA8 + depth pair: 32 MB (re-rendered in hero/logo/flight at 0.3–0.6 ms GPU).
    - MSAA×4 RGBA16F 1440x900: 39.6 MB, plus its MSAA depth: 19.8 MB.
    - a 1775x1109 RGBA16F mipmapped target: 20 MB, plus a 7.5 MB depth texture (logo glass capture at ×1.23).
    - four or more 1440x900 RGBA16F post targets: 9.9 MB each.
- cards (portfolio canvas, created at about p 8.9): 83 MB. 20 textures, including six 1440x900 and many 1024² RGBA8 at 4–4.9 MB each.
- world: 45 MB at entry → 78 MB in the ocean → 262 MB once the LOGO lake is built. The lake adds MSAA×4 1440x900 RGBA16F (39.6 MB) plus depth (19.8), MSAA×4 1080x675 (22.2) plus depth (11.1), a 2400x1431 mipmapped texture (17.5), 2048x1024 ×2 (10.7 each) and a 3186x2549 R8 (10.3).

Totals:
- Desktop: 350 MB at ready, 492 MB at journey end, 525 MB in the ocean, 709 MB at the footer.
- 2560×1440: 566 → 793 → 1,304 MB (main 579, cards 151, world 574).
- Phone (DPR 1.25, 487x1055):
  - main 62–64 MB (no MSAA, no shadow map, 37 textures, 40 programs).
  - cards 75 MB. The canvas is 682x1477 because createSlider hard-codes dpr 1.75, and it holds 11+ 1024² RGBA8 photos at 4 MB each.
  - world 17 → 29 → 111 MB. The phone lake still allocates MSAA×4: 487x1055 RGBA16F 15.7 MB + depth 7.8 MB + 244x528 3.9 MB, despite mobile sceneSamples being 0.
  - Total 62 → 157 → 251 MB.

JS heap: desktop 48–79 MB, stress 49–71 MB, phone 26–41 MB. No growth trend across sections.

DOM: 730 nodes at start, 779 once the cards and world mount.

Draws per frame: desktop 24–54 (journey), 11 (cards), 1–11 (world). Phone 10–41 / 8 / 1–11. Triangles: canyon 1.51M desktop vs 0.49M phone; lake 0.48M vs 0.24M.

Note: world.state does not expose the world renderer, so the world and cards figures come from GL-level counting, not renderer.info.
