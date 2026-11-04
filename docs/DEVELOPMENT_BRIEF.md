# DS-9 — Initial Development Brief

Status: specification only; no DSP or UI code implemented.

## Identity and visual reference
Wide black vintage hardware chassis; nine permanently visible instrument lanes, oxblood-red name displays, cream controls, red/amber steps. Preserve the supplied DS-9 mockup as visual reference, not as a pixel-perfect implementation blueprint.

## Core functionality
- Nine voices: Kick, Snare, Clap, Low Tom, High Tom, Hi-Hat (closed/open), Percussion, Claves, Cymbal.
- Each lane: 16 visible steps, independent length 1–16, own playhead; shared BPM and swing.
- Hi-hat steps: off / closed / open; closed hat can choke open hat.
- Per-voice genuine analogue-modelled synthesis or imported WAV sample (mono/stereo, up to 10 seconds).
- Selected voice: level, tune, decay, tone; sample trim, reverse, start/end, pitch.
- Pattern slots A–D, save/load sessions, play/stop/pause/record.

## Integration later
- Optional link to GMC-9000; one-to-one nine-lane/pad mapping; LAYER/REPLACE triggers.
- Shared transport in SYNC mode without forcing GMC loop lengths onto BPM grid.
- Preserve standalone use and future Sound Factory routing.

## First implementation milestones
1. Choose Windows audio/UI stack and confirm build environment.
2. Implement sample-accurate step scheduler and nine-lane sequencer state with tests.
3. Implement genuine drum DSP voices and WAV playback.
4. Build the vintage hardware UI and connect every control to actual state/audio.
5. Add session persistence, tests, and packaging.

See the user's master specification for complete details; this file is a condensed starting brief.
