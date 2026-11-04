      /* SEA_FLOW (index1-5-flow test page, 2026-11-04; injected by prototypes/index1-5-flow/make.cjs). Client: 「這塊滾下去要接這塊」: 06 FOUR PATHS
         is followed by the four strategies over the sea, then the cards, the planet, the rest. 06 → 07 is the page's ORIGINAL 06 → cards transition
         (「我的轉場要原本那個網格」): the same applyBridgeView (the valley's air thickening, the camera's own glide) and the same bridgeMosaic grid,
         driven by the same clock as the cards' bridge (portfolio-epilogue-polish.js takeBridge/tick): CONFIG.mist.steps wheel notches, its follow,
         its exponential easing. Only the destination differs: the world's sea leg, faded in as the cards were (finnovation-world.js seaIn), opens
         on the first strategy. Scrolling up plays it back; at its start the world closes again. */
      const seaFlow = (() => {
        const M = () => CONFIG.mist || {};
        let open = false, bt = 0, amount = 0, velocity = 0, quiet = 0, nav = false, wantNav = false, ready = false, hooked = false, painted = '';
        const unit = () => 100 / Math.max(720, innerHeight * .85);   // one wheel notch in journey units (the wheel handler's conversion)
        /* the cards' bridge length (portfolio-epilogue-polish.js span()): STEPS notches on every screen, else the old LENGTH */
        const span = () => { const m = M(), steps = +m.steps; if (Number.isFinite(steps) && steps >= 2) return steps * unit(); const v = +m.length; return Number.isFinite(v) && v > .2 ? v : 1.3; };
        const atEnd = () => journey.progress > journey.max - .45 && journey.target > journey.max - .001;
        const worldReady = () => { if (world && !hooked) { hooked = true; world.ready.then(() => { ready = true; }, () => { }); } return !!world && ready; };
        /* the sea is up (under its fade) from the bridge's first notch, as the cards were; until the world is prepared the page holds at 06's end */
        function begin() {
          if (open) return true;
          if (!world) { void loadWorld(); return false; }
          if (!worldReady()) return false;
          open = true; bt = 0; nav = false;
          if (!(world.open && world.leg === 'sea')) world.enter(0, 'sea');
          return true;
        }
        function close(instant) { open = false; bt = 0; nav = wantNav = false; if (instant) { amount = 0; velocity = 0; } paint(); }
        function take(delta) {
          if (!worldEpilogue || !Number.isFinite(delta) || portfolio?.open) return false;
          if (world?.open && !world.seaLeg) return false;   /* (the sea leg is the bridge's own: wheeling back down while it plays back picks it up where it is) */
          if (!open) {
            if (performance.now() < quiet && delta < 0) return true;
            const J = journey;
            /* BRIDGE_FLOW as in the cards: the notch that carries the journey over its end starts the bridge with what is left of it (the journey takes its own part: false) */
            if (delta > 0 && J.progress > J.max - .45 && J.target < J.max - .001 && J.target + delta > J.max + .001) { if (begin()) bt = Math.min(1, (J.target + delta - J.max) / span()); return false; }
            if (!atEnd() || delta <= 0) return false;
            if (!begin()) return true;
          }
          /* the bridge is over: forward scrolling is the sea's (and, past the last strategy, the cards' own bridge) */
          if (bt >= 1 && delta > 0) return false;
          if (delta * (bt - amount) < 0) { bt = amount; velocity = 0; }
          const next = bt + delta / span();
          if (next <= 0) { close(); quiet = performance.now() + 250; if (next < 0) advanceJourney(next * span()); return true; }
          /* whatever is left of a wheel step past the end already rides the sea (as it rode the card strip) */
          if (next > 1) { bt = 1; world?.take((next - 1) * span()); return true; }
          bt = next; return true;
        }
        /* NEXT on 06 or a chapter link: the whole bridge, then the first strategy */
        function navigate() { wantNav = true; if (begin()) { bt = 1; nav = true; wantNav = false; } }
        /* put at the end at once (a chapter jump under the mist, the way back from the cards) */
        function settle() { if (!begin()) { open = true; } bt = amount = 1; velocity = 0; nav = false; paint(); }
        /* QA: hold the bridge at z (0–1) without its follow, for frame studies (window.__MONTIS_STUDY__.seaFlow.pose(.5)) */
        function pose(z) { begin(); bt = amount = Math.max(0, Math.min(1, +z || 0)); velocity = 0; nav = false; paint(); }
        function frame(dt) {
          if (open && journey.target < journey.max - .3) close();
          if (wantNav && begin()) { bt = 1; nav = true; wantNav = false; }
          const target = open ? bt : 0;
          /* reduced motion: no glide, no grid (applyBridgeView and the mosaic stand down); the sea only fades in, over .6 s */
          if (reduceMotion) { const before = amount; amount = target > amount ? Math.min(target, amount + Math.max(0, dt) / .6) : Math.max(target, amount - Math.max(0, dt) / .6); velocity = dt > 0 ? (amount - before) / dt : 0; }
          else {
            /* the cards' bridge follow (tick: BRIDGE_FLOW): exponential from its first frame at FOLLOW × 7.2 / 11.5 per second */
            const follow = +M().follow, omega = Number.isFinite(follow) && follow > 1 ? follow : 5.5;
            const before = amount; amount = Math.max(0, Math.min(1, amount + (target - amount) * (1 - Math.exp(-omega * 7.2 / 11.5 * Math.max(0, dt)))));
            if (Math.abs(amount - target) < .001) amount = target;
            velocity = dt > 0 ? (amount - before) / dt : 0;
          }
          /* played back to its start: the sea goes away again */
          if (!open && amount === 0 && world?.seaLeg && !portfolio?.open) world.close();
          if (nav && amount > .97) { nav = false; world?.scrollTo(world.targetOf('responsibility')); }
          paint();
        }
        /* 06's words go as they did when the cards came: paintBridge's outgoing (1 − smooth(.1, .42)) leaves them whole on the live page (its stylesheet
           outranks that opacity) and hides them once it reaches 0, at .42 of the bridge (measured); the valley's labels go at the bridge's start
           (body.is-portfolio hid them). Both stay away while the sea, the cards or the world are up. */
        function paint() {
          const up = world?.open && !open ? 1 : 0;
          const out = Math.max(amount >= .42 ? 1 : 0, up), labels = Math.max(open || amount > 0 ? 1 : 0, up);
          const key = out.toFixed(3) + '|' + labels;
          if (key === painted) return; painted = key;
          const b = document.body.style; b.setProperty('--sea-out', out.toFixed(3)); b.setProperty('--sea-labels', String(labels));
          document.body.classList.toggle('is-sea-flow', out > .001 || labels > 0);
          document.body.classList.toggle('is-sea-flow-out', out > .995);
        }
        return { take, frame, navigate, settle, pose, close, paint,
          get open() { return open; }, get amount() { return amount; }, get target() { return bt; }, get velocity() { return velocity; },
          get mosaic() { return amount; }, get span() { return span(); } };
      })();
      window.__SEA_FLOW__ = seaFlow;
