# index1-5 優化審查：67 項發現（四位審查員）2026-10-25

每項：影響桌機畫面？／僅手機？／風險／工作量／預期收益。證據與做法見 `.qa/index1-5/perf-audit-results.json`。

## 載入與素材
What the page costs to load today. Nothing was edited or built; I only read files and measured sizes (gzip via node/CLI, minified sizes with the esbuild 0.25.10 binary already in %TEMP%, output to stdout only).

BEFORE THE FIRST FRAME (the loader hides only after this): about 3.0 MB on desktop and about 1.5 MB on phones.
- The page's own JS: 43 modules, 1,564,820 B raw / about 549 KB gzip. main.js alone is 588,903 B raw / 191 KB gzip, and about 38% of it is comments and whitespace.
- From jsDelivr: three r170 min plus 13–19 unminified addon files, an estimated ~240 KB gzip (not measured).
- Logo worker bundle 33 KB gzip, CSS 28 KB gzip, DM Sans 63 KB.
- Terrain textures: 2,082,970 B on desktop (lite set on phones: 600,065 B).

The terrain textures are about 70% of desktop first-paint bytes, yet they are requested last. Downloads start only at main.js:6457, after about 6,400 lines of synchronous setup. The hero is then held until all 9 terrain files and the whole canyon build finish. One failed texture sends the whole page to text mode. Modules are discovered 4 levels deep (36 / 12 / 7 per level), and only three.js and main.js are preloaded. Three modules load twice because they are imported with different query strings. Every build stamps every module with a new Date.now() version, and the shipped files currently carry 9 different hand-made or partial stamps.

LOADED LATER, ON APPROACH (this part is already good):
- Portfolio: OGL, the slider, and 11 Pexels hotlinks at 1024²,

- **terrain-early-start** — First frame waits for terrain textures that are requested last; start them at script start (and stop one failed texture from killing the 3D page)（桌機畫面：identical；風險 low；small）
  - 收益：First frame comes earlier by min(setup time, texture download time). Estimates: desktop ~0.3–0.5 s on broadband (2.08 MB); phones ~0.3–1 s on 4G with a slow CPU (0.60 MB). Also removes the 'one flaky texture → text mode' failure on phones.
  - 做法：Add a new helper, prototypes/index1-5/loading-build.cjs, at the end of the helper list in build.cjs:29. It patches main.js to (1) import { preloadIndex15Terrain } from './index1-5-terrain.js'. After rewire, the helper must assert that this URL is identical to the one water-journey-scene-463.js:4 uses; a different ?v= creates a second module instance with its own `sets` cache and downloads everything twice. (2) Right after `const DROPLET_LITE = matchMedia(...)` (main.js:588), call `const i15Terrain = preloadIndex15Terrain(THREE, DROPLET_LITE); i15Terrain.catch(()=>{});`. getSet() caches by lite
  - 檔案：prototypes/index1-5/js/main.js、prototypes/index1-5/js/water-journey-scene-463.js、prototypes/index1-5/js/index1-5-terrain.js、prototypes/index1-5/build.cjs
- **boot-js-minify** — Strip comments and whitespace from generated modules at build time (identifiers kept)（桌機畫面：identical；風險 low；medium）
  - 收益：About −185 KB gzip of boot JS (549 → ~365 KB): ~0.1 s at 20 Mbps, ~1 s on Slow-4G. About −40% source for V8 to scan and parse. Lazy world/portfolio JS −26–30%.
  - 做法：New helper prototypes/index1-5/minify-build.cjs exporting minify(src) = esbuild.transformSync(src,{loader:'js',format:'esm',minifyWhitespace:true,minifySyntax:false,minifyIdentifiers:false,legalComments:'none',charset:'utf8',target:'esnext'}). Wrap the writes in build.cjs:41 and 43 with it. All anchor patches run before this step, and GLSL inside template literals is untouched. Install esbuild exactly like scripts/build-logo-worker.cjs: pinned 0.25.10 under the OS temp dir with a one-time --install, which needs the user's OK for npm. Add I15_MINIFY=0 for readable debug builds. Only local modul
  - 檔案：prototypes/index1-5/build.cjs、scripts/build-logo-worker.cjs
- **modulepreload-graph** — Preload the whole boot module graph (it is 4 levels deep behind a 589 KB main.js)（桌機畫面：identical；風險 low；small）
  - 收益：Removes 3 serial discovery rounds: ~0.1–0.2 s on desktop broadband, ~0.3–0.6 s on 4G (RTT 80–150 ms plus main.js parse before the depth-1 requests).
  - 做法：Helper prototypes/index1-5/module-preload-build.cjs, run after the module writes (build.cjs after line 44, before the HTML write at line 49). It walks static imports from the generated main.js with the same regex rewire uses, and maps `three/addons/` through the import map to https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/. It adds the addon-internal deps (postprocessing/Pass.js, MaskPass.js, shaders/CopyShader.js, LuminosityHighPassShader.js, OutputShader.js) and writes one `<link rel="modulepreload" href="…">` per URL between markers right after index1-5.html:104. That position is s
  - 檔案：index1-5.html、prototypes/index1-5/build.cjs
- **logo-glb-phone** — LOGO lake mark: phones download the full 2.17 MB, 120k-triangle Blender GLB（桌機畫面：identical；僅手機；風險 medium；medium）
  - 收益：Phones: roughly −1.4 to −1.7 MB download, ~−10 MB transient JS memory, and a faster 'mark' build step in the lake prep.
  - 做法：Export prototypes/index1-5/assets/logo/logo3d-tuned-m.glb with the same Blender pipeline and parameters (radius .02, profile .5, angleLimit 28, weighted normals) except segments 8 instead of 24, aiming for ≤ ~40k triangles. Add "mobileAsset":"logo3d-tuned-m.glb" to logo3d-current.json; the asset regex at world-logo-mark.js:181 already accepts logo3d-*.glb. In world-logo-mark.js, have getBlenderModel pick mobileAsset when the mark's `small` flag is set. Desktop keeps logo3d-tuned.glb byte for byte. Optional desktop-identical extra: lossless meshopt encoding (no quantization, no filters, no reor
  - 檔案：prototypes/index1-5/world-logo-mark.js、prototypes/index1-5/assets/logo/logo3d-current.json、scripts/index1-5/logo-model-server.py、prototypes/index1-5/world-logo-build.cjs
- **logo-glb-earlier** — Start the GLB download at world mount and bake the manifest (removes a serial no-store round trip)（桌機畫面：identical；風險 low；small）
  - 收益：One fewer RTT (100–300 ms on phones) and the 2.17 MB download (1.7 s at 10 Mbps, ~11 s on Slow-4G) moves several idle steps earlier, so fast scrollers are less likely to reach the LOGO cut before the mark is ready.
  - 做法：In world-logo-mark.js, export prefetchLogoModel(), which fetches the manifest and then the GLB with the same URL and query GLTFLoader will use, warming only the HTTP cache with no parsing. Call it from world-logo.js when the world mounts, or the first time `near` is true, before the lake steps. In world-logo-build.cjs, inline the current {asset, revision} from logo3d-current.json as the default and keep the live no-store manifest fetch only on localhost / .test hosts, where the Blender preview server rewrites it. Verify in Network that the GLB request starts during the ocean chapters and that 
  - 檔案：prototypes/index1-5/world-logo-mark.js、prototypes/index1-5/world-logo.js、prototypes/index1-5/world-logo-build.cjs
- **duplicate-module-instances** — Three modules are loaded and evaluated twice because of mismatched ?v= query strings（桌機畫面：identical；風險 low；small）
  - 收益：−3 requests, −64 KB raw / ~22 KB gzip, 3 fewer module evaluations at boot; removes a latent split of terrain uniforms and maps.
  - 做法：(1) Rebuild through build.cjs so rewire stamps tufts' imports. Both files are LOCAL via alpine-team-build.cjs:37 extra. (2) Patch the `ui` text (cards-bridge-build.cjs or the new loading helper) so finnovation-interface imports water-journey-story.js with main.js's exact query. (3) Add a post-write check in build.cjs that fails if any module path is reached with two different query strings, reusing the walk from module-preload-build. Verify that each path appears once in Network.
  - 檔案：prototypes/index1-5/js/alpine-canyon-tufts.js、prototypes/index1-5/js/finnovation-interface.js、prototypes/index1-5/alpine-team-build.cjs、prototypes/index1-5/cards-bridge-build.cjs、prototypes/index1-5/build.cjs
