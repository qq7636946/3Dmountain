/* index1-5: directional alpine daylight, separate cloud banks carry the mist. */
module.exports=({main,journey})=>{
 const edit=(s,a,b)=>{if(s.split(a).length!==2)throw Error('index1-5 alpine light anchor '+a);return s.replace(a,b);};
 main=edit(main,'      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',`      Object.assign(CONFIG.watershedStyle,{skyColor:'#536c84',mistColor:'#a8b5c0',haze:.78});
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
 journey=edit(journey,'sunlight.position.set(-4750,6500,-7450);','sunlight.position.set(-5600,6800,-6200);');
 journey=edit(journey,"const dayZenith=new THREE.Color('#779abf')","const dayZenith=new THREE.Color('#61798f')");
 journey=edit(journey,"const dayHorizon=new THREE.Color('#d4dee5')","const dayHorizon=new THREE.Color('#aebdc8')");
 journey=edit(journey,"const dayFog=new THREE.Color('#b5c7d7')","const dayFog=new THREE.Color('#a8b5c0')");
 journey=edit(journey,"const daySun=new THREE.Color('#ffead0')","const daySun=new THREE.Color('#f4eee4')");
 journey=edit(journey,"const iceSun=new THREE.Color('#e8edf1')","const iceSun=new THREE.Color('#eeeff0')");
 journey=edit(journey,'scene.fog.density=THREE.MathUtils.lerp(.00172,.42/fitDistance,smoother(u/.80));','scene.fog.density=Math.min(THREE.MathUtils.lerp(.00105,.27/fitDistance,smoother(u/.80)),.52/Math.max(500,camera.position.y*3.2));');
 journey=edit(journey,'hemisphere.intensity=THREE.MathUtils.lerp(2.3,watershedStyle?.62:.35,mountainLight);','hemisphere.intensity=THREE.MathUtils.lerp(1.35,watershedStyle?.80:.35,mountainLight);');
 journey=edit(journey,'sunlight.intensity=THREE.MathUtils.lerp(2.65,watershedStyle?2.25:2.0,mountainLight);','sunlight.intensity=THREE.MathUtils.lerp(2.85,watershedStyle?2.70:2.0,mountainLight);');
 journey=edit(journey,'rim.intensity=THREE.MathUtils.lerp(1.4,watershedStyle?.72:.48,mountainLight);','rim.intensity=THREE.MathUtils.lerp(.55,watershedStyle?.38:.48,mountainLight);');
 return {main,journey};
};
