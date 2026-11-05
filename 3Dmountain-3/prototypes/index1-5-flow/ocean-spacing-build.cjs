'use strict';
/* Keep the full-size editorial spread, and halve only the empty sea
   between successive spreads. Measure once on layout, never in paint. */
function patchOcean(source) {
  if (source.includes('FLOW_HALF_OCEAN_GAP')) return source;
  const once=(anchor,replacement)=>{
    if(source.split(anchor).length!==2)throw Error('Flow ocean spacing anchor: '+anchor.slice(0,90));
    source=source.replace(anchor,()=>replacement);
  };
  once('  let W = innerWidth, H = innerHeight;',`  let W = innerWidth, H = innerHeight;
  let panelStride = W;   /* FLOW_HALF_OCEAN_GAP */
  const stopDistance = () => Math.max(1, Math.round(num('stop', .5, 4) * H * panelStride / Math.max(1, W)));
  function measurePanelStride() {
    const copy = panels[0]?.querySelector('.fiwo-strategy-copy');
    const visual = panels[0]?.querySelector('.fiwo-strategy-visual');
    if (!copy || !visual) { panelStride = W; return; }
    const left = Math.min(copy.offsetLeft, visual.offsetLeft);
    const right = Math.max(copy.offsetLeft + copy.offsetWidth, visual.offsetLeft + visual.offsetWidth);
    const contentWidth = clamp(right - left, 1, W);
    panelStride = (W + contentWidth) * .5;
  }`);
  once(`    const diveH = Math.round(num('dive', .8, 6) * H), stop = Math.round(num('stop', .5, 4) * H), tail = Math.round(H * .3);
    dive.style.height = diveH + 'px';
    resp.style.height = (H + (N - 1) * stop + tail) + 'px';
    root.style.setProperty('--fiwo-w', W + 'px'); root.style.setProperty('--fiwo-h', H + 'px');`,
`    root.style.setProperty('--fiwo-w', W + 'px'); root.style.setProperty('--fiwo-h', H + 'px');
    measurePanelStride();
    const diveH = Math.round(num('dive', .8, 6) * H), stop = stopDistance(), tail = Math.round(H * .3);
    dive.style.height = diveH + 'px';
    resp.style.height = (H + (N - 1) * stop + tail) + 'px';`);
  once("at.stop = Math.round(num('stop', .5, 4) * H);",'at.stop = stopDistance();');
  once('      const next=oceanPanelState({index:k,progress:h,width:W,reducedMotion,count:N}),st=panelState[k];',
`      const next=oceanPanelState({index:k,progress:h,width:panelStride,reducedMotion,count:N}),st=panelState[k];
      if (!reducedMotion) next.visible = next.x <= W + 1 && next.x + W >= -1;`);
  once('const swipe = () => at.stop / Math.max(1,W);','const swipe = () => at.stop / Math.max(1,panelStride);');
  return source;
}
module.exports={patchOcean};
