/* Flow2 · tuning panels (2026-11-14). index1-5-flow2.html and its trial copies.
   Client: 「你可以直接開一個參數值的bar給我調 我調完數值給你比較快」 — sliders on the page; the client tunes by eye, copies the
   values and hands them to the developer, who writes them into the modules' defaults.

   A module registers a section:  window.__FLOW2_PANEL__?.add({ id, title, tune, rows, onChange })
     tune      the module's own live values (the panel reads and writes this object; nested keys as 'a.b', array items as 'a.0')
     rows      [label, key, min, max, step]  a slider   ·   [label, key, 'color'|'checkbox']  a colour or switch   ·   ['— heading —']  a divider
               [label, key, min, max, step, 'off0']  a slider whose 0 means "off" (stored as NaN)
     onChange  (key, value) => {}   called after a value is written (for values a module does not read every frame)
     restoreSaved  (values) => values   optional conversion of saved settings before applying them
     serialize  () => values   optional full export for the copy button
     storageId   optional local storage namespace for a new preset
     displayValue  (key) => value   optional live reading, independent of the saved value
   Each section gets a small tab in the lower left corner (to the right of the grass module's own 「草 參數」 tab); a click opens its panel. Values that differ from the module's
   defaults are kept in localStorage (the page reloads often while it is being worked on) and applied again on load.
   「複製參數 JSON」 copies only the changed values; 「重設」 goes back to the defaults.
   ?panel=0 hides the tabs. Under automation (captures) they are hidden unless ?panel=1. Nothing here touches the 3D. */
