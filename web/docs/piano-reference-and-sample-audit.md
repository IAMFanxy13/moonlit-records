# Moonlit Records Piano Reference and Sample Audit

Date: 2026-08-13

## 2026-08-14 gesture/arrangement addendum

| Problem | Existing Moonlit behavior | Mature reference pattern | Gap | Decision |
| --- | --- | --- | --- | --- |
| Simultaneous voicing | one scalar velocity and duration per event | Tone Sampler can attack note arrays at one audio-clock time | no per-note authored dynamics/lifetime | Adapt: preserve per-note arrays and schedule owned sources independently |
| Left/right continuity | every new attack globally transitioned resonance | piano hands and pedal/harmony have independent musical lifetimes | right melody could cut left harmony | Custom minimal hand/harmony ownership around existing Tone handles |
| Score interchange | V1 captured melody and simple chords | declarative score formats separate metadata, parts, events and expression | no authoritative arrangement payload | Add strict JSON-based MOONLIT-SCORE/2; no eval |
| Voice leading | fallback stepped through a fixed four-chord loop by event count | keep common tones, move other voices minimally, keep registers idiomatic | event count was mistaken for meter/harmony | Downgrade heuristic to compatibility fallback; authored GPT harmony wins |
| Low register | lowest anchor is A2 | sampled piano libraries use nearby anchors and velocity layers | C2/G2 can be shifted far from A2 and there is one layer | Keep traceable compact bank now; report limitation, do not add unlicensed assets |

The hand-aware lifecycle reuses Tone's attack/source scheduling and Web Audio's monotonic audio clock. The small custom layer exists only because one physical gesture must own and later release its exact sources independently of another hand. The fallback arranger is intentionally conservative; sophisticated harmony and texture are authored before playback in Score/2.

## Primary references

