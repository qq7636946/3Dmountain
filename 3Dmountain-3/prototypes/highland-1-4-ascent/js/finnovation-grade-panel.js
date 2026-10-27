/* index1-4 · highland copy of js/finnovation-grade-panel.js (built by prototypes/highland-1-4/build.cjs): only its storage keys differ. */
/* =====================================================================
   畫面調整面板（色調／霧／影片）— a small live control for index1-1.
   A tool, not part of the page: it is fetched only on a local address,
   with ?grade=1, or when C is pressed. It writes CONFIG.grade (the page's
   colour grade, js/finnovation-grade.js), CONFIG.mist (the valley → cards
   bridge, the cloud deck, the planet's cloud), CONFIG.video (the last
   part's background film), CONFIG.portfolio.base (mist and card ground,
   edited in place) and CONFIG.watershedStyle.haze — every layer reads them
   each frame — and the mountains (山景: CONFIG.watershedStyle, shoreline,
   relief, watershedTerrain; the shape ones rebuild on reload, main.js reads
   them before the scene is built). Only values that differ from the page's
   defaults are remembered in this browser (so a new default is never covered
   by an old saved one); "複製參數" hands them over to become the defaults.
   ===================================================================== */
import { GRADE_PRESETS } from '../../../js/finnovation-grade.js?v=eb26a41a84';

const KEY = 'finnovation-look-v2:highland-1-4-ascent', V1_KEY = 'finnovation-look-v1:highland-1-4-ascent', OLD_KEY = 'finnovation-grade-v1:highland-1-4-ascent';
/* Defaults that have changed since v1 stored every value: a v1 value equal to one of these was never chosen,
   it was the default of its day, so it is not carried over. */
const V1_DEFAULTS = { mist: { push: .34, fog: 14, start: .16, end: .78, cards: .3, depth: 6 }, video: { colour: .22 } };
/* A field that lives anywhere in CONFIG, by its path ('relief.lift'). */
const at = (c, path) => path.split('.').reduce((o, k) => o?.[k], c);
const put = (c, path, v) => { const keys = path.split('.'), last = keys.pop(), o = keys.reduce((o, k) => o?.[k], c); if (o) o[last] = v; };
const P = (path, label, opts = {}) => ({ key: path, label: opts.rebuild ? label + ' ↻' : label, hint: opts.rebuild ? '重新整理後生效（按下方「套用山形」）' : '', ...opts, get: c => at(c, path), set: (c, v) => put(c, path, v) });
const STYLE = `
.fi-grade{position:fixed;right:24px;bottom:86px;z-index:40;width:300px;max-height:calc(100dvh - 150px);overflow:auto;padding:14px 16px 16px;color:#eef4f9;
  font:500 11px/1.4 "Jost","Noto Sans TC",sans-serif;letter-spacing:.06em;background:#0d1b26e0;overscroll-behavior:contain;
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid #ffffff24;box-shadow:0 18px 50px #0006}
.fi-grade[hidden],.fi-grade [hidden]{display:none!important}
.fi-grade-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-weight:600;letter-spacing:.16em}
.fi-grade-head small{color:#9fb3c5;font-weight:400;letter-spacing:.08em}
.fi-grade button{font:inherit;color:inherit;background:#ffffff14;border:1px solid #ffffff26;padding:6px 10px;cursor:pointer}
.fi-grade button:hover{background:#ffffff26}
.fi-grade button[aria-pressed="true"],.fi-grade [role=tab][aria-selected="true"]{background:#eef4f9;color:#0d1b26}
.fi-grade-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:12px}
.fi-grade [data-rebuild]{width:100%;margin-top:10px}
.fi-grade-presets{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}
.fi-grade label{display:grid;grid-template-columns:58px 1fr 48px;align-items:center;gap:8px;margin:6px 0}
.fi-grade label span:first-child{color:#c9d6e2}
.fi-grade input[type=range]{width:100%;accent-color:#9ec5e6}
.fi-grade input[type=color]{width:100%;height:24px;padding:0;border:1px solid #ffffff40;background:none;cursor:pointer}
.fi-grade output{text-align:right;font-variant-numeric:tabular-nums;color:#fff;font-size:10px}
.fi-grade-scale{display:flex;justify-content:space-between;margin:-5px 56px 3px 66px;color:#8ea4b8;font-size:9px}
.fi-grade-sub{margin:12px 0 2px;color:#8ea4b8;font-size:9px;letter-spacing:.18em}
.fi-grade-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}
.fi-grade-note{margin-top:8px;color:#8ea4b8;font-size:10px;letter-spacing:.04em}
@media (max-width:680px){.fi-grade{right:10px;left:10px;width:auto;bottom:70px}}
`;

