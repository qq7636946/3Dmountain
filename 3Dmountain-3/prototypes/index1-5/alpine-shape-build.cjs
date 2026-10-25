/* index1-5 only: ridge-aligned alpine drainage, baked into the existing lattice. */
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('index1-5 alpine shape anchor: '+a.slice(0,100));return s.replace(a,b);};
module.exports=({main,journey,watershed})=>{
  const preset=`      // Main spines, secondary buttresses, then short tributary folds.
      // River widths, first-person flight, logo and card handoff remain authored.
      Object.assign(CONFIG.watershedTerrain,{height:1.03,ridge:.95,relief:.96});
      Object.assign(CONFIG.relief,{lift:1.22,density:.90,peakRound:.26,crestSoft:.08,farSoft:.16,facet:.28,asym:.60,
        ridgeFine:.80,crestTame:.40,branching:1,gullySpan:370,erodibility:.80,slopeCap:1.15,valleyReach:1.05});
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`;
  main=once(main,'      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',preset);
  watershed=once(watershed,'      const a=Math.pow(Math.abs(along/p.length),2.6),near=p.z>-7000;',
    `      // Tapered summit groups avoid broad flat Gaussian mesas.
      const a=Math.pow(Math.abs(along/p.length),1.85),near=p.z>-7000;`);
  watershed=once(watershed,'      let crown=p.height*.80*Math.exp(-a*1.0-Math.pow(c,tent)*1.35);',
    `      let crown=p.height*.80*Math.exp(-a*1.0-Math.pow(c,tent)*1.35);
      // Passes run ALONG the spine; the far range keeps low, resolved notches.
      const crestWavelength=Math.max(p.radius*.66,spacing*7.5);
      const crestPhase=along*p.radius/crestWavelength;
      const notch=1-Math.abs(noise(crestPhase+17+p.bend,p.bend+7)*2-1);
      crown*=1-(near?.18:.10)*smooth(.15,.85,notch)*(1-smooth(.75,2.2,c));`);
  watershed=once(watershed,`      if(near&&facet>0){const rr=Math.hypot(along/p.length,spine/p.width);
        if(rr>.12&&rr<3)crown*=1-facet*Math.abs(Math.sin(.5*p.k*Math.atan2(spine,along)))*smooth(.12,.7,rr)*(1-smooth(1.8,3,rr));}`,
    `      if(near&&facet>0){
        // Each massif drains away from its OWN spine, not from a world-space
        // patch pattern or a star-shaped summit. The shorter channel bends off
        // the same parent phase, making buttresses that fork down the flank.
        // No additional noise lookup; these are smooth analytic envelopes.
        const rr=Math.hypot(along/p.length,spine/p.width),fall=Math.abs(spine/p.width);
        if(rr>.10&&rr<3){
          const phase=along*3.3+p.bend+.58*Math.sin(fall*1.9+p.bend);
          const trunk=Math.pow(.5+.5*Math.cos(phase),4);
          const branch=Math.pow(.5+.5*Math.cos(phase*1.93+fall*1.65+p.bend),5);
          const cut=(trunk*.78+branch*.38)*smooth(.10,.55,fall)*(1-smooth(1.65,3,rr));
          crown*=1-facet*cut;
        }
      }`);
  watershed=once(watershed,'    let sum=0,amp=1,weight=1,f=1/820,px=x,pz=z;',
    '    let sum=0,amp=1,weight=1,f=1/960,px=x,pz=z;');
  watershed=once(watershed,'  const ridgeShare=(rid,mass)=>(rid-.42)*(mass<520?mass:520+(mass-520)*crestTame)*.42*smooth(90,520,mass);',
    `  // Keep resolved middle-distance folds. Only the coarse peripheral / far
  // lattice attenuates high summit detail, so suppressing the far needle does
  // not round off the mountain bodies that carry the aerial composition.
  const ridgeShare=(rid,mass,spacing=24)=>{
    const distant=smooth(40,120,spacing);
    const tame=lerp(crestTame,Math.min(.22,crestTame),distant);
    return (rid-.42)*(mass<520?mass:520+(mass-520)*tame)*lerp(.42,.30,distant)*smooth(90,520,mass);
  };`);
  watershed=once(watershed,'    return {mass,rid,h:mass*.86+ridgeShare(rid,mass)};',
    '    return {mass,rid,h:mass*.86+ridgeShare(rid,mass,spacing)};');
  watershed=once(watershed,'    const strata=Math.sin(m.mass*.026+wx*.0046+wz*.0022+(noise(wx*.003,wz*.003)-.5)*2.1);',
    `    // Continuous world-locked weathering replaces horizontal contour rings.
    const strata=(noise(wx*.0032+11,wz*.0030-4)-.5)*1.4;`);
  watershed=once(watershed,'      rid:ridgeShare(m.rid,m.mass),ero:(ero-.2)*gullyDepth,groove:clamp(.5-ero*.5)*smooth(.10,.55,slope)*smooth(70,260,m.mass),gx:hx,gz:hz,slope,eroRaw:ero,macroMass:m.mass};',
    `      // Stronger negative channels preserve intervening narrow buttresses;
      // a restrained positive shoulder keeps erosion from flattening the body.
      rid:ridgeShare(m.rid,m.mass,gridSpacingAt(x,z)),ero:(ero-.2)*((ero<.2)?1.08:.72)*gullyDepth,groove:clamp(.5-ero*.5)*smooth(.10,.55,slope)*smooth(70,260,m.mass),gx:hx,gz:hz,slope,eroRaw:ero,macroMass:m.mass};`);
  journey=once(journey,'    y += (terrace - y) * (relief ? .20 + .30 * noise(x * .018 + 5, z * .018) : .42) * smooth(10, 26, distance) * (1 - smooth(190, 250, distance));',
    `    const terraceDelta = (terrace - y) * (relief ? .20 + .30 * noise(x * .018 + 5, z * .018) : .42) * smooth(10, 26, distance) * (1 - smooth(190, 250, distance));
    y += terraceDelta;
    // Preserve all bank frequencies and the wet edge. Only a little of the
    // periodic shelf is eased out above the cliff foot; the 2.5-unit cap keeps
    // the existing bank / watershed support weld from opening a dark crevice.
    const alpineBank=relief?smooth(65,145,distance)*.30:0;
    y-=THREE.MathUtils.clamp((shelf*f.outlet+terraceDelta)*alpineBank,-2.5,2.5);`);
  return {main,journey,watershed};
};
