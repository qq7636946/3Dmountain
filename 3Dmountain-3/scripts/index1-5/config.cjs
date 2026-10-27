'use strict';
/* Live CONFIG of the loaded page (ported from scratchpad/asc/cfgnow.cjs): dump it all to a file, or print values. */
const path = require('node:path');
const L = require('./lib.cjs');
const USAGE = `config.cjs — 讀出頁面「載入後」實際生效的 CONFIG（含客戶 preset）
用法：node scripts/index1-5/config.cjs [--get group.key] [--out file.json]
  --get     印出一個或多個值（逗號分隔）："alpineLight.sunIntensity,relief.lift"；只寫群組名就印整組
  --out     整份 CONFIG 寫到這個 JSON 檔（相對於目前目錄）
  （都不給：寫到 .qa/index1-5/config-yyyymmdd-hhmmss/config.json，並列出每個群組有幾個鍵）
  --w --h / --phone / --query   同 shot.cjs（手機的 CONFIG 可能不同）
結束碼：0 成功｜1 有找不到的鍵或頁面錯誤｜2 指令打錯｜3 超時`;

L.main('config', { usage: USAGE, timeout: 300, spec: { get: 'value', out: 'value', w: 'value', h: 'value', phone: 'bool', query: 'value' } }, async o => {
  if (o.get === true || o.get === '') throw new L.UsageError('--get 要接 group.key');
  const keys = o.get ? String(o.get).split(',').map(k => k.trim()).filter(Boolean) : null;
  const s = await L.openSession('config', o);
  const cfg = await s.page.evaluate(() => JSON.parse(JSON.stringify(window.__MONTIS_STUDY__.CONFIG)));
  if (keys) {
    let missing = 0;
    for (const k of keys) {
      let v = cfg; for (const part of k.split('.')) v = v != null && typeof v === 'object' ? v[part] : undefined;
      if (v === undefined) missing++;
      console.log(k, '=', v === undefined ? '(不存在)' : JSON.stringify(v));
    }
    if (o.out) { const f = path.resolve(process.cwd(), String(o.out)); L.writeJson(f, cfg); console.log('config', L.abs(f)); }
    L.printLog(s.log);
    return missing || s.log.errors.length ? 1 : 0;
  }
  const file = o.out ? path.resolve(process.cwd(), String(o.out)) : path.join(L.outDir('config'), 'config.json');
  L.writeJson(file, cfg);
  const groups = Object.entries(cfg).map(([g, v]) => `${g}(${v && typeof v === 'object' ? Object.keys(v).length : typeof v})`);
  console.log('groups', groups.length + ':', groups.join(' '));
  console.log('config', L.abs(file));
  L.printLog(s.log);
  return s.log.errors.length ? 1 : 0;
});
