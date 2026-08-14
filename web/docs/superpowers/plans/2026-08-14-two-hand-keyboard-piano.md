# Two-Hand Keyboard Piano Implementation Plan

1. Add event-part types and canonical keyboard aliases; lock them with unit tests.
2. Normalize old lyric continuations to Enter, old instrumental digits to Shift, and all events to independent parts.
3. Extend the player state machine to accept coordinated parts in either order and advance only when complete.
4. Update PlayerShell so sibling parts retain independent audio voices, physical codes remain repeat-safe, and only the first part starts event timing/tempo observation.
5. Add a pure restrained left-hand arranger and apply it idempotently to normalized performance songs.
6. Update lyric, highway, shared bar, and on-screen keyboard prompts for Enter, Space, Shift, and combined targets.
7. Run focused tests, full unit tests, TypeScript, lint, render verification, and local browser checks.
