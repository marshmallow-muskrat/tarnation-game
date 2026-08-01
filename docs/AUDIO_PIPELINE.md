# Audio pipeline

Audio is a polish milestone, not a reason to block the current playable loop. Build a small,
coherent sound vocabulary for footsteps, shovel/axe contact, crops, water, sales, fox warnings,
traps, building, and UI actions.

## Rules

- Keep repeated sounds from machine-gunning: vary pitch or playback rate by roughly 5–8%.
- Layer a readable contact sound with a quieter material or movement layer where it helps.
- Use gain automation for reward, danger, and major state changes rather than making every sound
  louder.
- Keep volume controls and a mute path available from the HUD or pause screen.
- Record every third-party file in `docs/AUDIO_CREDITS.md` with source, URL, license, and required
  attribution before shipping it.

The implementation should use the browser Web Audio path already available to the game and remain
optional: a missing sound file must not prevent the game from loading. Synthesised UI feedback is
fine for development; final sounds should be reviewed in the normal game camera and mix.
