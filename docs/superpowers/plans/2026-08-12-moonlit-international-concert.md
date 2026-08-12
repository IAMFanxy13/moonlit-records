# Moonlit Records International Concert Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Moonlit Records prototype into an English-first, international concert-piano experience with song-specific premium piano voices, true hold/release keyboard behavior, and a final-note tail that completes only after the hall ambience has faded.

**Architecture:** Keep the current React/Vinext application and separate pure state from browser audio. Extend the song catalog with English display metadata and multilingual search aliases, add a pure voice-profile module for audio configuration, add a `ringing` state to the player machine, and let `PlayerShell` own physical-key lifetimes plus the completion-tail timer. Tone.js remains the sample playback layer; the UI talks only through `PianoPort`.

**Tech Stack:** TypeScript, React 19, Vinext, Vitest, Testing Library, Tone.js, CSS, OpenAI Sites.

## Global Constraints

- Every interface label, title, song metadata field, help message, status, and social card string is English. Only lyric text may be Chinese.
- Chinese lyrics are explicitly marked with `lang="zh-CN"`.
- Physical keydown attacks exactly one note and physical keyup releases that same note; held keys and chords remain independent.
- Wrong keys sound and mark red but do not advance the lyric. The correct key advances.
- The last correct key enters `ringing`; completion waits for all held keys to release and then for the selected voice's full tail.
- The player remains playable during `ringing`; an encore note cancels and restarts the completion tail.
- Existing sample files and keyboard layout remain local and portable; no ROG-specific integration.
- Preserve the existing private deployment identity and replace its published version only after verification.

---

## Task 1: English catalog metadata and multilingual search aliases

**Files:**

- Modify: `web/app/lib/song.ts`
- Modify: `web/app/lib/songs.ts`
- Modify: `web/app/lib/catalog.ts`
- Test: `web/app/lib/catalog.test.ts`

- [ ] **Step 1: Write failing catalog tests**

Add assertions that visible metadata is English, Chinese aliases still find the song, and each built-in song has the intended voice recommendation:

```ts
expect(searchSongs("小星星")[0]?.title).toBe("Twinkle, Twinkle, Little Star");
expect(searchSongs("hello")[0]?.recommendedVoice).toBe("warm");
expect(searchSongs("twinkle")[0]?.recommendedVoice).toBe("bright");
expect(searchSongs("ode to joy")[0]?.recommendedVoice).toBe("concert");
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- app/lib/catalog.test.ts`

Expected: FAIL because titles/metadata are still Chinese and `searchAliases` does not exist.

- [ ] **Step 3: Add aliases and English display metadata**

Extend `SongPackage`:

```ts
searchAliases: string[];
```

Update all built-in songs so `title`, `artist`, and `version` are English; keep Chinese names only inside `searchAliases`. Search a normalized string made from the visible metadata plus aliases. Set recommendations to Felt (`warm`), Studio (`bright`), and Concert (`concert`) respectively.

- [ ] **Step 4: Run the focused test and commit**

Run: `npm test -- app/lib/catalog.test.ts`

Expected: PASS.

Commit: `feat: internationalize song catalog`

## Task 2: Add a ringing phase to the pure player state machine

**Files:**

- Modify: `web/app/lib/player-machine.ts`
- Test: `web/app/lib/player-machine.test.ts`

- [ ] **Step 1: Write failing state-machine tests**

Cover these transitions:

```ts
expect(pressKey(lastStepState, expectedCode).state.status).toBe("ringing");
expect(pressKey(ringingState, "KeyQ").outcome).toBe("free");
expect(finishRinging(ringingState).status).toBe("complete");
```