- **content-hash-versions** — Per-file content hashes instead of a new Date.now() stamp on every module each build（桌機畫面：identical；風險 low；medium）
  - 收益：Returning visitors after a deploy re-download only the changed modules (typically main.js) instead of all ~550 KB gzip, and keep V8 code cache for unchanged files. Mixed stamps become impossible.
  - 做法：In build.cjs, after all helpers have run, build the import graph of the LOCAL modules and process it leaves-first. For each module, rewrite its imports to `./dep.js?v=<sha256(dep final text).slice(0,10)>`, then hash its own final text. Use main.js's hash for the script src and modulepreload (build.cjs:45-46). Hash alpine-ui.js the same way and fix the regex. site-layout.css and typography.css already use content hashes (site-styles-build.cjs). Verify that two consecutive builds with no source change give identical URLs, and that changing one helper only changes the URLs of that module and its 
  - 檔案：prototypes/index1-5/build.cjs、index1-5.html
- **lazy-boot-modules** — Unused-in-production modules and a texture on the boot path: logo-panel.js, GLTFLoader, tuft-atlas.webp（桌機畫面：identical；風險 low；small）
  - 收益：About −33 KB gzip JS and 2 requests at boot, plus −29 KB on the terrain critical path; all devices.
  - 做法：(a) In logo-panel-build.cjs, replace the static import with a host/flag check followed by `import('./logo-panel.js').then(m=>m.mountLogoPanel({...}))`. (b) Through a helper anchor, turn the GLTFLoader import into `await import('three/addons/loaders/GLTFLoader.js')` inside the `if (!orbModelSkipped)` branch and create gltfLoader there. (c) Load tuft-atlas only when !matches('[data-look="index1-5"]:not([data-opening-refinement])'), the same predicate the tufts use. Verify that production Network has no logo-panel.js, GLTFLoader.js or tuft-atlas.webp before the world mounts; ?orb=mesh and ?logopa
  - 檔案：prototypes/index1-5/logo-panel-build.cjs、prototypes/index1-5/js/main.js、prototypes/index1-5/js/index1-5-terrain.js
- **principles-cbg-phone** — Principles background c-bg-v1.webp is 490 KB (near-lossless encode) on every device（桌機畫面：identical；僅手機；風險 low；small）
  - 收益：Phones: about −390 KB (~490 → 60–100 KB) when the principles chapter approaches.
  - 做法：Generate prototypes/index1-5/assets/principles/c-bg-v1-m.webp from c-bg-v1.png: `cwebp -q 82 -m 6 -metadata none -resize 1280 720` (or 1672×941 at q82 if 1280 looks soft on a tall phone in cover fit). Pass small into createWorldPrinciples through world-principles-build.cjs and pick the -m file in world-principles.js:133. Desktop keeps the current file. A desktop re-encode at q90 (~120–150 KB) would be imperceptible but not bit-identical, so do it only with an explicit yes. Verify with phone screenshots of the second principles chapter.
  - 檔案：prototypes/index1-5/world-principles.js、prototypes/index1-5/world-principles-build.cjs、prototypes/index1-5/assets/principles/c-bg-v1.png
- **portfolio-pexels-phone** — Portfolio cards fetch 11 Pexels images at 1024×1024 on phones（桌機畫面：identical；僅手機；風險 low；small）
  - 收益：Phones: an estimated −40–50% of the card-image bytes (~0.5 MB) before the bridge.
  - 做法：Through a helper patch on loadPortfolio (main.js:6609-6611), pass `images: DROPLET_LITE ? CONFIG.portfolio.images.map(u=>u.replace('w=1024&h=1024','w=720&h=720')) : CONFIG.portfolio.images`. Desktop is unchanged. If the pending self-hosting decision goes ahead, ship 1024 and 720 copies the same way. Verify the card sharpness on a phone viewport and the transferred bytes in Network.
  - 檔案：prototypes/index1-5/js/main.js、js/portfolio-slider.js
- **terrain-bytes** — Terrain set: lossless WebP for the erosion height PNG (all devices); smaller scree and erosion-normal for phones（桌機畫面：identical；風險 low；small）
  - 收益：Desktop: about −60–100 KB lossless on the first-paint path. Phones: about −90–130 KB on the first-paint path.
  - 做法：(a) Both devices, lossless: `cwebp -lossless -exact -z 9 -metadata none` produces erosion-height-512.webp and -256.webp; switch the extension at index1-5-terrain.js:34. Decoding is byte-exact, so DETAIL.data stays identical. Verify by running loadAlpineDetail on the PNG and the WebP in the page and comparing the Float32Arrays (expect equal), plus a geometry hash of the canyon. (b) Phones only: images/alpine/scree-256.webp and erosion-normal-512.webp, half size, from tools/bake-alpine-textures.cjs / bake-erosion-detail.cjs or `cwebp -resize`, used when lite. Verify (b) with phone canyon screens
  - 檔案：prototypes/index1-5/js/index1-5-terrain.js、prototypes/index1-5/js/alpine-erosion.js、images/alpine/erosion-height-512.png、images/alpine/erosion-height-256.png、images/alpine/scree-512.webp、images/alpine/erosion-normal-1024.webp
- **world-texture-order** — Planet textures wait for the 500 KB ocean still (one Promise.all)（桌機畫面：identical；風險 low；small）
  - 收益：The planet is ready earlier by the ocean still's share of the bandwidth: ~0.5 MB on desktop, ~177 KB on phones, during the bridge.
  - 做法：In the patched local copy (world-ocean-build.cjs or a new helper), apply the three globe textures as soon as they resolve, and handle the ocean still separately. Fetch it after them, or with fetch(url,{priority:'low'}) via loadWorldImage's fetcher. The steady-state picture is the same. Verify uReady timing via __MONTIS_STUDY__.world during the bridge, and pixel A/B of the planet and ocean frames.
  - 檔案：prototypes/index1-5/js/finnovation-world.js、prototypes/index1-5/js/world-image-source.js、prototypes/index1-5/world-ocean-build.cjs
- **earth-tone-phone** — Phones get the 2048×1024 whole-planet tone map（桌機畫面：identical；僅手機；風險 low；small）
  - 收益：Phones: about −190 KB when the world mounts.
  - 做法：Generate images/world/earth-1k.jpg (1024×512) with scripts/world/build-world-assets.cjs (same tone grade, q .84) and choose it when small at finnovation-world.js:407. Keep clouds-2k because the deck is magnified full-screen. Verify with a phone screenshot of the planet while it turns.
  - 檔案：prototypes/index1-5/js/finnovation-world.js、scripts/world/build-world-assets.cjs、images/world/earth-2k.jpg
- **phone-tier-consistency** — Four different 'phone' tests choose asset sizes; tablets get lite terrain but desktop-size world assets（桌機畫面：identical；僅手機；風險 low；small）
  - 收益：Tablets: about −2 MB of world assets; one rule to maintain.
  - 做法：Export one assetTier() from mobile-render-budget.js (a local module) and use it in every asset choice: terrain lite, world small, principles, portfolio and GLB. Keep desktop (fine pointer, wide window) on the full set. This is a product decision for tablets, so ask before switching. Verify with an iPad-size viewport.
  - 檔案：prototypes/index1-5/mobile-render-budget.js、prototypes/index1-5/js/main.js、prototypes/index1-5/js/finnovation-world.js
- **hero-before-canyon** — (Larger) show the hero before the canyon geometry is built（桌機畫面：identical；風險 medium；large）
  - 收益：The first frame no longer waits for terrain bytes plus the canyon build: potentially 1–3 s earlier hero on phones, ~0.5–1 s on desktop (to be measured).
  - 做法：Turn `canyon` into a late-bound handle. Start frame() and resize() first with canyon-dependent parts guarded, and run createJourneySceneAsync in the background; its generator already yields per step. Let warmJourney await it. This is a structural helper patch across many anchors, so it needs its own A/B: hero frames bit-identical, canyon/portal frames identical once ready, and no hitch in the hero animation while the canyon builds.
  - 檔案：prototypes/index1-5/js/main.js、prototypes/index1-5/js/water-journey-scene-463.js

## 開場＋旅程 GPU
Desktop today (e.g. a 1440×900 screen at DPR 2 becomes a 2376×1485 canvas, about 3.5 MP): every frame draws the active scene into a 4×MSAA HalfFloat target. That target has a depth texture, and its depth is resolved every frame. Then up to 10 composer passes run: render → journeyBlend → canyon depth blur → cursor → bridge mosaic → forward mosaic → radial blur → bloom → Output → grain. Only bloom, Output and grain run when idle; the rest are properly gated.

Which scene gets drawn is already clean. With the portal on, journey.mix is a hard 0/1 switch, so the opening and the canyon are never rendered together (journeyBlend is fallback only). The main pass is also skipped under the cards and the world. MSAA lives only on the scene target.

