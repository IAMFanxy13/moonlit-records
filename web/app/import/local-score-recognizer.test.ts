import { describe, expect, test } from "vitest";

import { classifyOcrResult, recognizeScorePages } from "./local-score-recognizer";
import type { LoadedScorePage } from "./score-page-loader";

const item = (text: string, left: number, top: number, width = 220, height = 38, score = 0.92) => ({
  text,
  score,
  poly: [
    [left, top] as [number, number],
    [left + width, top] as [number, number],
    [left + width, top + height] as [number, number],
    [left, top + height] as [number, number],
  ],
});

describe("classifyOcrResult", () => {
  test("groups OCR fragments into ordered score lines and distinguishes notation from lyrics", () => {
    const page = classifyOcrResult(
      "score-1",
      1000,
      1400,
      [
        item("花海", 420, 80),
        item("1=F", 100, 150, 90),
        item("4/4", 210, 150, 80),
        item("3 3 2 1 2", 100, 360, 500),
        item("静 止 了 所 有 的 花", 100, 410, 600),
        item("0 1 3 3", 100, 520, 450),
      ],
    );

    expect(page.lines.map((line) => [line.role, line.text])).toEqual([
      ["title", "花海"],
      ["metadata", "1=F 4/4"],
      ["notation", "3 3 2 1 2"],
      ["lyrics", "静 止 了 所 有 的 花"],
      ["notation", "0 1 3 3"],
    ]);
  });

  test("does not mistake a phone clock or page counter for a notation row", () => {
    const page = classifyOcrResult(
      "score-2",
      945,
      2048,
      [item("18:03", 20, 20), item("2/3", 850, 320), item("今天你弹琴了吗", 30, 1710)],
    );

    expect(page.lines.some((line) => line.role === "notation")).toBe(false);
  });
});

describe("recognizeScorePages", () => {
  test("runs the real ordered recognition path once per loaded page", async () => {
    const pages: LoadedScorePage[] = [
      {
        id: "source-1-page-1",
        sourceName: "first.png",
        sourceIndex: 0,
        pageNumber: 1,
        blob: new Blob(["first"], { type: "image/png" }),
        width: 1000,
        height: 1400,
      },
      {
        id: "source-2-page-1",
        sourceName: "second.png",
        sourceIndex: 1,
        pageNumber: 1,
        blob: new Blob(["second"], { type: "image/png" }),
        width: 1000,
        height: 1400,
      },
    ];
    const recognizedNames: string[] = [];

    const result = await recognizeScorePages(pages, {
      preparePage: async (page) => page.blob,
      recognize: async (_blob, page) => {
        recognizedNames.push(page.sourceName);
        return [item(page.sourceName === "first.png" ? "3 3 2 1" : "5 5 6 5", 100, 300)];
      },
    });

    expect(recognizedNames).toEqual(["first.png", "second.png"]);
    expect(result.map((page) => page.lines[0].text)).toEqual(["3 3 2 1", "5 5 6 5"]);
  });
});

