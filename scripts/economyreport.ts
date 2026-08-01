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
console.log('Future workbook-only rows: fish, quadrant tiers, bosses, and seed purchase costs.');
