export const lensDrops=[[.23,.8,.042],[.33,.62,.024],[.69,.84,.048],[.79,.6,.03],[.56,.9,.02],[.12,.57,.022],[.88,.76,.034],[.45,.7,.016],[.06,.86,.028],[.96,.52,.018],[.62,.66,.013]],lensSplashGLSL=`
uniform vec4 uDrops[11];
uniform float uRun[11];
void addLensSplash(inout vec4 acc, sampler2D tScene, vec2 uv, float asp) {
  for (int i = 0; i < 11; i++) {
    vec4 D = uDrops[i];
    if (D.w < 0.004) continue;
    vec2 q = (uv - D.xy) * vec2(asp, 1.0) / D.z; q.y *= q.y < 0.0 ? 0.8 : 1.12;   /* flattened, heavier at the bottom (it clings and slides) */
    float l = length(q);
    /* the streak it leaves running down: a thin wet trail above it, thinning and fading toward where it landed */
    float run = uRun[i] / D.z;
    if (l >= 1.0 && q.y > 0.0 && q.y < run + 1.0) {
      float h = clamp((q.y - 0.6) / max(run, 1e-3), 0.0, 1.0), w = 0.42 * (1.0 - h) + 0.05;
      float ta = (1.0 - smoothstep(0.55, 1.0, abs(q.x) / w)) * (1.0 - h) * 0.6 * D.w;
      if (ta > 0.004) {
        vec3 c = textureLod(tScene, clamp(uv + vec2(-q.x * D.z * 0.35 / asp, 0.0), vec2(0.001), vec2(0.999)), 0.0).rgb * 1.04 + vec3(0.02, 0.03, 0.04);
        acc = vec4(c * ta, ta) + acc * (1.0 - ta);
      }
      continue;
    }
    if (l >= 1.0) continue;
    float nz = sqrt(max(0.0, 1.0 - l * l));
    vec2 s = D.xy - q * D.z * vec2(1.0 / asp, 1.0) * 0.9;   /* out of focus on the lens: a soft, turned-over picture of the canyon */
    vec3 c = textureLod(tScene, clamp(s, vec2(0.001), vec2(0.999)), 0.0).rgb;
    c = mix(c, textureLod(tScene, clamp(s + vec2(0.004, 0.006), vec2(0.001), vec2(0.999)), 0.0).rgb, 0.5);
    float rim = smoothstep(0.62, 1.0, l);
    c = mix(c * 1.1, c * 0.35, rim * 0.7);
    vec3 n = normalize(vec3(q, nz));
    c += vec3(1.0) * pow(max(dot(n, normalize(vec3(-0.35, 0.55, 0.76))), 0.0), 40.0) * 0.8;
    c += vec3(0.85, 0.92, 1.0) * smoothstep(0.7, 0.96, l) * (1.0 - smoothstep(-0.7, 0.2, q.y)) * 0.12;
    float a = (1.0 - smoothstep(0.72, 1.0, l)) * D.w;
    acc = vec4(c * a, a) + acc * (1.0 - a);
  }
}
`;