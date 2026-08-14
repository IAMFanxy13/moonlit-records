# Single-Line Lyric and Space Stars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every current phrase on one wide centered lyric line, show preparatory Space stars above their true score positions, and preserve one-token melisma dots with initial-plus-`1` input.

**Architecture:** Preserve `left-hand-cues.ts` as the score-time source of truth. Add a focused lyric-layout hook that fits a single line and measures actual token centers; `LyricStage` uses those anchors to project Space cues without changing song data or player behavior. CSS provides the wide stage, star states, and non-wrapping responsive presentation.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Next/vinext.

## Global Constraints

- Modify the existing Moonlit Records project incrementally; do not rewrite unrelated components.
- `A`–`Z`, `Digit1`, `Digit2`, and `Space` mappings stay unchanged.
- No autoplay, scoring, audio-engine, chord-generation, parser, OCR, network, or library-management changes.
- Space placement remains derived from real score onset, including before, simultaneous, between, and after relationships.
- Lyrics never wrap; ordinary phrases retain concert-scale type and long phrases shrink only enough to fit.
- One lyric token with multiple melody gestures appears once with dots and uses initial followed by one real `Digit1` keydown per remaining gesture.

---

### Task 1: Measured single-line lyric geometry

**Files:**
- Create: `web/app/components/use-lyric-stage-layout.ts`
- Create: `web/app/components/use-lyric-stage-layout.test.tsx`
- Modify: `web/app/components/LyricStage.tsx`
- Modify: `web/app/globals.css`

**Interfaces:**
- Consumes: a phrase identity and the rendered `.lyric-progress` element containing `[data-lyric-token-id]` anchors.
- Produces: `useLyricStageLayout(phraseKey: string): { lineRef: RefObject<HTMLDivElement | null>; anchorPercentById: ReadonlyMap<string, number> }`.

- [ ] **Step 1: Write failing layout tests**

Add tests that mock element `clientWidth`, `scrollWidth`, and token rectangles, then assert that the hook:

```tsx
expect(line).toHaveAttribute("data-fit-state", "fitted");
expect(line.style.getPropertyValue("--lyric-fit-font-px")).toBe("24px");
expect(result.current.anchorPercentById.get("token-a")).toBeCloseTo(12.5);
```

Also extend `LyricStage.test.tsx` to assert:

```tsx
expect(container.querySelector(".lyric-progress")).toHaveAttribute("data-layout", "single-line");
expect(container.querySelector(".lyric-progress")).toHaveStyle({ whiteSpace: "nowrap" });
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- app/components/use-lyric-stage-layout.test.tsx app/components/LyricStage.test.tsx`

Expected: FAIL because the hook and single-line contract do not exist.

- [ ] **Step 3: Implement bounded fitting and anchor measurement**

Implement a layout effect that resets the fitted custom property, reads the natural computed font size, calculates:

```ts
const ratio = Math.min(1, availableWidth / naturalContentWidth);
const fittedPx = Math.max(18, naturalFontPx * ratio);
line.style.setProperty("--lyric-fit-font-px", `${fittedPx}px`);
```

After fitting, measure every `[data-lyric-token-id]` center against the line rectangle and return percentages clamped to `0..100`. Re-run on phrase change, `ResizeObserver`, and `document.fonts.ready`; disconnect the observer on unmount. Update only when measured values materially change.

