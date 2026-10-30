/* index1-5: stop the hidden journey only after the world has covered it.
   This does not enable the older perf-cover bundle or pause the cards bridge.
   The existing frame consumes clock.getDelta() before this gate, so a long
   visit to the world never turns into a large simulation step on return. */
function once(source,anchor,replacement,label){
  if(source.split(anchor).length!==2)throw Error('runtime quality anchor: '+label);
  return source.replace(anchor,()=>replacement);
}
function patchMain(source){
  if(source.includes('/* WORLD_COVER_RUNTIME_QUALITY */'))return source;
  const crlf=source.includes('\r\n');
  let main=source.replace(/\r\n/g,'\n');
  main=once(main,'      let sceneTime = 0;',
    '      const runtimeQuality = { covered: false, suspendedFrames: 0, resumptions: 0 };\n      let sceneTime = 0;','runtime diagnostics');
  main=once(main,
    '        if (mobileRenderBudget.mobile && !manual && world?.covering && portfolio?.open) {\n          animationFrame = requestAnimationFrame(tick); return;\n        }',
    '        /* WORLD_COVER_RUNTIME_QUALITY */\n'+
    '        const settledJourney = Math.abs(journey.target - journey.progress) < 1e-4 && Math.abs(journey.velocity || 0) < 1e-4;\n'+
    '        if (!manual && world?.covering && portfolio?.open && (mobileRenderBudget.mobile || settledJourney)) {\n'+
    '          runtimeQuality.covered = true; runtimeQuality.suspendedFrames++;\n'+
    '          suppressSceneDaylight(CONFIG.sceneDaylight.worldOff > .5);\n'+
    '          setSceneTime(getSceneDaylight().hour);\n'+
    '          animationFrame = requestAnimationFrame(tick); return;\n'+
    '        }\n'+
    '        if (runtimeQuality.covered && !manual) { runtimeQuality.covered = false; runtimeQuality.resumptions++; }',
    'covered world gate');
  main=once(main,'window.__MONTIS_STUDY__ = {','window.__MONTIS_STUDY__ = { runtimeQuality,','published diagnostics');
  return crlf?main.replace(/\n/g,'\r\n'):main;
}
module.exports=state=>({...state,main:patchMain(state.main)});
module.exports.patchMain=patchMain;
