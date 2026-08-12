import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { builtinSongs } from "../lib/songs";
import type { PlayerState } from "../lib/player-machine";
import { CompletionCard } from "./CompletionCard";

describe("CompletionCard", () => {
  it("summarizes the finished performance without punishing improvisation", () => {
    const state: PlayerState = {
      status: "complete",
      eventIndex: 8,
      correctCount: 8,
      mistakes: [{ eventIndex: 0, token: "你", pressedCode: "KeyZ", expectedCode: "KeyN" }],
    };
    render(<CompletionCard song={builtinSongs[0]} state={state} onAgain={vi.fn()} onCatalog={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "This performance was yours." })).toBeInTheDocument();
    expect(screen.getByText("8 lyric notes")).toBeInTheDocument();
    expect(screen.getByText("1 free-play note")).toBeInTheDocument();
  });
});
