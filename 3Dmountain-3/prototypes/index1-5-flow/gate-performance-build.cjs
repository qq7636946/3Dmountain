'use strict';
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8').replace(/\r\n/g,'\n');
function once(source,anchor,replacement) {
  if(source.split(anchor).length!==2)throw Error('Flow gate performance anchor: '+anchor.slice(0,85));
  return source.replace(anchor,()=>replacement);
}
function gateScript() {
  let source=read('../index1-5/entry-gate.js');
  const a=source.indexOf('  const count = (() => {'),b=source.indexOf('  /* the numerals wait for Oswald');
  if(a<0||b<=a)throw Error('Flow gate: particle counter anchors changed');
  source=source.slice(0,a)+`  const count = createFlowGateCounter({ canvas: $('.gate-count'), reduced: reduce, coarse, root,
    fontUrl: new URL('prototypes/index1-5/assets/fonts/oswald/latin.woff2', document.baseURI).href });
`+source.slice(b);
  source=once(source,"root.dataset.gate = 'off'; gate?.remove(); return;", "root.dataset.gate = 'off'; gate?.remove(); loader?.classList.add('gate-gone'); return;");
  source=once(source,"    G.state = 'off'; locked = false; root.dataset.gate = 'off';", "    count?.dispose();\n    G.state = 'off'; locked = false; root.dataset.gate = 'off';");
  source=once(source,'  let last = performance.now();','  let last = performance.now(), hudAt = 0, hudKey = \'\', progressKey = \'\';');
  source=once(source,`    gate.style.setProperty('--p', G.shown.toFixed(4));
    if (hudFiles) hudFiles.textContent = String(requests);
    if (hudMb) hudMb.textContent = (bytes / 1048576).toFixed(1) + ' MB';`,
`    const progress = G.shown.toFixed(3);
    if (progress !== progressKey) { progressKey = progress; gate.style.setProperty('--p', progress); }
    if (now - hudAt >= 120) {
      hudAt = now;
      const key = requests + '|' + (bytes / 1048576).toFixed(1);
      if (key !== hudKey) {
        hudKey = key;
        if (hudFiles) hudFiles.textContent = String(requests);
        if (hudMb) hudMb.textContent = (bytes / 1048576).toFixed(1) + ' MB';
      }
    }`);
  return '/* FLOW_GATE_WORKER */\n(() => {\n'+read('gate-counter.js')+'\n'+source+'\n})();';
}
function patchHTML(html) {
  const start=html.indexOf('<!-- ENTRY_GATE_START -->'),end=html.indexOf('<!-- ENTRY_GATE_END -->');
  if(start<0||end<=start)throw Error('Flow gate: missing entry markers');
  const section=html.slice(start,end),scripts=[...section.matchAll(/<script>[\s\S]*?<\/script>/g)];
  if(scripts.length!==1)throw Error('Flow gate: expected one inline controller');
  const next=section.replace(/<script>[\s\S]*?<\/script>/,()=>'<script>\n'+gateScript()+'\n  </script>');
  return html.slice(0,start)+next+html.slice(end);
}
function patchMain(source) {
  if(source.includes('FLOW_GATE_PARK'))return source;
  return once(source,'        // The world has its own loop.',`        /* FLOW_GATE_PARK: the first frame is ready and the opaque counter
           covers it. Leave CPU/GPU time to preparation and the counter;
           reveal/ready, manual previews and the live site resume normally. */
        if (!manual && !firstFrame && !requestedPreview && /^(boot|live)$/.test(window.__GATE__?.state || '')) {
          startupState.parkedFrames = (startupState.parkedFrames || 0) + 1;
          animationFrame = requestAnimationFrame(tick); return;
        }
        // The world has its own loop.`);
}
module.exports={gateScript,patchHTML,patchMain};
if(require.main===module) {
  const crypto=require('node:crypto'),root=path.resolve(__dirname,'../..');
  const mainFile=path.join(__dirname,'js/main.js'),htmlFile=path.join(root,'index1-5-flow.html');
  const main=patchMain(fs.readFileSync(mainFile,'utf8'));
  const version='gate-smooth-'+crypto.createHash('sha256').update(main).digest('hex').slice(0,12);
  let html=patchHTML(fs.readFileSync(htmlFile,'utf8'));
  const pattern=/prototypes\/index1-5-flow\/js\/main\.js\?v=[^"\s]+/g;
  if([...html.matchAll(pattern)].length!==2)throw Error('Flow gate: main references changed');
  html=html.replace(pattern,'prototypes/index1-5-flow/js/main.js?v='+version);
  fs.writeFileSync(mainFile,main);fs.writeFileSync(htmlFile,html);
  console.log('Updated Flow gate: independent counter, bounded canvas, parked hidden scene.');
}
