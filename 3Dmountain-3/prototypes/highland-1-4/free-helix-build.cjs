/* index1-4 only. Kept in the build so generated animation modules are reproducible. */
module.exports = function freeHelixBuild({ main, drops, letters }) {
  const edit = (s, a, b) => {
    const count = s.split(a).length - 1;
    if (count !== 1) throw Error('free helix anchor: ' + count + ' × ' + a.slice(0, 85));
    return s.replace(a, b);
  };
  main = edit(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      // Pure water and independent letters share the chapter, not a delivery gate.
      Object.assign(CONFIG.logoDrops, { freeLetters: 1, popSpray: 0, fuseKick: 0, letterSize: .115, swirlRadius: 1.30, swirlLeaveStart: .54, swirlLeaveEnd: .90, swirlLeaveClimb: .25 });
      Object.assign(CONFIG.logoLetters, { freeHelix: 1 });
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
  main = edit(main, '          spin: logoSpin.quaternion, scale: markScale, edge: L.edge, reducedMotion: reduceMotion', '          progress: tRaw, spin: logoSpin.quaternion, scale: markScale, edge: L.edge, reducedMotion: reduceMotion');

  // Keep the old letter-size drops as pure water; they continue up instead of bursting.
  drops = edit(drops, '        const angle = swirlPlace(deliver.s[slot], 0, stringLift(letterPlace(slot)) + stringWave(letterPlace(slot)), carried, dock);', `        const departed = C.freeLetters ? clamp01((clock - .52 - slot / Math.max(1, count - 1) * .14) / .25) : 0;
        const rise = departed * departed;
        const angle = swirlPlace(deliver.s[slot] - (C.freeLetters ? C.leaveSpin * Math.PI * 2 * Math.pow(departed, 1.5) : 0),
          C.freeLetters ? C.swirlRadius * (C.leaveRadius - 1) * rise : 0,
          stringLift(letterPlace(slot)) + stringWave(letterPlace(slot)), carried, dock);
        if (C.freeLetters && rise > 0) dock.y += travelToClear(dock, radiusNow * 1.4, 1) * C.leaveRise * rise;`);
  drops = edit(drops, '        if (born <= 0) gone = true;\n        grow = (1 + .06 * docked)', '        if (born <= 0 || C.freeLetters && (departed >= .999 || angle < -Math.PI * 3 || dock.y > 2.6)) gone = true;\n        if (C.freeLetters) vanish = departed;\n        grow = (1 + .06 * docked)');
  drops = edit(drops, '        popping = clamp01(deliver.since[slot] / deliver.breakTime);', '        popping = C.freeLetters ? 0 : clamp01(deliver.since[slot] / deliver.breakTime);');
  drops = edit(drops, '      if (delivering && !water) {\n        /* The letter', '      if (delivering && !water && !C.freeLetters) {\n        /* The letter');
  drops = edit(drops, 'u.uSwirl.value = water ? C.swirlRing : 0;', 'u.uSwirl.value = water || C.freeLetters && delivering ? C.swirlRing : 0;');
  drops = edit(drops, 'if (water) u.uSwirlLook.value.set(C.swirlGloss, 1 - clamp01(C.swirlGlow), C.swirlCaustic); else', 'if (water || C.freeLetters && delivering) u.uSwirlLook.value.set(C.swirlGloss, 1 - clamp01(C.swirlGlow), C.swirlCaustic); else');

  // Letters get a reversible, scroll-driven score, independent of drop break timers.
  letters = edit(letters, '  function update({ on, deliveries, fuse = 0, spin, scale = 1, edge = .035, reducedMotion = false }) {', `  const freeRecords = [];
  const helixPoint = new THREE.Vector3();
  const easeHelix = x => { const t = Math.min(1, Math.max(0, x)); return t*t*t*(t*(t*6-15)+10); };
  function update({ on, deliveries, fuse = 0, progress = 0, spin, scale = 1, edge = .035, reducedMotion = false }) {
    if (config.freeHelix) fuse = smooth(progress, .80, .93);`);
  letters = edit(letters, '      const delivery = deliveries[letter.index];', `      let delivery = deliveries[letter.index];
      if (config.freeHelix) {
        const start = .035 + letter.index / last * .31;
        const raw = (progress - start) / .44;
        const u = Math.min(1, Math.max(0, raw));
        delivery = freeRecords[letter.index] ??= { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
        delivery.stage = raw > 0 ? 1 : 0;
        delivery.snap = u;
        delivery.alpha = smooth(u, 0, .12);
        delivery.lock = (raw - 1) / .12;
        delivery.scale = scale;
      }`);
  letters = edit(letters, '      const sized = THREE.MathUtils.lerp(delivery.scale, scale * breath, config.directedHelix ? smooth(snap, .10, .95) : travel);\n      pose.compose(place, turn, scaling.setScalar(sized));', `      let sized = THREE.MathUtils.lerp(delivery.scale, scale * breath, config.directedHelix ? smooth(snap, .10, .95) : travel);
      if (config.freeHelix) {
        // One open rising helix, then a quiet fan into the final letter positions.
        // All displacements and their tangents reach zero at lock: no pop into the wordmark.
        const rise = easeHelix(snap), fan = easeHelix((snap - .16) / .84);
        const orbit = reducedMotion ? 0 : .90 * (1 - easeHelix((snap - .28) / .72));
        const angle = .45 + letter.index * .33 - Math.PI * 2 * 1.12 * rise;
        helixPoint.set(Math.sin(angle) * orbit, -1.65 * (1 - rise), Math.cos(angle) * orbit * .50);
        if (reducedMotion) helixPoint.y *= .15;
        place.copy(helixPoint).applyQuaternion(inverse).addScaledVector(to, fan);
        turn.copy(inverse).multiply(twist.setFromAxisAngle(UPRIGHT, reducedMotion ? 0 : angle * .28 * (1 - fan))).slerp(identity, fan);
        sized = scale * breath * THREE.MathUtils.lerp(.50, 1, easeHelix(snap));
      }
      pose.compose(place, turn, scaling.setScalar(sized));`);
  return { main, drops, letters };
};
