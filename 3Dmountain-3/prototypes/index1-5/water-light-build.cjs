/* Local to index1-5 (2026-11-02). The interface takes the closing LOGO's water light: links water-light.css, last of all so it reads after every other sheet, and water-light.js. Runs last in build.cjs. Delete both tags and this helper's line in build.cjs to undo. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const stamp = file => crypto.createHash('md5').update(fs.readFileSync(path.join(__dirname, file))).digest('hex').slice(0, 10);
module.exports = state => {
  const link = '<link rel="stylesheet" data-water-light href="prototypes/index1-5/water-light.css?v=' + stamp('water-light.css') + '">';
  const script = '<script defer data-water-light-js src="prototypes/index1-5/water-light.js?v=' + stamp('water-light.js') + '"></script>';
  const html = state.html.replace(/[ \t]*<link[^>]*data-water-light[^>]*>\n?/, '').replace(/[ \t]*<script[^>]*data-water-light-js[^>]*><\/script>\n?/, '').replace('</head>', () => '  ' + link + '\n  ' + script + '\n</head>');
  return { ...state, html };
};
