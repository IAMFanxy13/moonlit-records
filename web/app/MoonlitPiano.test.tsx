import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PianoPort } from "./audio/piano-engine";
import { MoonlitPiano } from "./MoonlitPiano";

describe("MoonlitPiano", () => {
  it("loads a searched song, asks for one intentional entrance, and opens the player", async () => {
    const user = userEvent.setup();
    const piano: PianoPort = {
      load: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      setVoice: vi.fn(),
      attack: vi.fn(),
      release: vi.fn(),
      releaseAll: vi.fn(),
      dispose: vi.fn(),
    };
    render(<MoonlitPiano piano={piano} />);

    await user.type(screen.getByRole("searchbox", { name: "搜索歌名" }), "月光");
    await user.click(screen.getByRole("button", { name: /打开《你好，月光》/ }));

    const enter = await screen.findByRole("button", { name: "打开琴盖，开始演奏" });
    expect(piano.load).toHaveBeenCalledOnce();
    await user.click(enter);

    expect(piano.resume).toHaveBeenCalledOnce();
    expect(await screen.findByTestId("key-KeyN")).toHaveAttribute("data-state", "target");
  });
});
