/* Flow2 look (2026-11-11): the panel settings the client exported and asked to keep (「設定用這個」). index1-5-flow2.html only.
   The whole export is kept as it was pasted in flow2-look-20261111.json. Compared with what the page had (read at the
   journey's end, where it was exported), it differs in two groups, and those are what this file sets:
   - watershedFlow   the lights that run down the four rivers at FOUR PATHS: a little dimmer, far less glow around them and at
                     their heads, long tails, and they join more firmly at the confluence
   - sceneDaylight   the sun 19 degrees to the left and at 47% of its height, 11% stronger; the sky's light 1% lower
   and one value asked for afterwards: logo.logo3Blue (see below)
   Everything else in the export that differed from the page (alpineLight's aerial sun, sun strength, rim, shade and ambient;
   openingWorld's sun) is what the page itself works out from sceneDaylight when it starts. Those are NOT set here: set as
   well, the daylight would be applied twice (the sun at 22% of its height instead of 47%).
   main.js merges window.__FLOW2_PRESET__ into its settings before anything is built. Loaded after flow2-water.js (which
   assigns that object) and before main.js. ?look=0 leaves these out (the page's settings as they were). */
(() => {
  if (new URLSearchParams(location.search).get('look') === '0') return;
  const LOOK = {
    watershedFlow: { brightness: .75, glow: .15, coreTint: .14, join: 2, headBright: 2.3, headGlow: .4, tail: 2.15, spacing: 1.4 },
    sceneDaylight: { azimuth: -19, elevation: .47, sun: 1.11, sky: .99 },
    /* asked for separately, a few minutes after the export (「幫我這改掉」, on a close-up of the wordmark's F): the stroke inside
       the F was the brand's saturated blue (logo3Blue .9), the one piece of solid colour among letters of clear water. It is
       the same water as the letters now. The panel's 品牌藍濃度 brings the blue back (the export itself had .9). */
    logo: { logo3Blue: 0 }
  };
  const preset = window.__FLOW2_PRESET__ ||= {};
  for (const [group, values] of Object.entries(LOOK)) preset[group] = { ...(preset[group] || {}), ...values };
  document.documentElement.dataset.flow2Look = '20261111';
})();
