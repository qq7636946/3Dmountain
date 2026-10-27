'use strict';
/* One dial, several values, same place: one capture per value (plus the current value first) and a labelled sheet,
   so a client can pick. Rows = positions, columns = values. Journey positions (--at) or world points (--points). */
const path = require('node:path');
const L = require('./lib.cjs');
const USAGE = `sweep.cjs — 同一個參數試多個值，同一位置各截一張，排成對照表給客戶挑
用法：node scripts/index1-5/sweep.cjs --set-key group.key --values "a,b,c" --at "12.3" [選項]
  --set-key   CONFIG 的鍵（例如 alpineLight.sunIntensity；config.cjs 可查）
  --values    要試的值（逗號分隔；數字、#hex、true/false）
  --at        旅程位置（可多個，每個一列）；或用 --points "h:1,end" 拍海洋／地球段（同 world-shot.cjs）
  --early     每個值重新載入頁面、在場景建立前寫入（「重整生效」的參數要用這個；比較慢）
  --no-base   不拍「目前值」那一格（預設第一格是目前值）
  --w --h / --phone / --query / --reduced   同 shot.cjs
  --wait      改值後等幾毫秒再截（預設 1800；--early 時是到位後 2600）
  --cols      每列幾張（預設＝值的數量＋1）
  --out       輸出資料夾名稱（預設 sweep-yyyymmdd-hhmmss）
輸出：.qa/index1-5/<名稱>/v-<位置>-<格號>-<值>.jpg（格號 0＝目前值）、sheet.jpg、run.json
       每格標 L*（中位明度）和 Δ（和同列第一格的平均 RGB 差；0＝一樣）。畫面本身會動（水、雲、光線），
       同一個值重拍 Δ 大約 2（空拍）到 7（峽谷河面）；想知道雜訊多大，就把目前值也放進 --values。
結束碼：0 成功｜1 頁面有錯或位置沒到｜2 指令打錯｜3 超時`;

