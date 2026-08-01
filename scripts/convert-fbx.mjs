#!/usr/bin/env node
/**
 * Batch FBX -> GLB for Quaternius packs.
 *
 * The Quaternius "Ultimate" series (2019-2020) ships FBX/OBJ/Blend only — no glTF —
 * so every pack needs converting before the game can load it.
 *
 * Usage:
 *   node scripts/convert-fbx.mjs <source-dir> <out-dir> [--filter substring]
 *
 * Example:
 *   node scripts/convert-fbx.mjs ~/Downloads/UltimateCrops public/models/crops --filter Carrot
 *
 * Requires:  npm i -D fbx2gltf
 */
import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const [srcArg, outArg, ...rest] = process.argv.slice(2);
if (!srcArg || !outArg) {
  console.error('usage: node scripts/convert-fbx.mjs <source-dir> <out-dir> [--filter substring]');
  process.exit(1);
}

const filterIdx = rest.indexOf('--filter');
const filter = filterIdx >= 0 ? rest[filterIdx + 1] : null;

const src = resolve(srcArg.replace(/^~/, process.env.HOME));
const out = resolve(outArg);
if (!existsSync(src)) { console.error(`source not found: ${src}`); process.exit(1); }
mkdirSync(out, { recursive: true });

let bin;
try {
  bin = require.resolve('fbx2gltf').replace(/index\.js$/, `bin/Darwin/FBX2glTF`);
} catch {
  console.error('fbx2gltf not installed. Run:  npm i -D fbx2gltf');
  process.exit(1);
}

/** Recursively collect .fbx under a directory. */
function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) found.push(...walk(p));
    else if (extname(p).toLowerCase() === '.fbx') found.push(p);
  }
  return found;
}

/** Quaternius filenames are PascalCase with spaces; game keys are snake_case. */
function toKey(name) {
  return name
    .replace(/\.fbx$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

let files = walk(src);
if (filter) files = files.filter((f) => basename(f).toLowerCase().includes(filter.toLowerCase()));

console.log(`${files.length} FBX file(s) to convert\n`);
let ok = 0;
let failed = 0;

for (const file of files) {
  const key = toKey(basename(file));
  const dest = join(out, `${key}.glb`);
  try {
    // --binary => .glb ; --khr-materials-unlit off so our lighting rig applies
    execFileSync(bin, [file, '-o', dest.replace(/\.glb$/, ''), '--binary'], { stdio: 'pipe' });
    console.log(`  ok   ${key}.glb`);
    ok++;
  } catch (err) {
    console.warn(`  FAIL ${basename(file)} — ${String(err.message).split('\n')[0]}`);
    failed++;
  }
}

console.log(`\n${ok} converted, ${failed} failed → ${out}`);
console.log('Next: add entries to src/content/models.ts');
