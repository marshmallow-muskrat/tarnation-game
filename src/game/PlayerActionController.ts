import * as THREE from 'three';
import { PLAYER_SPEED } from '../content';
import {
  LOCOMOTION_GAIT,
  locomotionClipFor,
  locomotionModeFor,
  locomotionTimeScale,
  type LocomotionMode,
} from './Locomotion';

export type PlayerClip =
  | 'idle'
  | 'walk'
  | 'run'
  | 'walkCarry'
  | 'runCarry'
  | 'pickUp'
  | 'shoot'
  | 'swordSlash'
  | 'punch';

export type CarryAnimationProfile = {
  runClip: 'walkCarry' | 'runCarry';
  idleTime: number;
};

/** The authored locomotion choice before resolving missing clips to fallbacks. */
export function chooseLocomotionAction(
  moving: boolean,
  speed: number,
  carryProfile: CarryAnimationProfile | null,
  playerSpeed = PLAYER_SPEED,
  previousMode: LocomotionMode | null = null,
): Extract<PlayerClip, 'idle' | 'walk' | 'run' | 'walkCarry' | 'runCarry'> {
  const inferredMode = previousMode ?? (moving
    ? speed >= playerSpeed * 0.72 ? 'run' : 'walk'
    : 'idle');
  return locomotionClipFor(
    locomotionModeFor(moving, speed, inferredMode, playerSpeed),
    carryProfile,
  );
}

/**
 * Owns the player's animation mixer and one-shot/locomotion transitions.
 * GameRuntime remains responsible for fixed-step movement and calls this
 * renderer-facing controller after the simulation has produced the current
 * velocity and equipment state.
 */
export class PlayerActionController {
  readonly root: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer | null;
  private readonly idleAction: THREE.AnimationAction | null;
  private readonly walkAction: THREE.AnimationAction | null;
  private readonly actions: Partial<Record<PlayerClip, THREE.AnimationAction>> = {};
  private activeLocomotionAction: THREE.AnimationAction | null = null;
  private oneShotAction: THREE.AnimationAction | null = null;
  private locomotionMode: LocomotionMode = 'idle';
  private reducedMotion = false;
  private disposed = false;

  constructor(root: THREE.Object3D, animations: readonly THREE.AnimationClip[]) {
    this.root = root;
    if (animations.length === 0) {
      this.mixer = null;
      this.idleAction = null;
      this.walkAction = null;
      return;
    }

    this.mixer = new THREE.AnimationMixer(root);
    const idle = animations.find((clip) => /idle/i.test(clip.name)) ?? animations[0]!;
    const walk =
      animations.find((clip) => /^walk$/i.test(clip.name)) ??
      animations.find((clip) => /walk|run|locomotion/i.test(clip.name)) ??
      animations[1] ??
      animations[0]!;
    this.idleAction = this.mixer.clipAction(idle);
    this.walkAction = this.mixer.clipAction(walk);
    const clipAction = (pattern: RegExp): THREE.AnimationAction | undefined => {
      const clip = animations.find((candidate) => pattern.test(candidate.name));
      return clip ? this.mixer!.clipAction(clip) : undefined;
    };
    this.actions.idle = this.idleAction;
    this.actions.walk = this.walkAction;
    this.actions.run = clipAction(/^run$/i);
    this.actions.walkCarry = clipAction(/^walk_carry$/i);
    this.actions.runCarry = clipAction(/^run_carry$/i);
    this.actions.pickUp = clipAction(/^pickup$/i);
    this.actions.shoot = clipAction(/^shoot_onehanded$/i);
    this.actions.swordSlash = clipAction(/^swordslash$/i);
    this.actions.punch = clipAction(/^punch$/i);
    this.idleAction.play();
    this.activeLocomotionAction = this.idleAction;
  }

  get isOneShotRunning(): boolean {
    return this.oneShotAction?.isRunning() ?? false;
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

  update(dt: number): void {
    if (this.disposed) return;
    this.mixer?.update(dt);
  }

  updateLocomotion(
    moving: boolean,
    speed: number,
    carryProfile: CarryAnimationProfile | null,
    playerSpeed = PLAYER_SPEED,
  ): void {
    if (this.disposed || !this.idleAction || !this.walkAction) return;
    if (this.isOneShotRunning) return;
    const finishedAction = this.oneShotAction;
    this.oneShotAction = null;

    const carry = carryProfile !== null;
    const carryIdle = carry ? this.actions.walkCarry ?? this.walkAction : null;
    this.locomotionMode = locomotionModeFor(moving, speed, this.locomotionMode, playerSpeed);
    const selected = locomotionClipFor(this.locomotionMode, carryProfile);
    const locomotion = selected === 'runCarry'
      ? this.actions.runCarry ?? this.actions.walkCarry ?? this.walkAction
      : selected === 'walkCarry'
        ? carryIdle ?? this.walkAction
        : selected === 'run'
          ? this.actions.run ?? this.actions.walk ?? this.walkAction
          : selected === 'walk'
            ? this.actions.walk ?? this.walkAction
            : this.actions.idle ?? this.idleAction;

    locomotion.enabled = true;
    const transitionFrom = finishedAction ?? this.activeLocomotionAction;
    if (finishedAction || locomotion !== this.activeLocomotionAction) {
      locomotion.paused = false;
      locomotion.reset().setEffectiveWeight(1).play();
      if (transitionFrom && transitionFrom !== locomotion) {
        transitionFrom.paused = false;
        transitionFrom.crossFadeTo(locomotion, LOCOMOTION_GAIT.transitionSeconds, true);
      } else {
        locomotion.fadeIn(LOCOMOTION_GAIT.transitionSeconds);
      }
      this.activeLocomotionAction = locomotion;
    } else if (!locomotion.isRunning()) {
      locomotion.play();
    }

    // There is no authored Idle_Carry clip. Freeze Walk_Carry at the same calm
    // frame used by the old runtime while stationary with a held tool.
    if ((carry && this.locomotionMode === 'idle' && locomotion === carryIdle) ||
      (this.reducedMotion && this.locomotionMode === 'idle')) {
      locomotion.time = locomotion.getClip().duration * (carryProfile?.idleTime ?? 0.34);
      locomotion.paused = true;
    } else {
      locomotion.paused = false;
      locomotion.setEffectiveTimeScale(
        locomotionTimeScale(selected, speed, playerSpeed),
      );
    }
  }

  play(clip: PlayerClip): void {
    if (this.disposed) return;
    const action = this.actions[clip];
    if (!action) return;
    this.oneShotAction?.stop();
    if (this.activeLocomotionAction) {
      this.activeLocomotionAction.paused = false;
      this.activeLocomotionAction.fadeOut(0.1);
    }
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveWeight(1).fadeIn(0.1).play();
    this.oneShotAction = action;
  }

  cancel(): void {
    if (this.disposed) return;
    this.oneShotAction?.fadeOut(0.1);
    this.oneShotAction = null;
    this.activeLocomotionAction = null;
    this.locomotionMode = 'idle';
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer?.stopAllAction();
    this.mixer?.uncacheRoot(this.root);
    this.activeLocomotionAction = null;
    this.oneShotAction = null;
    this.locomotionMode = 'idle';
  }
}
