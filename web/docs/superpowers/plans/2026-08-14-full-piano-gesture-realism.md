# Full Piano Gesture & Realism Implementation Plan

1. Extend the song model with gesture metadata while retaining all V1 fields.
2. Add failing normalization tests for initial/Enter/Shift rules, strict validation and built-in catalogue migration.
3. Implement MOONLIT-SCORE/2 as marker plus declarative JSON, strict schema validation and compilation into the shared song model; keep V1 unchanged.
4. Add failing lifecycle tests for independent right/left voices, same-harmony retention, harmony changes and global cleanup.
5. Replace global attack transition with hand/harmony-aware transitions and attach metadata to resonant voices.
6. Add per-note gesture attacks and audio-clock duration scheduling without future pitched attacks.
7. Make the fallback arranger meter/timeline-aware and idempotent; prepare every built-in at the catalogue boundary.
8. Add long-phrase centered wrapping and explicit Enter UI tests.
9. Add authoring guide, fixed GPT arrangement prompt, reference/sample audit and final experience report.
10. Run unit, type, lint, build, rendered/browser checks and package the verified result.
