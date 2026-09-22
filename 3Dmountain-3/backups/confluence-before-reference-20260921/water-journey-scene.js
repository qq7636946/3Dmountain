import { createCanyonWatershed } from './water-canyon-watershed.js?v=alpine-confluence-1';

/** A bounded, deterministic river canyon. All camera positions share the river's arc-length coordinates. */
export function createJourneyScene(THREE, { createRiver }) {
  const scene = new THREE.Scene();
  scene.name = 'MONTIS River Journey';
  scene.background = new THREE.Color('#a9bdcf');
  scene.fog = new THREE.FogExp2('#b5c7d7', .00172);
  const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, .10, 3200);
  const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const clamp01 = x => Math.max(0, Math.min(1, x));
  // Long, deliberately broad turns leave the complete navigable corridor visible.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(-12, 0, -112),
    new THREE.Vector3(45, 0, -252), new THREE.Vector3(114, 0, -375),
    new THREE.Vector3(55, 0, -514), new THREE.Vector3(-65, 0, -645),
    new THREE.Vector3(-82, 0, -775), new THREE.Vector3(35, 0, -913),
    new THREE.Vector3(96, 0, -1050), new THREE.Vector3(35, 0, -1220),
    new THREE.Vector3(-5, 0, -1370), new THREE.Vector3(-26, 0, -1580),
    new THREE.Vector3(-42, 0, -1880)
  ], false, 'centripetal');
  curve.arcLengthDivisions = 1600;
  curve.updateArcLengths();
  const widthAt = t => 19 + 38 * (1 - smooth(.035, .21, t))
    + 106 * smooth(.70, .95, t) + 3.2 * Math.sin(t * Math.PI * 6 + .4);
  const river = createRiver(THREE, curve, widthAt);
  river.mesh.name = 'Continuous reflective river';
  scene.add(river.mesh);

  const hemisphere = new THREE.HemisphereLight('#dce9f4', '#53616b', 2.3);
  const sunlight = new THREE.DirectionalLight('#ffead0', 2.65);
  sunlight.position.set(-190, 260, -210);
  // Static terrain shadows are baked once by the directional light.
  sunlight.target.position.set(0,0,-2200);
  sunlight.position.set(-4750,6500,-7450);
  sunlight.castShadow=true;
  sunlight.shadow.mapSize.set(innerWidth<760?2048:4096,innerWidth<760?2048:4096);
  Object.assign(sunlight.shadow.camera,{left:-5200,right:5200,top:5200,bottom:-5200,near:100,far:17000});
  sunlight.shadow.bias=-.00012;sunlight.shadow.normalBias=3;
  sunlight.shadow.autoUpdate=false;sunlight.shadow.needsUpdate=true;
  scene.add(hemisphere, sunlight, sunlight.target);
  const rim = new THREE.DirectionalLight('#9bbddd', 1.4);
  rim.position.set(140, 80, 220);
  scene.add(rim);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(2700, 28, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zenith: { value: new THREE.Color('#779abf') }, horizon: { value: new THREE.Color('#d4dee5') } },
    vertexShader: 'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 zenith,horizon; varying vec3 vDirection; void main(){float h=max(normalize(vDirection).y,0.); vec3 c=mix(horizon,zenith,pow(h,.47)); gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const fract = v => v - Math.floor(v);
  const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7 + 81.73) * 43758.5453);
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), ux), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), ux), uy);
  }
  function fbm(x, y) { return noise(x, y) * .57 + noise(x * 2.07 + 13, y * 2.07) * .28 + noise(x * 4.13, y * 4.13 + 19) * .15; }

  const rockMaterial = new THREE.MeshStandardMaterial({ color: '#adbbc5', vertexColors: true, roughness: .94, metalness: .035 });
  rockMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vRockWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 rockLocal=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nrockLocal=instanceMatrix*rockLocal;\n#endif\nvRockWorld=(modelMatrix*rockLocal).xyz;');
    shader.fragmentShader = `varying vec3 vRockWorld;
      float rockHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float rockNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(rockHash(i),rockHash(i+vec3(1,0,0)),f.x),mix(rockHash(i+vec3(0,1,0)),rockHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(rockHash(i+vec3(0,0,1)),rockHash(i+vec3(1,0,1)),f.x),mix(rockHash(i+vec3(0,1,1)),rockHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float rockLarge=rockNoise(vRockWorld*.085);
      float warp=rockNoise(vRockWorld*vec3(.028,.015,.028));
      float bedding=vRockWorld.y*.19+vRockWorld.x*.045+vRockWorld.z*.025+warp*5.6+rockLarge*1.9;
      float ledge=smoothstep(.88,.98,abs(sin(bedding)))*smoothstep(.30,.70,rockNoise(vRockWorld*.064));
      float fine=rockNoise(vRockWorld*.83);
      float fracture=smoothstep(.79,.94,rockNoise(vRockWorld*vec3(.33,.033,.33)));
      diffuseColor.rgb*= (.82+rockLarge*.30+fine*.19-ledge*.075-fracture*.20);
      float waterline=1.-smoothstep(.15,3.8,vRockWorld.y);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.48,.57,.61),waterline*.62);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.48,1.-smoothstep(.2,3.,vRockWorld.y));');
  };
  rockMaterial.customProgramCacheKey = () => 'montis-canyon-rock-v2';
  const longitudinal = 380, lateral = 53;
  const rockDark = new THREE.Color('#526676'), rockPale = new THREE.Color('#a0acb4'), lichen = new THREE.Color('#687875');
  let terrainVertices = 0;
  for (const side of [-1, 1]) {
    const positions = [], colors = [], indices = [];
    for (let i = 0; i <= longitudinal; i++) {
      const t = i / longitudinal, center = curve.getPointAt(t), tangent = curve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const canyon = smooth(.025, .17, t) * (1 - smooth(.65, .91, t));
      const buttress = noise(t * 24 + 13, side * 19 + 65);
      const ravine = Math.pow(noise(t * 47 + 38, side * 11 + 14), 1.5);
      const shoulder = 18 + canyon * (32 + buttress * 42);
      for (let j = 0; j <= lateral; j++) {
        const u = j / lateral;
        // Concentrate samples at the steep wet edge; retain enough land beyond the skyline.
        const distance = Math.pow(u, 1.47) * 250;
        const bankRipple = (noise(t * 95, side * 13 + 51) - .5) * 4.2;
        const r = widthAt(t) * .985 + distance + bankRipple * smooth(0, 13, distance);
        const shore = r - distance;
        // Carry outer land outward in world X, avoiding folded offset curves on the inside of bends.
        const x = center.x + normal.x * side * shore + side * distance;
        const z = center.z + normal.z * side * shore;
        const broad = fbm(x * .017 + side * 5, z * .014);
        const ridges = Math.pow(Math.abs(Math.sin(t * 42 + side * 2.7 + broad * 3.3)), .52);
        const cliffHeight = shoulder * (.34 + buttress * .50 + ravine * .52 + broad * .14);
        const cliffStart = 4 + 24 * noise(t * 39, side * 7 + 30);
        const cliff = smooth(cliffStart, cliffStart + 11 + broad * 20, distance);
        const upperRidge = Math.pow(ridges, 1.8) * (26 + broad * 117) + broad * 48;
        const highland = smooth(58 + buttress * 35, 235, distance) * upperRidge * (.40 + canyon * .60);
        const rockFace = noise(t * 118 + 7, u * 18 + side * 18);
        const teeth = (rockFace - .5) * (5 + cliff * 10) * smooth(2, 16, distance);
        const shelf = Math.sin(distance * .08 + broad * 4) * (2 + ravine * 5) * smooth(14, 55, distance);
        const outlet = 1 - smooth(.89, 1, t) * .58;
        const y = -.9 + (Math.min(distance, 8) * .16 + cliffHeight * cliff + highland + teeth + shelf) * outlet;
        positions.push(x, y, z);
        const color = rockDark.clone().lerp(rockPale, .19 + broad * .61 + Math.min(y / 220, .17));
        color.lerp(lichen, smooth(70, 155, y) * noise(x * .028, z * .028) * .20);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let i = 0; i < longitudinal; i++) for (let j = 0; j < lateral; j++) {
      const a = i * (lateral + 1) + j, b = a + lateral + 1;
      // Geometry normals must face out/up on both sides of the river.
      if (side < 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    const bank = new THREE.Mesh(geometry, rockMaterial);
    bank.name = side < 0 ? 'West stratified cliffs' : 'East stratified cliffs';
    scene.add(bank); terrainVertices += positions.length / 3;
  }

  // Irregular, partially submerged talus breaks the continuous shoreline into individual masses.
  const boulderGeometry = new THREE.IcosahedronGeometry(1, 2);
  const bp = boulderGeometry.attributes.position;
  const bc = [];
  for (let i = 0; i < bp.count; i++) {
    const x=bp.getX(i), y=bp.getY(i), z=bp.getZ(i);
    const rough=.82+noise(x*7+9,z*7+y*3)*.32;
    bp.setXYZ(i,x*rough,y*rough,z*rough);
    const c=rockDark.clone().lerp(rockPale,.27+noise(x*4+20,z*5)*.30);bc.push(c.r,c.g,c.b);
  }
  boulderGeometry.setAttribute('color',new THREE.Float32BufferAttribute(bc,3));
  const bn=[];
  for(let i=0;i<bp.count;i++){const n=new THREE.Vector3(bp.getX(i),bp.getY(i),bp.getZ(i)).normalize();bn.push(n.x,n.y,n.z);}
  boulderGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(bn,3));
  const boulders = new THREE.InstancedMesh(boulderGeometry,rockMaterial,116);
  const dummy = new THREE.Object3D();
  for(let i=0;i<116;i++){
    const side=i%2===0?-1:1;
    const t=.03+hash(i,9)*.79, p=curve.getPointAt(t), tangent=curve.getTangentAt(t);
    const size=1.8+Math.pow(hash(i,11),2)*7.5;
    const nx=-tangent.z*side, nz=tangent.x*side;
    const r=widthAt(t)+size*.78+hash(i,71)*9;
    dummy.position.set(p.x+nx*r,-.7+size*.22,p.z+nz*r);
    dummy.rotation.set(hash(i,51)*.8,hash(i,26)*6.28,hash(i,47)*.8);
    dummy.scale.set(size*(.8+hash(i,36)*.8),size*(.7+hash(i,40)*.9),size*(.8+hash(i,44)));
    dummy.updateMatrix();boulders.setMatrixAt(i,dummy.matrix);
  }
  boulders.name='Broken slate and shore talus';scene.add(boulders);

  // A second atmospheric range closes the far horizon without loading large terrain assets.
  const distantGeometry = new THREE.PlaneGeometry(3800, 1500, 150, 20);
  distantGeometry.rotateX(-Math.PI / 2);
  const dp = distantGeometry.attributes.position;
  const dc = [];
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i), z = dp.getZ(i) - 2960;
    const n = fbm(x * .004 + 21, z * .005);
    const range = Math.pow(Math.abs(Math.sin(x * .0032 + n * 2.8)), .63);
    const envelope = smooth(-2210, -2760, z);
    const pass = smooth(80, 550, Math.abs(x + 165));
    dp.setXYZ(i, x, -14 + envelope * (50 + range * 205 + n * 125) * (.17 + pass * .83), z);
    const c = rockPale.clone().lerp(new THREE.Color('#b8cbdc'), .55);
    dc.push(c.r, c.g, c.b);
  }
  distantGeometry.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
  distantGeometry.computeVertexNormals(); distantGeometry.computeBoundingSphere();
  const distantMaterial=rockMaterial.clone();
  distantMaterial.onBeforeCompile=rockMaterial.onBeforeCompile;
  distantMaterial.customProgramCacheKey=rockMaterial.customProgramCacheKey;
  distantMaterial.transparent=true;distantMaterial.depthWrite=false;
  const distant = new THREE.Mesh(distantGeometry, distantMaterial);
  distant.name = 'Atmospheric far range'; scene.add(distant);

  // All five rivers exist in this same world, using the original water and rock.
  const watershed=createCanyonWatershed(THREE,{curve,widthAt,createRiver,rockMaterial,boulderGeometry,rockDark,rockPale});
  scene.add(watershed.group);
  const shotDirection=new THREE.Vector3(),shotFocus=new THREE.Vector3();
  const overviewDirection=new THREE.Vector3(-.10,-.49,-.866).normalize();
  const overviewFocus=new THREE.Vector3(0,150,-1650);
  const smoother=n=>{const t=clamp01(n);return t*t*t*(t*(t*6-15)+10)};
  const forward = new THREE.Vector3(), next = new THREE.Vector3();
  const look = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const pathLength = curve.getLength();
  const stats = { pathLength, terrainVertices: terrainVertices + dp.count, bankSegments: longitudinal, riverHalfWidthMin: 15.8, maxBankRadians: .035, routeEnd: .865, riverCount:5, watershed:watershed.stats };
  function update(progress, time = 0, reduceMotion = false, reveal = 0, confluence = 0) {
    let route=clamp01(progress);
    if(route>.90){const u=(route-.90)/.10;route=.90+.10*(u+u*u-u*u*u);}
    const t=route*.865;
    const point = curve.getPointAt(t);
    forward.copy(curve.getTangentAt(t)).normalize();
    next.copy(curve.getTangentAt(Math.min(1, t + 28 / pathLength))).normalize();
    right.crossVectors(forward, worldUp).normalize();
    const turn = forward.x * next.z - forward.z * next.x;
    const bank = reduceMotion ? 0 : THREE.MathUtils.clamp(turn * .32, -.035, .035);
    up.copy(worldUp).applyAxisAngle(forward, bank);
    camera.up.copy(up);
    camera.position.copy(point);
    camera.position.y = 2.4 + (reduceMotion ? 0 : Math.sin(t * pathLength * .015) * .05 + Math.sin(t * pathLength * .007) * .035);
    look.copy(curve.getPointAt(Math.min(1, t + 29 / pathLength)));
    look.y = 2.9;
    camera.fov = 64 + 5 * smooth(.04, .55, t);
    // Lift first, then ease backward: the river under the viewer remains the
    // central river in the wider landscape. There is no scene swap or dissolve.
    const u=clamp01(reveal),tilt=smoother(u/.60),dolly=smoother((u-.08)/.92),framing=smoother((u-.18)/.70);
    const fitDistance=Math.max(3900,2550/(Math.tan(THREE.MathUtils.degToRad(32))*camera.aspect)+1100);
    const closeDistance=camera.position.distanceTo(look);
    shotDirection.copy(look).sub(camera.position).normalize().lerp(overviewDirection,tilt).normalize();
    shotFocus.copy(look).lerp(overviewFocus,framing);
    const joining=smoother(confluence);shotFocus.z-=joining*740;shotFocus.y+=joining*50;
    shotDirection.x-=joining*.035;shotDirection.normalize();
    camera.position.copy(shotFocus).addScaledVector(shotDirection,-THREE.MathUtils.lerp(closeDistance,fitDistance*(1-joining*.12),dolly));
    camera.up.lerp(worldUp,tilt).normalize();camera.lookAt(shotFocus);
    camera.fov=THREE.MathUtils.lerp(camera.fov,64,dolly);
    camera.near=THREE.MathUtils.lerp(.10,1,dolly);camera.far=THREE.MathUtils.lerp(6200,Math.max(16000,fitDistance+9000),dolly);
    scene.fog.density=THREE.MathUtils.lerp(.00172,.30/fitDistance,smoother(u/.80));
    const mountainLight=smoother((u-.25)/.65);
    hemisphere.intensity=THREE.MathUtils.lerp(2.3,1.10,mountainLight);
    rim.intensity=THREE.MathUtils.lerp(1.4,.55,mountainLight);
    // The close-up horizon yields to the actual continuous distant terrain.
    distantMaterial.opacity=1-smoother((u-.015)/.20);distant.visible=distantMaterial.opacity>.001;
    camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
    river.update(time);watershed.update(time,u);
  }
  function resize(width, height) {
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
  function dispose() {
    watershed.group.removeFromParent();watershed.dispose();
    scene.traverse(object => { if (object.isMesh && object !== river.mesh) object.geometry.dispose(); });
    distantMaterial.dispose();rockMaterial.dispose(); sky.material.dispose(); river.dispose?.();
  }
  update(0, 0, true);
  return { scene, camera, curve, widthAt, river, rivers:[river,...watershed.rivers], watershed, update, resize, stats, dispose };
}


