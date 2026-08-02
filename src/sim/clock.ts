import { DAY_LENGTH, NIGHT_LENGTH } from '../content';

export type Phase = 'day' | 'night';

export interface ClockState {
  day: number;
  phase: Phase;
  elapsed: number; // seconds into current phase
  t: number; // 0..1 through current phase
}

export function createClock(day = 1, phase: Phase = 'day', elapsed = 0): ClockState {
  const length = phase === 'day' ? DAY_LENGTH : NIGHT_LENGTH;
  return {
    day,
    phase,
    elapsed,
    t: Math.min(1, elapsed / length),
  };
}

export interface ClockStepResult {
  clock: ClockState;
  phaseChanged: boolean;
  becameNight: boolean;
  becameDay: boolean;
  previousPhase: Phase;
}

/** Advance clock by fixed dt seconds. Pure. */
export function stepClock(clock: ClockState, dt: number): ClockStepResult {
  const length = clock.phase === 'day' ? DAY_LENGTH : NIGHT_LENGTH;
  let elapsed = clock.elapsed + dt;
  let day = clock.day;
  let phase = clock.phase;
  let phaseChanged = false;
  let becameNight = false;
  let becameDay = false;
  const previousPhase = clock.phase;

  if (elapsed >= length) {
    elapsed = 0;
    phaseChanged = true;
    if (phase === 'day') {
      phase = 'night';
      becameNight = true;
    } else {
      phase = 'day';
      day += 1;
      becameDay = true;
    }
  }

  const newLength = phase === 'day' ? DAY_LENGTH : NIGHT_LENGTH;
  return {
    clock: {
      day,
      phase,
      elapsed,
      t: Math.min(1, elapsed / newLength),
    },
    phaseChanged,
    becameNight,
    becameDay,
    previousPhase,
  };
}

export function phaseLength(phase: Phase): number {
  return phase === 'day' ? DAY_LENGTH : NIGHT_LENGTH;
}

/** Night overlay alpha 0..0.55 with smooth dusk/dawn ramps at phase edges. */
export function nightTintAlpha(clock: ClockState): number {
  const maxA = 0.55;
  if (clock.phase === 'night') {
    // fade in first 10%, hold, fade out last 10%
    if (clock.t < 0.1) return (clock.t / 0.1) * maxA;
    if (clock.t > 0.9) return ((1 - clock.t) / 0.1) * maxA;
    return maxA;
  }
  // day: slight dusk near end, dawn near start is 0
  if (clock.t > 0.92) return ((clock.t - 0.92) / 0.08) * maxA * 0.5;
  return 0;
}

export function isDuskNear(clock: Pick<ClockState, 'phase' | 't'>): boolean {
  return clock.phase === 'day' && clock.t >= 0.85;
}
