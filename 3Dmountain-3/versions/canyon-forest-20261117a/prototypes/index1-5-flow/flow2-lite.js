(() => {
  const moduleUrl = new URL('flow2-recorded.js?v=flow2-static-news-1', document.currentScript.src).href;
  window.startFlow2Recorded = snapshot => import(moduleUrl).then(module => module.startRecorded(snapshot));
})();
