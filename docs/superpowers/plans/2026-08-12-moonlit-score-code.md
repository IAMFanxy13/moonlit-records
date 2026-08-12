# Moonlit Score Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe text-code path that turns Codex-generated Jianpu arrangements into playable private songs.

**Architecture:** A pure parser/compiler owns the versioned declarative grammar and produces the existing `PrivateSongRecord`. `ImportStudio` owns only textarea state and forwards successful records through the existing persistence and performance callbacks.

**Tech Stack:** TypeScript, React 19, pinyin-pro, Vitest, Testing Library, IndexedDB.

## Global Constraints

- Never execute pasted code.
- Keep processing local and free.
- Remove image/PDF recognition from the website interface; Codex generates the code outside the site.
- Use letters for lyric initials and the `1`-`0` cycle for lyric-free events.
- One computer key may trigger one note or a reduced chord.

---

### Task 1: Parser and Compiler

**Files:**
- Create: `web/app/import/moonlit-score-code.test.ts`
- Create: `web/app/import/moonlit-score-code.ts`

- [x] Write failing tests for metadata, Chinese/English initials, rests, chords, octaves, deterministic identity, and line-numbered validation.
- [x] Run the focused test and verify failure because the module does not exist.
- [x] Implement the bounded parser and compiler without evaluating input.
- [x] Run the focused test and verify it passes.

### Task 2: Paste Interface

**Files:**
- Modify: `web/app/components/ImportStudio.test.tsx`
- Modify: `web/app/components/ImportStudio.tsx`
- Modify: `web/app/globals.css`

- [x] Write failing component tests for successful paste/import and retained invalid input with actionable feedback.
- [x] Run the focused tests and verify the new controls are absent.
- [x] Add the tailored textarea, local compile action, ready card integration, and responsive styles.
- [x] Run focused component and integration tests to green.

### Task 3: Verification

**Files:**
- Modify only files required by failures caused by Tasks 1-2.

- [x] Run `npm test`.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run lint`.
- [x] Run `npm run test:render`.
- [x] Paste a sample code block in `http://localhost:3000/`, verify it enters the private library, and open the performance screen.
