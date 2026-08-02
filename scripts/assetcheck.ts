/** Verify the active model manifest and inspect every referenced GLB. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import {
  MODEL_KEYS,
  modelDef,
  modelLoadGroup,
  type ModelKey,
} from '../src/content/models';
import {
  modelAssetMetadata,
  validateModelMetadata,
} from '../src/content/assetMetadata';
import { inspectGltfDocument, parseGlb } from '../src/content/assetValidation';
import { EQUIPMENT_KEYS, validateEquipmentProfiles } from '../src/content/equipment';
import { PURCHASABLE_ASSETS, validatePurchasableCatalog } from '../src/content/purchasables';

const root = resolve(process.cwd(), 'public', 'models');
const missing: string[] = [];
const glbProblems: string[] = [];
const duplicatePaths = new Map<string, string[]>();
const uniquePathKeys = new Map<string, ModelKey[]>();
const inspectedKinds = new Map<string, number>();
let inspectedFiles = 0;
let inspectedAnimations = 0;
let inspectedExternalFiles = 0;

for (const key of MODEL_KEYS) {
  const path = modelDef(key).path;
  const keys = duplicatePaths.get(path) ?? [];
  keys.push(key);
  duplicatePaths.set(path, keys);
  const pathKeys = uniquePathKeys.get(path) ?? [];
  pathKeys.push(key);
  uniquePathKeys.set(path, pathKeys);
}

for (const [path, keys] of uniquePathKeys) {
  const filePath = resolve(root, path);
  const relativePath = relative(root, filePath);
  if (relativePath.startsWith('..') || relativePath.includes(`..${sep}`)) {
    glbProblems.push(`${keys.join(', ')} → ${path}: path escapes public/models`);
    continue;
  }
  if (!existsSync(filePath)) {
    for (const key of keys) missing.push(`${key} → ${path}`);
    continue;
  }

  const metadata = modelAssetMetadata(keys[0]!);
  const parsed = parseGlb(new Uint8Array(readFileSync(filePath)));
  const problems = [...parsed.errors];
  if (parsed.document) {
    const expectedClips: Record<string, RegExp> = {};
    for (const semantic of metadata.requiredClips) {
      const matcher = metadata.clipMatchers[semantic];
      if (matcher) expectedClips[semantic] = matcher;
      else problems.push(`missing matcher for expected ${semantic} animation clip`);
    }
    const inspection = inspectGltfDocument(parsed.document, parsed.binaryByteLength, {
      expectedKind: metadata.kind,
      expectedClips,
    });
    problems.push(...inspection.errors);
    inspectedFiles++;
    inspectedAnimations += inspection.animationNames.length;
    inspectedKinds.set(inspection.kind, (inspectedKinds.get(inspection.kind) ?? 0) + 1);
    for (const uri of inspection.externalUris) {
      const externalPath = resolve(dirname(filePath), uri);
      const externalRelative = relative(root, externalPath);
      if (externalRelative.startsWith('..') || externalRelative.includes(`..${sep}`)) {
        problems.push(`external file escapes public/models: ${uri}`);
      } else if (!existsSync(externalPath)) {
        problems.push(`missing external texture or buffer: ${uri}`);
      } else {
        inspectedExternalFiles++;
      }
    }
  }
  if (problems.length) {
    for (const problem of problems) glbProblems.push(`${keys.join(', ')} → ${path}: ${problem}`);
  }
}

const duplicates = [...duplicatePaths.entries()]
  .filter(([, keys]) => keys.length > 1)
  .map(([path, keys]) => `${path} ← ${keys.join(', ')}`);

const metadataProblems = validateModelMetadata();
if (metadataProblems.length) {
  console.error(`Model metadata check failed (${metadataProblems.length}):`);
  for (const problem of metadataProblems) console.error(`  ${problem}`);
  process.exitCode = 1;
}

if (missing.length) {
  console.error(`Missing manifest files (${missing.length}):`);
  for (const entry of missing) console.error(`  ${entry}`);
  process.exitCode = 1;
}
if (glbProblems.length) {
  console.error(`GLB inspection failed (${glbProblems.length}):`);
  for (const problem of glbProblems) console.error(`  ${problem}`);
  process.exitCode = 1;
}
if (metadataProblems.length === 0 && missing.length === 0 && glbProblems.length === 0) {
  console.log(`Asset check passed: ${MODEL_KEYS.length} manifest entries, all files present.`);
  console.log(
    `GLB inspection passed: ${inspectedFiles} unique files; ` +
    `rigged=${inspectedKinds.get('rigged') ?? 0}, static=${inspectedKinds.get('static') ?? 0}, ` +
    `animation clips=${inspectedAnimations}, external files=${inspectedExternalFiles}.`,
  );
  if (duplicates.length) console.log(`Manifest aliases retained intentionally: ${duplicates.length} shared paths.`);
  const loadGroupCounts = new Map<string, number>();
  for (const key of MODEL_KEYS) {
    const group = modelLoadGroup(key);
    loadGroupCounts.set(group, (loadGroupCounts.get(group) ?? 0) + 1);
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
