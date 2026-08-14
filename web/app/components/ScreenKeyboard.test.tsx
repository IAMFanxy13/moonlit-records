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
    expect(screen.getAllByRole("button")).toHaveLength(28);
    expect(screen.queryByTestId("key-Enter")).not.toBeInTheDocument();
    expect(screen.getByTestId("key-Shift")).toHaveTextContent("SHIFT");
    expect(screen.getByText("A–Z lyric melody · A–Z + Space two hands · Shift instrumental.")).toBeInTheDocument();
    expect(screen.getByText("Right-hand lyrics, left-hand harmony — every note still waits for you.")).toBeInTheDocument();
  });

  it("targets Space explicitly for a left-hand gesture", () => {
    render(<ScreenKeyboard targetCode="Space" feedback={null} pressedCodes={new Set()} />);

    expect(screen.getByTestId("key-Space")).toHaveAttribute("data-state", "target");
    expect(screen.getByTestId("key-Space")).toHaveAccessibleName("SPACE · LEFT HAND, target");
  });

  it("can target both hands at the same time", () => {
    render(<ScreenKeyboard targetCodes={["KeyA", "Space"]} feedback={null} pressedCodes={new Set()} />);
    expect(screen.getByTestId("key-KeyA")).toHaveAttribute("data-state", "target");
    expect(screen.getByTestId("key-Space")).toHaveAttribute("data-state", "target");
  });

  it("targets Shift as one standalone instrumental key", () => {
    render(<ScreenKeyboard targetCode="Shift" feedback={null} pressedCodes={new Set()} />);
    expect(screen.getByTestId("key-Shift")).toHaveAttribute("data-state", "target");
    expect(screen.queryByTestId("key-Digit2")).not.toBeInTheDocument();
  });
});