Also assert that wrong keys remain non-advancing before the final step.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- app/lib/player-machine.test.ts`

Expected: FAIL because the last correct step currently completes immediately.

- [ ] **Step 3: Implement the minimal state transition**

Add `ringing` to `PlayerStatus`. The final correct press returns `ringing`; input during `ringing` is free-play input and cannot change progress. Export:

```ts
export function finishRinging(state: PlayerState): PlayerState
```

It converts only `ringing` to `complete` and leaves every other status unchanged.

- [ ] **Step 4: Run the focused test and commit**

Run: `npm test -- app/lib/player-machine.test.ts`

Expected: PASS.

Commit: `feat: add final-note ringing phase`

## Task 3: Define premium voice profiles and expose their acoustic tails

**Files:**

- Create: `web/app/audio/piano-voices.ts`
- Create: `web/app/audio/piano-voices.test.ts`
- Modify: `web/app/audio/piano-engine.ts`
- Modify: `web/app/audio/piano-engine.test.ts`

- [ ] **Step 1: Write failing profile and engine tests**

Test the public names and recommendation-grade parameters:

```ts
expect(getPianoVoiceProfile("warm").name).toBe("Felt Grand");
expect(getPianoVoiceProfile("concert").tailMs).toBeGreaterThan(
  getPianoVoiceProfile("bright").tailMs,
);
expect(piano.tailMs()).toBe(getPianoVoiceProfile("warm").tailMs);
```

After `setVoice("concert")`, assert `tailMs()` changes immediately.

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npm test -- app/audio/piano-voices.test.ts app/audio/piano-engine.test.ts`

Expected: FAIL because the profile module and `tailMs()` do not exist.

- [ ] **Step 3: Implement voice profiles**

Create a pure module with:

```ts
export interface PianoVoiceProfile {
  name: string;
  cutoff: number;
  samplerRelease: number;
  reverbDecay: number;
  preDelay: number;
  wet: number;
  tailMs: number;
}

export function getPianoVoiceProfile(voice: PianoVoice): PianoVoiceProfile;
```

Use these directional settings:

| Voice | Display name | Reverb | Tail budget |
| --- | --- | ---: | ---: |
| `warm` | Felt Grand | 4.8 s | 5.9 s |
| `bright` | Studio Grand | 3.5 s | 4.5 s |
| `upright` | Vintage Upright | 2.7 s | 3.5 s |
| `concert` | Concert Grand | 6.0 s | 7.2 s |

Update `PianoPort` with `tailMs(): number`. Track the active voice in `TonePiano`; configure sampler release, low-pass cutoff, Reverb decay/pre-delay/wet on load and voice changes. The tail getter returns the active profile synchronously.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- app/audio/piano-voices.test.ts app/audio/piano-engine.test.ts`

Expected: PASS.

Commit: `feat: add premium piano voice profiles`

## Task 4: Implement real key lifetimes, chords, and tail-aware completion

**Files:**

- Modify: `web/app/components/PlayerShell.tsx`
- Modify: `web/app/components/PlayerShell.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Use fake timers and a fake `PianoPort` with `tailMs`. Prove that:

