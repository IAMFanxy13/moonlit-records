import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ImportStudio } from "./ImportStudio";

const validCode = `MOONLIT-SCORE/1
title: 花海
artist: 周杰伦
key: F
meter: 4/4
tempo: 72
voice: felt

line: 静止了
notes: 1:1{静} 3:1{止} 3:2{了}`;

describe("ImportStudio", () => {
  it("automatically prepares pasted Moonlit Score Code, saves it, and offers performance", async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    const onPerform = vi.fn();
    render(<ImportStudio onImported={onImported} onPerform={onPerform} />);

    const editor = screen.getByRole("textbox", { name: "Paste Moonlit Score Code" });
    await user.click(editor);
    await user.paste(validCode);

    expect(await screen.findByText("READY TO PERFORM")).toBeInTheDocument();
    expect(screen.getByText("花海")).toBeInTheDocument();
    expect(screen.getByText(/周杰伦 · MOONLIT SCORE CODE/)).toBeInTheDocument();
    expect(onImported).toHaveBeenCalledOnce();
    expect(onImported.mock.calls[0][0].song.events.map((event: { targetCode: string }) => event.targetCode)).toEqual([
      "KeyJ", "KeyZ", "KeyL",
    ]);

    await user.click(screen.getByRole("button", { name: "Perform this score" }));
    expect(onPerform).toHaveBeenCalledWith(onImported.mock.calls[0][0].song);
  });

  it("retains invalid input and shows an actionable line-numbered error", async () => {
    const user = userEvent.setup();
    render(<ImportStudio onImported={vi.fn()} onPerform={vi.fn()} />);
    const editor = screen.getByRole("textbox", { name: "Paste Moonlit Score Code" });
    const invalid = `${validCode}\n<script>alert(1)</script>`;

    await user.click(editor);
    await user.paste(invalid);

    expect(await screen.findByRole("alert")).toHaveTextContent(/Line 11: Unknown statement/);
    expect(editor).toHaveValue(invalid);
    expect(screen.queryByText("READY TO PERFORM")).not.toBeInTheDocument();
  });

  it("only accepts score code and no longer exposes image or PDF recognition", () => {
    render(<ImportStudio onImported={vi.fn()} onPerform={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "Paste Moonlit Score Code" })).toBeInTheDocument();
    expect(screen.getByText(/MOONLIT-SCORE\/2/)).toBeInTheDocument();
    expect(screen.getByText(/legacy MOONLIT-SCORE\/1 remains supported/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Choose score images or PDF")).not.toBeInTheDocument();
    expect(screen.queryByText(/PNG · JPEG · WEBP · PDF/)).not.toBeInTheDocument();
  });
});
