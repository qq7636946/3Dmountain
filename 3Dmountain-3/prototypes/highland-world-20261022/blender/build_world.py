# Highland world — extends the licensed "Snowy Mountain V2" terrain into a full range (2026-10-22).
# Run headless:  blender -b --factory-startup --python build_world.py
#
# 1. Extracts the original eroded terrain from the glTF at 1025² (BVH ray casts; the study used 513²).
# 2. Keeps that island exactly where the key visual has it (world x = 60·mx, z = −60·my,
#    y = 68·h − 32, edge fading to −16) and grows a 4800 × 4800 world around it.
# 3. The surrounding ranges are "texture-bombed" from the same terrain: random windows of it,
#    rotated, scaled, mirrored and blended by a smooth max, so every ridge keeps the original's
#    erosion character. Farther ranges stand taller.
# 4. A bay and a south coast keep the silver sea; sea-loch valleys and the "four paths" river network
#    (with a canyon section through an uplifted plateau) are carved down to below sea level.
# 5. Writes the height field (Float32, 4097² and 1025²), world-meta.json (grid, rivers, shots),
#    a .blend scene (mesh, approximate procedural material, water, cameras) and a .glb.
import bpy, numpy as np, json, os, math, time
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT = r'G:\我的雲端硬碟\2026_專案資料夾\2607_恒灝\site\3Dmountain-3'
SRC = os.path.join(ROOT, '_archive', 'models', 'snowy_mountain_v2_-_terrain')
OUT = os.path.join(ROOT, 'prototypes', 'highland-world-20261022')
ASSETS = os.path.join(OUT, 'assets')
os.makedirs(ASSETS, exist_ok=True)
T0 = time.time()
def log(*a): print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)
rng = np.random.default_rng(20261022)

