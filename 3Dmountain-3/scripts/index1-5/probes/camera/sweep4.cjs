const fs=require('fs'); const S=require('./sim4.cjs');
const log = JSON.parse(fs.readFileSync('.qa/index1-5/camera/before-a-log.json','utf8'));
const frames = log.frames.filter(f => f[11] === 0 && f[1] >= 4.7 && f[1] <= 10.4);
const sets = {
  task3: { start: [4.87, 0], c3: [7.694, 3], c4: [9.794, 3] },
  task3t1: { start: [4.87, 0], c3: [7.694, 1.5], c4: [9.794, 1.5] },
  cue5: { start: [4.87, 0], c1: [5.014, 3], c2: [5.854, 3], c3: [7.694, 3], c4: [9.794, 3] },
  all7: S.ANCH,
};
for (const [name, anchors] of Object.entries(sets)) for (const r of [50, 60, 65]) for (const [sigmaU, lead] of [[.3, .25]]) {
  const res = S.solve({ r, delta: 60, sigmaU, lead, anchors });
  if (!res.ok) { console.log(name, r, 'infeasible at', res.at); continue; }
  console.log(name.padEnd(8), 'r', r, JSON.stringify(S.summarize(S.evaluate(res, frames, .04))));
}
