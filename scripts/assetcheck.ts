/** Verify that every manifest entry has a committed public model file. */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODEL_KEYS, modelDef, modelLoadGroup } from '../src/content/models';
import { EQUIPMENT_KEYS, validateEquipmentProfiles } from '../src/content/equipment';
import { PURCHASABLE_ASSETS, validatePurchasableCatalog } from '../src/content/purchasables';

const root = resolve(process.cwd(), 'public', 'models');
const missing: string[] = [];
const duplicatePaths = new Map<string, string[]>();

for (const key of MODEL_KEYS) {
  const path = modelDef(key).path;
  if (!existsSync(resolve(root, path))) missing.push(`${key} → ${path}`);
  const keys = duplicatePaths.get(path) ?? [];
  keys.push(key);
  duplicatePaths.set(path, keys);
}

const duplicates = [...duplicatePaths.entries()]
  .filter(([, keys]) => keys.length > 1)
  .map(([path, keys]) => `${path} ← ${keys.join(', ')}`);

const loadGroupCounts = new Map<string, number>();
for (const key of MODEL_KEYS) {
  const group = modelLoadGroup(key);
  loadGroupCounts.set(group, (loadGroupCounts.get(group) ?? 0) + 1);
}

if (missing.length) {
  if (missing.length) {
    console.error(`Missing manifest files (${missing.length}):`);
    for (const entry of missing) console.error(`  ${entry}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Asset check passed: ${MODEL_KEYS.length} manifest entries, all files present.`);
  if (duplicates.length) {
    console.log(`Manifest aliases retained intentionally: ${duplicates.length} shared paths.`);
  }
  console.log(`Asset load groups: ${[...loadGroupCounts.entries()].map(([group, count]) => `${group}=${count}`).join(', ')}.`);
}

const equipmentProblems = validateEquipmentProfiles();
if (equipmentProblems.length) {
  console.error(`Equipment profile check failed (${equipmentProblems.length}):`);
  for (const problem of equipmentProblems) console.error(`  ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Equipment profiles passed: ${EQUIPMENT_KEYS.length} typed records.`);
}

const catalogProblems = validatePurchasableCatalog();
for (const asset of PURCHASABLE_ASSETS) {
  if (!MODEL_KEYS.includes(asset.modelKey)) catalogProblems.push(`unknown model key: ${asset.id} → ${asset.modelKey}`);
}
if (catalogProblems.length) {
  console.error(`Purchasable catalog check failed (${catalogProblems.length}):`);
  for (const problem of catalogProblems) console.error(`  ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`Purchasable catalog passed: ${PURCHASABLE_ASSETS.length} stable asset ids.`);
}
