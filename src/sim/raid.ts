import {
  FOX_BASE_COUNT,
  FOX_MAX,
  FOX_PER_NIGHT,
  GRID_W,
  GRID_H,
  TILE,
  FARM_W,
  FARM_H,
} from '../content';
import { mulberry32, randInt, type Rng } from './rng';

export type FoxType = 'diggler' | 'nibbler' | 'sapper' | 'hauler';

export type RaidTargetKind = 'crop' | 'stored_produce' | 'structure';
export type RaidStructureKind = 'gate' | 'trap' | 'trench';

export type RaidTarget =
  | {
      kind: 'crop';
      x: number;
      y: number;
      distance: number;
      exposed: boolean;
    }
  | {
      kind: 'stored_produce';
      x: number;
      y: number;
      distance: number;
      id: string;
      count: number;
      value: number;
    }
  | {
      kind: 'structure';
      x: number;
      y: number;
      distance: number;
      structure: RaidStructureKind;
      index: number;
    };

export type RaidLifecycleState =
  | 'burrow'
  | 'seek'
  | 'eat'
  | 'trapped'
  | 'flee'
  | 'defeated'
  | 'dawn_cleanup';

export type RaidLifecyclePhase = 'preparation' | 'action' | 'retreat' | 'reward' | 'dawn_cleanup';

/**
 * The released raid has no player-health state. These phases describe the
 * player-visible contract: a warning/burrow window, world-target action,
 * retreat, a fox defeat reward, and dawn cleanup.
 */
export function raidLifecyclePhase(state: RaidLifecycleState): RaidLifecyclePhase {
  if (state === 'burrow') return 'preparation';
  if (state === 'flee') return 'retreat';
  if (state === 'defeated') return 'reward';
  if (state === 'dawn_cleanup') return 'dawn_cleanup';
  return 'action';
}

const STRUCTURE_PRIORITY: Record<RaidStructureKind, number> = {
  gate: 0,
  trap: 1,
  trench: 2,
};

/**
 * Choose a deterministic world consequence for one fox. Candidates already
 * carry their distance from that fox; exposed is intentionally explicit so a
 * crop behind a completed enclosure cannot become a hidden fallback target.
 */
export function selectRaidTarget(
  kind: FoxType,
  candidates: readonly RaidTarget[],
): RaidTarget | null {
  const valid = candidates.filter((candidate) => Number.isFinite(candidate.distance));
  const crops = valid.filter(
    (candidate): candidate is Extract<RaidTarget, { kind: 'crop' }> =>
      candidate.kind === 'crop' && candidate.exposed,
  );

  if (kind === 'hauler') {
    const stored = valid.filter(
      (candidate): candidate is Extract<RaidTarget, { kind: 'stored_produce' }> =>
        candidate.kind === 'stored_produce' && candidate.count > 0,
    );
    const bestStored = chooseBest(stored, (a, b) =>
      b.value - a.value ||
      a.distance - b.distance ||
      compareStrings(a.id, b.id) ||
      a.y - b.y ||
      a.x - b.x,
    );
    if (bestStored) return bestStored;
  }

  if (kind === 'sapper') {
    const structures = valid.filter(
      (candidate): candidate is Extract<RaidTarget, { kind: 'structure' }> => candidate.kind === 'structure',
    );
    const bestStructure = chooseBest(
      structures,
      (a, b) =>
        STRUCTURE_PRIORITY[a.structure] - STRUCTURE_PRIORITY[b.structure] ||
        a.distance - b.distance ||
        a.y - b.y ||
        a.x - b.x ||
        a.index - b.index,
    );
    if (bestStructure) return bestStructure;
  }

  return chooseBest(crops, (a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
}

function chooseBest<T extends RaidTarget>(items: readonly T[], compare: (a: T, b: T) => number): T | null {
  let best: T | null = null;
  for (const item of items) {
    if (!best || compare(item, best) < 0) best = item;
  }
  return best;
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export interface SpawnPoint {
  x: number;
  y: number;
  edge: 'n' | 's' | 'e' | 'w';
  kind: FoxType;
}

export function foxCountForDay(day: number, cropValue = 0, weirdness = 0): number {
  const greed = Math.floor(cropValue / 8) + Math.floor(weirdness / 80);
  return Math.min(FOX_BASE_COUNT + (day - 1) * FOX_PER_NIGHT + greed, FOX_MAX);
}

function pickKind(rng: Rng, day: number): FoxType {
  const r = rng();
  if (day >= 4 && r < 0.15) return 'hauler';
  if (day >= 3 && r < 0.35) return 'sapper';
  if (day >= 2 && r < 0.55) return 'nibbler';
  return 'diggler';
}

/** Pure wave generation from day + seed + optional greed factors. */
export function generateWave(
  day: number,
  seed: number,
  cropValue = 0,
  weirdness = 0,
): SpawnPoint[] {
  const rng = mulberry32((seed ^ (day * 0x9e3779b9)) >>> 0);
  const count = foxCountForDay(day, cropValue, weirdness);
  const points: SpawnPoint[] = [];
  for (let i = 0; i < count; i++) {
    const sp = randomEdgeSpawn(rng);
    points.push({ ...sp, kind: pickKind(rng, day) });
  }
  return points;
}

function randomEdgeSpawn(rng: Rng): Omit<SpawnPoint, 'kind'> {
  const edge = (['n', 's', 'e', 'w'] as const)[randInt(rng, 0, 4)]!;
  let x = 0;
  let y = 0;
  switch (edge) {
    case 'n':
      x = randInt(rng, 0, GRID_W) * TILE + TILE / 2;
      y = TILE / 2;
      break;
    case 's':
      x = randInt(rng, 0, GRID_W) * TILE + TILE / 2;
      y = FARM_H - TILE / 2;
      break;
    case 'w':
      x = TILE / 2;
      y = randInt(rng, 0, GRID_H) * TILE + TILE / 2;
      break;
    case 'e':
      x = FARM_W - TILE / 2;
      y = randInt(rng, 0, GRID_H) * TILE + TILE / 2;
      break;
  }
  return { x, y, edge };
}

export function nearestEdgePoint(x: number, y: number): { x: number; y: number } {
  const distN = y;
  const distS = FARM_H - y;
  const distW = x;
  const distE = FARM_W - x;
  const min = Math.min(distN, distS, distW, distE);
  if (min === distN) return { x, y: 0 };
  if (min === distS) return { x, y: FARM_H };
  if (min === distW) return { x: 0, y };
  return { x: FARM_W, y };
}
