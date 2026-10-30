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
  function readingMode() {
    if (!window.showFinnovationText) return;
    document.querySelector('.fi-menu[open]')?.close();
    clearNavigation(); window.showFinnovationText();
    document.querySelectorAll(".fi-copy-panel [inert]").forEach(el=>{el.inert=false;});
    const title = document.querySelector('#chapter-knowledge h1');
    if (title) { title.tabIndex = -1; title.focus({ preventScroll:true }); }
    scrollTo(0,0);
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-reading-mode]')) { event.preventDefault(); readingMode(); }
    if (event.target.closest('[data-resume-experience]')) location.reload();
  }, opts);
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
  const note=document.querySelector('.loader-note');
  const slowTimer=setTimeout(()=>{if(!document.body.classList.contains('is-ready')&&html.dataset.renderMode!=='text')setText(note,'正在準備水光與場景，可先選擇文字閱讀');},9000);
  const bootObserver=new MutationObserver(()=>{if(document.body.classList.contains('is-ready')){clearTimeout(slowTimer);bootObserver.disconnect();}});
  bootObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  motion.addEventListener('change',event=>{if(event.matches && html.dataset.renderMode!=='text')readingMode();},opts);
  addEventListener('finnovation:text-mode',()=>{clearNavigation();clearTimeout(slowTimer);bootObserver.disconnect();},opts);
  addEventListener('pagehide',event=>{clearNavigation();if(!event.persisted){disposed=true;clearTimeout(slowTimer);bootObserver.disconnect();abort.abort();}},opts);
})();
