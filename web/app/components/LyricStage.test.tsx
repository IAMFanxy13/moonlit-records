import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { builtinSongs } from "../lib/songs";
import { compileArrangement } from "../lib/arrangement-compiler";
import { normalizeSongPackage } from "../lib/song-normalizer";
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

  it("does not render a second duration rail because timing uses the shared lower bar", () => {
    const holdSong = {
      ...builtinSongs[0],
      events: [{ ...builtinSongs[0].events[0], kind: "hold" as const, holdMs: 800 }],
      phrases: [{ id: "one", text: "你", startEvent: 0, endEvent: 0 }],
    };

    render(<LyricStage song={holdSong} eventIndex={0} />);

    expect(screen.queryByLabelText("Hold this key")).not.toBeInTheDocument();
  });

  it("places repeated melody notes beside their lyric character instead of duplicating the line at the end", () => {
    const source = builtinSongs[0];
    const repeatedSong = {
      ...source,
      phrases: [{ id: "repeated", text: "我爱你", startEvent: 0, endEvent: 3 }],
      events: [
        { ...source.events[0], id: "wo-1", phraseIndex: 0, token: "我" },
        { ...source.events[0], id: "wo-2", phraseIndex: 0, token: "我" },
        { ...source.events[0], id: "ai", phraseIndex: 0, token: "爱" },
        { ...source.events[0], id: "ni", phraseIndex: 0, token: "你" },
      ],
    };

    const { container } = render(<LyricStage song={repeatedSong} eventIndex={4} />);

    expect(container.querySelector(".lyric-progress")).toHaveTextContent("我爱你");
    expect(container.querySelectorAll(".lyric-token")).toHaveLength(3);
  });

  it("aligns English words as lyric units while preserving spaces", () => {
    const source = builtinSongs[0];
    const englishSong = {
      ...source,
      lyricLanguage: "en" as const,
      phrases: [{ id: "english", text: "You are mine", startEvent: 0, endEvent: 2 }],
      events: [
        { ...source.events[0], id: "you", phraseIndex: 0, token: "You" },
        { ...source.events[0], id: "are", phraseIndex: 0, token: "are" },
        { ...source.events[0], id: "mine", phraseIndex: 0, token: "mine" },
      ],
    };

    const { container } = render(<LyricStage song={englishSong} eventIndex={3} />);

    expect(container.querySelector(".lyric-progress")?.textContent).toBe("You are mine");
  });

  it("renders one lyric token with note-progress dots for a three-note melisma", () => {
    const source = builtinSongs[0];
    const song = normalizeSongPackage({
      ...source,
      phrases: [{ id: "love", text: "爱", startEvent: 0, endEvent: 2 }],
      events: [0, 1, 2].map((index) => ({
        ...source.events[0],
        id: `love-${index}`,
        phraseIndex: 0,
        token: "爱",
        targetCode: "KeyA",
      })),
      lyricTokens: undefined,
    });

    const { rerender, container } = render(<LyricStage song={song} eventIndex={0} />);
    expect(container.querySelectorAll(".lyric-token")).toHaveLength(1);
    expect(screen.getByText("爱", { selector: "[data-token-state='current']" })).toBeInTheDocument();
    expect(screen.getByLabelText("Note 1 of 3, current")).toBeInTheDocument();
    expect(screen.getByLabelText("Press A")).toBeInTheDocument();

    rerender(<LyricStage song={song} eventIndex={1} />);
    expect(container.querySelectorAll(".lyric-token")).toHaveLength(1);
    expect(screen.getByLabelText("Note 1 of 3, done")).toBeInTheDocument();
    expect(screen.getByLabelText("Note 2 of 3, current")).toBeInTheDocument();
    expect(screen.getByLabelText("Press SPACE")).toBeInTheDocument();

    rerender(<LyricStage song={song} eventIndex={3} />);
    expect(container.querySelectorAll("[data-note-state='done']")).toHaveLength(3);
    expect(screen.queryByText("爱 爱 爱")).not.toBeInTheDocument();
  });

  it("keeps three genuinely repeated lyric characters as three separate tokens", () => {
    const source = builtinSongs[0];
    const song = normalizeSongPackage({
      ...source,
      phrases: [{ id: "three-loves", text: "爱爱爱", startEvent: 0, endEvent: 2 }],
      events: [0, 1, 2].map((index) => ({
        ...source.events[0],
        id: `love-${index}`,
        phraseIndex: 0,
        token: "爱",
        targetCode: "KeyA",
      })),
      lyricTokens: undefined,
    });

    const { container } = render(<LyricStage song={song} eventIndex={1} />);
    expect(container.querySelectorAll(".lyric-token")).toHaveLength(3);
    expect(container.querySelectorAll(".lyric-note-progress")).toHaveLength(0);
    expect(screen.getByLabelText("Press A")).toBeInTheDocument();
  });
});
