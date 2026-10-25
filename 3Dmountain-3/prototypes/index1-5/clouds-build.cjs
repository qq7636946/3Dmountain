/* index1-5 only: mountain-height cloud banks on the original canyon route. */
module.exports=({journey})=>{
  const edit=(s,a,b)=>{if(s.split(a).length!==2)throw Error('index1-5 clouds anchor: '+a.slice(0,90));return s.replace(a,b);};
  journey=edit(journey,"import { createCanyonWatershedBuilder }", "import { createAlpineCloudBanks } from './alpine-cloud-banks.js';\nimport { createCanyonWatershedBuilder }");
  journey=edit(journey,'  scene.add(watershed.group);',`  scene.add(watershed.group);
  const alpineClouds=createAlpineCloudBanks(THREE,{lite,sampleHeight:watershed.sampleHeight});
  scene.add(alpineClouds.group);`);
  journey=edit(journey,'    sky.position.copy(camera.position);',`    sky.position.copy(camera.position);
    alpineClouds.update(u,time,reduceMotion);`);
  journey=edit(journey,'    watershed.group.removeFromParent();watershed.dispose();',`    alpineClouds.dispose();
    watershed.group.removeFromParent();watershed.dispose();`);
  journey=edit(journey,'return { scene, camera, curve, widthAt, river,', 'return { scene, camera, curve, widthAt, river, alpineClouds,');
  return {journey};
};
