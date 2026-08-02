import type { InputAction } from './InputBindings';

export const SLOT_SHOTGUN = 0;
export const SLOT_SHOVEL = 1;
export const SLOT_AXE = 2;

export type InteractionInput = {
  consumeLmb(): boolean;
  consumeRmb(): boolean;
  justPressed(action: InputAction): boolean;
};

export type InteractionMode = {
  buildingMode: boolean;
  demolishMode: boolean;
  toolSlotActive: boolean;
  toolbarSlot: number;
};

export type SelectedToolAction = 'bucket' | 'weapon' | 'shovel' | 'axe' | 'empty';
export type CombatAction = 'weapon' | 'axe' | 'none';

export function selectedToolActionFor(selection: Pick<InteractionMode, 'toolSlotActive' | 'toolbarSlot'>): SelectedToolAction {
  if (selection.toolSlotActive) return 'bucket';
  if (selection.toolbarSlot === SLOT_SHOTGUN) return 'weapon';
  if (selection.toolbarSlot === SLOT_SHOVEL) return 'shovel';
  if (selection.toolbarSlot === SLOT_AXE) return 'axe';
  return 'empty';
}

export function combatActionFor(selection: Pick<InteractionMode, 'toolSlotActive' | 'toolbarSlot'>): CombatAction {
  if (selection.toolSlotActive) return 'none';
  if (selection.toolbarSlot === SLOT_SHOTGUN) return 'weapon';
  if (selection.toolbarSlot === SLOT_AXE) return 'axe';
  return 'none';
}

export type InteractionHandlers = {
  rotatePlacement(): void;
  placeSelectedBuilding(): void;
  destroyAtPointer(): void;
  openPlacedContext(): boolean;
  recordToolAttempt(): void;
  recordCombatAttempt(): void;
  useBucket(): void;
  fireWeapon(): void;
  useShovel(): void;
  useAxe(): void;
  useCombatAxe(): void;
  emptyToolSlot(index: number): void;
};

/** Routes pointer actions while leaving gameplay effects in GameRuntime callbacks. */
export class InteractionSystem {
  constructor(
    private readonly input: InteractionInput,
    private readonly handlers: InteractionHandlers,
  ) {}

  process(mode: InteractionMode): void {
    if (this.input.consumeRmb() || this.input.justPressed('secondary')) {
      if (mode.buildingMode) this.handlers.rotatePlacement();
      else if (mode.demolishMode) this.handlers.destroyAtPointer();
      else if (!this.handlers.openPlacedContext()) this.useCombatAction(mode);
    }
    if (this.input.consumeLmb() || this.input.justPressed('primary')) {
      if (mode.buildingMode) this.handlers.placeSelectedBuilding();
      else if (mode.demolishMode) this.handlers.destroyAtPointer();
      else this.useSelectedTool(mode);
    }
  }

  private useSelectedTool(mode: InteractionMode): void {
    this.handlers.recordToolAttempt();
    switch (selectedToolActionFor(mode)) {
      case 'bucket':
        this.handlers.useBucket();
        return;
      case 'weapon':
        this.handlers.fireWeapon();
        return;
      case 'shovel':
        this.handlers.useShovel();
        return;
      case 'axe':
        this.handlers.useAxe();
        return;
      case 'empty':
        this.handlers.emptyToolSlot(mode.toolbarSlot);
        return;
    }
  }

  private useCombatAction(mode: InteractionMode): void {
    this.handlers.recordCombatAttempt();
    switch (combatActionFor(mode)) {
      case 'weapon':
        this.handlers.fireWeapon();
        return;
      case 'axe':
        this.handlers.useCombatAxe();
        return;
      case 'none':
        return;
    }
  }
}
