/* Alpine terrain dials (index1-5-alpine, 2026-10-23).
   One flat, mutable object: numbers and '#rrggbb'. Material keys are read every frame (the terrain
   shader's uniforms are refreshed from this object before each draw); keys whose label carries ↻
   shape the baked height field and are read once, when the landscape is built (reload to apply).
   Nothing here addresses a height ring: snow, scree and plants follow slope, drainage, shelter
   and exposure; the snow line and the plant line only bias them, through broken noise. */
export const ALPINE_TERRAIN = {
  // ---- geometry (load-time ↻) ----
  erosion: 1,          // drainage erosion: gullies and V valleys carved by the water that would drain to the rivers
  ridgeSharp: .7,      // knife-edge crests on the divides the erosion leaves
  relief: 1,           // secondary spurs and ribs seeded before the erosion runs
  range: 1,            // the ridge net between the named massifs (0 = the old flat ground between cones)
  meshDetail: 1,       // desktop grid density (1 = 20-unit cells; .8 = the old 24; mobile keeps 36)
  // ---- snow & ice ----
  snow: 1,             // snow amount
  snowLine: 380,       // where snow starts to hold (world units; broken by noise, shelter and drainage)
  snowFade: 340,       // how far above the snow line full cover is reached
  snowSlope: 52,       // steepest face (degrees) that still holds snow; steeper rock stays bare
  windRipple: 1,       // wind-scoured ripples on the snow surface (close range)
  glacier: 1,          // ice and firn filling the high drainage hollows, moraine rubble along their sides
  snowColor: '#eef3f7',
  snowShade: '#8ea4bd',// blue-grey in hollows and on the shaded side of the snow
  // ---- rock ----
  rockColor: '#4f4d4a',
  rockColor2: '#655c52',// warm grey-brown mineral variety
  rockTone: 1,          // overall rock lightness
  rockDetail: 1,        // fracture normals and grain strength
  rockScale: 1,         // fracture size (larger = bigger plates)
  cliffRelief: 1,       // canyon walls: buttresses, ribs and runnels raised out of the wall (outward only)
  gully: 1,             // fall-line gullies and ribs in the shading (follow the slope, never contours)
  scree: 1,             // talus aprons under the cliffs
  screeColor: '#77726a',
  // ---- low valley ----
  grass: 1,             // dry grass on the gentle low slopes
  grassColor: '#8b7853',
  forest: 1,            // dark forest / scrub patches on the valley floors and sheltered low slopes
  forestColor: '#27311f',
  plantLine: 300        // where plants thin out (broken by noise and aspect, not a level line)
};

// Look-dev: ?alpine={"erosion":1.4,"snowLine":300} overrides any key before the landscape is built.
try {
  const q = typeof location === 'object' ? new URLSearchParams(location.search).get('alpine') : null;
  if (q) for (const [k, v] of Object.entries(JSON.parse(q))) if (k in ALPINE_TERRAIN && typeof v === typeof ALPINE_TERRAIN[k]) ALPINE_TERRAIN[k] = v;
} catch { /* malformed override: keep the defaults */ }

export const ALPINE_TERRAIN_ROWS = [
  ['沖蝕溝谷強度 ↻', 'erosion', 0, 2, .05],
  ['稜線銳利度 ↻', 'ridgeSharp', 0, 2, .05],
  ['地形細節起伏 ↻', 'relief', 0, 2, .05],
  ['山脈連綿度 ↻', 'range', 0, 2, .05],
  ['網格精細度 ↻', 'meshDetail', .8, 1.25, .05],
  ['積雪量', 'snow', 0, 2, .01],
  ['雪線高度', 'snowLine', 0, 1400, 10],
  ['雪線過渡寬度', 'snowFade', 60, 900, 10],
  ['積雪坡度上限（度）', 'snowSlope', 20, 70, 1],
  ['雪面風紋', 'windRipple', 0, 2, .01],
  ['冰河與冰磧', 'glacier', 0, 2, .01],
  ['雪色', 'snowColor'],
  ['雪的陰影色', 'snowShade'],
  ['岩石色', 'rockColor'],
  ['岩石色（褐）', 'rockColor2'],
  ['岩石明暗', 'rockTone', .4, 1.8, .01],
  ['岩面細節強度', 'rockDetail', 0, 2, .01],
  ['岩面細節尺度', 'rockScale', .4, 2.5, .01],
  ['峽谷崖壁起伏', 'cliffRelief', 0, 2.5, .01],
  ['順坡沖蝕紋', 'gully', 0, 2, .01],
  ['碎石坡量', 'scree', 0, 2, .01],
  ['碎石色', 'screeColor'],
  ['乾草坡量', 'grass', 0, 2, .01],
  ['草色', 'grassColor'],
  ['森林灌叢量', 'forest', 0, 2, .01],
  ['森林色', 'forestColor'],
  ['植被上限高度', 'plantLine', 0, 900, 10]
];
