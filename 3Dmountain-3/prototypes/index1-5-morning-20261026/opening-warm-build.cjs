/* index1-5 only: warm the dispersal before the first scroll (2026-10-24, defect list A-09).
   Measured on a cold page: the first scroll through the burst (journey ≈ .65–.69) drops one frame of 100–108 ms (one long task
   of ~110 ms). prepareJourney()'s warm group compiles and first-draws the LOGO drops, letters and glass but not the dispersal's
   beads (disperseMesh / disperseMaterial, hidden until the burst) nor the flash glow sprite (transitionGlow, hidden until the
   flash), so both compile on the frame they first show. Here they join the same warm group: the real geometry and material (the
   program is keyed on the material + the scene's lights, so it is the one the real frame asks for), one instance, drawn once in
   the 64 px off-screen target. Nothing of the real objects is disposed (only the one-instance wrapper). No dial, no visible change. */
module.exports = ({ main, drops, letters, glass, html }) => {
  const once = (source, anchor, replacement, label) => {
    const n = source.split(anchor).length - 1;
    if (n !== 1) throw new Error('index1-5 opening-warm anchor (' + label + '): ' + n + ' × ' + anchor.slice(0, 90));
    return source.replace(anchor, () => replacement);
  };
  const line = "          warmBeads.setMatrixAt(0, new THREE.Matrix4().makeTranslation(stage.x, stage.y, stage.z)); warmBeads.frustumCulled = false; warm.add(warmBeads);\n";
  main = once(main, line, line +
    "          /* the dispersal's beads and the flash glow: compiled and first drawn here, not on the frame the burst first shows them */\n" +
    "          const warmDisperse = new THREE.InstancedMesh(disperseMesh.geometry, disperseMaterial, 1);\n" +
    "          warmDisperse.setMatrixAt(0, new THREE.Matrix4().makeTranslation(stage.x, stage.y, stage.z)); warmDisperse.frustumCulled = false; warm.add(warmDisperse);\n" +
    "          const warmGlow = new THREE.Sprite(transitionGlow.material); warmGlow.position.copy(stage); warmGlow.scale.setScalar(.05); warmGlow.frustumCulled = false; warm.add(warmGlow);\n", 'warm group');
  main = once(main, "          } finally { wg.dispose(); warmBeads.dispose(); }\n",
    "          } finally { wg.dispose(); warmBeads.dispose(); warmDisperse.dispose(); }\n", 'dispose');
  return { main, drops, letters, glass, html };
};
