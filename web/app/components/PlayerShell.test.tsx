import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PianoPort } from "../audio/piano-engine";
import { builtinSongs } from "../lib/songs";
import { PlayerShell } from "./PlayerShell";

function fakePiano(): PianoPort {
  return {
    load: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    setVoice: vi.fn(),
    attack: vi.fn(),
    release: vi.fn(),
    releaseAll: vi.fn(),
    dispose: vi.fn(),
  };
}

describe("PlayerShell", () => {
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

  it("ignores keyboard auto-repeat and supports pause", () => {
    const piano = fakePiano();
    render(
      <PlayerShell
        song={builtinSongs[0]}
        piano={piano}
        onExit={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { code: "KeyN", key: "n", repeat: true });
    expect(piano.attack).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    expect(screen.getByText("已暂停，随手按键仍可即兴")).toBeInTheDocument();
  });
});
