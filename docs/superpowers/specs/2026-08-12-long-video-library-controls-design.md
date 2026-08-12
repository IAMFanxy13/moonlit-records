# Long-video Transcription and Private Library Controls Design

## Goal

Long imported videos must run bounded, observable local transcription instead of immediately falling back because the entire recording was sent to the model at once. The performance view must state the duration of every note directly. Private imported arrangements must support rename and confirmed deletion from the catalogue.

## Long-video Analysis

The decoded mono PCM remains the source of truth, but Basic Pitch receives one bounded source segment at a time. Each segment covers 20 seconds with a 1-second overlap. A segment is resampled independently to 22,050 Hz, inferred, converted to timestamped notes, and released before the next segment starts. This prevents Basic Pitch from constructing overlapping tensors for the whole multi-minute recording.

Segment-local timestamps are offset into whole-song time. Notes in the overlap are deduplicated when their MIDI pitch matches and their starts differ by no more than 120 milliseconds. The callback reports `(completed segments + current segment fraction) / total segments`, allowing the UI to show actual whole-recording progress. Analyzer stages map this model progress into an overall monotonic 8%-92% range; arranging begins at 94%, enrichment at 96%, and ready is 100%.

The duration of a grouped chord is the longest member duration, not latest end minus earliest start. This prevents an onset near the edge of the 80-millisecond chord window from turning a short note into a false hold.

If a segment throws, the imported result may still use the PCM sketch, but the immediate result and catalogue both say `FALLBACK SKETCH`. The result never claims a neural transcription in that case.

## Duration Guide

Every current instruction includes duration: `TAP 0.4s · 2` or `HOLD 1.2s · 3`. Every visible note block includes both its key and seconds. Neural timing is described as measured; sketch timing is described as estimated. Long notes remain enforced by the existing keydown/keyup state machine, while short-note duration tells the performer how long to let the physical key and piano sound breathe.

## Rename and Delete

Only private imported rows receive a compact `Manage` control. `Rename` opens an inline title field with Save and Cancel. Blank titles cannot be saved. Saving updates both `metadata.title` and `song.title` in IndexedDB and in current React state.

`Delete` first changes to an inline confirmation with `Delete forever` and Cancel. Confirmation removes the record from IndexedDB and current state. Built-in scores have no management controls. The catalogue row is no longer one large nested button; its opening action and management action are separate accessible controls.

## Testing

Pure tests cover 20-second segmentation, overlap offset/deduplication, bounded detector inputs, whole-song progress, chord duration, and monotonic analyzer progress. Rhythm guide tests assert explicit seconds and estimated fallback wording. Private library tests assert rename and removal, SearchHome tests cover the complete inline flows, and MoonlitPiano tests prove persistence callbacks update visible state. Full unit, type, lint, build, render, and local browser checks complete the change.
