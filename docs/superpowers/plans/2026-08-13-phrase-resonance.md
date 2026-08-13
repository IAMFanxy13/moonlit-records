# Phrase Resonance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make adjacent correct song notes join into a bounded, phrase-aware piano resonance while every audible attack still requires a physical keyboard keydown.

**Architecture:** Keep Tone.js sample attack/release ownership unchanged and add a pure resonance-policy module between physical keyup and `PianoPort.keyUp()`. `PlayerShell` continues to own browser input and timers, but it stores metadata for each physical voice, defers only correct song voices, and releases deferred handles at pitch conflicts, rests, phrase changes, capacity limits, expiry, or lifecycle cleanup.

**Tech Stack:** React 19, TypeScript 5.9, Tone.js 15.1.22, Vitest 4, Testing Library, Vite/vinext

## Global Constraints

- Do not add Shift, sustain-pedal controls, MIDI, scoring, automatic playback, automatic accompaniment, OCR, PDF processing, or network calls.
- A–Z, 1–0, and Space mappings stay unchanged; every attack still requires a fresh non-repeat physical keydown.
- Wrong and paused/free-play keys sound normally, never advance the score, and release immediately on their own keyup.
- A correct keydown advances the score immediately; keyup never changes the score cursor.
- Correct-key resonance is capped at four deferred gestures and 2,400 milliseconds per gesture.
- A same-pitch retrigger, phrase boundary, or printed rest releases conflicting deferred voices before the new attack.
- Pause, restart, replay line, exit, blur, visibility loss, and unmount release every active/deferred voice and cancel all related timers.
- Completion waits for physical keys and phrase resonance to clear before starting the existing room-tail timer.
- Keep the shared duration bar advisory only; early release and over-holding remain legal.
- Do not change MOONLIT-SCORE syntax or migrate saved songs; existing `SongEvent.notes` remains the explicit chord/bass representation.
- Preserve exact per-physical-source ownership in the Tone 15.1.22 piano engine.

---

## File Map

- Create `web/app/lib/phrase-resonance.ts`: pure, deterministic resonance-bank policy with no React, browser timer, or audio side effects.
- Create `web/app/lib/phrase-resonance.test.ts`: unit coverage for phrase/rest/pitch/capacity/expiry decisions.
- Modify `web/app/components/PlayerShell.tsx`: physical-voice metadata, timer ownership, deferred release integration, completion/lifecycle coordination.
- Modify `web/app/components/PlayerShell.test.tsx`: integration coverage for overlap, immediate free release, expiry, cleanup, and final-tail ordering.
- Modify `web/README.md`: document phrase-aware automatic damper behaviour and its strict bounds.

### Task 1: Pure phrase-resonance policy

**Files:**
- Create: `web/app/lib/phrase-resonance.ts`
- Create: `web/app/lib/phrase-resonance.test.ts`

**Interfaces:**
- Consumes: `PianoKeyHandle` from `web/app/audio/piano-engine.ts` and `SongEvent` from `web/app/lib/song.ts`.
- Produces:

```ts
export const MAX_RESONANT_GESTURES = 4;
export const MAX_RESONANCE_MS = 2_400;

export interface ResonantVoice {
  id: number;
  handle: PianoKeyHandle;
  phraseIndex: number;
  notes: readonly string[];
  releasedAt: number;
}

export interface PhraseResonanceState {
  voices: ResonantVoice[];
}

export interface ResonanceTransition {
  state: PhraseResonanceState;
  release: PianoKeyHandle[];
}

export function createPhraseResonanceState(): PhraseResonanceState;
export function deferVoice(state: PhraseResonanceState, voice: ResonantVoice): ResonanceTransition;
export function prepareAttack(state: PhraseResonanceState, event: SongEvent): ResonanceTransition;
export function expireVoice(state: PhraseResonanceState, handleId: number): ResonanceTransition;
export function clearResonance(state: PhraseResonanceState): ResonanceTransition;
```

- [ ] **Step 1: Write failing tests for defer, capacity, expiry, and clearing**

