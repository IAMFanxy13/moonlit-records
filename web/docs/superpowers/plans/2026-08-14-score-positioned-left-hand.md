# Score-Positioned Left Hand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Enter/Shift with 1/2, render every Space cue at its real score-time position below the unchanged lyric, and preserve simple physical input while producing bounded, elegant multi-note piano gestures.

**Architecture:** Separate physical-input canonicalization from legacy-score migration so old songs keep loading without keeping Enter/Shift active. Add a pure left-hand cue projector that compares left-hand onset times with lyric-token onset times, then render its output as an independent cue track. Keep rich sound inside existing `PianoGesture`, arranger, and piano-engine boundaries rather than scheduling automatic notes.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4, Testing Library, Tone.js 15, vinext/Vite.

## Global Constraints

- No future pitched attack without a new physical keydown.
- `A–Z` starts lyric tokens, `Digit1` continues them, `Digit2` triggers lyric-free right hand, and `Space` triggers left hand.
- Physical Enter and Shift are inactive; legacy score aliases migrate only at import/normalization time.
- Main lyric text, order, centered wrapping, local library, free play, tempo, pause, restart, replay, rename, delete, and code import remain compatible.
- `Space` cue placement derives from score onset data, never nearest-token rounding.
- No new dependency, autoplay, scoring system, pedal key, MIDI, OCR, PDF, network API, or unrelated redesign.

---

### Task 1: Control Contract and Legacy Migration

**Files:**
- Modify: `app/lib/keyboard.ts`
- Modify: `app/lib/song-normalizer.ts`
- Modify: `app/import/moonlit-score-v2.ts`
- Modify: `app/lib/keyboard.test.ts`
- Modify: `app/lib/song-normalizer.test.ts`
- Modify: `app/import/moonlit-score-v2.test.ts`
- Modify: existing tests containing Enter/Shift guided controls

**Interfaces:**
- Produces: `LYRIC_CONTINUATION_CODE = "Digit1"`, `INSTRUMENTAL_MELODY_CODE = "Digit2"`.
- Produces: `canonicalScoreTargetCode(code: string): string` for legacy data aliases only.
- Preserves: `canonicalPerformanceCode(code: string): string` for physical runtime input without Enter/Shift aliases.

- [ ] **Step 1: Write failing tests for runtime and migration behavior**

```ts
expect(canonicalPerformanceCode("Enter")).toBe("Enter");
expect(isPerformanceInputCode("Enter")).toBe(false);
expect(canonicalScoreTargetCode("Enter")).toBe("Digit1");
expect(canonicalScoreTargetCode("ShiftLeft")).toBe("Digit2");
expect(normalizeSongPackage(legacy).events.map((event) => event.targetCode))
  .toEqual(["KeyA", "Digit1", "Digit2"]);
```

- [ ] **Step 2: Run focused tests and verify failures are caused by the old Enter/Shift contract**

Run: `npm test -- app/lib/keyboard.test.ts app/lib/song-normalizer.test.ts app/import/moonlit-score-v2.test.ts`

- [ ] **Step 3: Implement separate score-target migration and new physical controls**

```ts
export const LYRIC_CONTINUATION_CODE = "Digit1";
export const INSTRUMENTAL_MELODY_CODE = "Digit2";
export function canonicalScoreTargetCode(code: string): string {
  if (code === "Enter" || code === "NumpadEnter") return LYRIC_CONTINUATION_CODE;
  if (code === "Shift" || code === "ShiftLeft" || code === "ShiftRight") return INSTRUMENTAL_MELODY_CODE;
  return canonicalPerformanceCode(code);
}
```

Use score canonicalization only in normalizers/parsers. Runtime physical input accepts `Digit1`, `Digit2`, `Space`, letters, and existing playable digits, but not Enter or Shift.

- [ ] **Step 4: Update parser validation, UI-facing labels, and old guided-control tests**

New Score/2 material requires `Digit1` and `Digit2`. Legacy aliases are accepted before strict normalized validation. Repeated `Digit1`/`Digit2` still require keyup and a new keydown.

- [ ] **Step 5: Run the focused control and player test set**

Run: `npm test -- app/lib/keyboard.test.ts app/lib/song-normalizer.test.ts app/import/moonlit-score-v2.test.ts app/lib/player-machine.test.ts app/lib/two-hand-player.test.ts app/components/PlayerShell.test.tsx`

### Task 2: Pure Score-Time Left-Hand Cue Projection

**Files:**
- Create: `app/lib/left-hand-cues.ts`
- Create: `app/lib/left-hand-cues.test.ts`
- Modify: `app/lib/song.ts` only if a cue type belongs in the shared score model

**Interfaces:**
- Consumes: normalized `SongPackage`, phrase index, lyric token event ranges, and left-hand `Space` parts.
- Produces: `buildLeftHandCues(song: SongPackage, phraseIndex: number): LeftHandCue[]`.

```ts
export interface LeftHandCue {
  id: string;
  eventIndex: number;
  onsetMs: number;
  position: "before" | "under" | "between" | "after";
  beforeTokenId?: string;
  afterTokenId?: string;
  ratio: number;
  inferred: boolean;
}
```

- [ ] **Step 1: Write failing tests for before, under, between, after, and temporal interpolation**

```ts
expect(buildLeftHandCues(song, 0).map(({ position, ratio }) => ({ position, ratio })))
  .toEqual([
    { position: "before", ratio: 0 },
    { position: "under", ratio: 0 },
    { position: "between", ratio: 0.25 },
    { position: "after", ratio: 1 },
  ]);
```

