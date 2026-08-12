import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { builtinSongs } from "../lib/songs";
import { RhythmGuide, SharedDurationBar } from "./RhythmGuide";

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
    render(<RhythmGuide song={timedSong} eventIndex={0} />);

    expect(screen.getByLabelText("Rhythm guide")).toHaveAttribute("data-lane-mode", "digits");
    expect(screen.getAllByTestId(/rhythm-lane-/u)).toHaveLength(10);
    expect(screen.getByText("GUIDE 1.2s · 1")).toBeInTheDocument();
    expect(screen.getByTestId("rhythm-event-0")).toHaveAttribute("data-duration-ms", "1200");
    expect(screen.getByTestId("rhythm-event-1")).toHaveAttribute("data-offset-ms", "800");
    expect(screen.getByTestId("rhythm-event-1")).toHaveAccessibleName("Next key 2, suggested hold 0.3 seconds");
    expect(screen.getByTestId("rhythm-event-1")).toHaveTextContent("2 0.3s");
  });

  it("shows an explicit duration for taps as well as holds", () => {
    render(<RhythmGuide song={timedSong} eventIndex={1} />);
    expect(screen.getByText("GUIDE 0.3s · 2")).toBeInTheDocument();
    expect(screen.getByText("Hold to drain the bar; release whenever you choose.")).toBeInTheDocument();
  });

  it("shows a silent countdown before exposing the next required key", () => {
    render(
      <RhythmGuide
        song={timedSong}
        eventIndex={1}
        restRemainingMs={850}
      />,
    );

    expect(screen.getByText("REST 0.9s")).toBeInTheDocument();
    expect(screen.getByText("No key is suggested until the rest completes.")).toBeInTheDocument();
  });

  it("keeps the note highway informational instead of animating separate duration fills", () => {
    render(<RhythmGuide song={timedSong} eventIndex={0} />);

    expect(screen.getByTestId("rhythm-event-0")).not.toHaveAttribute("data-countdown");
    expect(screen.getByTestId("rhythm-event-0")).not.toHaveAttribute("data-active");
    expect(screen.getByTestId("rhythm-event-0")).toHaveAccessibleName(
      "Current key 1, suggested hold 1.2 seconds",
    );
  });

  it("uses one shared lower bar that drains only for the active correct key", () => {
    const { rerender } = render(
      <SharedDurationBar event={timedSong.events[0]} active={false} resting={false} />,
    );

    const ready = screen.getByTestId("shared-duration-bar");
    expect(ready).toHaveAttribute("data-countdown", "ready");
    expect(ready).toHaveAttribute("data-event-id", "timed-0");
    expect(ready).toHaveTextContent("1");
    expect(ready).toHaveTextContent("1.2s");

    rerender(<SharedDurationBar event={timedSong.events[0]} active resting={false} />);
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-countdown", "draining");

    rerender(<SharedDurationBar event={timedSong.events[1]} active={false} resting={false} />);
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-countdown", "ready");
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-event-id", "timed-1");
  });
});