Measured waste that can be removed with identical desktop output:
- (a) The opening key light renders a 2048² PCFSoft shadow map on every opening render, but nothing receives it. That is twice per frame in the LOGO chapter, because the glass capture re-renders the scene.
- (b) The MSAA depth blit runs on frames that never read depth: the whole opening, the LOGO chapter and the canyon at rest.
- (c) Up to 36,000 grass tufts × 18 vertices each do 18 vertex texture fetches and 7 noise calls before their 230-unit distance cull.
- (d) On desktop the main loop's JS keeps running under the opaque world canvas. This is already suspended on phones.
- (e) Output and grain are two separate full-res passes.

The heaviest segment is the LOGO→valley flight.

- **tufts-vertex-cull** — Cull grass tufts before their per-vertex terrain sampling（桌機畫面：identical；風險 low；small）
  - 收益：Removes ~70–90% of tuft vertex work (everything outside 230 units). Canyon first-person: ≈0.1–0.3 ms on RTX-class, ≈1–2 ms on integrated GPUs; phones (9k instances, vertex fetch is slow on mobile GPUs) ≈0.5–1.5 ms. All estimates.
  - 做法：In the shader replacements, test the undisplaced root first:

```
bool tNear = uTuftFade>0. && distance(cameraPosition,aRoot) < uTuftFar + 6.*uCliffRelief + 1.;
```

The margin 6·uCliffRelief bounds alpBankDisp's outward offset (h0∈[0,1]). Run alpBankDisp/alpCanyonField and the rest only inside that branch; otherwise set transformed=aRoot, tK=tH=0, vTuftShow=0. That is the same degenerate output as today.

Edit the source module alpine/alpine-canyon-tufts.js; alpine-team-build.cjs ships it as extra.

