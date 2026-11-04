/* Local to index1-5 (2026-11-04). The entry gate on the live page (client: 「套到正式頁」), first tried on index1-5-enter.html:
   a LOADING cover in CSS (water, drifting specks, glints; it was a tiny WebGL until the client asked for CSS, 「比較省資源」) with the count
   as points of light on a small 2D canvas, held until the scene, the journey, the cards and the world are ready (warmEpilogue, epilogue-warm-build.cjs),
   then the site's header and ENTER WITH SOUND / WITHOUT SOUND.
   entry-gate.css and entry-gate.js are inlined: they must be there at first paint, before any module.
   The page is built from its own last output, so this replaces what it put in before (between ENTRY_GATE markers) instead of adding again.
   Undo: ENTRY_GATE=0 node prototypes/index1-5/build.cjs puts the old loader back; then take this file's name out of build.cjs.
   Flags at run time: ?gate=0 the old boot (no hold), ?gate=auto enters muted by itself when ready (the QA tools use it), ?view=… skips it. */
const fs = require('fs'), path = require('path');
const read = p => fs.readFileSync(path.join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');
const LOADER = `  <div class="loader" id="loader" data-nosnippet>
    <div class="loader-inner">
      <div class="loader-logo">FINNOVATION</div>
      <div class="loader-line"><i></i></div>
      <div class="loader-note">FORMING ATMOSPHERE</div>
    </div>
  </div>
`;
const START = '  <!-- ENTRY_GATE_START -->\n', END = '  <!-- ENTRY_GATE_END -->\n';
const STYLE = /\s*<!-- ENTRY_GATE_STYLE -->\s*<style id="enterGate">[\s\S]*?<\/style>/;
function markup() {
  /* the loader keeps its id and its .loader-note: main.js fades the one and writes its loading progress into the other, which the gate reads */
  return START + `  <div class="loader" id="loader" data-nosnippet>
    <div class="gate-sea" aria-hidden="true"><i class="gate-rays"></i><i class="gate-dust gate-dust--far"></i><i class="gate-dust gate-dust--mid"></i><i class="gate-dust gate-dust--near"></i><span class="gate-glints"></span></div>
    <div class="loader-note" hidden>FORMING ATMOSPHERE</div>
  </div>
  <div class="gate" id="gate" role="dialog" aria-modal="true" aria-labelledby="gateBrand" aria-describedby="gateStatus" data-nosnippet>
    <div class="gate-brand" id="gateBrand"><span lang="zh-Hant">恒灝創新</span><span>FINNOVATION</span></div>
    <canvas class="gate-count" aria-hidden="true"></canvas>
    <p class="gate-sr" id="gateStatus" aria-live="polite">Loading</p>
    <dl class="gate-hud" aria-hidden="true">
      <div><dt>FILES</dt><dd class="gate-files">0</dd></div>
      <div><dt>LOADED</dt><dd class="gate-mb">0.0 MB</dd></div>
      <div><dt>STAGE</dt><dd><span class="gate-stage-en">GATHERING WATER</span><span class="gate-stage-zh" lang="zh-Hant">匯聚水氣</span></dd></div>
      <i class="gate-line"></i>
    </dl>
    <div class="gate-choice">
      <p class="gate-hint" data-split>BEST EXPERIENCED WITH SOUND<span lang="zh-Hant">建議開啟聲音</span></p>
      <div class="gate-buttons">
        <button class="gate-btn gate-btn--sound" data-sound="on" type="button" disabled><span class="gate-eq" aria-hidden="true"><i></i><i></i><i></i></span><span>ENTER WITH SOUND</span><span lang="zh-Hant">開啟聲音</span></button>
        <button class="gate-btn gate-btn--muted" data-sound="off" type="button" disabled><span>ENTER WITHOUT SOUND</span><span lang="zh-Hant">靜音進入</span></button>
      </div>
    </div>
  </div>
  <script>\n${read('entry-gate.js')}  </script>
` + END;
}
module.exports = state => {
  let html = state.html;
  const off = process.env.ENTRY_GATE === '0';
  html = html.replace(/(<html[^>]*?)\s+data-gate="[^"]*"/, '$1').replace(STYLE, '');
  const a = html.indexOf(START), b = html.indexOf(END);
  const block = off ? LOADER : markup();
  if (a >= 0 && b > a) html = html.slice(0, a) + block + html.slice(b + END.length);
  else if (html.split(LOADER).length === 2) html = html.replace(LOADER, () => block);
  else throw Error('entry-gate: neither the old loader nor the gate markers are in index1-5.html');
  if (!off) {
    html = html.replace('<html ', '<html data-gate="hold" ');
    html = html.replace('</head>', () => `  <!-- ENTRY_GATE_STYLE -->\n  <style id="enterGate">\n${read('entry-gate.css')}  </style>\n</head>`);
  }
  return { ...state, html };
};
