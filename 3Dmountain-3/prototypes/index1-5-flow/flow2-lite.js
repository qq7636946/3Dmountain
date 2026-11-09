(() => {
  'use strict';

  const root = document.documentElement;
  const sections = [
    ['core-values', '核心價值'],
    ['investment-strategies', '投資策略'],
    ['why-us', '為何選擇我們'],
    ['latest-news', '最新消息'],
    ['global-presence', '全球布局']
  ];
  const news = [
    ['COMPANY UPDATES', '公司消息', '恒灝的最新動態與重要資訊，將在此持續更新'],
    ['INDUSTRY INSIGHTS', '產業觀點', '持續觀察科技、產業與金融市場，分享值得關注的思考'],
    ['EVENTS', '活動紀事', '交流、對話與合作的最新紀錄，即將於此呈現']
  ];
  const assets = new URL('assets/', document.currentScript.src);
  const rootAssets = new URL('../../', document.currentScript.src);

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = value;
    return node;
  }

  function copy(node) {
    return (node?.getAttribute('aria-label') || node?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function addCard(grid, { label, title, body, lang = 'en', image, status }) {
    const card = element('article', 'fi-lite-card');
    if (image) card.append(image);
    const kicker = element('p', 'fi-lite-kicker', label);
    const heading = element('h3', '', title);
    heading.lang = lang;
    card.append(kicker, heading, element('p', '', body));
    if (status) card.append(element('p', 'fi-lite-status', status));
    grid.append(card);
  }

  function addJourneyCards(grid, source, keys) {
    for (const key of keys) {
      const panel = source.querySelector('[data-copy="' + key + '"]');
      if (!panel) continue;
      addCard(grid, {
        label: copy(panel.querySelector('.fi-copy-kicker')),
        title: copy(panel.querySelector('h2')),
        body: copy(panel.querySelector('.fi-copy-zh'))
      });
    }
  }

  function addWhyCards(grid) {
    for (const panel of document.querySelectorAll('#responsibility .fiwo-strategy')) {
      const original = panel.querySelector('img[data-ocean-photo]');
      const name = original?.dataset.oceanPhoto;
      let image;
      if (name && /^[a-z0-9-]+$/i.test(name)) {
        image = element('img');
        image.loading = 'lazy';
        image.decoding = 'async';
        image.width = 480;
        image.height = 300;
        image.alt = original.alt;
        image.src = new URL('prototypes/index1-5/assets/ocean/' + name + '-480.webp', rootAssets).href;
      }
      addCard(grid, {
        label: copy(panel.querySelector('.fiwo-strategy-title')),
        title: copy(panel.querySelector('.fiwo-strategy-tagline')),
        body: copy(panel.querySelector('.fiwo-strategy-body')),
        lang: 'zh-Hant',
        image
      });
    }
  }

  function watchVisibility(view, chapters) {
    const links = [...view.querySelectorAll('.fi-lite-nav a')];
    function updateNavigation() {
      const last = chapters[chapters.length - 1];
      const atEnd = scrollY > 0 && scrollY + innerHeight >= root.scrollHeight - 2;
      const active = atEnd ? last : chapters.find(section => section.getBoundingClientRect().bottom > innerHeight * .36) || last;
      for (const link of links) {
        if (link.hash === '#' + active.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
    updateNavigation();
    addEventListener('hashchange', updateNavigation);
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.toggleAttribute('data-lite-visible', entry.isIntersecting);
      updateNavigation();
    }, { threshold: [0, .15, .4, .65, 1] });
    for (const node of [...chapters, view.querySelector('.fi-lite-hero')]) observer.observe(node);
    const syncHidden = () => root.toggleAttribute('data-lite-paused', document.hidden);
    document.addEventListener('visibilitychange', syncHidden);
    syncHidden();
  }

  function mount() {
    if (root.dataset.renderMode !== 'text' || document.getElementById('flow2-lite')) return;
    const source = document.querySelector('[data-journey-ui]');
    const opening = source?.querySelector('#chapter-knowledge');
    if (!opening) return;

    const view = element('div', 'fi-lite');
    view.id = 'flow2-lite';
    view.innerHTML = `
      <header class="fi-lite-header">
        <a class="fi-lite-brand" href="#core-values" aria-label="恒灝創新，回到首屏">
          <span>恒灝創新<small lang="en">FINNOVATION</small></span>
        </a>
        <nav class="fi-lite-nav" aria-label="網站五大區塊"></nav>
      </header>
      <main aria-label="恒灝創新的理念與投資策略">
        <section id="core-values" class="fi-lite-section" tabindex="-1" aria-labelledby="fi-lite-title">
          <div class="fi-lite-hero">
            <div class="fi-lite-scene" aria-hidden="true">
              <div class="fi-lite-drop"><img alt="" width="320" height="320" decoding="async"></div>
              <img class="fi-lite-sea" alt="" width="1600" height="420" decoding="async">
              <div class="fi-lite-ripples"><i></i><i></i></div>
            </div>
            <div class="fi-lite-hero-copy">
              <p class="fi-lite-kicker" data-lite-copy="opening-kicker" lang="en"></p>
              <h1 id="fi-lite-title" lang="en"></h1>
              <p class="fi-lite-hero-lead" data-lite-copy="opening-lead"></p>
              <a class="fi-lite-button" href="#investment-strategies" lang="en">FOLLOW THE DROP <span aria-hidden="true">→</span></a>
            </div>
          </div>
          <div class="fi-lite-values fi-lite-shell"><div class="fi-lite-grid fi-lite-grid--four" data-lite-grid="values"></div></div>
        </section>
        <section id="investment-strategies" class="fi-lite-section fi-lite-chapter" tabindex="-1" aria-labelledby="fi-lite-strategies">
          <div class="fi-lite-shell">
            <div class="fi-lite-intro">
              <p class="fi-lite-kicker">02 / 投資策略</p>
              <h2 id="fi-lite-strategies" data-lite-copy="strategies-title" lang="en"></h2>
              <p data-lite-copy="strategies-lead"></p>
            </div>
            <div class="fi-lite-current-line" aria-hidden="true"></div>
            <div class="fi-lite-grid fi-lite-grid--four" data-lite-grid="strategies"></div>
          </div>
        </section>
        <section id="why-us" class="fi-lite-section fi-lite-chapter" tabindex="-1" aria-labelledby="fi-lite-why">
          <div class="fi-lite-shell">
            <div class="fi-lite-intro">
              <p class="fi-lite-kicker">03 / 為何選擇我們</p>
              <h2 id="fi-lite-why" lang="en">WHY FINNOVATION</h2>
              <p data-lite-copy="why-lead"></p>
            </div>
            <div class="fi-lite-grid" data-lite-grid="why"></div>
          </div>
        </section>
        <section id="latest-news" class="fi-lite-section fi-lite-chapter" tabindex="-1" aria-labelledby="fi-lite-news">
          <div class="fi-lite-shell">
            <div class="fi-lite-intro">
              <p class="fi-lite-kicker">04 / 最新消息</p>
              <h2 id="fi-lite-news" lang="en">LATEST NEWS</h2>
              <p>觀點、動態與交流</p>
            </div>
            <div class="fi-lite-grid fi-lite-grid--three" data-lite-grid="news"></div>
          </div>
        </section>
        <section id="global-presence" class="fi-lite-section fi-lite-chapter" tabindex="-1" aria-labelledby="fi-lite-global">
          <div class="fi-lite-shell fi-lite-global">
            <div class="fi-lite-intro">
              <p class="fi-lite-kicker">05 / 全球布局</p>
              <h2 id="fi-lite-global" data-lite-copy="global-title" lang="en"></h2>
              <p data-lite-copy="global-lead"></p>
              <p data-lite-copy="global-description"></p>
            </div>
            <figure class="fi-lite-globe" aria-hidden="true"><img alt="" width="1024" height="512" loading="lazy" decoding="async"></figure>
          </div>
        </section>
      </main>
      <footer id="contact" class="fi-lite-footer" tabindex="-1">
        <div class="fi-lite-shell">
          <small class="fi-lite-credits"></small>
          <a href="#core-values">回到頂端 <span aria-hidden="true">↑</span></a>
        </div>
      </footer>`;

    const nav = view.querySelector('.fi-lite-nav');
    for (const [index, [id, label]] of sections.entries()) {
      const link = element('a');
      link.href = '#' + id;
      const number = element('span', 'fi-lite-nav-number', String(index + 1).padStart(2, '0'));
      number.setAttribute('aria-hidden', 'true');
      link.append(number, element('span', '', label));
      nav.append(link);
    }
    const mark = document.querySelector('#contact .fiw-sign svg')?.cloneNode(true);
    if (mark) {
      mark.classList.add('fi-lite-brand-mark');
      view.querySelector('.fi-lite-brand').prepend(mark);
    }

    const titleWords = copy(opening.querySelector('h1')).split(' ');
    const emphasis = titleWords.pop();
    view.querySelector('h1').append(titleWords.join(' ') + ' ', element('span', '', emphasis));
    const bindings = {
      'opening-kicker': '#chapter-knowledge .fi-copy-kicker',
      'opening-lead': '#chapter-knowledge .fi-copy-zh',
      'strategies-title': '#chapter-strategies h2',
      'strategies-lead': '#chapter-strategies .fi-copy-zh',
      'why-lead': '#responsibility .fiw-intro',
      'global-title': '#global .fiw-statement',
      'global-lead': '#global .flow-global-title-zh',
      'global-description': '#global .flow-global-description'
    };
    for (const [key, selector] of Object.entries(bindings)) {
      view.querySelector('[data-lite-copy="' + key + '"]').textContent = copy(document.querySelector(selector));
    }
    const grid = name => view.querySelector('[data-lite-grid="' + name + '"]');
    addJourneyCards(grid('values'), source, ['innovation', 'convergence', 'value', 'perspective']);
    addJourneyCards(grid('strategies'), source, ['ai', 'public', 'private', 'derivatives']);
    addWhyCards(grid('why'));
    for (const [label, title, body] of news) {
      addCard(grid('news'), { label, title, body, lang: 'zh-Hant', status: 'COMING SOON · 內容準備中' });
    }
    const credits = view.querySelector('.fi-lite-credits');
    credits.append(element('span', '', copy(document.querySelector('#contact .fiw-legalline > span'))));
    const earthCredit = document.querySelector('#contact .fiw-legalline a[href*="earth-"]');
    if (earthCredit) credits.append(earthCredit.cloneNode(true));

    view.querySelector('.fi-lite-drop img').src = new URL('flow2-lite-drop.svg', assets).href;
    view.querySelector('.fi-lite-sea').src = new URL('flow2-lite-water.svg', assets).href;
    view.querySelector('.fi-lite-globe img').src = new URL('images/world/earth-1k.jpg', rootAssets).href;
    const chapters = [...view.querySelectorAll('.fi-lite-section')];
    const targets = [...chapters, view.querySelector('.fi-lite-footer')];
    const activeIndex = document.body.classList.contains('is-ready') ? Number(source.dataset.siteSection) : NaN;
    const target = chapters[activeIndex] || targets.find(section => '#' + section.id === location.hash) || chapters[0];
    const restoreFocus = document.activeElement !== document.body && document.activeElement !== root;
    for (const section of targets) {
      // The scene can already have created the news anchor before a context loss.
      document.getElementById(section.id)?.removeAttribute('id');
    }
    document.body.append(view);
    root.dataset.flow2Lite = 'on';
    target.scrollIntoView({ block: 'start' });
    if (restoreFocus) target.focus({ preventScroll: true });
    watchVisibility(view, chapters);
  }

  // Existing scene listeners release GPU work during the same event.
  addEventListener('finnovation:text-mode', () => queueMicrotask(mount), { once: true });
  if (root.dataset.renderMode === 'text') queueMicrotask(mount);
})();