(() => {
  'use strict';
  if (document.documentElement.hasAttribute('data-rise-published')) return;
  const Q = new URLSearchParams(location.search);
  const hidden = Q.get('panel') === '0' || (navigator.webdriver && Q.get('panel') !== '1');
  const sections = new Map();
  const KEY = id => 'flow2-tune:' + id;
  const get = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
  const set = (o, path, value) => { const ks = path.split('.'); const last = ks.pop(); const host = ks.reduce((v, k) => v[k], o); host[last] = value; };
  const same = (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' && ((Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) < 1e-9));
  const read = id => { try { return JSON.parse(localStorage.getItem(KEY(id)) || '{}') || {}; } catch (error) { return {}; } };
  const diff = s => { const d = {}; for (const row of s.rows) { if (row.length < 2) continue; const v = get(s.tune, row[1]), z = s.defaults[row[1]]; if (!same(v, z)) d[row[1]] = typeof v === 'number' && Number.isNaN(v) ? null : v; } return d; };
  const keep = s => { try { const d = diff(s), key = KEY(s.storageId ?? s.id); if (Object.keys(d).length) localStorage.setItem(key, JSON.stringify(d)); else localStorage.removeItem(key); } catch (error) { } };

  let root = null, tabs = null;
  function shell() {
    if (root || hidden) return;
    const style = document.createElement('style');
    style.textContent = `
      .f2p { position: fixed; left: 96px; bottom: 18px; z-index: 2147483000; font: 500 11px/1.35 "DM Sans", "Noto Sans TC", system-ui, sans-serif; color: #dbe9ff; letter-spacing: .02em; pointer-events: none; }
      .f2p * { box-sizing: border-box; }
      .f2p-tabs { display: flex; gap: 6px; pointer-events: auto; }
      .f2p-tab { appearance: none; border: 1px solid rgba(190, 220, 255, .28); border-radius: 8px; background: rgba(9, 17, 32, .72); color: #cfe2ff; font: inherit; height: 26px; padding: 0 11px; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
      .f2p-tab[aria-expanded="true"] { background: rgba(190, 220, 255, .92); color: #0b1830; border-color: transparent; }
      .f2p-box { position: absolute; left: 232px; bottom: 34px; width: 318px; max-height: min(72vh, 640px); overflow: auto; padding: 12px 12px 10px; border: 1px solid rgba(190, 220, 255, .26); border-radius: 10px; background: rgba(8, 15, 29, .86); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); pointer-events: auto; scrollbar-width: thin; }
      .f2p-box[hidden] { display: none; }
      .f2p-title { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #fff; }
      .f2p-title small { font-weight: 500; color: #8fa9cf; }
      .f2p-head { margin: 10px 0 4px; padding-top: 8px; border-top: 1px solid rgba(190, 220, 255, .14); color: #8fb6ee; font-weight: 700; }
      .f2p-row { display: grid; grid-template-columns: 104px 1fr 46px; align-items: center; gap: 8px; min-height: 24px; }
      .f2p-row label { color: #c6d6ee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .f2p-row input[type="range"] { width: 100%; margin: 0; accent-color: #9fcbff; height: 16px; }
      .f2p-row input[type="checkbox"] { justify-self: start; width: 15px; height: 15px; margin: 0; accent-color: #9fcbff; }
      .f2p-row output { text-align: right; font-variant-numeric: tabular-nums; color: #fff; }
      .f2p-row input[type="color"] { width: 100%; height: 20px; padding: 0; border: 1px solid rgba(190, 220, 255, .3); border-radius: 5px; background: none; }
      .f2p-row.is-changed label { color: #ffe9a8; }
      .f2p-actions { display: flex; gap: 6px; margin-top: 12px; position: sticky; bottom: -10px; padding: 8px 0 2px; background: linear-gradient(rgba(8, 15, 29, 0), rgba(8, 15, 29, .96) 30%); }
      .f2p-actions button { flex: 1; appearance: none; border: 1px solid rgba(190, 220, 255, .3); border-radius: 7px; background: rgba(190, 220, 255, .1); color: #e6f0ff; font: inherit; padding: 6px 8px; cursor: pointer; }
      .f2p-actions button.is-main { background: rgba(190, 220, 255, .9); color: #0b1830; border-color: transparent; font-weight: 700; }
      @media (max-width: 760px) { .f2p { display: none; } }`;
    document.head.appendChild(style);
    root = document.createElement('div'); root.className = 'f2p'; root.setAttribute('data-flow2-panel', '');
    tabs = document.createElement('div'); tabs.className = 'f2p-tabs'; root.appendChild(tabs);
    (document.body || document.documentElement).appendChild(root);
  }

  const format = (v, step) => { if (typeof v !== 'number' || Number.isNaN(v)) return '關'; const d = step >= 1 ? 0 : step >= .1 ? 1 : step >= .01 ? 2 : 3; return v.toFixed(d); };

  function build(s) {
    if (hidden) return;
    if (!document.body) { addEventListener('DOMContentLoaded', () => build(s), { once: true }); return; }
    shell();
    const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'f2p-tab'; tab.dataset.panelId = s.id; tab.textContent = s.title + ' 參數' + (s.key ? '（' + s.key.toUpperCase() + '）' : ''); tab.setAttribute('aria-expanded', 'false');
    const box = document.createElement('div'); box.className = 'f2p-box'; box.dataset.panelId = s.id; box.hidden = true;
    const title = document.createElement('div'); title.className = 'f2p-title'; title.innerHTML = '<span></span><small>改了的項目是黃色</small>'; title.firstChild.textContent = s.title; box.appendChild(title);
    const controls = new Map();
    for (const row of s.rows) {
      if (row.length < 2) { const h = document.createElement('div'); h.className = 'f2p-head'; h.textContent = row[0].replace(/^[—\s]+|[—\s]+$/g, ''); box.appendChild(h); continue; }
      const [label, key] = row, line = document.createElement('div'); line.className = 'f2p-row';
      const name = document.createElement('label'); name.textContent = label; name.title = label + '  (' + key + ')'; line.appendChild(name);
      let input, out = null;
      if (row[2] === 'color') {
        input = document.createElement('input'); input.type = 'color'; line.appendChild(input); line.appendChild(document.createElement('span'));
        input.addEventListener('input', () => write(s, key, input.value, sync));
      } else if (row[2] === 'checkbox') {
        input = document.createElement('input'); input.type = 'checkbox'; line.appendChild(input);
        out = document.createElement('output'); line.appendChild(out);
        input.addEventListener('change', () => write(s, key, input.checked, sync));
      } else {
        const [, , min, max, step, mode] = row;
        input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; line.appendChild(input);
        out = document.createElement('output'); line.appendChild(out);
        input.addEventListener('input', () => { let v = parseFloat(input.value); if (mode === 'off0' && v <= 0) v = NaN; write(s, key, v, sync); });
      }
      name.htmlFor = input.id = s.id + '-' + key;
      box.appendChild(line); controls.set(key, { row, line, input, out });
    }
    const actions = document.createElement('div'); actions.className = 'f2p-actions';
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'is-main'; copy.textContent = '複製參數 JSON';
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = '重設';
    actions.append(copy, reset); box.appendChild(actions);
    function syncControl(c, key) {
      const saved = get(s.tune, key), v = s.displayValue?.(key) ?? saved;
      if (c.row[2] === 'color') { if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) && c.input.value !== v.toLowerCase()) c.input.value = v; }
      else if (c.row[2] === 'checkbox') { c.input.checked = !!v; c.out.textContent = v ? '開' : '關'; }
      else {
        const n = Number.isFinite(v) ? v : 0;
        if (document.activeElement !== c.input) c.input.value = n;
        c.out.textContent = c.row[5] === 'percent' ? Math.round(n * 100) + '%' : format(v, +c.row[4]);
      }
      c.line.classList.toggle('is-changed', !same(saved, s.defaults[key]));
    }
    const sync = () => controls.forEach(syncControl);
    s.refresh = key => { const c = controls.get(key); if (!box.hidden && c) syncControl(c, key); };
    copy.addEventListener('click', async () => {
      const text = JSON.stringify(s.serialize?.() ?? { [s.id]: diff(s) }, null, 1);
      let ok = false; try { await navigator.clipboard.writeText(text); ok = true; } catch (error) { }
      if (!ok) { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;left:-999px;top:0'; document.body.appendChild(t); t.select(); try { ok = document.execCommand('copy'); } catch (error) { } t.remove(); }
      copy.textContent = ok ? '已複製' : '複製失敗'; setTimeout(() => { copy.textContent = '複製參數 JSON'; }, 1400);
    });
    reset.addEventListener('click', () => { for (const row of s.rows) if (row.length > 1) { set(s.tune, row[1], s.defaults[row[1]]); try { s.onChange?.(row[1], s.defaults[row[1]]); } catch (error) { } } keep(s); sync(); });
    tab.addEventListener('click', () => {
      const open = box.hidden;
      for (const other of sections.values()) if (other.box && other !== s) { other.box.hidden = true; other.tab.setAttribute('aria-expanded', 'false'); }
      box.hidden = !open; tab.setAttribute('aria-expanded', String(open)); if (open) sync();
    });
    s.tab = tab; s.box = box; tabs.appendChild(tab); root.appendChild(box); sync();
  }

  function write(s, key, value, sync) {
    set(s.tune, key, value);
    try { s.onChange?.(key, value); } catch (error) { console.warn('flow2 panel: ' + s.id + '.' + key, error); }
    keep(s); sync();
  }

  /* a section may name a key ({ key: 'l' }): pressing it opens / closes that section (not while typing in a field) */
  addEventListener('keydown', e => {
    if (hidden || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target, tag = t && t.tagName; if (tag === 'INPUT' && !['range', 'color', 'checkbox'].includes(t.type) || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    for (const s of sections.values()) if (s.key && s.tab && e.key.toLowerCase() === s.key.toLowerCase()) { s.tab.click(); break; }
  });

  window.__FLOW2_PANEL__ = {
    add(section) {
      const s = { ...section, defaults: {} };
      for (const row of s.rows) if (row.length > 1) s.defaults[row[1]] = get(s.tune, row[1]);
      /* values kept from the last visit: applied at once, before the module reads its tune */
      const saved = read(s.storageId ?? s.id);
      const kept = s.restoreSaved?.(saved) ?? saved;
      for (const row of s.rows) if (row.length > 1 && row[1] in kept) { const v = kept[row[1]]; try { set(s.tune, row[1], v === null ? NaN : v); } catch (error) { } }
      sections.set(s.id, s); build(s);
      return { diff: () => diff(s), defaults: s.defaults, refresh: key => s.refresh?.(key) };
    },
    diff() { const out = {}; for (const s of sections.values()) { const d = diff(s); if (Object.keys(d).length) out[s.id] = d; } return out; },
    get hidden() { return hidden; }
  };
})();
