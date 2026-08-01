# Model credits

Placeholder character models, borrowed from Gloamreach's asset set while Tarnation's
own art is decided.

| File | Original | Source |
|---|---|---|
| `player.glb` | `thorn-ranger.glb` | KayKit Adventurers by Kay Lousberg |
| `weasel.glb` | `skeleton-minion.glb` | KayKit Skeletons by Kay Lousberg |
| `stalker.glb` | `skeleton-warrior.glb` | KayKit Skeletons by Kay Lousberg |
| `animal_a.glb` | `gloam-barbarian.glb` | KayKit Adventurers by Kay Lousberg |
| `animal_b.glb` | `gloam-rogue.glb` | KayKit Adventurers by Kay Lousberg |

**Licence: CC0** — see `LICENSE-adventurers-CC0.txt` and `LICENSE-skeletons-CC0.txt`.
Commercial use permitted, no attribution required. Credit given anyway.

These `.glb` files require three glTF extensions — `EXT_meshopt_compression`,
`KHR_mesh_quantization`, `KHR_texture_basisu`. A bare `GLTFLoader` throws on all
three. `src/game/Assets.ts` wires up `MeshoptDecoder` and `KTX2Loader`; the KTX2
transcoder lives in `public/basis/`. Do not remove it.

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
| Ultimate Nature Pack (Jun 2019) | 150 trees, rocks, bushes |
| Farm Buildings (Sept 2018) | 13 — barn, silo, windmill, water tower, well, coop, fences |

All CC0. Raw pack zips archived outside git.
