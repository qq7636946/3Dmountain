/* Client adjustments for index1-5-1 only. Shared modules keep other pages' defaults. */
module.exports = ({ main, drops, letters, glass, html }) => {
  const anchor = '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));';
  const marker = '/* opening-refinement-20261025 */';
  if (!main.includes(marker)) {
    if (main.split(anchor).length !== 2) throw Error('opening refinement: defaults anchor');
    main = main.replace(anchor, `      ${marker}
      if (document.documentElement.hasAttribute('data-opening-refinement')) {
        // The wordmark moves down 200 CSS pixels on desktop, 100 on phones.
        CONFIG.logoFraming.y += innerWidth >= 760 ? 200 : 100;
        Object.assign(CONFIG.logoDrops, { uniformColor: 1, flyTime: 2.4,
          swirlMetal: 1, swirlMetalVar: 0, swirlEnvTurn: 0,
          swirlSunRim: 0, swirlSunGlint: 0 });
        // Keep the silver-blue material consistent through the opening burst.
        CONFIG.drop.iris = 0;
        CONFIG.beadLife.iris = 0;
      }
${anchor}`);
  }
  // Size still affects motion and shape, but must not change the material mix.
  const sizeTint = '+ (rel - 1) * .3';
  if (!drops.includes('C.uniformColor ? 0')) {
    if (drops.split(sizeTint).length !== 2) throw Error('opening refinement: material anchor');
    drops = drops.replace(sizeTint, '+ (C.uniformColor ? 0 : (rel - 1) * .3)');
  }

  if (!main.includes('flightSeconds:')) {
    main = main.replace('progress: tRaw, spin: logoSpin.quaternion, scale: markScale, edge: L.edge, reducedMotion: reduceMotion',
      "progress: tRaw, time, flightSeconds: document.documentElement.hasAttribute('data-opening-refinement') ? D.flyTime : 0, spin: logoSpin.quaternion, scale: markScale, edge: L.edge, reducedMotion: reduceMotion");
  }
  if (!letters.includes('let freeFlightTime')) {
    letters = letters.replace('  const freeRecords = [];', '  const freeRecords = [];\n  let freeFlightTime = null;');
    letters = letters.replace('progress = 0, spin, scale = 1', 'progress = 0, time = 0, flightSeconds = 0, spin, scale = 1');
    letters = letters.replace('    const riseDone = config.riseStart',
      '    const flightDelta = freeFlightTime === null ? 0 : Math.max(0, time - freeFlightTime);\n    freeFlightTime = time;\n    const riseDone = config.riseStart');
    letters = letters.replace('if (!on || !ready) { group.visible = false;',
      'if (!on || !ready) { freeFlightTime = null; for (const record of freeRecords) if (record) record.flightClock = 0; group.visible = false;');
    const anchor = '        const raw = (progress - start) / Math.max(.05, config.riseLength);\n        const u = Math.min(1, Math.max(0, raw));\n        delivery = freeRecords[letter.index] ??= { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };';
    if (letters.split(anchor).length !== 2) throw Error('opening refinement: free flight anchor');
    letters = letters.replace(anchor, '        delivery = freeRecords[letter.index] ??= { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };\n'
      + '        let raw = (progress - start) / Math.max(.05, config.riseLength);\n'
      + '        if (flightSeconds > 0) {\n'
      + '          // Scroll triggers each flight; seconds control its travel in either direction.\n'
      + '          const duration = Math.max(.05, flightSeconds);\n'
      + '          const direction = progress >= start ? 1 : -1;\n'
      + '          delivery.flightClock = reducedMotion ? (direction > 0 ? duration * 1.12 : 0)\n'
      + '            : Math.max(0, Math.min(duration * 1.12, (delivery.flightClock || 0) + direction * flightDelta));\n'
      + '          raw = delivery.flightClock / duration;\n'
      + '        }\n'
      + '        const u = Math.min(1, Math.max(0, raw));');
  }

  return { main, drops, letters, glass, html };
};
