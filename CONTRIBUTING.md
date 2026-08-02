# Contributing to Tarnation

## Supported toolchain

Use Node.js 24, as recorded in [`.nvmrc`](.nvmrc) and `package.json`. Install the exact locked
dependency graph with:

```bash
npm ci
```

Do not commit `node_modules/`, generated `dist/`, or QA artifacts.

## Changes and verification

Create one focused task branch from `agent/masterplan-v2-implementation` and target task pull
requests at that integration branch. Keep `src/sim/` pure, preserve fixed-timestep and seeded
determinism, and add characterization coverage before changing an existing gameplay contract.

Before opening a pull request, run the relevant task checks and at minimum:

```bash
npm run test:ci
npm run check
npm run assetcheck
npm run audiocheck
npm run feelcheck
npm run perfcheck
npm run build
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
git diff --check
npm audit --omit=dev
```

Use the release checklist in `masterplan-v2.md` for E2E, accessibility, performance, save, and
production verification requirements. Do not weaken an assertion to hide a regression.

## Releases and deployment

Record material behavior, migration, provenance, and release evidence in `HANDOFF.md`,
`DECISIONS.md`, and `CHANGELOG.md`. Only reviewed milestone merges to `main` deploy through the
existing GitHub Actions workflow. Do not inspect or modify Cloudflare credentials and do not deploy
task or integration branches manually.

## Assets, audio, and licensing

Update [`PROVENANCE.md`](PROVENANCE.md) and the detailed ledgers under `public/models/` and
`public/audio/` whenever a shipped asset or audio source changes. Run the corresponding validation
scripts. The repository does not grant an open-source license; third-party CC0 records and authored
source boundaries are documented in the provenance ledgers.
