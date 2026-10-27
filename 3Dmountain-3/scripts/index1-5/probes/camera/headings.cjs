const d = require('./design-lib.cjs');
let prev = null, out = [];
for (let p = 4.8; p <= 10.3; p += 0.05) { const s = d.sOf(p), h = d.headingOf(d.tangent(s)); let dh = prev === null ? 0 : h - prev; if (dh > 180) dh -= 360; if (dh < -180) dh += 360; out.push(`${p.toFixed(2)} s${s.toFixed(0)} h${h.toFixed(1)} d${(dh / .05).toFixed(0)}/u w${d.Wd(s).toFixed(1)}`); prev = h; }
console.log(out.join('\n'));