# ---------------------------------------------------------------------------------------------
# 1. the original terrain, 1025² over model x,y ∈ [-10, 10]
# ---------------------------------------------------------------------------------------------
g = json.load(open(os.path.join(SRC, 'scene.gltf'), encoding='utf-8'))
blob = open(os.path.join(SRC, 'scene.bin'), 'rb').read()
def accessor(i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    if v.get('byteStride') and v['byteStride'] != n * np.dtype(dt).itemsize: raise RuntimeError('interleaved buffer')
    arr = np.frombuffer(blob, dtype=dt, count=a['count'] * n, offset=off)
    return arr.reshape(a['count'], n) if n > 1 else arr
verts, tris, base = [], [], 0
for m in g['meshes']:
    for p in m['primitives']:
        P = accessor(p['attributes']['POSITION']); I = accessor(p['indices']).astype(np.int64).reshape(-1, 3)
        verts.append(P); tris.append(I + base); base += len(P)
V = np.concatenate(verts).astype(np.float64); TRI = np.concatenate(tris)
log('source mesh', len(V), 'verts', len(TRI), 'tris; z range', V[:, 2].min(), V[:, 2].max())
bvh = BVHTree.FromPolygons(V.tolist(), TRI.tolist(), all_triangles=True)
NH = 1025
H = np.full((NH, NH), np.nan, np.float32)
for iy in range(NH):
    y = -10 + iy * 20 / (NH - 1)
    row = H[iy]
    for ix in range(NH):
        hit = bvh.ray_cast((-10 + ix * 20 / (NH - 1), y, 60.0), (0, 0, -1))
        if hit[0] is not None: row[ix] = hit[0].z
miss = np.isnan(H)
if miss.any():   # rim samples that fall just outside the mesh: copy the nearest valid neighbour inward
    for _ in range(8):
        m = np.isnan(H)
        if not m.any(): break
        for sh in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            src = np.roll(H, sh, (0, 1)); fill = m & ~np.isnan(src); H[fill] = src[fill]
log('hero raycast done; missing before fill', int(miss.sum()))
study = os.path.join(ROOT, 'prototypes', 'highland-material-study-20261022', 'assets', 'terrain-height-513.bin')
if os.path.exists(study):
    S = np.fromfile(study, np.float32).reshape(513, 513)
    d = H[::2, ::2] - S
    log('vs study 513 grid: rms', float(np.sqrt((d ** 2).mean())), 'max', float(np.abs(d).max()))
np.save(os.path.join(ASSETS, 'hero-raw-1025.npy'), H)

# ---------------------------------------------------------------------------------------------
# 2. the world grid: x ∈ [-2400, 2400], z ∈ [-3600, 1200]; row 0 = z +1200 (the study's convention)
# ---------------------------------------------------------------------------------------------
DX = 1200 / 1024; NW = 4097; X0 = -2400.0; ZTOP = 1200.0
LAT = rng.random((512, 512)).astype(np.float32)
def vnoise(x, y):
    xi = np.floor(x); yi = np.floor(y); fx = (x - xi).astype(np.float32); fy = (y - yi).astype(np.float32)
    xi = xi.astype(np.int64) & 511; yi = yi.astype(np.int64) & 511; x1 = (xi + 1) & 511; y1 = (yi + 1) & 511
    ux = fx * fx * (3 - 2 * fx); uy = fy * fy * (3 - 2 * fy)
    return (LAT[yi, xi] * (1 - ux) + LAT[yi, x1] * ux) * (1 - uy) + (LAT[y1, xi] * (1 - ux) + LAT[y1, x1] * ux) * uy
def fbm(x, y, oct=5):
    s = 0; a = .5; n = 0
    for _ in range(oct):
        s = s + a * vnoise(x, y); n += a
        x, y = .8 * x + .6 * y, -.6 * x + .8 * y
        x = x * 2.03 + 11.7; y = y * 2.03 + 11.7; a *= .5
    return s / n
def rfbm(x, y, oct=5):   # ridged: sharp crests, the backbone of a range
    s = 0; a = .5; n = 0
    for _ in range(oct):
        r = 1 - np.abs(2 * vnoise(x, y) - 1); s = s + a * r * r; n += a
        x, y = .8 * x + .6 * y, -.6 * x + .8 * y
        x = x * 2.07 + 5.3; y = y * 2.07 + 5.3; a *= .5
    return s / n
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def smax(a, b, k):
    m = np.maximum(a, b); return m + k * np.log(np.exp((a - m) / k) + np.exp((b - m) / k))
def smin(a, b, k): return -smax(-a, -b, k)
def hero_raw(xl, zl):   # bilinear in H; xl, zl in hero-local world units [-600, 600]
    fx = np.clip((xl + 600) / 1200 * (NH - 1), 0, NH - 1.001); fy = np.clip((600 - zl) / 1200 * (NH - 1), 0, NH - 1.001)
    ix = fx.astype(np.int64); iy = fy.astype(np.int64); tx = (fx - ix).astype(np.float32); ty = (fy - iy).astype(np.float32)
    return (H[iy, ix] * (1 - tx) + H[iy, ix + 1] * tx) * (1 - ty) + (H[iy + 1, ix] * (1 - tx) + H[iy + 1, ix + 1] * tx) * ty

xs = (X0 + np.arange(NW) * DX).astype(np.float32)
zs = (ZTOP - np.arange(NW) * DX).astype(np.float32)
W = np.empty((NW, NW), np.float32)
CH = 256
for r0 in range(0, NW, CH):   # a mountainous base: ridged crests, so nothing between the ranges is a lowland
    zz, xx = np.meshgrid(zs[r0:r0 + CH], xs, indexing='ij')
    far = sstep(400, 2600, np.hypot(np.maximum(np.abs(xx) - 600, 0), np.maximum(np.abs(zz) - 600, 0)))
    W[r0:r0 + CH] = 20 + 95 * fbm(xx / 760, zz / 760) + (150 + 90 * far) * (rfbm(xx / 520 + 3, zz / 520 + 3) - .25) + 25 * (fbm(xx / 160 + 5, zz / 160 + 5, 4) - .5)
log('base range')

# ranges: random windows of the original terrain, rotated / scaled / mirrored, union by smooth max
patches = []
spacing = 400
for gz in np.arange(-3600 + 150, 1200, spacing):
    for gx in np.arange(-2400 + 120, 2400, spacing):
        cx = gx + rng.uniform(-.38, .38) * spacing; cz = gz + rng.uniform(-.38, .38) * spacing
        bd = math.hypot(max(abs(cx) - 600, 0), max(abs(cz) - 600, 0))
        if bd < 470 or cz > 650: continue          # leave the bay and the southern sea open
        hw = rng.uniform(300, 520)
        patches.append(dict(cx=cx, cz=cz, th=rng.uniform(0, 2 * math.pi), s=rng.uniform(.95, 1.5), mirror=bool(rng.random() < .5),
                            hw=hw, sx=rng.uniform(-600 + hw, 600 - hw), sz=rng.uniform(-600 + hw, 600 - hw),
                            a=.95 + .7 * float(np.clip((bd - 400) / 2400, 0, 1)) + rng.uniform(-.1, .15), lift=rng.uniform(25, 55)))
log('patches', len(patches))
for k, pa in enumerate(patches):
    R = pa['hw'] * pa['s'] * 1.0
    c0 = max(0, int((pa['cx'] - R - X0) / DX)); c1 = min(NW, int((pa['cx'] + R - X0) / DX) + 2)
    r0 = max(0, int((ZTOP - (pa['cz'] + R)) / DX)); r1 = min(NW, int((ZTOP - (pa['cz'] - R)) / DX) + 2)
    if c1 <= c0 or r1 <= r0: continue
    zz, xx = np.meshgrid(zs[r0:r1], xs[c0:c1], indexing='ij')
    wx = (fbm(xx / 380 + 3, zz / 380 + 3, 3) - .5) * 70; wz = (fbm(xx / 380 + 9, zz / 380 + 9, 3) - .5) * 70   # domain warp
    dx_ = (xx + wx - pa['cx']) / pa['s']; dz_ = (zz + wz - pa['cz']) / pa['s']
    c, s_ = math.cos(-pa['th']), math.sin(-pa['th'])
    lx = c * dx_ - s_ * dz_; lz = s_ * dx_ + c * dz_
    if pa['mirror']: lx = -lx
    r = np.sqrt(lx * lx + lz * lz) / pa['hw']
    f = 1 - sstep(.42, .98, r)
    hp = (hero_raw(pa['sx'] + lx, pa['sz'] + lz) * 68 - 32) * pa['a'] + pa['lift']
    hp = hp * f + (-30) * (1 - f)
    W[r0:r1, c0:c1] = smax(W[r0:r1, c0:c1], hp, 14.0)
    if k % 10 == 0: log('patch', k)
log('ranges done; max', float(W.max()))

# ---------------------------------------------------------------------------------------------
# 3. rivers: the "four paths" fanning north from the bay, a trunk, a west sea loch; a canyon on path B
# ---------------------------------------------------------------------------------------------
# nodes: (x, z, half-width of water, g1, g2, plateau uplift)   — wall height = g1·t + g2·t², t = d − w
# (2026-10-22 confluence pass: the mouths at the junction are wider — 44/40/38/40 and D 38 — so the five
#  channels open into the confluence instead of meeting in a crease; the courses themselves are unchanged)
TRUNK = [(-40, -560, 46, .30, .0048, 0), (-110, -950, 44, .30, .0048, 0), (10, -1320, 42, .32, .005, 0), (-70, -1650, 44, .34, .005, 0)]
PATHS = {
    'A': [(-70, -1650, 40, .40, .0055, 0), (-480, -1920, 28, .42, .0055, 0), (-900, -2260, 26, .44, .0056, 0), (-1340, -2540, 26, .44, .0056, 0), (-1820, -2920, 26, .44, .0056, 0), (-2400, -3350, 26, .44, .0056, 0)],
    'B': [(-70, -1650, 38, .42, .0055, 0), (-40, -2000, 24, .7, .007, 50), (50, -2300, 22, 1.35, .011, 160), (-30, -2650, 21, 1.4, .011, 170), (60, -3000, 22, 1.25, .010, 150), (0, -3600, 24, .55, .006, 30)],
    'C': [(-70, -1650, 40, .40, .0055, 0), (300, -1950, 28, .42, .0055, 0), (700, -2210, 26, .44, .0056, 0), (1100, -2600, 26, .44, .0056, 0), (1520, -3020, 26, .44, .0056, 0), (2050, -3560, 26, .44, .0056, 0)],
    'D': [(10, -1320, 38, .40, .0055, 0), (450, -1410, 28, .42, .0055, 0), (900, -1300, 26, .44, .0056, 0), (1400, -1470, 26, .44, .0056, 0), (1920, -1360, 26, .44, .0056, 0), (2400, -1520, 26, .44, .0056, 0)],
    'WEST': [(-560, -200, 50, .28, .0042, 0), (-1050, -150, 46, .30, .0045, 0), (-1560, -420, 42, .32, .0047, 0), (-2050, -300, 40, .34, .005, 0), (-2400, -520, 40, .34, .005, 0)],
}
def catmull(pts, step=3.0, meander=(28, 210), seed=0):
    P = np.array(pts, np.float64); out = []
    ext = np.vstack([P[0] * 2 - P[1], P, P[-1] * 2 - P[-2]])
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        n = max(2, int(np.hypot(*(p2[:2] - p1[:2])) / step))
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1]); out = np.array(out)
    # meander: one long sway whose amplitude itself wanders, growing from zero at the junction;
    # the water's width breathes along the course
    seg = np.diff(out[:, :2], axis=0); seg = np.vstack([seg, seg[-1:]]); L = np.cumsum(np.hypot(seg[:, 0], seg[:, 1]))
    nrm = np.stack([-seg[:, 1], seg[:, 0]], 1) / np.maximum(np.hypot(seg[:, 0], seg[:, 1]), 1e-6)[:, None]
    amp, lam = meander; ph = seed * 1.7
    env = .55 + .45 * np.sin(L / (lam * 2.7) * 2 * math.pi + ph * 3)
    sway = amp * np.minimum(L / 220, 1) * env * np.sin(L / lam * 2 * math.pi + ph) + amp * .5 * np.sin(L / (lam * 3.3) * 2 * math.pi + ph * 2)
    out[:, :2] += nrm * sway[:, None]
    out[:, 2] *= 1 + .28 * np.sin(L / 340 + ph * 5) * np.minimum(L / 200, 1)
    return out
