// index1-4-ascent · H1 (2026-10-23). Client: 水滴用 index1-3-maritime.html 去修 — the opening drop and sea take
// index1-3-maritime's look (its live values, read from the page): slate room, slate-blue water with the room in its
// reflection, the maritime drop (metal room-mirror, not the refractive "fluid" ball), its glow, horizon and grade.
// Edits the copy's built main.js directly (this copy has no build step). Run: node patch-h1-maritime-drop.cjs
const fs = require('node:fs'), path = require('node:path');
const file = path.join(__dirname, 'js', 'main.js');
let src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
for (const [label, find, repl] of [
  ['room',
`        Object.assign(CONFIG.field,{zenith:'#a4b9c8',upper:'#c5d4dc',top:'#315777',horizon:'#bdced8',lower:'#7894a6',floor:'#2c4d65',ink:'#20374c',core:.65,coreSpread:1,bandGain:.035});
        Object.assign(CONFIG.grade,{hue:0,sat:1.01,temp:.10,tint:0});
        Object.assign(CONFIG.drop,{iris:.035,roughness:.022,contour:.12,rim:.24,streak:1.05,lens:.16});
        Object.assign(CONFIG.droplet,{sheen:.55});
        Object.assign(CONFIG.chrome,{iris:.025,rough:.032,aniso:.35,streak:.95});`,
`        /* ascent H1: index1-3-maritime's opening (room, grade, drop, chrome), value for value */
        Object.assign(CONFIG.field,{zenith:'#bacbd7',upper:'#d4e0e5',top:'#18374e',horizon:'#aebfc9',lower:'#657f8e',floor:'#294b60',ink:'#203b50',core:.9,coreSpread:.55,bandGain:.035});
        Object.assign(CONFIG.grade,{hue:0,sat:.93,temp:.015,tint:0});
        Object.assign(CONFIG.drop,{roughness:.028,f0:.94,aniso:.08,streak:1.55,iris:.58,irisEdge:1.35,contour:.55,card:.92,rim:.55,rimEdge:12,lens:.34,lensEdge:8.5});
        Object.assign(CONFIG.droplet,{sheen:1});
        Object.assign(CONFIG.chrome,{bands:1.5,bandPhase:.145,bandLight:1.2,bandInk:1.35,rail:2.1,railY:.48,f0:.88,rough:.024,aniso:.55,streak:1.15,iris:.085,irisPhase:2.4,irisEdge:3.5,occlude:.11});
        CONFIG.sea.screenDown = 60;
        CONFIG.scene.exposure = .88;`],
  ['fluid',
`        uHlFluid: { value: HL_CONFLUENCE ? 1 : 0 },`,
`        uHlFluid: { value: 0 },   /* ascent H1: the maritime drop (room mirror), not the refractive fluid ball */`],
  ['glow',
`        uEnvGlow: { value: new THREE.Vector3(1.00, 1.03, 1.10) },`,
`        uEnvGlow: { value: HL_CONFLUENCE ? new THREE.Vector3(.676, .694, .686) : new THREE.Vector3(1.00, 1.03, 1.10) },   /* ascent H1: maritime glow #e3e9e6 × .76 */`],
  ['water',
`        uHlWater: { value: new THREE.Vector3(HL_SUNNY ? 1 : 0, 1, .6) },
        uHlDeep: { value: paletteLinear(HL_CONFLUENCE ? '#233f54' : '#1d5d76') }, uHlMid: { value: paletteLinear(HL_CONFLUENCE ? '#64889d' : '#4b95ad') },`,
`        uHlWater: { value: new THREE.Vector3(HL_SUNNY ? 1 : 0, HL_CONFLUENCE ? .92 : 1, HL_CONFLUENCE ? .25 : .6) },   /* ascent H1: maritime reflect .92, glint .25 */
        uHlDeep: { value: paletteLinear(HL_CONFLUENCE ? '#294c60' : '#1d5d76') }, uHlMid: { value: paletteLinear(HL_CONFLUENCE ? '#7d9da9' : '#4b95ad') },`]
]) {
  const f = find.replace(/\r?\n/g, eol), r = repl.replace(/\r?\n/g, eol);
  if (src.split(f).length - 1 !== 1) throw new Error(`[${label}] anchor`);
  src = src.replace(f, () => r);
}
fs.writeFileSync(file, src);
console.log('patched main.js 4');
