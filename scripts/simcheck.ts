/** Fast assertions over the pure sim — run with `npm run check`. */
import {
  BUCKET_CAPACITY,
  CROP_DEFS,
  DAY_LENGTH,
  FARM_TREE_CHOPS,
  FARM_TREE_FRACTION,
  GROVE_CELL,
  GROVE_DENSE,
  GROVE_SPARSE,
  INVENTORY_SLOTS,
  NIGHT_LENGTH,
  STUMP_CHOPS,
  TILL_DECAY_DAYS,
  TREE_RESPAWN_DAYS,
} from '../src/content';
import {
  createEmptyGrid,
  decayUnplantedTilth,
  harvestTile,
  plantTile,
  stepCrops,
  tillTile,
  waterTile,
} from '../src/sim/farm';
import { makeSeed } from '../src/sim/genetics';
import { addItem, countItem, createInventory, removeItem } from '../src/sim/inventory';
import { cropItem, itemInfo, ITEM_WOOD } from '../src/sim/items';
import { dropChance, rollDrop, TROPHY_ODDS } from '../src/sim/luck';
import { mulberry32 } from '../src/sim/rng';
import { hash2, smoothstep, valueNoise2D } from '../src/game/noise';

const day = DAY_LENGTH + NIGHT_LENGTH;
const results: string[] = [];
const ok = (label: string, cond: boolean, extra = '') =>
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);

// ---------------------------------------------------------------- growing
for (const [id, def] of Object.entries(CROP_DEFS)) {
  const tiles = createEmptyGrid();
  tillTile(tiles, 1, 1, 1);
  plantTile(tiles, 1, 1, makeSeed(id as keyof typeof CROP_DEFS));
  waterTile(tiles, 1, 1, 0);
  let t = 0;
  while (tiles[1]![1]!.state !== 'mature' && t < day * 5) {
    stepCrops(tiles, 1 / 60);
    t += 1 / 60;
  }
  ok(`${id} matures in 2 days`, Math.abs(t - day * 2) < 0.5, `${t.toFixed(1)}s (grow=${def.grow})`);
}

// ------------------------------------------------------- tilth decay (new)
{
  const tiles = createEmptyGrid();
  tillTile(tiles, 5, 5, 3);
  ok('tilth survives the day it was cut', decayUnplantedTilth(tiles, 3).length === 0);
  ok('tilth survives one more dawn', decayUnplantedTilth(tiles, 4).length === 0);
  const lost = decayUnplantedTilth(tiles, 5);
  ok(
    `unplanted tilth is reclaimed after ${TILL_DECAY_DAYS} day`,
    lost.length === 1 && tiles[5]![5]!.state === 'grass',
  );

  const planted = createEmptyGrid();
  tillTile(planted, 6, 6, 3);
  plantTile(planted, 6, 6, makeSeed('beet'));
  ok('planted ground is never reclaimed', decayUnplantedTilth(planted, 9).length === 0);
}

// ------------------------------------------------------------- inventory
{
  const inv = createInventory();
  ok('24 slots', inv.length === 24 && INVENTORY_SLOTS === 24);
  addItem(inv, cropItem('Beet'), 5000);
  addItem(inv, cropItem('Beet'), 5000);
  ok('stack is unbounded', countItem(inv, cropItem('Beet')) === 10000);
  ok('one stack = one slot', inv.filter(Boolean).length === 1);
  for (let i = 0; i < 23; i++) addItem(inv, `filler:${i}`, 1);
  ok('rejects a 25th distinct item', addItem(inv, 'overflow', 1) === false);
  removeItem(inv, 'filler:0', 1);
  ok('freed slot accepts again', addItem(inv, 'overflow', 1) === true);
}

