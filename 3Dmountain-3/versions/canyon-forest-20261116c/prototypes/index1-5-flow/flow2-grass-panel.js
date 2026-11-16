/* Flow2 valley grass: the dials' panel (2026-11-14). index1-5-flow2.html only, loaded by flow2-grass.js when a person is looking
   (never under automation unless ?grassPanel=1; ?grassPanel=0 leaves it out).
   Client: 「草的話開個參數的bar給我調整 顏色密度分布..等的參數」.
   A small tab 「草 參數」 in the lower left corner (clear of the HUD); a click or the key G opens / closes the panel. Every control is
   live: it writes window.__FLOW2_GRASS__.tune through .set(), which keeps the value for the next load (localStorage) and scatters
   the grass again, in slices, when the value needs it. 「複製參數 JSON」 copies only what differs from the defaults; 「重設」 goes back.
   Nothing is built until the panel is first opened; styles live in a shadow root (the page's CSS and this one cannot touch each other). */
(() => {
  'use strict';
  const G = window.__FLOW2_GRASS__;
  if (!G || !G.set || document.getElementById('f2g-panel')) return;
  /* the fifth round's plants (flow2-plants.js) add their own groups when they are on (not at the low quality tier, not with ?plants=0) */
  const PL = window.__FLOW2_PLANTS__?.set ? window.__FLOW2_PLANTS__ : null;
  /* [label, key, min, max, step] or [label, key, 'color', index in the list] */
  const GROUPS = [
    ['顏色', '草葉、地面與花的顏色', [
      ['草尖', 'tip', 'color'], ['草根', 'root', 'color'], ['乾草色', 'dry', 'color'], ['乾草比例', 'dryShare', 0, 1, .01],
      ['地面色（草皮）', 'ground', 'color'], ['岩壁上的草色', 'wallColour', 'color'],
      ['花色 1', 'flowerColours', 'color', 0], ['花色 2', 'flowerColours', 'color', 1], ['花色 3', 'flowerColours', 'color', 2], ['花色 4', 'flowerColours', 'color', 3],
      ['整體亮度', 'gain', .4, 1.4, .01]
    ]],
    ['密度', '草葉有多少根', [
      ['整體密度', 'density', .2, 2.5, .05], ['近處加密', 'nearBoost', 1, 3, .05], ['遠處淡出距離（公尺）', 'far', 80, 320, 5]
    ]],
    ['分布', '草長在哪裡、成塊還是散開', [
      ['覆蓋範圍', 'coverage', .3, 1.6, .01], ['集中 ↔ 分散', 'scatter', 0, 1, .01], ['草塊大小', 'patch', .5, 2.5, .05], ['草塊之間的空隙', 'gap', 0, 1, .01],
      ['岸邊帶寬', 'band', .4, 2, .05], ['沿岩壁往上長到多高（公尺）', 'wallTop', 20, 120, 1], ['岩壁上的草量', 'wall', 0, 1.5, .01]
    ]],
    ['形狀', '單根草葉的樣子', [
      ['高度', 'height', .4, 2, .01], ['高度變化', 'heightVar', 0, 1.5, .01], ['寬度', 'width', .5, 2.5, .01], ['彎曲', 'bend', 0, 2, .01]
    ]],
    ['花', '', [['數量', 'flowers', 0, 2, .01], ['大小', 'flowerSize', .5, 2.5, .01], ['成群程度', 'flowerDrift', 0, 1, .01]]],
    ['風', '', [['強度', 'wind', 0, 2.5, .01], ['速度', 'windSpeed', .5, 8, .1]]]
  ];
  const PLANT_GROUPS = [
    ['地面・草根', '草葉底下的地', [
      ['草皮紋理', 'turfTexture', 0, 2, .01], ['草叢下的陰影', 'tussockShade', 0, 2, .01], ['乾草與裸土', 'straw', 0, 2, .01], ['近水處較濕較暗', 'damp', 0, 2, .01],
      ['石上青苔', 'moss', 0, 2, .01], ['岩壁苔痕', 'mossStreaks', 0, 2, .01], ['苔色', 'mossColour', 'color'], ['乾草色', 'strawColour', 'color']
    ]],
    ['水邊・蘆葦', '水岸線上的蘆葦、燈心草、莎草', [
      ['數量', 'reeds', 0, 2, .01], ['沿岸長多少', 'reedBeds', 0, 2, .01], ['蘆葦高度', 'reedHeight', .4, 2, .01],
      ['蘆葦色', 'reedColour', 'color'], ['蘆葦穗色', 'plumeColour', 'color'], ['燈心草色', 'rushColour', 'color'], ['莎草色', 'sedgeColour', 'color']
    ]],
    ['岩階・蕨類與灌木', '岩壁腳下與岩階上', [
      ['蕨類與闊葉植物', 'ferns', 0, 2, .01], ['蕨類大小', 'fernSize', .4, 2, .01], ['蕨色', 'fernColour', 'color'], ['闊葉色', 'leafColour', 'color'],
      ['灌木數量', 'shrubs', 0, 2, .01], ['灌木大小', 'shrubSize', .4, 2, .01], ['灌木色', 'shrubColour', 'color'], ['矮柳色', 'willowColour', 'color'],
      ['草穗', 'seeds', 0, 2, .01], ['草穗色', 'seedColour', 'color']
    ]],
    ['岩壁・全部', '', [
      ['岩壁垂掛的草', 'hangers', 0, 2, .01], ['乾枯葉比例', 'dry', 0, 1, .01], ['植物的風', 'wind', 0, 2.5, .01], ['新植物總量', 'amount', 0, 1, .01]
    ]]
  ];
  const ALL = [...GROUPS.map(g => [...g, G]), ...(PL ? PLANT_GROUPS.map(g => [...g, PL]) : [])];
  const CSS = `
    :host{all:initial}
    *{box-sizing:border-box}
    .tab,.panel{position:fixed;left:18px;z-index:2147483000;font:11px/1.45 "Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;color:#dbe8f4;letter-spacing:.04em}
    .tab{bottom:18px;height:26px;padding:0 11px;border:1px solid rgba(190,220,245,.28);border-radius:7px;background:rgba(8,18,30,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);cursor:pointer;color:#cfe0ef}
    .tab[aria-expanded="true"]{background:rgba(20,40,60,.82);border-color:rgba(190,220,245,.5)}
    .panel{bottom:52px;width:300px;max-height:min(80vh,820px);display:flex;flex-direction:column;border:1px solid rgba(190,220,245,.24);border-radius:9px;background:rgba(8,18,30,.8);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 10px 30px rgba(0,0,0,.28)}
    .panel[hidden]{display:none}
    header{display:flex;align-items:center;gap:8px;padding:9px 12px 8px;border-bottom:1px solid rgba(190,220,245,.14)}
    header b{font-size:12px;font-weight:600;letter-spacing:.12em;color:#eef6fd}
    header span{flex:1;color:#8fa6ba;font-size:10px}
    header button{width:22px;height:22px;padding:0;border:0;border-radius:5px;background:transparent;color:#a9bdd0;font-size:15px;line-height:1;cursor:pointer}
    .body{overflow:auto;padding:4px 12px 8px;scrollbar-width:thin;scrollbar-color:rgba(190,220,245,.3) transparent}
    h4{margin:10px 0 2px;font-size:11px;font-weight:600;letter-spacing:.16em;color:#9fd0f2}
    h4 small{margin-left:8px;font-weight:400;letter-spacing:.04em;color:#7f95a8;font-size:10px}
    label{display:grid;grid-template-columns:1fr auto;align-items:center;column-gap:8px;padding:3px 0}
    label i{font-style:normal;color:#c9d8e6}
    label output{font-variant-numeric:tabular-nums;color:#eef6fd;min-width:34px;text-align:right}
    input[type=range]{grid-column:1/3;width:100%;height:16px;margin:0;accent-color:#8fc4ea;background:transparent;cursor:pointer}
    label.colour{grid-template-columns:1fr auto auto}
    input[type=color]{width:34px;height:20px;padding:0;border:1px solid rgba(190,220,245,.3);border-radius:4px;background:transparent;cursor:pointer}
    footer{padding:8px 12px 10px;border-top:1px solid rgba(190,220,245,.14)}
    footer p{margin:0 0 7px;color:#8fa6ba;font-size:10px;font-variant-numeric:tabular-nums;min-height:14px}
    footer div{display:flex;gap:8px}
    footer button{flex:1;height:26px;border:1px solid rgba(190,220,245,.3);border-radius:6px;background:rgba(190,220,245,.08);color:#e6f0f9;font:inherit;cursor:pointer}
    footer button.quiet{flex:0 0 68px;background:transparent;color:#a9bdd0}
    button:focus-visible,input:focus-visible{outline:1px solid #9fd0f2;outline-offset:1px}
  `;
  const host = document.createElement('div'); host.id = 'f2g-panel';
  const root = host.attachShadow({ mode: 'open' });
  const el = (tag, props, ...kids) => { const n = Object.assign(document.createElement(tag), props || {}); n.append(...kids); return n; };
  const style = el('style', { textContent: CSS });
  const tab = el('button', { className: 'tab', type: 'button', textContent: '草 參數', title: '草的參數（G）' }); tab.setAttribute('aria-expanded', 'false');
  root.append(style, tab);
  let panel = null, status = null, clock = 0; const refreshers = [];
  const read = (target, key, index) => Number.isInteger(index) ? target.tune[key][index] : target.tune[key];
  const digits = step => step >= 1 ? 0 : step >= .1 ? 1 : 2;
  function build() {
    const body = el('div', { className: 'body' });
    for (const [title, hint, rows, target] of ALL) {
      body.append(el('h4', null, title, hint ? el('small', { textContent: hint }) : ''));
      for (const row of rows) {
        const [text, key, a, b, step] = row;
        if (a === 'color') {
          const index = b, input = el('input', { type: 'color' }), out = el('output');
          const show = () => { const v = String(read(target, key, index) || '#000000'); input.value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000'; out.textContent = input.value; };
          input.addEventListener('input', () => { target.set(key, input.value, index); out.textContent = input.value; });
          body.append(el('label', { className: 'colour' }, el('i', { textContent: text }), out, input)); refreshers.push(show); show();
        } else {
          const input = el('input', { type: 'range', min: a, max: b, step }), out = el('output');
          const show = () => { const v = +read(target, key); input.value = v; out.textContent = v.toFixed(digits(step)); };
          input.addEventListener('input', () => { const v = parseFloat(input.value); target.set(key, v); out.textContent = v.toFixed(digits(step)); });
          body.append(el('label', null, el('i', { textContent: text }), out, input)); refreshers.push(show); show();
        }
      }
    }
    status = el('p');
    const copy = el('button', { type: 'button', textContent: '複製參數 JSON' }), reset = el('button', { type: 'button', className: 'quiet', textContent: '重設' });
    copy.addEventListener('click', async () => {
      const d = G.diff(), pd = PL ? PL.diff() : {}; if (Object.keys(pd).length) d.plants = pd;
      const text = JSON.stringify(d, null, 1);
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch { }
      if (!ok) { try { const t = el('textarea', { value: text }); t.style.cssText = 'position:fixed;left:-99px;top:0;width:10px;height:10px;opacity:0'; root.append(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch { } }
      copy.textContent = ok ? '已複製' : '無法複製（請看主控台）'; if (!ok) console.log('flow2 grass, tune:', text);
      setTimeout(() => { copy.textContent = '複製參數 JSON'; }, 1600);
    });
    reset.addEventListener('click', () => { G.reset(); PL?.reset(); for (const show of refreshers) show(); });
    const close = el('button', { type: 'button', textContent: '×', title: '關閉（G）' }); close.addEventListener('click', () => toggle(false));
    panel = el('section', { className: 'panel', hidden: true }, el('header', null, el('b', { textContent: PL ? '草與植物 參數' : '草 參數' }), el('span', { textContent: 'G 開關・即時生效' }), close), body, el('footer', null, status, el('div', null, copy, reset)));
    /* the page scrolls its journey with the wheel and the keys: what happens inside the panel stays inside */
    for (const type of ['wheel', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchmove', 'keyup']) panel.addEventListener(type, event => event.stopPropagation(), { passive: true });
    panel.addEventListener('keydown', event => { event.stopPropagation(); if ((event.key === 'g' || event.key === 'G') && !event.ctrlKey && !event.metaKey && !event.altKey) toggle(false); });
    root.append(panel);
  }
  const tell = () => {
    if (!status) return; const s = G.state || {};
    const ps = PL?.state || {};
    status.textContent = s.scattering || ps.planting ? '重新種植中…' : (Number.isFinite(s.blades) ? `草葉 ${Math.round(s.blades / 1000)}k 根・花 ${Math.round((s.flowers || 0) / 2 * Math.min(2, Math.max(0, +G.tune.flowers || 0)))}・畫面內 ${Math.round((s.drawn || 0) / 1000)}k` + (Number.isFinite(ps.instances) ? `・植物 ${Math.round(ps.instances / 1000)}k（畫面內 ${Math.round((ps.drawn || 0) / 1000)}k）` : '') : '準備中…');
  };
  function toggle(open) {
    if (!panel) build();
    const show = open === undefined ? panel.hidden : open;
    panel.hidden = !show; tab.setAttribute('aria-expanded', String(show));
    clearInterval(clock); if (show) { for (const f of refreshers) f(); tell(); clock = setInterval(tell, 500); }
    try { sessionStorage.setItem('flow2-grass-panel-open', show ? '1' : '0'); } catch { }
  }
  tab.addEventListener('click', event => { event.stopPropagation(); toggle(); });
  for (const type of ['pointerdown', 'mousedown', 'touchstart']) tab.addEventListener(type, event => event.stopPropagation(), { passive: true });
  addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || (event.key !== 'g' && event.key !== 'G')) return;
    const at = event.composedPath?.()[0] || event.target;
    if (at && (at.isContentEditable || /^(input|textarea|select)$/i.test(at.tagName || '')) && !(at.type === 'range' || at.type === 'color')) return;
    toggle();
  });
  (document.body || document.documentElement).append(host);
  /* (the client's tab reloads whenever a project file is written: the panel comes back the way it was left) */
  try { if (sessionStorage.getItem('flow2-grass-panel-open') === '1') toggle(true); } catch { }
  G.panel = { toggle, host };
})();