Verify:
- Read the instance count via `__MONTIS_STUDY__.canyon.scene.getObjectByName('Canyon g
  - 檔案：prototypes/index1-5/alpine/alpine-canyon-tufts.js
- **opening-keylight-shadow** — Stop rendering the opening key light's shadow map (nothing receives it)（桌機畫面：identical；風險 low；small）
  - 收益：One shadow pass per frame in chapters 1–2 and two in the LOGO chapter, each ≈0.05–0.2 ms CPU (scene traversal) + 0.05–0.3 ms GPU. Frees ~34 MB VRAM on desktop. Phones already have shadows off, so no change there.
  - 做法：Add an anchored patch: `keyLight.castShadow = true;` → `keyLight.castShadow = false;`. Optionally also skip the dropletShadow matrix loop.

The canyon's own static sun shadow is unaffected, because renderer.shadowMap.enabled stays true. Program keys change (no dir-light shadows in the opening), but warmJourney compiles with the real scene lights (compileForTarget(..., scene)), so no runtime compile is added.

Verify:
- renderer.info.render.calls per frame drops in hero/disperse/logo.
- Pixel-diff those chapters at a fixed clock; expect identical, comparing within the same simulation phase grou
  - 檔案：prototypes/index1-5/mobile-performance-build.cjs (patchMain) or a new prototypes/index1-5/render-perf-build.cjs registered last in build.cjs、prototypes/index1-5/js/main.js (generated, read only)
- **msaa-depth-resolve** — Resolve the MSAA scene depth only on frames that read it（桌機畫面：identical；風險 low；small）
  - 收益：One full-resolution 4-sample depth resolve per frame (3.5 MP): ≈0.1–0.2 ms on RTX-class, ≈0.5–1.5 ms on integrated/ANGLE. No effect on phones, which use samples 0 and have no resolve.
  - 做法：Right after canyonMotion.apply(...) (or just before composer.render, main.js ~9098), add:

```
renderTarget.resolveDepthBuffer = canyonMotion.state.active && !journeyBlend.enabled;
```

When journeyBlend is on, the depth comes from the non-MSAA canyonTarget. r170 then invalidates depth instead of blitting it.

Verify: bit-identical frames in opening/LOGO/canyon at rest and during canyon scroll (motion-ab.cjs); GPU time per frame in hero and canyon.
  - 檔案：prototypes/index1-5/mobile-performance-build.cjs (patchMain) or new render-perf-build.cjs
- **desktop-world-suspend** — Suspend the hidden main loop under the world on desktop too（桌機畫面：identical；風險 low；small）
  - 收益：Removes all main-loop JS during the world epilogue on desktop. Estimate 1–3 ms main thread per frame (needs a performance.measure around frame()), which goes to the world renderer.
  - 做法：Drop `mobileRenderBudget.mobile &&` from the 'covered scene suspension' patch. This path is already validated on phones: the clock is drained and work resumes on reverse/manual input.

Update the assertion in render-budget-test.cjs that expects desktop covered frames to do work (=60).

Verify:
- DevTools main-thread time per frame while scrolling the world/ocean on desktop.
- Back-scroll from world to cards and valley: chapter UI and frames unchanged.
  - 檔案：prototypes/index1-5/mobile-performance-build.cjs、scripts/mobile/render-budget-test.cjs
- **output-grain-merge** — Fold OutputPass into the final grade/grain pass（桌機畫面：imperceptible；風險 medium；medium）
  - 收益：Removes one full-res HalfFloat read+write per frame: ~0.05 ms on RTX 4070 (measured share), ~0.3–0.5 ms on integrated GPUs, ~0.2–0.4 ms on phones (estimate).
  - 做法：1. Remove `composer.addPass(new OutputPass())`.
2. In the grain shader (material.toneMapped=false, so three's prefix does not duplicate the chunk), include tonemapping_pars_fragment and add `vec4 fiOut(vec2 uv)` = texture → NeutralToneMapping (exposure via toneMappingExposure, copied from renderer.toneMappingExposure each frame after updateDropTransition) → sRGBTransferOETF.
3. Use fiOut for the base sample and make opening-lunge-blur.js sample its taps through fiOut instead of texture2D(tDiffuse,...), so the blur still averages display values as today.

Verify: per-chapter diff ≤1/255 (only h
  - 檔案：new prototypes/index1-5/render-perf-build.cjs (patch main)、prototypes/index1-5/opening-lunge-blur.js、prototypes/index1-5/mobile-performance-build.cjs (MOBILE_RENDER anchors)
- **phone-landscape-terrain** — Pass the lite flag to the watershed terrain (landscape phones build desktop terrain)（桌機畫面：identical；僅手機；風險 low；small）
  - 收益：Landscape phones / coarse tablets: ~6× fewer terrain vertices and a much shorter build on a 4× throttled CPU (likely seconds; estimate). Desktop unchanged.
  - 做法：Anchored patch on `const watershedOptions={...terrainConfig};`: add `lite:lite||(typeof innerWidth==='number'&&innerWidth<760)`. This keeps 720–760 px desktop windows exactly as today.

Note: coarse tablets (DROPLET_LITE) would also get the lite mesh, which matches their already-lite materials. Use the budget flag instead if tablets should keep the dense mesh.

Apply the same flag to opening-portal steps (see phone-portal-steps). Verify canyon.watershed.stats (terrainVertices, alpine.coreSpacing) under 844×390 coarse emulation; desktop stats must be unchanged.
  - 檔案：new prototypes/index1-5/render-perf-build.cjs (patch `journey`; shared js/water-journey-scene-463.js:1048 must not change)
- **phone-glass-capture** — Smaller logo-glass refraction capture on phones（桌機畫面：identical；僅手機；風險 low；small）
  - 收益：−55% capture pixels. ≈0.3–1 ms per frame on mid phones in the LOGO chapter, more during the flight, where the capture also carries the portal ray-march (estimate).
  - 做法：Change `mobile ? .75 : 1.15` to `mobile ? .5 : 1.15`, giving 195×422 (16% of the main buffer); update the test expectation.

Verify on 390×844: ?view=logo and ?view=zoom shots at 1:1 and 2×, plus frame time across the LOGO chapter and the flight.
  - 檔案：prototypes/index1-5/mobile-performance-build.cjs (patchGlass 'optical capture size')、scripts/mobile/render-budget-test.cjs
- **phone-portal-steps** — Fewer portal ray-march steps on phones (+ reuse bracket probes on all devices)（桌機畫面：identical；僅手機；風險 medium；small）
  - 收益：Phones: ~30% fewer probes per card pixel (≈1–2 ms on mid phones during the flight; estimate). (b) saves ~4% of the card cost on desktop too.
  - 做法：(a) Phones: pass the budget flag from main (not innerWidth) and use steps ×.5 (18) with fixRefine 5.

(b) All devices, identical output: keep uv/zs/len/de of the last front sample and of the first behind sample from the walk/refine, instead of re-probing at l.240-242.

Verify: ?portal=debug magenta share (tools/measure.probe.cjs) and crop diffs over handoff .5–.88 at 390×844; desktop frames bit-identical for (b).
  - 檔案：prototypes/index1-5/opening-portal.js (shipped by opening-world-build.cjs)
- **phone-glass-lite-noise** — Drop sub-pixel noise layers of the LOGO glass shader on phones（桌機畫面：identical；僅手機；風險 medium；small）
  - 收益：About 65% less ALU per glass pixel on phones, which is most of the mark's cost. Up to several ms on mid phones when the mark fills the screen (estimate).
  - 做法：Add `GLASS_LITE` to defines when mobile. Under it, skip the bubble block and the grainF and crust mixes (equivalent to their near-zero mean contribution).

Verify: phone shots of ?view=logo / ?view=zoom at 1:1 and 2× against current, and frame time in the zoom.
  - 檔案：prototypes/index1-5/mobile-performance-build.cjs (patchGlass; the glass source prototypes/highland-1-4-ascent/js/water-logo-reference-glass.js must not change)
- **phase-gated-cpu** — Skip per-frame JS of the scene that is not being drawn（桌機畫面：identical；風險 medium；medium）
  - 收益：Estimate 0.2–0.8 ms main thread per frame on desktop, 1–2 ms on phones. Needs measurement.
  - 做法：Measure first: performance.mark around the canyon and opening blocks under a 4× CPU phone profile.

If worthwhile (>0.3 ms):
- gate canyon.update on handoff>0 || portal flying || journeyBlend || bake pending;
- gate the opening-only updates on journey.mix<.999;
- always run one catch-up update on the frame the phase flips. The logo delivery treats progress jumps >.2 as 'jumped', and the lunge records reset.
  - 檔案：new prototypes/index1-5/render-perf-build.cjs (patch main)
- **per-frame-hygiene** — Small identical per-frame cleanups (double clear, zero-opacity draws, string parsing)（桌機畫面：identical；風險 low；small）
  - 收益：Small: <0.1 ms GPU, ~0.05–0.2 ms CPU per frame on desktop (≈3× on phones), plus less GC churn.
  - 做法：- Drop the explicit clear in capture.
- Set mistPuff.visible = opacity > 0, and hide spray while its uOpacity is 0.
- Cache parsed colours by source string (the pattern of syncColor in the glass module).
- Call syncTerrain only while the tuner is open.

Verify: identical frames; heap-profile.cjs garbage per frame.
  - 檔案：prototypes/index1-5/mobile-performance-build.cjs (patchGlass/patchMain) or render-perf-build.cjs、prototypes/index1-5/opening-world.js、prototypes/index1-5/alpine/alpine-atmosphere.js
- **background-last-earlyz** — Draw the canyon sky dome and the opening backdrop last at depth 1.0 (early-z)（桌機畫面：identical；風險 medium；small）
  - 收益：Sky shading under terrain (~50–70% of canyon frames) and backdrop under the sea (~30% of opening frames): ≈0.1–0.3 ms on RTX-class, ≈0.5–1 ms on integrated, a similar share on phones (estimate).
  - 做法：Set gl_Position.z = gl_Position.w (depth exactly 1.0; the default LEQUAL test still passes) and give both a renderOrder after all opaque objects but before transparents. They then shade only pixels that nothing opaque covered.

Do not keep .99999: terrain near the far plane would then fail against the sky.

Verify: bit-identical hero/flight/canyon/rivers frames and GPU time.
  - 檔案：new prototypes/index1-5/render-perf-build.cjs (patch journey/main)、prototypes/index1-5/alpine/alpine-atmosphere.js (SKY_VERTEX)
- **phone-shadow-look** — Phones lost all canyon sun shadows; the static map is cheap to keep（桌機畫面：identical；僅手機；風險 low；small）
  - 收益：Not a saving: costs about +0.3–1 ms in the canyon on phones plus a one-off 2048² bake per phase change, and restores the cast shadows.
  - 做法：On phones keep shadowMap.enabled with type BasicShadowMap or PCFShadowMap. Combine with opening-keylight-shadow so the opening pays nothing.

Decide by look: phone canyon/aerial shots with and without, plus frame time.
  - 檔案：prototypes/index1-5/mobile-performance-build.cjs ('shadow allocation')

## 卡牌＋世界 GPU
Scope: the cards strip (OGL slider on its own canvas) and the world epilogue (one three.js canvas covering deck/globe → dive → ocean → principles → LOGO cut → lake → footer). This was a read-only static audit. I took no runtime measurements; every number comes from the code (pass counts, pixel counts, memory). Paths are relative to G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/. Line numbers refer to the generated prototypes/index1-5/js/* unless stated otherwise.

Reference sizes:
- Desktop at 1440×900 CSS with world DPR 2: 5.18 Mpx per full-screen pass (1.30 Mpx at DPR 1).
- Phone at 390×844 with world DPR 1.25: 0.51 Mpx.

Per-frame work today:
- **Cards:** 7 full-screen passes at DPR ≤1.75 on every device (1.0 Mpx per pass on a phone).
- **Globe:** background, globe, halo and deck.
- **Dive (about 1.9 screens of scroll):** 512² wave bake (40 waves), planet capture into sceneRT, then a main pass that redraws the background, globe and halo under an opaque composite, plus one full-frame copy and a 15-tap effect.
- **Ocean:** wave bake, background quad (fully hidden under the opaque sea), ocean shader (about 9 texture taps), cloud layer (about 10 taps), islands, gulls and photos, plus 720p video decode and upload.
- **Principles:** one quad.
- **LOGO cut:** world draw, copy, lake draw, copy, then a 9-tap composite. For the first 0.3 of the transition this produces exactly the world frame, so all of it is wasted.
- **Lake hold:**
  - Mirror pass (sky plus its own transmission p

- **logo-cut-idle-composite** — LOGO cut runs world + lake + 2 full-frame copies + 9-tap composite while the cut is still at 0 (output = the world frame)（桌機畫面：identical；風險 low；small）
  - 收益：In that band every frame drops the whole lake render (mirror, two transmission passes, conv/mips, two heavy backdrops, glass), two full-frame copies (MSAA resolves on desktop) and a full-screen 9-tap composite. The most expensive frame type of the epilogue becomes one principles quad. Applies over about 0.5 screen of scroll each way, on all devices.
  - 做法：**Change** (local source prototypes/index1-5/world-logo.js, shipped by world-logo-build.cjs; no helper patch needed)

In render(), right after the existing `if (!l.engaged && !(l.pc > 0)) {…}` block, add:

`if (!reducedMotion && Math.round(num('transition',0,2)) > 0 && num('cutClock',0,1) >= .5 && !(l.pc > 0)) { R.spinFx?.reset(); return false; }`

The world then draws its own frame, which is what the composite produced anyway.
- warm() is unchanged, so stage 2 still compiles the composite before engagement.
- The spin cannot have started (spinStart .44 > cutAt .3), and spinFx only renders whe
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-logo.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/world-logo.js
- **lake-backdrop-twice** — The lake's heavy sky+water backdrop is shaded twice per frame at full resolution (three's transmission pass, then the canvas)（桌機畫面：imperceptible；風險 medium；medium）
  - 收益：Removes one full-resolution evaluation of the epilogue's heaviest shader per lake frame (5.2 Mpx at DPR 2; 0.5 Mpx on phones), replaced by two texel copies. Estimated 25–40% of the lake frame's GPU time, to be measured. Applies through the cut, spin and hold. Costs one RGBA8 full-res target (20.7 MB at DPR 2, 2 MB on phones).
  - 做法：**Change** (in the local source world-logo-scene.js)
- Add backRT: RGBA8, W×H, NearestFilter, no depth.
- Add a mini-scene holding the heavy backdrop mesh. Render it into backRT once per frame from scene.onBeforeRender, after the mirror.
- The scene's own backdrop mesh gets a copy material (`gl_FragColor = texelFetch(tBack, ivec2(gl_FragCoord.xy), 0)`, NoBlending, depthTest off). three then uses that copy both in the transmission pass and in the main pass.
- Swap the heavy material back on only for the nested mirror render (the uMirror = 1 sky path), then swap back.
- setSize() resizes backRT.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-logo-scene.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/world-logo-scene.js
- **mark-nonindexed** — Glass mark mesh is de-indexed to about 361k vertices and drawn 4× per frame on desktop, 2× on phones（桌機畫面：identical；風險 low；small）
  - 收益：Vertex-shader invocations per draw fall from about 361k to roughly 70–90k (post-transform cache). That applies to 4 draws per frame on desktop and 2 on phones, where it is likely several ms on mobile GPUs. VBO shrinks from 15.9 MB to about 2.7 MB plus a 1.4 MB index buffer. The CPU work in the mark build drops about 6×.
  - 做法：**Change**: delete the toNonIndexed line in the local source prototypes/index1-5/world-logo-mark.js.

Why this is safe:
- mergeGeometries merges indexed parts.
- uv, aThick and aBrand are per-vertex values that depend only on position and node, so shared vertices get the same data.
- Normals are the authored ones from the GLB.

**Verify**
- Frozen-clock A/B at lh:0.5 and ls:0.5: expect identical frames.
- renderer.info.render.triangles should be unchanged.
- logo.state.timings.mark and the long-task log should drop.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-logo-mark.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/world-logo-mark.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/assets/logo/logo3d-current.json
- **ocean-underlay-overdraw** — World draws the sky background (and, during the dive, the globe and halo a second time) under an opaque ocean（桌機畫面：identical；風險 low；small）
  - 收益：Saves one full-screen pass per frame through the whole horizontal ocean section. On desktop the canvas is 4×MSAA, so that is 4 sample writes per pixel on 5.2 Mpx at DPR 2. During the roughly 1.9-screen dive it also saves three fills per frame: background, the 192×144 globe and the additive halo. Rough estimate 0.2–1 ms per frame.
  - 做法：**Change**
1. world-ocean.js (local source): expose `get covering() { return baked && !reducedMotion && !!cur && cur.w > 0; }`. That covers both wave-crossing and covered frames.
2. A new small helper, e.g. world-gpu-budget-build.cjs, appended after world-mobile-performance-build.cjs in build.cjs's list. It patches drawBase in extra['finnovation-world.js']:
   - Call ocean.render() first (it makes the sceneRT capture with everything visible).
   - If ocean.covering: set background.visible = false and earth.visible = false for renderer.render(scene, camera) only, then restore.

**Verify**: worl
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-ocean.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/finnovation-world.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/build.cjs
- **lake-mirror-sky** — Mirror pass shades the whole sky into the mirror target, though only the mark's pixels reach the screen（桌機畫面：identical；風險 low；small）
  - 收益：Saves one sky evaluation over 56% (desktop) or 25% (phone) of the full-resolution pixel count per lake frame. Roughly 5–10% of lake GPU time.
  - 做法：**Change** (in world-logo-scene.js)
- Add `uniform float uSkip` to BACKDROP_FRAGMENT with an early `if (uSkip > .5) { gl_FragColor = vec4(0.); return; }`.
- Add `backdrop.onBeforeRender = r => { const s = inMirror && r.getRenderTarget() === mirrorRT ? 1 : 0; if (U.uSkip.value !== s) { U.uSkip.value = s; backdropMat.uniformsNeedUpdate = true; } }`.
- The transmission pass (a different target) keeps shading the sky.

**Verify**: read back convRT, or run a frozen-clock A/B at lh:0.5. Expect identical frames.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-logo-scene.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/world-logo-scene.js
- **sync-texture-uploads** — Island atlases, principles photos, ocean chapter photos and the first video frame are decoded/uploaded synchronously inside a frame（桌機畫面：identical；風險 low；medium）
  - 收益：Removes one-time main-thread spikes:
- Island atlases: about 2×(15–40) ms on desktop inside a scroll frame.
- Principles: about 15–30 ms decode + upload + mips on desktop (50–100 ms on phones), exactly on the first frame of the reveal and again mid-reading.
- About 3–8 ms on desktop (10–25 ms on phones) per chapter photo as it scrolls in.
- The first video upload.
  - 做法：**Changes**
- **Islands and principles:** decode with loadWorldImage (world-image-source.js). It uses createImageBitmap with flipY, premultiplyAlpha 'none' and colorSpaceConversion 'none', which matches these textures' NoColorSpace / premultiplyAlpha false. Set texture.flipY from its result, then call renderer.initTexture in requestIdleCallback, one texture per slot. Principles should do this at begin(), which runs 2.5 H early.
- **Ocean photos:** use the already-decoded <img> (or createImageBitmap(img)) and initTexture in idle once o.t > −.65.
- **Video:** initTexture(videoTexture) in an idle
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-ocean-islands.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-principles.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-ocean-photos.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-image-source.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/finnovation-world.js
- **dive-first-frame-warmup** — The first dive frame pays all of the ocean's first-use costs at once (the reported ~67 ms)（桌機畫面：identical；風險 medium；medium）
  - 收益：Moves the ~67 ms first-dive frame (plus the first video upload) to a resting moment in the globe chapter, so the dive starts at normal frame time. Applies to all devices; phones benefit most.
  - 做法：Add an ocean warm-up modelled on world-logo.js warm().

**When**: once ocean.state.prewarm.ready is true and the visitor is in the globe chapter, near the dive (y > at.dive − 1.5 H) or resting there for at least 0.3 s.

**How**: one stage per such frame, done before drawBase inside a world frame that will be overdrawn, so nothing is presented:
1. Render scene into sceneRT.
2. Draw the ocean layers with waveOn uniforms into the canvas.
3. Allocate diveFx.tex, run copyFramebufferToTexture and one fx draw.
4. Run initTexture(videoTexture); see sync-texture-uploads.

Code goes in the world-ocean.j
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-ocean.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-dive-fx.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/world-ocean.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/world-dive-fx.js
- **cards-setup-slices** — Cards strip setup runs as one 70–80 ms task during the valley flight（桌機畫面：identical；風險 low；medium）
  - 收益：A 70–80 ms long task (more on phones) during the canyon flight becomes about 7–10 idle slices of ≤6–15 ms each, one program link per slice. Photo uploads also move out of the first strip frame.
  - 做法：**Change**
1. A new helper (or revive only the slider part of flow-fix-build.cjs) ships extra['portfolio-slider-flow.js'] = patchSlider(js/portfolio-slider.js) with FLOW.on.
2. Switch motion-polish-build.cjs's sliderUrl from '../../../js/portfolio-slider.js' to the local copy.
3. Keep the first warm frame (setEntrance(0)/reset/frame) in its own idle slot after the uploads.

The shared js/portfolio-slider.js stays untouched.

**Verify**
- `perf.cjs --from 8.9 --to max --profile`: no long task above 50 ms from the slider.
- portfolio/epilogue-test.cjs, plus a frozen-clock A/B of the strip and th
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/flow-fix-build.cjs、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/motion-polish-build.cjs、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/portfolio-epilogue-polish.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/js/portfolio-slider.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/build.cjs
- **video-off-when-covered** — Ocean video keeps playing and decoding through principles, the LOGO lake and the footer reveal（桌機畫面：imperceptible；風險 low；small）
  - 收益：Stops H.264 decode and texture-version churn for the principles + LOGO + footer stretch (several screens plus rest time). Saves decoder power and memory bandwidth, and battery and thermal headroom on phones. When the visitor returns, the loop resumes at a different phase, which is not observable.
  - 做法：**Change** (via the world helper on extra['finnovation-world.js'])

Add: `showing = showing && !(s.principles && s.principles.enter >= 1) && !(s.l && s.l.engaged && (s.l.pc ?? s.l.qWave) >= 1)`

The existing play/pause branch already handles both directions.

**Verify**
- world.state.video.paused should be true at principles and at lh:0.5, and false back at h:3.
- Frozen-clock A/B of the ocean.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/finnovation-world.js
- **journey-under-world** — Journey canvas is still composited under the transparent world canvas, and its CPU frame keeps running on desktop（桌機畫面：identical；風險 low；small）
  - 收益：Desktop: removes the journey's per-frame CPU update for the whole world stay (estimated 0.5–2 ms main-thread per frame). All devices: one fewer full-screen composited layer per frame. On a DPR-3 phone that layer is 1170×2532 ≈ 12 MB read per frame.
  - 做法：**Scope**: main.js belongs to the journey area, so coordinate with that owner.

**Change** (in mobile-performance-build.cjs)
- Drop the mobile condition for the world.covering early return.
- Keep the worldEpilogue block (9090-9097: loadWorld triggers, world.close) running before any early return.
- Toggle the journey canvas `style.visibility = 'hidden'` while world.covering, cached; restore on the first uncovered frame, before composer.render.

**Verify**
- Frozen-clock A/B at world points: identical.
- Scroll world → cards → journey and check continuity.
- DevTools Performance panel: composi
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/mobile-performance-build.cjs、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/main.js
- **cards-dpr-phone** — Cards strip renders 7 full-screen passes at DPR 1.75 on phones（桌機畫面：identical；僅手機；風險 low；small）
  - 收益：On a 390×844 phone the buffer goes from 683×1477 to 488×1055: −49% fill on all 7 passes, and half the render-target memory, for the whole bridge and strip.
  - 做法：**Change**: in a helper on extra['portfolio-epilogue-polish.js'] (or in motion-polish-build.cjs's patchPortfolio), use `dpr: mobile ? 1.25 : 1.75`.
- Use the same gate as mobile-render-budget: data-look index1-5, and width ≤ 760 or coarse pointer with short side ≤ 900.
- Desktop stays at 1.75.

**Verify**: --phone shots of the bridge and the strip, and a check that card photos stay legible.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/motion-polish-build.cjs、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/portfolio-epilogue-polish.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/mobile-render-budget.js
- **mark-phone-lod** — Phones draw the full 120k-triangle Blender glass mark at about 270 px tall（桌機畫面：identical；僅手機；風險 medium；medium）
  - 收益：About 120k → 15–25k triangles on phones: 80%+ less vertex work and much less micro-triangle overdraw. The GLB download drops from 2.17 MB to a few hundred KB, and parse/prepare CPU in the mark build shrinks.
  - 做法：**Change**
1. Export a phone GLB from the existing Blender pipeline (assets/logo/README.txt, scripts/index1-5/logo-sdf-mesh.py): roundover segments 24 → 6–8, planar faces decimated. Name it e.g. logo3d-tuned-mobile.glb.
2. Add a `mobileAsset` field to logo3d-current.json.
3. getBlenderModel picks it when small or mobilePerformance is set; pass mobilePerformance through from world-logo.js.
4. Optional: iridescence 0 on phones (subtle).

**Verify**: --phone l:/ls:/lh: shots side by side, and renderer.info.render.triangles.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-logo-mark.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-logo.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/assets/logo/logo3d-current.json
- **phone-transition-taps** — Transition shaders run desktop tap counts on phones（桌機畫面：identical；僅手機；風險 low；small）
  - 收益：Cut composite: −40–45% of its texture work. Dive effect: about −40%. These are the peak-cost frames of the epilogue on phones.
  - 做法：**Change**: turn the loop counts into defines, gated by mobilePerformance.
- LOGO composite: `#define GLASS_TAPS` (9 desktop / 5 phone) in makeComposite (world-logo.js:585).
- Dive effect: `#define DIVE_TAPS` 5/3, and fbm octaves 4/3. Pass mobilePerformance into createWorldDiveFx from finnovation-world.js via the world mobile helper.

