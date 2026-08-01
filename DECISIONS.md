# Decisions

## 2026-08-01 — Use Ultimate Nature models for chunk scatter

Scatter keeps its existing deterministic counts and placement, but its grass, rocks, bushes,
and flowers/plants now use Ultimate Nature Pack models through `instancedParts()`. Each model
variant gets one `InstancedMesh` per glTF part. If a model is missing or fails to load, the old
primitive geometry remains the fallback. The rejected `sn_` Stylized Nature assets are not used.
