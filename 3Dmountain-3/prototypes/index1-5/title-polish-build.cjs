/* Local to index1-5 (2026-11-04, client: 「index1-5-flow.html 體改成 index1-5.html」, then 「大標部分」). The big titles of the flow test page:
   white Oswald, a little larger, no cyan glow or sweep (title-polish.css), and their letter-by-letter reveal (title-motion.css + title-motion.js).
   Copied from prototypes/index1-5-flow/; nothing else of that page comes with them. Runs last in build.cjs, so the links sit after title-water.css,
   typography.css and the rest, as on the flow page. Undo: drop the call in build.cjs and the three tags it wrote. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const stamp = file => crypto.createHash('md5').update(fs.readFileSync(path.join(__dirname, file))).digest('hex').slice(0, 10);
module.exports = ({ html }) => {
  const tags = [
    ['data-title-polish', '<link rel="stylesheet" data-title-polish href="prototypes/index1-5/title-polish.css?v=' + stamp('title-polish.css') + '">'],
    ['data-title-motion', '<link rel="stylesheet" data-title-motion href="prototypes/index1-5/title-motion.css?v=' + stamp('title-motion.css') + '">'],
    ['data-title-motion-js', '<script defer data-title-motion-js src="prototypes/index1-5/title-motion.js?v=' + stamp('title-motion.js') + '"></script>']
  ];
  for (const [attr, tag] of tags) {
    const re = new RegExp('<(?:link|script)[^>]*\\s' + attr + '[\\s>][^>]*>(?:</script>)?|<(?:link|script)[^>]*\\s' + attr + '>(?:</script>)?');
    if (re.test(html)) html = html.replace(re, () => tag);
    else html = html.replace('</head>', () => '  ' + tag + '\n</head>');
  }
  return { html };
};
