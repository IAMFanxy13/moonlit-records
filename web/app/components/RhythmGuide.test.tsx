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
    expect(screen.getByTestId("rhythm-event-1")).toHaveTextContent("2 0.3s");
  });

  it("shows an explicit duration for taps as well as holds", () => {
    render(<RhythmGuide song={timedSong} eventIndex={1} pressedCodes={new Set()} />);
    expect(screen.getByText("TAP 0.3s · 2")).toBeInTheDocument();
    expect(screen.getByText("Every bar is an estimated duration from the printed score.")).toBeInTheDocument();
  });

  it("shows a silent countdown before exposing the next required key", () => {
    render(
      <RhythmGuide
        song={timedSong}
        eventIndex={1}
        pressedCodes={new Set()}
        restRemainingMs={850}
      />,
    );

    expect(screen.getByText("REST 0.9s")).toBeInTheDocument();
    expect(screen.getByText("No key is required until the rest completes.")).toBeInTheDocument();
  });

  it("drains the current duration bar only while its physical key is down", () => {
    const { rerender } = render(<RhythmGuide song={timedSong} eventIndex={0} pressedCodes={new Set()} />);
    expect(screen.getByTestId("rhythm-event-0")).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("rhythm-event-0")).toHaveAttribute("data-countdown", "ready");

    rerender(<RhythmGuide song={timedSong} eventIndex={0} pressedCodes={new Set(["Digit1"])} />);
    expect(screen.getByTestId("rhythm-event-0")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("rhythm-event-0")).toHaveAttribute("data-countdown", "draining");
    expect(screen.getByTestId("rhythm-event-0")).toHaveAccessibleName(
      "Current key 1, hold 1.2 seconds; hold to drain the remaining bar",
    );
  });
});