Create helpers and these assertions in `web/app/lib/phrase-resonance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PianoKeyHandle } from "../audio/piano-engine";
import type { SongEvent } from "./song";
import {
  clearResonance,
  createPhraseResonanceState,
  deferVoice,
  expireVoice,
  MAX_RESONANT_GESTURES,
  prepareAttack,
} from "./phrase-resonance";

function handle(id: number, notes = [`C${id + 3}`]): PianoKeyHandle {
  return { id, voice: "warm", notes, channelHandle: { release() {} } };
}

function event(overrides: Partial<SongEvent> = {}): SongEvent {
  return {
    id: "event", phraseIndex: 0, tokenIndex: 0, token: "你",
    targetCode: "KeyN", notes: ["C4"], note: "C4", velocity: 80,
    kind: "tap", confidence: 1, provenance: [], ...overrides,
  };
}

it("keeps only four deferred gestures and releases the oldest", () => {
  let state = createPhraseResonanceState();
  const released: PianoKeyHandle[] = [];
  for (let id = 1; id <= MAX_RESONANT_GESTURES + 1; id += 1) {
    const transition = deferVoice(state, {
      id, handle: handle(id), phraseIndex: 0, notes: [`C${id + 3}`], releasedAt: id,
    });
    state = transition.state;
    released.push(...transition.release);
  }
  expect(state.voices.map((voice) => voice.id)).toEqual([2, 3, 4, 5]);
  expect(released.map((voice) => voice.id)).toEqual([1]);
});

it("expires exactly one source and clear returns every remaining handle", () => {
  const first = deferVoice(createPhraseResonanceState(), {
    id: 1, handle: handle(1), phraseIndex: 0, notes: ["C4"], releasedAt: 10,
  }).state;
  const second = deferVoice(first, {
    id: 2, handle: handle(2), phraseIndex: 0, notes: ["D4"], releasedAt: 20,
  }).state;
  const expired = expireVoice(second, 1);
  expect(expired.release.map((voice) => voice.id)).toEqual([1]);
  expect(clearResonance(expired.state).release.map((voice) => voice.id)).toEqual([2]);
});
```

- [ ] **Step 2: Run the focused tests and verify the missing module fails**

Run: `cd web && npm test -- app/lib/phrase-resonance.test.ts`

Expected: FAIL because `./phrase-resonance` does not exist.

- [ ] **Step 3: Add failing tests for phrase, rest, and exact pitch conflicts**

Append:

```ts
it("releases an older phrase and every voice before a printed rest", () => {
  const state = {
    voices: [
      { id: 1, handle: handle(1), phraseIndex: 0, notes: ["C4"], releasedAt: 10 },
      { id: 2, handle: handle(2), phraseIndex: 0, notes: ["D4"], releasedAt: 20 },
    ],
  };
  expect(prepareAttack(state, event({ phraseIndex: 1 })).release.map((item) => item.id)).toEqual([1, 2]);
  expect(prepareAttack(state, event({ restBeforeMs: 250 })).release.map((item) => item.id)).toEqual([1, 2]);
});

it("releases only voices sharing a pitch with the new gesture", () => {
  const state = {
    voices: [
      { id: 1, handle: handle(1), phraseIndex: 0, notes: ["C4", "E4"], releasedAt: 10 },
      { id: 2, handle: handle(2), phraseIndex: 0, notes: ["D4"], releasedAt: 20 },
    ],
  };
  const transition = prepareAttack(state, event({ notes: ["E4", "G4"] }));
  expect(transition.release.map((item) => item.id)).toEqual([1]);
  expect(transition.state.voices.map((voice) => voice.id)).toEqual([2]);
});
```

- [ ] **Step 4: Implement the minimal immutable policy**

Create `web/app/lib/phrase-resonance.ts` with:

