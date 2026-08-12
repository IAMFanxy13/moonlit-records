import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PianoPort } from "./audio/piano-engine";
import { createMemoryPrivateLibrary } from "./import/private-library";
import type { PrivateSongRecord } from "./import/types";
import { builtinSongs } from "./lib/songs";
import { MoonlitPiano } from "./MoonlitPiano";

describe("MoonlitPiano", () => {
  it("loads a searched song, asks for one intentional entrance, and opens the player", async () => {
    const user = userEvent.setup();
    let handleId = 1;
    const piano: PianoPort = {
      load: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      setVoice: vi.fn(),
      tailMs: vi.fn(() => 5900),
      attack: vi.fn((notes) => ({ id: handleId++, voice: "warm", notes: [...notes] })),
      release: vi.fn(),
      releaseAll: vi.fn(),
      dispose: vi.fn(),
    };
    render(<MoonlitPiano piano={piano} />);

    await user.type(screen.getByRole("searchbox", { name: "Search your library" }), "月光");
    await user.click(screen.getByRole("button", { name: /Open Hello, Moonlight/ }));

    const enter = await screen.findByRole("button", { name: "Enter the performance" });
    expect(piano.load).toHaveBeenCalledOnce();
    await user.click(enter);

    expect(piano.resume).toHaveBeenCalledOnce();
    expect(await screen.findByTestId("key-KeyN")).toHaveAttribute("data-state", "target");
  });

  it("restores generated arrangements from the private on-device library", async () => {
    const saved: PrivateSongRecord = {
      id: "import-saved",
      checksum: "saved",
      sourceName: "Saved.mp3",
      createdAt: "2026-08-12T00:00:00.000Z",
      metadata: { title: "Saved Arrangement", artist: "Private Artist" },
      song: { ...builtinSongs[2], id: "import-saved", title: "Saved Arrangement", artist: "Private Artist" },
      warnings: [],
    };

    render(<MoonlitPiano privateLibrary={createMemoryPrivateLibrary([saved])} />);

    expect(await screen.findByRole("button", { name: "Open Saved Arrangement" })).toBeInTheDocument();
  });
});
