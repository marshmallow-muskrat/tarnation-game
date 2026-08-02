import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AUDIO_EVENT_CATALOG, AUDIO_EVENT_NAMES } from '../src/game/audioCatalog';

const root = resolve(process.cwd());
const credits = resolve(root, 'public/audio/CREDITS.md');
if (!existsSync(credits)) throw new Error('Audio provenance ledger is missing: public/audio/CREDITS.md');
const creditsText = readFileSync(credits, 'utf8');
if (!creditsText.includes('original short-form audio asset')) {
  throw new Error('Audio provenance ledger does not state original authorship');
}

for (const event of AUDIO_EVENT_NAMES) {
  const definition = AUDIO_EVENT_CATALOG[event];
  const file = resolve(root, `public${definition.asset}`);
  if (!existsSync(file)) throw new Error(`${event}: missing ${definition.asset}`);
  const bytes = readFileSync(file);
  if (bytes.length < 44 || bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WAVE') {
    throw new Error(`${event}: ${definition.asset} is not a RIFF/WAVE file`);
  }
}

const loops = AUDIO_EVENT_NAMES.filter((event) => AUDIO_EVENT_CATALOG[event].loop);
if (loops.length !== 4) throw new Error(`Expected four day/night loop layers, found ${loops.length}`);
console.log(`Audio check passed: ${AUDIO_EVENT_NAMES.length} typed events, ${loops.length} loop layers, provenance ledger present.`);
