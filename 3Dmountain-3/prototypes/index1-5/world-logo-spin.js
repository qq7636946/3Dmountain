/* Closing mark only: outward glass tiles and a radial shutter trail.
   Samples the already displayed lake frame, so glass/reflection colour stays
   identical. No history buffers, animated noise, or work while the mark rests. */
import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function createSpinMotion() {
  let lastYaw = null, lastTime = null;
  const state = { amount: 0, speed: 0, direction: 1 };
  function reset() { lastYaw = lastTime = null; state.amount = state.speed = 0; }
  function update({ yaw = 0, progress = 0, now = 0, enabled = true, reducedMotion = false }) {
    const elapsed = lastTime == null ? 0 : now - lastTime;
    const velocity = lastYaw == null || elapsed <= 0 || elapsed > .25 ? 0 : clamp((yaw - lastYaw) / elapsed, -12, 12);
    lastYaw = yaw; lastTime = now;
    if (!enabled || reducedMotion || progress <= .015 || progress >= .985) {
      state.amount = state.speed = 0;
      return state;
    }
    const dt = clamp(elapsed, 0, .1);
    state.speed += (velocity - state.speed) * (1 - Math.exp(-dt * 16));
    if (Math.abs(state.speed) > .01) state.direction = Math.sign(state.speed);
    const envelope = smooth(.035, .19, progress) * (1 - smooth(.77, .985, progress));
    state.amount = .72 * envelope * (1 - Math.exp(-Math.abs(state.speed) * .65));
    return state;
  }
  return { state, update, reset };
}

export function createLogoSpinFx({ small = false, enabled = true } = {}) {
  const motion = createSpinMotion(), size = new THREE.Vector2(), focus = new THREE.Vector3();
  const mat = new THREE.ShaderMaterial({
    name: 'Closing logo spin mosaic', depthTest: false, depthWrite: false,
    blending: THREE.NoBlending, toneMapped: false,
    defines: { SPIN_TAPS: small ? 5 : 9 },
    uniforms: {
      tFrame: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uFocus: { value: new THREE.Vector2(.5, .5) },
      uBlur: { value: .10 },
      uMotion: { value: new THREE.Vector3(0, 1, 0) }
    },
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tFrame;
      uniform vec2 uRes,uFocus;
      uniform vec3 uMotion;
      uniform float uBlur;
      varying vec2 vUv;
      vec3 hash3(vec2 p){return fract(sin(vec3(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)),dot(p,vec2(419.2,371.9))))*43758.5453);}
      vec2 toUv(vec2 p){return clamp(p*vec2(uRes.y/uRes.x,1.)+uFocus,vec2(.001),vec2(.999));}
      void main(){
        vec2 p=(vUv-uFocus)*vec2(uRes.x/uRes.y,1.);
        // Fade around the mark; distant mountains and the frame edges stay calm.
        float mask=1.-smoothstep(.65,1.25,length(p/vec2(.50,.54)));
        float A=uMotion.x*mask;
        if(A<.0005){gl_FragColor=texture2D(tFrame,vUv);return;}
        const float S=.17;
        vec2 bc=floor(p/S+.5)*S,hs=vec2(S*.5);
        vec3 r=hash3(bc*17.3+2.1);
        if(r.x<.65){
          if(r.y<.5){hs.x*=.5;bc.x+=(p.x<bc.x?-1.:1.)*hs.x;}
          else{hs.y*=.5;bc.y+=(p.y<bc.y?-1.:1.)*hs.y;}
        }
        r=hash3(bc*23.7+5.4);
        vec2 local=p-bc,edge=hs-abs(local);
        float seam=exp(-max(0.,min(edge.x,edge.y))*uRes.y/1.8);
        // Each pane flies away from the projected logo centre. A small swirl
        // follows yaw, but reversing the spin still scatters panes outward.
        // Stable seeds and a continuous pulse avoid frame-to-frame flicker.
        float pulse=.8+.2*sin(uMotion.z*12.56637+r.x*5.);
        float w=A*(.55+.45*r.z)*pulse;
        vec2 radial=bc+local*.15;
        float radius=length(radial);
        radial=radius>.0001?radial/radius:vec2(cos(r.x*6.283185),sin(r.x*6.283185));
        vec2 tangent=vec2(-radial.y,radial.x);
        vec2 flight=normalize(radial+tangent*((r.y-.5)*.6+uMotion.y*.25));
        float distance=(.035+.08*smoothstep(0.,.45,radius))*w;
        // Sampling inward makes the visible fragments travel outward.
        vec2 q=bc+local*(1.-.09*w)-flight*distance;
        // The M panel adjusts blur independently of the tile scatter.
        float blur=A*uBlur;
        vec2 trail=flight*(.055+.055*r.z+.08*radius)*blur;
        vec3 col=vec3(0.);float weights=0.;
        for(int i=0;i<SPIN_TAPS;i++){
          float t=float(i)/float(SPIN_TAPS-1),weight=1.-.75*t;
          // A narrow fan softens both sides of the streak instead of making
          // a row of sharp copies. Its width grows toward the fading tail.
          float fan=sin(float(i)*2.399963+r.y*6.283185)*sqrt(t)*.012*blur;
          col+=texture2D(tFrame,toUv(q-trail*t+tangent*fan)).rgb*weight;weights+=weight;
        }
        col/=weights;
        col*=1.+(r.z-.5)*.10*w;
        col+=vec3(.47,.72,.94)*seam*w*.075;
        gl_FragColor=vec4(max(col,vec3(0.)),1.);
      }`
  });
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false; scene.add(mesh);
  let progress = 0;
  function update(args) { progress = args.progress; return motion.update({ ...args, enabled: enabled && args.enabled !== false }); }
  function render(renderer, texture, holder, lakeCamera, blurStrength = .10) {
    if (motion.state.amount <= .001) return;
    renderer.getDrawingBufferSize(size);
    holder.getWorldPosition(focus); focus.project(lakeCamera);
    mat.uniforms.tFrame.value = texture;
    mat.uniforms.uRes.value.copy(size);
    mat.uniforms.uFocus.value.set(focus.x * .5 + .5, focus.y * .5 + .5);
    mat.uniforms.uMotion.value.set(motion.state.amount, motion.state.direction, progress);
    mat.uniforms.uBlur.value = Number.isFinite(blurStrength) ? clamp(blurStrength) : .10;
    renderer.setRenderTarget(null); renderer.render(scene, camera);
  }
  return { scene, camera, state: motion.state, update, render, reset: motion.reset,
    dispose() { mat.dispose(); mesh.geometry.dispose(); motion.reset(); } };
}
