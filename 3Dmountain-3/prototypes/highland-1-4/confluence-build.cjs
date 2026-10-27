const fs=require('fs'),path=require('path');
module.exports=function(main){
 const patch=(a,b)=>{if(!main.includes(a))throw Error('confluence anchor missing: '+a.slice(0,90));main=main.replace(a,b)};
 patch('    const HL_SUNNY =',`    const HL_CONFLUENCE = !['sunny','overcast'].includes(new URLSearchParams(location.search).get('look'));
    document.documentElement.toggleAttribute('data-hl-confluence', HL_CONFLUENCE);
    const HL_SUNNY =`);
 patch('      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',`      if(HL_CONFLUENCE){
        Object.assign(CONFIG.field,{zenith:'#a4b9c8',upper:'#c5d4dc',top:'#315777',horizon:'#bdced8',lower:'#7894a6',floor:'#2c4d65',ink:'#20374c',core:.65,coreSpread:1,bandGain:.035});
        Object.assign(CONFIG.grade,{hue:0,sat:1.01,temp:.10,tint:0});
        Object.assign(CONFIG.drop,{iris:.035,roughness:.022,contour:.12,rim:.24,streak:1.05,lens:.16});
        Object.assign(CONFIG.droplet,{sheen:.55});
        Object.assign(CONFIG.chrome,{iris:.025,rough:.032,aniso:.35,streak:.95});
        // Restore index1-1's five-wave swell and its matched ripple dispersion.
        // The slate palette is independent of the wave clock and wave heights.
        Object.assign(CONFIG.sea,{swell:3.5,calm:.42,detail:1.8,texture:2,filament:.6,foam:.75,spray:.9,timeScale:.85});
        Object.assign(CONFIG.ripple,{speed:1.05,ambientSpeed:1,strength:1,damping:.86});
        // Broader surface-tension breathing at the reference's .60 pace. The
        // reference frequencies and transition timing keep the liquid coherent.
        Object.assign(CONFIG.distortion,{waveMorph:.85,amount:.72,waveAmplitude:.075,waveFrequency:1.15,waveSpeed:.60,twist:.055,twistFrequency:3.6,breathing:.038});
        Object.assign(CONFIG.logoDrops,{swirlGloss:.66,swirlGlow:.30,swirlRing:.38,swirlCaustic:.42,glow:.30,rim:.34,haze:.26});
        Object.assign(CONFIG.mist,{push:.12,fog:3.2});
        CONFIG.scene.grain=.010;
      }
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
 patch("paletteLinear('#1d5d76')", "paletteLinear(HL_CONFLUENCE ? '#233f54' : '#1d5d76')");
 patch("paletteLinear('#4b95ad')", "paletteLinear(HL_CONFLUENCE ? '#64889d' : '#4b95ad')");
 patch("paletteLinear(HL_SUNNY ? '#284f5c' : '#22334c')","paletteLinear('#22334c')");
 patch('HL_SUNNY ? new THREE.Vector3(1.04, 1.02, .97) : new THREE.Vector3(1.00, 1.03, 1.10)','new THREE.Vector3(1.00, 1.03, 1.10)');
 patch('new THREE.Vector4(HL_SUNNY ? 1 : 0, .046, 0, 0)','new THREE.Vector4(HL_SUNNY && !HL_CONFLUENCE ? 1 : 0, .046, 0, 0)');
 patch('J.max = 13.8 + journeyShift();','J.max = (HL_CONFLUENCE ? 8.96 : 13.8) + journeyShift();');
 patch('const journeyBaseStops = [.52, 1.12, 2.12, 2.96, 4.8, 6.9, 8.95, 10.18, 10.99, 11.71, 12.43, 13.22, 13.8];','const journeyBaseStops = HL_CONFLUENCE ? [.52,1.12,2.12,2.96,4.8,6.9,8.96] : [.52,1.12,2.12,2.96,4.8,6.9,8.95,10.18,10.99,11.71,12.43,13.22,13.8];');
 patch('skipEntry(); journey.velocity = 0; journey.target = THREE.MathUtils.clamp(p, 0, journey.max);',`skipEntry(); journey.velocity = 0; journey.target = THREE.MathUtils.clamp(p, 0, journey.max);
          portfolioNavPending = HL_CONFLUENCE && p>journey.max; if(portfolioNavPending) void loadPortfolio();`);
 patch('      const journeyUI = mountJourneyInterface({','      let portfolioNavPending = false;\n      const journeyUI = mountJourneyInterface({');
 patch('journey.lastInput = performance.now(); if (world?.take(delta, source))', 'if(delta !== 0) portfolioNavPending = false; journey.lastInput = performance.now(); if (world?.take(delta, source))');
 patch('if (!portfolioJob && CONFIG.portfolio.on > .5 && journeyReady && p > J.max - 3.2) loadPortfolio();',`if (!portfolioJob && CONFIG.portfolio.on > .5 && journeyReady && p > J.max - 3.2) loadPortfolio();
        if(portfolioNavPending){
          if(J.target<J.max-.001 || portfolio?.open || sceneStopped) portfolioNavPending=false;
          else if(journeyReady && portfolio?.ready && J.progress>J.max-.08 && !journeyUI.menuOpen){
            portfolioNavPending=false;
            const m=CONFIG.mist||{}, steps=+m.steps, unit=100/Math.max(720,innerHeight*.85);
            const distance=Number.isFinite(steps)&&steps>=2?steps*unit:Number.isFinite(+m.length)&&+m.length>.2?+m.length:1.3;
            portfolio.take(portfolio.bridge?distance:.4);
          }
        }`);
 // Keep first-load framing clean, explicit editor switches still work.
 patch('const lettersWanted = !lettersOff && (lettersFlag !== null || /^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname));','const lettersWanted = !lettersOff && (lettersFlag !== null || !HL_CONFLUENCE && /^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname));');
 patch("if (worldEpilogue && !/^(0|false|off)$/i.test(gradeFlag ?? '')", "if (worldEpilogue && (!HL_CONFLUENCE || gradeFlag !== null) && !/^(0|false|off)$/i.test(gradeFlag ?? '')");
 // Do not apply old saved sunny grading to the new art direction unless the editor is requested.
 main=main.replace("if (lookFlag !== null || /^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname))", "if (lookFlag !== null || !HL_CONFLUENCE && /^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname))");
 // Dedicated interface: existing Strategies link opens cards at the new end; other pages unchanged.
 const original=path.resolve(__dirname,'../../js/finnovation-interface.js');let ui=fs.readFileSync(original,'utf8').replace('./water-journey-story.js','../../../js/water-journey-story.js');
 ui=ui.replace("nextLabel.textContent=id==='derivatives'?'BACK TO START':index===5?'NEXT STRATEGY':'NEXT CHAPTER';", "nextLabel.textContent=(document.documentElement.hasAttribute('data-hl-confluence')&&index===4)?'EXPLORE STRATEGIES':id==='derivatives'?'BACK TO START':index===5?'NEXT STRATEGY':'NEXT CHAPTER';");
 ui=ui.replace('EXPLORE WITH PURPOSE</span>', 'EXPLORE WITH PURPOSE<br><a class="fi-terrain-credit" href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain: Mapzen / USGS</a></span>');
 fs.writeFileSync(path.join(__dirname,'js/finnovation-interface.js'),ui);
 main=main.replace(/from '\.\.\/\.\.\/\.\.\/js\/finnovation-interface.js\?[^']+'/,"from './finnovation-interface.js?v=confluence1'");
 return require('./alpine-water-build.cjs')(main);
};
