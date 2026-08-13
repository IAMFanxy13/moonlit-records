import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PianoPort } from "../audio/piano-engine";
import { builtinSongs } from "../lib/songs";
import { PlayerShell } from "./PlayerShell";

function fakePiano(): PianoPort {
  let nextId = 1;
  return {
    load: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    setVoice: vi.fn(),
    tailMs: vi.fn(() => 5900),
    keyDown: vi.fn((notes) => ({
      id: nextId++,
      voice: "warm" as const,
      notes: [...notes],
      channelHandle: { release: vi.fn() },
    })),
    keyUp: vi.fn(),
    releaseAll: vi.fn(),
    dispose: vi.fn(),
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
    expect(screen.getByText(/GUIDE 0\.2s · N/u)).toBeInTheDocument();
    const durationBar = screen.getByTestId("shared-duration-bar");
    const keyboard = screen.getByLabelText("Computer keyboard piano");
    expect(durationBar.compareDocumentPosition(keyboard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    expect(piano.keyUp).not.toHaveBeenCalled();
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
    expect(piano.keyUp).not.toHaveBeenCalled();
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
    expect(piano.keyUp).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
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
    expect(piano.keyUp).not.toHaveBeenCalled();
    expect(screen.getByText("2 / 8")).toBeInTheDocument();
    expect(screen.getByTestId("key-KeyN")).toHaveAttribute("data-state", "pressed");
    expect(screen.getByTestId("key-KeyH")).toHaveAttribute("data-state", "correct");
  });

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

    expect(piano.keyUp).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
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

    expect(piano.keyUp).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(piano.keyUp).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    expect(piano.keyUp).toHaveBeenCalledTimes(2);
    const thirdAttackOrder = vi.mocked(piano.keyDown).mock.invocationCallOrder[2];
    expect(vi.mocked(piano.keyUp).mock.invocationCallOrder[0]).toBeLessThan(thirdAttackOrder);
    expect(vi.mocked(piano.keyUp).mock.invocationCallOrder[1]).toBeLessThan(thirdAttackOrder);
  });

  it("keeps at most four deferred gestures in one phrase", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const capacitySong = {
      ...base,
      phrases: [{ id: "capacity", text: "capacity", startEvent: 0, endEvent: 4 }],
      events: ["C4", "D4", "E4", "F4", "G4"].map((note, index) => ({
        ...base.events[index],
        id: `capacity-${index}`,
        phraseIndex: 0,
        tokenIndex: index,
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

    expect(piano.keyUp).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(piano.keyUp).toHaveBeenCalledTimes(1);
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

  it("Case F: a five-second N hold attacks once and starts resonance only on keyup", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    act(() => vi.advanceTimersByTime(5_000));
    fireEvent.keyDown(window, { code: "KeyN", key: "n", repeat: true });
    expect(piano.keyDown).toHaveBeenCalledOnce();
    expect(piano.keyUp).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    expect(piano.keyUp).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2_399));
    expect(piano.keyUp).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(piano.keyUp).toHaveBeenCalledOnce();
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

    act(() => vi.advanceTimersByTime(2_399));
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
    expect(piano.keyDown).toHaveBeenCalledWith(["C4", "E4", "G4"], chordSong.events[0].velocity);
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    expect(piano.keyUp).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2_400));
    expect(piano.keyUp).toHaveBeenCalledWith(expect.objectContaining({ notes: ["C4", "E4", "G4"] }));
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

  it("Case B: A then two fresh Space presses play three notes for one lyric token", () => {
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

    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { code: "Space", key: " " });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { code: "Space", key: " ", repeat: true });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    fireEvent.keyUp(window, { code: "Space", key: " " });
    fireEvent.keyDown(window, { code: "Space", key: " " });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(container.querySelectorAll(".lyric-token")).toHaveLength(1);
    expect(piano.keyDown).toHaveBeenCalledTimes(3);
    expect(piano.keyUp).toHaveBeenCalledOnce();
    expect(piano.keyUp).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it("does not release H when N keyup follows H attack", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });

    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(piano.keyUp).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2_400));
    expect(piano.keyUp).toHaveBeenCalledOnce();
    expect(piano.keyUp).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(piano.keyUp).not.toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it("restart clears a mixed held and deferred set once without timer-driven release", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    expect(piano.keyDown).toHaveBeenCalledTimes(2);
    expect(piano.keyUp).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(piano.releaseAll).toHaveBeenCalledOnce();
    expect(piano.keyUp).not.toHaveBeenCalled();
    expect(screen.getByText("0 / 8")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2_401));
    expect(piano.releaseAll).toHaveBeenCalledOnce();
    expect(piano.keyUp).not.toHaveBeenCalled();
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
  ])("cancels deferred-release timers on $name cleanup", ({ trigger }) => {
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
    expect(piano.keyUp).not.toHaveBeenCalled();

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
