/* index1-5: enter the valley by pushing along the existing view, without first
   tilting the opening scene down to centre the wordmark. Other page variants
   keep their camera move; the portal hand-off and zoom timing stay intact. */
module.exports = ({ main, drops, letters, glass, html }) => {
  if (typeof html === 'string' && !html.includes('data-direct-logo-zoom')) {
    html = html.replace('<html ', '<html data-direct-logo-zoom ');
  }
  const marker = '/* direct-logo-zoom-20261025 */';
  if (!main.includes(marker)) {
    const start = '        const aim = easeJourney(flight / .25);';
    const end = '        camera.fov = CONFIG.camera.fov + (innerWidth < 760 ? 8 : 0) + CONFIG.forwardTransition.fov * easeJourney(flight);';
    if (main.split(start).length !== 2 || main.split(end).length !== 2) {
      throw Error('direct logo zoom: camera anchors');
    }
    const from = main.indexOf(start), to = main.indexOf(end, from);
    if (to < from) throw Error('direct logo zoom: camera block order');
    const original = main.slice(from, to);
    const replacement = `        ${marker}
        if (document.documentElement.hasAttribute('data-direct-logo-zoom')) {
          // Translate eye and target together: pitch stays fixed from the first
          // frame, so enlargement starts without a separate vertical reframe.
          const dz = (CONFIG.drop.z + 1.25 - CONFIG.camera.z) * fly;
          const viewDepth = cameraLook.z - CONFIG.camera.z;
          const along = Math.abs(viewDepth) > .001 ? dz / viewDepth : 0;
          const dx = (cameraLook.x - CONFIG.camera.x) * along;
          const dy = (cameraLook.y - CONFIG.camera.y) * along;
          camera.position.set(
            CONFIG.camera.x + dx + pointerSoft.x * .18 * parallax,
            CONFIG.camera.y + dy - pointerSoft.y * .07 * parallax,
            CONFIG.camera.z + dz);
          camera.up.set(0, 1, 0);
          camera.lookAt(
            cameraLook.x + dx + pointerSoft.x * .08 * parallax,
            cameraLook.y + dy - pointerSoft.y * .04 * parallax,
            cameraLook.z + dz);
        } else {
${original.split('\n').filter(Boolean).map(line => '  ' + line).join('\n')}
        }
`;
    main = main.slice(0, from) + replacement + main.slice(to);
  }
  return { main, drops, letters, glass, html };
};
