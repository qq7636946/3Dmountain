'use strict';
/* measure.probe.cjs — portal fix numbers. Run through the QA toolkit (it takes the browser lock):
     PF_AT="4.55,4.6,4.65,4.7" PF_VARIANTS="old,new" PF_OUT=.qa/index1-5/portal-measure node scripts/index1-5/probe.cjs --script docs/index1-5-portal-fix-20261024/tools/measure.probe.cjs --out portal-measure [--phone]
   Per variant (old = portalFix 0, new = portalFix 1) and position: the share of "synthesised" pixels (debug view: magenta =
   rubber-sheet triangles of the old card / filled disocclusions of the new one) and the frame's L*. Saves PNGs next to run.json. */
const fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp }) => {
  const at = (process.env.PF_AT || '4.55,4.6,4.65,4.7').split(',').map(Number);
  const variants = (process.env.PF_VARIANTS || 'old,new').split(',');
  const dir = path.resolve(process.env.PF_OUT || '.qa/index1-5/portal-measure'); fs.mkdirSync(dir, { recursive: true });
  const rows = [];
  const analyse = (b64) => page.evaluate(async b64 => {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let m = 0, g = 0, n = c.width * c.height, Ls = 0;
    const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (r > 170 && b > 170 && gg < 110 && r - gg > 90 && b - gg > 90) m++;
      if (r < 40 && gg > 120 && b < 60) g++;
      const Y = .2126 * lin(r) + .7152 * lin(gg) + .0722 * lin(b); Ls += Y > .008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
    }
    return { w: c.width, h: c.height, magenta: m, magentaPct: +(100 * m / n).toFixed(4), noCardPct: +(100 * g / n).toFixed(3), lstar: +(Ls / n).toFixed(2) };
  }, b64);
  for (const v of variants) {
    await page.evaluate(v => { const C = window.__MONTIS_STUDY__.CONFIG.openingPortal; C.portalFix = v === 'old' ? 0 : 1; C.portalDebug = 1; window.index4.applyConfig(); }, v);
    for (const p of at) {
      await L.fly(page, p); await page.waitForTimeout(1500);
      const buf = await page.screenshot({ type: 'png' });
      const f = path.join(dir, `dbg-${v}-${p}.png`); fs.writeFileSync(f, buf);
      const a = await analyse(buf.toString('base64'));
      const st = await page.evaluate(() => { const P = window.__OPENING_PORTAL__; return { bakeMs: P && P.bake.ms, s: P && +P.state.s.toFixed(3), flying: P && P.state.flying }; });
      rows.push({ variant: v, p, ...a, ...st });
      console.log(v, p, JSON.stringify({ magentaPct: a.magentaPct, noCardPct: a.noCardPct, lstar: a.lstar, s: st.s, bakeMs: st.bakeMs }));
    }
  }
  fs.writeFileSync(path.join(dir, 'measure.json'), JSON.stringify(rows, null, 1));
  return { ok: true, rows: rows.map(r => ({ v: r.variant, p: r.p, magentaPct: r.magentaPct, noCardPct: r.noCardPct, bakeMs: r.bakeMs })) };
};