rivers = {'TRUNK': catmull(TRUNK, meander=(34, 420), seed=1)}
for i, (k, v) in enumerate(PATHS.items()): rivers[k] = catmull(v, meander=(30 if k != 'B' else 14, 380), seed=i + 2)
log('river points', sum(len(v) for v in rivers.values()))
NC = 1025; DC = 4800 / (NC - 1)
def upsample(a, f):
    n = a.shape[-1]; m = (n - 1) * f + 1; u = np.arange(m) / f; i0 = np.minimum(u.astype(np.int64), n - 2); t = (u - i0).astype(np.float32)
    a = a[..., i0, :] * (1 - t)[:, None] + a[..., i0 + 1, :] * t[:, None]
    return a[..., i0] * (1 - t) + a[..., i0 + 1] * t
# each river gets its own distance field and its own valley; valleys merge by a smooth union, so
# there is no seam where "the nearest river" changes (v1 shared one field and showed fan-shaped creases)
target = np.full((NC, NC), 1e4, np.float32); uplift = np.zeros((NC, NC), np.float32)
cz_ = ZTOP - np.arange(NC) * DC; cx_ = X0 + np.arange(NC) * DC
for name, rp in rivers.items():
    kd = KDTree(len(rp))
    for i, p in enumerate(rp): kd.insert((p[0], p[1], 0), i)
    kd.balance()
    R = 900
    c0 = max(0, int((rp[:, 0].min() - R - X0) / DC)); c1 = min(NC, int((rp[:, 0].max() + R - X0) / DC) + 2)
    r0 = max(0, int((ZTOP - (rp[:, 1].max() + R)) / DC)); r1 = min(NC, int((ZTOP - (rp[:, 1].min() - R)) / DC) + 2)
    d = np.empty((r1 - r0, c1 - c0), np.float32); near = np.empty((r1 - r0, c1 - c0), np.int64)
    for r in range(r0, r1):
        for c in range(c0, c1):
            co, idx, dd = kd.find((cx_[c], cz_[r], 0)); d[r - r0, c - c0] = dd; near[r - r0, c - c0] = idx
    w, g1, g2, up = (rp[near, k].astype(np.float32) for k in (2, 3, 4, 5))
    # ragged walls: buttresses and recesses instead of a smooth trough (less on the water itself)
    gz_, gx_ = np.meshgrid(cz_[r0:r1], cx_[c0:c1], indexing='ij')
    rag = (fbm(gx_ / 85 + 4, gz_ / 85 + 4, 4) - .5) * 2 * 34 + (fbm(gx_ / 30 + 8, gz_ / 30 + 8, 3) - .5) * 2 * 9
    d = d + rag * sstep(w * .6, w + 40, d)
    t = np.maximum(d - w, 0)
    target[r0:r1, c0:c1] = smin(target[r0:r1, c0:c1], -9 + g1 * t + g2 * t * t, 22.0)
    if up.max() > 0: uplift[r0:r1, c0:c1] = np.maximum(uplift[r0:r1, c0:c1], up * (1 - sstep(240, 640, d)))
    log('river', name)
