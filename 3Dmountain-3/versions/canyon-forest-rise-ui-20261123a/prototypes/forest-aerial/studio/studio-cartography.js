import * as THREE from 'three';
import { createStrategyBeacons } from './studio-strategy-beacons.js?v=20261121-2-falls1';

const CALLOUTS = [
  { title:'AI量化交易', en:'AI QUANT TRADING', offset:[44,-26] },
  { title:'上市櫃投資', en:'PUBLIC EQUITIES', offset:[46,-26] },
  { title:'未上市與PRE-IPO', en:'PRE-IPO INVESTMENT', offset:[44,22] },
  { title:'衍生性商品', en:'DERIVATIVE STRATEGIES', offset:[44,20] }
];

function driftingLights(atlas,studio,sites) {
  const coarse=matchMedia('(pointer: coarse)').matches;
  const perSite=coarse ? 4 : 6, seeds=[], anchors=[];
  const fraction=x=>x-Math.floor(x);
  // Stagger small emissions so the whole field never pulses at once.
  for(let site=0;site<sites.length;site++) for(let j=0;j<perSite;j++) {
    const i=site*perSite+j+1;
    seeds.push(fraction(j/perSite+site*.217),4.4+2.9*fraction(i*.618),
               6.283185*fraction(i*.7549),fraction(i*.4231));
    anchors.push(site,0,0);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(anchors,3));
  geo.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,4));
  const mat=new THREE.ShaderMaterial({
    uniforms:{uSites:{value:sites},uTime:atlas.uniforms.uTime,uArrival:studio.uniforms.uArrival,
      uTint:studio.uniforms.uCurtainCol,uLattice:atlas.uniforms.uLattice,
      uPixels:{value:innerHeight},uDpr:{value:1}},
    vertexShader:`
      uniform vec3 uSites[5]; uniform float uTime,uArrival,uLattice,uPixels,uDpr;
      attribute vec4 aSeed; varying float vAlpha;
      void main(){
        int site=int(position.x+.5);
        float lake=step(3.5,position.x), t=fract(uTime/aSeed.y+aSeed.x);
        vec2 axis=vec2(cos(aSeed.z),sin(aSeed.z)), crossWind=vec2(-axis.y,axis.x);
        float spread=mix(.065+.10*aSeed.w,.64+.29*aSeed.w,lake);
        vec2 xz=axis*(spread+t*(.025+.05*aSeed.w))+
                crossWind*(sin(t*3.8+aSeed.z)-sin(aSeed.z))*.039;
        float rise=(.41+.48*aSeed.w)*mix(1.0,.74,lake);
        vec3 p=uSites[site]+vec3(xz.x,.02+rise*t,xz.y);
        vec4 mv=viewMatrix*vec4(p,1.0);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((.018+.014*aSeed.w)*uPixels*.5*projectionMatrix[1][1]/max(.01,-mv.z),
                           2.2*uDpr,7.8*uDpr);
        vAlpha=smoothstep(.0,.21,t)*(1.0-smoothstep(.60,1.0,t))*
               (.49+.28*aSeed.w)*mix(1.0,.76,lake)*smoothstep(.28,.70,uArrival);
        if(mv.z>=0.0 || uLattice>.35) vAlpha=0.0;
      }`,
    fragmentShader:`
      uniform vec3 uTint; varying float vAlpha;
      void main(){
        vec2 p=gl_PointCoord*2.0-1.0;
        float r2=dot(p,p),glow=(.69*exp(-r2*8.2)+.31*exp(-r2*2.1))*(1.0-smoothstep(.56,1.0,r2));
        if(glow*vAlpha<.006) discard;
        gl_FragColor=vec4(mix(uTint,vec3(.88,.98,1.0),.48),glow*vAlpha);
        #include <colorspace_fragment>
      }`,
    blending:THREE.AdditiveBlending,transparent:true,depthTest:true,depthWrite:false
  });
  mat.userData.handlesArrival=true;
  const points=new THREE.Points(geo,mat);
  points.name='Rising ice-blue light motes';
  points.frustumCulled=false; points.renderOrder=16;
  points.onBeforeRender=renderer=>{
    mat.uniforms.uDpr.value=renderer.getPixelRatio();
    mat.uniforms.uPixels.value=innerHeight*mat.uniforms.uDpr.value;
  };
  return points;
}

