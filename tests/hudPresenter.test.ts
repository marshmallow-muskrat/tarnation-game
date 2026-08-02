import { describe, expect, it } from 'vitest';
import { createGameState } from '../src/sim/gameState';
import { makeSeed } from '../src/sim/genetics';
import { ITEM_WOOD } from '../src/sim/items';
import { addToInventory } from '../src/sim/gameState';
import {
  HudPresenter,
  type HudPresenterContext,
  type HudSnapshot,
} from '../src/game/HudPresenter';
import { DEFAULT_INPUT_BINDINGS } from '../src/game/InputBindings';
import { DEFAULT_GAME_SETTINGS } from '../src/game/Settings';

function makeContext(state = createGameState(123)): HudPresenterContext {
  return {
    state,
    hint: 'Click to work',
    buildingMode: false,
    selectedBuildIndex: 0,
    placement: () => ({ valid: false, reason: 'Open build mode to preview a structure' }),
    helpOpen: false,
    settingsOpen: false,
    settings: DEFAULT_GAME_SETTINGS,
    bindings: DEFAULT_INPUT_BINDINGS,
    codexOpen: false,
    codexSelectedKey: null,
    codexCompareKeys: [],
    toolSlotModel: null,
    marketOpen: false,
    vendorOpen: false,
    vendorTab: 'Housing',
    vendorTabs: ['Housing', 'Buildings', 'Upgrades'],
    vendorMessage: '',
    economy: { allowFreePurchases: false, label: 'Production economy · costs are charged' },
    setVendorTab: () => undefined,
    contextMenu: { open: false, x: 0, y: 0, name: '', placedIndex: -1, gate: false, gateOpen: false },
    demolishMode: false,
    paused: false,
    marketAngle: 0,
    marketDistance: 10,
    popups: [],
    save: { state: 'saved', message: 'Saved' },
    winShownLocal: false,
  };
}