# CONFLUENCE (2026-10-22): open water where the paths meet — a pool at the junction (trunk + A, B, C) and a
# smaller one at path D's mouth — so from the air five channels visibly meet, as on the top-down map
JX, JZ = TRUNK[-1][0], TRUNK[-1][1]
POOLS = [(JX, JZ, 78.0), (PATHS['D'][0][0], PATHS['D'][0][1], 58.0)]
for px, pz, pr in POOLS:
    R = pr + 400
    c0 = max(0, int((px - R - X0) / DC)); c1 = min(NC, int((px + R - X0) / DC) + 2)
    r0 = max(0, int((ZTOP - (pz + R)) / DC)); r1 = min(NC, int((ZTOP - (pz - R)) / DC) + 2)
    gz_, gx_ = np.meshgrid(cz_[r0:r1], cx_[c0:c1], indexing='ij')
    d = np.hypot(gx_ - px, gz_ - pz) + (fbm(gx_ / 60 + 21, gz_ / 60 + 21, 3) - .5) * 2 * 16
    t = np.maximum(d - pr, 0)
    target[r0:r1, c0:c1] = smin(target[r0:r1, c0:c1], -11 + .30 * t + .0048 * t * t, 22.0)
log('confluence pools')
T4 = upsample(target, 4); U4 = upsample(uplift, 4)
for r0 in range(0, NW, CH):
    r1 = min(NW, r0 + CH)
    h = W[r0:r1] + U4[r0:r1]               # the canyon's plateau: the mountains raised, not a smooth dome
    W[r0:r1] = smin(h, T4[r0:r1], 9.0)
