/* index1-5 only: valley polish (2026-10-24, defect list B-20).
   The rise (journey 6.4 → 11.8 on the downstream clock) was cut at FOUR PATHS: index1-5's journey ends at 10.18, so the climb
   stops 70 % of the way up, still at ~84 % of its peak speed (camera travel per journey unit: peak 1,567 at p 12.1, 1,313 at 12.9);
   the camera only stopped because the scrolling did.
   Here the rise's clock eases out over its last RISE SETTLE journey units: a Hermite step (value s + s² − s³) that starts with the
   old value and slope, ends at the same final frame (u = .70) with slope 0, and is monotone. The cost is a window in which the
   rise runs up to 33 % faster before the ease. RISE SETTLE 0 = the old clock exactly. Nothing before the window changes.
   Dial in 「升空與鏡頭 Rise」 (live). */
module.exports = ({ main, drops, letters, glass, html }) => {
  const once = (source, anchor, replacement, label) => {
    const n = source.split(anchor).length - 1;
    if (n !== 1) throw new Error('index1-5 valley-polish anchor (' + label + '): ' + n + ' × ' + anchor.slice(0, 90));
    return source.replace(anchor, () => replacement);
  };
  const call = "        canyon.update(THREE.MathUtils.clamp((p - 1.404) / (8 - 1.404), 0, 1), time, reduceMotion, THREE.MathUtils.clamp((p - riseFrom) / (riseTo - riseFrom), 0, 1), THREE.MathUtils.clamp((p - joinFrom) / (13.8 - joinFrom), 0, 1));";
  main = once(main, call,
    "        /* the rise eases out over its last RISE SETTLE journey units (the journey ends at 10.18, 70 % of the way up) */\n" +
    "        const riseW = THREE.MathUtils.clamp(+CONFIG.valleyPolish?.riseSettle || 0, 0, 1.5), riseA = 10.18 - riseW;\n" +
    "        let riseU = THREE.MathUtils.clamp((p - riseFrom) / (riseTo - riseFrom), 0, 1);\n" +
    "        if (riseW > 0 && p > riseA) {\n" +
    "          const s = THREE.MathUtils.clamp((p - riseA) / riseW, 0, 1), uA = THREE.MathUtils.clamp((riseA - riseFrom) / (riseTo - riseFrom), 0, 1), m = riseW / (riseTo - riseFrom);\n" +
    "          riseU = uA + m * (s + s * s - s * s * s);\n" +
    "        }\n" +
    "        canyon.update(THREE.MathUtils.clamp((p - 1.404) / (8 - 1.404), 0, 1), time, reduceMotion, riseU, THREE.MathUtils.clamp((p - joinFrom) / (13.8 - joinFrom), 0, 1));", 'rise clock');
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',
    "      /* 升空與鏡頭 Rise（valley-polish-build.cjs） */\n      CONFIG.valleyPolish = { riseSettle: .7 };\n      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));", 'config');
  main = once(main, "          ['卡牌轉場 Cards', [",
    "          ['升空與鏡頭 Rise', [\n            ['升空收尾長度（旅程單位，0＝舊的急停）', 'valleyPolish', 'riseSettle', 0, 1.5, .05]\n          ]],\n          ['卡牌轉場 Cards', [", 'tuner');
  main = once(main, "'worldOcean'].includes(groupKey);", "'worldOcean', 'valleyPolish'].includes(groupKey);", 'live dials');
  return { main, drops, letters, glass, html };
};
