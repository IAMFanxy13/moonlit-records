import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { builtinSongs } from "../lib/songs";
import { compileArrangement } from "../lib/arrangement-compiler";
import { buildLeftHandCues } from "../lib/left-hand-cues";
import { normalizeSongPackage } from "../lib/song-normalizer";
import { arrangeTwoHandSong } from "../lib/two-hand-arranger";
import { LyricStage } from "./LyricStage";

describe("LyricStage", () => {
  it("shows KTV-style current and next lines with token progress", () => {
    render(<LyricStage song={builtinSongs[0]} eventIndex={1} />);

    expect(screen.getByText("你好，月光", { selector: ".lyric-line" })).toBeInTheDocument();
    expect(screen.getByText("照进心里", { selector: ".next-line" })).toBeInTheDocument();
    expect(screen.getByText("你", { selector: "[data-token-state='done']" })).toBeInTheDocument();
    expect(screen.getByText("好", { selector: "[data-token-state='current']" })).toBeInTheDocument();
    expect(screen.getByText("H", { selector: ".lyric-key" })).toBeInTheDocument();
    expect(screen.getByText("N", { selector: ".lyric-key" })).toBeInTheDocument();
    expect(screen.getByText("Y", { selector: ".lyric-key" })).toBeInTheDocument();
    expect(screen.getByText("G", { selector: ".lyric-key" })).toBeInTheDocument();
    expect(screen.getByText("NEXT LINE")).toBeInTheDocument();
    expect(screen.getByText("你好，月光", { selector: ".lyric-line" })).toHaveAttribute("lang", "zh-CN");
  });

  it("renders imported instrumental events as the Shift performance route", () => {
    const importedSong = compileArrangement({
      id: "private-video",
      title: "Private Video",
      lyricLanguage: "en",
      lyrics: [],
      instrumental: [{ notes: ["C4"] }, { notes: ["E4"] }],
    });

    render(<LyricStage song={importedSong} eventIndex={0} />);

    expect(screen.getByText("Instrumental passage", { selector: ".lyric-line" })).toBeInTheDocument();
    expect(screen.getByText("SHIFT", { selector: "[data-token-state='current']" })).toBeInTheDocument();
    expect(screen.getByLabelText("Press SHIFT")).toBeInTheDocument();
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
    expect(screen.getByLabelText("Press SHIFT")).toBeInTheDocument();
    expect(screen.getByText("SHIFT SHIFT", { selector: ".next-line" })).toBeInTheDocument();
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
      lyricTokens: undefined,
      phrases: [{ id: "repeated", text: "我爱你", startEvent: 0, endEvent: 3 }],
      events: [
        { ...source.events[0], id: "wo-1", phraseIndex: 0, token: "我" },
        { ...source.events[0], id: "wo-2", phraseIndex: 0, token: "我" },
        { ...source.events[0], id: "ai", phraseIndex: 0, token: "爱" },
        { ...source.events[0], id: "ni", phraseIndex: 0, token: "你" },
      ],
    };

    const { container } = render(<LyricStage song={repeatedSong} eventIndex={4} />);

    expect([...container.querySelectorAll(".lyric-token")].map((node) => node.textContent).join(""))
      .toBe("我爱你");
    expect(container.querySelectorAll(".lyric-token")).toHaveLength(3);
  });

  it("aligns English words as lyric units while preserving spaces", () => {
    const source = builtinSongs[0];
    const englishSong = {
      ...source,
      lyricTokens: undefined,
      lyricLanguage: "en" as const,
      phrases: [{ id: "english", text: "You are mine", startEvent: 0, endEvent: 2 }],
      events: [
        { ...source.events[0], id: "you", phraseIndex: 0, token: "You" },
        { ...source.events[0], id: "are", phraseIndex: 0, token: "are" },
        { ...source.events[0], id: "mine", phraseIndex: 0, token: "mine" },
      ],
    };

    const { container } = render(<LyricStage song={englishSong} eventIndex={3} />);

    expect([...container.querySelectorAll(".lyric-token")].map((node) => node.textContent))
      .toEqual(["You", "are", "mine"]);
    expect([...container.querySelectorAll(".lyric-punctuation")].map((node) => node.textContent).join(""))
      .toBe("  ");
  });

  it("renders one lyric token with dots and the same initial for a four-note melisma", () => {
    const source = builtinSongs[0];
    const song = normalizeSongPackage({
      ...source,
      phrases: [{ id: "love", text: "爱", startEvent: 0, endEvent: 3 }],
      events: [0, 1, 2, 3].map((index) => ({
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
    expect(screen.getByLabelText("Note 1 of 4, current")).toBeInTheDocument();
    expect(screen.getByLabelText("Press A")).toBeInTheDocument();

    rerender(<LyricStage song={song} eventIndex={1} />);
    expect(container.querySelectorAll(".lyric-token")).toHaveLength(1);
    expect(screen.getByLabelText("Note 1 of 4, done")).toBeInTheDocument();
    expect(screen.getByLabelText("Note 2 of 4, current")).toBeInTheDocument();
    expect(screen.getByLabelText("Press A")).toBeInTheDocument();

    rerender(<LyricStage song={song} eventIndex={2} />);
    expect(screen.getByLabelText("Note 3 of 4, current")).toBeInTheDocument();
    expect(screen.getByLabelText("Press A")).toBeInTheDocument();

    rerender(<LyricStage song={song} eventIndex={3} />);
    expect(screen.getByLabelText("Note 4 of 4, current")).toBeInTheDocument();
    expect(screen.getByLabelText("Press A")).toBeInTheDocument();
    expect(container.querySelectorAll(".lyric-note-progress i")).toHaveLength(4);
    expect(screen.queryByText("爱 爱 爱 爱")).not.toBeInTheDocument();
  });

  it("keeps an interleaved left-hand Space out of a lyric token's note dots", () => {
    const source = builtinSongs[0];
    const song = normalizeSongPackage({
      ...source,
      phrases: [{ id: "love", text: "爱", startEvent: 0, endEvent: 2 }],
      lyricTokens: [{ id: "love-token", phraseIndex: 0, tokenIndex: 0, text: "爱", startEvent: 0, endEvent: 2 }],
      events: [
        {
          ...source.events[0], id: "love-1", phraseIndex: 0, token: "爱", targetCode: "KeyA",
          sourceStartMs: 0, sourceEndMs: 400,
          parts: [{ hand: "right" as const, targetCode: "KeyA", notes: ["C4"] }],
        },
        {
          ...source.events[0], id: "left", phraseIndex: 0, tokenIndex: null, token: null, targetCode: "Space",
          sourceStartMs: 400, sourceEndMs: 800,
          parts: [{ hand: "left" as const, targetCode: "Space", notes: ["C2", "G2"] }],
        },
        {
          ...source.events[0], id: "love-2", phraseIndex: 0, token: "爱", targetCode: "Digit1",
          sourceStartMs: 800, sourceEndMs: 1_200,
          parts: [{ hand: "right" as const, targetCode: "Digit1", notes: ["D4"] }],
        },
      ],
    });

    const { container } = render(<LyricStage song={song} eventIndex={1} />);

    expect(container.querySelectorAll(".lyric-note-progress i")).toHaveLength(2);
    expect(screen.getByLabelText("Note 1 of 2, done")).toBeInTheDocument();
    expect(screen.getByLabelText("Note 2 of 2, upcoming")).toBeInTheDocument();
    expect(screen.queryByLabelText("Press A")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Input A for 爱")).toBeInTheDocument();
    expect(screen.getByLabelText(/Space .* current/u)).toBeInTheDocument();
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

  it("centres the complete phrase as one fitted single-line lyric unit", () => {
    const source = builtinSongs[0];
    const longText = "This is a deliberately long lyric phrase whose ending must remain visible";
    const song = normalizeSongPackage({
      ...source,
      lyricLanguage: "en" as const,
      phrases: [{ id: "long", text: longText, startEvent: 0, endEvent: 0 }],
      events: [{ ...source.events[0], phraseIndex: 0, token: longText }],
      lyricTokens: undefined,
    });

    const { container } = render(<LyricStage song={song} eventIndex={0} />);
    expect(container.querySelector(".lyric-progress")).toHaveAttribute("data-layout", "single-line");
    expect(container.querySelector(".current-lyric")).toHaveAttribute("data-phrase-layout", "single-line");
    expect(container.querySelector(".lyric-progress")).toHaveStyle({ whiteSpace: "nowrap" });
  });

  it("places preparatory Space stars above the lyric with completed, current, and upcoming states", () => {
    const source = builtinSongs[0];
    const cueSong = {
      ...source,
      tempoBpm: 60,
      phrases: [{ id: "cue-line", text: "你好吗", startEvent: 0, endEvent: 5 }],
      lyricTokens: [
        { id: "you", phraseIndex: 0, tokenIndex: 0, text: "你", startEvent: 1, endEvent: 1 },
        { id: "good", phraseIndex: 0, tokenIndex: 1, text: "好", startEvent: 2, endEvent: 2 },
        { id: "question", phraseIndex: 0, tokenIndex: 2, text: "吗", startEvent: 4, endEvent: 4 },
      ],
      events: [
        {
          ...source.events[0], id: "left-before", phraseIndex: 0, tokenIndex: null, token: null, targetCode: "Space",
          notes: ["C2", "G2"], note: "C2", sourceStartMs: 0, sourceEndMs: 400,
          parts: [{ hand: "left" as const, targetCode: "Space", notes: ["C2", "G2"] }],
        },
        { ...source.events[0], id: "you", phraseIndex: 0, tokenIndex: 0, token: "你", sourceStartMs: 500, sourceEndMs: 900 },
        {
          ...source.events[0], id: "good", phraseIndex: 0, tokenIndex: 1, token: "好", sourceStartMs: 1_500, sourceEndMs: 2_000,
          parts: [
            { hand: "right" as const, targetCode: "KeyH", notes: ["D4"] },
            { hand: "left" as const, targetCode: "Space", notes: ["G2", "D3", "G3"] },
          ],
        },
        {
          ...source.events[0], id: "left-between", phraseIndex: 0, tokenIndex: null, token: null, targetCode: "Space",
          notes: ["A2", "E3"], note: "A2", sourceStartMs: 1_750, sourceEndMs: 2_100,
          parts: [{ hand: "left" as const, targetCode: "Space", notes: ["A2", "E3"] }],
        },
        { ...source.events[0], id: "question", phraseIndex: 0, tokenIndex: 2, token: "吗", sourceStartMs: 2_500, sourceEndMs: 3_000 },
        {
          ...source.events[0], id: "left-after", phraseIndex: 0, tokenIndex: null, token: null, targetCode: "Space",
          notes: ["C2", "G2"], note: "C2", sourceStartMs: 3_200, sourceEndMs: 3_700,
          parts: [{ hand: "left" as const, targetCode: "Space", notes: ["C2", "G2"] }],
        },
      ],
    };

    const { container } = render(<LyricStage song={cueSong} eventIndex={2} />);

    expect(screen.getByText("你好吗", { selector: ".lyric-line" })).toBeInTheDocument();
    expect(container.querySelectorAll(".lyric-token")).toHaveLength(3);
    const starTrack = screen.getByLabelText("Left hand Space positions");
    const lyric = container.querySelector(".lyric-progress")!;
    expect(starTrack.compareDocumentPosition(lyric) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText("Space with lyric, current")).toHaveAttribute("data-cue-state", "current");
    expect(screen.getByLabelText("Space before lyric, completed")).toHaveAttribute("data-cue-state", "done");
    const between = screen.getByLabelText("Space between lyrics, upcoming");
    expect(between).toHaveAttribute("data-cue-ratio", "0.25");
    expect(between).toHaveAttribute("data-cue-state", "upcoming");
    expect(screen.getByText("SPACE", { selector: ".left-hand-star b" })).toBeInTheDocument();
  });

  it("visibly names a standalone Space before and after the lyric line", () => {
    const source = builtinSongs[0];
    const cueSong = normalizeSongPackage({
      ...source,
      lyricLanguage: "en" as const,
      phrases: [{ id: "edge-cues", text: "You", startEvent: 0, endEvent: 2 }],
      events: [
        {
          ...source.events[0], id: "space-before", phraseIndex: 0, token: null, tokenIndex: null,
          targetCode: "Space", sourceStartMs: 0, sourceEndMs: 400,
          parts: [{ hand: "left" as const, targetCode: "Space", notes: ["C2", "G2"] }],
        },
        {
          ...source.events[0], id: "you", phraseIndex: 0, token: "You", tokenIndex: 0,
          targetCode: "KeyY", sourceStartMs: 500, sourceEndMs: 900,
          parts: [{ hand: "right" as const, targetCode: "KeyY", notes: ["C4"] }],
        },
        {
          ...source.events[0], id: "space-after", phraseIndex: 0, token: null, tokenIndex: null,
          targetCode: "Space", sourceStartMs: 1_000, sourceEndMs: 1_500,
          parts: [{ hand: "left" as const, targetCode: "Space", notes: ["C2", "G2"] }],
        },
      ],
      lyricTokens: undefined,
    });

    const { rerender } = render(<LyricStage song={cueSong} eventIndex={0} />);
    expect(screen.getByText("BEFORE LINE", { selector: ".left-hand-star small" })).toBeInTheDocument();
    expect(screen.getByLabelText("Space before lyric, current")).toHaveTextContent("SPACE");

    rerender(<LyricStage song={cueSong} eventIndex={2} />);
    expect(screen.getByText("AFTER LINE", { selector: ".left-hand-star small" })).toBeInTheDocument();
    expect(screen.getByLabelText("Space after lyric, current")).toHaveTextContent("SPACE");
  });

  it("shows only the independent Space instruction in an auto-arranged between-lyrics phrase", () => {
    const arranged = arrangeTwoHandSong(builtinSongs[1]);
    const betweenCue = arranged.phrases.flatMap((_, phraseIndex) => (
      buildLeftHandCues(arranged, phraseIndex)
    )).find((cue) => cue.position === "between");

    expect(betweenCue).toBeDefined();
    const { container } = render(<LyricStage song={arranged} eventIndex={betweenCue!.eventIndex} />);

    expect(screen.getByLabelText("Space between lyrics, current")).toHaveTextContent("SPACE");
    expect([...container.querySelectorAll(".lyric-key")].map((item) => item.textContent))
      .not.toContain(expect.stringContaining("SPACE"));
  });
});