Wire `lineRef` and token IDs into `LyricStage`. Change the stage CSS to nearly full viewport width with safe margins, `flex-wrap: nowrap`, `white-space: nowrap`, overflow containment, and a faded-edge fallback at the minimum font size.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- app/components/use-lyric-stage-layout.test.tsx app/components/LyricStage.test.tsx`

Expected: all focused tests pass.

### Task 2: Score-positioned Space stars and melisma clarity

**Files:**
- Modify: `web/app/components/LyricStage.tsx`
- Modify: `web/app/components/LyricStage.test.tsx`
- Modify: `web/app/lib/left-hand-cues.ts`
- Modify: `web/app/lib/left-hand-cues.test.ts`
- Modify: `web/app/globals.css`

**Interfaces:**
- Consumes: `LeftHandCue`, measured `anchorPercentById`, `eventIndex`, and `completedCodes`.
- Produces: `projectLeftHandCuePercent(cue, anchorPercentById, fallbackTokenIds): number` and an above-lyric `.left-hand-star-track`.

- [ ] **Step 1: Write failing cue projection and UI-state tests**

Test measured interpolation instead of token-count approximation:

```ts
const anchors = new Map([["a", 20], ["b", 80]]);
expect(projectLeftHandCuePercent(betweenCue(0.25), anchors, ["a", "b"])).toBe(35);
```

Render a phrase containing before, simultaneous, between, and after cues. Assert:

```tsx
expect(starTrack.compareDocumentPosition(lyricLine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
expect(screen.getByLabelText(/upcoming/u)).toHaveAttribute("data-cue-state", "upcoming");
expect(screen.getByLabelText(/current/u)).toHaveAttribute("data-cue-state", "current");
expect(screen.getByLabelText(/completed/u)).toHaveAttribute("data-cue-state", "done");
```

Add a four-note token test asserting exactly one visible lyric token, four dots, and prompts `A`, then `1`, `1`, `1`. Keep the independent `爱爱爱` regression test.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- app/lib/left-hand-cues.test.ts app/components/LyricStage.test.tsx`

Expected: FAIL because stars are currently a text cue row below the lyric and projection does not use measured token centers.

- [ ] **Step 3: Implement the star track above the lyric**

Move pure projection into `left-hand-cues.ts`. Use measured anchors for `under` and `between`; retain deterministic percentage fallback before first measurement. Render:

```tsx
<div className="left-hand-star-track" aria-label="Left hand Space positions">
  <span className="left-hand-star" data-cue-state={state} aria-label={`Space ${relation}, ${state}`}>
    <i aria-hidden="true" />
    {state === "current" && <b>SPACE</b>}
  </span>
</div>
```

Place this track in the grid row above `.lyric-progress`. Style upcoming stars as dim hollow diamonds, current as filled gold with glow, and completed as nearly extinguished. Keep all phrase stars visible from phrase entry. Leave `.lyric-note-progress` as dots only; do not duplicate token text.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- app/lib/left-hand-cues.test.ts app/components/LyricStage.test.tsx`

Expected: all focused tests pass.

### Task 3: Regression and browser verification

**Files:**
- Modify only if a test reveals an in-scope regression: files from Tasks 1–2.
- Update: `web/docs/final-piano-experience-report.md`

**Interfaces:**
- Consumes: completed Tasks 1–2.
- Produces: verified local build and concise evidence in the existing report.

- [ ] **Step 1: Run component and player regressions**

Run: `npm test -- app/components/LyricStage.test.tsx app/components/PlayerShell.test.tsx app/components/RhythmGuide.test.tsx app/components/ScreenKeyboard.test.tsx app/lib/player-machine.test.ts app/lib/keyboard.test.ts`

Expected: all pass; fix only failures caused by the lyric-stage increment.

- [ ] **Step 2: Run full automated verification**

Run:

```text
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run test:render
```

Expected: zero failures and successful production/render builds.

- [ ] **Step 3: Verify in the local browser**

Open `http://localhost:3000/`, enter a built-in lyric song, and inspect a normal and long phrase. Confirm with DOM geometry:

```text
lyricProgress.scrollHeight <= lyricProgress.clientHeight + 1
document.documentElement.scrollWidth <= document.documentElement.clientWidth
starTrackRect.bottom <= lyricRect.top
```

Exercise one simultaneous right-hand-plus-Space event and one one-token melisma. Confirm upcoming stars are visible, current star lights, completed star extinguishes, the current lyric input remains visible, and the melisma advances initial then repeated `1` without duplicated lyrics.

- [ ] **Step 4: Record exact verification evidence**

Append the command totals and browser checks to `docs/final-piano-experience-report.md`, without claiming sample/audio changes in this increment.
