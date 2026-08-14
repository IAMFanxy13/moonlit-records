import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PianoPort } from "../audio/piano-engine";
import { getGuidedVelocity, getReleasePlan } from "../lib/piano-performance";
import { builtinSongs } from "../lib/songs";
import { PlayerShell } from "./PlayerShell";

function fakePiano(): PianoPort {
  let nextId = 1;
  const scheduled = new Map<number, number>();
  const piano: PianoPort = {
    load: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    setVoice: vi.fn(),
    tailMs: vi.fn(() => 5900),
    keyDown: vi.fn((notes) => ({
      id: nextId++,
      voice: "warm" as const,
      notes: [...notes],
      channelHandle: {
        release: vi.fn(),
        scheduleRelease: vi.fn(),
        cancelScheduledRelease: vi.fn(),
      },
    })),
    keyUp: vi.fn(),
    scheduleRelease: vi.fn((handle, delayMs, options) => {
      const timer = window.setTimeout(() => {
        scheduled.delete(handle.id);
        piano.keyUp(handle, options);
      }, delayMs);
      scheduled.set(handle.id, timer);
    }),
    cancelScheduledRelease: vi.fn((handle) => {
      const timer = scheduled.get(handle.id);
      if (timer !== undefined) window.clearTimeout(timer);
      scheduled.delete(handle.id);
    }),
    runtimeInfo: vi.fn(() => ({ state: "running", baseLatency: 0.012, latencyHint: "interactive" })),
    releaseAll: vi.fn(),
    dispose: vi.fn(),
  };
  return piano;
}

function releasedIds(piano: PianoPort): number[] {
  return vi.mocked(piano.keyUp).mock.calls.map(([handle]) => handle.id);
}

function targetDurationSong(firstHoldMs = 700) {
  const base = builtinSongs[0];
  return {
    ...base,
    tempoBpm: 72,
    phrases: [{ id: "target-phrase", text: "two", startEvent: 0, endEvent: 1 }],
    events: [
      { ...base.events[0], id: "target-n", phraseIndex: 0, targetCode: "KeyN", holdMs: firstHoldMs, sourceStartMs: 0, sourceEndMs: firstHoldMs },
      { ...base.events[1], id: "target-h", phraseIndex: 0, targetCode: "KeyH", holdMs: 700, sourceStartMs: 700, sourceEndMs: 1_400 },
    ],
  };
}