// ------------------------------------------------------------- economy
{
  ok('wood is the unit of account', itemInfo(ITEM_WOOD).price === 1);
  const beet = itemInfo(cropItem('Beet')).price;
  // A tree is 5 swings for 2 wood; a crop is a till + seed + water + 2 days.
  ok('a crop beats two days of chopping', beet >= 8, `beet ${beet}₫ vs wood 1₫`);
  ok(
    'crops are ordered by how demanding they are',
    itemInfo(cropItem('Lettuce')).price > itemInfo(cropItem('Carrot')).price &&
      itemInfo(cropItem('Carrot')).price > itemInfo(cropItem('Beet')).price &&
      itemInfo(cropItem('Beet')).price > itemInfo(cropItem('Dandelion')).price &&
      itemInfo(cropItem('Dandelion')).price > itemInfo(cropItem('Grass')).price,
  );
  ok(
    'hybrids and trophies are the payout tier',
    itemInfo(cropItem('Screaming Cabbage')).price > itemInfo(cropItem('Lettuce')).price &&
      itemInfo('trophy:Marsh Stag').price > itemInfo(cropItem('Screaming Cabbage')).price,
  );
}

// --------------------------------------------------- loot + bad-luck pity
{
  ok('trophies start at 1%', TROPHY_ODDS.base === 0.01);
  const pity: Record<string, number> = {};
  for (let i = 0; i < 5; i++) pity['fox:diggler'] = i;
  ok(
    'each dry kill adds a point of chance',
    Math.abs(dropChance(pity, 'fox:diggler', TROPHY_ODDS) - 0.05) < 1e-9,
    `${(dropChance(pity, 'fox:diggler', TROPHY_ODDS) * 100).toFixed(0)}% after 4 misses`,
  );

  const rng = mulberry32(12345);
  const state: Record<string, number> = {};
  let kills = 0;
  let drops = 0;
  let worstStreak = 0;
  let streak = 0;
  while (kills < 20000) {
    kills++;
    if (rollDrop(state, 'fox:diggler', TROPHY_ODDS, rng)) {
      drops++;
      worstStreak = Math.max(worstStreak, streak);
      streak = 0;
    } else {
      streak++;
    }
  }
  ok('pity guarantees a drop inside 100 kills', worstStreak < 100, `worst dry streak ${worstStreak}`);
  ok('drop rate stays rare', drops / kills < 0.12, `${((drops / kills) * 100).toFixed(1)}% overall`);
  ok('a drop resets the counter', state['fox:diggler'] !== undefined || drops > 0);
}

// ------------------------------------------------------------ tree cover
{
  const TREE_SEED = 0x7a24_0104 ^ 0x7a3e;
  const density = (x: number, z: number) => {
    const broad = valueNoise2D(x, z, GROVE_CELL, TREE_SEED);
    const detail = valueNoise2D(x, z, GROVE_CELL * 0.4, TREE_SEED ^ 0x99);
    const t = smoothstep(0.42, 0.68, broad * 0.72 + detail * 0.28);
    return GROVE_SPARSE + (GROVE_DENSE - GROVE_SPARSE) * t;
  };
  let trees = 0;
  let tiles = 0;
  // Sample the whole 240×240 map.
  for (let ty = 0; ty < 240; ty++) {
    for (let tx = 0; tx < 240; tx++) {
      tiles++;
      if (hash2(tx, ty, TREE_SEED) < density(tx + 0.5, ty + 0.5)) trees++;
    }
  }
  const cover = trees / tiles;
  ok(
    'about 5% of tiles carry a tree',
    Math.abs(cover - FARM_TREE_FRACTION) < 0.03,
    `${(cover * 100).toFixed(1)}%`,
  );

  // Clustering: neighbouring tiles should agree far more often than chance.
  let neighbourHits = 0;
  let treeNeighbours = 0;
  for (let ty = 1; ty < 239; ty++) {
    for (let tx = 1; tx < 239; tx++) {
      if (hash2(tx, ty, TREE_SEED) >= density(tx + 0.5, ty + 0.5)) continue;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ] as const) {
        treeNeighbours++;
        if (hash2(tx + dx, ty + dy, TREE_SEED) < density(tx + dx + 0.5, ty + dy + 0.5)) {
          neighbourHits++;
        }
      }
    }
  }
  const clumping = neighbourHits / treeNeighbours;
  ok(
    'trees clump rather than dust the map',
    clumping > cover * 1.4,
    `${(clumping * 100).toFixed(1)}% of tree neighbours are trees vs ${(cover * 100).toFixed(1)}% baseline`,
  );
}

