/* Local to index1-5 (2026-11-01). Titles: links title-water.css, whose dials are its variables.
   Chosen on the board in .qa/index1-5/title-team. Delete the link to undo. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
module.exports = state => {
  const css = fs.readFileSync(path.join(__dirname, 'title-water.css'));
  const link = '<link rel="stylesheet" data-title-water href="prototypes/index1-5/title-water.css?v=' + crypto.createHash('md5').update(css).digest('hex').slice(0, 10) + '">';
  let html = state.html;
  if (html.includes('data-title-water')) html = html.replace(/<link[^>]*data-title-water[^>]*>/, () => link);
  else html = html.replace('</head>', () => '  ' + link + '\n</head>');
  /* Montserrat for the titles, from Google like the page's Noto Sans TC. A link, not an @import in the stylesheet: an @import would hold up the stylesheet. If it fails, the titles fall back to DM Sans and still fit. */
  const font = '<link rel="stylesheet" data-title-font href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600&display=swap">';
  if (html.includes('data-title-font')) html = html.replace(/<link[^>]*data-title-font[^>]*>/, () => font);
  else html = html.replace(/(\s*)<link[^>]*data-title-water[^>]*>/, (m, gap) => gap + font + m);
  return { ...state, html };
};
