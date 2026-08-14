# Comfort Pace Following Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let steadily slow typists produce a connected slow piano rendition without automatic notes or extra controls.

**Architecture:** Extend the existing onset-ratio follower rather than adding a second timing system. Feed its bounded scale into the existing score-owned release plan, with stricter caps at rests and phrase endings.

**Tech Stack:** TypeScript, React 19, Tone.js 15.1.22, Vitest.

## Global Constraints

- Incremental changes only; do not rewrite unrelated Moonlit code.
- No automatic note attack, new key, pedal, scoring, dependency, or UI control.
- Every new note still requires one real non-repeat keydown.

---

### Task 1: Slow-cadence estimator

**Files:**
- Modify: `app/lib/human-tempo-follower.test.ts`
- Modify: `app/lib/human-tempo-follower.ts`

**Interfaces:**
- Produces: `MIN_PERFORMANCE_SCALE`, `MAX_PERFORMANCE_SCALE`, and the existing `createHumanTempoFollower()` API.

- [ ] Write failing tests for 1.6× convergence, provisional confidence limits, a single in-range hesitation, hard clamping, and reset.
- [ ] Run `npx vitest run app/lib/human-tempo-follower.test.ts` and confirm the slow-cadence assertions fail against the 1.18 clamp.
- [ ] Implement five-ratio median filtering, first/second-observation confidence caps, asymmetric smoothing, and the 0.82–1.75 hard range.
- [ ] Run the focused test and confirm it passes.

### Task 2: Phrase-aware comfort scale

**Files:**
- Modify: `app/lib/piano-performance.test.ts`
- Modify: `app/lib/piano-performance.ts`
- Modify: `app/components/PlayerShell.test.tsx`

**Interfaces:**
- Consumes: the tempo follower scale.
- Produces: the unchanged `getReleasePlan(..., performanceScale)` contract with context-sensitive scale caps.

- [ ] Write failing tests proving a 1.6× connected target, a 1.08× rest cap, a 1.25× phrase-end cap, and a slower real cadence scheduling a longer later note without extra attacks.
- [ ] Run the focused tests and confirm the new assertions fail for the previous 1.18 clamp.
- [ ] Apply the connected/rest/phrase scale policy without changing keydown, cursor, or audio-handle ownership.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Regression verification

**Files:**
- Modify: `docs/final-piano-experience-report.md`

- [ ] Document comfort pace behavior and its non-autoplay boundary.
- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit` and `npm run lint`.
- [ ] Run `npm run test:render`.
- [ ] Confirm `git diff --check` reports no whitespace error.
