/** Print the current runtime economy anchors beside the workbook hypotheses. */
import {
  CROP_DEFS,
  DAY_LENGTH,
  FARM_TREE_CHOPS,
  FARM_TREE_WOOD,
  FULL_DAY,
  HOMESTEAD_UPGRADE_WOOD,
  NIGHT_LENGTH,
  TROPHY_DROP_CHANCE,
  TROPHY_PITY_STEP,
} from '../src/content';
import { cropItem, ITEM_WOOD, itemInfo } from '../src/sim/items';
import {
  DEFAULT_ECONOMY_SIMULATION_DAYS,
  DEFAULT_ECONOMY_SIMULATION_SEEDS,
  simulateEconomyAcrossSeeds,
} from '../src/sim/economySimulation';

const workbookActionsPerDay = 300;
const woodValue = itemInfo(ITEM_WOOD).price;
const woodPerReferenceDay =
  (workbookActionsPerDay / FARM_TREE_CHOPS) * FARM_TREE_WOOD * woodValue;

console.log('Tarnation economy calibration snapshot');
console.log('Reference hypothesis: ~300 actions/day, two-day crops, no path above 1.5× baseline.');
console.log(`Runtime clock: ${DAY_LENGTH}s daylight + ${NIGHT_LENGTH}s night = ${FULL_DAY}s/day.`);
console.log(
  `Wood: ${FARM_TREE_CHOPS} swings → ${FARM_TREE_WOOD} wood at ${woodValue}₫ each ` +
    `(≈${woodPerReferenceDay.toFixed(0)}₫ at the reference action count).`,
);
console.log(`Homestead upgrade wood: ${HOMESTEAD_UPGRADE_WOOD.join(' → ')}.`);
console.log('Crop sale values (all grow for two days; yield still depends on seed traits):');
for (const def of Object.values(CROP_DEFS)) {
  console.log(`  ${def.name}: ${itemInfo(cropItem(def.name)).price}₫`);
}
console.log(
  `Fox trophy: ${itemInfo('trophy:Thicket Fox').price}₫ base value, ` +
    `${TROPHY_DROP_CHANCE * 100}% base drop chance + ${TROPHY_PITY_STEP * 100}% pity per dry kill.`,
);
const simulation = simulateEconomyAcrossSeeds();
console.log(
  `Seeded simulation: ${DEFAULT_ECONOMY_SIMULATION_SEEDS.length} seeds × ` +
    `${DEFAULT_ECONOMY_SIMULATION_DAYS} days; ` +
    `${simulation.totalSales} sales and ${simulation.totalCompletedPurchases} completed purchases.`,
);
console.log(
  `Resource starvation: ${simulation.starvationRuns}/${simulation.reports.length} runs; ` +
    `runaway growth: ${simulation.runawayRuns}/${simulation.reports.length} runs.`,
);
const deadPurchases = Object.entries(simulation.deadPurchaseCounts)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, count]) => `${id} (${count}/${simulation.reports.length})`);
console.log(`Dead purchases: ${deadPurchases.length ? deadPurchases.join(', ') : 'none'}.`);
console.log(
  `Malformed catalog costs observed: ${simulation.reports
    .flatMap((report) => report.malformedPurchases)
    .filter((id, index, all) => all.indexOf(id) === index)
    .join(', ') || 'none'}.`,
);
console.log('Future workbook-only rows: fish, quadrant tiers, bosses, and seed purchase costs.');
