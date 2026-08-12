import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { builtinSongs } from "../lib/songs";
import { SearchHome } from "./SearchHome";

describe("SearchHome", () => {
  it("filters the catalog and opens a chosen song", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<SearchHome songs={builtinSongs} onChoose={onChoose} />);

    expect(screen.getByRole("heading", { name: "Bring your own recording" })).toBeInTheDocument();
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

  it("makes private recording import more prominent than catalogue search", () => {
    render(<SearchHome songs={builtinSongs} onChoose={vi.fn()} />);

    expect(screen.getByText("NO SUBSCRIPTION · NO PAID API · YOUR FILE STAYS PRIVATE")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search your library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Twinkle, Twinkle, Little Star/ })).toBeInTheDocument();
  });
});
