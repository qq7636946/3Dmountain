# Maritime landscape test build (2026-10-20)

Independent test version of index1-3 in the realistic coastal look of <https://mont-fort.com/maritime/>:
overcast sky, warm eroded rock with dark scrub, deep navy water with white surf at the rock.
Proposal and decisions: `docs/maritime-landscape-proposal-20261020.md`. Before/after: `docs/maritime-landscape/compare-20261020.jpg`.

**Production is untouched.** Nothing here is loaded by index.html, index1-1, index1-2 or index1-3.

## Open it

- `http://localhost:5178/index1-3-maritime` (any static server at the project root).
- `?look=original` draws the page exactly as index1-3 does (A/B).
- **Colour pass COBALT (2026-10-20, default):** deep-blue banner and sea, ochre/olive land, one sand-ochre UI accent, banner sea raised (screenDown 60). `?look=overcast` = the grey maritime palette. Doc: `docs/maritime-cobalt-20261020.md`; script `patches/patch-c1-cobalt.cjs`.
- **Dusk pass (2026-10-21):** generated island plates + cloud plate (`images/maritime/`, Figma AI, originals in `_archive/source/maritime-generated-20261021/`), horizon afterglow, canyon dusk sky, warm low sun. Tuner group 「島嶼與雲 Horizon」. Doc `docs/maritime-dusk-20261021.md`; scripts `patches/patch-c2..c5`.
- `?tune=1` or T opens the tuner; group 「寫實山海 Maritime」 holds every new control, `開啟` 0/1 switches the look live.
- The montis dev server drops query strings on its `.html` redirect: use `/index1-3-maritime?look=original`, not `/index1-3-maritime.html?look=original`.

## How it is wired

- `index1-3-maritime.html` (project root, so document-relative assets resolve) = index1-3.html with the entry script pointed at `prototypes/maritime-landscape/js/main.js`, `noindex`, and `maritime.css`.
- `js/main.js` here is a copy of `js/main.js`; imports of the three `-463` modules point at the copies in this folder, every other import goes back to `../../../js/` (single module instances).
- Look changes live in: `main.js` (CONFIG.maritime, the shared water shader, tuner rows, `body.mar-land`), `water-journey-scene-463.js` (rock palette, scrub, wet rock, ochre streaks, light/sky/fog), `maritime.css` (veil, white type and smoky glass over land and water). `water-canyon-watershed-463.js` and `water-confluence-fx-463.js` are unmodified copies (import chain).
- `patches/` holds the scripts that made each pass (`scaffold.cjs`, `patch-m1` … `patch-m4`). Every replacement asserts a unique anchor, so the same scripts (with paths changed to `js/`) are the integration recipe.

## Integrating later (only after approval)

Gate it per page (`<html data-look="maritime">`) so the other pages that share `js/main.js` stay byte-identical in output, then re-run `node scripts/stamp-assets.mjs` for the page.
