(() => {
  const moduleUrl = new URL('flow2-recorded.js?v=recorded-20261109', document.currentScript.src).href;
  window.startFlow2Recorded = snapshot => import(moduleUrl).then(module => module.startRecorded(snapshot));
})();
