/* Small, independent visitor controls. No Three.js dependency or permanent animation loop. */
(() => {
  const html = document.documentElement;
  if (html.dataset.look !== 'index1-5') return;
  const abort = new AbortController(), opts = { signal: abort.signal };
  const status = document.querySelector('.fi-navigation-status');
  const statusText = status?.querySelector('span');
  let timer = 0, hideTimer = 0, pending = null, label = '', disposed = false;
  const setText = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
  function clearNavigation() {
    clearTimeout(timer); clearTimeout(hideTimer); pending = null;
    status?.classList.remove('is-visible');
    document.querySelector('[data-journey-ui]')?.removeAttribute('aria-busy');
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-chapter]');
    const nav = button && document.querySelector('.fi-rail [data-chapter="'+button.dataset.chapter+'"]');
    const number = nav?.querySelector('.fi-rail-number')?.textContent.trim() || '';
    label = nav ? number+' · '+nav.textContent.replace(number,'').trim() : '';
  }, { ...opts, capture:true });
  function checkNavigation() {
    if (!pending || disposed || html.dataset.renderMode === 'text') return;
    const s = window.__MONTIS_STUDY__, j = s?.journey;
    if (!j) { timer = setTimeout(checkNavigation,120); return; }
    if (Math.abs(j.target-pending.target) > .02) { clearNavigation(); return; }
    if (Math.abs(j.progress-pending.target)<.015 && Math.abs(j.velocity||0)<.04) {
      document.querySelector('[data-journey-ui]')?.removeAttribute('aria-busy');
      setText(statusText,label ? '已到達 '+label : '已到達下一章');
      pending = null; hideTimer = setTimeout(clearNavigation,650); return;
    }
    const elapsed=performance.now()-pending.started;
    if (elapsed>500) {
      const ready=s.chapterReady;
      const preparing=(!ready?.logo && pending.target>2) || (!ready?.journey && pending.target>s.logoChapterEnd());
      setText(statusText,preparing ? '正在準備'+(label ? ' '+label : '下一章') : '前往'+(label ? ' '+label : '下一章'));
      status?.classList.add('is-visible');
    }
    timer=setTimeout(checkNavigation,120);
  }
  addEventListener('finnovation:navigate', event => {
    clearNavigation();
    pending={target:event.detail.target,started:performance.now()};
    document.querySelector('[data-journey-ui]')?.setAttribute('aria-busy','true');
    checkNavigation();
  },opts);
  addEventListener('wheel',clearNavigation,{...opts,passive:true});
  addEventListener('touchstart',clearNavigation,{...opts,passive:true});
  addEventListener('finnovation:text-mode',clearNavigation,opts);
  addEventListener('pagehide',event=>{clearNavigation();if(!event.persisted){disposed=true;abort.abort();}},opts);
})();
