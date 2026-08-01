# Model credits

Tarnation's accepted game-ready models come from the CC0 Quaternius packs listed below. The
manifest in `src/content/models.ts` is the source of truth for the subset currently used by the
game; extra converted files remain available for future asset-led work.

---

## Quaternius (CC0)

Primary art source. https://quaternius.com — CC0, commercial use, no attribution required.

| File | Source | Pack |
|---|---|---|
| `characters/player.glb` | `Cowboy_Male` | Ultimate Animated Character Pack (Nov 2019) |

**Animated packs ship glTF** (Characters, Animated Animals, Monsters) — use it directly, no
conversion, so rigs can't break. The static packs are FBX-only and go through
`scripts/convert-fbx.mjs`.

Raw pack zips are archived outside git.

### Packs in use

| Pack | Used for |
|---|---|
| Ultimate Animated Character Pack (Nov 2019) | `characters/player.glb` — Cowboy_Male |
| Ultimate Animated Animals (Jul 2021) | 10 animals incl. fox, donkey, cow, deer, stag, horse |
| Nature Crops Pack (Jan 2020) | 102 crop models, 4 growth stages per species |
| Ultimate Nature Pack (Jun 2019) | instanced rocks, bushes, plants, grass, and flowers |
| Textured Stylized Trees — May 2020 | instanced farm trees |
| Farm Buildings (Sept 2018) | 13 — barn, silo, windmill, water tower, well, coop, fences |

All CC0. Raw pack zips archived outside git.
