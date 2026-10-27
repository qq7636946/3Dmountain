const fs=require('fs'); const S=require('./sim.cjs');
const log = JSON.parse(fs.readFileSync('.qa/index1-5/camera/before-a-log.json','utf8'));
const frames = log.frames.filter(f => f[11] === 0 && f[1] >= 4.7 && f[1] <= 10.4);
const base = { sigma: 60, clamp: .45, racing: 1, ramp: .3, lookAhead0: 29, lookAhead1: 29, sigmaL: 0 };
for (const sigmaL of [100,150,200,260]) for (const la of [29,60,100]) for (const ramp of [.3]) {
  const P = { ...base, sigmaL, lookAhead1: la, ramp };
  console.log(`σL${sigmaL} la${la} r${ramp}`.padEnd(20), JSON.stringify(S.summarize(S.run(P, frames))));
}
