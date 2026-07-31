import {
  WEASEL_BASE_COUNT,
  WEASEL_MAX,
  WEASEL_PER_NIGHT,
  GRID_W,
  GRID_H,
  TILE,
  FARM_W,
  FARM_H,
} from '../content';
import { mulberry32, randInt, type Rng } from './rng';

export type WeaselType = 'diggler' | 'nibbler' | 'sapper' | 'hauler';

export interface SpawnPoint {
  x: number;
  y: number;
  edge: 'n' | 's' | 'e' | 'w';
  kind: WeaselType;
}

export function weaselCountForDay(day: number, cropValue = 0, weirdness = 0): number {
  const greed = Math.floor(cropValue / 8) + Math.floor(weirdness / 80);
  return Math.min(WEASEL_BASE_COUNT + (day - 1) * WEASEL_PER_NIGHT + greed, WEASEL_MAX);
}

function pickKind(rng: Rng, day: number): WeaselType {
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
  const count = weaselCountForDay(day, cropValue, weirdness);
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

/** 15+ mushroom trap behaviours */
export type TrapBehaviour =
  | 'backflip'
  | 'chase_tail'
  | 'high_five'
  | 'attack_ally'
  | 'walk_off'
  | 'spin'
  | 'sleep'
  | 'zoomies'
  | 'dance'
  | 'confuse'
  | 'shrink'
  | 'grow'
  | 'flee_fast'
  | 'freeze'
  | 'loop';

const TRAP_BEHAVIOURS: TrapBehaviour[] = [
  'backflip',
  'chase_tail',
  'high_five',
  'attack_ally',
  'walk_off',
  'spin',
  'sleep',
  'zoomies',
  'dance',
  'confuse',
  'shrink',
  'grow',
  'flee_fast',
  'freeze',
  'loop',
];

export function rollTrapBehaviour(rng: Rng): TrapBehaviour {
  return TRAP_BEHAVIOURS[randInt(rng, 0, TRAP_BEHAVIOURS.length)]!;
}

export function trapBehaviourLabel(b: TrapBehaviour): string {
  switch (b) {
    case 'backflip':
      return 'backflipped away';
    case 'chase_tail':
      return 'chased its tail';
    case 'high_five':
      return 'high-fived another weasel';
    case 'attack_ally':
      return 'attacked another weasel';
    case 'walk_off':
      return 'walked off the map';
    case 'spin':
      return 'spun in place';
    case 'sleep':
      return 'fell asleep';
    case 'zoomies':
      return 'got the zoomies';
    case 'dance':
      return 'started dancing';
    case 'confuse':
      return 'got confused';
    case 'shrink':
      return 'shrank';
    case 'grow':
      return 'puffed up';
    case 'flee_fast':
      return 'fled at high speed';
    case 'freeze':
      return 'froze solid';
    case 'loop':
      return 'looped forever';
  }
}
