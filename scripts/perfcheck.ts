import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { generateWave } from '../src/sim/raid';
import { simulateEconomyAcrossSeeds } from '../src/sim/economySimulation';
import { stepCrops } from '../src/sim/farm';
import { FoxNavigation } from '../src/game/FoxNavigation';
import { tileKey } from '../src/sim/placement';
import { denseFarmStressFixture } from '../tests/fixtures';

type ScenarioReport = {
  name: string;
  iterations: number;
  durationMs: number;
  budgetMs: number;
};

const reports: ScenarioReport[] = [];

function scenario(
  name: string,
  iterations: number,
  budgetMs: number,
  run: () => void,
): void {
  const started = performance.now();
  run();
  const durationMs = performance.now() - started;
  reports.push({
    name,
    iterations,
    durationMs: Number(durationMs.toFixed(3)),
    budgetMs,
  });
  if (durationMs > budgetMs) {
    throw new Error(`${name} exceeded its ${budgetMs}ms budget: ${durationMs.toFixed(3)}ms`);
  }
}

const dense = denseFarmStressFixture();
scenario('dense-farm-fixed-step', 120, 2_500, () => {
  for (let step = 0; step < 120; step++) stepCrops(dense.tiles, 1 / 60);
});

const blocked = new Set<string>();
for (let tx = 106; tx < 134; tx++) {
  blocked.add(tileKey(tx, 119));
  blocked.add(tileKey(tx, 121));
}
const wave = generateWave(10, 0x5eed_0202, 80, 40);
const navigation = new FoxNavigation();
scenario('raid-route-field', wave.length, 2_500, () => {
  for (const spawn of wave) navigation.request(120, 120, 1, blocked);
  while (navigation.pendingNodeCount > 0) navigation.advance(4_096);
});

scenario('economy-seeded-cohort', 16 * 30, 2_500, () => {
  simulateEconomyAcrossSeeds();
});

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  scenarios: reports,
};
mkdirSync('qa-artifacts', { recursive: true });
writeFileSync('qa-artifacts/performance.json', `${JSON.stringify(report, null, 2)}\n`);

console.log('Performance checks passed:');
for (const item of reports) {
  console.log(
    `  ${item.name}: ${item.durationMs.toFixed(3)}ms / ${item.budgetMs}ms ` +
      `(${item.iterations.toLocaleString()} iterations)`,
  );
}
