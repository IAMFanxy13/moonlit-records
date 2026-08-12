import { describe, expect, test } from "vitest";

import { loadScorePages } from "./score-page-loader";
import { ImportScoreError } from "./types";

describe("loadScorePages", () => {
  test("keeps selected image and expanded PDF pages in their original order", async () => {
    const files = [
      new File(["first"], "01.jpg", { type: "image/jpeg" }),
      new File(["pdf"], "02.pdf", { type: "application/pdf" }),
      new File(["last"], "03.webp", { type: "image/webp" }),
    ];

    const pages = await loadScorePages(files, {
      decodeImage: async (file) => ({
        blob: file,
        width: 800,
        height: 1200,
      }),
      renderPdf: async () => [
        { blob: new Blob(["page-1"], { type: "image/png" }), width: 1200, height: 1800 },
        { blob: new Blob(["page-2"], { type: "image/png" }), width: 1200, height: 1800 },
      ],
    });

    expect(pages.map((page) => [page.id, page.sourceName, page.pageNumber])).toEqual([
      ["source-1-page-1", "01.jpg", 1],
      ["source-2-page-1", "02.pdf", 1],
      ["source-2-page-2", "02.pdf", 2],
      ["source-3-page-1", "03.webp", 1],
    ]);
  });

  test("rejects media recordings instead of pretending they are scores", async () => {
    const audio = new File(["audio"], "song.mp3", { type: "audio/mpeg" });

    await expect(loadScorePages([audio])).rejects.toEqual(
      expect.objectContaining<Partial<ImportScoreError>>({ code: "UNSUPPORTED_SCORE" }),
    );
  });

  test("rejects an empty selection with a useful typed error", async () => {
    await expect(loadScorePages([])).rejects.toEqual(
      expect.objectContaining<Partial<ImportScoreError>>({ code: "NO_SCORE_PAGES" }),
    );
  });
});

