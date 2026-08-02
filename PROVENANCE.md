# Asset and audio provenance ledgers

These ledgers are part of the release contract. A shipped model, texture, audio file, or authored
replacement must have a source, license/provenance decision, and repository path recorded before it is
referenced by production content.

| Family | Shipped source of truth | Provenance and license | Verification |
|---|---|---|---|
| Accepted GLB model packs | `src/content/models.ts`, `public/models/CREDITS.md` | Quaternius packs recorded as CC0; typed metadata retains provider and license URL | `npm run assetcheck` |
| Authored low-poly props | `src/game/MarketStall.ts`, `src/game/PresentationProps.ts`, `ASSETS.md` | Repository-authored silhouettes; no third-party asset license claimed | `npm run assetcheck` and production E2E |
| Authored audio | `public/audio/*.wav`, `public/audio/CREDITS.md`, `scripts/generate-audio.mjs` | Deterministically generated repository source; no third-party recordings or samples | `npm run audiocheck` |

Raw third-party pack archives are kept outside the repository. Do not add an asset with unknown
licensing or provenance. The repository itself is all-rights-reserved; see [`LICENSE`](LICENSE).
