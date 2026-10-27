/* index1-4 · highland terrain builder (module worker).
   Turns the Blender-built height field (assets/world-height-2049.dz, unpacked by highland-scene.js) into carved, bedded terrain
   geometry off the main thread, while the hero and the LOGO chapter are playing.
   The underlying field is preserved, the central bay is carved upstream, and
   bounded, nonperiodic rock crags add relief without repeated height terraces.
   Density follows what the camera will see: 2.34 units along the flight (the river glen, the
   canyon), coarser with distance; outside the world the field is mirrored so
   the range runs on into the haze. Tiles carry skirts so neighbouring densities never crack.
   Two sets are built (see onmessage): DETAIL for the low flight, LIGHT for the aerials and the water's mirror. */
let H, N, X0, ZTOP, DX, OFF, SC;
let DEM, DN, DM;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function Hs(x, z) {
  let fx = (x - X0) / DX, fz = (ZTOP - z) / DX; const m = N - 1;
  fx = Math.abs(fx); fz = Math.abs(fz); if (fx > m) fx = clamp(2 * m - fx, 0, m); if (fz > m) fz = clamp(2 * m - fz, 0, m);
  fx = Math.min(fx, m - .001); fz = Math.min(fz, m - .001);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * N + ix;
  return ((H[i] * (1 - tx) + H[i + 1] * tx) * (1 - tz) + (H[i + N] * (1 - tx) + H[i + N + 1] * tx) * tz) * SC + OFF;
}
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash2 = (x, z) => { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); };
const hash1 = n => { const h = Math.sin(n * 127.1 + 1.7) * 43758.5453; return h - Math.floor(h); };
function vn(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return (hash2(ix, iz) * (1 - ux) + hash2(ix + 1, iz) * ux) * (1 - uz) + (hash2(ix, iz + 1) * (1 - ux) + hash2(ix + 1, iz + 1) * ux) * uz;
}
function fbm(x, z, oct = 5) {
  let s = 0, a = .5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vn(x, z); n += a; const nx = .8 * x + .6 * z, nz = -.6 * x + .8 * z; x = nx * 2.03 + 11.7; z = nz * 2.03 + 11.7; a *= .5; }
  return s / n;
}
const vn1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash1(i) * (1 - u) + hash1(i + 1) * u; };
const ridged = (x, z) => 1 - Math.abs(2 * vn(x, z) - 1);
const STRATA = 24;
function terrainAt(x, z, out, o) {
  const h = Hs(x, z);
  let y = h;
  const warp = (fbm(x * .0045, z * .0045) - .5) * 34 + (fbm(x * .021 + 3.1, z * .021 + 3.1, 3) - .5) * 7;
  const hs = y + warp + x * .05 - z * .028;
  let bc = hs / STRATA; bc += (vn1(bc * .55) - .5) * .9;
  let mc = hs / 6.1; mc += (vn1(mc * .7 + 3) - .5) * .8;
  const mask = smoothstep(.22, .55, fbm(x * .008 + y * .004 + 2.3, z * .008 + y * .004 + 2.3, 4));
  const gx = (Hs(x + 2, z) - Hs(x - 2, z)) / 4, gz = (Hs(x, z + 2) - Hs(x, z - 2)) / 4;
  const steep = 1 - smoothstep(.55, .86, 1 / Math.sqrt(1 + gx * gx + gz * gz));
  if (y > .5) {
    // Natural nonperiodic crags only: terrace quantisation formed concentric contour ribs.
    const crag = Math.pow(ridged(x / 13, z / 13), 1.8) * .65 + ridged(x / 4.6 + 3, z / 4.6 + 3) * .35;
    const cleave = Math.pow(ridged(x / 37 + 7, z / 37 - 2), 2);
    y += ((crag - .47) * 5.6 + (cleave - .50) * 3.0) * steep * smoothstep(.5, 6, y);
  }
  const n1 = (Hs(x + 6, z) + Hs(x - 6, z) + Hs(x, z + 6) + Hs(x, z - 6)) / 4;
  const n2 = (Hs(x + 18, z) + Hs(x - 18, z) + Hs(x, z + 18) + Hs(x, z - 18)) / 4;
  out[o] = y; out[o + 1] = bc; out[o + 2] = mc; out[o + 3] = mask;
  out[o + 4] = clamp(1 - (n1 - h) * .047 - (n2 - h) * .0206, .55, 1);
}

