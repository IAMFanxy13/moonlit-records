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
    expect(screen.getByTestId("key-Escape")).toBeDisabled();
    expect(screen.getByText("功能键留给浏览器与系统")).toBeInTheDocument();
  });
});
