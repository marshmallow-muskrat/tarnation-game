import type { AnimationAction, AnimationMixer, Object3D } from 'three';
import {
  FOX_SEPARATION,
  GRID_H,
  GRID_W,
  WORLD_SIZE,
} from '../content';
import { tileKey } from '../sim/placement';
import { foxRoleProfile, type FoxType, type RaidTarget } from '../sim/raid';
import { FoxNavigation } from './FoxNavigation';

const FOX_NAVIGATION_BUDGET = 4096;

export type FoxState = 'burrow' | 'seek' | 'eat' | 'flee' | 'trapped';

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
  silhouetteScale: { x: number; y: number; z: number };
  accessoryRoot: Object3D | null;
  approach: { key: string; tx: number; ty: number } | null;
  hp: number;
  timer: number;
  targetTx: number;
  targetTy: number;
  raidTarget: RaidTarget | null;
  eatTimer: number;
  dead: boolean;
  carryingProduce: boolean;
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
  private readonly approachReservations = new Map<string, Fox>();

  constructor(private readonly world: FoxDirectionWorld) {}

  clear(): void {
    this.navigation.clear();
    for (const fox of this.approachReservations.values()) fox.approach = null;
    this.approachReservations.clear();
  }

  invalidateNavigation(): void {
    this.navigation.clear();
  }

  advance(): number {
    return this.navigation.advance(FOX_NAVIGATION_BUDGET);
  }

  speedFor(kind: FoxType): number {
    return foxRoleProfile(kind).speed;
  }

  reserveApproach(fox: Fox, target: RaidTarget): { tx: number; ty: number } | null {
    this.releaseApproach(fox);
    const offsets = [
      [-1, -1], [1, -1], [1, 1], [-1, 1],
      [0, -1], [1, 0], [0, 1], [-1, 0],
    ] as const;
    for (const [dx, dy] of offsets) {
      const tx = target.x + dx;
      const ty = target.y + dy;
      if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) continue;
      const slotKey = tileKey(tx, ty);
      if (this.world.obstacleTiles().has(slotKey) || this.approachReservations.has(slotKey)) continue;
      this.approachReservations.set(slotKey, fox);
      fox.approach = { key: slotKey, tx, ty };
      return { tx, ty };
    }
    return null;
  }

  releaseApproach(fox: Fox): void {
    if (!fox.approach) return;
    if (this.approachReservations.get(fox.approach.key) === fox) {
      this.approachReservations.delete(fox.approach.key);
    }
    fox.approach = null;
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
    if (current.tx === goalTx && current.ty === goalTy) {
      const dx = goalPosition.x - fox.x;
      const dz = goalPosition.z - fox.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.46) return { atGoal: true, hasPath: true };
      fox.path.length = 0;
      const remaining = Math.max(0, speed * dt);
      if (distance > 0 && remaining > 0) {
        const travel = Math.min(distance, remaining);
        fox.x += (dx / distance) * travel;
        fox.z += (dz / distance) * travel;
        fox.root.position.set(fox.x, this.world.heightAt(fox.x, fox.z), fox.z);
        fox.root.rotation.y = Math.atan2(dx, dz);
      }
      return {
        atGoal: Math.hypot(goalPosition.x - fox.x, goalPosition.z - fox.z) < 0.46,
        hasPath: true,
      };
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

    let remaining = Math.max(0, speed * dt);
    while (fox.path.length > 0) {
      const next = fox.path[0]!;
      const target = this.world.farmTileWorld(next.tx, next.ty);
      const dx = target.x - fox.x;
      const dz = target.z - fox.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.0001) {
        fox.x = target.x;
        fox.z = target.z;
        fox.path.shift();
        continue;
      }
      if (remaining < distance) {
        fox.x += (dx / distance) * remaining;
        fox.z += (dz / distance) * remaining;
        fox.root.position.set(fox.x, this.world.heightAt(fox.x, fox.z), fox.z);
        fox.root.rotation.y = Math.atan2(dx, dz);
        return { atGoal: false, hasPath: true };
      }
      fox.x = target.x;
      fox.z = target.z;
      remaining -= distance;
      fox.path.shift();
    }
    fox.root.position.set(fox.x, this.world.heightAt(fox.x, fox.z), fox.z);
    const target = this.world.farmTileWorld(goalTx, goalTy);
    if (Math.hypot(target.x - fox.x, target.z - fox.z) < 0.46) {
      return { atGoal: true, hasPath: true };
    }
    return { atGoal: false, hasPath: false };
  }

  pickTarget(fox: Fox, crops: { x: number; y: number }[]): void {
    this.releaseApproach(fox);
    const exposed = crops.filter((crop) => !this.world.isEnclosed(crop.x, crop.y));
    if (!exposed.length) {
      fox.targetTx = -1;
      fox.targetTy = -1;
      fox.raidTarget = null;
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
    const target: RaidTarget = {
      kind: 'crop',
      x: best.x,
      y: best.y,
      distance: bestDistance,
      exposed: true,
    };
    if (!this.reserveApproach(fox, target)) {
      fox.targetTx = -1;
      fox.targetTy = -1;
      fox.raidTarget = null;
      fox.path = [];
      fox.pathGoalKey = '';
      fox.pathTimer = 0;
      return;
    }
    fox.targetTx = best.x;
    fox.targetTy = best.y;
    fox.raidTarget = target;
    fox.path = [];
    fox.pathGoalKey = '';
    fox.pathTimer = 0;
  }

  separate(foxes: Fox[]): void {
    for (let pass = 0; pass < 24; pass++) {
      let changed = false;
      for (let i = 0; i < foxes.length; i++) {
        const first = foxes[i]!;
        if (first.dead || first.state === 'trapped') continue;
        for (let j = i + 1; j < foxes.length; j++) {
          const second = foxes[j]!;
          if (second.dead || second.state === 'trapped') continue;
          let dx = first.x - second.x;
          let dz = first.z - second.z;
          const distance = Math.hypot(dx, dz);
          if (distance >= FOX_SEPARATION) continue;
          if (distance < 0.0001) {
            const angle = (i * 2.17 + j * 1.31) % (Math.PI * 2);
            dx = Math.sin(angle);
            dz = Math.cos(angle);
          } else {
            dx /= distance;
            dz /= distance;
          }
          const correction = (FOX_SEPARATION - distance) * 0.5;
          first.x += dx * correction;
          first.z += dz * correction;
          second.x -= dx * correction;
          second.z -= dz * correction;
          changed = true;
        }
      }
      if (!changed) break;
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