const hex = rgb => '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const unhex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const round = (v, step) => { const d = String(step).includes('.') ? String(step).split('.')[1].length : 0; return (+v).toFixed(d); };

/* One entry per tab: where its values live in CONFIG, its presets and its sliders. */
function groups(config, defaults) {
  const M = defaults.mist, V = defaults.video;
  return [
    {
      id: 'grade', title: '色調', of: c => c.grade, note: '整頁一起變：3D 場景、卡牌霧面、地球段。HTML 文字不變。',
      presets: GRADE_PRESETS,
      fields: [
        { key: 'hue', label: '色相', min: -30, max: 30, step: 1, unit: '°', scale: ['偏紫', '偏青'], invert: true },
        { key: 'sat', label: '彩度', min: .5, max: 1.6, step: .01, scale: ['灰', '濃'] },
        { key: 'temp', label: '冷暖', min: -1, max: 1, step: .01, scale: ['冷', '暖'] },
        { key: 'tint', label: '紫綠', min: -1, max: 1, step: .01, scale: ['紫', '綠'] }
      ]
    },
    {
      id: 'mist', title: '霧', of: c => c.mist, note: '山谷→卡牌的過場是一個連續動作：鏡頭飛進山谷、霧一路變濃成卡牌底色、卡牌從霧裡迎面飛來。',
      presets: {
        淡霧: { ...M, push: .26, fog: 7, start: .24, end: .86, texture: .3, center: .25 },
        預設: { ...M },
        濃霧: { ...M, push: .42, fog: 26, start: .08, end: .68, texture: .65, center: .55 }
      },
      fields: [
        { sub: '山谷 → 卡牌' },
        { key: 'base', label: '霧色', type: 'color', get: c => hex(c.portfolio.base), set: (c, v) => { const rgb = unhex(v); for (let i = 0; i < 3; i++) c.portfolio.base[i] = rgb[i]; }, reset: (c, d) => { for (let i = 0; i < 3; i++) c.portfolio.base[i] = d.portfolio.base[i]; }, hint: '也是卡牌底色' },
        { key: 'push', label: '鏡頭推進', min: 0, max: .7, step: .01 },
        { key: 'fog', label: '山谷霧', min: 0, max: 40, step: .5, scale: ['淡', '濃'] },
        { key: 'start', label: '開始起霧', min: 0, max: .7, step: .01, scale: ['早', '晚'] },
        { key: 'end', label: '霧到全白', min: .3, max: 1, step: .01, scale: ['早', '晚'] },
        { key: 'texture', label: '霧的起伏', min: 0, max: 1, step: .01, scale: ['均勻', '翻湧'] },
        { key: 'center', label: '中央先霧', min: 0, max: 1, step: .01 },
        { key: 'cards', label: '卡牌出現', min: 0, max: .8, step: .01, scale: ['早', '晚'] },
        { key: 'depth', label: '卡牌距離', min: 0, max: 14, step: .1, scale: ['近', '遠'] },
        { key: 'steps', label: '過場格數', min: 4, max: 16, step: 1, scale: ['短', '長'], hint: '從最後一章到卡牌到位要滾幾格滾輪（任何螢幕大小都一樣）' },
        { key: 'follow', label: '跟隨柔順', min: 2, max: 12, step: .5, scale: ['滑順', '跟手'], hint: '每格滾輪之間是一路滑過去（小）還是一格一頓（大）' },
        { key: 'veil', label: '山谷退場', min: .4, max: 1, step: .01, scale: ['早', '晚'], hint: '山谷完全退進霧裡的時間點；晚一點，卡牌浮出時山谷還看得見' },
        { key: 'descent', label: '山谷連續', min: 0, max: 1, step: .05, scale: ['分段停', '一路往下'], hint: '山谷三段鏡頭（第一人稱→升空→進匯流）要不要一路接著走' },
        { key: 'haze', label: '遠景霧感', min: .3, max: 1.8, step: .05, get: c => c.watershedStyle.haze, set: (c, v) => { c.watershedStyle.haze = v; }, hint: '山谷章節本身的霧' },
        { sub: '卡牌之後' },
        { key: 'deck', label: '雲層濃度', min: 0, max: 1.5, step: .01 },
        { key: 'soft', label: '雲層柔和', min: 0, max: 1, step: .01 },
        { key: 'planet', label: '地球雲量', min: 0, max: 1, step: .01 }
      ]
    },
    {
      id: 'video', title: '影片', of: c => c.video, note: '尾聲最後一段（RESPONSIBILITY）的背景影片 media/ocean-loop-*.mp4。影片原色 1＝影片本身的顏色（不壓暗、不加暗角、不吃整頁色調）。',
      presets: {
        沉穩: { ...V, brightness: .85, colour: .12 },
        預設: { ...V },
        明亮: { ...V, brightness: 1.3, colour: .5 }
      },
      fields: [
        { key: 'brightness', label: '亮度', min: .3, max: 2, step: .01, scale: ['暗', '亮'] },
        { key: 'colour', label: '影片原色', min: 0, max: 1, step: .01, scale: ['深藍綠', '原色'] },
        { key: 'speed', label: '播放速度', min: .25, max: 2, step: .05, scale: ['慢', '快'] }
      ]
    },
    {
      id: 'landscape', title: '山景', of: c => c, presets: {},
      note: '山谷章節的山。顏色、霜雪、層次拖了就變；標 ↻ 的是山的形狀，要按「套用山形」讓頁面重新整理後重建。和調參大面板（T）的「山體建模」「山景色調」「河岸細節」是同一批數值。',
      fields: [
        { sub: '山的顏色與光' },
        P('watershedStyle.rockColor', '山石色彩', { type: 'color' }),
        P('watershedStyle.skyColor', '天空色彩', { type: 'color' }),
        P('watershedStyle.mistColor', '遠霧色彩', { type: 'color' }),
        P('watershedStyle.exposure', '明亮度', { min: .5, max: 1.6, step: .01, scale: ['暗', '亮'] }),
        P('watershedStyle.relief', '山壁層次', { min: 0, max: 2, step: .01 }),
        P('shoreline.crease', '岩縫陰影', { min: 0, max: 3, step: .05 }),
        P('shoreline.frost', '高處霜色', { min: 0, max: 2, step: .05 }),
        P('relief.ridgeFrost', '稜線霜白', { min: 0, max: 2.5, step: .05 }),
        P('relief.snow', '雪溝積雪', { min: 0, max: 2, step: .05 }),
        P('relief.rockBands', '岩帶', { min: 0, max: 2, step: .05 }),
        P('relief.layers', '遠山層次', { min: 0, max: 2, step: .05 }),
        P('relief.horizon', '地平線霧', { min: 0, max: 1.5, step: .05 }),
        P('shoreline.micro', '岩面紋理', { min: 0, max: 2.5, step: .05 }),
        P('shoreline.strata', '岩層層理', { min: 0, max: 2.5, step: .05 }),
        { sub: '河流光束' },
        P('watershedFlow.launch', '光束出場', { min: 0, max: 1, step: .05, scale: ['一起淡入', '沿河奔出'], hint: '山谷打開時，光是整片淡入，還是從源頭一路沿河奔向匯流處（重新整理後切換最準）' }),
        P('watershedFlow.launchGlow', '出場光頭', { min: 0, max: 4, step: .05, hint: '奔出時最前段的亮度' }),
        P('watershedFlow.surge', '捲動加速', { min: 0, max: 3, step: .05, scale: ['不變', '更快更亮'], hint: '捲動時光流加速、變亮、拖尾拉長的程度' }),
        P('watershedFlow.speed', '流動速度', { min: 0, max: 2.5, step: .05 }),
        P('watershedFlow.headBright', '光束頭亮度', { min: 0, max: 5, step: .05 }),
        { sub: '山的形狀（↻ 重新整理後生效）' },
        P('watershedTerrain.height', '山高', { min: .5, max: 1.8, step: .01, rebuild: true, scale: ['低', '高'] }),
        P('watershedTerrain.ridge', '山脊起伏', { min: 0, max: 2, step: .01, rebuild: true }),
        P('watershedTerrain.relief', '岩壁細節', { min: 0, max: 2, step: .01, rebuild: true }),
        P('relief.lift', '山體抬高', { min: .5, max: 3.5, step: .05, rebuild: true }),
        P('relief.density', '山的數量', { min: 0, max: 3, step: .05, rebuild: true, scale: ['少', '多'] }),
        P('relief.peakRound', '山頂圓潤', { min: 0, max: 1.5, step: .05, rebuild: true, scale: ['尖', '圓'] }),
        P('relief.crestSoft', '稜線柔化', { min: 0, max: .25, step: .01, rebuild: true }),
        P('relief.crestTame', '山頂不尖', { min: 0, max: 1, step: .05, rebuild: true }),
        P('relief.valleyReach', '谷坡寬度', { min: .4, max: 1.8, step: .02, rebuild: true, scale: ['陡', '緩'] }),
        P('relief.slopeCap', '坡度上限', { min: 0, max: 3, step: .05, rebuild: true }),
        P('relief.ridge', '山脊銳利', { min: 0, max: 2, step: .05, rebuild: true }),
        P('relief.erosion', '沖蝕溝紋', { min: 0, max: 2, step: .05, rebuild: true })
      ]
    }
  ];
}