// Four fixed, narrow light curtains and their contact glow share one draw.
function strategyWalls(atlas,studio) {
  const xyz=[], types=[], indices=[], segments=24;
  for(let i=0;i<=segments;i++) {
    const a=i/segments*Math.PI*2, x=Math.cos(a), z=Math.sin(a);
    xyz.push(x,0,z,x,1,z); types.push(0,0);
    if(i<segments) {const k=i*2; indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const base=xyz.length/3;
  xyz.push(-1,0,-1,1,0,-1,-1,0,1,1,0,1);
  types.push(1,1,1,1); indices.push(base,base+2,base+1,base+1,base+2,base+3);
  const geo=new THREE.InstancedBufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  geo.setAttribute('aFoot',new THREE.Float32BufferAttribute(types,1));
  const sites=new THREE.InstancedBufferAttribute(new Float32Array(CALLOUTS.length*4),4);
  geo.setAttribute('aSite',sites);
  geo.instanceCount=CALLOUTS.length;
  const mat=new THREE.ShaderMaterial({
    uniforms:{uTint:studio.uniforms.uCurtainCol,uArrival:studio.uniforms.uArrival,uLattice:atlas.uniforms.uLattice},
    vertexShader:`
      attribute float aFoot; attribute vec4 aSite;
      varying vec3 vLocal; varying float vFoot; varying vec3 vWorld;
      void main(){
        vFoot=aFoot; vLocal=position;
        vec2 span=mix(vec2(.114,.067),vec2(.25,.22),aFoot);
        mat2 turn=mat2(cos(aSite.w),sin(aSite.w),-sin(aSite.w),cos(aSite.w));
        vec2 d=turn*(position.xz*span);
        vWorld=vec3(aSite.x+d.x,aSite.y+.003+position.y*.65,aSite.z+d.y);
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);
      }`,
    fragmentShader:`
      uniform vec3 uTint; uniform float uArrival,uLattice;
      varying vec3 vLocal; varying float vFoot; varying vec3 vWorld;
      void main(){
        if(uLattice>.35) discard;
        float opacity;
        if(vFoot>.5){
          float r=length(vLocal.xz);
          opacity=.25*exp(-r*r*5.4)+.15*exp(-pow((r-.35)/.12,2.0));
        }else{
          vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
          float rim=pow(1.0-abs(dot(n,normalize(cameraPosition-vWorld))),2.2);
          float cap=1.0-smoothstep(.70,1.0,vLocal.y);
          opacity=(.095+.14*rim+.16*exp(-vLocal.y*8.0))*cap;
        }
        opacity*=smoothstep(.25,.68,uArrival);
        if(opacity<.004) discard;
        gl_FragColor=vec4(mix(uTint,vec3(.78,.91,.99),.28),opacity);
        #include <colorspace_fragment>
      }`,
    blending:THREE.AdditiveBlending,side:THREE.DoubleSide,forceSinglePass:true,
    transparent:true,depthTest:true,depthWrite:false
  });
  mat.userData.handlesArrival=true;
  const mesh=new THREE.Mesh(geo,mat);
  mesh.name='Four investment strategy light walls'; mesh.frustumCulled=false; mesh.renderOrder=15;
  const emitters=atlas.anchors.map(p=>p.clone());
  emitters.push(new THREE.Vector3(.122,.105,-.056));
  const lights=driftingLights(atlas,studio,emitters);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  mesh.add(lights);
  function sync() {
    lights.visible=!reduced.matches;
    atlas.anchors.forEach((p,i)=>{
      const h=atlas.lake.center.y;
      if(sites.getX(i)===Math.fround(p.x) && sites.getY(i)===Math.fround(h)) return;
      sites.setXYZW(i,p.x,h,p.z,Math.atan2(p.z-atlas.lake.center.z,p.x-atlas.lake.center.x));
      emitters[i].set(p.x,h,p.z);
      sites.needsUpdate=true;
    });
  }
  sync(); atlas.scene.add(mesh);
  return {mesh,lights,sync};
}

export function createStudioCartography(atlas, studio, camera, {
  overlay: showOverlay = true, parent = document.body, onSelect, isVisible, getObstacles, compactLeaders = false,
  enhancedBeacons = false, curtain, reducedMotion = false
} = {}) {
  const walls = enhancedBeacons ? createStrategyBeacons(atlas, studio, curtain, { reducedMotion }) : strategyWalls(atlas, studio);
  const config = { labels: true, ...(enhancedBeacons ? { beacons: walls.config } : {}) };
  const applyWalls = () => {
    walls.mesh.visible = config.labels && studio.config.layers.terrainStyle && studio.config.style > .01 && (walls.config?.enabled ?? true);
    walls.apply?.();
  };
  const disposeWalls = () => {
    if (walls.dispose) { walls.dispose(); return; }
    walls.mesh.removeFromParent(); walls.mesh.geometry.dispose(); walls.mesh.material.dispose();
    walls.lights.geometry.dispose(); walls.lights.material.dispose();
  };
  if (!showOverlay) return {
    config, apply: applyWalls,
    update() { applyWalls(); if (walls.mesh.visible) walls.sync(); },
    dispose: disposeWalls
  };
  const interactive = typeof onSelect === 'function';
  const panel = interactive ? null : document.getElementById('st');
  const overlay = document.createElement('div');
  overlay.className = 'map-annotations';
  overlay.classList.toggle('map-annotations--site', interactive);
  overlay.setAttribute('role', 'group');
  overlay.setAttribute('aria-label', '四大投資策略');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  overlay.append(svg);

  const labels = CALLOUTS.map((spec,i) => {
    const el = document.createElement(interactive ? 'button' : 'div');
    el.className = 'map-callout';
    if (interactive) { el.type = 'button'; el.addEventListener('click', () => onSelect(i)); }
    if (enhancedBeacons) {
      el.addEventListener('pointerenter', () => walls.setHovered(i));
      el.addEventListener('pointerleave', () => walls.setHovered(-1));
      el.addEventListener('focus', () => walls.setHovered(i));
      el.addEventListener('blur', () => walls.setHovered(-1));
    }
    el.innerHTML = `<span><strong>${spec.title}</strong><small>${spec.en}</small></span>`;
    overlay.append(el);
    const path = document.createElementNS(svg.namespaceURI, 'path');
    const dot = document.createElementNS(svg.namespaceURI, 'circle');
    dot.setAttribute('r', '1.8');
    svg.append(path, dot);
    return { ...spec, anchor:atlas.anchors[i], i, el, path, dot };
  });

  let streams, contours;
  if (!interactive) {
    const legend = document.createElement('div');
    legend.className = 'map-legend';
    legend.innerHTML = '<span class="map-legend-title">HIGHLAND / WATERSHED</span><span class="map-legend-detail"><span class="map-legend-streams"><i></i><b></b> 支流</span><span class="map-legend-contours"><em></em> 等高線</span></span>';
    overlay.append(legend);
    streams = legend.querySelector('.map-legend-streams');
    streams.querySelector('b').textContent = atlas.studioHydrology.stats.total;
    contours = legend.querySelector('.map-legend-contours');
  }
  parent.append(overlay);
  const point = new THREE.Vector3();
  let lastUpdate = -Infinity;

  /* PERF (2026-11-21, rise page; ?perf=0 = as before): hidden / inert were written with the value they already had on every frame (an attribute
     write on the root of a full-screen layer each time); now only when the value changes */
  const PERF_SAME = document.documentElement.hasAttribute('data-rise-studio-pbr') && new URLSearchParams(location.search).get('perf') !== '0';
  const setFlag = (node, name, value) => { if (!PERF_SAME || node[name] !== value) node[name] = value; };
  function apply() {
    setFlag(overlay, 'hidden', !config.labels || !studio.config.layers.terrainStyle || isVisible?.() === false);
    applyWalls();
  }
  function update() {
    apply();
    const now = performance.now();
    if (overlay.hidden || (!interactive && now - lastUpdate < 50)) return;
    lastUpdate = now;
    walls.sync();

    const width = innerWidth, height = innerHeight;
    const shortLeaders = compactLeaders && width >= 700;
    const opacity = THREE.MathUtils.smoothstep(studio.uniforms.uArrival.value, .35, .68);
    overlay.style.opacity = opacity.toFixed(3);
    if (interactive) setFlag(overlay, 'inert', opacity < .12);
    const viewBox = `0 0 ${width} ${height}`;
    if (svg.getAttribute('viewBox') !== viewBox) svg.setAttribute('viewBox', viewBox);
    const bounds = panel?.getBoundingClientRect();
    if (streams) setFlag(streams, 'hidden', !studio.config.layers.tributaries);
    if (contours) setFlag(contours, 'hidden', !studio.config.layers.contours);
    const obstacles = interactive ? getObstacles?.() || [] : [];

    const used=[];
    for (const item of labels) {
      point.set(item.anchor.x,atlas.lake.center.y+.095,item.anchor.z).project(camera);
      const x = (point.x * .5 + .5) * width, y = (-point.y * .5 + .5) * height;
      const gap=width<700 ? 18 : item.offset[0], labelW=width<700 ? 108 : 128;
      let left=x+gap+labelW>width-12;
      let lx=left ? x-gap-labelW : x+gap;
      let ly=y+item.offset[1];
      if(bounds && lx<bounds.right+10 && lx+labelW>bounds.left && ly>bounds.top-10 && ly<bounds.bottom+15 &&
         bounds.right+labelW+26<width) lx=bounds.right+15;
      const collides=(cy)=>used.some(b=>lx<b.x+labelW+5 && lx+labelW>b.x-5 && Math.abs(cy-b.y)<31);
      if(collides(ly)) ly=y-item.offset[1];
      const covered=bounds && lx<bounds.right+7 && lx+labelW>bounds.left && ly-13<bounds.bottom+7 && ly+15>bounds.top;
      let show=point.z>-1 && point.z<1 && x>6 && x<width-6 && y>12 && y<height-20 &&
                lx>=8 && ly>18 && ly<height-35 && !covered && !collides(ly);
      if (interactive && point.z > -1 && point.z < 1) {
        const baseY = Math.max(94, Math.min(height - 57, y));
        const preferred = left || x > width * .77;
        show = false;
        const offsets = shortLeaders ? [item.i === 3 ? -28 : item.offset[1], -28, 28, -52, 52, -78, 78, -104] :
          [item.offset[1], -item.offset[1], -62, 62, -100, 100, -142, 142];
        if (shortLeaders) {
          for (const r of obstacles) offsets.push(r.top - 22 - baseY, r.bottom + 18 - baseY);
          offsets.sort((a,b) => Math.abs(a) - Math.abs(b));
        }
        for (const offset of offsets) {
          for (const toLeft of [preferred, !preferred]) {
            const nearGap = shortLeaders ? 26 : gap;
            lx = Math.max(14, Math.min(width - labelW - 14, toLeft ? x-nearGap-labelW : x+nearGap));
            ly = Math.max(92, Math.min(height - 49, baseY + offset));
            const touches = r => lx < r.right && lx+labelW > r.left && ly-14 < r.bottom && ly+18 > r.top;
            if (!shortLeaders) for (const r of obstacles) if (touches(r)) lx = toLeft ? r.left-labelW-5 : r.right+5;
            const endX = toLeft ? lx+labelW+3 : lx-5;
            if (shortLeaders && (x<8 || x>width-8 || y<30 || y>height-15 || Math.hypot(endX-x,ly-y)>116)) continue;
            if (lx < 8 || lx+labelW > width-8 || collides(ly) || obstacles.some(touches)) continue;
            left = lx + labelW / 2 < x;
            show = true;
            break;
          }
          if (show) break;
        }
      }
      for (const el of [item.el, item.path, item.dot]) el.style.display = show ? '' : 'none';
      if (!show) continue;
      used.push({x:lx,y:ly});
      item.el.style.transform = `translate3d(${lx.toFixed(1)}px,${(ly - 13).toFixed(1)}px,0)`;
      const end=left ? lx+labelW+3 : lx-5;
      item.path.setAttribute('d', `M${x.toFixed(1)},${y.toFixed(1)} L${(end+(left?9:-9)).toFixed(1)},${ly.toFixed(1)} H${end.toFixed(1)}`);
      item.dot.setAttribute('cx', x);
      item.dot.setAttribute('cy', y);
    }
  }
  apply();
  return {config,apply,update,focus:walls.focus,stats:{labels:labels.length,walls:CALLOUTS.length},setSelected(index){
    walls.setSelected?.(index);
    for (const item of labels) {
      if (item.i === index) item.el.setAttribute('aria-current', 'step');
      else item.el.removeAttribute('aria-current');
    }
  },dispose(){
    overlay.remove(); disposeWalls();
  }};
}