```ts
import type { PianoKeyHandle } from "../audio/piano-engine";
import type { SongEvent } from "./song";

export const MAX_RESONANT_GESTURES = 4;
export const MAX_RESONANCE_MS = 2_400;

export interface ResonantVoice {
  id: number;
  handle: PianoKeyHandle;
  phraseIndex: number;
  notes: readonly string[];
  releasedAt: number;
}

export interface PhraseResonanceState { voices: ResonantVoice[] }
export interface ResonanceTransition {
  state: PhraseResonanceState;
  release: PianoKeyHandle[];
}

function split(
  state: PhraseResonanceState,
  shouldRelease: (voice: ResonantVoice) => boolean,
): ResonanceTransition {
  const keep: ResonantVoice[] = [];
  const release: PianoKeyHandle[] = [];
  state.voices.forEach((voice) => {
    if (shouldRelease(voice)) release.push(voice.handle);
    else keep.push(voice);
  });
  return { state: { voices: keep }, release };
}

export function createPhraseResonanceState(): PhraseResonanceState {
  return { voices: [] };
}

export function deferVoice(state: PhraseResonanceState, voice: ResonantVoice): ResonanceTransition {
  const voices = [...state.voices, voice];
  const overflow = Math.max(0, voices.length - MAX_RESONANT_GESTURES);
  return {
    state: { voices: voices.slice(overflow) },
    release: voices.slice(0, overflow).map((item) => item.handle),
  };
}

export function prepareAttack(state: PhraseResonanceState, event: SongEvent): ResonanceTransition {
  const nextPitches = new Set(event.notes);
  return split(state, (voice) =>
    Boolean(event.restBeforeMs && event.restBeforeMs > 0) ||
    voice.phraseIndex !== event.phraseIndex ||
    voice.notes.some((note) => nextPitches.has(note)),
  );
}

export function expireVoice(state: PhraseResonanceState, handleId: number): ResonanceTransition {
  return split(state, (voice) => voice.id === handleId);
}

export function clearResonance(state: PhraseResonanceState): ResonanceTransition {
  return { state: createPhraseResonanceState(), release: state.voices.map((voice) => voice.handle) };
}
```

- [ ] **Step 5: Run the policy tests and typecheck**

Run: `cd web && npm test -- app/lib/phrase-resonance.test.ts && npx tsc --noEmit`

Expected: all phrase-resonance tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit the pure policy**

```bash
git add web/app/lib/phrase-resonance.ts web/app/lib/phrase-resonance.test.ts
git commit -m "feat: add bounded phrase resonance policy"
```

### Task 2: Integrate physical voice metadata and deferred correct-key release

**Files:**
- Modify: `web/app/components/PlayerShell.tsx`
- Modify: `web/app/components/PlayerShell.test.tsx`

**Interfaces:**
- Consumes: all Task 1 exports, especially `prepareAttack`, `deferVoice`, `expireVoice`, and `MAX_RESONANCE_MS`.
- Produces the local physical-key record:

```ts
interface PlayedVoice {
  handle: PianoKeyHandle;
  kind: "correct" | "wrong" | "free";
  eventIndex: number | null;
  phraseIndex: number | null;
  notes: readonly string[];
}
```

- [ ] **Step 1: Change the overlap test to require deferred correct release**

In `PlayerShell.test.tsx`, rename the N/H overlap test and change its release assertions:

```ts
it("keeps a released correct N resonating while H attacks", () => {
  const piano = fakePiano();
  render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

  fireEvent.keyDown(window, { code: "KeyN", key: "n" });
  fireEvent.keyUp(window, { code: "KeyN", key: "n" });
  expect(piano.keyUp).not.toHaveBeenCalled();

  fireEvent.keyDown(window, { code: "KeyH", key: "h" });
  expect(piano.keyDown).toHaveBeenCalledTimes(2);
  expect(screen.getByText("2 / 8")).toBeInTheDocument();
});
```

Keep the existing `N`-held-while-`H`-attacks scenario as a separate assertion so score advancement remains independent from keyup.

- [ ] **Step 2: Add a failing integration test for wrong/free immediate release**

```ts
it("releases wrong and paused free-play keys immediately", () => {
  const piano = fakePiano();
  render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

  fireEvent.keyDown(window, { code: "KeyJ", key: "j" });
  fireEvent.keyUp(window, { code: "KeyJ", key: "j" });
  expect(piano.keyUp).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  fireEvent.keyDown(window, { code: "KeyK", key: "k" });
  fireEvent.keyUp(window, { code: "KeyK", key: "k" });
  expect(piano.keyUp).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 3: Run the focused component tests and verify the correct-key expectation fails**

Run: `cd web && npm test -- app/components/PlayerShell.test.tsx`

Expected: FAIL because current correct keyup calls `piano.keyUp()` immediately.

- [ ] **Step 4: Add physical voice metadata, resonance refs, and release helpers**

In `PlayerShell.tsx`:

```ts
import {
  clearResonance,
  createPhraseResonanceState,
  deferVoice,
  expireVoice,
  MAX_RESONANCE_MS,
  prepareAttack,
} from "../lib/phrase-resonance";

