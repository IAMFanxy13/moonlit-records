import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PrivateSongRecord } from "../import/types";
import { builtinSongs } from "../lib/songs";
import { ImportStudio } from "./ImportStudio";

const imported: PrivateSongRecord = {
  id: "score-one",
  checksum: "one",
  sourceName: "page-1.jpg + page-2.jpg",
  createdAt: "2026-08-12T00:00:00.000Z",
  metadata: { title: "Flower Sea", artist: "Artist" },
  song: { ...builtinSongs[2], id: "score-one", title: "Flower Sea", artist: "Artist", quality: "sketch" },
  warnings: ["RHYTHM_ESTIMATED"],
};

describe("ImportStudio", () => {
  it("accepts ordered score images and PDFs, reports real local stages, and offers the result", async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    const onPerform = vi.fn();
    const analyze = vi.fn(async (_files, onProgress) => {
      for (const stage of ["preparing", "rendering", "recognizing", "interpreting", "arranging", "ready"] as const) {
        onProgress({ stage, detail: `Now ${stage}`, fraction: stage === "recognizing" ? 0.42 : undefined });
      }
      return imported;
    });
    render(<ImportStudio analyze={analyze} onImported={onImported} onPerform={onPerform} />);

    const picker = screen.getByLabelText("Choose score images or PDF") as HTMLInputElement;
    expect(picker.multiple).toBe(true);
    expect(picker.accept).toContain("image/jpeg");
    expect(picker.accept).toContain("application/pdf");
    const files = [
      new File([new Uint8Array([1])], "page-1.jpg", { type: "image/jpeg" }),
      new File([new Uint8Array([2])], "page-2.jpg", { type: "image/jpeg" }),
    ];
    await user.upload(picker, files);

    expect(analyze).toHaveBeenCalledWith(files, expect.any(Function));
    expect(await screen.findByText("READY TO PERFORM")).toBeInTheDocument();
    expect(screen.getByText("Flower Sea")).toBeInTheDocument();
    expect(onImported).toHaveBeenCalledWith(imported);
    await user.click(screen.getByRole("button", { name: "Perform this score" }));
    expect(onPerform).toHaveBeenCalledWith(imported.song);
  });

  it("shows determinate page-reading progress rather than an instant decorative result", async () => {
    const user = userEvent.setup();
    let finishAnalysis: (() => void) | undefined;
    const analyze = vi.fn(async (_files, onProgress) => {
      onProgress({ stage: "recognizing", detail: "Reading page 1 of 2 locally.", fraction: 0.45, method: "neural" });
      await new Promise<void>((resolve) => { finishAnalysis = resolve; });
      return imported;
    });
    render(<ImportStudio analyze={analyze} onImported={vi.fn()} onPerform={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("Choose score images or PDF"),
      new File([new Uint8Array([1])], "score.png", { type: "image/png" }),
    );
    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "45");
    expect(screen.getByText("Reading page 1 of 2 locally.")).toBeInTheDocument();
    finishAnalysis?.();
    expect(await screen.findByText("READY TO PERFORM")).toBeInTheDocument();
  });

  it("labels low-confidence recognition honestly", async () => {
    const user = userEvent.setup();
    render(<ImportStudio analyze={async () => imported} onImported={vi.fn()} onPerform={vi.fn()} />);
    await user.upload(
      screen.getByLabelText("Choose score images or PDF"),
      new File([new Uint8Array([1])], "score.webp", { type: "image/webp" }),
    );

    expect(await screen.findByText("READY TO PERFORM")).toBeInTheDocument();
    expect(screen.getByText(/ESTIMATED SCORE/)).toBeInTheDocument();
  });
});