export function mountGradePanel({ config, defaults }) {
  const tabs = groups(config, defaults);
  const read = (g, f) => f.get ? f.get(config) : g.of(config)[f.key];
  const write = (g, f, v) => { if (f.set) f.set(config, v); else g.of(config)[f.key] = v; };
  // Remembered values (and the colour grade of the first version of this panel).
  const fallback = (g, f) => f.get ? f.get(defaults) : g.of(defaults)[f.key];
  const differs = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) > 1e-9 : String(a).toLowerCase() !== String(b).toLowerCase();
  const save = () => {
    const out = {};
    for (const g of tabs) { const o = {}; for (const f of g.fields) if (f.key) { const v = read(g, f); if (differs(v, fallback(g, f))) o[f.key] = v; } if (Object.keys(o).length) out[g.id] = o; }
    try { localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* storage unavailable */ }
  };
  try {
    let saved = JSON.parse(localStorage.getItem(KEY) || 'null'), carried = false;
    if (!saved) { saved = JSON.parse(localStorage.getItem(V1_KEY) || 'null') || { grade: JSON.parse(localStorage.getItem(OLD_KEY) || 'null') }; carried = true; }
    for (const g of tabs) for (const f of g.fields) {
      if (!f.key) continue;
      const v = saved?.[g.id]?.[f.key];
      if (carried && Number.isFinite(v) && Number.isFinite(V1_DEFAULTS[g.id]?.[f.key]) && Math.abs(v - V1_DEFAULTS[g.id][f.key]) < 1e-9) continue;
      if (f.type === 'color' ? /^#[0-9a-f]{6}$/i.test(v) : Number.isFinite(v)) write(g, f, v);
    }
    if (carried) save();
  } catch { /* storage unavailable */ }

  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const root = document.createElement('aside'); root.className = 'fi-grade'; root.setAttribute('aria-label', '畫面調整'); root.dataset.worldUi = '';
  const field = (g, f) => f.sub ? `<p class="fi-grade-sub">${f.sub}</p>`
    : (f.type === 'color'
      ? `<label title="${f.hint || ''}"><span>${f.label}</span><input type="color" data-tab="${g.id}" data-key="${f.key}"><output data-out="${g.id}.${f.key}"></output></label>`
      : `<label title="${f.hint || ''}"><span>${f.label}</span><input type="range" data-tab="${g.id}" data-key="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}"><output data-out="${g.id}.${f.key}"></output></label>`
        + (f.scale ? `<div class="fi-grade-scale"><span>${f.scale[0]}</span><span>${f.scale[1]}</span></div>` : ''));
  root.innerHTML = `<div class="fi-grade-head"><span>畫面調整 <small>C 開關</small></span><button type="button" data-close aria-label="關閉面板">×</button></div>
    <div class="fi-grade-tabs" role="tablist">${tabs.map((g, i) => `<button type="button" role="tab" data-show="${g.id}" aria-selected="${i === 0}">${g.title}</button>`).join('')}</div>
    ${tabs.map((g, i) => `<section data-panel="${g.id}"${i ? ' hidden' : ''}>
      <div class="fi-grade-presets">${Object.keys(g.presets).map(n => `<button type="button" data-preset="${n}">${n}</button>`).join('')}</div>
      ${g.fields.map(f => field(g, f)).join('')}
      ${g.id === 'landscape' ? '<button type="button" data-rebuild>套用山形（重新整理）</button>' : ''}
      <p class="fi-grade-note">${g.note}</p></section>`).join('')}
    <div class="fi-grade-actions"><button type="button" data-copy>複製參數</button><button type="button" data-reset>重設本頁</button></div>`;
  document.body.append(root);
  let active = tabs[0].id;
  const tabOf = id => tabs.find(g => g.id === id);
  const fieldOf = (g, key) => g.fields.find(f => f.key === key);
  // The hue slider runs left = more violet, right = more cyan (it is the negative of the CSS hue angle).
  const shown = (f, v) => f.invert ? -v : v;

  function paint() {
    for (const input of root.querySelectorAll('input[data-key]')) {
      const g = tabOf(input.dataset.tab), f = fieldOf(g, input.dataset.key), v = read(g, f);
      if (document.activeElement !== input) input.value = String(f.type === 'color' ? v : shown(f, v));
      root.querySelector(`[data-out="${g.id}.${f.key}"]`).textContent = f.type === 'color' ? String(v).toUpperCase() : round(shown(f, v), f.step) + (f.unit || '');
    }
    for (const g of tabs) for (const b of root.querySelectorAll(`[data-panel="${g.id}"] [data-preset]`)) {
      const p = g.presets[b.dataset.preset];
      b.setAttribute('aria-pressed', String(Object.keys(p).every(k => !fieldOf(g, k) || Math.abs(p[k] - g.of(config)[k]) < 1e-6)));
    }
  }
  root.addEventListener('input', event => {
    const input = event.target.closest('input[data-key]'); if (!input) return;
    const g = tabOf(input.dataset.tab), f = fieldOf(g, input.dataset.key);
    write(g, f, f.type === 'color' ? input.value : shown(f, +input.value)); save(); paint();
  });
  root.addEventListener('click', event => {
    const tab = event.target.closest('[data-show]');
    if (tab) {
      active = tab.dataset.show;
      for (const b of root.querySelectorAll('[data-show]')) b.setAttribute('aria-selected', String(b === tab));
      for (const p of root.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== active;
      return;
    }
    const preset = event.target.closest('[data-preset]');
    if (preset) { const g = tabOf(preset.closest('[data-panel]').dataset.panel); Object.assign(g.of(config), g.presets[preset.dataset.preset]); save(); paint(); return; }
    if (event.target.closest('[data-reset]')) {
      const g = tabOf(active);
      for (const f of g.fields) if (f.key) { if (f.reset) f.reset(config, defaults); else write(g, f, f.get ? f.get(defaults) : g.of(defaults)[f.key]); }
      save(); paint(); return;
    }
    if (event.target.closest('[data-close]')) { root.hidden = true; return; }
    if (event.target.closest('[data-rebuild]')) { save(); location.reload(); return; }
    const copy = event.target.closest('[data-copy]');
    if (copy) {
      const line = g => `${g.id}: { ${g.fields.filter(f => f.key && !f.get).map(f => `${f.key}: ${round(g.of(config)[f.key], f.step)}`).join(', ')} },`;
      // the mountains are listed one path a line (they belong to several groups of CONFIG)
      const lines = tabs.flatMap(g => g.id === 'landscape' ? g.fields.filter(f => f.key).map(f => `${f.key}: ${f.type === 'color' ? "'" + read(g, f) + "'" : round(read(g, f), f.step)},`) : [line(g)]);
      const text = [...lines, `portfolio.base: [${config.portfolio.base.map(v => (+v).toFixed(3)).join(', ')}],`, `watershedStyle.haze: ${config.watershedStyle.haze}`].join('\n');
      const done = () => { copy.textContent = '已複製'; setTimeout(() => { copy.textContent = '複製參數'; }, 1400); };
      (navigator.clipboard?.writeText(text) ?? Promise.reject()).then(done, () => { window.prompt('畫面參數', text); });
    }
  });
  // The page's own wheel/keys must not move while the sliders are used.
  root.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { root.hidden = true; return; }
    if (event.key !== 'c' && event.key !== 'C') event.stopPropagation();   // C still toggles the panel from inside it
  });
  paint();
  return { el: root, toggle() { root.hidden = !root.hidden; }, show() { root.hidden = false; }, dispose() { root.remove(); style.remove(); } };
}
