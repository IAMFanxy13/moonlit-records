# 36-Key Performance Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Moonlit Records a strict 36-key, free-tempo piano instrument whose lyric and instrumental events may emit polyphonic piano voicings while preserving physical key hold/release and global voice behavior.

**Architecture:** Keep the deterministic song package and event compiler separate from React and Tone.js. The player state machine decides whether a physical key is correct, wrong, or free; the audio port owns voice-scoped attacks and releases; React only binds physical key lifecycle to those interfaces.

**Tech Stack:** TypeScript 5.9, React 19, Vitest, Testing Library, Tone.js 15, existing vinext application.

## Global Constraints

- Only `Digit1`–`Digit0` and `KeyA`–`KeyZ` are performance keys.
- Every event consumes exactly one physical key and may output one or more piano pitches.
- No physical key press means no piano sound and no guided progression.
- Wrong keys sound through the active piano voice, turn red, and do not advance.
- OS key repeat is ignored; keydown attacks once and keyup releases the exact attack.
- The selected piano voice governs correct, wrong, and free notes across the entire instrument.
- Imported timestamps never auto-advance Free Performance.
- The current and next lyric phrases remain visible.
- Final completion waits for all held notes and the active acoustic tail.
- No paid API, paid inference service, paid media provider, or trial-only runtime dependency is permitted.

---

### Task 1: Restrict the physical keyboard to 36 stable keys

**Files:**
- Modify: `web/app/lib/keyboard.ts`
- Modify: `web/app/lib/keyboard.test.ts`
- Modify: `web/app/components/ScreenKeyboard.test.tsx`

**Interfaces:**
- Produces: `PERFORMANCE_CODES: readonly string[]`, `KEYBOARD_ROWS: KeyboardKey[][]`, `isPlayableCode(code): boolean`, `defaultNoteFor(code): string`.
- Consumes: none.

- [ ] **Step 1: Replace the current keyboard expectations with failing 36-key tests**

```ts
expect(PERFORMANCE_CODES).toEqual([
  ...digits("1234567890"),
  ...letters("QWERTYUIOP"),
  ...letters("ASDFGHJKL"),
  ...letters("ZXCVBNM"),
]);
expect(PERFORMANCE_CODES).toHaveLength(36);
for (const code of ["Space", "Escape", "Backquote", "Minus", "ArrowLeft"]) {
  expect(isPlayableCode(code)).toBe(false);
}
```

- [ ] **Step 2: Run the focused tests and verify the old Space/punctuation mapping fails**

Run: `npm test -- app/lib/keyboard.test.ts app/components/ScreenKeyboard.test.tsx`  
Expected: FAIL because Space and punctuation remain playable and extra rows render.

- [ ] **Step 3: Implement four visual rows and exactly 36 chromatic notes**

```ts
export const PERFORMANCE_CODES = [
  ..."1234567890".split("").map((n) => `Digit${n}`),
  ..."QWERTYUIOPASDFGHJKLZXCVBNM".split("").map((l) => `Key${l}`),
] as const;

const DEFAULT_NOTES = new Map(
  PERFORMANCE_CODES.map((code, index) => [code, noteForMidi(48 + index)]),
);
```

Delete disabled function/special-key rendering; leave system keys completely uncaptured.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- app/lib/keyboard.test.ts app/components/ScreenKeyboard.test.tsx`  
Expected: PASS with four rows and 36 unique notes from C3 through B5.

- [ ] **Step 5: Commit**

```bash
git add web/app/lib/keyboard.ts web/app/lib/keyboard.test.ts web/app/components/ScreenKeyboard.test.tsx
git commit -m "feat: restrict piano to 36 simple keys"
```

### Task 2: Upgrade the durable song event grammar

**Files:**
- Modify: `web/app/lib/song.ts`
- Create: `web/app/lib/instrumental-route.ts`
- Create: `web/app/lib/instrumental-route.test.ts`
- Create: `web/app/lib/arrangement-compiler.ts`
- Create: `web/app/lib/arrangement-compiler.test.ts`
- Modify: `web/app/lib/songs.ts`

**Interfaces:**
- Produces: `PerformanceEvent`, `SongPackageV2`, `instrumentalTarget(index): string`, `compileArrangement(input): SongPackageV2`.
- Consumes: the 36 key codes from Task 1.

- [ ] **Step 1: Write failing event-schema and mapping tests**

```ts
expect(instrumentalTarget(0)).toBe("Digit1");
expect(instrumentalTarget(9)).toBe("Digit0");
expect(instrumentalTarget(10)).toBe("Digit0");
expect(instrumentalTarget(19)).toBe("Digit1");

