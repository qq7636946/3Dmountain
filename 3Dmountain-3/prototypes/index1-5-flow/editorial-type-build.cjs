'use strict';

/* Flow-only bilingual composition. Keep the world's section IDs and its
   measured scroll height; replace only the supplied global copy block. */
function patchHTML(html) {
  const section = /(<section\b[^>]*\bid="global"[^>]*>)[\s\S]*?(<\/section>)/g;
  if ([...html.matchAll(section)].length !== 1) throw Error('Flow editorial: expected one global section');
  return html.replace(section, (_match, opening, closing) => {
    opening = opening.replace(/\sdata-flow-editorial="[^"]*"/g, '').replace(/>$/, ' data-flow-editorial="global">');
    return `${opening}
          <p class="fiw-kicker" data-reveal><span lang="en">GLOBAL PRESENCE</span><span class="flow-editorial-divider" aria-hidden="true">/</span><span lang="zh-Hant">全球布局</span></p>
          <h2 class="fiw-statement" id="fiwGlobalTitle" lang="en" aria-label="CONNECTING VALUE ACROSS BORDERS" data-split><span class="flow-global-line">CONNECTING VALUE</span> <span class="flow-global-line">ACROSS BORDERS</span></h2>
          <p class="flow-global-title-zh" lang="zh-Hant" data-reveal>跨越邊界，讓價值相連</p>
          <p class="fiw-statement-zh flow-global-description" lang="zh-Hant" data-reveal>讓智匯之流跨越邊界，連結全球資源，讓長期價值持續延伸。</p>
        ${closing}`;
  });
}

module.exports = { patchHTML };
