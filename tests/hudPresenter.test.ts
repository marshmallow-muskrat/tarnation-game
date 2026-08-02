import { describe, expect, it } from 'vitest';
import { WIN_DAY } from '../src/content';
import { createGameState } from '../src/sim/gameState';
import { ITEM_WOOD } from '../src/sim/items';
import { addToInventory } from '../src/sim/gameState';
import {
  HudPresenter,
  type HudPresenterContext,
  type HudSnapshot,
} from '../src/game/HudPresenter';

function makeContext(state = createGameState(123)): HudPresenterContext {
  return {
    state,
    hint: 'Click to work',
    buildingMode: false,
    selectedBuildIndex: 0,
    placement: () => ({ valid: false, reason: 'Open build mode to preview a structure' }),
    helpOpen: false,
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
    state.inventoryOpen = false;
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
      save: { state: 'saved', message: 'Saved' },
    });
    expect(received!.inventory).toHaveLength(24);
    expect(received!.toolbar.map((slot) => slot.name)).toEqual(['Brown Shotgun', 'Shovel', 'Red Axe']);
    expect(received!.toolbar[0]!.selected).toBe(true);
    expect(received!.build.options.map((option) => option.name)).toEqual([
      'Fence Section',
      'Fence Section 2',
      'Field Gate',
    ]);
    expect(received!.vendor.tabs).toEqual(['Housing', 'Buildings', 'Upgrades']);
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

  it('normalizes an unavailable vendor tab and preserves build, pause, and ending status in the view model', () => {
    const state = createGameState(123);
    state.clock.day = WIN_DAY;
    state.stats.daysSurvived = WIN_DAY;
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
    expect(received!.win).toMatchObject({ daysSurvived: WIN_DAY });
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
});