del T4, U4
log('rivers carved')
# CONFLUENCE (2026-10-22): the ridges between the paths descend to the confluence (as spurs do where rivers
# meet) instead of standing as one tall peak over it, so the junction and the five mouths read from the air —
# the web's PERSPECTIVE / STRATEGIES views and the Blender 'paths' and 'persp' cameras. Heights above the water
# are scaled by TAPER0 at the junction, back to 1 by TAPER_R1 (a ragged edge, not a circle); nothing is moved.
TAPER0, TAPER_R0, TAPER_R1 = .14, 110.0, 1250.0
for r0 in range(0, NW, CH):
    r1 = min(NW, r0 + CH)
    zz, xx = np.meshgrid(zs[r0:r1], xs, indexing='ij')
    d = np.hypot(xx - JX, zz - JZ)
    near = d < TAPER_R1 + 200
    if not near.any(): continue
    d = d + (fbm(xx / 220 + 31, zz / 220 + 31, 4) - .5) * 2 * 140
    m = TAPER0 + (1 - TAPER0) * sstep(TAPER_R0, TAPER_R1, d)
    blk = W[r0:r1]
    W[r0:r1] = np.where(blk > 0, blk * m, blk)
log('confluence opened')

# ---------------------------------------------------------------------------------------------
# 4. the bay and the south coast keep the sea; then the original island goes back exactly in place
# ---------------------------------------------------------------------------------------------
for r0 in range(0, NW, CH):
    r1 = min(NW, r0 + CH)
    zz, xx = np.meshgrid(zs[r0:r1], xs, indexing='ij')
    bd = np.hypot(np.maximum(np.abs(xx) - 600, 0), np.maximum(np.abs(zz) - 600, 0))
    n1 = (fbm(xx / 520 + 2, zz / 520 + 2, 4) - .5) * 2; n2 = (fbm(xx / 800 + 7, zz / 800 + 7, 3) - .5) * 2
    land = sstep(170, 640, bd + n1 * 170)
    coastZ = 720 + 170 * np.sin(xx / 640 + 1) + n2 * 160
    land *= 1 - sstep(coastZ - 380, coastZ, zz)
    seabed = -16 - 16 * sstep(0, 900, bd)
    W[r0:r1] = W[r0:r1] * land + seabed * (1 - land)
