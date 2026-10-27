'use strict';
/* World epilogue captures: cards → globe → wave dive → ocean chapters → footer (ported from scratchpad/ocean/cap.cjs,
   without its --overlay mode). Enters the world the way a visitor does (end of journey + wheel), then jumps. */
const path = require('node:path');
const L = require('./lib.cjs');
const USAGE = `world-shot.cjs — 地球／海洋／頁尾段截圖＋對照表
用法：node scripts/index1-5/world-shot.cjs --points "g:0.9,d:0.5,h:1,end" [選項]
  --points  位置清單：
              g:<0–1>   「全球」段（地球）的比例
              d:<0–1>   波浪轉場（俯衝進海面）的比例
              h:<n>     海洋第 n 章（0＝第一章；可用小數看兩章之間）
              u:<n>     同 h 但不加 2px 偏移（原始 stop 單位）
              f:<px>    頁尾頂端往上 px
              y:<px>    世界段的原始捲動 y
              end       最底（頁尾）
              l:<0–1>   LOGO 收尾段整段（波浪開始 → 停留結束）；lw: 只看波浪、ls: 只看旋轉、lh: 只看停留（0–1）
                        這幾種會先等湖景建好（延遲建立）才跳過去；?logoseal=0 時這幾種點會報錯
            預設 "g:0.5,d:0.5,h:0,h:1,h:2,h:3,end"
  --w --h / --phone / --query / --reduced   同 shot.cjs（預設帶 tune=0）
  --set / --early / --js                    同 shot.cjs（例如 --set "worldOcean.glint=2"）
  --wait    每點跳過去後等幾毫秒（預設 900）
  --cols    每列幾張（預設 4）；--out 資料夾名稱（預設 world-yyyymmdd-hhmmss）
輸出：.qa/index1-5/<名稱>/w-<點>.jpg、sheet.jpg、run.json（世界段量測 at/ocean、每點的海洋狀態）
結束碼：0 成功｜1 頁面有錯／進不了世界段｜2 指令打錯｜3 超時`;

L.main('world-shot', {
  usage: USAGE, timeout: 900,
  spec: { points: 'value', w: 'value', h: 'value', phone: 'bool', query: 'value', reduced: 'bool', set: 'value', early: 'bool', js: 'value', wait: 'value', cols: 'value', out: 'value', quality: 'value' },
}, async o => {
  const points = L.parsePoints(o.points ?? 'g:0.5,d:0.5,h:0,h:1,h:2,h:3,end');
  const sets = o.set !== undefined ? L.parseSets(o.set) : [];
  if (o.early && !sets.length) throw new L.UsageError('--early 要搭配 --set');
  const jsFile = L.readJsFile(o);
  const waitMs = L.opt(o, 'wait', 900, { min: 0 }), cols = L.opt(o, 'cols', 4, { min: 1, max: 12, int: true }), quality = L.opt(o, 'quality', 82, { min: 30, max: 100, int: true });
  const vp = L.viewport(o), dir = L.outDir('world', o.out);

  const s = await L.openSession('world-shot', o, { autoplay: true, early: o.early ? sets : null });
  const { page, log } = s;
  const run = { tool: 'world-shot', url: s.url, viewport: vp, reduced: !!o.reduced, ms: s.ms, args: process.argv.slice(2), sets: null, js: null, shots: [] };
  if (s.early) run.sets = { mode: 'early', ...s.early };
  else if (sets.length) run.sets = { mode: 'runtime', ...await L.applySets(page, sets) };
  if (jsFile) run.js = { file: L.abs(jsFile), result: await L.runJs(page, jsFile) };

  const w = await L.enterWorld(page, vp);
  const st = w.state;
  run.world = { notches: w.notches, maxY: st.maxY, at: st.at, ocean: st.ocean };
  console.log('entered world after', w.notches, 'wheel notches; at', JSON.stringify(st.at), 'ocean', JSON.stringify(st.ocean && st.ocean.at), 'maxY', st.maxY);

  const cells = [];
  for (const pt of points) {
    const y = L.worldY(st, pt);
    // logo seal points (l:/lw:/ls:/lh:): the lake is built lazily near the block; wait for it first (QA only)
    if (/^l/.test(pt)) { const cur = await L.logoNow(page); if (!cur || !cur.ready) run.logoPrepare = await L.prepareLogo(page, st); }
    await L.jumpWorld(page, y);
    await page.waitForTimeout(waitMs);
    const file = path.join(dir, `w-${L.fileTag(pt.replace(/[:.]/g, '_'))}.jpg`);
    await L.capture(page, file, quality);
    const now = await L.oceanNow(page);
    run.shots.push({ point: pt, y: Math.round(y), file: L.abs(file), ...now, ...(/^l/.test(pt) ? { logo: await L.logoNow(page) } : {}) });
    cells.push({ label: `${pt} · y ${Math.round(y)}`, file });
  }
  const stats = await L.imageStats(s.context, cells.map(c => c.file));
  cells.forEach((c, i) => {
    c.label += ` · L* ${stats[i].lstar}`; run.shots[i].lstar = stats[i].lstar;
    const r = run.shots[i];
    console.log(r.file, 'y', r.y, 'L*', r.lstar, r.logo ? JSON.stringify(r.logo) : r.ocean ? JSON.stringify(r.ocean) : '');
  });
  const title = `index1-5 world · ${L.vpName(vp)}${o.reduced ? ' · reduced' : ''}${o.query ? ' · ' + o.query : ''}${sets.length ? ' · ' + sets.map(x => x.key + '=' + x.raw).join(', ') : ''} · ${new Date().toLocaleString('zh-TW', { hour12: false })}`;
  run.sheet = L.abs(await L.contactSheet(s.context, cells, path.join(dir, 'sheet.jpg'), { cols, title }));
  Object.assign(run, L.logJson(log));
  L.writeJson(path.join(dir, 'run.json'), run);
  console.log('sheet', run.sheet);
  console.log('run', L.abs(path.join(dir, 'run.json')));
  L.printLog(log);
  return log.errors.length ? 1 : 0;
});
