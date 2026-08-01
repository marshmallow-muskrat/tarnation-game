/** Verify that every manifest entry has a committed public model file. */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODEL_KEYS, modelDef } from '../src/content/models';

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
}
