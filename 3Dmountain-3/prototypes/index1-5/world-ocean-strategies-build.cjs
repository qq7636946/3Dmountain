/* Semantic HTML for the four ocean strategy chapters. Source: client deck slides 3-4. */
const fs = require('fs'), path = require('path');
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'ocean-strategies.json'), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PHOTOS = [
  ['responsibility-team', '團隊共同分析市場資料與研究圖表'],
  ['governance-architecture', '商業建築的結構與秩序'],
  ['strategy-growth', '企業團隊共同討論發展規劃'],
  ['strategy-derivatives', '金融市場價格與交易圖表']
];
module.exports = html => {
  if (DATA.strategies.length !== 4) throw Error('Ocean needs exactly four investment strategies.');
  const articles = DATA.strategies.map((item, index) => {
    const [photo, alt] = PHOTOS[index];
    const next = index < 3 ? `data-ocean-go="${index + 1}"` : 'data-world-go="contact"';
    return `          <article class="fiw-block fiw-grid fiwo-strategy" data-block data-strategy="${escape(item.id)}" aria-labelledby="fiwoStrategy${item.id}">
            <div class="fiwo-strategy-copy">
              <p class="fiwo-kicker"><i aria-hidden="true"></i><span>${escape(item.id)} / 04 · INVESTMENT STRATEGIES</span></p>
              <p class="fiwo-sub" lang="zh-Hant">${escape(item.titleZh)}</p>
              <h3 class="fiw-title fiwo-strategy-title" id="fiwoStrategy${item.id}" lang="en" aria-label="${escape(item.titleEn)}">${item.titleLines.map(line => `<span>${escape(line)}</span>`).join(' ')}</h3>
              <p class="fiwo-strategy-tagline" lang="zh-Hant">${escape(item.taglineZh)}</p>
              <p class="fiwo-strategy-body" lang="zh-Hant">${escape(item.bodyZh)}</p>
              <p class="fiwo-strategy-en" lang="en">${escape(item.taglineEn)}</p>
              <button type="button" class="fiwo-pill" ${next}><span>${index < 3 ? 'NEXT STRATEGY' : 'CONTACT'}</span><i aria-hidden="true"></i></button>
            </div>
            <div class="fiwo-strategy-visual">
            <figure class="fiwo-photo fiwo-photo--strategy">
              <img width="800" height="500" decoding="async" data-ocean-photo="${photo}" sizes="(max-width: 680px) 88vw, (max-width: 960px) 40vw, (max-width: 1280px) 42vw, 500px" alt="${escape(alt)}">
              <figcaption>${escape(item.keywords.slice(0, 2).join(' · '))}</figcaption>
            </figure>
            <div class="fiwo-strategy-meta" aria-hidden="true"><span class="fiwo-strategy-number">${escape(item.id)}</span><p class="fiwo-strategy-keywords">${item.keywords.map(k => `<span>${escape(k)}</span>`).join('')}</p></div>
            </div>
          </article>`;
  }).join('\n\n');
  const section = `        <section class="fiw-resp" id="responsibility" data-world-part="responsibility" aria-labelledby="fiwRespTitle">
          <h2 class="fiw-sr" id="fiwRespTitle">${escape(DATA.section.labelZh)} · ${escape(DATA.section.labelEn)}</h2>
          <div class="fiw-grid fiwo-source-intro"><p class="fiw-intro">${escape(DATA.section.headingZh)}。${escape(DATA.section.bodyZh)}</p></div>
${articles}
        </section>`;
  const pattern = /        <section class="fiw-resp" id="responsibility"[\s\S]*?\n        <\/section>/;
  if (!pattern.test(html)) throw Error('Ocean strategy HTML anchor missing.');
  return html.replace(pattern, () => section)
    .replace('<span class="fiw-label">RESPONSIBILITY</span>', '<span class="fiw-label">INVESTMENT STRATEGIES</span>')
    .replace('data-world-go="responsibility">Responsibility</button>', 'data-world-go="responsibility">Investment strategies</button>');
};