The tap start is already jittered per pixel, so fewer taps only make the streaks slightly grainier.

**Verify**: --phone lw:0.5 and d:0.5 shots.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-logo.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-dive-fx.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/world-logo-spin.js
- **phone-ocean-clouds** — Ocean cloud layer evaluates the cloud field twice per pixel at full resolution on phones（桌機畫面：identical；僅手機；風險 medium；medium）
  - 收益：Option A removes 75% of the cloud-pass pixels (estimated 20–35% of a phone ocean frame). Option B removes about 45% of the cloud pass.
  - 做法：**Option A (preferred)**, phone only (mobilePerformance), in the world-ocean.js source:
- Render the sky mesh into a half-resolution premultiplied RGBA8 target and composite it with one bilinear tap.
- The clouds are soft (smoothstep softness .22, LOD ≥ 1 reads), so there are no hard edges to lose.

**Option B (cheaper)**: a define that reuses dens for the lighting term instead of evaluating 'lit'.

**Verify**: --phone h:0, h:1.5 and h:3 shots side by side.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-ocean.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/world-ocean.js
- **shared-frame-copies** — Four full-frame copy textures plus sceneRT are kept for the whole visit（桌機畫面：identical；風險 low；small）
  - 收益：−41 MB GPU memory at DPR 2 (−10 MB at DPR 1, about −4 MB on phones), and fewer large re-allocations on adaptive-DPR steps.
  - 做法：**Change**