interface PlayedVoice {
  handle: PianoKeyHandle;
  kind: "correct" | "wrong" | "free";
  eventIndex: number | null;
  phraseIndex: number | null;
  notes: readonly string[];
}
```

Replace `attackedHandles` and add bounded timer/state ownership:

```ts
const attackedVoices = useRef(new Map<string, PlayedVoice>());
const resonance = useRef(createPhraseResonanceState());
const resonanceTimers = useRef(new Map<number, number>());
const [resonantVoiceCount, setResonantVoiceCount] = useState(0);

const applyResonanceTransition = useCallback((transition: ResonanceTransition) => {
  resonance.current = transition.state;
  transition.release.forEach((handle) => {
    const timer = resonanceTimers.current.get(handle.id);
    if (timer !== undefined) window.clearTimeout(timer);
    resonanceTimers.current.delete(handle.id);
    piano.keyUp(handle);
  });
  setResonantVoiceCount(transition.state.voices.length);
}, [piano]);
```

- [ ] **Step 5: Reconcile resonance before correct attack and store exact attack metadata**

Within the existing `setPlayerState` keydown callback, capture `const eventIndex = current.eventIndex` before `pressKey`. For a returned correct sound, run `prepareAttack(resonance.current, performanceSong.events[eventIndex])` before `piano.keyDown`, then store:

```ts
attackedVoices.current.set(event.code, {
  handle,
  kind: result.sound.kind,
  eventIndex: result.sound.kind === "correct" ? eventIndex : null,
  phraseIndex: result.sound.kind === "correct" ? performanceSong.events[eventIndex].phraseIndex : null,
  notes: result.sound.notes,
});
```

For rest/free play, store `kind: "free"`, null score indexes, and the default note. Continue rejecting `event.repeat` and any code already in `attackedVoices`.

- [ ] **Step 6: Defer only correct voices on keyup**

Replace immediate correct release with:

```ts
const played = attackedVoices.current.get(event.code);
if (played) {
  attackedVoices.current.delete(event.code);
  if (played.kind === "correct" && played.phraseIndex !== null) {
    applyResonanceTransition(deferVoice(resonance.current, {
      id: played.handle.id,
      handle: played.handle,
      phraseIndex: played.phraseIndex,
      notes: played.notes,
      releasedAt: performance.now(),
    }));
    const timer = window.setTimeout(() => {
      resonanceTimers.current.delete(played.handle.id);
      applyResonanceTransition(expireVoice(resonance.current, played.handle.id));
    }, MAX_RESONANCE_MS);
    resonanceTimers.current.set(played.handle.id, timer);
  } else {
    piano.keyUp(played.handle);
  }
}
```

Keep the existing `releaseKey(...)` state update because it removes the visual physical hold only; verify it still does not move the cursor.

- [ ] **Step 7: Run component tests and typecheck**

Run: `cd web && npm test -- app/components/PlayerShell.test.tsx && npx tsc --noEmit`

Expected: component tests PASS; correct keyup is deferred, while wrong/free keyup remains immediate.

- [ ] **Step 8: Commit the integration slice**

```bash
git add web/app/components/PlayerShell.tsx web/app/components/PlayerShell.test.tsx
git commit -m "feat: connect correct notes with phrase resonance"
```

### Task 3: Musical boundaries, expiry, completion, and lifecycle cleanup

**Files:**
- Modify: `web/app/components/PlayerShell.tsx`
- Modify: `web/app/components/PlayerShell.test.tsx`

**Interfaces:**
- Consumes: `PlayedVoice`, resonance refs, and `applyResonanceTransition` from Task 2.
- Produces: a single `releaseEverything()` path that clears physical voices, deferred voices, timers, completion timer, and pressed-key UI.

- [ ] **Step 1: Add failing fake-timer tests for 2.4-second expiry and same-pitch replacement**

```ts
it("expires a deferred correct voice after 2.4 seconds", () => {
  const piano = fakePiano();
  render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);
  fireEvent.keyDown(window, { code: "KeyN", key: "n" });
  fireEvent.keyUp(window, { code: "KeyN", key: "n" });
  act(() => vi.advanceTimersByTime(2_399));
  expect(piano.keyUp).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(piano.keyUp).toHaveBeenCalledOnce();
});

