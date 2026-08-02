export const PLAYER_ACTION_STATES = [
  'idle',
  'move',
  'tool_windup',
  'tool_contact',
  'tool_recover',
  'ranged_aim',
  'ranged_fire',
  'interact',
  'menu',
  'disabled',
] as const;

export type PlayerActionState = (typeof PLAYER_ACTION_STATES)[number];
export type PlayerActionKind = 'tool' | 'ranged' | 'interact';

/**
 * Logical timings are simulation timings, not animation-clip timings. The
 * renderer may interpolate a clip at a different frame rate, but gameplay
 * effects are emitted from these fixed-step phases.
 */
export type ActionTiming = Readonly<{
  windup: number;
  contact: number;
  recover: number;
}>;

export type ActionRequest<T> = Readonly<{
  kind: PlayerActionKind;
  timing: ActionTiming;
  payload: T;
  /** A single follow-up may be queued during the contact/recovery window. */
  bufferable?: boolean;
}>;

export type ActionAdmission = Readonly<{
  disposition: 'started' | 'buffered' | 'rejected';
  actionId: number | null;
}>;

export type ActionEvent<T> = Readonly<{
  type: 'start' | 'contact' | 'fire' | 'complete';
  actionId: number;
  kind: PlayerActionKind;
  payload: T;
}>;

export type ActionTransition = Readonly<{
  from: PlayerActionState;
  to: PlayerActionState;
  reason:
    | 'movement'
    | 'start'
    | 'phase'
    | 'complete'
    | 'cancel'
    | 'menu'
    | 'focus_lost'
    | 'focus_restored';
  actionId: number | null;
}>;

export const DEFAULT_TOOL_ACTION_TIMING: ActionTiming = {
  windup: 0.12,
  contact: 0.05,
  recover: 0.18,
};

export const DEFAULT_RANGED_ACTION_TIMING: ActionTiming = {
  windup: 0.08,
  contact: 0.06,
  recover: 0,
};

export const DEFAULT_INTERACT_ACTION_TIMING: ActionTiming = {
  windup: 0.08,
  contact: 0,
  recover: 0.08,
};

/**
 * Fixed-step action authority for player controls.
 *
 * The machine deliberately knows nothing about Three.js, input devices, or
 * game-state mutation. It accepts intent, advances by simulation time, and
 * emits contact/fire events for the composition root to apply.
 */
export class ActionStateMachine<T> {
  private state: PlayerActionState = 'idle';
  private moving = false;
  private nextActionId = 1;
  private active: ActiveAction<T> | null = null;
  private buffered: PendingAction<T> | null = null;
  private readonly events: ActionEvent<T>[] = [];
  private readonly transitions: ActionTransition[] = [];

  get currentState(): PlayerActionState {
    return this.state;
  }

  get isBusy(): boolean {
    return this.active !== null;
  }

  get hasBufferedInput(): boolean {
    return this.buffered !== null;
  }

  /**
   * Movement remains responsive during tool and ranged phases, but is bounded
   * while an action is committed. Menus and focus loss have no movement.
   */
  get movementScale(): number {
    switch (this.state) {
      case 'tool_windup':
      case 'tool_recover':
        return 0.75;
      case 'tool_contact':
        return 0.45;
      case 'ranged_aim':
        return 0.85;
      case 'ranged_fire':
        return 0.65;
      case 'interact':
        return 0;
      case 'menu':
      case 'disabled':
        return 0;
      case 'idle':
      case 'move':
        return 1;
    }
  }

  setMovementIntent(moving: boolean): void {
    this.moving = moving;
    if (this.active || this.state === 'menu' || this.state === 'disabled') return;
    this.transition(moving ? 'move' : 'idle', 'movement', null);
  }

  request(request: ActionRequest<T>): ActionAdmission {
    if (this.state === 'menu' || this.state === 'disabled') {
      return { disposition: 'rejected', actionId: null };
    }

    const pending: PendingAction<T> = {
      actionId: this.nextActionId++,
      request,
    };
    if (this.active) {
      if (
        request.bufferable !== false &&
        this.active.request.kind === request.kind &&
        this.state !== 'tool_windup' &&
        this.state !== 'ranged_aim' &&
        this.buffered === null
      ) {
        this.buffered = pending;
        return { disposition: 'buffered', actionId: pending.actionId };
      }
      return { disposition: 'rejected', actionId: null };
    }

    this.start(pending);
    return { disposition: 'started', actionId: pending.actionId };
  }