- keydown attacks once and repeat keydown is ignored;
- no release occurs before keyup;
- two simultaneously held keys attack/release independently;
- the last correct key shows the ringing message and does not call `onComplete`;
- holding the final key prevents the tail timer;
- releasing the final key starts the full tail timer;
- an encore key during ringing cancels the timer, sounds freely, and restarts the full timer after release;
- `onComplete` fires once only after the final timer expires.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- app/components/PlayerShell.test.tsx`

Expected: FAIL because completion is immediate and the fake port has no acoustic tail.

- [ ] **Step 3: Implement physical key lifetimes and completion scheduling**

Keep one `Map<KeyboardCode, MidiNote>` for attacked notes. On non-repeat keydown, attack and record the exact returned note. On keyup, release the recorded note and remove only that key. Do not infer the release note from the current lyric step.

Use one cancelable completion timer. Schedule it only when:

```ts
playerState.status === "ringing" && pressedCodes.size === 0
```

The timer duration is `piano.tailMs()`. Any new keydown, pause, restart, exit, blur, voice change, or unmount cancels it. Timer expiry calls `finishRinging`; the existing completion callback reacts to `complete` once.

Show English ringing copy:

```text
LET IT RING
The hall is holding your final note.
```

- [ ] **Step 4: Run focused and related tests, then commit**

Run: `npm test -- app/components/PlayerShell.test.tsx app/lib/player-machine.test.ts`

Expected: PASS.

Commit: `feat: sustain keys and wait for the hall tail`

## Task 5: Convert the complete interface to an international editorial system

**Files:**

- Modify: `web/app/layout.tsx`
- Modify: `web/app/MoonlitPiano.tsx`
- Modify: `web/app/components/SearchHome.tsx`
- Modify: `web/app/components/LyricStage.tsx`
- Modify: `web/app/components/ScreenKeyboard.tsx`
- Modify: `web/app/components/PlayerShell.tsx`
- Modify: `web/app/components/CompletionCard.tsx`
- Modify: `web/app/globals.css`
- Modify tests beside each component

- [ ] **Step 1: Write failing English-interface tests**

Update component expectations to English and add assertions for:

```ts
expect(screen.getByText("Find your song")).toBeInTheDocument();
expect(screen.getByText("NEXT LINE")).toBeInTheDocument();
expect(screen.getByText("Concert Grand")).toBeInTheDocument();
expect(screen.getByText("A little room for music after words.")).toBeInTheDocument();
```

Assert the Chinese lyric node has `lang="zh-CN"`. Assert rendered document metadata and OG image URLs are English and absolute for the incoming host.

- [ ] **Step 2: Run the component suite and confirm it fails**

Run: `npm test -- app/MoonlitPiano.test.tsx app/components`

Expected: FAIL on the old Chinese UI labels.

- [ ] **Step 3: Implement English copy and refined visual hierarchy**

Use `MOONLIT RECORDS` as the sole brand. Rework the experience into a restrained European record-label aesthetic: carbon black, oxblood, parchment, antique brass, high-contrast editorial serif headings, clean grotesk controls, thin rules, generous negative space, and subtle motion. Keep the physical keyboard readable and primary; avoid dashboard cards and excessive glow.

Voice selectors use `Felt Grand`, `Studio Grand`, `Vintage Upright`, and `Concert Grand`; each song identifies its recommended voice. All player controls and completion text are English. Chinese lyrics alone remain Chinese and are language-tagged.

Expose an absolute English OG image URL derived from the request host in metadata.

- [ ] **Step 4: Run the full test suite and commit**

Run: `npm test`

Expected: all tests PASS.

Commit: `feat: deliver international moonlit interface`

## Task 6: Create the English social image, verify, package, and publish

**Files:**

- Replace: `web/public/og.png`
- Modify: `README.md`
- Create: `outputs/moonlit-records-piano-source.zip`

- [ ] **Step 1: Generate one English social card**

Use the image generation skill once, after the website style and copy are stable. The card must contain only:

```text
MOONLIT RECORDS
YOUR KEYBOARD, IN CONCERT
```

Match the finished carbon/oxblood/parchment/brass editorial system. Inspect the generated image, copy it to `web/public/og.png`, and verify dimensions and legibility.

- [ ] **Step 2: Run final local verification**

Run:

```powershell
npm test
npm run build
rg -n "[\u4e00-\u9fff]" app --glob "*.tsx" --glob "*.ts"
```

Review every Chinese match; allow only lyric content and Chinese search aliases. Confirm no placeholder or temporary asset remains.

- [ ] **Step 3: Update delivery notes and package the source**

Document English-first UI, multilingual search aliases, voice recommendations, real hold/release behavior, ringing completion, test/build commands, and private deployment in `README.md`. Create a fresh source zip in `outputs` without dependencies, caches, or secrets.

- [ ] **Step 4: Publish over the existing private site**

Use the Sites hosting workflow to publish the verified `web` directory to the existing project in `.openai/hosting.json`. Poll until deployment is ready, open the final URL in Codex, and confirm the site/project identity did not change.

- [ ] **Step 5: Run the completion protocol**

Use `superpowers:verification-before-completion`, record exact passing test/build evidence, then use `superpowers:finishing-a-development-branch` to present the branch integration choices.

Commit: `chore: prepare international concert release`
