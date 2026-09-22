/** Scroll-directed turn: front → edge → back → edge → front.
 * Unwrapped angles preserve the direction across 180°; no shortest-arc slerp.
 */
const PI=Math.PI;
const clamp=x=>Math.min(1,Math.max(0,x));
const ease=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};

function monotoneTrack(keys){
  const slopes=keys.slice(1).map((key,i)=>(key[1]-keys[i][1])/(key[0]-keys[i][0]));
  const tangents=keys.map((_,i)=>{
    if(i===0||i===keys.length-1)return 0;
    const left=slopes[i-1],right=slopes[i];
    if(left*right<=0)return 0;
    const before=keys[i][0]-keys[i-1][0],after=keys[i+1][0]-keys[i][0];
    const a=2*after+before,b=after+2*before;
    return(a+b)/(a/left+b/right);
  });
  return p=>{
    if(p<=keys[0][0])return keys[0][1];
    if(p>=keys.at(-1)[0])return keys.at(-1)[1];
    let i=0;while(i<keys.length-2&&p>keys[i+1][0])i++;
    const span=keys[i+1][0]-keys[i][0],u=(p-keys[i][0])/span,u2=u*u,u3=u2*u;
    return(2*u3-3*u2+1)*keys[i][1]+(u3-2*u2+u)*span*tangents[i]
      +(-2*u3+3*u2)*keys[i+1][1]+(u3-u2)*span*tangents[i+1];
  };
}

const turn=monotoneTrack([[0,-.18],[.26,0],[.49,PI*.5],[.65,PI],[.82,PI*1.5],[.975,PI*2-.18],[1,PI*2-.18]]);
// Pull back during the first half-turn, then approach through the second edge.
const scaleTrack=monotoneTrack([[0,.36],[.26,.36],[.49,.29],[.64,.245],[.76,.48],[.88,.86],[.975,.94],[1,.94]]);
const depthTrack=monotoneTrack([[0,0],[.26,0],[.51,-.35],[.64,-.60],[.79,-.06],[.93,0],[1,0]]);

export function sampleLogoMotion(progress,{mobile=false,reduced=false,aspect=1.6}={}){
  const p=clamp(progress),approach=ease(.64,.95,p),desktopShift=aspect<1.45?-.45:-.22;
  const size=reduced?.36+(.94-.36)*ease(.27,.90,p):scaleTrack(p);
  return{
    yaw:reduced?-.18:turn(p),
    pitch:.045-.085*approach,
    roll:-.025+.055*approach,
    scale:size*(1-approach*(mobile?(1-.51/.94):0)),
    x:(mobile?.10:desktopShift)*approach,
    y:.06+((mobile?-.08:-.06)-.06)*approach,
    z:reduced?0:depthTrack(p),
    morph:ease(.05,.28,p),
    glass:ease(.20,.32,p),
    particles:1-ease(.24,.36,p),
    about:ease(.72,.91,p),
    intro:1-ease(.09,.27,p),
  };
}
