# Masterplan V2 completion review

**Review date:** 2026-08-02

**Reviewed release:** `0.3.0`, main commit [`7568e1d`](https://github.com/marshmallow-muskrat/tarnation-game/commit/7568e1d)

**Verdict:** M0–M10 implementation and release hardening are complete. The Core Release Gate is
**conditional**, solely because owner-deferred human validation has not been performed.

## Independent verification

- 334 Vitest tests across 49 files passed.
- Simulation, asset, equipment, purchase-catalog, audio, feel-soak, and deterministic performance
  checks passed.
- Strict TypeScript, production build, diff validation, and production dependency audit passed with
  zero known vulnerabilities.
- Ten production-build Playwright journeys passed in the reviewed release workflow.
- The exact main commit was automatically deployed by
  [workflow 30765350012](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30765350012),
  and the recorded live smoke verified movement persistence, farming persistence, HUD controls,
  diagnostics identity, and clean browser/network output.
- `src/sim/` remains free of React, Three.js, DOM, and `window` dependencies.

## Core Release Gate

| Criterion | Review |
|---|---|
| P0 save, economy, boot, GPU lifecycle, and CI blockers | **Pass** — compact recoverable saves, production-paid economy, staged loading, disposal ownership, and green CI are present. |
| First ten minutes are tested and understandable | **Conditional** — deterministic onboarding/browser coverage passes; the owner deferred the external comprehension study. |
| Complete multi-day farming/genetics/defense/development arc | **Conditional** — the functional arc and authored endpoint are automated and live-smoked; subjective satisfaction awaits playtesting. |
| Visible traits, buildings, weapons, fox types, and controls have real functions | **Pass** — typed catalogs and deterministic behavior coverage are green. |
| Animation matrix passes and no movement/input lock remains | **Pass (automated)** — profiles, transitions, input cleanup, persisted movement E2E, and live movement smoke pass; human signoff remains deferred. |
| Save recovery, settings, keyboard accessibility, and production smoke | **Pass** — deterministic, browser, deployment, and live evidence are recorded. |
| Target-device frame/load/memory budgets | **Pass for the supported automated desktop-browser target** — fixed-step budgets, staged loading, and resource lifecycle tests pass. Broader device sampling remains future validation. |
| External players finish without coaching | **Deferred by owner** — not performed and not claimed. |

No post-gate expansion should start until the deferred human checks are completed and the conditional
criteria are reviewed again.

## Review findings and follow-ups

No release-blocking code defect was found. The completed work is internally consistent and its automated
evidence is reproducible. Four non-blocking engineering/repository risks remain:

1. `main` has no GitHub branch-protection rule. CI and deployment are configured correctly, but repository
   settings do not technically prevent an accidental direct push. Required human PR approval is intentionally
   not enabled because the owner opted out of per-PR reviews.
2. The production JavaScript entry is about 1.26 MB minified (about 357 KB gzip) and still triggers Vite's
   chunk-size warning. Asset staging improved startup behavior, but measured code splitting remains useful.
3. `GameRuntime.ts` and the primary HUD remain large coordination surfaces. Focused controllers and services
   substantially homogenized the architecture, but future changes should continue extracting responsibilities
   behind characterization tests instead of rewriting them wholesale.
4. A formatter/linter is still not configured. Strict TypeScript, tests, and `git diff --check` provide a solid
   baseline, but a narrowly introduced formatting/lint policy would reduce cross-contributor style drift.
