import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { builtinSongs } from "../lib/songs";
import { compileArrangement } from "../lib/arrangement-compiler";
import { LyricStage } from "./LyricStage";

describe("LyricStage", () => {
  it("shows KTV-style current and next lines with token progress", () => {
    render(<LyricStage song={builtinSongs[0]} eventIndex={1} />);

    expect(screen.getByText("你好，月光", { selector: ".lyric-line" })).toBeInTheDocument();
    expect(screen.getByText("照进心里", { selector: ".next-line" })).toBeInTheDocument();
    expect(screen.getByText("你", { selector: "[data-token-state='done']" })).toBeInTheDocument();
    expect(screen.getByText("好", { selector: "[data-token-state='current']" })).toBeInTheDocument();
    expect(screen.getByText("H", { selector: ".lyric-key" })).toBeInTheDocument();
    expect(screen.getByText("NEXT LINE")).toBeInTheDocument();
    expect(screen.getByText("你好，月光", { selector: ".lyric-line" })).toHaveAttribute("lang", "zh-CN");
  });

  it("renders imported instrumental events as the numbered performance route", () => {
    const importedSong = compileArrangement({
      id: "private-video",
      title: "Private Video",
      lyricLanguage: "en",
      lyrics: [],
      instrumental: [{ notes: ["C4"] }, { notes: ["E4"] }],
    });

    render(<LyricStage song={importedSong} eventIndex={0} />);

    expect(screen.getByText("Instrumental passage", { selector: ".lyric-line" })).toBeInTheDocument();
    expect(screen.getByText("1", { selector: "[data-token-state='current']" })).toBeInTheDocument();
    expect(screen.getByLabelText("Press 1")).toBeInTheDocument();
  });

  it("paginates a long imported passage into a current ten-key route and the next route", () => {
    const importedSong = compileArrangement({
      id: "long-private-video",
      title: "Long Private Video",
      lyricLanguage: "en",
      lyrics: [],
      instrumental: Array.from({ length: 22 }, () => ({ notes: ["C4"] })),
    });

    const { container } = render(<LyricStage song={importedSong} eventIndex={12} />);

    expect(container.querySelectorAll(".lyric-token")).toHaveLength(10);
    expect(screen.getByLabelText("Press 8")).toBeInTheDocument();
    expect(screen.getByText("1 2", { selector: ".next-line" })).toBeInTheDocument();
  });
});
