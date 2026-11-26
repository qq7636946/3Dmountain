/* The three-shot rhythm belongs only to index1-5-canyon-forest-rise.html.
   ?rhythm=0 compares the previous pacing. ?motionqa=1 exposes read-only
   measurements in #rise-motion-qa; neither adds controls to the public page. */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search);
  const enabled = q.get('rhythm') !== '0';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = x => Math.max(0, Math.min(1, x));
  const smoother = x => { x = clamp(x); return x * x * x * (10 + x * (-15 + 6 * x)); };
  const overlapCopy = document.documentElement.hasAttribute('data-rise-overlap');
  const silkFlow = document.documentElement.hasAttribute('data-rise-silk-flow');
  const tune = {
    surfaceSeconds: 1.52, surfaceWeight: 4.5,
    spring: 10.8,
    silkLambda: 4.6, worldLambda: 3.8, silkEase: .085,
    strokeSeconds: 1.12, returnSeconds: 1.02,
    anticipation: .56, askLead: .14, canyonCarry: .28, returnIntent: .18,
    glideSlope: 1.45,
    arrivalSeconds: 3.45, lightAt: .78, lightSeconds: 1.32, lineOut: .64
  };
  const profile = {
    tune, smoother, overlapCopy,
    active() {
      const rise = window.__RISE__?.state, forest = window.__FLOW2_FOREST_ATLAS__;
      const view = forest?.studio;
      return (rise?.state === 'gorge' && Math.abs(rise.pT - rise.p) > .01)
        || window.__FLOW2_LIFT_CUT__?.state.phase === 'play'
        || !!(forest?.state.view && view && (view.state.arrival < .9999
          || (view.state.lines ?? 0) > .001
          || view.state.routeProgress < view.curtain.config.progress - .001));
    },
    // C2 end: incoming speed continues into the wipe, then acceleration and
    // velocity both reach zero. Unlike a fractional power there is no jerk
    // singularity at the end of the moving canyon shot.
    glide(t, slope = tune.glideSlope) {
      t = clamp(t);
      slope = Math.max(1, slope);
      // A fast CTA can exhaust the available canyon distance. Preserve its
      // actual incoming speed with a monotone C2 braking curve rather than
      // clipping velocity when the wipe starts (the quintic is monotone only
      // below a 2.5 initial slope).
      if (slope > 2.4) return 1 - Math.pow(1 - t, 2 * slope - 1) * (1 + (slope - 1) * t);
      return slope * t + (10 - 6 * slope) * t ** 3
        + (-15 + 8 * slope) * t ** 4 + (6 - 3 * slope) * t ** 5;
    },
    canShowCopy() {
      const rise = window.__RISE__?.state;
      return !rise || rise.state !== 'gorge'
        || (!rise.pre && (rise.waterline?.height ?? -100) > (overlapCopy ? -.08 : .06));
    }
  };
  if (overlapCopy) Object.assign(tune, {
    surfaceSeconds: 1.40, surfaceWeight: 3.75, anticipation: .59, askLead: .20,
    strokeSeconds: 1.08, returnSeconds: .98, arrivalSeconds: 3.25
  });
  if (silkFlow) Object.assign(tune, {
    surfaceSeconds: 1.24, surfaceWeight: 3.1, anticipation: .56, askLead: .22,
    canyonCarry: .32, returnIntent: .14,
    strokeSeconds: 1.04, returnSeconds: .92, arrivalSeconds: 3.05, lightAt: .72, lightSeconds: 1.25
  });
  if (enabled) window.__RISE_RHYTHM__ = profile;

  // Use unified silky exponential glide under data-rise-silk-flow (liquid immediate start + smooth tail across canyon and WHY sea);
  // other pages keep the critically damped spring (10.8/s).
  let attempts = 0;
  function configure() {
    const silk = window.__SILK__;
    if (!silk && attempts++ < 240) { setTimeout(configure, 125); return; }
    if (silk && enabled && !reduced.matches) {
      if (silkFlow && q.get('silk') !== '0') {
        silk.on = 1;
        silk.world = 1;
        silk.lambda = tune.silkLambda;
        silk.worldLambda = tune.worldLambda;
        silk.ease = tune.silkEase;
      } else {
        silk.on = 0;
        silk.SPRING = tune.spring;
      }
    }
  }
  configure();

  if (q.get('motionqa') !== '1') return;
  const output = document.createElement('output');
  output.id = 'rise-motion-qa'; output.hidden = true;
  document.body.append(output);
  const groups = Object.create(null), events = [], samples = [];
  const round = x => Number.isFinite(x) ? +x.toFixed(4) : null;
  let previousStage = '', lastPublish = 0;
  const start = performance.now();
  function sample() {
    const time = performance.now(), R = window.__RISE__?.state;
    const C = window.__FLOW2_LIFT_CUT__?.state, A = window.__FLOW2_FOREST_ATLAS__;
    const J = window.__MONTIS_STUDY__?.journey, V = A?.studio?.state;
    const stage = R?.state === 'gorge' ? (Math.abs(R.pT - R.p) > .01 ? 'surface' : 'underwater')
      : C?.phase === 'play' ? (C.dir > 0 ? 'wipe-in' : 'wipe-out')
      : A?.state.view ? ((V?.arrival ?? 1) < .999 || (V?.lines ?? 0) > .001 ? 'forest-arrival' : 'forest')
      : 'canyon';
    if (stage !== previousStage) {
      events.push({stage, ms: Math.round(time - start)});
      if (events.length > 40) events.shift();
      previousStage = stage;
    }
    const group = groups[stage] ||= {last: 0, intervals: []};
    if (group.last && time - group.last < 250) {
      group.intervals.push(time - group.last);
      if (group.intervals.length > 360) group.intervals.shift();
    }
    group.last = time;
    if (time - lastPublish < 100) return;
    lastPublish = time;
    const pose = {ms: Math.round(time - start), stage,
      progress: round(J?.progress), target: round(J?.target), velocity: round(J?.velocity),
      depth: round(R?.waterline?.height), phase: C?.phase, cut: C?.t, dir: C?.dir,
      azimuth: round(V?.azimuth), colour: round(V?.arrival), light: round(V?.routeProgress), lines: round(V?.lines)};
    if (C?.phase === 'play' && overlapCopy) {
      const ui = window.__MONTIS_STUDY__?.journeyUI?.root;
      pose.copy = ui?.dataset.chapter;
      const alpha = ui?.querySelector('.fi-copy')?.style.getPropertyValue('--rise-brush-copy');
      if (alpha) pose.copyAlpha = Number(alpha);
    }
    samples.push(pose); if (samples.length > 100) samples.shift();
    const timing = Object.fromEntries(Object.entries(groups).map(([name, g]) => {
      const a = [...g.intervals].sort((a, b) => a - b);
      return [name, {frames: a.length, medianMs: round(a[a.length >> 1]), p95Ms: round(a[Math.floor(a.length * .95)])}];
    }));
    output.textContent = JSON.stringify({enabled, ...pose, ready: R?.stage, notes: R?.notes,
      timing, events, samples, forestErrors: A?.state.errors, cutState: C,
      quality: window.__FLOW2_QUALITY__?.state,
      draw: window.__MONTIS_STUDY__?.renderer?.info.render,
      surfaceCpuMs: window.__RISE__?.stats?.().cpuMsMedian});
  }
  window.__RISE_MOTION_SAMPLE__ = sample;
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {}, before = host.attach;
  host.attach = function(h) {
    try { return before?.call(this, h); }
    finally {
      if (h?.composer) {
        const render = h.composer.render;
        h.composer.render = function(...args) {
          const result = render.apply(this, args);
          if (window.__RISE__?.state.state !== 'gorge') sample();
          return result;
        };
      }
    }
  };
})();
