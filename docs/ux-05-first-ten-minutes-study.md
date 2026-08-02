# UX-05 first-ten-minutes study

The implementation uses a derived, non-saved guide in `src/sim/onboarding.ts`. It presents eight
short beats from first movement through the first merchant visit. The persistent settlement objective,
save status, market compass, Help button, and pause/settings route remain visible alongside it.

## Study protocol

Run this on a fresh production build in a private browser context. Give each participant only this
instruction: “Start a New Adventure and establish a homestead. I will not coach you.” Do not explain
controls or point at the starter plot. End the session after the first merchant visit or ten minutes,
whichever comes first.

For each participant, record:

- whether the beat was completed without coaching;
- the first visible confusion or rejected action and its wording;
- the elapsed session time at completion, using a moderator timer or a later sanitized diagnostics
  export rather than browser storage or the full save;
- whether the participant noticed the fox-risk prompt, Save status, Help, and Settings route;
- one short explanation of what they expected at any point where they paused or backtracked.

The eight beats are movement, shovel action, planting, watering, crop protection, harvest, market
sale, and merchant/next-goal choice. Completion means the state transition represented by the beat,
not merely opening a panel. A rejected action is counted separately from confusion; do not silently
reinterpret either as success.

## Participant record

| Participant | Completed beats | First confusion/rejection | Fox hint noticed | Saved noticed | Help/Settings noticed | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | — | — | — | — | — | — |
| P2 | — | — | — | — | — | — |
| P3 | — | — | — | — | — | — |
| P4 | — | — | — | — | — | — |
| P5 | — | — | — | — | — | — |

This repository contains deterministic transition coverage and a browser smoke procedure, but no
fabricated participant findings. The five-person external study remains required evidence before
the UX-05 acceptance criterion and the Core Release Gate can be declared complete.
