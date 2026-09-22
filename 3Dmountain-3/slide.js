/* Independent WebGL study of the supplied Trionn recording.
   Source artwork / crop provenance: slide-assets/SOURCES.md. */
(() => {
  'use strict';
  const projects = [
    { file:'loose-sketches.jpg', name:'Loose Sketches' },
    { file:'imagination.jpg', name:'Imagination' },
    { file:'swank-flat.jpg', name:'SWANK' },
    { file:'watch-reference.jpg', name:'DFZ Watch' },
    { file:'style-reference.jpg', name:'Style — 2026' },
    { file:'novaglam.jpg', name:'Novaglam' },
    { file:'headphones.jpg', name:'Every Note' },
    { file:'editorial.jpg', name:'Selected Work' }
  ];
  const $ = id => document.getElementById(id);
  const canvas=$('scene'),progress=$('progress'),wordOne=document.querySelector('.line-one'),wordTwo=document.querySelector('.line-two');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const config={duration:9.4,radius:4.5,camera:10.6,focal:2.75,gap:.04,subdivisions:48,pathStep:.74,pitch:.74,wave:.12,tailTaper:.22,tailDepth:1.9};
  // Tail → head. The strip is finite: neither its position nor its height wraps.
  // The grid keeps the original project order independently of the flying strip.
  const stripOrder=[0,1,3,7,2,5,4,6];
  const stripSlots=projects.map((_,index)=>stripOrder.indexOf(index));
  const state={progress:0,target:0,playing:!reducedMotion.matches,spin:0,spinTarget:0,drag:false,ready:false,grid:false,lost:false,gridScroll:0};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  const out=t=>1-Math.pow(1-clamp(t),3);
  let gl,program,buffer,loc={},textures=[],loaded=0,width=1,height=1,aspect=1;
  let vertexCount=0,lastTime=0,pointerX=0,pointerY=0,resumeAfterVisibility=false;
  const pauseIcon='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1h3v10H2zm5 0h3v10H7z"/></svg>';
  const playIcon='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2 1 9 5-9 5z"/></svg>';
  function controls(){
    $('play').innerHTML=state.playing?pauseIcon:playIcon;
    $('play').setAttribute('aria-label',state.playing?'暫停動畫':'播放動畫');
    $('grid').setAttribute('aria-pressed',String(state.grid));
    $('orbit').setAttribute('aria-pressed',String(!state.grid));
    $('menu').setAttribute('aria-pressed',String(state.grid));
  }
  function play(value){state.playing=value;controls();}
  function setProgress(value){state.target=clamp(value);play(false);}
  function replay(){Object.assign(state,{target:0,progress:0,spinTarget:0,spin:0,grid:false,gridScroll:0});play(true);}
  function setView(grid){state.grid=grid;state.gridScroll=0;setProgress(grid?1:.33);controls();}
  const vertexSource=[
    'precision highp float;',
    'attribute vec2 aUV;',
    'uniform float uAngle,uMorph,uFlatten,uRadius,uArc,uHeight,uTiltX,uTiltZ,uCenterX,uCenterY,uScale;',
    'uniform float uPitch,uWave,uRadiusSlope,uDepthBias,uDepthSlope;',
    'uniform float uAspect,uFocal,uCamera,uGridWidth,uGridHeight,uLift,uBend;',
    'uniform vec3 uGridCenter;',
    'varying vec2 vUV; varying float vDepth;',
    'vec3 rotY(vec3 p,float a){return vec3(cos(a)*p.x+sin(a)*p.z,p.y,-sin(a)*p.x+cos(a)*p.z);}',
    'vec3 rotX(vec3 p,float a){return vec3(p.x,cos(a)*p.y-sin(a)*p.z,sin(a)*p.y+cos(a)*p.z);}',
    'vec3 rotZ(vec3 p,float a){return vec3(cos(a)*p.x-sin(a)*p.y,sin(a)*p.x+cos(a)*p.y,p.z);}',
    'float pathY(float a){return -uPitch*a+uWave*sin(a*1.6);}',
    'void main(){',
    ' vUV=vec2(aUV.x,1.0-aUV.y); float m=uMorph,f=uFlatten;',
    ' float angle=(aUV.x-.5)*uArc;',
    ' float radius=uRadius+uRadiusSlope*angle;',
    ' vec3 local=vec3(sin(angle)*radius,(aUV.y-.5)*uHeight+pathY(uAngle+angle)-pathY(uAngle),cos(angle)*radius-uRadius);',
    ' local.x=mix(local.x,(aUV.x-.5)*uGridWidth,f);',
    ' local.y=mix(local.y,(aUV.y-.5)*uGridHeight,f); local.z*=1.0-f;',
    ' float shortest=mod(uAngle+3.14159265,6.2831853)-3.14159265;',
    ' local=rotY(local,shortest*(1.0-m));',
    ' local.z+=uDepthSlope*angle*(1.0-f);',
    ' local=rotZ(rotX(local,uTiltX*(1.0-m)),uTiltZ*(1.0-m));',
    ' vec3 center=vec3(sin(uAngle)*uRadius,pathY(uAngle),cos(uAngle)*uRadius+uDepthBias);',
    ' center=rotZ(rotX(center,uTiltX),uTiltZ)*uScale; center+=vec3(uCenterX,uCenterY,0.0);',
    ' local*=mix(uScale,1.0,f);',
    ' vec3 control=mix(center,uGridCenter,.45)+vec3(sin(uAngle+1.5707963)*.65,uLift,0.0);',
    ' center=(1.0-m)*(1.0-m)*center+2.0*(1.0-m)*m*control+m*m*uGridCenter;',
    ' local.z+=sin(aUV.x*3.14159265)*sin(aUV.y*3.14159265)*uBend*(1.0-m);',
    ' vec3 p=center+local; float depth=uCamera-p.z; vDepth=depth;',
    ' gl_Position=vec4(p.x*uFocal/uAspect,p.y*uFocal,depth*1.00501253-.20050125,depth);',
    '}'
  ].join('\n');
  const fragmentSource=[
    'precision mediump float;',
    'uniform sampler2D uTexture; uniform vec2 uImageRatio; uniform float uAlpha;',
    'varying vec2 vUV; varying float vDepth;',
    'void main(){',
    ' vec2 faceUV=vec2(gl_FrontFacing?vUV.x:1.0-vUV.x,vUV.y);',
    ' vec2 uv=(faceUV-.5)*uImageRatio+.5;',
    ' vec4 color=texture2D(uTexture,uv);',
    ' float light=1.0-clamp((vDepth-11.0)*.004,0.0,.035);',
    ' gl_FragColor=vec4(color.rgb*light,uAlpha);',
    '}'
  ].join('\n');
  function shader(type,source){
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(message);}
    return s;
  }
  function initGL(){
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'high-performance',premultipliedAlpha:false});
    if(!gl)throw new Error('您的瀏覽器未提供 WebGL。請使用支援硬體加速的瀏覽器查看 3D 動畫。');
    program=gl.createProgram();
    const vert=shader(gl.VERTEX_SHADER,vertexSource),frag=shader(gl.FRAGMENT_SHADER,fragmentSource);
    gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);gl.deleteShader(vert);gl.deleteShader(frag);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const points=[],nx=config.subdivisions,ny=4;
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const a=x/nx,b=(x+1)/nx,c=y/ny,d=(y+1)/ny;points.push(a,c,b,c,a,d,b,c,b,d,a,d);
    }
    vertexCount=points.length/2;buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
    const attribute=gl.getAttribLocation(program,'aUV');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    ['Angle','Morph','Flatten','Radius','RadiusSlope','DepthBias','DepthSlope','Arc','Height','TiltX','TiltZ','CenterX','CenterY','Scale','Pitch','Wave','Aspect','Focal','Camera','GridWidth','GridHeight','Lift','Bend','Alpha'].forEach(name=>loc[name]=gl.getUniformLocation(program,'u'+name));
    loc.GridCenter=gl.getUniformLocation(program,'uGridCenter');loc.ImageRatio=gl.getUniformLocation(program,'uImageRatio');
    gl.uniform1i(gl.getUniformLocation(program,'uTexture'),0);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);resize();
  }
  function resize(){
    width=innerWidth;height=innerHeight;aspect=width/height;
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    if(gl)gl.viewport(0,0,canvas.width,canvas.height);
  }
  function makeTexture(image){
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    const ext=gl.getExtension('EXT_texture_filter_anisotropic');
    if(ext)gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return {texture,aspect:image.width/image.height};
  }
  function loadImages(){
    return Promise.all(projects.map((project,index)=>new Promise(resolve=>{
      const image=new Image();image.decoding='async';
      image.onload=()=>{textures[index]=makeTexture(image);loaded++;$('load-count').textContent=Math.round(loaded/projects.length*100);resolve();};
      image.onerror=()=>{
        const substitute=document.createElement('canvas');substitute.width=720;substitute.height=500;
        const ctx=substitute.getContext('2d');ctx.fillStyle=['#edf2ee','#b8ada4','#4e2420','#d8d8d6','#e6eae5','#d896b5','#9eaeb0','#dfded6'][index];ctx.fillRect(0,0,720,500);
        ctx.fillStyle=index===2?'#f4f1eb':'#242622';ctx.font='48px Arial';ctx.fillText(project.name.toUpperCase(),35,260);
        textures[index]=makeTexture(substitute);loaded++;$('load-count').textContent=Math.round(loaded/projects.length*100);console.warn('Artwork unavailable:',project.file);resolve();
      };
      image.src='./slide-assets/'+project.file;
    })));
  }
  function uniform(name,value){gl.uniform1f(loc[name],value);}
  // Translate along an unwrapped helix, rather than rotating a closed cylinder.
  // The pitch separates front and rear runs; perspective does the near/far sizing.
  function choreography(p){
    const entry=out(p/.17),exit=smooth(.42,.64,p);
    return {
      x:exit*1.7,
      y:mix(-1.45,-.10,entry)+exit*2.45,
      spin:3.40-Math.min(p,.68)*14.4+state.spin,
      tiltX:.07,
      tiltZ:mix(-.055,-.095,entry)-exit*.065,
      scale:mix(.64,1,entry)*(1-exit*.83)
    };
  }
  function pathPoint(angle,radius=config.radius){
    return [Math.sin(angle)*radius,-config.pitch*angle+config.wave*Math.sin(angle*1.6),Math.cos(angle)*radius];
  }
  function stripRadius(slot){
    return config.radius*mix(1-config.tailTaper,1,slot/(projects.length-1));
  }
  const delays=[0,.20,.75,1.35,1.85,2.40],durations=[.65,.80,.95,.95,1.05,1.15];
  function draw(p){
    if(!gl||state.lost||textures.length!==projects.length)return;
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const mobile=width<700,arc=config.pathStep*(1-config.gap);
    uniform('Arc',arc);
    uniform('RadiusSlope',config.radius*config.tailTaper/((projects.length-1)*config.pathStep));
    uniform('DepthSlope',config.tailDepth/((projects.length-1)*config.pathStep));
    uniform('Pitch',config.pitch);uniform('Wave',config.wave);
    uniform('Aspect',aspect);uniform('Focal',config.focal);uniform('Camera',config.camera);
    const cols=mobile?2:3,screenCardWidth=mobile?.408:.25,screenGap=mobile?.035:.018;
    const gridWidth=screenCardWidth*2*config.camera/config.focal*aspect,gridHeight=gridWidth/1.46;
    const gap=screenGap*2*config.camera/config.focal*aspect,rowStep=gridHeight+(mobile?.18:.18);
    uniform('GridWidth',gridWidth);uniform('GridHeight',gridHeight);
    const gridTopWorld=(1-(mobile?.25:.35)*2)*config.camera/config.focal;
    for(let i=0;i<projects.length;i++){
      const radius=stripRadius(stripSlots[i]);
      uniform('Radius',radius);uniform('Height',radius*arc/1.46);
      uniform('DepthBias',-config.tailDepth*(1-stripSlots[i]/(projects.length-1)));
      const start=(5.35+(delays[i]||0))/config.duration;
      const local=clamp((p-start)*config.duration/(durations[i]||1));
      const m=i<6?out(local):0;
      const f=smooth(.07,.82,local);
      // Each card leaves its own point on the open helix; no modulo on path travel.
      const motion=choreography(i<6?Math.min(p,start):p);
      const scale=motion.scale*(mobile?.48:Math.min(1.15,aspect/1.59));
      uniform('TiltX',motion.tiltX);uniform('TiltZ',motion.tiltZ);uniform('CenterX',motion.x);uniform('CenterY',motion.y);uniform('Scale',scale);
      const col=i%cols,row=Math.floor(i/cols);
      let gx=(col-(cols-1)/2)*(gridWidth+gap),gy=gridTopWorld-row*rowStep+state.gridScroll;
      if(!mobile&&i===5){gx+=gridWidth*.20;gy-=gridHeight*.20;}
      uniform('Angle',(stripSlots[i]-(projects.length-1)/2)*config.pathStep+motion.spin);
      uniform('Morph',m);uniform('Flatten',i<6?f:0);
      uniform('Lift',i<3?.6:-.9);
      uniform('Bend',Math.min(.14,Math.abs(state.spinTarget-state.spin)*.3));
      const alpha=i<6?1:1-smooth(.60,.72,p);if(alpha<.002)continue;
      uniform('Alpha',alpha);gl.uniform3f(loc.GridCenter,gx,gy,0);
      const sourceAspect=textures[i].aspect;gl.uniform2f(loc.ImageRatio,Math.min(1,1.46/sourceAspect),Math.min(1,sourceAspect/1.46));
      gl.bindTexture(gl.TEXTURE_2D,textures[i].texture);gl.drawArrays(gl.TRIANGLES,0,vertexCount);
    }
    const spread=smooth(.10,.45,p);
    wordOne.style.transform='translateX('+(spread*width*.58)+'px)';
    wordTwo.style.transform='translateX('+(-spread*width*.58)+'px)';
    $('headline').style.opacity=String(1-smooth(.60,.73,p));
    $('hint').style.opacity=p>.16?'0':'.48';
    progress.value=Math.round(p*1000);progress.style.setProperty('--progress',(p*100)+'%');
    const gridNow=p>.78;if(gridNow!==state.grid){state.grid=gridNow;controls();}
  }
  function frame(time){
    const dt=Math.min((time-lastTime)/1000||0,.05);lastTime=time;
    if(state.ready&&!document.hidden){
      if(state.playing&&!state.drag){state.target=clamp(state.target+dt/config.duration);if(state.target>=1)play(false);}
      state.progress=mix(state.progress,state.target,1-Math.exp(-dt*9));
      state.spin=mix(state.spin,state.spinTarget,1-Math.exp(-dt*8));
      if(Math.abs(state.progress-state.target)<.00001)state.progress=state.target;
      draw(state.progress);
    }
    requestAnimationFrame(frame);
  }
  $('play').addEventListener('click',()=>{if(state.target>.998)replay();else play(!state.playing);});
  $('replay').addEventListener('click',replay);$('reset').addEventListener('click',replay);
  $('explore').addEventListener('click',()=>{if(state.target>.78)replay();else play(true);});
  $('menu').addEventListener('click',()=>setView(!state.grid));
  $('orbit').addEventListener('click',()=>setView(false));$('grid').addEventListener('click',()=>setView(true));
  progress.addEventListener('input',()=>{state.gridScroll=0;setProgress(Number(progress.value)/1000);});
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();play(false);
    const amount=event.deltaMode===1?event.deltaY*16:event.deltaMode===2?event.deltaY*height:event.deltaY;
    if((state.target>=.999&&amount>0)||state.gridScroll>0){
      state.gridScroll=clamp(state.gridScroll+amount*.004,0,width<700?2.5:0);
    }else{state.target=clamp(state.target+amount*.00028);state.spinTarget=clamp(state.spinTarget+event.deltaX*.001,-2.8,2.8);}
  },{passive:false});
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;state.drag=true;pointerX=event.clientX;pointerY=event.clientY;play(false);canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!state.drag)return;
    const dx=event.clientX-pointerX,dy=event.clientY-pointerY;pointerX=event.clientX;pointerY=event.clientY;
      if(state.target<.78){state.spinTarget=clamp(state.spinTarget+dx*.007,-2.8,2.8);state.target=clamp(state.target-dy/height*.5);}
    else state.gridScroll=clamp(state.gridScroll-dy*.012,0,width<700?2.5:0);
  });
  const release=()=>{state.drag=false;};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  addEventListener('keydown',event=>{
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLButtonElement)return;
    if(event.code==='Space'){event.preventDefault();if(state.target>=.999)replay();else play(!state.playing);}
    else if(event.key==='ArrowDown'||event.key==='PageDown'){event.preventDefault();setProgress(state.target+.06);}
    else if(event.key==='ArrowUp'||event.key==='PageUp'){event.preventDefault();state.gridScroll=0;setProgress(state.target-.06);}
    else if(event.key==='ArrowRight'){event.preventDefault();play(false);state.spinTarget=clamp(state.spinTarget+.4,-2.8,2.8);}
    else if(event.key==='ArrowLeft'){event.preventDefault();play(false);state.spinTarget=clamp(state.spinTarget-.4,-2.8,2.8);}
    else if(event.key.toLowerCase()==='g')setView(!state.grid);
    else if(event.key.toLowerCase()==='r')replay();
    else if(event.key==='Home'){event.preventDefault();state.gridScroll=0;setProgress(0);}
    else if(event.key==='End'){event.preventDefault();setView(true);}
  });
  addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){resumeAfterVisibility=state.playing;play(false);}
    else{lastTime=performance.now();if(resumeAfterVisibility)play(true);}
  });
  reducedMotion.addEventListener('change',event=>{if(event.matches){play(false);state.progress=state.target=.33;draw(state.progress);}});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();state.lost=true;state.ready=false;play(false);document.body.classList.remove('ready');});
  canvas.addEventListener('webglcontextrestored',async()=>{
    try{state.lost=false;loaded=0;initGL();await loadImages();state.ready=true;document.body.classList.add('ready');}
    catch(error){showError(error);}
  });
  function showError(error){
    console.error(error);$('error').style.display='block';$('error-message').textContent=error.message;
    const gallery=$('fallback-gallery');gallery.replaceChildren();
    projects.slice(0,6).forEach(project=>{const image=new Image();image.src='./slide-assets/'+project.file;image.alt=project.name;gallery.append(image);});
  }
  // Reproducible frame access for visual QA and future timing adjustments.
  window.slideDemo={
    seek(value){state.gridScroll=0;state.progress=state.target=clamp(value);play(false);draw(state.progress);},
    replay,play,pause:()=>play(false),setView,
    getState:()=>({progress:state.progress,playing:state.playing,ready:state.ready,grid:state.grid,artworkCount:textures.length,webgl:!!gl,lost:state.lost,path:'open-helix'}),
    getPath:()=>stripOrder.map((project,slot)=>{
      const point=pathPoint((slot-(projects.length-1)/2)*config.pathStep+choreography(state.progress).spin,stripRadius(slot));
      point[2]-=config.tailDepth*(1-slot/(projects.length-1));
      return {project,point};
    }),
    pathPoint,
    config
  };
  controls();
  (async()=>{
    try{
      initGL();await loadImages();state.ready=true;
      if(reducedMotion.matches)state.progress=state.target=.33;
      document.body.classList.add('ready');lastTime=performance.now();requestAnimationFrame(frame);
    }catch(error){showError(error);}
  })();
})();
