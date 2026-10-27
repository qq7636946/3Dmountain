'use strict';
/* index1-5 health check: build → ESM syntax of every generated module → the live page (desktop, optional phone),
   journey to 5.56 and to the end, page errors. Prints ONE JSON line on stdout (progress goes to stderr). */
const fs = require('node:fs'), path = require('node:path');
const L = require('./lib.cjs');
const USAGE = `check.cjs — 建置＋語法＋頁面健康檢查，最後印一行 JSON
用法：node scripts/index1-5/check.cjs [--no-build] [--phone] [--query "&logolook=original"]
  --no-build   不執行 node prototypes/index1-5/build.cjs（別人正在截圖時用這個）
  --phone      桌機之後再用手機 390×844 載一次
  --query      額外的網址參數（例如 "&opencam=valley"）
  （整體上限預設 900 秒）
輸出：{"ok":…,"build":…,"syntax":[失敗的檔案],"errors":[頁面錯誤],"ms":{"ready":…,"journey":…},…}
結束碼：0 全部通過｜1 有失敗｜2 指令打錯｜3 超時`;

L.main('check', { usage: USAGE, spec: { 'no-build': 'bool', phone: 'bool', query: 'value' }, timeout: 900 }, async o => {
  const sum = { ok: false, build: 'skipped', syntax: [], errors: [], ms: {}, fly: {}, max: null, files: 0, ignored: [], warnings: [] };
  const done = () => {
    sum.ok = !/^FAIL/.test(sum.build) && !sum.syntax.length && !sum.errors.length;
    console.log(JSON.stringify(sum));
    return sum.ok ? 0 : 1;
  };
  // (a) build
  if (!o['no-build']) {
    L.note('build: node prototypes/index1-5/build.cjs …');
    const b = L.runBuild();
    sum.build = b.ok ? 'ok' : 'FAIL ' + (b.err || b.out || 'exit ' + b.code);
    sum.ms.build = b.ms;
    if (!b.ok) return done();
    L.note(b.out);
  }
  // (b) syntax: every generated module + the interface module, as ES modules
  const JS = path.join(L.PROTO, 'js');
  const files = [...fs.readdirSync(JS).filter(f => f.endsWith('.js')).sort().map(f => path.join(JS, f)), path.join(L.PROTO, 'alpine-ui.js')];
  sum.syntax = L.syntaxCheck(files); sum.files = files.length;
  L.note(`syntax: ${files.length} files, ${sum.syntax.length} failed`);
  // (c) the page
  await L.acquireLock('check', o);
  const browser = await L.launchBrowser();
  for (const vp of [L.viewport({}), ...(o.phone ? [L.viewport({ phone: true })] : [])]) {
    const tag = vp.phone ? '[phone] ' : '';
    const { context, page, log } = await L.newPage(browser, vp);
    const ms = {}, fly = {}; let max = null;
    try {
      const url = L.pageUrl({}, o.query);
      L.note(`${tag}load ${url} @ ${L.vpName(vp)}`);
      Object.assign(ms, await L.loadPage(page, url));
      for (const P of [5.56, 'max']) {
        const f = await L.fly(page, P);
        fly[L.posName(P)] = f.ms; max = f.max;
        if (!f.ok) log.errors.push(`journey 沒有到 ${L.posName(P)}（progress ${f.progress}，target ${f.target}，max ${f.max}）`);
        L.note(`${tag}fly ${L.posName(P)}: ${f.ok ? 'ok' : 'NOT REACHED'} progress ${f.progress} in ${f.ms} ms`);
      }
      await page.waitForTimeout(1500);   // late errors (lazy modules, shader compiles)
    } catch (e) { log.errors.push('load: ' + L.clip(e.message, 240)); }
    const add = (list, into) => { for (const s of L.tally(list)) into.push(tag + s); };
    add(log.errors, sum.errors); add(log.ignored, sum.ignored); add(log.warnings, sum.warnings);
    if (vp.phone) sum.phone = { ms, fly, max }; else { Object.assign(sum.ms, ms); sum.fly = fly; sum.max = max; }
    await Promise.race([context.close().catch(() => { }), L.sleep(8000)]);
  }
  sum.warnings = sum.warnings.slice(0, 12);
  return done();
});
