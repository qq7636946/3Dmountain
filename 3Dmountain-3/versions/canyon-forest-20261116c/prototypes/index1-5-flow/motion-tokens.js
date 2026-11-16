/* Flow's optical rhythm. These are finishing amplitudes, not scene clocks. */
export const FLOW_MOTION = Object.freeze({
  navigationMs: 320,
  rowStagger: .025,
  wordStagger: .20,
  bodyRise: 8,
  bodyExit: 6,
  titleRise: .30,
  titleExit: .24,
  titleBlur: 8,
  titleScale: .12,
  titleScatter: .055,
  titleRotate: 1.6,
  bodyBlur: .35,
  optics: Object.freeze({
    drop: .09, word: .10, valley: .10, sea: .12,
    cards: .10, clouds: .12, principles: .07, logo: .09, footer: .06
  })
});
