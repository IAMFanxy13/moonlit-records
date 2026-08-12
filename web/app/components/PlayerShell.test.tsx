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
    attack: vi.fn((notes) => ({ id: nextId++, voice: "warm" as const, notes: [...notes] })),
    release: vi.fn(),
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
    expect(piano.attack).toHaveBeenCalledOnce();

    fireEvent.keyUp(window, { code: "KeyH", key: "h" });
    fireEvent.keyDown(window, { code: "KeyN", key: "n" });

    expect(screen.getByText("1 / 8")).toBeInTheDocument();
    expect(screen.getByTestId("key-KeyH")).not.toHaveAttribute("data-state", "wrong");
    expect(screen.getByTestId("key-KeyH")).toHaveAttribute("data-state", "target");
    expect(piano.attack).toHaveBeenCalledTimes(2);
  });

  it("holds each attacked note until its own keyup and supports chords", () => {
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

    expect(piano.attack).toHaveBeenCalledTimes(2);
    expect(piano.release).not.toHaveBeenCalled();
    expect(screen.getByTestId("key-KeyN")).toHaveAttribute("data-state", "pressed");
    expect(screen.getByTestId("key-KeyH")).toHaveAttribute("data-state", "correct");

    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    expect(piano.release).toHaveBeenCalledWith(expect.objectContaining({ notes: ["G4"] }));
    expect(screen.getByTestId("key-KeyN")).toHaveAttribute("data-state", "idle");
    expect(screen.getByTestId("key-KeyH")).toHaveAttribute("data-state", "correct");

    fireEvent.keyUp(window, { code: "KeyH", key: "h" });
    expect(piano.release).toHaveBeenCalledWith(expect.objectContaining({ notes: ["A4"] }));
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
    expect(screen.getByText("LET IT RING")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(12000));
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
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
    expect(piano.attack).toHaveBeenCalledTimes(2);

    fireEvent.keyUp(window, { code: "KeyQ", key: "q" });
    act(() => vi.advanceTimersByTime(5900));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("attacks and releases a polyphonic song event from one computer key", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const chordSong = {
      ...base,
      phrases: [{ id: "chord", text: "你", startEvent: 0, endEvent: 0 }],
      events: [{ ...base.events[0], notes: ["C4", "E4", "G4"], note: "C4" }],
    };
    render(<PlayerShell song={chordSong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "KeyN", key: "n" });
    expect(piano.attack).toHaveBeenCalledWith(["C4", "E4", "G4"], chordSong.events[0].velocity);
    fireEvent.keyUp(window, { code: "KeyN", key: "n" });
    expect(piano.release).toHaveBeenCalledWith(expect.objectContaining({ notes: ["C4", "E4", "G4"] }));
  });

  it("ignores Space and every non-performance key", () => {
    const piano = fakePiano();
    render(<PlayerShell song={builtinSongs[0]} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.keyDown(window, { code: "Space", key: " " });
    fireEvent.keyDown(window, { code: "Escape", key: "Escape" });
    expect(piano.attack).not.toHaveBeenCalled();
    expect(screen.getByText("0 / 8")).toBeInTheDocument();
  });

  it("shows a hold rail and keeps waiting after an early release", () => {
    const piano = fakePiano();
    const base = builtinSongs[0];
    const holdSong = {
      ...base,
      phrases: [{ id: "hold", text: "你", startEvent: 0, endEvent: 0 }],
      events: [{ ...base.events[0], kind: "hold" as const, holdMs: 800 }],
    };
    render(<PlayerShell song={holdSong} piano={piano} onExit={vi.fn()} onComplete={vi.fn()} />);

    expect(screen.getByLabelText("Hold this key")).toBeInTheDocument();
    fireEvent.keyDown(window, { code: "KeyN", key: "n", timeStamp: 100 });
    fireEvent.keyUp(window, { code: "KeyN", key: "n", timeStamp: 200 });
    expect(screen.getByText("0 / 1")).toBeInTheDocument();
    expect(screen.getByText(/Release was early/)).toBeInTheDocument();
  });
});
