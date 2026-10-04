import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderJourneyInterface } from '../../finnovation-interface.js';

// The live interface and initial HTML share the same content template.
// Run after editing the chapter copy; publishing also copies the page to index3.html.
const root = fileURLToPath(new URL('../../', import.meta.url));
const files = process.argv.slice(2);
if (!files.length) files.push('index4-6-3.html');
const start = '<!-- FINNOVATION_STATIC_UI_START -->';
const end = '<!-- FINNOVATION_STATIC_UI_END -->';
const content = `${start}\n  <div class="finnovation-ui" data-journey-ui>\n${renderJourneyInterface()}\n  </div>\n  ${end}`;
for (const file of files) {
  const target = path.resolve(root, file);
  const html = (await fs.readFile(target, 'utf8')).replace(/\r\n/g, '\n');
  const a = html.indexOf(start), b = html.indexOf(end);
  if (a < 0 || b < a) throw new Error(`Static UI markers are missing in ${file}`);
  await fs.writeFile(target, html.slice(0, a) + content + html.slice(b + end.length));
  console.log(`Updated static interface: ${file}`);
}