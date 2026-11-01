/* Local to index1-5 (2026-10-31). Edits that existed only in the generated output, so a rebuild silently lost them. Kept here so that
   build.cjs reproduces the published page; checked by scripts/index1-5/build-parity.cjs. Add to this file rather than editing js/ by hand. */
function once(source, anchor, replacement, label) {
  const n = source.split(anchor).length - 1;
  if (n !== 1) throw Error('record-sync anchor (' + label + '): ' + n);
  return source.replace(anchor, () => replacement);
}
function patchJourney(journey) {
  if (journey.includes('continuation: watershed.flowPaths')) return journey;
  // The follow-light runs on down the river past the corridor (js/follow-light-lines.js already takes it).
  return once(journey, 'const followLights = createFollowLightLines(THREE, { curve, widthAt, lite });',
    'const followLights = createFollowLightLines(THREE, {\n    curve, widthAt, lite,\n    continuation: watershed.flowPaths.find(path => path.curve === watershed.downstream)\n  });', 'follow lights continuation');
}
module.exports = state => ({ ...state, journey: patchJourney(state.journey) });
module.exports.patchJourney = patchJourney;
