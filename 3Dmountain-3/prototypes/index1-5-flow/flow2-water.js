/* Flow2 water look (2026-11-10): values only, for index1-5-flow2.html only. The opening's flow, timing and parts stay exactly as
   they were (client: 「我要原本的樣子，更加強融合整個設計畫面」「3D 建模要更水感，邊緣不要那麼銳利」).

   main.js merges window.__FLOW2_PRESET__ into its settings right after its own preset, before anything is built, so the
   wordmark is cast with these values from the start (no rebuild) and the tuner (T) shows and resets to them.
   Loaded before main.js. ?water=0 leaves it out (the look as it was).

   THE LETTERS — more like water, edges not so sharp
   - bevelSize / bevel / bevelSegments / depth: the chamfer was a hard ridge 0.0045 of the letter height wide round each face,
     with flat walls behind it (a cut block). The face now turns into the side over a round shoulder three times as wide and
     twelve steps fine, cut into the face so the outline and the weight of the letters stay exactly the brand's. That needs
     this page's copy of the geometry worker (below); the shared one caps bevelSize at 0.0045. Wider than about 0.016 folds
     the thin strokes' corners over (the a's foot, the i's stem), so it stops there. Depth is lowered so the letters are
     no thicker than before.
     (The tuner's 倒角寬度 slider still stops at 0.0045: moving it brings the narrow chamfer back.)
   - edge 0: no hairline drawn along the outline.
   - glEdge, glInk: the bright line on the outline and the dark ring just inside it were what read as a drawn, hard edge; both
     are taken most of the way down (a drop of water keeps a little of each).
   - graze, glBand, reflectionStrength: reflections where the surface turns away were a thin bright band on the chamfer; calmer.
   - glGlintPow, sunPow, rough, envRoughness: highlights wider and softer instead of pin-sharp.
   - swell, normalScale: the faces move a little more, like a liquid surface.
   - sss, shade: light carries through the edges instead of darkening them.
   BLENDING INTO THE SCENE
   - glBounce, glFill: the sea's blue comes up into the letters' undersides and the sky's into their tops.
   - the string of beads (haze, swirlHaze, swirlDefocus): far beads take a little of the air's colour and go slightly soft, near
     ones stay crisp, so they sit at different depths in the same air; (swirlSunRim, swirlSunGlint) they catch the scene's light
     on the side facing it. */
(() => {
  if (new URLSearchParams(location.search).get('water') === '0') return;
  /* this page's copy of the wordmark's geometry worker: the same builder, but a bevelSize above .0045 is cut into the face
     as a wide round shoulder (the shared one caps it there) */
  window.__FLOW2_LOGO_WORKER__ = 'prototypes/index1-5-flow/js/water-logo-geometry-worker.flow2.js?v=1';
  window.__FLOW2_PRESET__ = {
    /* second step (client: 「水字再圓潤一點」): the shoulder a little wider (.016, the widest before the a's foot folds) and much
       deeper (.075) with the block itself thinner, so most of a letter's side is curve; the surface-tension dome on the face
       stronger (glLens); outline line and ring almost gone */
    logo: { bevelSize: .016, bevel: .075, bevelSegments: 16, depth: 1.1, edge: 0 },
    logoGlass: {
      glLens: 3.8, glEdge: .03, glInk: .06, graze: .42, glBand: .15, reflectionStrength: 1,
      glGlintPow: 11, sunPow: 90, rough: .022, envRoughness: .07,
      swell: .4, normalScale: .12, sss: .14, shade: .12, glRim: .4,
      glBounce: .18, glFill: .14
    },
    logoDrops: { haze: .4, swirlHaze: .28, swirlDefocus: .7, swirlSunRim: .25, swirlSunGlint: .5 }
  };
  document.documentElement.dataset.flow2Water = 'on';
})();
