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

    expect(screen.getByRole("heading", { name: "今晚，想弹哪一首？" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "搜索歌名" }), "星星");

    expect(screen.getByText("小星星")).toBeInTheDocument();
    expect(screen.queryByText("你好，月光")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /打开《小星星》/ }));
    expect(onChoose).toHaveBeenCalledWith(builtinSongs[1]);
  });
});
