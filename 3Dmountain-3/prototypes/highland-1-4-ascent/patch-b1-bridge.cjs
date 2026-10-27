// index1-4-ascent · B1 bridge + sky (2026-10-23). Client: 匯流到這裡要到卡牌 要一個完美流暢的轉場 不要讓那光線感覺好像突然斷掉卡住了;
// 前面第一段跟第二段 整體色調跟後面動畫搭不上來.
// · the bridge glides ~3 s instead of ~1.4 s, the camera keeps moving forward along its view (with the light), the
//   valley's air thickens first and the cards surface only once it has, in a slate-blue mist (the landscape's haze),
//   not near-white — the light keeps flowing and fades into that air instead of stopping
// · the landscape sky between index1-3-maritime's slate opening and the Everest blue, so the hand-over from the
//   opening (slate room) to the canyon (sky) does not jump
const fs = require('node:fs'), path = require('node:path');
function edit(rel, pairs) {
  const file = path.join(__dirname, rel); let src = fs.readFileSync(file, 'utf8'); const eol = src.includes('\r\n') ? '\r\n' : '\n';
  for (const [label, find, repl] of pairs) {
    const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
    if (src.split(f).length - 1 !== 1) throw new Error(`${rel} [${label}] anchor`);
    src = src.replace(f, () => r);
  }
  fs.writeFileSync(file, src); console.log('patched', rel, pairs.length);
}
edit('js/main.js', [
  ['mist', `        Object.assign(CONFIG.mist,{push:.12,fog:3.2});`,
           `        Object.assign(CONFIG.mist,{push:.4,fog:6,follow:2.2,start:.55,veil:.62});   /* ascent B1: a slower, forward glide; air first, cards after */
        CONFIG.portfolio.base = [.77, .83, .885];   /* ascent B1: the cards' ground = the landscape's slate-blue haze (#c3d3e2), not near-white */`]
]);
edit('js/highland-scene.js', [
  ['sky', `horizon: [.16, .33, .66], zenith: [.006, .06, .25], hazeBand: .14,`,
          `horizon: [.22, .38, .60], zenith: [.012, .065, .20], hazeBand: .14,`]
]);