- A two-slot pool in finnovation-world.js: ctx.copyTarget(i) returns a FramebufferTexture sized to the drawing buffer.
- Pass it to diveFx, principles and logo instead of their private textures.
- Resize once in setDpr/onResize.

**Verify**: identical shots; renderer.info.memory.textures; perf-ab/gpumem.cjs.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/finnovation-world.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-dive-fx.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-principles.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-logo.js
- **phone-mirror-scale** — Phone lake mirror could be smaller; the reflection is blurred anyway（桌機畫面：identical；僅手機；風險 low；small）
  - 收益：−44% pixels on phones for the mirror sky, the mirror camera's transmission pass (including its MSAA resolve and mips) and the conv pass.
  - 做法：**Change**: `mobilePerformance ? .375 : .75`, at the WORLD_MOBILE_MIRROR_TARGET line in the local source.

**Verify**: --phone lh:0.5 and ls:0.6, comparing the mark's reflection side by side.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-logo-scene.js
- **phone-rest-30fps** — (Optional, needs the user's approval) Phones render ambient-only world frames at 60 fps while the visitor rests（桌機畫面：identical；僅手機；風險 medium；small）
  - 收益：About −50% GPU, battery and heat while resting on the globe, ocean or lake on phones. That also delays thermal throttling, which otherwise costs frames later during scrolling. Trade-off: on phones, ambient motion runs at 30 fps while resting, which a careful viewer can see.
  - 做法：**Change**: in the world mobile helper's frame() patch:
- If mobilePerformance && y === yt && vy === 0 && no input for more than 300 ms, render only every second rAF.
- Keep DOM paint on every frame.
- Any input returns to 60 fps.

Put it behind a CONFIG dial so it can be A/B'd on a real phone first.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-mobile-performance-build.cjs、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/finnovation-world.js
- **lake-build-hitches** — LOGO lake build: GLB preparation runs outside the idle scheduler, and the transmission targets' first allocation is very large（桌機畫面：identical；風險 low；medium）
  - 收益：Removes the 100+ ms-class tasks (estimate, to be measured) that currently land at random moments in the horizontal ocean section. The 270 ms gets a real attribution before anyone spends effort on it.
  - 做法：**Steps, in order**
1. Attribute the cost first: logo.state.log/timings plus `perf.cjs --profile` across the ocean section.
2. Prefetch the GLB and import the three modules in idle time at world mount (cards/globe). Their top-level evaluation is light.
3. Run prepareBlenderModel inside a step(…, heavy = true). With the mark-nonindexed fix its loops are about 6× smaller.
4. Keep the warm stages behind the existing rest gate.

Nothing visual changes.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-logo.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/world-logo-mark.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/world-logo-scene.js
- **idle-loops** — Cards and world rAF loops keep ticking with nothing to draw（桌機畫面：identical；風險 low；small）
  - 收益：Small main-thread saving (<0.3 ms per frame) and fewer wakeups while resting on the footer or deep in the world; mainly battery on phones.
  - 做法：**Cards**: skip run() when suspended && amount === target && !drag. setExit, take and close already call run().

**World**: when the canvas is not visible and y === yt && vy === 0, stop rescheduling. run() is already called by input, resize, scrollTo and enter.

The cards change goes in a helper on extra['portfolio-epilogue-polish.js']; the world change goes in the world helper.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/portfolio-epilogue-polish.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/js/finnovation-world.js
- **slider-rt-leak** — Shared slider leaks render targets on resize while the strip is drawing（桌機畫面：identical；風險 low；small）
  - 收益：Prevents unbounded GPU memory growth on resize or rotation while the cards are visible: tens to hundreds of MB during a drag-resize.
  - 做法：In the local slider copy (see cards-setup-slices), delete the replaced targets' texture/framebuffer/renderbuffer (gl.delete*) when re-allocating. The shared file stays untouched.

**Verify**: renderer memory, or perf-ab/gpumem.cjs, before and after 20 window resizes with the strip visible.
  - 檔案：G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/js/portfolio-slider.js、G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/prototypes/index1-5/flow-fix-build.cjs

## 主執行緒 JS／DOM／CSS
Most of the main-thread cost comes from work done for things that are not on screen, more than from any single hot loop.

At load:
- The first hero frame waits for the whole valley build (`await createJourneySceneAsync`, main.js:6457; `frame()` only starts at 9192). That build first downloads about 2.1 MB of terrain maps on desktop and about 0.6 MB on phones.
- The static module graph is 39 files, 1.41 MB of source (about 517 KB gzip; main.js alone is 589 KB / 194 KB gzip). It is discovered over 5 import levels, and only 2 modules are preloaded. Comments and indentation are about 31% of the generated JS bytes.
- Dead startup work:
  - a MarchingCubes cluster (about 7 MB of typed arrays) that is never drawn
  - a permanently hidden Water reflector
  - the tuft atlas
  - duplicated alpine-terrain modules
  - the hidden Section Two, which also pulls a 76 KB italic font.

Per frame:
- In the epilogue, four rAF loops run together (journey, alpine-ui, cards, world), plus a 400 ms interval.
- On desktop, the journey loop keeps doing all of its scene updates under the opaque cards and world; only the draw is skipped. Phones skip it only under the world.
- About 14 palette conversions, about 30 colour-string parses, a `JSON.stringify` and several allocating curve lookups run every frame with constant inputs. The 10/04 report measured 29–35 KB of garbage per frame.

DOM, CSS and compositor:
- The journey's own DOM writes are already well cached. The remaining hot spots:
  - a custom pr

- **covered-scene-suspend** — Stop the journey's per-frame scene updates while the cards or the world fully cover it (desktop too)（桌機畫面：identical；風險 low；small）
  - 收益：Estimated 0.3–1 ms of main thread per frame on desktop through the whole card strip and world epilogue (the longest part of the page). About 2–4 ms per frame on a 4×-throttled phone during the card strip.
  - 做法：Add a new helper, e.g. prototypes/index1-5/perf-mainthread-build.cjs, last in build.cjs's helper list. It patches the 'covered scene suspension' anchor that mobile-performance-build.cjs inserted. New condition: `!manual && ((world?.covering && portfolio?.open) || portfolio?.covering) && Math.abs(journey.target-journey.progress)<1e-4 && Math.abs(journey.velocity||0)<1e-4`, applied to all devices.
- Move the loadWorld triggers (main.js:9094-9096) above the early return.
- Keep `clock.getDelta()` and do not advance sceneTime, as the mobile path already does.

Requiring a settled journey makes the
  - 檔案：prototypes/index1-5/js/main.js、prototypes/index1-5/mobile-performance-build.cjs、prototypes/index1-5/build.cjs
- **gsap-unused** — Don't download and register GSAP + ScrollTrigger + SplitText in the world: they are never used（桌機畫面：identical；風險 low；small）
  - 收益：Removes 3 CDN module requests (about 130 KB minified / 50 KB gzip) and their parse/eval, ScrollTrigger's global listeners, and refresh() on every world measure/resize. This lands while the cards are on screen. Estimated 5–15 ms of main thread on desktop, 20–60 ms on a throttled phone.
  - 做法：Add a helper patch on extra['finnovation-world.js'], appended after the world helpers: `const motion = reducedMotion || sectionMotion ? Promise.resolve() : Promise.all([import(GSAP_URL), ...` The removed branch is exactly the one that was already a no-op; ScrollTriggerRef stays null, so refreshTriggers becomes a no-op. Nothing reads world.motion.

Verify:
- Network panel: no gsap requests after the world mounts.
- scripts/index1-5/world-shot.cjs screenshots identical.
  - 檔案：prototypes/index1-5/js/finnovation-world.js、prototypes/index1-5/section-motion.js
- **hero-waits-for-canyon** — The first hero frame waits for the whole valley build and its terrain textures（桌機畫面：identical；風險 medium；large）
  - 收益：The hero shows earlier by the terrain download time: estimated 0.5–3 s on slow mobile networks, 0.1–0.3 s on desktop broadband. Step 2 also removes the whole valley build time, which is seconds at 4× CPU. Trade-off for step 2: the hero shares the main thread with 6 ms build slices while the valley builds.
  - 做法：Step 1 (medium): before building, await only loadAlpineDetail.
- Give the alpine/highland materials 1×1 placeholder textures of the same type and colourSpace, so programs don't change.
- Swap the real maps in as they arrive and add their promise to canyon.ready. prepareJourney already awaits canyon.ready (main.js:6578), and the journey gate (6664-6668) holds scrolling until journeyReady.

Step 2 (large, optional): start frame() before the canyon exists, behind a stub that guards updateJourneyCamera, openingWorld, bridgeMosaic and alpine-ui until it is built. The hero then shows while the valle
  - 檔案：prototypes/index1-5/js/main.js、prototypes/index1-5/js/water-journey-scene-463.js、prototypes/index1-5/js/index1-5-terrain.js、prototypes/index1-5/js/alpine-erosion.js
- **compositor-under-cover** — Hide #gl, .wash and .grain while the cards or the world fully cover them（桌機畫面：identical；風險 low；small）
  - 收益：GPU/compositor: removes 2 full-screen quads and one full-screen blend render pass per frame through the cards and the world. Estimated 0.5–2 ms of GPU per frame on phones and integrated GPUs, little on discrete desktop GPUs. Also frees the grain and wash tiles.
  - 做法：In the main frame loop, write only on change: `body.classList.toggle('i15-covered', !!(world?.covering || portfolio?.covering))`. In index1-5.css (layout-only, regenerated into site-layout.css): `body.i15-covered :is(#gl,.wash,.grain){visibility:hidden}`.

`covering` is the same threshold the page already relies on: at c ≥ .4 the cloud deck is fully opaque and the background is opaque from .46; the portfolio ground is solid at amount 1.

Verify:
- world-shot.cjs pixel A/B at global, ocean, principles, seal, footer, and through the bridge.
- Layers panel shows the three layers gone in the world
  - 檔案：prototypes/index1-5/index1-5.css、prototypes/index1-5/site-styles-build.cjs、prototypes/index1-5/js/main.js
- **bridge-ink-root-var** — Write --alp-bridge-ink on the header, not on <html>（桌機畫面：identical；風險 low；small）
  - 收益：Removes about 25 whole-document style recalcs during the valley → cards bridge, the heaviest stretch of the page. Estimated 1–4 ms each on phones, 0.2–1 ms on desktop.
  - 做法：In alpine-ui.js (a source file loaded directly, not generated), cache `.finnovation-ui .fi-header` and setProperty on it; --alp-bi is computed on that same element, so the cascade result is unchanged. Bump the `?v=` on the alpine-ui.js script tag by hand: build.cjs's `/alpine-ui.js?v=i15-…/` regex never matches (the `?` is unescaped), and the current tag uses `reading-…`.

Verify:
- Bridge screenshots identical.
- Trace: Recalculate Style element counts drop during the bridge.
  - 檔案：prototypes/index1-5/alpine-ui.js、index1-5.html
- **flash-layer-idle** — Stop repainting the invisible transition flash（桌機畫面：identical；風險 low；small）
  - 收益：Small: removes a per-frame style, paint and raster of an oversized layer while the mouse moves in the hero and during the logo flight. Estimated 0.05–0.2 ms main thread plus the raster work.
  - 做法：In a main.js helper:
- Write the two vars (and the scale) only while flashAlpha > 0, plus once on the frame it becomes > 0.
- Use writeStyle to set visibility:hidden while p < .001 and after the flare has ended, and switch it back to visible as soon as p > .001, so the first flare frame is already rastered.

Verify:
- motion-ab A/B over the dispersal is identical.
- A hero pointer-move trace shows no Paint for #transitionFlash.
  - 檔案：prototypes/index1-5/js/main.js、prototypes/index1-5/index1-5.css
- **section-two-dead** — Take the never-shown Section Two out of layout (display:none)（桌機畫面：identical；風險 low；small）
  - 收益：Probably about 76 KB less font download at startup (confirm in the network panel). Also removes 7 running animations, about 9 layers, and that subtree's style and layout work.
  - 做法：Add to index1-5.css: `html[data-look="index1-5"] .section-two{display:none!important}`. The JS only writes its style and class, so nothing breaks.

Verify:
- Network panel: latin-italic.woff2 should no longer load at startup. It may still load later for the ↑ / ↓ arrows inside `<i>` in the world.
- Screenshots identical.
  - 檔案：prototypes/index1-5/index1-5.css、index1-5.html
- **dead-legacy-startup** — Skip legacy objects that index1-5 builds at startup but never shows（桌機畫面：identical；風險 low；medium）
  - 收益：About 3–7 MB less JS heap (matters on phones), a few to about 20 ms less main-thread startup work (the empty polygonise pass and the normal texture), and 2–3 fewer requests on the hero's critical path.
  - 做法：In a main.js helper:
- Create the MarchingCubes only when !dropSDF. Otherwise use a small stub {visible:false, position, scale, layers}, which is enough for rayHitsCluster and __MONTIS_STUDY__; keep ?drop=mesh fully working.
- Skip Water and waterNormal when not used, and guard their per-frame writes.
- Drop the tuft-atlas load on index1-5 via the terrain set in alpine-team-build's source.

Verify:
- ?drop=mesh still works.
- Hero pixel parity.
- JS heap with scripts/perf-ab/heap-profile.cjs.
  - 檔案：prototypes/index1-5/js/main.js、prototypes/index1-5/js/index1-5-terrain.js、prototypes/index1-5/alpine-team-build.cjs
- **duplicate-module-instances** — Remove duplicate module instances caused by mismatched import URLs（桌機畫面：identical；風險 low；small）
  - 收益：3 fewer requests and about 65 KB less parse/eval at startup, one module level shallower on the critical path, and one fewer duplicated config object.
  - 做法：- Make the tufts use the versioned specifiers (rewire in alpine-team-build), or import the tufts module lazily, since index1-5 returns null anyway.
- Align the story import query in the helper that generates finnovation-interface.js.

Verify:
- Network panel shows each file once.
- Canyon pixel parity.
  - 檔案：prototypes/index1-5/js/alpine-canyon-tufts.js、prototypes/index1-5/alpine-team-build.cjs、prototypes/index1-5/js/finnovation-interface.js、prototypes/index1-5/cards-bridge-build.cjs
- **per-frame-garbage** — Stop re-parsing colour strings and rebuilding keys every frame（桌機畫面：identical；風險 low；medium）
  - 收益：Estimated 5–10 KB less garbage per frame (the 10/04 report measured 29–35 KB per frame) and about 30–60 µs of CPU per frame on desktop, roughly 4× that on throttled phones. That means fewer minor-GC pauses (0.5–2 ms each) during scrolling.
  - 做法：Memoise and reuse:
- A hex → rgb Map; paletteLinear keyed on (hex, CONFIG.scene.exposure).
- openingWorld.apply() only when the key of its inputs changes.
- Compare the 6 terrain numbers instead of JSON.stringify. The watershed is not passed through the late helper loop, so build.cjs must forward `watershed`, or the change goes in alpine-team-build.
- Pass preallocated targets to the curve calls.
- Precompute the LOOK colours once.
- Rebuild the portfolio key only when the config changes.
Results are bit-identical.

Verify:
- scripts/perf-ab/heap-profile.cjs KB/frame before and after.
- motion
  - 檔案：prototypes/index1-5/js/main.js、prototypes/index1-5/opening-world.js、prototypes/index1-5/alpine/alpine-cloud-banks.js、prototypes/index1-5/js/water-journey-scene-463.js、prototypes/index1-5/js/water-canyon-watershed-463.js、prototypes/index1-5/js/finnovation-world.js、prototypes/index1-5/js/portfolio-epilogue-polish.js
- **module-waterfall** — Preload the whole static module graph (and optionally minify)（桌機畫面：identical；風險 low；small）
  - 收益：Removes up to about 4 round trips of module discovery before startJourneyScene runs: estimated 0.3–0.8 s on Slow 4G with 150 ms RTT, 50–150 ms on broadband. Minifying would also cut about 200 KB of gzip transfer.
  - 做法：Add a last build step (e.g. modulepreload-build.cjs) that walks the rewired static imports of main.js and injects `<link rel=modulepreload>` with the exact ?v= URLs the build writes, plus the resolved jsDelivr addon URLs. Leave out the lazy chunks (portfolio, world, logo panels).

Optional: minify the generated modules. That needs a dev dependency such as esbuild, so ask before installing.

Verify:
- boot-profile.cjs on the phone profile: request waterfall and time to hero.
- Identical screenshots.
  - 檔案：index1-5.html、prototypes/index1-5/build.cjs
- **phone-glass-and-blend** — Phones: drop the backdrop-filter glass, the soft-light wash and the CSS grain（桌機畫面：identical；僅手機；風險 low；small）
  - 收益：On phones: one fewer full-screen blend pass and one fewer full-screen translucent layer per frame for the whole journey, plus the small per-element blur passes. While the menu is open, two near-full-screen blurs per frame go away: estimated 1–4 ms of GPU on mid-range phones.
  - 做法：Expose the JS mobile budget as an attribute: one line in mobile-performance-build.cjs, e.g. `document.documentElement.dataset.mobileBudget = '1'`, so CSS gates on the same rule as the JS. Under `html[data-mobile-budget]`, in index1-5.css:
- backdrop-filter:none on the elements above, with fills about 10–15% more opaque.
- `.wash, .grain { display: none }`.

Verify side by side on a real phone.
  - 檔案：prototypes/index1-5/index1-5.css、prototypes/index1-5/mobile-performance-build.cjs
- **portfolio-loop-suspended** — Let the card strip's rAF loop sleep while the world fully covers it（桌機畫面：identical；風險 low；small）
  - 收益：Small: one fewer rAF callback and about 10 small allocations per frame for the whole world epilogue.
  - 做法：In the helper that generates this module: when `suspended && open && amount===1 && velocity===0`, don't re-arm run(). setExit(v<1), take() and close() already call run(). Also build the grade key only on config change.

Verify:
- motion-ab over world → cards → valley.
- Trace shows no portfolio tick inside the world.
  - 檔案：prototypes/index1-5/js/portfolio-epilogue-polish.js、prototypes/index1-5/motion-polish-build.cjs
- **dom-write-hygiene** — Guard unconditional per-frame DOM writes in the world and journey code（桌機畫面：identical；風險 low；small）
  - 收益：Small: tens of µs per frame. Avoids attribute-change notifications (more costly when an accessibility client is active) and any per-frame inert invalidation.
  - 做法：- Cache last written strings, as the ocean and logo modules do.
- Keep the pose key in a WeakMap instead of a data attribute.
- Guard classList.remove with contains(), and guard inert with a compare.
- Hoist the spans array out of the frame.

Verify:
- Identical screenshots.
- Trace shows fewer attribute mutations and Recalculate Style entries in the world.
  - 檔案：prototypes/index1-5/world-principles.js、prototypes/index1-5/section-motion.js、prototypes/index1-5/js/finnovation-world.js、prototypes/index1-5/js/main.js
- **ocean-photo-forced-layout** — Ocean photos read layout after the frame's style writes (forced style recalc)（桌機畫面：identical；風險 medium；medium）
  - 收益：Removes one forced style recalc per frame while the ocean strip moves: estimated 0.1–0.5 ms on desktop, more on phones.
  - 做法：Compute the rect instead of reading it:
- At layout()/measure(), cache each image's offset and size inside its panel.
- Per frame: rect = cache + the panel's translate (next.x from oceanPanelState) + the figure's motion pose (--motion-y and --motion-scale from section-motion).
- Keep the DOM read as a fallback on resize/measure.

Verify with world-shot.cjs at several ocean stops and during motion: the GL photo must stay exactly on the HTML frame.
  - 檔案：prototypes/index1-5/world-ocean-photos.js、prototypes/index1-5/world-ocean.js
- **cards-displacement-bake** — Bake the card strip's displacement map instead of computing it on the main thread（桌機畫面：identical；風險 low；small）
  - 收益：Estimated 30–100 ms of chunked main-thread work on desktop and 150–400 ms on throttled phones, removed from the late-canyon scroll.
  - 做法：Run the same function once in Chrome and save the result as a lossless PNG next to the page assets. At runtime, load it with createImageBitmap and pass it as `displacement` to createSlider; the shared slider already accepts a prepared canvas or image. Keep prepareSlider as the fallback. The shared js/ file stays untouched.

Verify: card strip pixel parity in Chrome. Check Safari separately, since Math.sin can differ between engines.
  - 檔案：prototypes/index1-5/js/portfolio-epilogue-polish.js、prototypes/index1-5/motion-polish-build.cjs
- **daylight-root-vars** — scene-daylight writes six :root custom properties that nothing visible reads（桌機畫面：identical；風險 low；small）
  - 收益：Nothing today. It prevents a per-frame whole-document recalc (estimated 1–6 ms on phones) if auto daylight is re-enabled.
  - 做法：Write only --scene-ink and --scene-glass (two values each), only when their string changes, or only while the clock/stat UI exists. Keep the data-scene-phase write cached.
  - 檔案：prototypes/index1-5/scene-daylight.js
- **safari-image-fallback** — Decode world textures off the main thread in the HTMLImage fallback（桌機畫面：identical；風險 low；small）
  - 收益：Tens of ms per texture (4 textures), only on browsers that take the fallback (likely some iOS Safari versions; not verified).
  - 做法：`await image.decode().catch(() => {})` before resolving in the fallback branch. Output is unchanged.
  - 檔案：prototypes/index1-5/world-image-source.js
- **alpine-ui-loop** — alpine-ui and logo panel: idle loops that do nothing, allocating label placement（桌機畫面：identical；風險 low；small）
  - 收益：Small: about 0.05–0.2 ms per frame in FOUR PATHS on desktop, more on phones, and one fewer perpetual rAF and timer.
  - 做法：- Skip updateLabels when the canyon camera's matrixWorld and the chapter are unchanged since the last placement; the output is identical.
- Reuse vectors and boxes.
- Stop the loop while body has is-world / is-portfolio and restart it on change.
- Start the logo-panel interval only when the panel opens.
  - 檔案：prototypes/index1-5/alpine-ui.js、prototypes/index1-5/logo-panel.js
