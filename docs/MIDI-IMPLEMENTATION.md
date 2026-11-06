# DS-9 MIDI/session implementation review

The architecture correction is applied: Microseq is a standalone synthesizer; DM-848 is the separate eight-track host. DS-9 remains a standalone instrument. No Microseq, GMC-9000 or DM-848 repository was modified. No main/release merge or website deployment is part of this task.

## Stages and boundaries

1. `MIDI-CONTRACT.md` documented the interfaces and unverifiable assumptions before shared integration code was written.
2. `src/events` provides portable trigger/clip/clock types, shared audio-time mapping, clip-window scheduling, transactional event storage, quantization, MIDI input translation and recording. It imports no instrument/application code. The library has an explicit entry point and configurable clip-slot count. DS-9-specific mapping, nine-voice routing and hi-hat conflict policy live outside it in `src/drum-assignments.ts` and the sequencer adapter.
3. Version-2 session validation, PCM asset serialization and atomic restoration preserve complete sound/pattern/timing state. Legacy files migrate. Malformed input and unsupported assets are rejected before application replacement.
4. A single audio-clock lookahead scheduler merges SEQ/MIDI/BOTH without coupling per-lane and clip-loop lengths. Exact collisions merge; offset hits survive. Pause/resume, tempo changes, stop/seek cancellation and host snapshots are handled without applying swing twice. The existing main-thread lookahead can still underrun if the browser suspends JavaScript for longer than the scheduling horizon.
5. MIDI REC and the optional named-lane editor support on-screen/hardware-input recording, ten rows, assignment labels, mapping, paint/erase, movement, velocity, quantization, clip lengths and undo/redo. The hardware step interface remains intact.

The local `instrumentAdapter` export provides `clockReference()`, `followClock(snapshot)` and `disconnect()`. A future host maps its timestamps into this local audio clock and supplies transport anchors. SYNC without an attached host does not silently become a local clock. Actual cross-context synchronization, origin/security checks, host discovery and output routing remain outside this build. This is a tested contract boundary, not tested integration with other instruments.

## Verification

- TypeScript check and Vite production build pass.
- 13 unit tests pass: fractional swing round trips, exact duplicate/flam/hat policies, quantized and unquantized recording, undo/redo, MIDI message/timestamp handling, stereo PCM/session round trips, legacy migration, malformed session rejection and half-open clip scheduling windows.
- Existing browser/audio, performance-control and factory-kit suites pass: 144 steps, pattern memory, independent lengths, transport, M/S groups, drag editing, wheel controls, keyboard playback and synthesis for all factory kits.
- Scheduler browser tests pass for 7/12-step lanes against a three-beat MIDI loop, exact collisions, a retained 5 ms flam, same-cycle recording echo suppression, host start/seek/pause/disconnect, invalid host anchors and tempo/swing/pause/resume. Rendered audio verifies hi-hat choking even when a live hit arrives after a future hat was queued.
- Editor/session browser tests pass for ten rows, paint/erase/move, velocity and position editing, independent clip lengths, undo/redo of a recording pass, simulated hardware MIDI plus on-screen recording, assignment rename/remapping, complete export/reload (including imported WAV data), invalid import preserving current state, and the SYNC boundary.

Browser MIDI is simulated; a physical controller and actual DM-848/Microseq/GMC interoperability have not been tested. Audio is validated by rendered signals, not speaker listening. The event contract currently covers trigger/one-shot behaviour; sustained pitched-note gate semantics require agreement with other instrument implementations. No external MIDI output or SEQ-to-MIDI capture is implemented.

## Review

Use the build artifact or the feature branch. `docs/MIDI-editor-screenshot.png` shows the optional editor. The existing published site has not been updated. README contains operating instructions, persistence limits and exact test commands. Existing COPY/PASTE/CLEAR remain step-only; MIDI data has its own transaction history. No autosave is implied by successful export.
