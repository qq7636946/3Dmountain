# Flow test build (2026-10-22)

Independent test page for index1-3 in the design language of two reference videos the client sent
(`810050509.354684.mp4`: drops gathering in a blue sky → a falling tear with forest inside →
fisheye pass-through → bubble over a meandering forest river; `00.mp4`: editorial serif type, corner
UI, iridescent bubble with a softbox highlight, portal and iris transitions).
Decisions and reference analysis: `docs/flow-reference-20261022.md`. Side by side:
`docs/flow/compare-20261022.jpg`; full sweep: `docs/flow/sweep-20261022.jpg`.

**Production is untouched.** `index1-3.html`, `js/`, `css/` are not modified and nothing here is loaded
by any other page. No image, model or video assets: everything is generated in code (fonts from
Google Fonts, three.js r170 from jsDelivr).

## Open it

- `http://localhost:5178/index1-3-flow` (any static server at the project root). The montis dev
  server drops query strings on its `.html` redirect: use `/index1-3-flow?p=4.5`, not
  `/index1-3-flow.html?p=4.5`.
- `?p=<0..10>` start at a point of the story; `?q=<.3..1>` quality (default 1, .5 under 760 px wide);
  `?fixed=1` disables the adaptive resolution; `?aerial=x,z` moves the forest chapter.
- `window.__FLOW__`: `seek(p)`, `pause()`, `step(n, dt)`, `skipIntro()`, `S` (current state),
  `tracks` (editable keys), `shots` (camera keys), `override = { pos, look, up, fov }` (hold a view),
  plus `renderer`, `camera`, `world`, `clouds`, `bubbles`, `post`.

## Story (p = scroll progress 0–10)

| p | chapter | scene |
|---|---|---|
| 0–1 | 01 Knowledge | drop and small drops in a blue sky above a sea of cumulus, title centred over the bubble |
| 1.1–2 | 02 Innovation | 14 small drops merge into the bubble (dent + ring per impact, volume growth) |
| 2–2.9 | (fall) | dive to the cloud tops; the bubble becomes a water tear; prism flare from the lower left |
| 2.9–3.4 | 03 Convergence | tear among the clouds, valley and blue ridges beyond; the tear shows the forest from above |
| 3.4–3.95 | (pass-through) | tear closes in (picture blurs at the lens's focal distance), flash, radial zoom blur, cut |
| 3.95–5.1 | 04 Value | top-down forest and river loop from ~430 m, defocused, bubble with the forest inside, tiny drops, mist |
| 5.1–6.3 | 05 Perspective | bubble shrinks, focus sharpens, camera rises over the valley (mist, mountain ring) |
| 6.2–6.6 | (iris) | the reference's vignette iris; cut |
| 6.5–7.3 | 06 Strategies | the confluence reach, all four tributaries lit |
| 7.4–10 | 06·01–04 | one view per tributary, its light running down into the main river |

## Files

- `flow.js` — controller: tracks (`TRACKS`, keyed per p, two keys at one p = cut), camera path
  (`buildShots`, Hermite through keys, stops on `hold` keys), scroll → p with inertia, panels
  (`--a` in, `--z` out, `--k` line stagger), counter, menu, chapter jumps (long jumps go through the
  iris), opt-in ambient sound (filtered noise, never autoplays), adaptive resolution, boot/fallback.
- `world.js` — sky (gradient, sun, cirrus), river network (sine-generated meanders, four tributaries
  joining the main river between z −1650 and −3350), river distance field (Felzenszwalb–Huttenlocher
  EDT on a 2048² grid, RGBA half float: bank distance, arc km, heading + id·8, half width), terrain
  (hills flattened into the floodplain, a mountain ring carved by the rivers), canopy (jittered trees,
  conifer/broadleaf/birch, finite-difference normals, short sun march for crown shadows, footprint
  LOD), water, flow light, aerial haze. Renders into MRT: colour + view depth.
- `clouds.js` — Perlin–Worley 64³ noise built on the GPU, half-res raymarch; per-shot slab
  (`cloudBase/Top/Scale`), coverage, a clear pocket at the lens (`cloudClear`), a clear column under a
  downward camera (`cloudHole`, `holeR0/R1`), a distance falloff (`cloudFar`).
- `bubble.js` — the drop: sphere ↔ teardrop morph, wobble, merge impacts; refraction through a
  solid water sphere (3 IORs) blended with a thin soap film; thin-film iridescence; rounded softbox
  highlight; portal mode (the drop shows another camera's view, `uPortal`, `uPortalBias`). Instanced
  small drops.
- `post.js` — composite (world·T + cloud scatter), half-res depth of field gathered from the mip
  chain, drop layer, light leak, fisheye + colour split, flash, zoom blur, ACES, grade, vignette,
  grain, iris.
- `flow.css` — type (Instrument Serif / Noto Serif TC / Inter), corner chrome, panels, menu, mobile.

## Verification used

Headless Chrome (`--use-angle=d3d11`) through Playwright with files routed from disk; freeze the
loop and drive frames: `__FLOW__.pause(); __FLOW__.skipIntro(); __FLOW__.seek(p); __FLOW__.step(4)`.
At 1920×1080 on the dev machine: 3.5 ms (sky) to 16 ms (top-down forest) per frame; phone width
renders at 0.8× scale. No console errors.

## Integrating later (only after approval)

This replaces index1-3's renderer, camera path and transitions, so the brief requires the client's
explicit go-ahead first. The page is self-contained: adopting it means pointing index1-3.html at
`prototypes/flow/` (or moving the folder to `js/flow/`) and keeping or dropping the Montis Vision block;
`js/main.js` and the other pages are not involved.
