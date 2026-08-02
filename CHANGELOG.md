# Changelog

All notable shipped changes are recorded here by release or milestone. Entries describe player-visible
behavior, compatibility or migration impact, verification evidence, and known limitations. Do not list
unreleased experiments as completed features.

## 0.3.0 — M10 release hardening — 2026-08-02

- Completed QA-01–03 and REL-01–02 with 334 deterministic Vitest tests and 10 production-build E2E journeys.
- Added bounded player diagnostics export, Wrangler 4/Node 24 release hygiene, and compact dismissible
  settlement-objective and market-guide HUD controls (`J`/`G`).
- Verified exact main commit [`7568e1d`](https://github.com/marshmallow-muskrat/tarnation-game/commit/7568e1d)
  through [deployment workflow 30765350012](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30765350012)
  and live smoke at <https://tarnation.pages.dev/>. Human animation/accessibility signoff and external
  playtesting remain deferred by owner and are not claimed.

## Release-note policy

- Keep one concise entry per milestone release.
- Call out save migrations, economy/pricing changes, input/accessibility changes, and intentional
  limitations explicitly.
- Link the exact reviewed commit and automated deployment evidence.
- Do not claim human playtests or external sign-off that did not occur.
