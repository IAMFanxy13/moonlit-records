import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScreenKeyboard } from "./ScreenKeyboard";

describe("ScreenKeyboard", () => {
  it("keeps the expected key targeted while a wrong key flashes red", () => {
    render(
      <ScreenKeyboard
        targetCode="KeyN"
        feedback={{ code: "KeyH", kind: "wrong" }}
        pressedCodes={new Set(["KeyH"])}
      />,
    );

    expect(screen.getByTestId("key-KeyN")).toHaveAttribute("data-state", "target");
    expect(screen.getByTestId("key-KeyH")).toHaveAttribute("data-state", "wrong");
    expect(screen.queryByTestId("key-Escape")).not.toBeInTheDocument();
    expect(screen.getByTestId("key-Space")).toHaveAttribute("data-state", "idle");
    expect(screen.getByTestId("key-Space")).toHaveTextContent("SPACE");
    expect(screen.getAllByRole("button")).toHaveLength(37);
    expect(screen.getByText("Numbers, letters, and Space for lyric continuations.")).toBeInTheDocument();
    expect(screen.getByText("A free piano, with lyric initials as your guide.")).toBeInTheDocument();
  });

  it("targets Space explicitly for a continuation note", () => {
    render(<ScreenKeyboard targetCode="Space" feedback={null} pressedCodes={new Set()} />);

    expect(screen.getByTestId("key-Space")).toHaveAttribute("data-state", "target");
    expect(screen.getByTestId("key-Space")).toHaveAccessibleName("SPACE continuation key");
  });
});
