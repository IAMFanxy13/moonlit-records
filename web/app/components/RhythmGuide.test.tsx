import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { builtinSongs } from "../lib/songs";
import { RhythmGuide } from "./RhythmGuide";

const base = builtinSongs[0];
const timedSong = {
  ...base,
  id: "timed-guide",
  phrases: [{ id: "instrumental", text: "Instrumental passage", startEvent: 0, endEvent: 2 }],
  events: [
    {
      ...base.events[0],
      id: "timed-0",
      token: null,
      tokenIndex: null,
      targetCode: "Digit1",
      kind: "hold" as const,
      holdMs: 1_200,
      sourceStartMs: 0,
      sourceEndMs: 1_200,
    },
    {
      ...base.events[1],
      id: "timed-1",
      token: null,
      tokenIndex: null,
      targetCode: "Digit2",
      sourceStartMs: 800,
      sourceEndMs: 1_080,
    },
    {
      ...base.events[2],
      id: "timed-2",
      token: null,
      tokenIndex: null,
      targetCode: "Digit3",
      sourceStartMs: 1_600,
      sourceEndMs: 1_850,
    },
  ],
};

describe("RhythmGuide", () => {
  it("shows ten numeric lanes and translates source duration into tap and hold blocks", () => {
    render(<RhythmGuide song={timedSong} eventIndex={0} pressedCodes={new Set()} />);

    expect(screen.getByLabelText("Rhythm guide")).toHaveAttribute("data-lane-mode", "digits");
    expect(screen.getAllByTestId(/rhythm-lane-/u)).toHaveLength(10);
    expect(screen.getByText("HOLD 1.2s · 1")).toBeInTheDocument();
    expect(screen.getByTestId("rhythm-event-0")).toHaveAttribute("data-duration-ms", "1200");
    expect(screen.getByTestId("rhythm-event-1")).toHaveAttribute("data-offset-ms", "800");
    expect(screen.getByTestId("rhythm-event-1")).toHaveAccessibleName("Next key 2, tap 0.3 seconds");
  });

  it("fills the current hold only while its physical key is down", () => {
    const { rerender } = render(<RhythmGuide song={timedSong} eventIndex={0} pressedCodes={new Set()} />);
    expect(screen.getByTestId("rhythm-event-0")).toHaveAttribute("data-active", "false");

    rerender(<RhythmGuide song={timedSong} eventIndex={0} pressedCodes={new Set(["Digit1"])} />);
    expect(screen.getByTestId("rhythm-event-0")).toHaveAttribute("data-active", "true");
  });
});