describe('HUD presenter', () => {
  it('maps fresh game state to the existing player-facing toolbar, inventory, build, and vendor contract', () => {
    const state = createGameState(123);
    state.duckettes = 9;
    const context = makeContext(state);
    let received: HudSnapshot | null = null;
    const presenter = new HudPresenter();
    presenter.setListener((snapshot) => {
      received = snapshot;
    });

    presenter.push(true, context);

    expect(received).not.toBeNull();
    expect(received).toMatchObject({
      day: 1,
      phase: 'day',
      hint: 'Click to work',
      inventoryOpen: false,
      duckettes: 9,
      wood: 0,
      save: { state: 'saved', message: 'Saved' },
    });
    expect(received!.inventory).toHaveLength(24);
    expect(received!.seedStorage).toEqual({ used: 5, capacity: 24 });
    expect(received!.toolbar.map((slot) => slot.name)).toEqual(['Brown Shotgun', 'Shovel', 'Red Axe']);
    expect(received!.bindings.find((binding) => binding.action === 'primary')).toMatchObject({
      label: 'Primary action · work, place, or demolish',
      display: 'Enter',
    });
    expect(received!.toolbar[0]!.selected).toBe(true);
    expect(received!.build.options.map((option) => option.name)).toEqual([
      'Fence Section',
      'Fence Section 2',
      'Field Gate',
    ]);
    expect(received!.build.options[0]).toMatchObject({
      description: 'A four-tile field boundary section.',
      footprint: '4×1',
    });
    expect(received!.vendor.tabs).toEqual(['Housing', 'Buildings', 'Upgrades']);
    expect(received!.vendor.items[0]).toMatchObject({ kind: 'Permit' });
    expect(received!.codex.entries).toHaveLength(5);
    expect(received!.codex.entries.every((entry) => entry.kind === 'discovered')).toBe(true);
  });

  it('presents inventory item models and market totals from the live stack state', () => {
    const state = createGameState(123);
    addToInventory(state, ITEM_WOOD, 3);
    const context = makeContext(state);
    context.marketOpen = true;
    const presenter = new HudPresenter();
    let received: HudSnapshot | null = null;
    presenter.setListener((snapshot) => {
      received = snapshot;
    });

    presenter.push(true, context);

    const wood = received!.inventory.find((slot) => slot.id === ITEM_WOOD);
    expect(wood).toMatchObject({ id: ITEM_WOOD, count: 3, model: 'wood_log' });
    expect(received!.market).toMatchObject({ open: true, total: wood!.price * 3 });
    expect(received!.market.items).toHaveLength(1);
  });

  it('normalizes an unavailable vendor tab and presents the completed settlement objective', () => {
    const state = createGameState(123);
    state.stats.cropsHarvested = 1;
    state.stats.trophies = 1;
    state.codex.push({
      id: 'test-hybrid',
      seed: { ...makeSeed('beet'), displayName: 'Beet-Carrot Hybrid', hybrid: true, lineage: ['Beet', 'Carrot'] },
      discoveredDay: 2,
    });
    state.homesteadTier = 2;
    const context = makeContext(state);
    context.buildingMode = true;
    context.selectedBuildIndex = 2;
    context.placement = () => ({ valid: false, reason: 'Move closer to place' });
    context.vendorTab = 'Housing';
    context.vendorTabs = ['Buildings'];
    context.helpOpen = true;
    context.paused = true;
    context.winShownLocal = false;
    let normalizedTab: string | null = null;
    context.setVendorTab = (tab) => {
      normalizedTab = tab;
    };
    const presenter = new HudPresenter();
    let received: HudSnapshot | null = null;
    presenter.setListener((snapshot) => {
      received = snapshot;
    });

    presenter.push(true, context);

    expect(normalizedTab).toBe('Buildings');
    expect(received!.vendor.tab).toBe('Buildings');
    expect(received!.build).toMatchObject({ active: true, selectedIndex: 2, placement: { reason: 'Move closer to place' } });
    expect(received!.helpOpen).toBe(true);
    expect(received!.paused).toBe(true);
    expect(received!.objective).toMatchObject({ title: 'Establish the homestead', complete: true });
    expect(received!.objective.steps.every((step) => step.complete)).toBe(true);
    expect(received!.win).toMatchObject({ daysSurvived: state.clock.day });
  });

  it('keeps the ending hidden when day five is reached without the settlement objective', () => {
    const state = createGameState(123);
    state.clock.day = 5;
    const context = makeContext(state);
    const presenter = new HudPresenter();
    let received: HudSnapshot | null = null;
    presenter.setListener((snapshot) => {
      received = snapshot;
    });

    presenter.push(true, context);

    expect(received!.objective.complete).toBe(false);
    expect(received!.win).toBeNull();
  });

  it('deduplicates unchanged HUD JSON while publishing changes and copying transient arrays', () => {
    const context = makeContext();
    const popup = { id: 1, text: '+1 Wood', x: 0.5, y: 0.5, life: 1 };
    context.popups = [popup];
    const received: HudSnapshot[] = [];
    const presenter = new HudPresenter();
    presenter.setListener((snapshot) => received.push(snapshot));

    presenter.push(false, context);
    presenter.push(false, context);
    context.state.duckettes = 1;
    presenter.push(false, context);

    expect(received).toHaveLength(2);
    received[0]!.popups[0]!.life = 0;
    expect(popup.life).toBe(1);
  });

  it('publishes keyboard-selectable Codex comparison entries with a screen-reader status sentence', () => {
    const context = makeContext();
    context.codexOpen = true;
    context.codexSelectedKey = 'known:Grass|grass|0|none';
    context.codexCompareKeys = ['known:Grass|grass|0|none', 'known:Beet|beet|8|none'];
    const presenter = new HudPresenter();
    let received: HudSnapshot | null = null;
    presenter.setListener((snapshot) => {
      received = snapshot;
    });

    presenter.push(true, context);

    expect(received!.codex.open).toBe(true);
    expect(received!.codex.selectedKey).toBe('known:Grass|grass|0|none');
    expect(received!.codex.compareKeys).toEqual([
      'known:Grass|grass|0|none',
      'known:Beet|beet|8|none',
    ]);
    expect(received!.codex.status).toContain('Grass selected');
    expect(received!.codex.entries.find((entry) => entry.key === 'known:Grass|grass|0|none')?.compareSelected).toBe(true);
  });

  it('publishes remapped controls so player-facing prompts can stay synchronized', () => {
    const context = makeContext();
    context.bindings = { ...DEFAULT_INPUT_BINDINGS, primary: 'KeyL' };
    const presenter = new HudPresenter();
    let received: HudSnapshot | null = null;
    presenter.setListener((snapshot) => {
      received = snapshot;
    });

    presenter.push(true, context);

    expect(received!.bindings.find((binding) => binding.action === 'primary')?.display).toBe('L');
  });

  it('passes the transient first-steps guide through without making it save state', () => {
    const context = makeContext();
    context.onboarding = {
      id: 'movement',
      step: 1,
      total: 8,
      title: 'Get your bearings',
      instruction: 'Move to the highlighted starter plot.',
      nextGoal: 'Next · work one tile.',
    };
    const presenter = new HudPresenter();
    let received: HudSnapshot | null = null;
    presenter.setListener((snapshot) => {
      received = snapshot;
    });

    presenter.push(true, context);

    expect(received!.onboarding).toEqual(context.onboarding);
    expect(Object.keys(createGameState(123))).not.toContain('onboarding');
  });

  it('publishes explicit visibility controls for the settlement objective and market guide', () => {
    const context = makeContext();
    context.objectiveVisible = false;
    context.marketGuideVisible = false;
    const presenter = new HudPresenter();
    let received: HudSnapshot | null = null;
    presenter.setListener((snapshot) => {
      received = snapshot;
    });

    presenter.push(true, context);

    expect(received).toMatchObject({ objectiveVisible: false, marketGuideVisible: false });
  });
});
