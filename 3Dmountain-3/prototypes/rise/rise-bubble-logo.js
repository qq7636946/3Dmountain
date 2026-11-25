import { createBubbleLogo, WORD_PATHS } from '../bubble-hero/bubble-logo.js?v=rise-water-7';

/* 2026-11-20: the client's tuned values are the defaults (their pasted JSON); the panel has a shape switch (圖形 LOGO / 英文字 FINNOVATION)
   and more dials. The word version also opens by itself: index1-5-canyon-forest-rise-word.html, or ?riseMark=word; it keeps its own saved values. */
const BRIGHTNESS_RANGE = [0.15, 9];
const Q = new URLSearchParams(location.search);
const WORD_PAGE = document.documentElement.hasAttribute('data-rise-published')
  || (Q.get('riseMark') || document.documentElement.dataset.riseMark) === 'word';

export function createRiseBubbleLogo({ gorge, station, sun, copy, redraw, sampleDrop }) {
  const { THREE, camera, ocean, scene, renderer } = gorge;
  const { clamp, lerp, smoothstep } = THREE.MathUtils;
  const quality = window.__FLOW2_QUALITY__;
  /* the two shapes. The word is long and thin: wider, smaller spheres relative to its width, a thin extrusion, a shorter reach for the cursor */
  const make = word => word
    ? createBubbleLogo(THREE, { underwater: true, width: 12.4, unit: 12.4 * 0.42, reach: 12.4 * 0.3, thickness: 0.014, clump: 0.35, bevel: 0.6,
      paths: WORD_PATHS, quality: quality?.level, light: sun, renderer })
    : createBubbleLogo(THREE, { underwater: true, width: 4.95, thickness: 0.18, quality: quality?.level, light: sun, renderer });
  /* the client's starting values (2026-11-20): one set for the brand mark, one for the word. Each shape keeps its own look:
     ticking 「切換：英文字版本」 in the panel loads that shape's set. */
  const RING = {
    brightness: 5, contrast: 2.8, glints: 2.8, opacity: 0.92, teal: 0.8,
    size: 0.89, scale: 1.38, z: -15.2, x: 0, y: 0, depth: 1.82, tiltX: 0.08, tiltY: -0.09,
    drift: 0.3, breath: 0.016, shed: 0.028, shedSpeed: 0.18, bubbleShare: 0.03,
    pearl: '#f1fbfc', aqua: '#a8e6f0', slate: '#4b8fa8',
    pointerForce: 2.5, pointerSway: 1, pointerReturn: 3.2,
    pointerRadius: 0.25, pointerPush: 0.23, pointerAccel: 1, pointerDamp: 4.3, pointerSwirl: 0.11, pointerDrag: 0.21, swayTurn: 1
  };
  const WORD = {
    brightness: 8.03, contrast: 4, glints: 1.48, opacity: 1, teal: 1,
    size: 0.44, scale: 1.86, z: -15.2, x: -0.12, y: 0.72, depth: 0.54, tiltX: 0.205, tiltY: 0,
    drift: 0, breath: 0.006, shed: 0.034, shedSpeed: 0.38, bubbleShare: 0.055,
    pearl: '#f1fbfc', aqua: '#a8e6f0', slate: '#4b8fa8',
    pointerForce: 1.12, pointerSway: 0, pointerReturn: 0.3,
    pointerRadius: 0.19, pointerPush: 0.17, pointerAccel: 1.2, pointerDamp: 0.5, pointerSwirl: 0, pointerDrag: 0, swayTurn: 0
  };
  const tune = { enabled: true, word: WORD_PAGE, ...(WORD_PAGE ? WORD : RING) };
  let mark = make(tune.word), markWord = tune.word;
  const rows = [
    ['顯示粒子 LOGO', 'enabled', 'checkbox'],
    ['切換：英文字版本', 'word', 'checkbox'],
    ['— 光感 —'],
    ['整體亮度', 'brightness', ...BRIGHTNESS_RANGE, 0.01],
    ['粒子對比', 'contrast', 0.2, 4, 0.01],
    ['冰白高光', 'glints', 0, 4, 0.01],
    ['整體透明度', 'opacity', 0, 1, 0.01, 'percent'],
    ['青藍比例', 'teal', 0, 1, 0.01, 'percent'],
    ['珍珠白（高光色）', 'pearl', 'color'],
    ['水色（亮部）', 'aqua', 'color'],
    ['深色（暗部）', 'slate', 'color'],
    ['— 大小與位置 —'],
    ['粒子大小', 'size', 0.3, 3, 0.01],
    ['LOGO 縮放', 'scale', 0.3, 2.6, 0.01],
    ['Z 軸位置（m）', 'z', -32, -6, 0.1],
    ['左右位置（m）', 'x', -6, 6, 0.01],
    ['上下位置（m）', 'y', -4, 4, 0.01],
    ['LOGO 厚度', 'depth', 0.2, 5, 0.01],
    ['靜止前後傾（rad）', 'tiltX', -0.6, 0.6, 0.005],
    ['靜止左右轉（rad）', 'tiltY', -0.8, 0.8, 0.005],
    ['— 動態 —'],
    ['粒子漂動', 'drift', 0, 3, 0.01],
    ['呼吸幅度', 'breath', 0, 0.12, 0.001],
    ['往上飄的泡泡', 'shed', 0, 0.2, 0.001],
    ['上飄速度', 'shedSpeed', 0, 1.5, 0.01],
    ['透明泡泡比例', 'bubbleShare', 0, 0.6, 0.005],
    ['— 滑鼠互動 —'],
    ['粒子推散', 'pointerForce', 0, 4, 0.01],
    ['推散範圍', 'pointerRadius', 0.03, 0.8, 0.005],
    ['最遠推散', 'pointerPush', 0, 0.8, 0.005],
    ['推力', 'pointerAccel', 0, 4, 0.01],
    ['水的阻力', 'pointerDamp', 0.5, 12, 0.1],
    ['旋渦', 'pointerSwirl', 0, 2, 0.01],
    ['跟著拖曳', 'pointerDrag', 0, 2, 0.01],
    ['粒子回流時間（秒）', 'pointerReturn', 0.3, 10, 0.1],
    ['LOGO 晃動', 'pointerSway', 0, 4, 0.01],
    ['晃動時轉角', 'swayTurn', 0, 3, 0.01]
  ];
  const defaults = { ...tune };
  const value = (key, min, max) => clamp(Number.isFinite(tune[key]) ? tune[key] : defaults[key], min, max);
  const copyRect = new THREE.Vector4(-3, -3, -2, -2);
  const copyNodes = copy?.querySelectorAll('.xs-sea-k, .xs-sea-t, .xs-sea-c') ?? [];
  const lensSlope = Math.tan(station.pitch);
  const target = new THREE.Vector3(), launch = new THREE.Vector3();
  const dropAt = [0, 0, 0];
  const pointer = { x: 0, y: 0, active: false };
  const input = new AbortController();
  window.addEventListener('pointermove', event => {
    pointer.active = event.pointerType !== 'touch' && !event.target.closest?.('[data-flow2-panel], button, a, input');
    pointer.x = (event.clientX / innerWidth) * 2 - 1;
    pointer.y = 1 - (event.clientY / innerHeight) * 2;
  }, { passive: true, signal: input.signal });
  const clearPointer = () => { pointer.active = false; };
  document.addEventListener('pointerleave', clearPointer, { signal: input.signal });
  window.addEventListener('blur', clearPointer, { signal: input.signal });
  let copyMeasuredAt = -Infinity, arrival = null;
  const view = { camera, copyRect, pointer, fogColor: new THREE.Color() };

  /* the shape switch: build the other mark in place (the old one is disposed) */
  function swapShape() {
    const word = !!tune.word;
    if (word === markWord) return;
    const visible = mark.group.visible;
    mark.dispose();
    mark = make(word); markWord = word;
    mark.group.visible = visible;
    scene.add(mark.group);
  }

  function measureCopy() {
    const now = performance.now();
    if (now - copyMeasuredAt < 160) return;
    copyMeasuredAt = now;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const element of copyNodes) {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      left = Math.min(left, box.left);
      top = Math.min(top, box.top);
      right = Math.max(right, box.right);
      bottom = Math.max(bottom, box.bottom);
    }
    if (!Number.isFinite(left)) copyRect.set(-3, -3, -2, -2);
    else copyRect.set(left / innerWidth, 1 - bottom / innerHeight, right / innerWidth, 1 - top / innerHeight);
  }

  function update(frame, light) {
    if (!!tune.word !== markWord) swapShape();
    const height = camera.position.y;
    const enabled = tune.enabled ? value('opacity', 0, 1) : 0;
    const presence = 1 - smoothstep(Math.abs(height - station.y), 1.4, 4.65);
    const opacity = enabled * presence;
    const ascent = clamp((height - station.y - 0.06) / (-0.95 - station.y), 0, 1);
    const release = smoothstep(ascent, 0, 0.12);
    // As the upper view opens, let the canyon's drop take over the same position.
    const dropOpacity = enabled * release * (1 - smoothstep(height, -0.72, -0.28));
    const exitRadius = dropOpacity > 0.002 ? sampleDrop(target) : 0;
    frame.drop.opacity = 0;
    frame.drop.worldRadius = undefined;
    frame.dropAt = undefined;

    mark.group.visible = opacity > 0.002;
    if (!mark.group.visible) {
      arrival = null;
      copyMeasuredAt = -Infinity;
      if (!exitRadius) return;
    }

    const motion = frame.live !== false;
    const time = motion ? frame.time : 0;
    if (motion && (arrival === null || time < arrival)) arrival = time;
    const gather = motion ? smoothstep(time - arrival, -0.25, 1.35) : 1;
    // Anchor in world space on the opening lens axis. Later camera travel still has parallax.
    const z = value('z', -32, -6);
    const centerY = station.y + (station.z - z) * lensSlope;
    mark.group.position.set(value('x', -6, 6), centerY + value('y', -4, 4) + Math.sin(time * 0.37) * 0.045, z);
    mark.group.scale.setScalar(value('scale', 0.3, 2.6));
    if (mark.group.visible) {
      mark.setQuality(quality?.level);
      measureCopy();
    }
    view.motion = motion;
    view.time = time;
    view.gather = gather;
    view.opacity = opacity * (0.72 + 0.28 * gather);
    view.brightness = value('brightness', ...BRIGHTNESS_RANGE);
    view.contrast = value('contrast', 0.2, 4);
    view.glints = value('glints', 0, 4);
    view.teal = value('teal', 0, 1);
    view.size = value('size', 0.3, 3);
    view.sun = light;
    view.release = exitRadius ? release : 0;
    view.pointerForce = value('pointerForce', 0, 4);
    view.pointerSway = value('pointerSway', 0, 4);
    view.pointerReturn = value('pointerReturn', 0.3, 10);
    view.pointerRadius = value('pointerRadius', 0.03, 0.8);
    view.pointerPush = value('pointerPush', 0, 0.8);
    view.pointerAccel = value('pointerAccel', 0, 4);
    view.pointerDamp = value('pointerDamp', 0.5, 12);
    view.pointerSwirl = value('pointerSwirl', 0, 2);
    view.pointerDrag = value('pointerDrag', 0, 2);
    view.swayTurn = value('swayTurn', 0, 3);
    view.depthScale = value('depth', 0.2, 5);
    view.tiltX = value('tiltX', -0.6, 0.6);
    view.tiltY = value('tiltY', -0.8, 0.8);
    view.drift = value('drift', 0, 3);
    view.breath = value('breath', 0, 0.12);
    view.shed = value('shed', 0, 0.2);
    view.shedSpeed = value('shedSpeed', 0, 1.5);
    view.bubbleShare = value('bubbleShare', 0, 0.6);
    view.pearl = /^#[0-9a-f]{6}$/i.test(tune.pearl) ? tune.pearl : defaults.pearl;
    view.aqua = /^#[0-9a-f]{6}$/i.test(tune.aqua) ? tune.aqua : defaults.aqua;
    view.slate = /^#[0-9a-f]{6}$/i.test(tune.slate) ? tune.slate : defaults.slate;
    view.fogDensity = ocean.u.uRiseFogDensity.value;
    view.fogColor.copy(ocean.tint.mid).multiplyScalar(ocean.u.uBgGain.value);
    mark.update(view);

    if (exitRadius) {
      // The branch begins at the selected particle. Its end is sampled from the canyon's own lens path.
      mark.leadPosition(launch);
      const travel = smoothstep(ascent, 0, 1);
      const lift = 1 - Math.pow(1 - ascent, 3.5);
      const bow = Math.sin(Math.PI * travel);
      const comeForward = smoothstep(ascent, 0.12, 0.49) * (1 - smoothstep(ascent, 0.77, 1));
      dropAt[0] = lerp(launch.x, target.x, travel) + 0.22 * bow;
      dropAt[1] = lerp(launch.y, target.y, lift);
      dropAt[2] = lerp(launch.z, target.z, travel ** 1.62) + 6.8 * comeForward;
      frame.dropAt = dropAt;
      frame.drop.worldRadius = lerp(0.05 * mark.group.scale.x * view.size, exitRadius, smoothstep(ascent, 0.015, 0.93));
      frame.drop.opacity = dropOpacity;
      frame.drop.glow = 0.035;
      frame.drop.halo = 0;
    }
  }

  scene.add(mark.group);
  const panelApi = window.__FLOW2_PANEL__?.add({
    id: 'rise-bubble-logo', storageId: WORD_PAGE ? 'rise-bubble-logo-word' : 'rise-bubble-logo', title: 'LOGO 粒子', tune, rows,
    onChange: key => {
      if (key === 'word') {   /* a switch by hand: load that shape's starting values (a saved switch from the last visit keeps the saved values) */
        const set = tune.word ? WORD : RING;
        Object.assign(tune, set);
        for (const k of Object.keys(set)) panelApi?.refresh?.(k);
        swapShape();
      }
      redraw?.();
    }, serialize: () => ({ ...tune })
  });
  if (!!tune.word !== markWord) swapShape();   /* a saved 英文字 switch from the last visit */
  return {
    update,
    linksDrop: () => tune.enabled && value('opacity', 0, 1) > 0.002,
    dispose() { input.abort(); mark.dispose(); }
  };
}