- [Tone.js 15.1.22 Sampler](https://tonejs.github.io/docs/15.1.22/classes/Sampler.html) maps sparse recorded pitches to playable notes and repitches the nearest sample. Its public attack/release API is suitable for ordinary instruments, while Moonlit needs exact gesture ownership for overlapping same-pitch notes.
- [Tone.js 15.1.22 ToneBufferSource](https://tonejs.github.io/docs/15.1.22/classes/ToneBufferSource.html) exposes audio-clock `stop(time)` and `cancelStop()`. Moonlit now isolates its private Sampler source capture in one adapter and performs musical scheduling with these official source-level operations.
- [Web Audio API 1.1](https://webaudio.github.io/web-audio-api/) defines `AudioContext.currentTime` as the audio render clock and documents `baseLatency`, `outputLatency`, and `getOutputTimestamp()`. The specification explicitly warns that `currentTime - outputTimestamp.contextTime` is not a substitute for `outputLatency`.
- [Original Salamander Grand Piano V3](https://github.com/sfzinstruments/SalamanderGrandPiano) is Alexander Holm's 48 kHz/24-bit sampled Yamaha C5. The project records 16 velocity layers and is distributed under CC BY 3.0.
- [SFZ Instruments piano catalogue](https://sfzinstruments.github.io/pianos/) confirms the instrument, author, CC BY 3.0 license, 16 velocity layers, and microphone setup.

## Local bank inventory

The shipped bank contains 14 MP3 pitch anchors from A2 through C6:

`A2, C3, D#3, F#3, A3, C4, D#4, F#4, A4, C5, D#5, F#5, A5, C6`

- File count: 14
- Total compressed size: 925,002 bytes (0.882 MiB)
- Example C4 stream: MP3, 44.1 kHz, stereo, about 38 kb/s
- Velocity layers: one compact layer
- Separate local release samples: none
- Separate local sympathetic-resonance samples: none
- Convolution impulse response: none
- Pitch gaps: mostly three semitones; Tone Sampler repitches the nearest anchor
- Sum of decoded sample durations: 196.959 s
- Estimated decoded PCM footprint for one 44.1 kHz stereo Float32 bank: 66.27 MiB (72.13 MiB if the device resamples and retains it at 48 kHz)

## Measured decay

`scripts/audit-piano-samples.mjs` decodes each file to 48 kHz mono float PCM and measures peak, whole-file RMS, and 250 ms RMS windows at 0, 0.5, 1, 2, 3, 4, 6, and 8 seconds.

- Decoded duration range: 6.226 s (C6) to 16.186 s (C4)
- C4 RMS: 0.1389 at attack, 0.0449 at 0.5 s, 0.00884 at 1 s, 0.00847 at 2 s, 0.00469 at 4 s, 0.00290 at 6 s, and 0.00218 at 8 s.
- A2 RMS: 0.1137 at attack, 0.0469 at 1 s, 0.0291 at 2 s, 0.0154 at 4 s, 0.00870 at 6 s, and 0.00645 at 8 s.
- Every anchor except the naturally shorter C6 still contains decoded signal at 8 s.

The samples themselves are not being cut off at one or two seconds. The previous disconnected impression primarily came from JavaScript-timer release authority and one-note-at-a-time transition policy, not from short source files. Low and middle anchors contain long natural bodies; high notes decay much faster, as a real piano also does.

## Asset decision

Moonlit keeps the current compact bank for this release.

The full official 16-layer Salamander source would materially improve velocity realism, but a computer keyboard has no pressure/velocity sensor and the full bank would be a disproportionate offline download. A three- or four-layer derivative would also require a defensible deterministic layer policy, much larger storage, conversion QA, and listening A/B evidence that is not available from the current compact web bank alone. Adding a random room impulse would introduce another license and could blur fast lyrics.

The evidence-supported improvement is therefore engine-first:

1. schedule release on the audio clock;
2. cancel/reschedule on a real next attack;
3. use score target, rests, phrase boundaries, same-pitch protection, and lyric-token articulation;
4. adapt only the release window to a bounded human tempo estimate;
5. keep the measured natural sample body and restrained algorithmic room.

## Performance budget

- Compressed local audio payload: 0.882 MiB; there is no runtime CDN dependency.
- Decoded PCM estimate: 66.27 MiB for one complete 44.1 kHz stereo bank. The four selectable voices are effect/profile chains over the same compact set of pitches; browser implementation details determine whether decoded buffers are internally shared, so the report does not pretend that compressed size equals RAM use.
- First playable behavior: the sampler load is local and remains asynchronous; the engine never inserts an artificial delay after a real playable `keydown`. Exact cold-load time is device, disk-cache, and decoder dependent and was not promoted as a universal number.
- Steady-state DSP: one low-pass filter, algorithmic room, and output gain per voice profile; no convolution IR, FFT score follower, live pitch detector, or background network processing was added.
- Musical polyphony: physical gestures keep exact independent handles; deferred phrase resonance is capped at four gestures and 1.1 seconds. Cleanup on seek, pause, restart, replay, blur, hidden, and unmount prevents unbounded accumulation.
- Output latency: development diagnostics report supported `baseLatency`, `outputLatency`, `getOutputTimestamp()`, Tone `lookAhead`, and audio `currentTime` separately. They do not mislabel JavaScript handler time as speaker latency.

## Before / after behavior

Before, the browser main thread's timeout decided when `keyUp` reached the sampler. Scheduling could drift under rendering load, and the next real keydown was forced to compete with that pending wall-clock release.

After, every guided gesture owns its exact sources. The target stop is scheduled immediately against Tone's audio clock. An early next correct keydown cancels that future stop and replaces it with a bounded legato release. A late next keydown does not hold the previous note forever. JavaScript timers only retire UI/resonance records and can be late without changing the already-scheduled musical release.

## Physical limits

- A computer keyboard provides no strike velocity, aftertouch, or half-pedal data.
- Laptop speakers cannot reproduce the bass extension, dynamic headroom, or spatial radiation of a real grand piano.
- Browser and operating-system output latency varies by device; diagnostics expose the values but cannot remove hardware buffering.
- One compact velocity layer cannot equal the timbral change of 16 recorded layers.

Within those limits, the new engine preserves real human onset timing and makes already-triggered notes connect and finish consistently without automatic playing.
