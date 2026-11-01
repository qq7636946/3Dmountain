/* Local to index1-5 (2026-11-01). Every button in white frosted glass: links button-glass.css, whose dials are its variables, and button-glass.js, which builds the label roll and the arrow chip and moves the light. Delete both tags and this helper's name in build.cjs to undo. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const stamp = file => crypto.createHash('md5').update(fs.readFileSync(path.join(__dirname, file))).digest('hex').slice(0, 10);
module.exports = state => {
  const link = '<link rel="stylesheet" data-button-glass href="prototypes/index1-5/button-glass.css?v=' + stamp('button-glass.css') + '">';
  const script = '<script defer data-button-glass-js src="prototypes/index1-5/button-glass.js?v=' + stamp('button-glass.js') + '"></script>';
  let html = state.html;
  if (html.includes('data-button-glass href')) html = html.replace(/<link[^>]*data-button-glass[^>]*>/, () => link);
  else html = html.replace('</head>', () => '  ' + link + '\n</head>');
  if (html.includes('data-button-glass-js')) html = html.replace(/<script[^>]*data-button-glass-js[^>]*><\/script>/, () => script);
  else html = html.replace('</head>', () => '  ' + script + '\n</head>');
  return { ...state, html };
};
