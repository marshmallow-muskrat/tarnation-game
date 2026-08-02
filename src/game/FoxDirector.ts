import type { AnimationAction, AnimationMixer, Object3D } from 'three';
import {
  FOX_SEPARATION,
  FOX_SPEED,
  HAULER_SPEED,
  NIBBLER_SPEED,
  WORLD_SIZE,
} from '../content';
import { tileKey } from '../sim/placement';
import { type FoxType } from '../sim/raid';
import { FoxNavigation } from './FoxNavigation';

const FOX_NAVIGATION_BUDGET = 4096;

export type FoxState = 'burrow' | 'seek' | 'attack' | 'eat' | 'flee' | 'trapped';

export type FoxActions = {
  mixer: AnimationMixer | null;
  idle?: AnimationAction;
  walk?: AnimationAction;
  attack?: AnimationAction;
  active?: AnimationAction;
};

export type Fox = {
  root: Object3D;
  baseScale: number;
  actions: FoxActions;
  x: number;
  z: number;
  state: FoxState;
  kind: FoxType;
  hp: number;
  timer: number;
  targetTx: number;
  targetTy: number;
  eatTimer: number;
  dead: boolean;
  haulSeed: boolean;
  attackSlot: number;
  attackAngle: number;
  trappedTx: number;
  trappedTy: number;
  path: { tx: number; ty: number }[];
  pathGoalKey: string;
  pathTimer: number;
  pathTopologyVersion: number;
};

export type FoxDirectionWorld = {
  worldToFarmTile(x: number, z: number): { tx: number; ty: number } | null;
  farmTileWorld(tx: number, ty: number): { x: number; z: number };
  heightAt(x: number, z: number): number;
  isEnclosed(tx: number, ty: number): boolean;
  topologyVersion(): number;
  obstacleTiles(): ReadonlySet<string>;
};

/** Owns fox target selection, route following, and actor separation. */
export class FoxDirector {
  private readonly navigation = new FoxNavigation();

  constructor(private readonly world: FoxDirectionWorld) {}

  clear(): void {
    this.navigation.clear();
  }

  advance(): number {
    return this.navigation.advance(FOX_NAVIGATION_BUDGET);
  }

  speedFor(kind: FoxType): number {
    if (kind === 'nibbler') return NIBBLER_SPEED;
    if (kind === 'hauler') return HAULER_SPEED;
    return FOX_SPEED;
  }

  moveTowardTile(
    fox: Fox,
    goalTx: number,
    goalTy: number,
    speed: number,
    dt: number,
  ): { atGoal: boolean; hasPath: boolean } {
    const goalKey = tileKey(goalTx, goalTy);
    const current = this.world.worldToFarmTile(fox.x, fox.z);
    if (!current) return { atGoal: false, hasPath: false };
    const goalPosition = this.world.farmTileWorld(goalTx, goalTy);
    if (
      current.tx === goalTx &&
      current.ty === goalTy &&
      Math.hypot(goalPosition.x - fox.x, goalPosition.z - fox.z) < 0.46
    ) {
      return { atGoal: true, hasPath: true };
    }
    if (
      fox.pathGoalKey !== goalKey ||
      fox.pathTopologyVersion !== this.world.topologyVersion() ||
      fox.pathTimer <= 0 ||
      (fox.path.length === 0 && (current.tx !== goalTx || current.ty !== goalTy))
    ) {
      const topologyVersion = this.world.topologyVersion();
      const route = this.navigation.route(
        current.tx,
        current.ty,
        goalTx,
        goalTy,
        topologyVersion,
        this.world.obstacleTiles(),
      );
      fox.pathGoalKey = goalKey;
      fox.pathTopologyVersion = topologyVersion;
      if (route.status === 'pending') {
        fox.path = [];
        fox.pathTimer = 0.05;
        return { atGoal: false, hasPath: true };
      }
      if (route.status === 'unreachable') {
        fox.path = [];
        fox.pathTimer = 0.45;
        return { atGoal: false, hasPath: false };
      }
      fox.path = route.path;
      fox.pathTimer = 0.45;
    } else {
      fox.pathTimer -= dt;
    }

    const next = fox.path[0];
    if (!next) {
      const target = this.world.farmTileWorld(goalTx, goalTy);
      if (Math.hypot(target.x - fox.x, target.z - fox.z) < 0.46) {
        return { atGoal: true, hasPath: true };
      }
      return { atGoal: false, hasPath: false };
    }
    const target = this.world.farmTileWorld(next.tx, next.ty);
    const dx = target.x - fox.x;
    const dz = target.z - fox.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.22) {
      fox.path.shift();
      if (fox.path.length === 0) return { atGoal: true, hasPath: true };
      return this.moveTowardTile(fox, goalTx, goalTy, speed, dt);
    }
    fox.x += (dx / distance) * speed * dt;
    fox.z += (dz / distance) * speed * dt;
    fox.root.position.set(fox.x, this.world.heightAt(fox.x, fox.z), fox.z);
    fox.root.rotation.y = Math.atan2(dx, dz);
    return { atGoal: false, hasPath: true };
  }

  pickTarget(fox: Fox, crops: { x: number; y: number }[]): void {
    const exposed = crops.filter((crop) => !this.world.isEnclosed(crop.x, crop.y));
    if (!exposed.length) {
      fox.targetTx = -1;
      fox.targetTy = -1;
      fox.path = [];
      fox.pathGoalKey = '';
      fox.pathTimer = 0;
      return;
    }
    let best = exposed[0]!;
    let bestDistance = Infinity;
    for (const crop of exposed) {
      const worldPosition = this.world.farmTileWorld(crop.x, crop.y);
      const distance = Math.hypot(fox.x - worldPosition.x, fox.z - worldPosition.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = crop;
      }
    }
    fox.targetTx = best.x;
    fox.targetTy = best.y;
    fox.path = [];
    fox.pathGoalKey = '';
    fox.pathTimer = 0;
  }

  separate(foxes: Fox[]): void {
    for (let i = 0; i < foxes.length; i++) {
      const first = foxes[i]!;
      if (first.dead || first.state === 'trapped') continue;
      for (let j = i + 1; j < foxes.length; j++) {
        const second = foxes[j]!;
        if (second.dead || second.state === 'trapped') continue;
        let dx = first.x - second.x;
        let dz = first.z - second.z;
        let distance = Math.hypot(dx, dz);
        if (distance >= FOX_SEPARATION) continue;
        if (distance < 0.001) {
          const angle = (i * 2.17 + j * 1.31) % (Math.PI * 2);
          dx = Math.sin(angle);
          dz = Math.cos(angle);
          distance = 1;
        }
        const push = (FOX_SEPARATION - distance) * 0.52;
        first.x += (dx / distance) * push;
        first.z += (dz / distance) * push;
        second.x -= (dx / distance) * push;
        second.z -= (dz / distance) * push;
      }
    }
    for (const fox of foxes) {
      if (fox.dead || fox.state === 'trapped') continue;
      fox.x = clamp(fox.x, 2, WORLD_SIZE - 2);
      fox.z = clamp(fox.z, 2, WORLD_SIZE - 2);
      fox.root.position.set(fox.x, this.world.heightAt(fox.x, fox.z), fox.z);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
