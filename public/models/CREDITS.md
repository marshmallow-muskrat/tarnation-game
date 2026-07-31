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
