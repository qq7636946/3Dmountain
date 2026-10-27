/* Build-only adaptation: index1-5 retains the original canyon and camera path. */
module.exports = ({ main, journey }) => {
  const edit=(source,anchor,replacement)=>{
    if(source.split(anchor).length!==2)throw Error('index1-5 lightflow anchor: '+anchor.slice(0,95));
    return source.replace(anchor,replacement);
  };
  journey=edit(journey,"import { createCanyonWatershedBuilder }", "import { createFollowLightLines } from './follow-light-lines.js';\nimport { createCanyonWatershedBuilder }");
  journey=edit(journey,'  const pathLength = curve.getLength();',`  const pathLength = curve.getLength();
  const followLights = createFollowLightLines(THREE, { curve, widthAt, lite });
  scene.add(followLights.group);`);
  journey=edit(journey,'    sky.position.copy(camera.position);',`    sky.position.copy(camera.position);
    followLights.update(t, time, reduceMotion, u, camera, scene.fog.density, innerHeight);`);
  journey=edit(journey,'    watershed.group.removeFromParent();watershed.dispose();',`    followLights.dispose();
    watershed.group.removeFromParent();watershed.dispose();`);
  journey=edit(journey,'return { scene, camera, curve, widthAt, river, rivers:', 'return { scene, camera, curve, widthAt, river, followLights, rivers:');
  return { main, journey };
};
