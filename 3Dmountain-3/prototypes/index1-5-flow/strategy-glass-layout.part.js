/* Composed callouts, with fine leaders ending on the real tributaries. */
let glassLayoutKey = '', glassLayoutAt = -Infinity;
function layoutGlassStrategies(S, project, now, obstacles) {
  const W = S.canyon.watershed, cam = S.canyon.camera, width = innerWidth, height = innerHeight;
  const tags = pins.filter(pin => pin.kind === 'tag'), phone = width <= 760;
  const key = [width, height, chapterId, ...cam.position.toArray().map(v => v.toFixed(1)),
    ...cam.quaternion.toArray().map(v => v.toFixed(4)), ...tags.map(p => p.w + ':' + p.h)].join('|');
  if (key === glassLayoutKey) { for (const pin of tags) show(pin, pin.glassVisible === true); return; }
  if (now - glassLayoutAt < 80) return;
  glassLayoutKey = key; glassLayoutAt = now;
  const placed = [], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const slots = phone ? [[.25,.345],[.75,.345],[.25,.50],[.75,.50]]
    : [[.235,.63],[.365,.38],[.675,.66],[.80,.36]];
  const clear = box => obstacles.every(o => !overlaps(box, o)) && placed.every(o => !overlaps(box, o));
  for (const pin of pins) {
    if (pin.kind !== 'tag') { show(pin, false); continue; }
    const slot = slots[PATHS.indexOf(pin.id)], pad = phone ? 14 : 28, w = pin.w, h = pin.h;
    const left = clamp(slot[0] * width - w / 2, pad, width - w - pad);
    const top = clamp(slot[1] * height - h / 2, phone ? 208 : 150, height - h - 135);
    let box = null, bestCost = Infinity;
    for (const dy of [0, -40, 40, -80, 80, -120, 120]) {
      for (const dx of [0, ...(phone ? [] : [-40, 40, -80, 80])]) {
        const x = clamp(left + dx, pad, width - w - pad), y = clamp(top + dy, phone ? 205 : 145, height - h - 100);
        const candidate = { l:x-6, r:x+w+6, t:y-6, b:y+h+6 }, cost = dx*dx + dy*dy;
        if (cost < bestCost && clear(candidate)) { box = { ...candidate, x, y }; bestCost = cost; }
      }
    }
    if (!box) { pin.glassVisible=false; show(pin, false); continue; }
    // Rank in screen space before the more expensive terrain visibility test.
    const samples = [];
    for (const t of [.46,.52,.58,.64,.70,.76,.82,.88,.94]) {
      const q = pin.curve.getPointAt(t), point = project(q.x, 0, q.z);
      if (!point || point[0] < 8 || point[0] > width-8 || point[1] < 140 || point[1] > height-70) continue;
      const dx = point[0] - clamp(point[0],box.x+12,box.x+w-12);
      const dy = point[1] - (point[1] < box.y+h/2 ? box.y : box.y+h);
      samples.push({ q, point, cost:dx*dx+dy*dy });
    }
    samples.sort((a,b) => a.cost-b.cost);
    const anchor = samples.slice(0,3).find(({q}) => !occluded(W,cam.position,q.x,4,q.z)) || samples[0];
    if (!anchor && !phone) { pin.glassVisible=false; show(pin, false); continue; }
    if (!pin.glassLeader) {
      const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns,'svg');
      svg.classList.add('alp-glass-leader'); svg.setAttribute('aria-hidden','true');
      const path = document.createElementNS(ns,'path'), dot = document.createElementNS(ns,'circle');
      dot.setAttribute('r','2.5'); svg.append(path,dot); pin.node.append(svg);
      pin.glassLeader = { svg, path, dot };
    }
    // In portrait a tributary may leave the crop; keep its card readable
    // and omit that leader instead of inventing a visible ground location.
    const ax = anchor ? anchor.point[0]-box.x : w/2, ay = anchor ? anchor.point[1]-box.y : h;
    const sx = clamp(ax,20,w-20), sy = ay < h/2 ? 0 : h, bend = sy+(ay-sy)*.55;
    const line = pin.glassLeader, length = Math.hypot(ax-sx,ay-sy);
    line.svg.style.opacity = !anchor || length < 14 || (ax>0&&ax<w&&ay>0&&ay<h) ? '0' : '1';
    line.path.setAttribute('d',`M${sx.toFixed(1)} ${sy} C${sx.toFixed(1)} ${bend.toFixed(1)},${ax.toFixed(1)} ${bend.toFixed(1)},${ax.toFixed(1)} ${ay.toFixed(1)}`);
    line.dot.setAttribute('cx',ax.toFixed(1)); line.dot.setAttribute('cy',ay.toFixed(1));
    pin.node.dataset.layout = 'glass'; pin.node.dataset.side = 'up';
    pin.node.style.transform = `translate3d(${box.x.toFixed(1)}px,${box.y.toFixed(1)}px,0)`;
    placed.push(box); pin.glassVisible=true; show(pin,true);
  }
}
