import { describe, expect, it, vi } from "vitest";

import { createOwnedToneSourceHandle } from "./tone-source-adapter";

function source() {
  return {
    state: "started",
    fadeOut: 0,
    cancelStop: vi.fn(),
    stop: vi.fn(),
  };
}

describe("owned Tone source adapter", () => {
  it("schedules release against the audio clock instead of wall-clock timers", () => {
    const owned = source();
    const handle = createOwnedToneSourceHandle([owned], () => 12.5);

    handle.scheduleRelease(750, { fadeOutSeconds: 0.24 });

    expect(owned.fadeOut).toBe(0.24);
    expect(owned.stop).toHaveBeenCalledWith(13.25);
  });

  it("cancels a future stop before replacing it with an immediate legato release", () => {
    const owned = source();
    const handle = createOwnedToneSourceHandle([owned], () => 20);
    handle.scheduleRelease(900, { fadeOutSeconds: 0.4 });

    handle.release({ fadeOutSeconds: 0.12 });

    expect(owned.cancelStop).toHaveBeenCalledOnce();
    expect(owned.fadeOut).toBe(0.12);
    expect(owned.stop).toHaveBeenLastCalledWith(20);
  });

  it("can cancel and reschedule without ending the owned voice", () => {
    const owned = source();
    let now = 4;
    const handle = createOwnedToneSourceHandle([owned], () => now);
    handle.scheduleRelease(500, { fadeOutSeconds: 0.2 });
    handle.cancelScheduledRelease();
    now = 4.2;
    handle.scheduleRelease(700, { fadeOutSeconds: 0.3 });

    expect(owned.cancelStop).toHaveBeenCalledOnce();
    expect(owned.stop).toHaveBeenNthCalledWith(1, 4.5);
    expect(owned.stop).toHaveBeenNthCalledWith(2, 4.9);
  });

  it("keeps separately owned same-pitch sources isolated", () => {
    const first = source();
    const second = source();
    const firstHandle = createOwnedToneSourceHandle([first], () => 2);
    const secondHandle = createOwnedToneSourceHandle([second], () => 2);

    firstHandle.scheduleRelease(600, { fadeOutSeconds: 0.2 });
    firstHandle.release({ fadeOutSeconds: 0.1 });

    expect(first.stop).toHaveBeenCalledTimes(2);
    expect(second.stop).not.toHaveBeenCalled();
    expect(secondHandle.isReleased()).toBe(false);
  });

  it("uses independent score durations for simultaneous notes in one gesture", () => {
    const bass = source();
    const fifth = source();
    const handle = createOwnedToneSourceHandle([bass, fifth], () => 3);

    handle.scheduleRelease([800, 1_600], { fadeOutSeconds: 0.3 });

    expect(bass.stop).toHaveBeenCalledWith(3.8);
    expect(fifth.stop).toHaveBeenCalledWith(4.6);
  });
});
