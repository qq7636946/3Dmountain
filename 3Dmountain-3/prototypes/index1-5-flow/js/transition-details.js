/* One optical accent, driven by the existing scene clocks. No RAF, input
   listener, texture or new scroll duration. Endpoints are exactly clear. */
const clamp = n => Math.max(0, Math.min(1, Number(n) || 0));
let layer, previous = '';
const pulse = p => Math.pow(Math.sin(Math.PI * clamp(p)), 2);
function paint(phase, progress, strength, reduced) {
  const gate = document.documentElement.dataset.gate;
  const blocked = reduced || document.hidden || document.documentElement.dataset.renderMode === 'text' || ['hold', 'ready', 'enter'].includes(gate);
  const p = clamp(progress), alpha = blocked ? 0 : pulse(p) * strength;
  if (!layer) {
    layer = document.createElement('div'); layer.className = 'flow-optics';
    layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer);
  }
  const key = phase + '|' + p.toFixed(3) + '|' + alpha.toFixed(3);
  if (key === previous) return; previous = key;
  layer.dataset.phase = phase;
  layer.style.opacity = alpha.toFixed(3);
  layer.style.visibility = alpha > .001 ? 'visible' : 'hidden';
  layer.style.setProperty('--flow-sheen-x', ((p - .5) * 110).toFixed(2) + 'vw');
  layer.style.setProperty('--flow-sheen-y', ((p - .5) * 12).toFixed(2) + 'vh');
  layer.classList.toggle('is-active', alpha > .001);
}
export function clearTransition() { paint('rest', 0, 0, true); }
export function paintJourneyTransition({reduced, worldOpen, drop, flight, mix}) {
  if (worldOpen) return; // The world's own frame owns its optical accent.
  if (flight > .001 && flight < .999) return paint('word', flight, .11, reduced);
  if (mix > .001 && mix < .999) return paint('valley', mix, .075, reduced);
  if (drop > .001 && drop < .999) return paint('drop', drop, .07, reduced);
  paint('rest', 0, 0, reduced);
}
export function paintWorldTransition({s, leg, flow, cards, reduced}) {
  if (leg === 'sea') {
    if (flow?.open && flow.amount < .999) return paint('sea', flow.amount, .13, reduced);
    if (cards?.open && cards.transition < .999) return paint('cards', cards.transition, .10, reduced);
    const h = s.o?.h || 0, between = h - Math.floor(h);
    return paint('strategy', between, .035, reduced);
  }
  if (s.c > .001 && s.c < .999) return paint('clouds', s.c, .09, reduced);
  if (s.principles?.enter > .001 && s.principles.enter < .999) return paint('principles', s.principles.enter, .07, reduced);
  if (s.l?.qWave > .001 && s.l.qWave < .999) return paint('logo', s.l.qWave, .09, reduced);
  paint('rest', 0, 0, reduced);
}
