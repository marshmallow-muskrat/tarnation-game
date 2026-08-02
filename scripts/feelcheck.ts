import {
  FEEL_TIMELINES,
  PresentationTimeline,
  type FeelEvent,
} from '../src/game/FeelTimeline';

const events = Object.keys(FEEL_TIMELINES) as FeelEvent[];
const fixedSteps = 60 * 60 * 60;

function runSoak(): { emitted: number; peakActive: number } {
  const timeline = new PresentationTimeline();
  let emitted = 0;
  let peakActive = 0;
  for (let step = 0; step < fixedSteps; step++) {
    timeline.advance(1 / 60);
    if (timeline.trigger(events[step % events.length]!)) emitted++;
    peakActive = Math.max(peakActive, timeline.activeCount);
  }
  return { emitted, peakActive };
}

const first = runSoak();
const second = runSoak();
if (first.emitted <= 0 || first.peakActive > events.length || first.emitted !== second.emitted || first.peakActive !== second.peakActive) {
  throw new Error(`Feel soak failed: ${JSON.stringify({ first, second, events: events.length })}`);
}

console.log(
  `Feel soak passed: ${fixedSteps.toLocaleString()} fixed steps (1 simulated hour), ` +
  `${first.emitted.toLocaleString()} bounded bundles, peak active=${first.peakActive}.`,
);
