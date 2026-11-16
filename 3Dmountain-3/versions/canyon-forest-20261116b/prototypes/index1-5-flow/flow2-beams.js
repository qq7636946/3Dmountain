/* Flow2 · four beams, four marks (2026-11-14). index1-5-flow2-mark.html only (the trial page).
   Client: 「指示標 四條光束一個一條 代表四個項目」 — the river's light beams become FOUR, and each carries ONE mark: the four
   investment fields of the site (01 AI 量化交易 · 02 上市櫃投資 · 03 未上市與 PRE-IPO · 04 衍生性商品).

   Before (index1-5-flow2.html): five beams on the river, and three marks (01 INSIGHT / 02 STRATEGY / 03 VALUE) all standing on
   the first beam, with a dashed course line drawn along it.
   Here: the middle beam (the one that runs through the mark's foot) is not drawn, so two beams pass on each side of the mark;
   mark 01 stands on the outer left beam, 02 on the inner left, 03 on the inner right, 04 on the outer right; the dashed course
   line is not drawn (every beam is a course now), and neither are the dashed lines that joined one mark to the next.

   How: the trial page's markup has four mark elements with the four names, and its atlas script no longer places marks
   (.qa/index1-5/flow2-mark/make-page.py makes those edits when it builds the page). This file places the four marks every frame
   by the same rules the atlas used (a point a set distance ahead along a beam, moved further ahead when its place is taken or
   off the picture), one beam each; the lock-on labels module draws them as before (it only reads the marks' attributes).
   ?beams=0 = the five beams (and no marks). Live: window.__FLOW2_BEAMS__.tune / .state, and the 「指示標 參數」 tab. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('beams') === '0') return;
  const T = {
    lanes: [0, 1, 3, 4],          // which of the river's five beams carry marks 01…04 (the others are not drawn)
    ahead: [10, 15, 15, 16],      // metres ahead of the lens for marks 01…04
    course: 0,                    // 1 = also draw the atlas's dashed course line along the first beam
    links: 0                      // 1 = also draw the dashed lines that join one mark to the next (client 2026-11-14: 橫虛線拿掉)
  };
  const S = { stage: 'waiting' };
  window.__FLOW2_BEAMS__ = { tune: T, state: S };
  window.__FLOW2_PANEL__?.add({ id: 'beams', title: '指示標', key: 'b', tune: T, onChange: () => { last = null; }, rows: [
    ['— 指示標離鏡頭多遠（公尺）—'],
    ['01（左外側光束）', 'ahead.0', 4, 120, 1], ['02（左內側光束）', 'ahead.1', 4, 160, 1], ['03（右內側光束）', 'ahead.2', 4, 160, 1], ['04（右外側光束）', 'ahead.3', 4, 120, 1],
    ['— 其他 —'],
    ['指示標之間的橫虛線', 'links', 0, 1, 1], ['沿第一條光束的虛線', 'course', 0, 1, 1]
  ] });

  const html = document.documentElement;
  const roomAhead = [1, 1.25, 1.55, 1.9];
  let study = null, atlas = null, course = null, pins = [], ribbons = null, last = null, style = null, point = null;

  function connect() {
    study = window.__MONTIS_STUDY__;
    if (!study?.mainRenderPass || !study.journeyClock || !study.camera) return false;
    atlas = document.querySelector('#flow2-canyon-atlas'); course = atlas?.querySelector('.flow2-atlas-course');
    pins = course ? [...course.querySelectorAll('.flow2-atlas-marker')] : [];
    if (pins.length !== 4) { S.stage = 'off: this page has ' + pins.length + ' marks, not four'; return true; }
    point = study.camera.position.clone();
    for (const pin of pins) {   // the plain drawing of a mark (seen when the lock-on labels are off)
      pin.querySelector('.flow2-atlas-leader')?.setAttribute('d', 'M0 0V-41H25'); pin.querySelector('.flow2-atlas-caption')?.setAttribute('y', '-48');
    }
    style = document.createElement('style'); document.head.appendChild(style);
    const pass = study.mainRenderPass, render = pass.render;
    pass.render = function (...args) { const out = render.apply(this, args); try { paint(this.camera); } catch (error) { S.stage = 'failed: ' + (error?.message || error); } return out; };
    S.stage = 'on';
    return true;
  }

  function beams(canyon) {
    const group = canyon.followLights?.group; if (!group || group.children.length < 5) return null;
    if (!ribbons || ribbons.group !== group) {
      ribbons = { group, list: group.children.map(mesh => { const positions = mesh.geometry.getAttribute('position'), flow = mesh.geometry.getAttribute('aFlow'), rows = positions.count / 2 - 1; const length = flow.getY(positions.count - 1); return { mesh, positions, rows, length, step: length / rows }; }) };
    }
    return ribbons;
  }

  function project(ribbon, distance, camera) {
    const row = Math.max(0, Math.min(ribbon.rows, distance / ribbon.step)), index = Math.min(ribbon.rows - 1, Math.floor(row)), t = row - index, a = 2 * index, b = a + 2, P = ribbon.positions;
    const x = P.getX(a), y = P.getY(a), z = P.getZ(a);
    return point.set(x + (P.getX(b) - x) * t, y + (P.getY(b) - y) * t, z + (P.getZ(b) - z) * t).project(camera);
  }

  function hide() { for (const pin of pins) if (pin.getAttribute('visibility') !== 'hidden') pin.setAttribute('visibility', 'hidden'); last = null; }

  function paint(camera) {
    const canyon = study.canyon; if (!canyon) return;
    const R = beams(canyon); if (!R) return;
    /* four beams: the others are not drawn (on a narrow screen the page's own arrangement is kept) */
    const small = innerWidth <= 680;
    R.list.forEach((ribbon, i) => { const on = small || T.lanes.includes(i); if (ribbon.mesh.visible !== on) ribbon.mesh.visible = on; });
    const css = (T.course >= .5 ? '' : '#flow2-canyon-atlas .flow2-atlas-halo, #flow2-canyon-atlas .flow2-atlas-line { display: none !important; }')
      + (T.links >= .5 ? '' : ' .f2u-lock[data-kind="canyon"] .f2u-lk-links { display: none !important; }');
    if (style.textContent !== css) style.textContent = css;
    /* the atlas script decides whether the river's marks are shown at all (the canyon, not from the air, not under a menu) */
    if (!atlas || atlas.hidden || atlas.hasAttribute('data-aerial') || !course.hasAttribute('data-visible') || camera !== canyon.camera) { hide(); return; }

    const progress = study.journey.progress, w = innerWidth, h = innerHeight;
    const key = progress + '|' + w + '|' + h + '|' + camera.fov + '|' + camera.position.x.toFixed(3) + '|' + camera.position.y.toFixed(3) + '|' + camera.position.z.toFixed(3) + '|' + camera.quaternion.y.toFixed(4) + '|' + T.ahead.join(',');
    if (key === last) return; last = key;

    const clock = study.journeyClock(progress);
    let travel = Math.max(0, Math.min(1, (clock - 1.404) / (8 - 1.404)));
    if (travel > .90) { const u = (travel - .90) / .10; travel = .90 + .10 * (u + u * u - u * u * u); }
    const arc = travel * canyon.stats.pathLength * canyon.stats.routeEnd;
    const reach = Math.max(1, Math.min(3.1, (camera.position.y - 1) / 2.5));
    const placed = [];
    pins.forEach((pin, i) => {
      const ribbon = R.list[T.lanes[i]] || R.list[0], width = (small ? 7 : 9) * 11;
      for (const more of roomAhead) {
        const p = project(ribbon, Math.min(ribbon.length, arc + T.ahead[i] * reach * more), camera);
        const x = (p.x + 1) * w * .5, y = (1 - p.y) * h * .5;
        if (!(p.z > -1 && p.z < 1 && x > 14 && x < w - 14 && y > h * .28 && y < h * .72)) continue;
        const left = x + width > w - 14, x0 = left ? x - width : x, x1 = left ? x : x + width, top = y - 55;
        if (placed.some(box => x0 < box.x1 + 8 && x1 + 8 > box.x0 && Math.abs(top - box.top) < 18)) continue;
        placed.push({ x0, x1, top });
        pin.toggleAttribute('data-left', left);
        pin.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
        if (pin.getAttribute('visibility') !== 'visible') pin.setAttribute('visibility', 'visible');
        return;
      }
      if (pin.getAttribute('visibility') !== 'hidden') pin.setAttribute('visibility', 'hidden');
    });
    S.shown = pins.filter(pin => pin.getAttribute('visibility') === 'visible').length;
  }

  /* wait for the page's engine (it is built after this script runs) */
  let connected = false;
  const attempt = () => { if (connected) return true; if (html.dataset.renderMode === 'text') return (connected = true); if (connect()) connected = true; return connected; };
  const poll = () => { if (!attempt()) requestAnimationFrame(poll); };
  poll();
})();
