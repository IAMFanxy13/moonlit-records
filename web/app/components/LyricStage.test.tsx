import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { builtinSongs } from "../lib/songs";
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
});