const song = compileArrangement({
  id: "fixture",
  lyrics: [{ text: "爱", initial: "A", notes: [["C4"], ["E4", "G4"], ["A4"]] }],
  instrumental: [],
});
expect(song.events.map((event) => event.targetCode)).toEqual(["KeyA", "KeyA", "KeyA"]);
expect(song.events[1].notes).toEqual(["E4", "G4"]);
```

Add cases for English word initials, punctuation omission, several words on the same pitch, hold events, and instrumental endpoint repetition.

- [ ] **Step 2: Run the compiler tests and verify missing modules/types fail**

Run: `npm test -- app/lib/instrumental-route.test.ts app/lib/arrangement-compiler.test.ts`  
Expected: FAIL because the compiler and V2 event grammar do not exist.

- [ ] **Step 3: Define the V2 types**

```ts
export interface PerformanceEvent {
  id: string;
  phraseIndex: number;
  tokenIndex: number | null;
  token: string | null;
  targetCode: PerformanceCode;
  notes: string[];
  velocity: number;
  kind: "tap" | "hold";
  holdMs?: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  confidence: number;
  provenance: string[];
}
```

Keep `recommendedPiano` on `SongPackage`, never on an event. Add `quality: "clear" | "usable" | "sketch"` and metadata provenance.

- [ ] **Step 4: Implement the exact instrumental route and deterministic compiler**

```ts
const DIGIT_ROUTE = [
  "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
  "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
  "Digit0", "Digit9", "Digit8", "Digit7", "Digit6",
  "Digit5", "Digit4", "Digit3", "Digit2", "Digit1",
] as const;

export function instrumentalTarget(index: number) {
  return DIGIT_ROUTE[((index % DIGIT_ROUTE.length) + DIGIT_ROUTE.length) % DIGIT_ROUTE.length];
}
```

Compile lyric initials to `KeyX`, duplicate an initial for every note/voicing in a melisma, and assign digits only to lyric-free events.

- [ ] **Step 5: Migrate built-in song fixtures**

Replace `note` with `notes: [note]`; replace Ode to Joy's Space events with the exact number route; include confidence, provenance, and kind. Expand `Twinkle, Twinkle, Little Star` to the complete common six-line Chinese arrangement and all 42 public-domain melody notes:

```text
一闪一闪亮晶晶 / C C G G A A G
满天都是小星星 / F F E E D D C
挂在天上放光明 / G G F F E E D
好像许多小眼睛 / G G F F E E D
一闪一闪亮晶晶 / C C G G A A G
满天都是小星星 / F F E E D D C
```

Add a regression assertion that the package has six phrases, 42 events, and target initials beginning `Y S Y S L J J`.

- [ ] **Step 6: Run compiler and catalogue tests**

Run: `npm test -- app/lib/instrumental-route.test.ts app/lib/arrangement-compiler.test.ts app/lib/catalog.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/app/lib/song.ts web/app/lib/instrumental-route.ts web/app/lib/instrumental-route.test.ts web/app/lib/arrangement-compiler.ts web/app/lib/arrangement-compiler.test.ts web/app/lib/songs.ts
git commit -m "feat: compile lyrics and interludes into piano events"
```

### Task 3: Make the state machine polyphonic and hold-aware

**Files:**
- Modify: `web/app/lib/player-machine.ts`
- Modify: `web/app/lib/player-machine.test.ts`

**Interfaces:**
- Produces: `PianoSound { notes: string[]; velocity; kind }`, hold progress state, `pressKey`, `releaseKey`, `finishRinging`.
- Consumes: `PerformanceEvent` from Task 2.

- [ ] **Step 1: Write failing tests for polyphonic output, holds, repeats, and wrong keys**

```ts
expect(pressKey(started, chordSong, "KeyA").sound?.notes).toEqual(["C4", "E4", "G4"]);
const holding = pressKey(started, holdSong, "KeyA").state;
expect(holding.activeHold).toMatchObject({ eventIndex: 0, code: "KeyA" });
expect(releaseKey(holding, holdSong, "KeyA", 120).state.eventIndex).toBe(0);
expect(releaseKey(holding, holdSong, "KeyA", 900).state.eventIndex).toBe(1);
```

- [ ] **Step 2: Run the focused state-machine test**

Run: `npm test -- app/lib/player-machine.test.ts`  
Expected: FAIL on `notes`, `activeHold`, and `releaseKey`.

- [ ] **Step 3: Implement hold state without any wall-clock auto-advance**

`pressKey` advances tap events immediately on a correct fresh keydown. A correct hold keydown records `{ eventIndex, code, startedAt }`; only matching keyup calls `releaseKey`. Early release records feedback and leaves the event current. Wrong/free keys never create a guided hold.

- [ ] **Step 4: Run the focused test**

Run: `npm test -- app/lib/player-machine.test.ts`  
Expected: PASS, including no progression from elapsed time alone.

- [ ] **Step 5: Commit**

```bash
git add web/app/lib/player-machine.ts web/app/lib/player-machine.test.ts
git commit -m "feat: add polyphonic and held song events"
```

### Task 4: Make piano attacks voice-scoped and polyphonic

**Files:**
- Modify: `web/app/audio/piano-engine.ts`
- Modify: `web/app/audio/piano-engine.test.ts`
- Modify: `web/app/audio/piano-voices.ts`

**Interfaces:**
- Produces: `PianoAttackHandle`, `PianoPort.attack(notes, velocity): PianoAttackHandle`, `PianoPort.release(handle)`, global `setVoice` for future attacks.
- Consumes: `PianoVoice` and song-note arrays.

- [ ] **Step 1: Write failing audio-port tests**

```ts
const handle = piano.attack(["C4", "E4", "G4"], 96);
piano.setVoice("concert");
const next = piano.attack(["D4"], 88);
piano.release(handle);
expect(handle.voice).toBe("warm");
expect(next.voice).toBe("concert");
expect(warmSampler.triggerRelease).toHaveBeenCalledWith(["C4", "E4", "G4"]);
```

- [ ] **Step 2: Run the audio test and verify the scalar API fails**

Run: `npm test -- app/audio/piano-engine.test.ts`  
Expected: FAIL because attacks return no handle and release accepts a note string.

- [ ] **Step 3: Implement one lazy voice channel per piano profile**

```ts
export interface PianoAttackHandle {
  id: number;
  voice: PianoVoice;
  notes: readonly string[];
}
```

Each voice channel owns its Sampler/filter/reverb chain. `setVoice` selects the channel for future attacks. Existing handles release through their original channel, so a voice switch never truncates held or ringing notes. `releaseAll` releases every channel.

- [ ] **Step 4: Run audio tests**

Run: `npm test -- app/audio/piano-engine.test.ts app/audio/piano-voices.test.ts`  
Expected: PASS for global future attacks, old-voice releases, polyphony, velocity clamping, and tail calculation.

- [ ] **Step 5: Commit**

```bash
git add web/app/audio/piano-engine.ts web/app/audio/piano-engine.test.ts web/app/audio/piano-voices.ts
git commit -m "feat: apply piano voice to the complete instrument"
```

### Task 5: Bind React to exact physical attack/release semantics

**Files:**
- Modify: `web/app/components/PlayerShell.tsx`
- Modify: `web/app/components/PlayerShell.test.tsx`
- Modify: `web/app/components/LyricStage.tsx`
- Modify: `web/app/components/LyricStage.test.tsx`
- Modify: `web/app/components/ScreenKeyboard.tsx`

**Interfaces:**
- Consumes: voice-scoped attack handles from Task 4 and state-machine release results from Task 3.
- Produces: accessible KTV current/next phrases, hold rail, 36-key physical UI.

- [ ] **Step 1: Write failing component tests**

Cover one-key chord attack/release, global voice change for a later wrong/free key, ignored Space, repeated target requiring keyup, hold rail/early release, current+next phrases, and final acoustic idle.

```ts
fireEvent.keyDown(window, { code: "KeyA" });
expect(piano.attack).toHaveBeenCalledWith(["C4", "E4", "G4"], 96);
fireEvent.keyDown(window, { code: "Space" });
expect(piano.attack).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run the focused components**