L.main('sweep', {
  usage: USAGE, timeout: 1500,
  spec: { 'set-key': 'value', values: 'value', at: 'value', points: 'value', early: 'bool', 'no-base': 'bool', w: 'value', h: 'value', phone: 'bool', query: 'value', reduced: 'bool', wait: 'value', cols: 'value', out: 'value' },
}, async o => {
  const key = o['set-key'];
  if (!key || key === true) throw new L.UsageError('缺少 --set-key group.key');
  if (o.values === undefined || o.values === true) throw new L.UsageError('缺少 --values "a,b,c"');
  const values = String(o.values).split(',').map(v => v.trim()).filter(v => v !== '').map(v => L.makeSet(key, v, 'values'));
  if (!values.length) throw new L.UsageError('--values 是空的');
  const world = o.points !== undefined;
  if (world && o.at !== undefined) throw new L.UsageError('--at 和 --points 只能選一個');
  const places = world ? L.parsePoints(o.points) : L.parsePositions(o.at);
  const base = !o['no-base'], cols = L.opt(o, 'cols', values.length + (base ? 1 : 0), { min: 1, max: 16, int: true });
  const waitMs = o.wait !== undefined ? L.num(o.wait, 'wait', { min: 0 }) : null;
  const vp = L.viewport(o), dir = L.outDir('sweep', o.out);
  const run = { tool: 'sweep', key, mode: o.early ? 'early' : 'runtime', viewport: vp, args: process.argv.slice(2), base: null, shots: [], loads: [] };
  const cells = [], logs = []; let missed = 0;

  // go to a place; returns a short label suffix when it was not reached
  const goTo = async (page, place, worldState) => {
    if (world) { await L.jumpWorld(page, L.worldY(worldState, place)); await page.waitForTimeout(waitMs ?? 1200); return ''; }
    const f = await L.fly(page, place); if (!f.ok) missed++;
    await page.waitForTimeout(o.early ? (waitMs ?? 2600) : (place === 0 ? 3500 : 2600));
    return f.ok ? '' : `（未到，停在 ${f.progress}）`;
  };
  // file name: v-<place>-<cell no.>-<value>.jpg (the cell number keeps a repeated value, e.g. "7,7", from overwriting)
  const fileFor = (place, i, value) => path.join(dir, `v-${L.fileTag(world ? place.replace(/[:.]/g, '_') : L.posName(place))}-${i}-${L.fileTag(value)}.jpg`);
  const shoot = async (page, place, label, i, value, extra) => {
    const file = fileFor(place, i, value);
    await L.capture(page, file);
    cells.push({ label, file }); run.shots.push({ place: world ? place : L.posName(place), value, file: L.abs(file), ...extra });
    console.log(L.abs(file));
  };
  const placeName = p => world ? p : 'p ' + L.posName(p);

  if (!o.early) {
    // one load; per place: current value, then each value written at run time
    const s = await L.openSession('sweep', o, { autoplay: world }); logs.push(s.log);
    run.url = s.url; run.loads.push(s.ms);
    const cur = await s.page.evaluate(parts => { let v = window.__MONTIS_STUDY__.CONFIG; for (const k of parts) v = v == null ? undefined : v[k]; return v; }, values[0].parts);
    if (cur === undefined) L.note(`WARN ${key} 目前不存在於 CONFIG`);
    run.base = cur;
    await s.page.waitForTimeout(1200);
    let ws = null; if (world) ws = (await L.enterWorld(s.page, vp)).state;
    for (const place of places) {
      // the current value goes through the same write → wait → capture as every other value, so the cells differ by
      // the dial only (arriving at a chapter also fades a title in and out: a capture right on arrival would differ)
      if (cur !== undefined) await L.applySets(s.page, [{ key, parts: values[0].parts, raw: String(cur), value: cur }]);
      const miss = await goTo(s.page, place, ws);
      if (base) {
        if (cur !== undefined) await L.applySets(s.page, [{ key, parts: values[0].parts, raw: String(cur), value: cur }]);
        await s.page.waitForTimeout(waitMs ?? 1800);
        await shoot(s.page, place, `${placeName(place)} · ${key} = ${cur}（目前）${miss}`, 0, 'base', { reached: !miss });
      }
      for (const [i, v] of values.entries()) {
        const rep = await L.applySets(s.page, [v]);
        if (!run.report) run.report = rep;
        await s.page.waitForTimeout(waitMs ?? 1800);
        await shoot(s.page, place, `${placeName(place)} · ${key} = ${v.raw}${miss}`, i + 1, v.raw, { reached: !miss });
      }
    }
    await finishSheet(s.context);
  } else {
    // one fresh page load per value (and one for the current value), values written before the scene is built
    await L.acquireLock('sweep', o);
    const browser = await L.launchBrowser({ autoplay: world });
    const runs = [...(base ? [null] : []), ...values];
    const shotsBy = new Map();
    for (const [n, v] of runs.entries()) {
      const cellNo = base ? n : n + 1;
      const s = await L.openSession('sweep', o, { early: v ? [v] : null, browser, autoplay: world }); logs.push(s.log);
      run.url = s.url; run.loads.push(s.ms);
      if (v && !run.report) run.report = s.early;
      const cur = v ? null : await s.page.evaluate(parts => { let x = window.__MONTIS_STUDY__.CONFIG; for (const k of parts) x = x == null ? undefined : x[k]; return x; }, values[0].parts);
      if (!v) run.base = cur;
      await s.page.waitForTimeout(1200);
      let ws = null; if (world) ws = (await L.enterWorld(s.page, vp)).state;
      for (const place of places) {
        const miss = await goTo(s.page, place, ws);
        const file = fileFor(place, cellNo, v ? v.raw : 'base');
        await L.capture(s.page, file);
        console.log(L.abs(file));
        const label = `${placeName(place)} · ${key} = ${v ? v.raw : cur + '（目前）'}${miss}`;
        if (!shotsBy.has(place)) shotsBy.set(place, []);
        shotsBy.get(place).push({ label, file });
        run.shots.push({ place: world ? place : L.posName(place), value: v ? v.raw : 'base', file: L.abs(file), reached: !miss });
      }
      await Promise.race([s.context.close().catch(() => { }), L.sleep(8000)]);
    }
    for (const place of places) cells.push(...shotsBy.get(place));   // rows = places
    await finishSheet(browser);
  }

  async function finishSheet(target) {
    // numbers next to the pictures: median L*, and Δ = mean |RGB| difference from the row's first cell (0 = identical)
    const rowLen = values.length + (base ? 1 : 0);
    for (let r = 0; r < cells.length; r += rowLen) {
      const row = cells.slice(r, r + rowLen), st = await L.imageStats(target, row.map(c => c.file), 0);
      row.forEach((c, i) => {
        c.label += ` · L* ${st[i].lstar}${i ? ` · Δ ${st[i].diff}` : ''}`;
        const shot = run.shots.find(x => x.file === L.abs(c.file)); if (shot) Object.assign(shot, st[i]);
        console.log(`  ${path.basename(c.file)}  L* ${st[i].lstar}${i ? `  Δ ${st[i].diff}` : '  (ref)'}`);
      });
    }
    const title = `sweep ${key}${o.early ? '（early）' : ''} · ${L.vpName(vp)}${o.query ? ' · ' + o.query : ''} · ${new Date().toLocaleString('zh-TW', { hour12: false })}`;
    run.sheet = L.abs(await L.contactSheet(target, cells, path.join(dir, 'sheet.jpg'), { cols, title }));
  }
  const all = { errors: [], ignored: [], warnings: [], http: [] };
  for (const g of logs) for (const k of Object.keys(all)) all[k].push(...g[k]);
  Object.assign(run, L.logJson(all));
  L.writeJson(path.join(dir, 'run.json'), run);
  console.log('sheet', run.sheet);
  console.log('run', L.abs(path.join(dir, 'run.json')));
  L.printLog(all);
  return all.errors.length || missed ? 1 : 0;
});
