// A reversible score: surface emergence, growth, then an aligned camera passage.
export const LOGO_RISE_DEFAULTS = Object.freeze({
  riseEnd: .70, startScale: .66, endScale: 1.16, sinkDepth: .80,
  approach: 1.4, handoff: 1.65, portalOpen: .44, wake: .34, surfaceView: 1.8
});
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { const u = clamp(x); return u * u * u * (u * (u * 6 - 15) + 10); };

export function sampleLogoRise(progress, config, restY, waterY = 0) {
  const t = clamp(progress);
  const rise = ease(t / Math.max(.2, config.riseEnd));
  const grow = ease((t - .28) / .72);
  const height = config.height * (config.startScale + (config.endScale - config.startScale) * grow);
  const submergedY = waterY - config.height * config.startScale * .56 - config.sinkDepth;
  return {
    t, rise, grow, height,
    y: submergedY + (restY - submergedY) * rise,
    yaw: (1 - rise) * .30 + Math.sin(Math.PI * ease((t - .12) / .88)) * Math.PI * 2 * config.turns,
    tilt: (1 - rise) * -.12 + Math.sin(Math.PI * t) * config.tilt * .18,
    align: ease((t - .48) / .52),
    surface: ease(t / .22) * (1 - ease((t - .44) / .42)),
    wake: ease((t - .18) / .22) * (1 - ease((t - .67) / .22)) * config.wake
  };
}

export function createLogoWake(THREE, { seaGLSL, seaUniforms, lite = false }) {
  const uniforms = {
    ...seaUniforms,
    uWakeCenter: { value: new THREE.Vector2() },
    uWakeProgress: { value: 0 },
    uWakeOpacity: { value: 0 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: `
      ${seaGLSL}
      varying vec2 vWakeXZ;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        vec3 n;vec2 flow;float lost,fold,slope;
        vec3 d=seaField(world.xz,.16,n,flow,lost,fold);
        d.y=roundCrest(d.y,slope);
        world.xyz+=d; world.y+=.026;
        vWakeXZ=world.xz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }
    `,
    fragmentShader: `
      uniform vec2 uWakeCenter;
      uniform float uWakeProgress,uWakeOpacity;
      varying vec2 vWakeXZ;
      void main(){
        vec2 p=vWakeXZ-uWakeCenter;
        float r=length(p*vec2(1.,.94));
        float rings=0.;
        for(int i=0;i<3;i++){
          float age=clamp((uWakeProgress-.12-float(i)*.10)/.70,0.,1.);
          float radius=.35+age*6.0;
          float w=.032+age*.055;
          float band=exp(-pow((r-radius)/w,2.));
          rings+=band*sin(age*3.141593)*(1.-float(i)*.18);
        }
        float broken=.65+.35*sin(atan(p.y,p.x)*7.+r*3.);
        float alpha=min(.55,rings*uWakeOpacity*broken);
        if(alpha<.002)discard;
        gl_FragColor=vec4(vec3(.70,.87,1.03),alpha);
      }
    `
  });
  const geometry = new THREE.PlaneGeometry(16, 16, lite ? 40 : 72, lite ? 40 : 72);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Logo emergence — surface wake';
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  mesh.visible = false;
  function update(x, z, progress, opacity) {
    mesh.visible = opacity > .002;
    mesh.position.set(x, 0, z);
    uniforms.uWakeCenter.value.set(x, z);
    uniforms.uWakeProgress.value = progress;
    uniforms.uWakeOpacity.value = opacity;
  }
  return { mesh, update, dispose(){ geometry.dispose(); material.dispose(); } };
}