describe("PlayerShell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("keeps sibling right and left voices alive while completing a coordinated event", () => {
    const piano = fakePiano();
    const base = targetDurationSong(700);
    const duet = {
      ...base,
      phrases: [{ id: "duet", text: "Now", startEvent: 0, endEvent: 0 }],
      events: [{
        ...base.events[0],
        parts: [
          { hand: "right" as const, targetCode: "KeyN", notes: ["C4"] },
          { hand: "left" as const, targetCode: "Space", notes: ["C2", "G2", "C3"], velocity: 66 },
        ],
      }],
    };
    render(<PlayerShell song={duet} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    expect(piano.keyDown).toHaveBeenCalledTimes(1);
    expect(screen.getByText("0 / 1")).toBeInTheDocument();
    fireEvent.keyDown(window, { code: "Space", key: " " });

    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(piano.keyDown).toHaveBeenLastCalledWith(["C2", "G2", "C3"], expect.any(Number), [0, 35, 70]);
    expect(piano.cancelScheduledRelease).not.toHaveBeenCalled();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });

  it.each([
    {
      name: "lyric letter",
      physicalCode: "KeyA",
      targetCode: "KeyA",
      hand: "right" as const,
      sourceNote: "C4",
      expectedNotes: ["C4", "C5"],
      expectedOffsets: [0, 18],
      token: "A",
    },
    {
      name: "standalone Space",
      physicalCode: "Space",
      targetCode: "Space",
      hand: "left" as const,
      sourceNote: "C2",
      expectedNotes: ["C2", "G2", "C3"],
      expectedOffsets: [0, 32, 64],
      token: null,
    },
    {
      name: "standalone Shift",
      physicalCode: "ShiftLeft",
      targetCode: "Shift",
      hand: "right" as const,
      sourceNote: "C4",
      expectedNotes: ["C4", "C5"],
      expectedOffsets: [0, 18],
      token: null,
    },
  ])("plays one enriched $name gesture from one physical keydown", ({
    physicalCode, targetCode, hand, sourceNote, expectedNotes, expectedOffsets, token,
  }) => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const song = {
      ...base,
      lyricLanguage: "en" as const,
      phrases: [{ id: "standalone-richness", text: token ?? "Instrumental passage", startEvent: 0, endEvent: 0 }],
      lyricTokens: token
        ? [{ id: "standalone-token", phraseIndex: 0, tokenIndex: 0, text: token, startEvent: 0, endEvent: 0 }]
        : [],
      events: [{
        ...base.events[0],
        id: `standalone-${targetCode}`,
        phraseIndex: 0,
        tokenIndex: token ? 0 : null,
        lyricTokenId: token ? "standalone-token" : null,
        token,
        targetCode,
        notes: [sourceNote],
        note: sourceNote,
        parts: [{ hand, targetCode, notes: [sourceNote] }],
      }],
    };
    render(
      <PlayerShell
        song={song}
        piano={piano}
        onExit={vi.fn()}
        onComplete={vi.fn()}
        autoArrangeLeftHand={false}
      />,
    );

    fireEvent.keyDown(window, { code: physicalCode });

    expect(piano.keyDown).toHaveBeenCalledOnce();
    const [playedNotes, playedVelocity, playedOffsets] = vi.mocked(piano.keyDown).mock.calls[0];
    expect(playedNotes).toEqual(expectedNotes);
    expect(playedOffsets).toEqual(expectedOffsets);
    expect(Array.isArray(playedVelocity)).toBe(true);
    if (!Array.isArray(playedVelocity)) throw new Error("Enriched gestures require per-note velocity layers.");
    expect(playedVelocity[0]).toBeGreaterThan(playedVelocity[1]);
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });

  it("keeps an early-released correct note alive until its score target", () => {
    const piano = fakePiano();
    const song = targetDurationSong(700);
    const plan = getReleasePlan(song, 0, song.recommendedPiano, 0);
    render(<PlayerShell song={song} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    act(() => vi.advanceTimersByTime(50));
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    act(() => vi.advanceTimersByTime(649));
    expect(piano.keyUp).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(piano.keyUp).toHaveBeenCalledOnce();
    expect(piano.keyUp).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      { fadeOutSeconds: plan.fadeOutSeconds },
    );
  });

  it("schedules the score target on the piano audio clock at correct keydown", () => {
    const piano = fakePiano();
    const song = targetDurationSong(700);
    const plan = getReleasePlan(song, 0, song.recommendedPiano, 0);
    render(<PlayerShell song={song} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });

    expect(piano.scheduleRelease).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      700,
      { fadeOutSeconds: plan.fadeOutSeconds },
    );
  });

  it("cancels the future audio-clock release before an early legato transition", () => {
    const piano = fakePiano();
    const song = targetDurationSong(900);
    render(<PlayerShell song={song} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });

    expect(piano.cancelScheduledRelease).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("uses recent human onset tempo only to adapt later release windows", () => {
    const piano = fakePiano();
    const song = targetDurationSong(700);
    render(<PlayerShell song={song} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    act(() => vi.advanceTimersByTime(770));
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });

    const secondDelay = vi.mocked(piano.scheduleRelease).mock.calls[1][1];
    expect(secondDelay).toBeGreaterThan(700);
    expect(secondDelay).toBeLessThanOrEqual(826);
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("learns a slow typing pace without generating any unplayed attack", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const slowSong = {
      ...base,
      tempoBpm: 72,
      phrases: [{ id: "slow-phrase", text: "slow", startEvent: 0, endEvent: 4 }],
      events: ["A", "B", "C", "D", "E"].map((letter, index) => ({
        ...base.events[index],
        id: `slow-${index}`,
        phraseIndex: 0,
        tokenIndex: null,
        token: null,
        targetCode: `Key${letter}`,
        holdMs: 700,
        sourceStartMs: index * 700,
        sourceEndMs: (index + 1) * 700,
      })),
    };
    render(<PlayerShell song={slowSong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    ["A", "B", "C", "D"].forEach((letter, index) => {
      if (index > 0) act(() => vi.advanceTimersByTime(1_120));
      fireEvent.keyDown(window, { code: `Key${letter}`, key: letter.toLowerCase() });
      fireEvent.keyUp(window, { code: `Key${letter}`, key: letter.toLowerCase() });
    });

    const fourthDelay = vi.mocked(piano.scheduleRelease).mock.calls[3][1];
    expect(fourthDelay).toBeGreaterThan(980);
    expect(piano.keyDown).toHaveBeenCalledTimes(4);
    expect(screen.getByText("4 / 5")).toBeInTheDocument();
  });

  it("releases a guided note at its target even while the physical key remains held", () => {
    const piano = fakePiano();
    const song = targetDurationSong(700);
    render(<PlayerShell song={song} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    act(() => vi.advanceTimersByTime(700));

    expect(piano.keyDown).toHaveBeenCalledOnce();
    expect(piano.keyUp).toHaveBeenCalledOnce();
    expect(screen.getByTestId("key-KeyN")).toHaveAttribute("data-state", "pressed");
  });

  it("uses the next real correct keydown for an early legato transition", () => {
    const piano = fakePiano();
    const song = targetDurationSong(900);
    const firstPlan = getReleasePlan(song, 0, song.recommendedPiano, 0);
    render(<PlayerShell song={song} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    act(() => vi.advanceTimersByTime(250));
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });

    expect(piano.keyUp).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      { fadeOutSeconds: firstPlan.transitionFadeOutSeconds },
    );
    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(vi.mocked(piano.keyUp).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(piano.keyDown).mock.invocationCallOrder[1]);

    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    expect(releasedIds(piano)).not.toContain(2);
    act(() => vi.advanceTimersByTime(650));
    expect(releasedIds(piano).filter((id) => id === 1)).toHaveLength(1);
  });

  it("does not wait indefinitely when the next correct keydown arrives late", () => {
    const piano = fakePiano();
    const song = targetDurationSong(500);
    render(<PlayerShell song={song} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    act(() => vi.advanceTimersByTime(499));
    expect(piano.keyUp).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(releasedIds(piano)).toEqual([1]);

    act(() => vi.advanceTimersByTime(700));
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(releasedIds(piano).filter((id) => id === 1)).toHaveLength(1);
  });

  it("keeps the score-duration rail running after physical keyup", () => {
    const piano = fakePiano();
    const song = targetDurationSong(700);
    render(<PlayerShell song={song} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });

    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-event-id", "target-n");
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-countdown", "draining");

    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-event-id", "target-h");
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-countdown", "ready");
  });

  it("starts a labelled duration bar when an independent Space occurs between lyrics", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const song = {
      ...base,
      lyricLanguage: "en" as const,
      phrases: [{ id: "space-between", text: "A B", startEvent: 0, endEvent: 2 }],
      lyricTokens: [
        { id: "token-a", phraseIndex: 0, tokenIndex: 0, text: "A", startEvent: 0, endEvent: 0 },
        { id: "token-b", phraseIndex: 0, tokenIndex: 1, text: "B", startEvent: 2, endEvent: 2 },
      ],
      events: [
        {
          ...base.events[0], id: "letter-a", phraseIndex: 0, token: "A", tokenIndex: 0,
          lyricTokenId: "token-a", targetCode: "KeyA", holdMs: 500, sourceStartMs: 0, sourceEndMs: 500,
          parts: [{ hand: "right" as const, targetCode: "KeyA", notes: ["C4"] }],
        },
        {
          ...base.events[0], id: "between-space", phraseIndex: 0, token: null, tokenIndex: null,
          lyricTokenId: undefined, targetCode: "Space", holdMs: 600, sourceStartMs: 600, sourceEndMs: 1_200,
          parts: [{ hand: "left" as const, targetCode: "Space", notes: ["C2", "G2", "C3"] }],
        },
        {
          ...base.events[0], id: "letter-b", phraseIndex: 0, token: "B", tokenIndex: 1,
          lyricTokenId: "token-b", targetCode: "KeyB", holdMs: 500, sourceStartMs: 1_300, sourceEndMs: 1_800,
          parts: [{ hand: "right" as const, targetCode: "KeyB", notes: ["D4"] }],
        },
      ],
    };
    render(
      <PlayerShell
        song={song}
        piano={piano}
        onExit={vi.fn()}
        onComplete={vi.fn()}
        autoArrangeLeftHand={false}
      />,
    );

    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    fireEvent.keyUp(window, { code: "KeyA", key: "a" });
    fireEvent.keyDown(window, { code: "Space", key: " " });

    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-event-id", "between-space");
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-countdown", "draining");
    expect(screen.getByTestId("shared-duration-bar")).toHaveTextContent("BETWEEN LYRICS");
    expect(screen.getByTestId("shared-duration-bar")).toHaveTextContent("0.6s");

    fireEvent.keyUp(window, { code: "Space", key: " " });
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-countdown", "draining");
  });

  it("plays a wrong key without advancing, then advances on the correct key", () => {
    const piano = fakePiano();
    render(
      <PlayerShell
        song={builtinSongs[0]}
        piano={piano}
        onExit={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByTestId("key-KeyN")).toHaveAttribute("data-state", "target");
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });

    expect(screen.getByTestId("key-KeyH")).toHaveAttribute("data-state", "wrong");
    expect(screen.getByTestId("key-KeyN")).toHaveAttribute("data-state", "target");
    expect(screen.getByText("0 / 8")).toBeInTheDocument();
    expect(piano.keyDown).toHaveBeenCalledOnce();

    fireEvent.keyUp(window, { code: "KeyH", key: "h" });
    fireEvent.keyDown(window, { code: "KeyN", key: "n" });

    expect(screen.getByText("1 / 8")).toBeInTheDocument();
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-countdown", "draining");
    expect(screen.getByTestId("key-KeyH")).not.toHaveAttribute("data-state", "wrong");
    expect(screen.getByTestId("key-KeyH")).toHaveAttribute("data-state", "target");
    expect(piano.keyDown).toHaveBeenCalledTimes(2);

    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    expect(screen.getByText("1 / 8")).toBeInTheDocument();
    expect(screen.getByTestId("key-KeyH")).toHaveAttribute("data-state", "target");
  });

  it("keeps the user-driven rhythm guide in the performance view", () => {
    render(
      <PlayerShell
        song={builtinSongs[0]}
        piano={fakePiano()}
        onExit={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Rhythm guide")).toBeInTheDocument();
    expect(screen.getByText(/GUIDE 0\.7s · N/u)).toBeInTheDocument();
    const durationBar = screen.getByTestId("shared-duration-bar");
    const keyboard = screen.getByLabelText("Computer keyboard piano");
    expect(durationBar.compareDocumentPosition(keyboard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("seeks silently to a phrase boundary from the interactive progress control", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    const attacksBeforeSeek = vi.mocked(piano.keyDown).mock.calls.length;

    fireEvent.change(screen.getByRole("slider", { name: "Song line" }), { target: { value: "1" } });

    expect(screen.getByText("4 / 8")).toBeInTheDocument();
    expect(piano.releaseAll).toHaveBeenCalled();
    expect(piano.keyDown).toHaveBeenCalledTimes(attacksBeforeSeek);
    expect(screen.getByText(/LINE 02 \/ 02/u)).toBeInTheDocument();
  });

  it("offers every lyric phrase in Start From Line and preserves paused status", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Start from line" }));

    expect(screen.getByRole("dialog", { name: "Start from line" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Line 2.*照进心里/u }));

    expect(screen.getByText("Paused — the keyboard remains open for free play.")).toBeInTheDocument();
    expect(screen.getByText("4 / 8")).toBeInTheDocument();
  });

  it("preserves the selected voice and manual tempo across an explicit line seek", () => {
    render(<PlayerShell song={builtinSongs[0]} piano={fakePiano()} onExit={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.change(screen.getByRole("slider", { name: "Tempo" }), { target: { value: "84" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Select piano voice" }), { target: { value: "concert" } });

    fireEvent.change(screen.getByRole("slider", { name: "Song line" }), { target: { value: "1" } });

    expect(screen.getByRole("slider", { name: "Tempo" })).toHaveValue("84");
    expect(screen.getByRole("combobox", { name: "Select piano voice" })).toHaveValue("concert");
  });

  it("treats the chosen line's leading rest as already completed", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const restSong = {
      ...base,
      phrases: [base.phrases[0], { ...base.phrases[1], startEvent: 4 }],
      events: base.events.map((event, index) => index === 4 ? { ...event, restBeforeMs: 2_000 } : event),
    };
    render(<PlayerShell song={restSong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.change(screen.getByRole("slider", { name: "Song line" }), { target: { value: "1" } });

    expect(screen.queryByText(/Silent rest/u)).not.toBeInTheDocument();
    expect(screen.getByTestId(`key-${restSong.events[4].targetCode}`)).toHaveAttribute("data-state", "target");
  });

  it("Case A: N then H advances two ordinary lyric events", () => {
    const piano = fakePiano();
    render(
      <PlayerShell
        song={builtinSongs[0]}
        piano={piano}
        onExit={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });

    expect(screen.getByText("2 / 8")).toBeInTheDocument();
    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(releasedIds(piano)).toEqual([1]);
  });

  it("Case C: fresh A presses handle three genuinely repeated lyric tokens", () => {
    const piano = fakePiano();
    const source = builtinSongs[0];
    const repeatedTokens = {
      ...source,
      phrases: [{ id: "three-loves", text: "爱爱爱", startEvent: 0, endEvent: 2 }],
      events: ["C4", "D4", "E4"].map((note, index) => ({
        ...source.events[index],
        id: `love-${index}`,
        phraseIndex: 0,
        tokenIndex: index,
        token: "爱",
        targetCode: "KeyA",
        notes: [note],
        note,
      })),
    };
    const { container } = render(
      <PlayerShell song={repeatedTokens} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />,
    );

    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    expect(piano.keyDown).toHaveBeenCalledOnce();
    fireEvent.keyUp(window, { code: "KeyA", key: "a" });
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    fireEvent.keyUp(window, { code: "KeyA", key: "a" });
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });

    expect(container.querySelectorAll(".lyric-token")).toHaveLength(3);
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(piano.keyDown).toHaveBeenCalledTimes(3);
    expect(releasedIds(piano)).toEqual([1, 2]);
  });

  it("Case D: wrong J sounds, does not advance, and releases immediately", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyJ", key: "j" });
    expect(screen.getByText("0 / 8")).toBeInTheDocument();
    expect(piano.keyDown).toHaveBeenCalledOnce();
    expect(piano.keyUp).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { code: "KeyJ", key: "j" });
    expect(screen.getByText("0 / 8")).toBeInTheDocument();
    expect(piano.keyDown).toHaveBeenCalledOnce();
    expect(piano.keyUp).toHaveBeenCalledOnce();
    expect(releasedIds(piano)).toContain(1);
  });

  it("Case E: attacks H while N remains physically held and keeps both handles independent", () => {
    const piano = fakePiano();
    render(
      <PlayerShell
        song={builtinSongs[0]}
        piano={piano}
        onExit={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyN", key: "n", repeat: true });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });

    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(releasedIds(piano)).toEqual([1]);
    expect(screen.getByText("2 / 8")).toBeInTheDocument();
    expect(screen.getByTestId("key-KeyN")).toHaveAttribute("data-state", "pressed");
    expect(screen.getByTestId("key-KeyH")).toHaveAttribute("data-state", "correct");
  });

  it("transitions a released correct N when the real H attack arrives", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    expect(piano.keyUp).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(releasedIds(piano)).toEqual([1]);
    expect(screen.getByText("2 / 8")).toBeInTheDocument();
  });

  it("expires an ordinary guided voice at its score target", () => {
    const piano = fakePiano();
    const song = builtinSongs[0];
    const plan = getReleasePlan(song, 0, song.recommendedPiano, 0);
    render(<PlayerShell song={song} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    act(() => vi.advanceTimersByTime(plan.targetDurationMs - 1));
    expect(piano.keyUp).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(piano.keyUp).toHaveBeenCalledOnce();
    expect(piano.keyUp).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      { fadeOutSeconds: plan.fadeOutSeconds },
    );
  });

  it("releases an older source before retriggering the same piano pitch", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const repeatedPitchSong = {
      ...base,
      phrases: [{ id: "same", text: "same", startEvent: 0, endEvent: 1 }],
      events: [
        { ...base.events[0], id: "first", targetCode: "KeyN", notes: ["C4"], note: "C4" },
        { ...base.events[1], id: "second", targetCode: "KeyH", notes: ["C4"], note: "C4" },
      ],
    };
    render(<PlayerShell song={repeatedPitchSong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });

    expect(releasedIds(piano)).toContain(1);
    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(vi.mocked(piano.keyUp).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(piano.keyDown).mock.invocationCallOrder[1]);
  });

  it.each([
    { name: "new phrase", boundary: { phraseIndex: 1 }, advanceRest: false },
    { name: "printed rest", boundary: { restBeforeMs: 1 }, advanceRest: true },
  ])("releases every deferred voice before a $name attack", ({ boundary, advanceRest }) => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const boundarySong = {
      ...base,
      phrases: [
        { id: "first-phrase", text: "first", startEvent: 0, endEvent: 1 },
        { id: "second-phrase", text: "second", startEvent: 2, endEvent: 2 },
      ],
      events: [
        { ...base.events[0], id: "boundary-a", phraseIndex: 0, targetCode: "KeyA", notes: ["C4"], note: "C4" },
        { ...base.events[1], id: "boundary-b", phraseIndex: 0, targetCode: "KeyB", notes: ["D4"], note: "D4" },
        {
          ...base.events[2],
          id: "boundary-c",
          phraseIndex: 0,
          targetCode: "KeyC",
          notes: ["E4"],
          note: "E4",
          ...boundary,
        },
      ],
    };
    render(<PlayerShell song={boundarySong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    ["KeyA", "KeyB"].forEach((code) => {
      fireEvent.keyDown(window, { code, key: code.slice(-1).toLowerCase() });
      fireEvent.keyUp(window, { code, key: code.slice(-1).toLowerCase() });
    });
    if (advanceRest) act(() => vi.advanceTimersByTime(1));
    fireEvent.keyDown(window, { code: "KeyC", key: "c" });

    expect(releasedIds(piano)).toEqual(expect.arrayContaining([1, 2]));
    expect(piano.keyUp).toHaveBeenCalledTimes(2);
    const thirdAttackOrder = vi.mocked(piano.keyDown).mock.invocationCallOrder[2];
    expect(vi.mocked(piano.keyUp).mock.invocationCallOrder[0]).toBeLessThan(thirdAttackOrder);
    expect(vi.mocked(piano.keyUp).mock.invocationCallOrder[1]).toBeLessThan(thirdAttackOrder);
  });

  it("uses a rest-aware target release without making physical keyup musical", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const restedSong = {
      ...base,
      phrases: [{ id: "rest-boundary", text: "three", startEvent: 0, endEvent: 2 }],
      events: [
        { ...base.events[0], id: "before", phraseIndex: 0, targetCode: "KeyN", notes: ["C4"], note: "C4" },
        { ...base.events[1], id: "edge", phraseIndex: 0, targetCode: "KeyH", notes: ["D4"], note: "D4" },
        { ...base.events[2], id: "after", phraseIndex: 0, targetCode: "KeyY", notes: ["E4"], note: "E4", restBeforeMs: 500 },
      ],
    };
    render(<PlayerShell song={restedSong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });

    expect(piano.keyUp).toHaveBeenCalledTimes(1);
    expect(piano.keyUp).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ fadeOutSeconds: expect.any(Number) }),
    );
    expect(piano.keyUp).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
      expect.anything(),
    );

    fireEvent.keyUp(window, { code: "KeyH", key: "h" });
    expect(releasedIds(piano)).toEqual([1]);
    const restPlan = getReleasePlan(restedSong, 1, restedSong.recommendedPiano, 0);
    act(() => vi.advanceTimersByTime(restPlan.targetDurationMs));
    expect(piano.keyUp).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
      { fadeOutSeconds: restPlan.fadeOutSeconds },
    );
  });

  it("transitions each prior guided gesture before the next attack", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const capacitySong = {
      ...base,
      phrases: [{ id: "capacity", text: "capacity", startEvent: 0, endEvent: 4 }],
      events: ["C4", "D4", "E4", "F4", "G4"].map((note, index) => ({
        ...base.events[index],
        id: `capacity-${index}`,
        phraseIndex: 0,
        tokenIndex: null,
        token: null,
        targetCode: `Key${String.fromCharCode(65 + index)}`,
        notes: [note],
        note,
      })),
    };
    render(<PlayerShell song={capacitySong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    ["KeyA", "KeyB", "KeyC", "KeyD", "KeyE"].forEach((code) => {
      fireEvent.keyDown(window, { code, key: code.slice(-1).toLowerCase() });
      fireEvent.keyUp(window, { code, key: code.slice(-1).toLowerCase() });
    });

    expect(releasedIds(piano)).toEqual([1, 2, 3, 4]);
  });

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

  it("Case F: a five-second physical hold attacks once and still releases at the score target", () => {
    const piano = fakePiano();
    const song = builtinSongs[0];
    const plan = getReleasePlan(song, 0, song.recommendedPiano, 0);
    render(<PlayerShell song={song} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    act(() => vi.advanceTimersByTime(plan.targetDurationMs));
    fireEvent.keyDown(window, { code: "KeyN", key: "n", repeat: true });
    expect(piano.keyDown).toHaveBeenCalledOnce();
    expect(piano.keyUp).toHaveBeenCalledOnce();

    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    expect(piano.keyUp).toHaveBeenCalledOnce();
  });

  it("attacks once in StrictMode and releases the exact correct-note handle", () => {
    const piano = fakePiano();
    render(
      <StrictMode>
        <PlayerShell
          song={builtinSongs[0]}
          piano={piano}
          onExit={vi.fn()}
          onComplete={vi.fn()}
        />
      </StrictMode>,
    );

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });

    expect(screen.getByText("1 / 8")).toBeInTheDocument();
    expect(piano.keyDown).toHaveBeenCalledOnce();
    const attackedHandle = vi.mocked(piano.keyDown).mock.results[0].value;

    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    const plan = getReleasePlan(builtinSongs[0], 0, builtinSongs[0].recommendedPiano, 0);
    act(() => vi.advanceTimersByTime(plan.targetDurationMs));

    expect(piano.keyUp).toHaveBeenCalledOnce();
    expect(piano.keyUp).toHaveBeenCalledWith(
      attackedHandle,
      { fadeOutSeconds: plan.fadeOutSeconds },
    );
  });

  it("supports pause without consuming a lyric step", () => {
    const piano = fakePiano();
    render(
      <PlayerShell
        song={builtinSongs[0]}
        piano={piano}
        onExit={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByText("Paused — the keyboard remains open for free play.")).toBeInTheDocument();
    expect(screen.getByText("0 / 8")).toBeInTheDocument();
  });

  it("waits for key release and the selected hall tail before completing", () => {
    const piano = fakePiano();
    const onComplete = vi.fn();
    const base = builtinSongs[0];
    const oneNoteSong = {
      ...base,
      phrases: [{ id: "one", text: "你", startEvent: 0, endEvent: 0 }],
      events: [{ ...base.events[0], phraseIndex: 0, tokenIndex: 0 }],
    };
    render(
      <PlayerShell song={oneNoteSong} piano={piano} onExit={vi.fn()} onComplete={onComplete} />,
    );

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    expect(screen.getByText("LET IT RING")).toBeInTheDocument();

    const finalPlan = getReleasePlan(oneNoteSong, 0, oneNoteSong.recommendedPiano, 0);
    act(() => vi.advanceTimersByTime(finalPlan.targetDurationMs - 1));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(piano.keyUp).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(5899));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("lets an encore note cancel and restart the completion tail", () => {
    const piano = fakePiano();
    const onComplete = vi.fn();
    const base = builtinSongs[0];
    const oneNoteSong = {
      ...base,
      phrases: [{ id: "one", text: "你", startEvent: 0, endEvent: 0 }],
      events: [{ ...base.events[0], phraseIndex: 0, tokenIndex: 0 }],
    };
    render(
      <PlayerShell song={oneNoteSong} piano={piano} onExit={vi.fn()} onComplete={onComplete} />,
    );

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    act(() => vi.advanceTimersByTime(3000));

    fireEvent.keyDown(window, { code: "KeyQ", key: "q" });
    act(() => vi.advanceTimersByTime(7000));
    expect(onComplete).not.toHaveBeenCalled();
    expect(piano.keyDown).toHaveBeenCalledTimes(2);

    fireEvent.keyUp(window, { code: "KeyQ", key: "q" });
    expect(piano.keyUp).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(5900));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("attacks and defers a polyphonic song event as one physical voice", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const chordSong = {
      ...base,
      phrases: [{ id: "chord", text: "你", startEvent: 0, endEvent: 0 }],
      events: [{ ...base.events[0], notes: ["C4", "E4", "G4"], note: "C4" }],
    };
    render(<PlayerShell song={chordSong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    expect(piano.keyDown).toHaveBeenCalledWith(
      ["C4", "E4", "G4"],
      getGuidedVelocity(chordSong, 0),
      [0, 25, 50],
    );
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    expect(piano.keyUp).not.toHaveBeenCalled();
    const chordPlan = getReleasePlan(chordSong, 0, chordSong.recommendedPiano, 0);
    act(() => vi.advanceTimersByTime(chordPlan.targetDurationMs));
    expect(piano.keyUp).toHaveBeenCalledWith(
      expect.objectContaining({ notes: ["C4", "E4", "G4"] }),
      { fadeOutSeconds: chordPlan.fadeOutSeconds },
    );
  });

  it("prevents Space scrolling and keeps it silent when no continuation is expected", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    const space = new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true, cancelable: true });
    window.dispatchEvent(space);
    fireEvent.keyDown(window, { code: "Escape", key: "Escape" });
    expect(space.defaultPrevented).toBe(true);
    expect(piano.keyDown).not.toHaveBeenCalled();
    expect(screen.getByText("0 / 8")).toBeInTheDocument();
  });

  it("leaves Space default behavior available to a focused control", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);
    const pause = screen.getByRole("button", { name: "Pause" });
    pause.focus();
    const space = new KeyboardEvent("keydown", {
      code: "Space",
      key: " ",
      bubbles: true,
      cancelable: true,
    });

    pause.dispatchEvent(space);

    expect(space.defaultPrevented).toBe(false);
    expect(piano.keyDown).not.toHaveBeenCalled();
    expect(screen.getByText("0 / 8")).toBeInTheDocument();
  });

  it("Case B: three fresh A presses play three notes for one lyric token", () => {
    const piano = fakePiano();
    const source = builtinSongs[0];
    const melisma = {
      ...source,
      phrases: [{ id: "melisma", text: "爱", startEvent: 0, endEvent: 2 }],
      events: [
        { ...source.events[0], id: "a-0", phraseIndex: 0, token: "爱", targetCode: "KeyA" },
        { ...source.events[0], id: "a-1", phraseIndex: 0, token: "爱", targetCode: "KeyA" },
        { ...source.events[0], id: "a-2", phraseIndex: 0, token: "爱", targetCode: "KeyA" },
      ],
    };
    const { container } = render(
      <PlayerShell song={melisma} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />,
    );

    expect(screen.getByText("A–Z melody · A–Z + Space two hands · Shift instrumental."))
      .toBeInTheDocument();

    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { code: "KeyA", key: "a", repeat: true });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    fireEvent.keyUp(window, { code: "KeyA", key: "a" });
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { code: "KeyA", key: "a", repeat: true });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    fireEvent.keyUp(window, { code: "KeyA", key: "a" });
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(container.querySelectorAll(".lyric-token")).toHaveLength(1);
    expect(piano.keyDown).toHaveBeenCalledTimes(3);
    expect(releasedIds(piano)).toEqual([1, 2]);
  });

  it("does not release H when N keyup follows H attack", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    const releasesBeforeNKeyUp = vi.mocked(piano.keyUp).mock.calls.length;
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });

    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(piano.keyUp).toHaveBeenCalledTimes(releasesBeforeNKeyUp);
    expect(releasedIds(piano)).toContain(1);
    expect(releasedIds(piano)).not.toContain(2);
  });

  it("restart clears a mixed held and deferred set once without timer-driven release", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(releasedIds(piano)).toEqual([1]);

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(piano.releaseAll).toHaveBeenCalledOnce();
    expect(releasedIds(piano)).toEqual([1]);
    expect(screen.getByText("0 / 8")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2_401));
    expect(piano.releaseAll).toHaveBeenCalledOnce();
    expect(releasedIds(piano)).toEqual([1]);
  });

  it("releases every held audio handle on restart and blur", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(piano.releaseAll).toHaveBeenCalledOnce();
    expect(screen.getByText("0 / 8")).toBeInTheDocument();

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    fireEvent.blur(window);
    expect(piano.releaseAll).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Paused — the keyboard remains open for free play.")).toBeInTheDocument();
  });

  it("cleans multiple held voices on pause and replay line", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(piano.releaseAll).toHaveBeenCalledOnce();
    expect(screen.getByText("2 / 8")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    fireEvent.keyDown(window, { code: "KeyZ", key: "z" });
    fireEvent.click(screen.getByRole("button", { name: /Replay this line/ }));
    expect(piano.releaseAll).toHaveBeenCalledTimes(3);
    expect(screen.getByText("0 / 8")).toBeInTheDocument();
  });

  it.each<{ name: string; trigger: (unmount: () => void) => void }>([
    {
      name: "pause",
      trigger: () => {
        fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      },
    },
    {
      name: "restart",
      trigger: () => {
        fireEvent.click(screen.getByRole("button", { name: "Restart" }));
      },
    },
    {
      name: "replay",
      trigger: () => {
        fireEvent.click(screen.getByRole("button", { name: /Replay this line/ }));
      },
    },
    {
      name: "exit",
      trigger: () => {
        fireEvent.click(screen.getByRole("button", { name: "Back to catalogue" }));
      },
    },
    {
      name: "blur",
      trigger: () => {
        fireEvent.blur(window);
      },
    },
    {
      name: "visibility loss",
      trigger: () => {
        const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        fireEvent(document, new Event("visibilitychange"));
        hidden.mockRestore();
      },
    },
    {
      name: "unmount",
      trigger: (unmount: () => void) => {
        unmount();
      },
    },
  ])("cancels target-release timers on $name cleanup", ({ trigger }) => {
    const piano = fakePiano();
    const { unmount } = render(
      <PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />,
    );

    [
      { code: "KeyN", key: "n" },
      { code: "KeyH", key: "h" },
    ].forEach(({ code, key }) => {
      fireEvent.keyDown(window, { code, key });
      fireEvent.keyUp(window, { code, key });
    });
    expect(releasedIds(piano)).toEqual([1]);

    trigger(unmount);
    expect(piano.releaseAll).toHaveBeenCalled();
    const keyUpCallsAfterCleanup = vi.mocked(piano.keyUp).mock.calls.length;
    act(() => vi.advanceTimersByTime(2_401));
    expect(piano.keyUp).toHaveBeenCalledTimes(keyUpCallsAfterCleanup);
  });

  it("allows several free-play keys to sound and release independently while paused", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    fireEvent.keyDown(window, { code: "KeyJ", key: "j" });
    fireEvent.keyDown(window, { code: "KeyK", key: "k" });
    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(screen.getByText("0 / 8")).toBeInTheDocument();

    fireEvent.keyUp(window, { code: "KeyJ", key: "j" });
    expect(piano.keyUp).toHaveBeenCalledOnce();
    expect(screen.getByTestId("key-KeyK")).toHaveAttribute("data-state", "free");
    fireEvent.keyUp(window, { code: "KeyK", key: "k" });
    expect(piano.keyUp).toHaveBeenCalledTimes(2);
  });

  it("keeps the duration rail as guidance after keydown cursor advancement", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const holdSong = {
      ...base,
      phrases: [{ id: "hold", text: "你", startEvent: 0, endEvent: 0 }],
      events: [{ ...base.events[0], kind: "hold" as const, holdMs: 800 }],
    };
    render(<PlayerShell song={holdSong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    expect(screen.queryByLabelText("Hold this key")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { code: "KeyN", key: "n", timeStamp: 100 });
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-countdown", "draining");
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    fireEvent.keyUp(window, { code: "KeyN", key: "n", timeStamp: 200 });
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.queryByText(/Release was early/)).not.toBeInTheDocument();
  });

  it("rescales the highway with tempo and keeps a printed rest silent", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const restedSong = {
      ...base,
      tempoBpm: 72,
      phrases: [{ id: "rested", text: "Night", startEvent: 0, endEvent: 0 }],
      events: [{
        ...base.events[0],
        kind: "hold" as const,
        holdMs: 1_000,
        restBeforeMs: 1_000,
        sourceStartMs: 1_000,
        sourceEndMs: 2_000,
      }],
    };
    render(<PlayerShell song={restedSong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    expect(screen.getByRole("slider", { name: "Tempo" })).toHaveValue("72");
    expect(screen.getByText("REST 1.0s")).toBeInTheDocument();
    expect(screen.getByTestId("key-KeyN")).not.toHaveAttribute("data-state", "target");

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    expect(screen.getByText("0 / 1")).toBeInTheDocument();
    expect(piano.keyDown).toHaveBeenCalledWith([expect.any(String)], 78);
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByTestId("key-KeyN")).toHaveAttribute("data-state", "target");

    fireEvent.change(screen.getByRole("slider", { name: "Tempo" }), { target: { value: "60" } });
    expect(screen.getByText("60 BPM")).toBeInTheDocument();
    expect(screen.getByText("GUIDE 1.2s · N")).toBeInTheDocument();
  });
});
