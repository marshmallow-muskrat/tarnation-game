import { BEAR_TRAP_PLACE_RANGE } from '../content';
import {
  assetDefinition,
  type AssetId,
  type PurchasableAsset,
} from '../content/purchasables';
import type { GameState } from '../sim/gameState';
import type { BuildingId } from '../sim/save';
import {
  normalizeOrientation,
  placedCenter,
  placementStatus,
  type GridTile,
} from '../sim/placement';
import type { ModelKey } from '../content/models';

const PLACEABLE_BUILDING_IDS = ['fence', 'fence2', 'gate'] as const;

export const PLACEABLE_BUILDINGS: readonly {
  id: BuildingId;
  model: ModelKey;
  name: string;
  cost: number;
}[] = PLACEABLE_BUILDING_IDS.flatMap((id) => {
  const asset = assetDefinition(id);
  if (!asset) return [];
  return [{
    id,
    model: asset.modelKey,
    name: asset.displayName,
    cost: asset.materialCost.wood ?? asset.price,
  }];
});

export type BuildingPlacement = {
  tile: GridTile | null;
  x: number;
  z: number;
  valid: boolean;
  reason: string;
  asset: PurchasableAsset | null;
  rotation: number;
};

export type PlacementContext = {
  pointerTile(): GridTile | null;
  playerX(): number;
  playerZ(): number;
  heading(): number;
  playerTile(): GridTile | null;
  gameState(): Pick<GameState, 'tiles' | 'placedBuildings'>;
  fixtureReservations(): ReadonlySet<string>;
  terrainAllowed(tx: number, ty: number): boolean;
  woodCount(): number;
  homesteadX(): number;
  homesteadZ(): number;
};

/** Owns placement selection, rotation, and the player-visible preview contract. */
export class PlacementCoordinator {
  private activeAssetId: AssetId | null = null;
  private rotation = 0;
  private selectedIndex = 0;

  constructor(private readonly context: PlacementContext) {}

  get activeDeedAssetId(): AssetId | null {
    return this.activeAssetId;
  }

  get currentRotation(): number {
    return this.rotation;
  }

  get currentIndex(): number {
    return this.selectedIndex;
  }

  begin(assetId: AssetId): boolean {
    const asset = assetDefinition(assetId);
    if (!asset || asset.useType !== 'place') return false;
    this.activeAssetId = assetId;
    return true;
  }

  clear(): void {
    this.activeAssetId = null;
  }

  rotate(): void {
    this.rotation = (this.rotation + 1) % 4;
  }

  select(index: number): boolean {
    if (index < 0 || index >= PLACEABLE_BUILDINGS.length) return false;
    this.selectedIndex = index;
    return true;
  }

  selectedAsset(): PurchasableAsset | null {
    if (this.activeAssetId) return assetDefinition(this.activeAssetId);
    const selected = PLACEABLE_BUILDINGS[this.selectedIndex];
    return selected ? assetDefinition(selected.id) : null;
  }

  status(): BuildingPlacement {
    const playerX = this.context.playerX();
    const playerZ = this.context.playerZ();
    const tile = this.context.pointerTile();
    if (!tile) {
      return {
        tile: null,
        x: playerX,
        z: playerZ,
        valid: false,
        reason: 'Point at a ground tile',
        asset: null,
        rotation: this.rotation,
      };
    }
    const selected = this.selectedAsset();
    if (!selected) {
      return {
        tile,
        x: playerX,
        z: playerZ,
        valid: false,
        reason: 'No placeable asset selected',
        asset: null,
        rotation: this.rotation,
      };
    }
    const rotation = this.activeAssetId ? this.rotation : normalizeOrientation(this.context.heading());
    const center = placedCenter(tile, rotation, selected);
    if (Math.hypot(playerX - center.x, playerZ - center.z) > BEAR_TRAP_PLACE_RANGE) {
      return { tile, x: center.x, z: center.z, valid: false, reason: 'Move closer to place', asset: selected, rotation };
    }
    const state = this.context.gameState();
    const status = placementStatus({
      asset: selected,
      origin: tile,
      rotation,
      tiles: state.tiles,
      placed: state.placedBuildings,
      fixtures: this.context.fixtureReservations(),
      playerTile: this.context.playerTile(),
      terrainAllowed: (tx, ty) => this.context.terrainAllowed(tx, ty),
    });
    if (!status.valid) {
      return { tile, x: center.x, z: center.z, valid: false, reason: status.reason, asset: selected, rotation };
    }
    if (
      !this.activeAssetId &&
      Math.hypot(center.x - this.context.homesteadX(), center.z - this.context.homesteadZ()) < 5
    ) {
      return {
        tile,
        x: center.x,
        z: center.z,
        valid: false,
        reason: 'Leave room around the homestead',
        asset: selected,
        rotation,
      };
    }
    const legacyCost = PLACEABLE_BUILDINGS.find((entry) => entry.id === selected.id)?.cost
      ?? selected.materialCost.wood
      ?? 0;
    if (!this.activeAssetId && this.context.woodCount() < legacyCost) {
      return {
        tile,
        x: center.x,
        z: center.z,
        valid: false,
        reason: `Need ${legacyCost} Wood for ${selected.displayName}`,
        asset: selected,
        rotation,
      };
    }
    return { tile, x: center.x, z: center.z, valid: true, reason: 'Ready to place', asset: selected, rotation };
  }
}
