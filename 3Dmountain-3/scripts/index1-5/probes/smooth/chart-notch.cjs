'use strict';
/* chart-notch.cjs — draws the one-notch step responses (Hubtown home / inner page, ours per section, the proposed filters) and the
   coasting after a 1 s stream into one jpg. Curves are the analytic models checked against the measured t63/t95/t99 (see
   model-filters.cjs and the study table). Usage: node scripts/index1-5/probes/smooth/chart-notch.cjs OUT.jpg */
const path = require('node:path'), L = require('../../lib.cjs');
const dt = 1 / 240;
const exp = tau => () => { let x = 0; return t => (x += (t - x) * (1 - Math.exp(-dt / tau))); };
const crit = om => () => { let x = 0, v = 0; return t => { const o = x - t, j = (v + om * o) * dt, d = Math.exp(-om * dt); x = t + (o + j) * d; v = (v - om * j) * d; return x; }; };
const silk = (tau, om) => () => { const a = exp(tau)(), b = crit(om)(); return t => b(a(t)); };
const series = [
  ['Hubtown home (Lenis lerp .04)', exp(.4167), '#e5484d', 3], ['Hubtown inner pages (lerp .1)', exp(.1667), '#f2a33a', 2],
  ['ours journey ω10.5', crit(10.5), '#2f7de1', 3], ['ours bridge ω5.5', crit(5.5), '#7c5cd6', 2], ['ours ocean ω6', crit(6), '#17a398', 2], ['ours strip ω12', crit(12), '#6b7280', 1.5],
  ['proposal silk B (τ.22 + ω12)', silk(.22, 12), '#16a34a', 3]];
const sim = (mk, events, T, tail) => { const f = mk(); let tgt = 0, i = 0; const out = []; for (let k = 0; k * dt < T; k++) { const t = k * dt; while (i < events.length && events[i][0] <= t) tgt += events[i++][1]; out.push([t, f(tgt)]); } return out; };
(async () => {
  const step = series.map(([n, mk, c, w]) => ({ n, c, w, pts: sim(mk, [[0, 1]], 2.5) }));
  const stream = series.map(([n, mk, c, w]) => { const s = sim(mk, Array.from({ length: 50 }, (_, i) => [i * .02, 1]), 3); const v = s.map((x, i) => i ? [x[0], (x[1] - s[i - 1][1]) / dt] : [0, 0]); const v0 = v[Math.round(1 / dt)][1]; return { n, c, w, pts: v.map(p => [p[0], p[1] / v0]) }; });
  const panel = (title, data, x0, ymax, xmax, marks) => {
    const W = 760, H = 420, px = t => x0 + 60 + t / xmax * (W - 90), py = y => 360 - y / ymax * 300; let s = `<text x="${x0 + 60}" y="30" font-size="18" font-weight="600" fill="#111">${title}</text>`;
    for (let g = 0; g <= 1.0001; g += .25) s += `<line x1="${px(0)}" x2="${px(xmax)}" y1="${py(g * ymax)}" y2="${py(g * ymax)}" stroke="#ddd"/><text x="${x0 + 12}" y="${py(g * ymax) + 4}" font-size="12" fill="#555">${(g * ymax).toFixed(2)}</text>`;
    for (let t = 0; t <= xmax + .001; t += .5) s += `<line x1="${px(t)}" x2="${px(t)}" y1="${py(0)}" y2="${py(ymax)}" stroke="#eee"/><text x="${px(t) - 8}" y="${py(0) + 16}" font-size="12" fill="#555">${t.toFixed(1)}s</text>`;
    for (const m of marks || []) s += `<line x1="${px(0)}" x2="${px(xmax)}" y1="${py(m)}" y2="${py(m)}" stroke="#999" stroke-dasharray="4 4"/>`;
    for (const d of data) s += `<polyline fill="none" stroke="${d.c}" stroke-width="${d.w}" points="${d.pts.filter((_, i) => i % 4 === 0 && d.pts[i][0] <= xmax).map(p => px(p[0]).toFixed(1) + ',' + py(Math.min(ymax * 1.02, p[1])).toFixed(1)).join(' ')}"/>`;
    return s;
  };
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1560" height="560" font-family="Segoe UI,sans-serif"><rect width="1560" height="560" fill="#fff"/>`;
  svg += panel('One 100 px notch: how fast the visual follows (1 = arrived)', step, 0, 1, 2.5, [.632, .95]);
  svg += panel('1 s stream, then stop: speed after the stop (1 = stream speed)', stream, 780, 1.1, 2, [.3]);
  series.forEach(([n, , c], i) => { svg += `<rect x="${60 + (i % 4) * 370}" y="${450 + Math.floor(i / 4) * 30}" width="18" height="6" fill="${c}"/><text x="${86 + (i % 4) * 370}" y="${458 + Math.floor(i / 4) * 30}" font-size="14" fill="#222">${n}</text>`; });
  svg += `</svg>`;
  const b = await L.launchBrowser({ gpu: false }), p = await b.newPage({ viewport: { width: 1560, height: 560 } });
  await p.setContent(`<body style="margin:0">${svg}</body>`);
  const f = path.resolve(process.argv[2]); L.writeFile(f, await p.screenshot({ type: 'jpeg', quality: 86 })); console.log('chart', L.abs(f));
  await b.close();
})();
