// node mkchart.cjs out.jpg "title" key  name1=analysis1.json:color  name2=analysis2.json:color ...
//   spec = label=analysis.json[@substring-of-the-log-name][:#color]   (analysis json = analyze.cjs --json output; key = ang | roll | y | ofs | latPx | shMag)
const fs = require('node:fs'), cp = require('node:child_process'), path = require('node:path');
const [out, title, key, ...series] = process.argv.slice(2);
const COL = { ang: 2, yaw: 3, roll: 4, y: 5, ofs: 6, sp: 7, dpdt: 9, pitch: 10, latPx: 11, shMag: 12 };
const labels = { ang: '°/s', yaw: '°/s', roll: '°', y: '高度', ofs: '側偏/河寬', latPx: 'px', shMag: 'world units' };
const S = series.map(a => { const m = /^(.*?)=(.*?)(?:@(.*?))?(?::(#[0-9a-fA-F]+))?$/.exec(a); const [, name, file, pick, color] = m; const j = JSON.parse(fs.readFileSync(file, 'utf8')); const entry = pick ? Object.entries(j).find(([k]) => k.includes(pick))[1] : Object.values(j)[0]; const rows = entry.rows.filter(r => r[8] === 0 && r[1] >= 4.8 && r[1] <= 10.3);
  // thin to 1 point per ~12 ms is unnecessary; keep all
  return { name, color: color || '#2b5fb0', points: rows.map(r => [r[1], key === 'roll' || key === 'ofs' || key === 'y' ? r[COL[key]] : r[COL[key]]]) }; });
const all = S.flatMap(s => s.points.map(p => p[1]));
const data = { series: S, xmin: 4.8, xmax: 10.3, ymax: key === 'ang' || key === 'yaw' ? 200 : undefined, xstep: .5,
  bands: [{ x0: 5.55, x1: 5.95, label: '彎道 A' }, { x0: 7.2, x1: 7.62, label: '彎道 B' }, { x0: 8.5, x1: 8.9, label: '彎道 C' }],
  hlines: key === 'ang' || key === 'yaw' ? [{ y: 70, label: '目標上限 70°/s' }, { y: 50, color: '#3a8a3a', label: '彎道平均 50°/s' }] : [] };
if (key === 'roll') { data.ymin = -8; data.ymax = 8; } if (key === 'ofs') { data.ymin = -.5; data.ymax = .5; } if (key === 'y') { data.ymin = 1.5; data.ymax = 5; }
const tmp = path.join(path.dirname(out), '.series-' + path.basename(out) + '.json'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(tmp, JSON.stringify(data));
const r = cp.spawnSync('node', [path.join(__dirname, 'chart.cjs'), out, title, 'journey p', labels[key] || key, tmp], { stdio: 'inherit' });
process.exit(r.status || 0);