// Independent AWS/Mapzen Everest elevation, projected behind the authored river world.
function demAt(x,z){
  const width=8094., depth=7036., north=-4200.+depth;
  const reflect=t=>{const f=Math.abs(t)%2;return f>1?2-f:f;};
  const u=Math.min(.999999,reflect((x+width*.5)/width)),v=Math.min(.999999,reflect((north-z)/depth));
  const fx=u*(DN-1),fz=v*(DM-1),ix=fx|0,iz=fz|0,tx=fx-ix,tz=fz-iz,k=iz*DN+ix;
  const meters=((DEM[k]*(1-tx)+DEM[k+1]*tx)*(1-tz)+(DEM[k+DN]*(1-tx)+DEM[k+DN+1]*tx)*tz)*.25;
  return Math.max(20,(meters-4400)*.42);
}
function alpineAt(x,z,out,o){
  const h=demAt(x,z),d=18.;
  const bowl=(demAt(x+d,z)+demAt(x-d,z)+demAt(x,z+d)+demAt(x,z-d))*.25-h;
  out[o]=h;out[o+1]=0;out[o+2]=0;out[o+3]=0;out[o+4]=clamp(1.-Math.max(0,bowl)*.06,.54,1.);
}
const TILE = 300;
function tile(x0, z0, segs, acc, sample = terrainAt) {
  const s = TILE / segs, n = segs + 1, b = n + 2;
  const S = new Float32Array(b * b * 5);
  for (let j = 0; j < b; j++) for (let i = 0; i < b; i++) sample(x0 + (i - 1) * s, z0 + (j - 1) * s, S, (j * b + i) * 5);
  const base = acc.count;
  const put = (i, j, drop) => {
    const q = ((j + 1) * b + (i + 1)) * 5, k = acc.count++;
    const yl = S[q - 5], yr = S[q + 5], yd = S[q - b * 5], yu = S[q + b * 5];
    const nx = -(yr - yl) / (2 * s), nz = -(yu - yd) / (2 * s), l = Math.hypot(nx, 1, nz);
    acc.pos.push(x0 + i * s, S[q] - drop, z0 + j * s); acc.nor.push(nx / l, 1 / l, nz / l);
    acc.ao.push(S[q + 4]); acc.st.push(S[q + 1], S[q + 2], S[q + 3]);
    return k;
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put(i, j, 0);
  const g = (i, j) => base + j * n + i, I = acc.idx;
  for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) { const a = g(i, j), bb = g(i + 1, j), c = g(i, j + 1), d = g(i + 1, j + 1); I.push(a, c, bb, bb, c, d); }
  for (const edge of [i => [i, 0], i => [i, segs], i => [0, i], i => [segs, i]]) {
    const sk = []; for (let i = 0; i < n; i++) { const [ii, jj] = edge(i); sk.push(put(ii, jj, 14)); }
    for (let i = 0; i < segs; i++) {
      const [a0, a1] = edge(i), [b0, b1] = edge(i + 1); const ta = g(a0, a1), tb = g(b0, b1), sa = sk[i], sb = sk[i + 1];
      I.push(ta, sa, tb, tb, sa, sb, ta, tb, sa, tb, sb, sa);
    }
  }
}
function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L, 0, 1), px = ax + t * dx - x, pz = az + t * dz - z;
    best = Math.min(best, px * px + pz * pz);
  }
  return Math.sqrt(best);
}
onmessage = e => {
  const d = e.data;
  H = new Uint16Array(d.height); ({ n: N, x0: X0, ztop: ZTOP, dx: DX } = d.grid); OFF = d.encoding.offset; SC = d.encoding.scale;
  const t0 = performance.now(), route = d.route, lite = d.lite;
  if(d.dem){ DEM = new Uint16Array(d.dem); DN=d.demGrid.n; DM=d.demGrid.m; }
  const W = (N - 1) * DX, xMin = X0, xMax = X0 + W, zMax = ZTOP, zMin = ZTOP - W;
  /* Two sets (optimisation, client 2026-10-22 "要壓縮並優化 不然現在很卡"):
     DETAIL — only drawn during the low first-person flight: full density right along the route and on the
              island, falling off fast; 600-unit chunks so whatever is behind or beside the camera is culled.
     LIGHT  — ~¼ of the vertices: drawn for the aerials, and ALWAYS used by the water's mirror, so the
              reflection pass never redraws the detailed land (that doubling was the 30 ms stutter). */
  const plans = {
    detail: { chunk: 600, segs: (dd, inside) => !inside ? 8 : dd <= 120 ? 128 : dd <= 500 ? 64 : dd <= 1300 ? 32 : 16 },
    light: { chunk: 1200, segs: (dd, inside, dRoute) => !inside ? 8 : Math.min(dRoute, dd) <= 250 ? 64 : 32 }
  };
  const result = {}, transfer = [];
  for (const [name, plan] of Object.entries(plans)) {
    const chunks = new Map(); let verts = 0, tiles = 0, tris = 0;
    for (let z0 = zMin - 1200; z0 < zMax + 1200; z0 += TILE) for (let x0 = xMin - 1200; x0 < xMax + 1200; x0 += TILE) {
      const cx = x0 + TILE / 2, cz = z0 + TILE / 2;
      const inside = cx > xMin && cx < xMax && cz > zMin && cz < zMax;
      const dRoute = distToPolyline(cx, cz, route) - TILE * .5;
      // The central bay is submerged; reserve dense geometry for the actual low-flight route.
      let segs = plan.segs(dRoute, inside, dRoute);
      if (lite) segs = Math.max(8, segs / 2);
      const key = `${Math.floor((x0 - xMin + 1200) / plan.chunk)},${Math.floor((z0 - zMin + 1200) / plan.chunk)}`;
      if (!chunks.has(key)) chunks.set(key, { pos: [], nor: [], ao: [], st: [], idx: [], count: 0 });
      tile(x0, z0, segs, chunks.get(key)); tiles++;
    }
    const out = [];
    for (const c of chunks.values()) {
      // normals as normalised int8 (12 → 3 bytes a vertex, ~16 MB less GPU memory; 1/127 steps are invisible under the maps)
      const o = { position: new Float32Array(c.pos), normal: Int8Array.from(c.nor, v => Math.round(v * 127)), terrainAO: new Float32Array(c.ao), aStrata: new Float32Array(c.st),
        index: c.count > 65535 ? new Uint32Array(c.idx) : new Uint16Array(c.idx) };
      verts += c.count; tris += c.idx.length / 3; out.push(o); transfer.push(o.position.buffer, o.normal.buffer, o.terrainAO.buffer, o.aStrata.buffer, o.index.buffer);
    }
    result[name] = { chunks: out, stats: { tiles, verts, tris, chunks: out.length } };
  }
  if(DEM){
    const chunks=[];let verts=0,tris=0,tiles=0;
    for(let z0=-6000;z0<6600;z0+=TILE*4) for(let x0=-7200;x0<7200;x0+=TILE*4){
      const c={pos:[],nor:[],ao:[],st:[],idx:[],count:0};
      const outside=Math.abs(x0)>4200||z0 < -4200||z0>=3000;
      const segs=outside?(lite?4:8):lite?8:(z0<600?32:16);
      for(let zz=z0;zz<Math.min(6600,z0+TILE*4);zz+=TILE)for(let xx=x0;xx<x0+TILE*4;xx+=TILE){tile(xx,zz,segs,c,alpineAt);tiles++;}
      const o={position:new Float32Array(c.pos),normal:Int8Array.from(c.nor,v=>Math.round(v*127)),terrainAO:new Float32Array(c.ao),aStrata:new Float32Array(c.st),index:c.count>65535?new Uint32Array(c.idx):new Uint16Array(c.idx)};
      verts+=c.count;tris+=c.idx.length/3;chunks.push(o);transfer.push(o.position.buffer,o.normal.buffer,o.terrainAO.buffer,o.aStrata.buffer,o.index.buffer);
    }
    result.backdrop={chunks,stats:{verts,tris,tiles,chunks:chunks.length}};
  }
  postMessage({ sets: result, ms: Math.round(performance.now() - t0) }, transfer);
};
