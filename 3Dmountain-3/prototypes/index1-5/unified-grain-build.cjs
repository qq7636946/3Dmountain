/* Keep one film layer after all per-scene uniform updates. */
module.exports=({main,drops,letters,glass,html})=>{
 const anchor="        renderFrame++;",gate="        /* UNIFIED_FILM_GRAIN: one shared layer, after all per-scene uniform updates. */\n        if (document.documentElement.dataset.grain === 'unified') grainPass.uniforms.uAmount.value = 0;\n        renderFrame++;";
 if(!main.includes('/* UNIFIED_FILM_GRAIN:')){if(main.split(anchor).length!==2)throw Error('unified grain frame anchor');main=main.replace(anchor,()=>gate);}
 return {main,drops,letters,glass,html};
};
