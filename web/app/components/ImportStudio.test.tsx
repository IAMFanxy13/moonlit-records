import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { builtinSongs } from "../lib/songs";
import type { PrivateSongRecord } from "../import/types";
import { ImportStudio } from "./ImportStudio";

const imported: PrivateSongRecord = {
  id: "import-one",
  checksum: "one",
  sourceName: "Song.mp3",
  createdAt: "2026-08-12T00:00:00.000Z",
  metadata: { title: "Song", artist: "Artist" },
  song: { ...builtinSongs[2], id: "import-one", title: "Song", artist: "Artist", quality: "sketch" },
  warnings: ["ON_DEVICE_SKETCH"],
};

describe("ImportStudio", () => {
  it("imports media locally, reports truthful stages, and offers the result", async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    const onPerform = vi.fn();
    const analyze = vi.fn(async (_file, onProgress) => {
      for (const stage of ["preparing", "identifying", "transcribing", "arranging", "ready"] as const) {
        onProgress({ stage, detail: `Now ${stage}`, fraction: stage === "transcribing" ? 0.42 : undefined });
      }
      return imported;
    });
    render(
      <ImportStudio
        analyze={analyze}
        enrich={async (record) => record}
        onImported={onImported}
        onPerform={onPerform}
      />,
    );

    const picker = screen.getByLabelText("Choose audio or video") as HTMLInputElement;
    expect(picker.accept).toContain("audio/*");
    expect(picker.accept).toContain("video/*");
    await user.upload(picker, new File([new Uint8Array([1])], "Song.mp3", { type: "audio/mpeg" }));

    expect(await screen.findByText("READY TO PERFORM")).toBeInTheDocument();
    expect(screen.getByText("Song")).toBeInTheDocument();
    expect(onImported).toHaveBeenCalledWith(imported);
    await user.click(screen.getByRole("button", { name: "Perform this arrangement" }));
    expect(onPerform).toHaveBeenCalledWith(imported.song);
  });

  it("shows determinate model progress instead of a decorative scan", async () => {
    const user = userEvent.setup();
    let finishAnalysis: (() => void) | undefined;
    const analyze = vi.fn(async (_file, onProgress) => {
      onProgress({ stage: "transcribing", detail: "Running local model window 4 of 10.", fraction: 0.4, method: "neural" });
      await new Promise<void>((resolve) => { finishAnalysis = resolve; });
      return imported;
    });
    render(
      <ImportStudio
        analyze={analyze}
        enrich={async (record) => record}
        onImported={vi.fn()}
        onPerform={vi.fn()}
      />,
    );

    await user.upload(
      screen.getByLabelText("Choose audio or video"),
      new File([new Uint8Array([1])], "Song.mp3", { type: "audio/mpeg" }),
    );
    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    finishAnalysis?.();
    expect(await screen.findByText("READY TO PERFORM")).toBeInTheDocument();
  });

  it("keeps the local result when online enrichment is unavailable", async () => {
    const user = userEvent.setup();
    render(
      <ImportStudio
        analyze={async () => imported}
        enrich={async () => { throw new Error("offline"); }}
        onImported={vi.fn()}
        onPerform={vi.fn()}
      />,
    );
    await user.upload(
      screen.getByLabelText("Choose audio or video"),
      new File([new Uint8Array([1])], "Song.mp3", { type: "audio/mpeg" }),
    );
    expect(await screen.findByText("READY TO PERFORM")).toBeInTheDocument();
    expect(screen.getByText(/Online details were unavailable/)).toBeInTheDocument();
  });

  it("stops waiting for optional online details and keeps the local arrangement", async () => {
    const user = userEvent.setup();
    render(
      <ImportStudio
        analyze={async () => imported}
        enrich={() => new Promise(() => undefined)}
        enrichmentTimeoutMs={5}
        onImported={vi.fn()}
        onPerform={vi.fn()}
      />,
    );
    await user.upload(
      screen.getByLabelText("Choose audio or video"),
      new File([new Uint8Array([1])], "Song.mp3", { type: "audio/mpeg" }),
    );

    expect(await screen.findByText("READY TO PERFORM")).toBeInTheDocument();
    expect(screen.getByText(/Online details were unavailable/)).toBeInTheDocument();
  });
});
