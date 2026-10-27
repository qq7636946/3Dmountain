'use strict';
/* explore: list the fixed UI of index1-5 at the current viewport (QA only) */
module.exports = async ({ page, vp }) => {
  const r = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      out.push({ t: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), op: cs.opacity, vis: cs.visibility, pe: cs.pointerEvents, txt: (el.innerText || '').trim().slice(0, 40).replace(/\s+/g, ' ') });
    }
    return out;
  });
  const btns = await page.evaluate(() => [...document.querySelectorAll('button,a,[role=button],input,select')].map(el => { const b = el.getBoundingClientRect(), cs = getComputedStyle(el); return { t: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.'), w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y), op: cs.opacity, txt: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30).replace(/\s+/g, ' ') }; }));
  return { ok: true, vp, fixed: r, btns };
};
