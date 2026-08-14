import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLyricStageLayout } from "./use-lyric-stage-layout";

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

function Harness() {
  const { lineRef, anchorPercentById } = useLyricStageLayout("phrase-one");
  return (
    <>
      <div className="lyric-progress" data-testid="line" ref={lineRef}>
        <span data-lyric-token-id="token-a">A</span>
        <span data-lyric-token-id="token-b">B</span>
      </div>
      <output data-testid="anchor-a">{anchorPercentById.get("token-a") ?? "missing"}</output>
    </>
  );
}

describe("useLyricStageLayout", () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({ fontSize: "48px" } as CSSStyleDeclaration);
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() { return this.classList.contains("lyric-progress") ? 600 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get() { return this.classList.contains("lyric-progress") ? 1_200 : 0; },
    });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.classList.contains("lyric-progress")) {
        return { x: 100, y: 0, left: 100, right: 700, top: 0, bottom: 80, width: 600, height: 80, toJSON() {} };
      }
      if (this.getAttribute("data-lyric-token-id") === "token-a") {
        return { x: 160, y: 0, left: 160, right: 190, top: 0, bottom: 50, width: 30, height: 50, toJSON() {} };
      }
      return { x: 610, y: 0, left: 610, right: 640, top: 0, bottom: 50, width: 30, height: 50, toJSON() {} };
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    HTMLElement.prototype.getBoundingClientRect = originalRect;
    if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
    if (originalScrollWidth) Object.defineProperty(HTMLElement.prototype, "scrollWidth", originalScrollWidth);
  });

  it("fits a long phrase to one line and reports its real token centres", async () => {
    render(<Harness />);

    const line = screen.getByTestId("line");
    await waitFor(() => expect(line).toHaveAttribute("data-fit-state", "fitted"));
    expect(line.style.getPropertyValue("--lyric-fit-font-px")).toBe("24px");
    expect(Number(screen.getByTestId("anchor-a").textContent)).toBeCloseTo(12.5);
  });
});
