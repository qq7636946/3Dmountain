// index1-4-ascent · R1 "downstream" (2026-10-23). Client: 第一人稱往山谷裏面時候 往上拉升又回頭 邏輯很奇怪 應該是直接通向匯集的大海.
// The old route flew UP-stream (bay → glen → canyon), then rose straight up and turned round to look back at the bay.
// New route, one direction all the way: a high reveal over the range looking north (downstream) → a dive into the
// upper canyon on path B → first person with the current, through the confluence (CONVERGENCE rests there) → down the
// trunk glen (VALUE) → out over the bay, rising as it goes, ending over the bay mouth looking at the open sea
// (PERSPECTIVE). Only highland-scene.js; each replacement asserts a unique anchor. Run: node patch-r1-downstream.cjs
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, 'js', 'highland-scene.js');
let src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
for (const [label, find, repl] of [
  ['route',
`  // ---- the flight: over the open bay, up the trunk glen, through the canyon on path B ---------
  const trunk = meta.rivers.TRUNK.filter(p => p[1] < -620);
  const pathB = meta.rivers.B.filter(p => p[1] < -1700 && p[1] > -3420);
  const lead = [[520, 760], [700, 250], [560, -380], [170, -650]];
  const ground2 = lead.concat(trunk, pathB);
  const heightAlong = z => z > -650 ? THREE.MathUtils.lerp(26, 75, THREE.MathUtils.smoothstep(z, -650, 760))
    : z > -1950 ? 24 : z > -3020 ? 17 : THREE.MathUtils.lerp(17, 230, THREE.MathUtils.smoothstep(-z, 3000, 3400));   // VALUE: up out of the canyon, over its rim
  const curve = new THREE.CatmullRomCurve3(ground2.map(([x, z]) => new THREE.Vector3(x, heightAlong(z), z)), false, 'centripetal', .5);
  const pathLength = curve.getLength();
  const arcAtZ = z => {   // arc length where the flight first crosses depth z (going north)
    const n = 600; for (let i = 0; i <= n; i++) { const p = curve.getPointAt(i / n); if (p.z <= z) return i / n * pathLength; } return pathLength;
  };
  // q → arc length: a monotone cubic through the chapter anchors, so speed never jumps
  const qs = [1.404, 1.98, 3.86, 4.70, 5.88, 6.40, 6.85];
  const ss = [0, 140, arcAtZ(-1000), arcAtZ(-2250), arcAtZ(-2620), arcAtZ(-2860), arcAtZ(-3010)];
  const flightS = monotone(qs, ss);
  const widthAt = () => 40;

  // after the flight: the rise, the turn and the aerial over the four paths (q, x, y, z, yaw°, pitch°, fov)
  const AERIAL = [
    [7.60, 40, 430, -3120, 6, -34, 56],          // straight up out of the canyon, still looking up the valley
    [8.96, -300, showEverest ? 2300 : 1020, showEverest ? -4800 : -3700, 168, showEverest ? -24 : -25, showEverest ? 60 : 54],
    [10.15, -380, 1320, -3780, 172, -29.3, 50],
    [10.66, -380, 1320, -3780, 204, -27, 50],     // path A, the north-west glen
    [11.38, -330, 1300, -3760, 179, -35, 50],     // path B, the canyon
    [12.10, -300, 1300, -3760, 142, -28, 50],     // path C, north-east
    [12.82, -120, 1310, -3700, 150, -24, 50],     // path D, the eastern loch
    [13.80, -260, 1240, -3640, 174, -22, 50]      // one vision: all four into the bay, the island, the sea
  ];
`,
`  // ---- the flight (R1 downstream): with the current, from the upper canyon on path B, through the confluence,
  // down the trunk glen and out over the bay to the open sea. One direction (north) all the way, no turn-back.
  const trunk = meta.rivers.TRUNK.filter(p => p[1] < -620).slice().reverse();     // junction → bay
  const pathB = meta.rivers.B.filter(p => p[1] < -1700 && p[1] > -3420).slice().reverse();   // upper canyon → junction
  const tail = [[-30, -430], [-10, -60], [30, 380], [70, 820], [100, 1250]];        // the open bay, then out to sea
  const ground2 = pathB.concat(trunk, tail);
  const heightAlong = z => z < -1950 ? 17 : z < -650 ? 24
    : THREE.MathUtils.lerp(26, 170, THREE.MathUtils.smoothstep(z, -650, 1250));   // rising gently over the bay as the sea opens
  const curve = new THREE.CatmullRomCurve3(ground2.map(([x, z]) => new THREE.Vector3(x, heightAlong(z), z)), false, 'centripetal', .5);
  const pathLength = curve.getLength();
  const arcAtZ = z => {   // arc length where the flight first reaches z (going north)
    const n = 600; for (let i = 0; i <= n; i++) { const p = curve.getPointAt(i / n); if (p.z >= z) return i / n * pathLength; } return pathLength;
  };
  // q → arc length: a monotone cubic through the chapter anchors, so speed never jumps.
  // 3.00 the canyon floor after the dive · 3.86 deep in the canyon · 4.70 CONVERGENCE: arriving at the five-river
  // confluence · 5.88–6.85 VALUE: down the trunk glen to the bay · 7.60 over the bay, the sea opening ahead
  const FLY0 = 3.0, FLY1 = 7.6;
  const qs = [FLY0, 3.86, 4.70, 5.88, 6.40, 6.85, FLY1];
  const ss = [0, arcAtZ(-2720), arcAtZ(-1760), arcAtZ(-1180), arcAtZ(-880), arcAtZ(-640), arcAtZ(240)];
  const flightS = monotone(qs, ss);
  const widthAt = () => 40;

  // before the flight: the reveal over the range and the dive (q, x, y, z, yaw°, pitch°, fov); 180° = looking north
  const PRE = [
    [1.404, 60, 1320, -4720, 180, -21, 52],      // the reveal: canyon, confluence, glen, bay and the sea in one frame
    [1.98, 50, 1180, -4520, 180, -21, 52],       // a slow drift while the LOGO dissolves away
    [2.55, 30, 430, -3860, 179, -13, 56]         // the dive toward the canyon mouth
  ];
  // after the flight: still forward, still rising — over the bay mouth, the open sea ahead (PERSPECTIVE rests at 8.96)
  const POST = [
    [8.16, 70, 300, 520, 180, -9, 58],
    [8.96, 80, 430, 760, 180, -8, 58]
  ];
  const HOLD = POST[POST.length - 1].slice(1);
  const AERIAL = POST.concat([10.15, 11.38, 12.82, 13.8].map(q => [q, ...HOLD]));   // the old aerial tour is gone: hold the sea
`],
  ['flightPose-look',
`    // the opening frame looks across the newly opened bay, then turns toward the river route
    const look = THREE.MathUtils.smoothstep(q, 1.6, 2.6);
    _b.set(-55, 62, -70).lerp(_a, look);
    _b.sub(out.pos);
    out.yaw = THREE.MathUtils.radToDeg(Math.atan2(_b.x, -_b.z));
    out.pitch = THREE.MathUtils.radToDeg(Math.atan2(_b.y, Math.hypot(_b.x, _b.z)));
    out.fov = THREE.MathUtils.lerp(46, 58, look);
    return out;
  }
  const endPose = flightPose(6.85, { pos: new THREE.Vector3() });
  const keys = [[6.85, endPose.pos.x, endPose.pos.y, endPose.pos.z, endPose.yaw, endPose.pitch, endPose.fov], ...AERIAL];
  const track = [1, 2, 3, 4, 5, 6].map(c => monotone(keys.map(k => k[0]), keys.map(k => k[c])));
  const fogAt = q => THREE.MathUtils.lerp(LOOK.fog[0], LOOK.fog[1], THREE.MathUtils.smoothstep(q, 6.85, 8.96));`,
`    _b.copy(_a).sub(out.pos);
    out.yaw = (THREE.MathUtils.radToDeg(Math.atan2(_b.x, -_b.z)) + 360) % 360;   // [0,360): north ≈ 180, so the keyed tracks never wrap
    out.pitch = THREE.MathUtils.radToDeg(Math.atan2(_b.y, Math.hypot(_b.x, _b.z)));
    out.fov = 58;
    return out;
  }
  const poseKey = q => { const p = flightPose(q, { pos: new THREE.Vector3() }); return [q, p.pos.x, p.pos.y, p.pos.z, p.yaw, p.pitch, p.fov]; };
  const trackOf = keys => [1, 2, 3, 4, 5, 6].map(c => monotone(keys.map(k => k[0]), keys.map(k => k[c])));
  const preTrack = trackOf([...PRE, poseKey(FLY0)]);
  const track = trackOf([poseKey(FLY1), ...AERIAL]);
  // aerial = 1 high (the reveal, the end over the sea), 0 low in the canyon and the glen
  const aerialAt = q => THREE.MathUtils.clamp(1 - THREE.MathUtils.smoothstep(q, 2.2, 3.0) + THREE.MathUtils.smoothstep(q, 6.85, 8.96), 0, 1);
  const fogAt = q => THREE.MathUtils.lerp(LOOK.fog[0], LOOK.fog[1], aerialAt(q));`],
  ['applyPose',
`    else if (q <= 6.85) flightPose(q, pose);
    else { pose.pos.set(track[0](q), track[1](q), track[2](q)); pose.yaw = track[3](q); pose.pitch = track[4](q); pose.fov = track[5](q); }
    camera.position.copy(pose.pos);
    camera.position.y = Math.max(camera.position.y, ground(pose.pos.x, pose.pos.z) + (q < 6.85 ? 9 : 60));   // never inside a hill`,
`    else {
      const T = q < FLY0 ? preTrack : q > FLY1 ? track : null;
      if (!T) flightPose(q, pose);
      else { pose.pos.set(T[0](q), T[1](q), T[2](q)); pose.yaw = T[3](q); pose.pitch = T[4](q); pose.fov = T[5](q); }
    }
    camera.position.copy(pose.pos);
    camera.position.y = Math.max(camera.position.y, ground(pose.pos.x, pose.pos.z) + (pose.pos.y < 120 ? 9 : 60));   // never inside a hill`],
  ['near',
`    camera.near = q < 6.85 ? .5 : 2; camera.far = 14000;`,
`    camera.near = pose.pos.y < 120 ? .5 : 2; camera.far = 14000;`],
  ['hemi',
`      hemi.intensity = THREE.MathUtils.lerp(LOOK.hemi[2], LOOK.hemi[3], THREE.MathUtils.smoothstep(q, 6.85, 8.96));   // full fill down in the canyon, less over the range`,
`      hemi.intensity = THREE.MathUtils.lerp(LOOK.hemi[2], LOOK.hemi[3], aerialAt(q));   // full fill down in the canyon, less over the range`],
  ['low',
`      const low = window.__ASCENT_POSE__ ? window.__ASCENT_POSE__.pos[1] < 300 : q < 7.35;`,
`      const low = window.__ASCENT_POSE__ ? window.__ASCENT_POSE__.pos[1] < 300 : q > 2.6 && q < 7.75;   // detailed land for the low flight only`],
  ['walls',
`      const walls = q > 4.5 && low;`,
`      const walls = q > 3.1 && q < 6.7 && low;`]
]) {
  const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
  const n = src.split(f).length - 1;
  if (n !== 1) throw new Error(`[${label}] anchor found ${n} times`);
  src = src.replace(f, () => r);
}
fs.writeFileSync(file, src);
console.log('patched highland-scene.js 7');
