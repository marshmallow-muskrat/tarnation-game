import { tileKey } from './placement';

/** A tile's gameplay role is explicit instead of being inferred from one mask. */
export type OccupancyClass =
  | 'hard-obstacle'
  | 'soft-obstacle'
  | 'decorative'
  | 'interaction-only'
  | 'reservation';

/** Consumers ask the same policy whether a class blocks their operation. */
export type OccupancyConsumer =
  | 'player'
  | 'wildlife'
  | 'tools'
  | 'placement'
  | 'scatter'
  | 'enclosure';

/**
 * Hard obstacles are physical actor blockers. Soft obstacles are worked or
 * occupied ground, while trees/rocks remain interaction-only: they stop clear
 * ground actions without becoming walls for actors. Reservations protect land
 * from editing and decoration, but intentionally do not trap actors or change
 * enclosure topology. Decorative content has no gameplay authority.
 */
export const OCCUPANCY_POLICY: Readonly<Record<OccupancyClass, Readonly<Record<OccupancyConsumer, boolean>>>> = {
  'hard-obstacle': {
    player: true,
    wildlife: true,
    tools: true,
    placement: true,
    scatter: true,
    enclosure: true,
  },
  'soft-obstacle': {
    player: false,
    wildlife: false,
    tools: true,
    placement: true,
    scatter: true,
    enclosure: false,
  },
  decorative: {
    player: false,
    wildlife: false,
    tools: false,
    placement: false,
    scatter: false,
    enclosure: false,
  },
  'interaction-only': {
    player: false,
    wildlife: false,
    tools: true,
    placement: true,
    scatter: true,
    enclosure: false,
  },
  reservation: {
    player: false,
    wildlife: false,
    tools: true,
    placement: true,
    scatter: true,
    enclosure: false,
  },
};

export function blocksFor(occupancyClass: OccupancyClass, consumer: OccupancyConsumer): boolean {
  return OCCUPANCY_POLICY[occupancyClass][consumer];
}

export type ScatterOccupancySources = Partial<Record<OccupancyClass, ReadonlySet<string>>> & {
  /** Authored path tiles are soft ground with a one-tile visual clearance. */
  paths?: ReadonlySet<string>;
};

export type ScatterClearance = Partial<Record<OccupancyClass, number>> & {
  paths?: number;
};

/** Add a tile and its square clearance neighborhood to a decorative mask. */
export function addTileClearance(
  target: Set<string>,
  keys: ReadonlySet<string>,
  radius: number,
): void {
  const distance = Math.max(0, Math.floor(radius));
  for (const key of keys) {
    const [rawTx, rawTy] = key.split(',');
    const tx = Number(rawTx);
    const ty = Number(rawTy);
    if (!Number.isInteger(tx) || !Number.isInteger(ty)) {
      target.add(key);
      continue;
    }
    for (let dy = -distance; dy <= distance; dy++) {
      for (let dx = -distance; dx <= distance; dx++) {
        target.add(tileKey(tx + dx, ty + dy));
      }
    }
  }
}

/**
 * Build the renderer-only scatter mask from the same occupancy classes used by
 * actors and editing. The mask may extend beyond the source footprint so tall
 * props and authored paths keep a readable visual margin.
 */
export function buildScatterOccupancy(
  sources: ScatterOccupancySources,
  clearance: ScatterClearance = {},
): Set<string> {
  const result = new Set<string>();
  const classes: OccupancyClass[] = [
    'hard-obstacle',
    'soft-obstacle',
    'decorative',
    'interaction-only',
    'reservation',
  ];
  for (const occupancyClass of classes) {
    const keys = sources[occupancyClass];
    if (!keys || !blocksFor(occupancyClass, 'scatter')) continue;
    addTileClearance(result, keys, clearance[occupancyClass] ?? 0);
  }
  if (sources.paths) addTileClearance(result, sources.paths, clearance.paths ?? 1);
  return result;
}
