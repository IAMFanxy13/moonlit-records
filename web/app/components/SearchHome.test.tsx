import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { builtinSongs } from "../lib/songs";
import type { PrivateSongRecord } from "../import/types";
import { SearchHome } from "./SearchHome";

const privateRecord: PrivateSongRecord = {
  id: "import-midnight",
  checksum: "midnight",
  sourceName: "Midnight.mp4",
  createdAt: "2026-08-12T00:00:00.000Z",
  metadata: { title: "Midnight Recording", artist: "Unknown Artist" },
  song: { ...builtinSongs[0], id: "import-midnight", title: "Midnight Recording", artist: "Unknown Artist" },
  warnings: [],
};

describe("SearchHome", () => {
  it("filters the catalog and opens a chosen song", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<SearchHome songs={builtinSongs} onChoose={onChoose} />);

    expect(screen.getByRole("heading", { name: "Bring your numbered score" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search your library" }), "星星");

    expect(screen.getByText("Twinkle, Twinkle, Little Star")).toBeInTheDocument();
    expect(screen.queryByText("Hello, Moonlight")).not.toBeInTheDocument();
    expect(screen.getByText("RECOMMENDED · Studio Grand")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Open Twinkle, Twinkle, Little Star/ }));
    expect(onChoose).toHaveBeenCalledWith(builtinSongs[1]);
  });

  it("keeps all visible interface copy in English", () => {
    render(<SearchHome songs={builtinSongs} onChoose={vi.fn()} />);

    expect(screen.getByText("MOONLIT RECORDS")).toBeInTheDocument();
    expect(screen.getByText("A little room for music after words.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The night's repertoire" })).toBeInTheDocument();
  });

  it("makes private score import more prominent than catalogue search", () => {
    render(<SearchHome songs={builtinSongs} onChoose={vi.fn()} />);

    expect(screen.getByText("NO WI-FI REQUIRED · NO SUBSCRIPTION · YOUR PAGES STAY PRIVATE")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search your library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Twinkle, Twinkle, Little Star/ })).toBeInTheDocument();
  });

  it("renames and deletes private arrangements with an explicit confirmation", async () => {
    const user = userEvent.setup();
    const onRenamePrivate = vi.fn();
    const onDeletePrivate = vi.fn();
    render(
      <SearchHome
        songs={builtinSongs}
        privateRecords={[privateRecord]}
        onChoose={vi.fn()}
        onRenamePrivate={onRenamePrivate}
        onDeletePrivate={onDeletePrivate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Manage Midnight Recording" }));
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const titleInput = screen.getByRole("textbox", { name: "Rename Midnight Recording" });
    await user.clear(titleInput);
    await user.type(titleInput, "Evening Glass");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(onRenamePrivate).toHaveBeenCalledWith(privateRecord, "Evening Glass");

    await user.click(screen.getByRole("button", { name: "Manage Midnight Recording" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this private arrangement forever?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete forever" }));
    expect(onDeletePrivate).toHaveBeenCalledWith(privateRecord);
  });
});