it("releases an older source before retriggering the same piano pitch", () => {
  const piano = fakePiano();
  const base = builtinSongs[0];
  const repeatedPitchSong = {
    ...base,
    phrases: [{ id: "same", text: "你你", startEvent: 0, endEvent: 1 }],
    events: [
      { ...base.events[0], id: "first", targetCode: "KeyN", notes: ["C4"], note: "C4" },
      { ...base.events[1], id: "second", targetCode: "KeyH", notes: ["C4"], note: "C4" },
    ],
  };
  render(<PlayerShell song={repeatedPitchSong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);
  fireEvent.keyDown(window, { code: "KeyN", key: "n" });
  fireEvent.keyUp(window, { code: "KeyN", key: "n" });
  fireEvent.keyDown(window, { code: "KeyH", key: "h" });
  expect(piano.keyUp).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  expect(piano.keyDown).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Add failing tests for phrase/rest boundaries and five-voice capacity**

Build small songs from `builtinSongs[0]` with distinct notes. Assert that the first event of a new `phraseIndex`, or any event with `restBeforeMs: 1`, releases every deferred handle before its attack. For five same-phrase distinct notes, perform keydown/keyup on each physical code and assert the first handle is released when the fifth is deferred while handles 2–5 remain pending.

Use this exact interaction loop for capacity:

```ts
["KeyA", "KeyB", "KeyC", "KeyD", "KeyE"].forEach((code) => {
  fireEvent.keyDown(window, { code, key: code.slice(-1).toLowerCase() });
  fireEvent.keyUp(window, { code, key: code.slice(-1).toLowerCase() });
});
expect(piano.keyUp).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
expect(piano.keyUp).toHaveBeenCalledTimes(1);
```

- [ ] **Step 3: Add failing tests for final ordering and cleanup**

Update the one-note completion test to assert:

```ts
fireEvent.keyDown(window, { code: "KeyN", key: "n" });
fireEvent.keyUp(window, { code: "KeyN", key: "n" });
act(() => vi.advanceTimersByTime(2_399));
expect(onComplete).not.toHaveBeenCalled();
act(() => vi.advanceTimersByTime(1));
expect(piano.keyUp).toHaveBeenCalledOnce();
act(() => vi.advanceTimersByTime(5_899));
expect(onComplete).not.toHaveBeenCalled();
act(() => vi.advanceTimersByTime(1));
expect(onComplete).toHaveBeenCalledOnce();
```

Add a lifecycle test that defers two voices, then triggers each of pause, restart, replay, blur, and unmount in isolated renders. After advancing timers past 2,400 ms, assert no additional `keyUp` calls occur after `releaseAll`, proving stale timers were cancelled.

- [ ] **Step 4: Make releaseEverything clear the complete ownership graph**

Implement:

```ts
const clearResonanceTimers = useCallback(() => {
  resonanceTimers.current.forEach((timer) => window.clearTimeout(timer));
  resonanceTimers.current.clear();
}, []);

const releaseEverything = useCallback(() => {
  clearResonanceTimers();
  resonance.current = clearResonance(resonance.current).state;
  attackedVoices.current.clear();
  piano.releaseAll();
  setResonantVoiceCount(0);
  setPressedCodes(new Set());
}, [clearResonanceTimers, piano]);
```

Use this function for pause, restart, replay, exit, blur, visibility loss, and effect cleanup. Do not call individual `piano.keyUp()` before `piano.releaseAll()` during global cleanup.

- [ ] **Step 5: Gate completion on both physical and deferred state**

Change the completion effect guard to:

```ts
if (
  playerState.status !== "ringing" ||
  pressedCodes.size > 0 ||
  attackedVoices.current.size > 0 ||
  resonantVoiceCount > 0
) return;
```

Keep `piano.tailMs()` as the final delay after resonance empties. Ensure an encore/free-play key cancels the tail, releases immediately on keyup, and restarts the full tail.

- [ ] **Step 6: Run policy and PlayerShell suites**

Run: `cd web && npm test -- app/lib/phrase-resonance.test.ts app/components/PlayerShell.test.tsx`

Expected: all targeted tests PASS, including expiry, pitch conflict, phrase/rest boundary, capacity, lifecycle, and resonance-then-room-tail ordering.

- [ ] **Step 7: Commit lifecycle and completion handling**

```bash
git add web/app/components/PlayerShell.tsx web/app/components/PlayerShell.test.tsx
git commit -m "fix: bound piano resonance across lifecycle events"
```

### Task 4: Preserve established interaction cases and document the sound model

**Files:**
- Modify: `web/app/components/PlayerShell.test.tsx`
- Modify: `web/README.md`

**Interfaces:**
- Consumes: final `PlayerShell` behaviour from Tasks 2–3.
- Produces: regression evidence for Cases A–F plus approved extra overlap/restart cases, and user-facing documentation.

- [ ] **Step 1: Audit and retain the established interaction tests**

Confirm the suite contains explicit assertions for:

```text
Case A  N -> H advances two ordinary lyric events.
Case B  A -> Space -> Space advances one lyric token with three notes.
Case C  A keyup -> A keydown -> A keyup -> A keydown handles three real repeated lyric tokens.
Case D  wrong J sounds, does not advance, and releases immediately.
Case E  N remains physically down while H attacks; both handles are independent.
Case F  a five-second N hold attacks once; repeat is ignored; resonance starts only on keyup.
Extra   N keyup after H attack cannot release H's handle.
Extra   restart while multiple keys are held/deferred calls releaseAll once and leaves no timer-driven release.
```

Where a scenario is currently implicit, add a named `it(...)` case using `fireEvent` and exact `piano.keyDown`/`keyUp` call-count assertions.

- [ ] **Step 2: Run the interaction suite**

Run: `cd web && npm test -- app/components/PlayerShell.test.tsx app/lib/player-machine.test.ts app/import/moonlit-score-code.test.ts`

Expected: all interaction, cursor, melisma, and score-code compatibility tests PASS.

- [ ] **Step 3: Update README without promising acoustic identity**

Change the playback bullets to explain:

```markdown
- Correct melody notes use bounded phrase-aware damper resonance: releasing a key can leave a short connected tail, while repeated pitches, printed rests and phrase boundaries clear stale resonance before the next attack.
- Resonance never creates an attack by itself, keeps at most four released gestures for at most 2.4 seconds, and is cleared on pause, restart, replay, exit or focus loss.
```

Update the audio paragraph to state that Salamander samples, short per-source damper release, bounded phrase resonance, and room reverb are separate stages. Do not claim the laptop keyboard is acoustically indistinguishable from a physical grand piano.

- [ ] **Step 4: Run the complete automated verification**

Run from `web`:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run test:render
```

Expected: every command exits 0; no snapshot, type, lint, build, or rendered-HTML regression.

- [ ] **Step 5: Browser-check the local Flower Sea performance**

Open `http://localhost:3000/`, choose Flower Sea, and verify:

1. N/H-style adjacent correct inputs can overlap and released notes connect instead of stopping abruptly.
2. A same-pitch repeat does not double-trigger or leave a stuck note.
3. The on-screen lyric remains one token during A + Space + Space.
4. A wrong key sounds and marks feedback without advancing.
5. Pause, restart, replay, and browser focus loss leave no audible stuck voice.
6. The shared duration bar still moves only while its physical key is held.
7. The browser console has no runtime errors or unhandled promise rejections.

- [ ] **Step 6: Commit documentation and final regression coverage**

```bash
git add web/app/components/PlayerShell.test.tsx web/README.md
git commit -m "test: verify lyrical piano resonance workflow"
```

- [ ] **Step 7: Check the final diff and working tree**

Run:

```bash
git diff --check HEAD~4..HEAD
git status --short
```

Expected: `git diff --check` exits 0 and `git status --short` is empty.

## Self-Review Results

- Spec coverage: all ten automated requirements from the design are mapped to Tasks 1–4, including exact-source pitch replacement, phrase/rest cleanup, four-voice/2.4-second bounds, lifecycle cleanup, final-tail ordering, long hold, Space continuation, and unchanged wrong-key behaviour.
- Placeholder scan: no TBD/TODO/follow-up implementation placeholders remain; each implementation step includes concrete signatures, code, assertions, commands, and expected results.
- Type consistency: every later task uses the exact `ResonanceTransition`, `PlayedVoice`, `MAX_RESONANCE_MS`, and `PianoKeyHandle.id` contracts introduced earlier. `SongEvent.notes`, `phraseIndex`, and `restBeforeMs` are existing fields and require no parser or persistence change.

