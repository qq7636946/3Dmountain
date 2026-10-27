/* Wordmark framing for index1-5 only, independent of the alternate page's refinements. */
module.exports = ({ main, drops, letters, glass, html }) => {
  if (typeof html === 'string' && !html.includes('data-wordmark-lowered')) html = html.replace('<html ', '<html data-wordmark-lowered ');
  if (!main.includes('/* wordmark-position-reference-20261025 */')) {
    const anchor = '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));';
    if (main.split(anchor).length !== 2) throw Error('wordmark position: defaults anchor');
    main = main.replace(anchor, () => "      /* wordmark-position-reference-20261025 */\n      if (document.documentElement.hasAttribute('data-wordmark-lowered') && innerWidth >= 760) {\n        // Lift the desktop wordmark 40 CSS pixels above the reference composition.\n        CONFIG.logoFraming.y = Math.round(innerHeight * .095) - 40;\n      }\n" + anchor);
  }
  return { main, drops, letters, glass, html };
};