  /** Advance the current action using fixed simulation seconds. */
  advance(dt: number): void {
    if (this.state === 'menu' || this.state === 'disabled' || !this.active) return;
    let remaining = Math.max(0, dt);
    while (this.active && remaining >= 0) {
      const phase = this.active.phases[this.active.phaseIndex];
      if (!phase) {
        this.completeActive();
        continue;
      }
      if (phase.remaining > 0 && remaining < phase.remaining) {
        phase.remaining -= remaining;
        remaining = 0;
        break;
      }

      const consumed = phase.remaining;
      phase.remaining = 0;
      remaining = Math.max(0, remaining - consumed);
      if (!this.active) break;
      this.active.phaseIndex += 1;
      if (this.active.phaseIndex >= this.active.phases.length) {
        this.completeActive();
      } else {
        const next = this.active.phases[this.active.phaseIndex]!;
        this.transition(next.state, 'phase', this.active.actionId);
        this.emitPhaseEvent(next);
      }
      if (remaining === 0) {
        const next = this.active?.phases[this.active.phaseIndex];
        if (next && next.remaining > 0) break;
      }
    }
  }

  /** Cancel the active and buffered actions without disabling future input. */
  cancel(reason: 'cancel' | 'focus_lost' = 'cancel'): number[] {
    const cancelled = [
      ...(this.active ? [this.active.actionId] : []),
      ...(this.buffered ? [this.buffered.actionId] : []),
    ];
    this.active = null;
    this.buffered = null;
    if (this.state !== 'menu' && this.state !== 'disabled') {
      this.transition(this.moving ? 'move' : 'idle', reason, null);
    }
    return cancelled;
  }

  enterMenu(): number[] {
    const cancelled = this.cancel('cancel');
    if (this.state !== 'disabled') this.transition('menu', 'menu', null);
    return cancelled;
  }

  exitMenu(): void {
    if (this.state !== 'menu') return;
    this.transition(this.moving ? 'move' : 'idle', 'menu', null);
  }

  disable(): number[] {
    const cancelled = this.cancel('focus_lost');
    this.transition('disabled', 'focus_lost', null);
    return cancelled;
  }

  enable(): void {
    if (this.state !== 'disabled') return;
    this.transition(this.moving ? 'move' : 'idle', 'focus_restored', null);
  }

  drainEvents(): ActionEvent<T>[] {
    return this.events.splice(0, this.events.length);
  }

  drainTransitions(): ActionTransition[] {
    return this.transitions.splice(0, this.transitions.length);
  }

  private start(pending: PendingAction<T>): void {
    this.active = {
      actionId: pending.actionId,
      request: pending.request,
      phaseIndex: 0,
      phases: phasesFor(pending.request),
    };
    const first = this.active.phases[0]!;
    this.transition(first.state, 'start', pending.actionId);
    this.events.push({
      type: 'start',
      actionId: pending.actionId,
      kind: pending.request.kind,
      payload: pending.request.payload,
    });
  }

  private emitPhaseEvent(phase: ActionPhase): void {
    if (!this.active || !phase.event) return;
    this.events.push({
      type: phase.event,
      actionId: this.active.actionId,
      kind: this.active.request.kind,
      payload: this.active.request.payload,
    });
  }

  private completeActive(): void {
    const completed = this.active;
    if (!completed) return;
    this.events.push({
      type: 'complete',
      actionId: completed.actionId,
      kind: completed.request.kind,
      payload: completed.request.payload,
    });
    this.active = null;
    this.transition(this.moving ? 'move' : 'idle', 'complete', completed.actionId);
    const buffered = this.buffered;
    this.buffered = null;
    if (buffered) this.start(buffered);
  }

  private transition(
    to: PlayerActionState,
    reason: ActionTransition['reason'],
    actionId: number | null,
  ): void {
    if (this.state === to) return;
    const from = this.state;
    this.state = to;
    this.transitions.push({ from, to, reason, actionId });
  }
}

type PendingAction<T> = Readonly<{
  actionId: number;
  request: ActionRequest<T>;
}>;

type ActionPhase = {
  state: Extract<PlayerActionState, 'tool_windup' | 'tool_contact' | 'tool_recover' | 'ranged_aim' | 'ranged_fire' | 'interact'>;
  remaining: number;
  event: 'contact' | 'fire' | null;
};

type ActiveAction<T> = {
  actionId: number;
  request: ActionRequest<T>;
  phases: ActionPhase[];
  phaseIndex: number;
};

function safeDuration(seconds: number): number {
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function phasesFor<T>(request: ActionRequest<T>): ActionPhase[] {
  const windup = safeDuration(request.timing.windup);
  const contact = safeDuration(request.timing.contact);
  const recover = safeDuration(request.timing.recover);
  switch (request.kind) {
    case 'tool':
      return [
        { state: 'tool_windup', remaining: windup, event: null },
        { state: 'tool_contact', remaining: contact, event: 'contact' },
        { state: 'tool_recover', remaining: recover, event: null },
      ];
    case 'ranged':
      return [
        { state: 'ranged_aim', remaining: windup, event: null },
        { state: 'ranged_fire', remaining: contact + recover, event: 'fire' },
      ];
    case 'interact':
      return [
        { state: 'interact', remaining: windup, event: null },
        { state: 'interact', remaining: contact + recover, event: 'contact' },
      ];
  }
}
