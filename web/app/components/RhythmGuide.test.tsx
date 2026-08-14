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
      targetCode: "Shift",
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
      targetCode: "Shift",
      holdMs: 280,
      sourceStartMs: 800,
      sourceEndMs: 1_080,
    },
    {
      ...base.events[2],
      id: "timed-2",
      token: null,
      tokenIndex: null,
      targetCode: "Shift",
      holdMs: 250,
      sourceStartMs: 1_600,
      sourceEndMs: 1_850,
    },
  ],
};

describe("RhythmGuide", () => {
  it("shows the dedicated Shift lane and translates source duration into tap and hold blocks", () => {
    render(<RhythmGuide song={timedSong} eventIndex={0} />);

    expect(screen.getByLabelText("Rhythm guide")).toHaveAttribute("data-lane-mode", "hands");
    expect(screen.getAllByTestId(/rhythm-lane-/u)).toHaveLength(1);
    expect(screen.getByText("GUIDE 1.2s · SHIFT")).toBeInTheDocument();
    expect(screen.getByTestId("rhythm-event-0")).toHaveAttribute("data-duration-ms", "1200");
    expect(screen.getByTestId("rhythm-event-1")).toHaveAttribute("data-offset-ms", "800");
    expect(screen.getByTestId("rhythm-event-1")).toHaveAccessibleName("Next key SHIFT, suggested hold 0.3 seconds");
    expect(screen.getByTestId("rhythm-event-1")).toHaveTextContent("SHIFT 0.3s");
  });

  it("names a continuation event as SPACE in the highway", () => {
    const continuationSong = {
      ...timedSong,
      events: [{ ...timedSong.events[0], targetCode: "Space" }],
    };
    render(<RhythmGuide song={continuationSong} eventIndex={0} />);

    expect(screen.getByLabelText(/Current key SPACE/)).toBeInTheDocument();
    expect(screen.getByText(/SPACE/, { selector: ".rhythm-caption strong" })).toBeInTheDocument();
  });

  it("shows an explicit duration for taps as well as holds", () => {
    render(<RhythmGuide song={timedSong} eventIndex={1} />);
    expect(screen.getByText("GUIDE 0.3s · SHIFT")).toBeInTheDocument();
    expect(screen.getByText("The score shapes note length; your next keydown shapes the connection.")).toBeInTheDocument();
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
      "Current key SHIFT, suggested hold 1.2 seconds",
    );
  });

  it("uses the same curated score target as the audio engine for a built-in tap", () => {
    render(<RhythmGuide song={builtinSongs[0]} eventIndex={0} />);

    expect(screen.getByTestId("rhythm-event-0")).toHaveAttribute("data-duration-ms", "683");
    expect(screen.getByText("GUIDE 0.7s · N")).toBeInTheDocument();
  });

  it("uses one shared lower bar as musical-duration information, not a release command", () => {
    const { rerender } = render(
      <SharedDurationBar event={timedSong.events[0]} durationMs={1_200} active={false} resting={false} />,
    );

    const ready = screen.getByTestId("shared-duration-bar");
    expect(ready).toHaveAttribute("data-countdown", "ready");
    expect(ready).toHaveAttribute("data-event-id", "timed-0");
    expect(ready).toHaveTextContent("1");
    expect(ready).toHaveTextContent("1.2s");
    expect(ready).toHaveTextContent("NEXT ATTACK WINDOW");
    expect(ready).toHaveTextContent("NEXT GESTURE");
    expect(ready).not.toHaveTextContent("PRESS TO START");

    rerender(<SharedDurationBar event={timedSong.events[0]} durationMs={1_200} active resting={false} />);
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-countdown", "draining");
    expect(screen.getByTestId("shared-duration-bar")).toHaveTextContent("LISTEN · THEN PLAY");
    expect(screen.getByTestId("shared-duration-bar")).not.toHaveTextContent("HOLDING");

    rerender(<SharedDurationBar event={timedSong.events[1]} durationMs={280} active={false} resting={false} />);
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-countdown", "ready");
    expect(screen.getByTestId("shared-duration-bar")).toHaveAttribute("data-event-id", "timed-1");
  });
});