Also prove a cue at 25% between tokens is not rounded to the closest token, and prove a simultaneous right/left event is `under`.

- [ ] **Step 2: Run the new test and verify it fails because the projector does not exist**

Run: `npm test -- app/lib/left-hand-cues.test.ts`

- [ ] **Step 3: Implement onset extraction and neighboring-token interpolation**

Use each event's `sourceStartMs`. For a missing time, fall back to stable event order and set `inferred: true`. Use a small tolerance derived from tempo for simultaneous notation; do not alter the authored event time.

- [ ] **Step 4: Run projector tests and refactor while green**

Run: `npm test -- app/lib/left-hand-cues.test.ts`

### Task 3: Lyric Cue Track and Keyboard UI

**Files:**
- Modify: `app/components/LyricStage.tsx`
- Modify: `app/components/LyricStage.test.tsx`
- Modify: `app/components/ScreenKeyboard.tsx`
- Modify: `app/components/ScreenKeyboard.test.tsx`
- Modify: `app/components/RhythmGuide.tsx`
- Modify: `app/components/RhythmGuide.test.tsx`
- Modify: `app/components/PlayerShell.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `buildLeftHandCues` output.
- Produces: an accessible `.left-hand-cue-track` containing visible `SPACE` markers with `data-cue-position`, `data-cue-ratio`, and current/upcoming state.

- [ ] **Step 1: Write failing component tests**

```tsx
expect(screen.getByTestId("key-Digit1")).toHaveTextContent("1");
expect(screen.getByTestId("key-Digit2")).toHaveTextContent("2");
expect(screen.queryByTestId("key-Enter")).not.toBeInTheDocument();
expect(screen.getByLabelText("Left hand cue, between lyrics")).toHaveAttribute("data-cue-ratio", "0.25");
expect(screen.getByText("Current lyric: ...")).toBeTruthy();
```

Test that the original lyric text and token sequence are unchanged, a simultaneous cue is under its token, and current cues use the target state.

- [ ] **Step 2: Run component tests and verify the old keyboard/cue UI fails**

Run: `npm test -- app/components/LyricStage.test.tsx app/components/ScreenKeyboard.test.tsx app/components/RhythmGuide.test.tsx`

- [ ] **Step 3: Render the independent cue track and update control copy**

Keep `.lyric-progress` intact. Render cue markers in a sibling layer below it. Use token refs and measured centers when available; use deterministic normalized positions for SSR/tests. Recalculate on phrase change and resize without changing lyric DOM order.

- [ ] **Step 4: Style cues below lyrics without clipping centered wrapping**

Use absolute marker positioning inside a bounded relative track, reserve cue-row height, and preserve existing mobile/desktop breakpoints. The active marker remains legible without becoming a timing score.

- [ ] **Step 5: Run component and PlayerShell tests**

Run: `npm test -- app/components/LyricStage.test.tsx app/components/ScreenKeyboard.test.tsx app/components/RhythmGuide.test.tsx app/components/PlayerShell.test.tsx`

### Task 4: Bounded Rich Gestures, Built-ins, Documentation, and Full Verification

**Files:**
- Modify: `app/lib/two-hand-arranger.ts`
- Modify: `app/lib/two-hand-arranger.test.ts`
- Modify: `app/lib/songs.test.ts`
- Modify: `app/audio/piano-engine.test.ts`
- Modify: `docs/moonlit-score-2-authoring-guide.md`
- Modify: `docs/gpt-piano-arrangement-prompt.md`
- Modify: `docs/final-piano-experience-report.md`

**Interfaces:**
- Preserves: one keydown attacks one simultaneous `PianoGesture` and never schedules a later pitch.
- Produces: restrained right-hand voicings and two-to-four-note open left-hand voicings with melody-prominent velocities and harmony IDs.

- [ ] **Step 1: Write failing musical-bound tests**

```ts
expect(left.notes.length).toBeGreaterThanOrEqual(2);
expect(left.notes.length).toBeLessThanOrEqual(4);
expect(Math.max(...right.velocities!)).toBeGreaterThan(Math.max(...left.velocities!));
expect(new Set(prepared.events.flatMap((event) => event.parts?.map((part) => part.targetCode))))
  .not.toContain("Enter");
```

Prove existing authored gestures are preserved, fallback left hand is open-spaced, and no engine call schedules a future attack without input.

- [ ] **Step 2: Run arranger/audio tests and verify the missing bounds fail**

Run: `npm test -- app/lib/two-hand-arranger.test.ts app/lib/songs.test.ts app/audio/piano-engine.test.ts`

- [ ] **Step 3: Add the smallest arranger and dynamics changes that satisfy the bounds**

Keep phrase/downbeat placement conservative. Prefer bass/root, fifth, octave, and optional upper color tone according to energy. Avoid close low-register thirds. Do not manufacture a timed arpeggio.

- [ ] **Step 4: Update Score/2 documentation and the GPT arrangement prompt**

Document `Digit1`, `Digit2`, real `Space` onset placement, melody prominence, open bass spacing, bounded density, and the prohibition on future automatic attacks.

- [ ] **Step 5: Run complete verification**

Run sequentially:

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run test:render
```

Then start the local site if needed, confirm `http://localhost:3000/` returns HTTP 200, and exercise Digit1, Digit2, Space-before/under/between/after, simultaneous hands, wrong-key free sound, pause/restart cleanup, and completion tail in the available browser tooling.

- [ ] **Step 6: Review the final diff against every requirement and commit the implementation**

Stage only files belonging to this increment. Preserve unrelated user changes in the dirty worktree.