r0h = int(round((ZTOP - 600) / DX)); c0h = int(round((-600 - X0) / DX))
hz, hx = np.meshgrid(600 - np.arange(NH) * DX, -600 + np.arange(NH) * DX, indexing='ij')
# the study faded the island to sea along a square (max |x|,|z|); seen from the air that is a square
# island. A rounded box (p=5 norm) with a ragged noise edge keeps the same island but a natural coast.
p5 = (np.abs(hx) ** 5 + np.abs(hz) ** 5) ** .2
rag = (fbm(hx / 140 + 13, hz / 140 + 13, 4) - .5) * 110
edge = 1 - sstep(420, 600, np.minimum(p5 + rag, 600 + 0 * p5))
edge *= 1 - sstep(560, 600, np.maximum(np.abs(hx), np.abs(hz)))   # still exactly sea at the box edge
W[r0h:r0h + NH, c0h:c0h + NH] = (H * 68 - 32) * edge - 16 * (1 - edge)
log('island restored at rows', r0h, 'cols', c0h, '; world range', float(W.min()), float(W.max()))

W.tofile(os.path.join(ASSETS, 'world-height-4097.bin'))
W1 = np.ascontiguousarray(W[::4, ::4]); W1.tofile(os.path.join(ASSETS, 'world-height-1025.bin'))
meta = dict(created='2026-10-22', grid=dict(n=NW, x0=X0, ztop=ZTOP, dx=DX, rows='row 0 = z ztop, z decreases'), lite=dict(n=1025, dx=DX * 4),
            heightUnits='world units, sea level 0', island=dict(box=600, rows=[r0h, r0h + NH], cols=[c0h, c0h + NH]),
            rivers={k: np.round(v[::8, :2], 1).tolist() for k, v in rivers.items()},
            confluence=dict(junction=[JX, JZ], pools=[list(p) for p in POOLS], taper=dict(at=TAPER0, r0=TAPER_R0, r1=TAPER_R1)),
            source='"Snowy Mountain V2 - Terrain" by artfromheath, CC BY 4.0 (sketchfab.com/3d-models/snowy-mountain-v2-terrain-4c70cd82edd44951b7af6c144545df34)')
