'use strict';
/* sheet.cjs — contact sheet of jpg frames with labels ("label|file" pairs), for the smooth-flow evidence.
   Usage: node scripts/index1-5/probes/smooth/sheet.cjs OUT.jpg COLS "title" "label|file" "label|file" … */
const L = require('../../lib.cjs');
const path = require('node:path');
L.main('sheet', { usage: 'sheet.cjs OUT.jpg COLS "title" "label|file" …', timeout: 120, spec: {} }, async o => {
  const [out, cols, title, ...cells] = o._;
  if (!out || !cols || !cells.length) throw new L.UsageError('需要 OUT COLS title 與至少一組 label|file');
  await L.acquireLock('sheet', o);
  const b = await L.launchBrowser({ gpu: false });
  const ctx = await b.newContext();
  const list = cells.map(c => { const i = c.lastIndexOf('|'); return { label: c.slice(0, i), file: path.resolve(c.slice(i + 1)) }; });
  const f = await L.contactSheet(ctx, list, path.resolve(out), { cols: Number(cols), title, cell: 560 });
  console.log('sheet', L.abs(f));
  return 0;
});
