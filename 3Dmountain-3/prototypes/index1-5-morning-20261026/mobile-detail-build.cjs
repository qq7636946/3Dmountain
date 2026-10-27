/* Keep the canonical index1-5 detail budgets when regenerating local modules.
   Existing detail builders also read these sources; this final hook prevents
   an older extra entry from replacing their mobile allocation/shader caps. */
const fs = require('fs'), path = require('path');
const files = ['light-specks.js', 'opening-lunge-blur.js'];
module.exports = state => ({ ...state, extra: {
  ...state.extra,
  ...Object.fromEntries(files.map(file => [file, fs.readFileSync(path.join(__dirname, file), 'utf8')]))
} });