json.dump(meta, open(os.path.join(ASSETS, 'world-meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
log('height fields written')

# ---------------------------------------------------------------------------------------------
# 5. the Blender scene: 1 Blender unit = 10 world units; Blender (x, y, z) = (x, −z, height) / 10
# ---------------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
def grid_mesh(name, Z, dx):
    n = Z.shape[0]
    gx = (X0 + np.arange(n) * dx) / 10; gz = (ZTOP - np.arange(n) * dx) / 10
    yy, xx = np.meshgrid(-gz, gx, indexing='ij')
    co = np.stack([xx, yy, Z / 10], -1).reshape(-1, 3).astype(np.float32)
    i = np.arange(n * n).reshape(n, n)
    quads = np.stack([i[:-1, :-1], i[:-1, 1:], i[1:, 1:], i[1:, :-1]], -1).reshape(-1, 4)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(co)); me.vertices.foreach_set('co', co.ravel())
    me.loops.add(quads.size); me.loops.foreach_set('vertex_index', quads.ravel().astype(np.int32))
    me.polygons.add(len(quads)); me.polygons.foreach_set('loop_start', np.arange(0, quads.size, 4, dtype=np.int32))
    me.update(calc_edges=True); me.validate(verbose=False)
    me.polygons.foreach_set('use_smooth', np.ones(len(quads), bool)); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob
terrain = grid_mesh('HighlandWorld_1025', W1, DX * 4)
log('blender mesh', len(terrain.data.vertices))

def node(nt, kind, loc, **props):
    n = nt.nodes.new(kind); n.location = loc
    for k, v in props.items(): setattr(n, k, v)
    return n
ALIAS = {'Fac': ('Fac', 'Factor'), 'Factor': ('Factor', 'Fac')}   # Blender 5 renamed many 'Fac' sockets
def _sock(coll, name, kind):
    names = ALIAS.get(name, (name,))
    for nm in names:
        for s in coll:
            if s.name == nm and (kind is None or s.type == kind) and getattr(s, 'enabled', True): return s
    for nm in names:
        for s in coll:
            if s.name == nm: return s
    raise KeyError(f'{name} not in {[s.name for s in coll]}')
def inp(n, name, kind=None): return _sock(n.inputs, name, kind)
def out(n, name, kind=None): return _sock(n.outputs, name, kind)
def ramp(nt, loc, stops):
    r = node(nt, 'ShaderNodeValToRGB', loc); el = r.color_ramp.elements
    while len(el) > 1: el.remove(el[-1])
    el[0].position, el[0].color = stops[0][0], (*stops[0][1], 1)
    for pos, col in stops[1:]: e = el.new(pos); e.color = (*col, 1)
    return r
def lin(c): return tuple((x / 255) ** 2.2 for x in c)

# approximate procedural version of the key visual's rock & moss (the reference look is the three.js render)
mat = bpy.data.materials.new('HighlandRockMoss'); mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear()
outn = node(nt, 'ShaderNodeOutputMaterial', (1400, 0)); bsdf = node(nt, 'ShaderNodeBsdfPrincipled', (1100, 0))
tc = node(nt, 'ShaderNodeTexCoord', (-1200, 0)); geo = node(nt, 'ShaderNodeNewGeometry', (-1200, -400))
sep = node(nt, 'ShaderNodeSeparateXYZ', (-950, -400)); nt.links.new(out(geo, 'Normal'), inp(sep, 'Vector'))
wave = node(nt, 'ShaderNodeTexWave', (-900, 250), wave_type='BANDS', bands_direction='Z')
inp(wave, 'Scale').default_value = .07; inp(wave, 'Distortion').default_value = 6; inp(wave, 'Detail').default_value = 3
nt.links.new(out(tc, 'Object'), inp(wave, 'Vector'))
rock = ramp(nt, (-600, 300), [(0, lin((63, 64, 65))), (.4, lin((70, 71, 71))), (.58, lin((76, 72, 68))), (.75, lin((66, 67, 68))), (.92, lin((80, 80, 77)))])
rockN = node(nt, 'ShaderNodeTexNoise', (-900, 520)); inp(rockN, 'Scale').default_value = .35; inp(rockN, 'Detail').default_value = 8; inp(rockN, 'Roughness').default_value = .62
nt.links.new(out(tc, 'Object'), inp(rockN, 'Vector'))
nt.links.new(out(rockN, 'Fac'), inp(rock, 'Fac'))   # (Blender's wave bands read as zebra stripes on this mesh; the beds are the three.js look's job)
mossN = node(nt, 'ShaderNodeTexNoise', (-900, -150)); inp(mossN, 'Scale').default_value = .6; inp(mossN, 'Detail').default_value = 6
nt.links.new(out(tc, 'Object'), inp(mossN, 'Vector'))
mossC = ramp(nt, (-600, -100), [(.3, lin((62, 77, 40))), (.5, lin((80, 85, 50))), (.66, lin((88, 74, 52))), (.8, lin((70, 62, 60)))])
nt.links.new(out(mossN, 'Fac'), inp(mossC, 'Fac'))
add = node(nt, 'ShaderNodeMath', (-700, -420), operation='MULTIPLY_ADD')   # noise·0.25 + normal.z: ragged moss edges
nt.links.new(out(mossN, 'Fac'), add.inputs[0]); add.inputs[1].default_value = .25; nt.links.new(out(sep, 'Z'), add.inputs[2])
slope = ramp(nt, (-450, -420), [(.78, (0, 0, 0)), (.95, (1, 1, 1))]); nt.links.new(out(add, 'Value'), inp(slope, 'Fac'))
mix = node(nt, 'ShaderNodeMix', (-150, 100), data_type='RGBA')
nt.links.new(out(slope, 'Color'), inp(mix, 'Factor', 'VALUE'))
nt.links.new(out(rock, 'Color'), inp(mix, 'A', 'RGBA')); nt.links.new(out(mossC, 'Color'), inp(mix, 'B', 'RGBA'))
nt.links.new(out(mix, 'Result', 'RGBA'), inp(bsdf, 'Base Color'))
inp(bsdf, 'Roughness').default_value = .9
# (no bump from the bands: on this 4.7-unit mesh it only paints shading stripes)
nt.links.new(out(bsdf, 'BSDF'), inp(outn, 'Surface'))
terrain.data.materials.append(mat)

water_me = bpy.data.meshes.new('Sea'); s = 2000
water_me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
water = bpy.data.objects.new('Sea', water_me); bpy.context.scene.collection.objects.link(water)
wm = bpy.data.materials.new('SilverSea'); wm.use_nodes = True; wb = wm.node_tree.nodes.get('Principled BSDF')
inp(wb, 'Base Color').default_value = (*lin((150, 165, 170)), 1); inp(wb, 'Roughness').default_value = .05; inp(wb, 'IOR').default_value = 1.33
water.data.materials.append(wm)

world = bpy.data.worlds.new('Overcast'); bpy.context.scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (*lin((200, 211, 212)), 1); bg.inputs[1].default_value = 1.2
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); sun.data.energy = 3.2; sun.data.angle = math.radians(6)
sun.rotation_euler = (math.radians(58), 0, math.radians(-120)); bpy.context.scene.collection.objects.link(sun)

SHOTS = {
    'close':  dict(pos=(470, 96, 560), target=(-55, 65, -70), fov=43),
    'paths':  dict(pos=(-380, 1320, -3780), target=(-60, 0, -1450), fov=50),
    'valley': dict(pos=(-80, 58, -720), target=(-20, 75, -1650), fov=52),
    'canyon': dict(pos=(40, 40, -2195), target=(8, 52, -2560), fov=56),
    # index1-4's PERSPECTIVE rest pose (q 8.96: pos, yaw 168°, pitch −25°, fov 54), to check the confluence as the page sees it
    'persp':  dict(pos=(-300, 1020, -3700), target=(-112, 597, -2813), fov=54),
}
def b(p): return (p[0] / 10, -p[2] / 10, p[1] / 10)
from mathutils import Vector
for name, sh in SHOTS.items():
    cam = bpy.data.objects.new('Cam_' + name, bpy.data.cameras.new('Cam_' + name)); bpy.context.scene.collection.objects.link(cam)
    cam.location = b(sh['pos']); d = Vector(b(sh['target'])) - Vector(b(sh['pos']))
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.sensor_fit = 'VERTICAL'; cam.data.angle = math.radians(sh['fov']); cam.data.clip_end = 2000
bpy.context.scene.camera = bpy.data.objects['Cam_close']
sc = bpy.context.scene; sc.render.resolution_x, sc.render.resolution_y = 1718, 820
blend_dir = os.path.join(OUT, 'blender'); os.makedirs(blend_dir, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, 'highland-world.blend'), compress=True)
log('blend saved')

# a lighter mesh for the web / other tools: 513² (every 8th sample)
glb = grid_mesh('HighlandWorld_513', np.ascontiguousarray(W[::8, ::8]), DX * 8)
glb.data.materials.append(mat)
for o in bpy.context.scene.objects: o.select_set(o == glb)
bpy.context.view_layer.objects.active = glb
bpy.ops.export_scene.gltf(filepath=os.path.join(ASSETS, 'highland-world-513.glb'), use_selection=True, export_format='GLB', export_apply=True)
json.dump({k: v for k, v in SHOTS.items()}, open(os.path.join(ASSETS, 'shots.json'), 'w'), indent=1)
log('all done')