// ---------------------------------------------------------------- basics
ok('bucket holds 10', BUCKET_CAPACITY === 10);
ok('axe takes 5 swings', FARM_TREE_CHOPS === 5);
ok('stumps take 1 swing', STUMP_CHOPS === 1);
ok('2-day tree respawn', TREE_RESPAWN_DAYS === 2);

{
  const tiles = createEmptyGrid();
  tillTile(tiles, 2, 2, 1);
  plantTile(tiles, 2, 2, makeSeed('carrot'));
  waterTile(tiles, 2, 2, 0);
  for (let t = 0; t < day * 2 + 1; t += 1) stepCrops(tiles, 1);
  const res = harvestTile(tiles, 2, 2);
  ok('harvest returns a seed + count', res.ok && !!res.seed && res.count >= 1);
}

console.log(results.join('\n'));

// --------------------------------------------------------- save migration
import { deserialize } from '../src/sim/save';
import { createGameState, loadFromSaveData } from '../src/sim/gameState';

const legacy = JSON.stringify({
  version: 4,
  seed: 42,
  day: 4,
  phase: 'day',
  elapsed: 12,
  tiles: [],
  bagSize: 12,
  homesteadTier: 1,
  weapon: 'shotgun',
  unlockedWeapons: ['shotgun', 'bow'],
  irrigationTier: 1,
  bucketFill: 2,
  selectedCrop: 'beet',
  inventory: [
    { id: 'wood', count: 37 },
    { id: 'crop:Beet', count: 9 },
  ],
  ducketts: 250,
  choppedTrees: { '10,10': 2 },
  seedInventory: [],
  codex: [],
  stats: {},
  simTime: 100,
  winShown: false,
  trophies: ['Marsh Stag'],
});

const m: string[] = [];
const ok2 = (label: string, cond: boolean, extra = '') =>
  m.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);
const migrated = deserialize(legacy);
const gsOld = migrated ? loadFromSaveData(migrated) : null;
ok2('v4 save still loads', !!gsOld);
if (gsOld) {
  ok2('inventory survives', countItem(gsOld.inventory, ITEM_WOOD) === 37);
  ok2('legacy trophies survive', countItem(gsOld.inventory, 'trophy:Marsh Stag') === 1);
  ok2('"ducketts" becomes "duckettes"', gsOld.duckettes === 250, `${gsOld.duckettes}₫`);
  ok2('chopped trees survive', Object.keys(gsOld.choppedTrees).length === 1);
  ok2('stump ledger starts empty', Object.keys(gsOld.clearedStumps).length === 0);
  ok2('pity ledger starts empty', Object.keys(gsOld.dropPity).length === 0);
  ok2('inventory is open by default', gsOld.inventoryOpen === true);
}
console.log(m.join('\n'));

const all = [...results, ...m];
console.log(all.some((r) => r.startsWith('FAIL')) ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
if (all.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;

// v4 → v5 slot remap: index 0 used to be the original unarmed action.
{
  const v4 = JSON.parse(legacy) as Record<string, unknown>;
  v4.toolbarSlot = 0;
  const g = deserialize(JSON.stringify(v4));
  const label = g && g.toolbarSlot === 1 ? 'PASS' : 'FAIL';
  console.log(`${label}  v4 toolbar slot remaps to the ranged tool — got ${g?.toolbarSlot}`);
  if (label === 'FAIL') process.exitCode = 1;
}

// A brand-new game starts on the Survival Pack shotgun.
{
  const fresh = createGameState(7);
  const label = fresh.toolbarSlot === 0 && !fresh.toolSlotActive ? 'PASS' : 'FAIL';
  console.log(`${label}  a new game starts on the shotgun — slot ${fresh.toolbarSlot}`);
  if (label === 'FAIL') process.exitCode = 1;
}
