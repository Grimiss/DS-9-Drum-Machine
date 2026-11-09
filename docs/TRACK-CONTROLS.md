# Track controls, Mixer, samples, fills and Song mode

The nine-voice step sequencer remains the primary interface. Its hardware panel now spans the space previously used by the selected-voice panel. Each lane has M/S, its instrument display, sixteen steps, Level/Tune/Decay/Tone, a Sample button and the independent length display. The four sound knobs follow the note grid. The 1754 × 886 canvas still scales uniformly to the tablet's visual viewport. Parameter headings align above the four rotary columns; knobs retain touch capture, wheel and keyboard adjustment.

Every rotary binding captures a fixed voice index. The sample editor uses the same live voice state; its Decay control mirrors the corresponding lane control. Changing the selected instrument does not copy settings between voices.

Sample opens a modal for that instrument. It provides analog/sample mode, file loading, preview, waveform, Start/End, Pitch, Decay, Trim and Reverse. Closed/Open previews and fixed choke information appear for the combined hi-hat voice. No microphone or audio-input recording is requested or implemented in this phase. File decoding captures its destination before awaiting, so switching tracks while a file loads cannot redirect it. Loading a new file resets region, reverse and sample pitch while retaining the lane's four sound parameters. Trim validates the region; start/end controls maintain at least one representable 1% interval. Closing restores focus to the Sample button that opened it, including from the Mixer.

The header FILL button supports both gestures:

- Tap/Enter: queue one bar of variations on the next available global sixteen-step bar, accounting for the scheduler's lookahead. It returns to the original pattern automatically.
- Hold for about 200 ms: play temporary variations until release. Pointer capture permits release outside the button; cancellation/window blur releases a held fill.

Fills add snare rolls, alternating tom hits, closed hats and percussion. They leave kick, clap, claves and cymbal programming alone, honor mute/solo and use the existing tempo/swing clock. They do not write step arrays, alter per-lane lengths, reset polymetric phase, or create pattern data. Pause/Stop cancels transient fills.

MIXER opens a separate nine-channel window with Level faders, Tune/Decay/Tone knobs, M/S and Sample access. These controls share the exact same state as the lane controls. Multiple solos are supported and mute takes priority. Per-voice audio buses apply smoothly ramped level/mute/solo changes to already-ringing sounds as well as future hits. Offline renders retain the original direct sound path.

SONG opens an optional A–D arrangement. Select SONG playback, add pattern rows, set each row to 1–64 bars, and optionally enable LOOP SONG. A bar is sixteen steps on the existing tempo/swing clock. Pattern mode remains the default. Arrangements support up to 128 rows, reordering and removal. Stop or pause before editing; edits rewind the arrangement. Pause/Play resumes, Stop rewinds, and a non-looping song ends at its exact audio-clock boundary while allowing existing tails to decay. A fresh Play then restarts it. Independent lane phase continues across pattern changes and song loops; selecting a new pattern does not reset a seven- or twelve-step lane. Fill uses the same global bar clock. No second swing calculation is applied.

SAVE exports the legacy version-1 pattern document with an additional validated `arrangement` object (mode, loop flag, stable row IDs, A–D references and bar counts). LOAD accepts both this extension and older pattern-only files. Old files default to PATTERN mode. Invalid imports leave current patterns and arrangement intact. Save/Load does not start playback. RESET ALL also clears the arrangement. Kit, mix and sample assets are still live state in this public branch; do not rely on these pattern exports as complete audio sessions.

This standalone public update is based on development. The unpublished MIDI/session review remains separate; its next integration must preserve this per-track presentation. Portable complete session storage remains in the separate MIDI review work; it has not been merged into this public interface update.

Validation commands (Vite running on port 5173):

- `npm run build` and `npm test`.
- `node tests/tracks.mjs`: all 36 independent bindings; actual per-voice gain routing; all nine dialogs; sample editing/preview; deterministic asynchronous load target test; tablet fit; no microphone requests.
- `node tests/fill.mjs`: tap one bar, hold/release outside the button, original pattern preservation and polymetric phase.
- `node tests/knobs.mjs`: all 36 track knobs plus Swing using browser touch events, scaling, pointer capture/cancel, wheel and keyboard.
- `node tests/mixer-song.mjs`: grid/control order, Mixer synchronization, grouped solos, nested Sample access, live tail gain/mute, song phase continuity, natural end, looping, pause/resume and pattern/song import/export.
- Existing browser, controls, factory-kit, viewport and cymbal tests remain regression checks. Physical tablet listening remains user validation.

Verification on 2026-11-09: production build and 11 unit tests passed. All nine browser suites passed (browser, controls, kits, viewport, cymbals, knobs, tracks, fill, mixer-song). Real browser audio analysis verified ringing-tail level changes and muting; touch events verified knob capture and fill cancellation. Screenshots were inspected at 1280 × 638. Browser emulation does not replace listening and touch checks on the user's physical tablet.
