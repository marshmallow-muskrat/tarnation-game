import { GRID_H, GRID_W } from '../content';
import { canTraverseGridStep, GRID_DIRECTIONS_8, tileKey } from '../sim/placement';

export type NavigationRouteStatus = 'pending' | 'ready' | 'unreachable';

export type NavigationRoute = {
  status: NavigationRouteStatus;
  /** The route excludes the starting tile and includes the requested goal. */
  path: { tx: number; ty: number }[];
};

type RouteField = {
  key: string;
  goalTx: number;
  goalTy: number;
  goalIndex: number;
  blocked: ReadonlySet<string>;
  parent: Int32Array;
  queue: Int32Array;
  head: number;
  tail: number;
  complete: boolean;
};

const UNVISITED = -2;
const ROOT = -1;

/**
 * Incremental reverse-BFS fields for raid animals.
 *
 * A field is keyed by the target tile and the topology version supplied by the
 * runtime. It is expanded from the target outward, so every fox seeking the same
 * crop or player tile shares the work. `advance()` is deliberately budgeted: a
 * large farm can take several fixed steps to finish a field, but no fixed step can
 * accidentally perform one full-grid search per fox.
 */
export class FoxNavigation {
  private readonly fields = new Map<string, RouteField>();
  private readonly work = new RouteFieldQueue();
  private readonly pathScratch: { tx: number; ty: number }[] = [];

  /** Drop fields when a fence, gate, or other movement topology changes. */
  clear(): void {
    this.fields.clear();
    this.work.clear();
  }

  /** Number of route fields currently retained, useful for diagnostics/tests. */
  get fieldCount(): number {
    return this.fields.size;
  }

  /** Number of nodes still waiting to be expanded across all requested fields. */
  get pendingNodeCount(): number {
    return this.work.pendingNodeCount;
  }

  /**
   * Request a field without doing unbounded work. Calling this before `advance`
   * lets a fixed simulation step spend its entire budget on all known goals.
   */
  request(
    goalTx: number,
    goalTy: number,
    topologyVersion: number,
    blocked: ReadonlySet<string>,
  ): void {
    this.getOrCreateField(goalTx, goalTy, topologyVersion, blocked);
  }

  /** Expand all requested fields by at most `maxNodes` total. */
  advance(maxNodes: number): number {
    let expanded = 0;
    while (expanded < maxNodes) {
      const field = this.work.next();
      if (!field) break;
      this.expandOne(field);
      expanded++;
      if (!field.complete) this.work.push(field);
    }
    return expanded;
  }

  /**
   * Return the currently available route. A pending field never reports a false
   * dead end; callers can keep the animal in its current seek state while later
   * fixed steps finish the bounded search.
   */
  route(
    startTx: number,
    startTy: number,
    goalTx: number,
    goalTy: number,
    topologyVersion: number,
    blocked: ReadonlySet<string>,
  ): NavigationRoute {
    if (!inBounds(startTx, startTy) || !inBounds(goalTx, goalTy)) {
      return { status: 'unreachable', path: [] };
    }
    if (startTx === goalTx && startTy === goalTy) {
      return { status: 'ready', path: [] };
    }
    if (blocked.has(tileKey(goalTx, goalTy))) {
      return { status: 'unreachable', path: [] };
    }

    const field = this.getOrCreateField(goalTx, goalTy, topologyVersion, blocked);
    let cursor = startTy * GRID_W + startTx;
    if (field.parent[cursor] === UNVISITED) {
      return field.complete
        ? { status: 'unreachable', path: [] }
        : { status: 'pending', path: [] };
    }

    this.pathScratch.length = 0;
    let guard = 0;
    while (cursor !== field.goalIndex && guard < GRID_W * GRID_H) {
      const parent = field.parent[cursor];
      if (parent < 0) {
        this.pathScratch.length = 0;
        return { status: 'unreachable', path: [] };
      }
      this.pathScratch.push({ tx: parent % GRID_W, ty: Math.floor(parent / GRID_W) });
      cursor = parent;
      guard++;
    }
    if (cursor !== field.goalIndex) {
      this.pathScratch.length = 0;
      return { status: 'unreachable', path: [] };
    }
    return { status: 'ready', path: this.pathScratch.map((tile) => ({ ...tile })) };
  }

  private getOrCreateField(
    goalTx: number,
    goalTy: number,
    topologyVersion: number,
    blocked: ReadonlySet<string>,
  ): RouteField {
    const key = `${topologyVersion}:${tileKey(goalTx, goalTy)}`;
    const existing = this.fields.get(key);
    if (existing) return existing;

    const goalIndex = goalTy * GRID_W + goalTx;
    const parent = new Int32Array(GRID_W * GRID_H);
    parent.fill(UNVISITED);
    const queue = new Int32Array(GRID_W * GRID_H);
    const field: RouteField = {
      key,
      goalTx,
      goalTy,
      goalIndex,
      blocked,
      parent,
      queue,
      head: 0,
      tail: 0,
      complete: false,
    };
    // Goals are normally reserved approach tiles. `route` rejects a hard
    // obstacle goal, so water and buildings cannot become accidental targets.
    parent[goalIndex] = ROOT;
    queue[field.tail++] = goalIndex;
    this.fields.set(key, field);
    this.work.push(field);
    return field;
  }

  private expandOne(field: RouteField): void {
    if (field.head >= field.tail) {
      field.complete = true;
      return;
    }
    const current = field.queue[field.head++]!;
    const tx = current % GRID_W;
    const ty = Math.floor(current / GRID_W);
    for (const [dx, dy] of GRID_DIRECTIONS_8) {
      const nextTx = tx + dx;
      const nextTy = ty + dy;
      if (!inBounds(nextTx, nextTy)) continue;
      const next = nextTy * GRID_W + nextTx;
      if (field.parent[next] !== UNVISITED) continue;
      if (field.blocked.has(tileKey(nextTx, nextTy))) continue;
      if (!canTraverseGridStep(tx, ty, nextTx, nextTy, field.blocked)) continue;
      field.parent[next] = current;
      field.queue[field.tail++] = next;
    }
    if (field.head >= field.tail) field.complete = true;
  }
}

class RouteFieldQueue {
  private readonly fields: RouteField[] = [];
  private cursor = 0;

  get pendingNodeCount(): number {
    let count = 0;
    for (const field of this.fields) count += field.tail - field.head;
    return count;
  }

  push(field: RouteField): void {
    if (field.complete || this.fields.some((candidate) => candidate === field)) return;
    this.fields.push(field);
  }

  next(): RouteField | null {
    while (this.fields.length > 0) {
      if (this.cursor >= this.fields.length) this.cursor = 0;
      const field = this.fields[this.cursor]!;
      this.fields.splice(this.cursor, 1);
      if (field.complete || field.head >= field.tail) continue;
      return field;
    }
    return null;
  }

  clear(): void {
    this.fields.length = 0;
    this.cursor = 0;
  }
}

function inBounds(tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < GRID_W && ty < GRID_H;
}