Run: `npm test -- app/components/PlayerShell.test.tsx app/components/LyricStage.test.tsx app/components/ScreenKeyboard.test.tsx`  
Expected: FAIL on the new event and audio contracts.

- [ ] **Step 3: Store attack handles by physical code**

Replace `Map<string, string>` with `Map<string, PianoAttackHandle>`. On fresh playable keydown, call `pressKey`, attack the returned pitch array, and store the handle. On keyup, release the handle and call `releaseKey` for hold validation. Space and every non-36 code return without `preventDefault`.

- [ ] **Step 4: Render hold and instrumental guidance**

Show a restrained hold rail only for `kind: "hold"`; show number-row previews for instrumental events; keep current and next KTV phrases visible; do not introduce automatic timers that advance events.

- [ ] **Step 5: Run the focused components**

Run: `npm test -- app/components/PlayerShell.test.tsx app/components/LyricStage.test.tsx app/components/ScreenKeyboard.test.tsx`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/app/components/PlayerShell.tsx web/app/components/PlayerShell.test.tsx web/app/components/LyricStage.tsx web/app/components/LyricStage.test.tsx web/app/components/ScreenKeyboard.tsx
git commit -m "feat: connect 36-key performance lifecycle"
```

### Task 6: Verify the complete performance core

**Files:**
- Modify only if validation exposes an actual defect.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`  
Expected: all tests pass.

- [ ] **Step 2: Run static and production validation**

Run: `npm run lint`  
Expected: zero errors.  
Run: `npm run build`  
Expected: production build succeeds.

- [ ] **Step 3: Commit any validation-only correction**

```bash
git add web
git commit -m "fix: close performance-core validation gaps"
```
