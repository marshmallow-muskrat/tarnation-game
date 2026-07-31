import { BUCKET_CAPACITY, CROP_DEFS, DAY_LENGTH, INVENTORY_SLOTS, NIGHT_LENGTH, FARM_TREE_FRACTION, TREE_RESPAWN_DAYS } from '../src/content';
import { createEmptyGrid, plantTile, stepCrops, tillTile, waterTile, harvestTile } from '../src/sim/farm';
import { makeSeed } from '../src/sim/genetics';
import { addItem, countItem, createInventory, removeItem } from '../src/sim/inventory';
import { itemInfo, cropItem } from '../src/sim/items';

const day = DAY_LENGTH + NIGHT_LENGTH;
const results: string[] = [];
const ok = (label: string, cond: boolean, extra = '') =>
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);

// grow time: every crop matures in exactly two days of watered growth
for (const [id, def] of Object.entries(CROP_DEFS)) {
  const tiles = createEmptyGrid();
  tillTile(tiles, 1, 1);
  plantTile(tiles, 1, 1, makeSeed(id as keyof typeof CROP_DEFS));
  waterTile(tiles, 1, 1, 0);
  let t = 0;
  const dt = 1 / 60;
  while (tiles[1]![1]!.state !== 'mature' && t < day * 5) {
    stepCrops(tiles, dt);
    t += dt;
  }
  ok(`${id} matures in 2 days`, Math.abs(t - day * 2) < 0.5, `${t.toFixed(1)}s vs ${day * 2}s (def.grow=${def.grow})`);
}

// harvest yields a crop item, stack is unbounded
const inv = createInventory();
ok('24 slots', inv.length === 24 && INVENTORY_SLOTS === 24);
addItem(inv, cropItem('Turnip'), 5000);
addItem(inv, cropItem('Turnip'), 5000);
ok('stack is unbounded', countItem(inv, cropItem('Turnip')) === 10000, `one slot holds ${countItem(inv, cropItem('Turnip'))}`);
ok('one stack = one slot', inv.filter(Boolean).length === 1);
for (let i = 0; i < 23; i++) addItem(inv, `filler:${i}`, 1);
ok('fills to 24', inv.filter(Boolean).length === 24);
ok('rejects a 25th distinct item', addItem(inv, 'overflow', 1) === false);
removeItem(inv, 'filler:0', 1);
ok('freed slot accepts again', addItem(inv, 'overflow', 1) === true);

// prices
ok('wood price', itemInfo('wood').price === 3);
ok('hybrid crop worth more than a turnip', itemInfo(cropItem('Screaming Cabbage')).price > itemInfo(cropItem('Turnip')).price);

// harvest path
const tiles = createEmptyGrid();
tillTile(tiles, 2, 2);
plantTile(tiles, 2, 2, makeSeed('carrot'));
waterTile(tiles, 2, 2, 0);
for (let t = 0; t < day * 2 + 1; t += 1) stepCrops(tiles, 1);
const res = harvestTile(tiles, 2, 2);
ok('harvest returns a seed + count', res.ok && !!res.seed && res.count >= 1);

ok('bucket holds 10', BUCKET_CAPACITY === 10);
ok('25% tree coverage', FARM_TREE_FRACTION === 0.25);
ok('2-day tree respawn', TREE_RESPAWN_DAYS === 2);

console.log(results.join('\n'));
console.log(results.some((r) => r.startsWith('FAIL')) ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');

// --- v3 save migration -------------------------------------------------------
import { deserialize } from '../src/sim/save';
import { loadFromSaveData } from '../src/sim/gameState';

const legacy = JSON.stringify({
  version: 3,
  seed: 42,
  day: 4,
  phase: 'day',
  elapsed: 12,
  tiles: [],
  wood: 37,
  darkwood: 5,
  bagSize: 12,
  shedBuilt: true,
  homesteadTier: 1,
  weapon: 'slingshot',
  unlockedWeapons: ['slingshot', 'bow'],
  irrigationTier: 2,
  bucketFill: 2,
  selectedCrop: 'turnip',
  inventory: { Turnip: 9, 'Rubber Corn': 2 },
  seedInventory: [],
  codex: [],
  attentionFloor: 0,
  stats: {},
  simTime: 100,
  winShown: false,
  trophies: ['Marsh Stag'],
});

const migrated = deserialize(legacy);
const gsOld = migrated ? loadFromSaveData(migrated) : null;
const m: string[] = [];
const ok2 = (label: string, cond: boolean, extra = '') =>
  m.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);
ok2('v3 save still loads', !!gsOld);
if (gsOld) {
  ok2('wood became an item', countItem(gsOld.inventory, 'wood') === 37);
  ok2('darkwood became an item', countItem(gsOld.inventory, 'darkwood') === 5);
  ok2('crops became items', countItem(gsOld.inventory, cropItem('Rubber Corn')) === 2);
  ok2('trophies became items', countItem(gsOld.inventory, 'trophy:Marsh Stag') === 1);
  ok2('slingshot became the rock', gsOld.weapon === 'rock');
  ok2('bow stays unlocked', gsOld.unlockedWeapons.includes('bow'));
  ok2('ducketts default to 0', gsOld.ducketts === 0);
}
console.log(m.join('\n'));
console.log(m.some((r) => r.startsWith('FAIL')) ? 'MIGRATION FAILED' : 'MIGRATION OK');
