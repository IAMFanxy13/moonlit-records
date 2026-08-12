# Gentleman Recital Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine Moonlit Records into an elegant, international, gentlemanly private-recital interface while making import unmistakably primary.

**Architecture:** Preserve the existing component hierarchy and restyle it through a compact token system and restrained component classes. Functional states remain accessible without color; motion reinforces hierarchy but never blocks keyboard input.

**Tech Stack:** React 19, semantic HTML, CSS, Vitest/Testing Library, existing public audio and social-card assets.

## Global Constraints

- All interface copy is English; only lyrics may be Chinese.
- Art direction: midnight tailoring, ivory programme paper, oxblood lining, antique brass, precise hairlines, editorial serif, calm sans-serif.
- Avoid casino gold, neon, glassmorphism, game scoring, excessive particles, or novelty animations.
- Import is the first visual action; search is secondary.
- Current and next KTV lyric lines remain visible in a 1366×768 viewport.
- The four-row 36-key keyboard remains physically recognizable.
- Reduced-motion and keyboard focus styles are mandatory.

---

### Task 1: Freeze the gentleman recital token system

**Files:**
- Modify: `web/app/globals.css`
- Modify: `web/app/layout.test.ts`

- [ ] Add failing rendered-copy/token assertions for `IMPORT A RECORDING`, the English-first contract, and removal of arcade/reserved-key copy.
- [ ] Run `npm test -- app/layout.test.ts tests/rendered-html.test.mjs`; verify failure.
- [ ] Define named colors, type scales, spacing, borders, shadows, and easing once under `:root`; use them throughout instead of one-off values.
- [ ] Run the focused tests; expect PASS.
- [ ] Commit with `git commit -m "style: establish gentleman recital art direction"`.

### Task 2: Compose the import-first editorial home page

**Files:**
- Modify: `web/app/components/SearchHome.tsx`
- Modify: `web/app/components/SearchHome.test.tsx`
- Modify: `web/app/globals.css`

- [ ] Add failing DOM assertions for one primary import action, secondary library search, private/no-subscription reassurance, prepared repertoire, and complete Twinkle entry.
- [ ] Run focused tests; expect failure.
- [ ] Build an asymmetrical recital-programme hero with a tailored import panel, restrained microcopy, library search, and fine catalogue rows.
- [ ] Add hover/focus/processing states that use border, icon, and text in addition to color.
- [ ] Run focused tests; expect PASS.
- [ ] Commit with `git commit -m "style: compose import-first recital programme"`.

### Task 3: Refine the KTV stage and complete instrument

**Files:**
- Modify: `web/app/components/PlayerShell.tsx`
- Modify: `web/app/components/LyricStage.tsx`
- Modify: `web/app/components/ScreenKeyboard.tsx`
- Modify: `web/app/components/CompletionCard.tsx`
- Modify: `web/app/globals.css`

- [ ] Add failing accessibility/state assertions for current/next line, hold rail, target, wrong, pressed, ringing, whole-instrument voice selector, and 36-key count.
- [ ] Run focused component tests; expect failure.
- [ ] Restyle the stage as a private recital/KTV hybrid: lyrics carry emotion, keyboard carries action, and only one target is dominant.
- [ ] Ensure 1366×768 fits without vertical scrolling and mobile shows a clear desktop-keyboard requirement.
- [ ] Run focused tests; expect PASS.
- [ ] Commit with `git commit -m "style: refine the gentleman performance stage"`.

### Task 4: Validate production presentation

**Files:**
- Modify only if validation finds a defect.

- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:render`; expect all pass.
- [ ] Verify CSS honors `prefers-reduced-motion`, visible focus, and no non-lyric Chinese interface text.
- [ ] Commit corrections with `git commit -m "fix: close recital interface validation gaps"` only when needed.

