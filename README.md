# GRIMISS DS-9

First playable browser version of the nine-voice drum machine. TypeScript, Vite, native Web Audio; no UI framework. Work is on `development`.

## Run

Node 24 (Node 22.18+ also supports the state test command), npm, and a modern desktop browser.

```sh
npm ci
npm run dev
npm run build
npm test
```

For browser integration tests, start Vite on port 5173, install Chromium, and run `node tests/browser.mjs`. The test uses `/usr/bin/chromium`. It writes `docs/DS-9-screenshot.png`.

## Playing

Click Play to unlock browser audio and start the demo in A. Click a voice name to select and audition it. Each lane has its own Level, Tune, Decay and Tone knobs after the sixteen-step grid. Steps toggle off/on; hats cycle off/closed/open. M and S buttons precede the lane names. M lights red when muted; S lights green when soloed. Multiple solos form a group; mute takes priority. SET LENGTH enables choosing a lane's final step. Length displays also increment on click and decrement on right click. Each lane wraps independently. Pause preserves the next position; Stop returns the clock to zero and silences scheduled voices.

A–D retain separate steps and lengths in memory. COPY/PASTE copies a pattern; CLEAR clears the current slot; RESET ALL clears all four. SAVE/LOAD exports/imports the four patterns and Song arrangement as JSON. Older pattern-only files remain supported. Reloading the page restores the demo, so save work before closing.

Voice LEVEL, TUNE, DECAY, TONE control DSP. Knobs are accessible range inputs: drag up/down or left/right, use the mouse wheel, or use arrow keys while focused. Click the lane’s SAMPLE button to open its file-loading/editing dialog, then LOAD audio (up to ten seconds). PREVIEW auditions that instrument. No microphone recording is enabled. START/END, PITCH and REV edit playback without modifying the imported file. TRIM crops the selected region in memory. Keep START below END. CLOSED/OPEN audition the two hi-hat articulations; subsequent hats choke the preceding hat.

## Architecture

- `src/state.ts`: pattern memory, voice settings, polymetric positions and swing intervals.
- `src/audio.ts`: oscillator/noise drum synthesis, sample playback, output gain and compressor.
- `src/sequencer.ts`: 20 ms lookahead scheduler; notes scheduled on AudioContext time, with a 120 ms horizon, independent of rendering.
- `src/main.ts`: hardware controls and UI bindings.
- `src/style.css`: fixed 1754 × 886 chassis, uniformly scaled to the viewport.

`Sequencer.onEvent` is the future GMC boundary: start/pause/stop and lane/step events carry AudioContext timestamps. A future adapter can translate these without importing the GMC repository. LINK, LAYER, REPLACE and recording are explicitly disabled. The UI's ALT legend describes a future articulation; this version implements only off/closed/open.

See [geometry](docs/GEOMETRY.md), [implementation report](docs/IMPLEMENTATION.md) and [screenshot](docs/DS-9-screenshot.png).

## Updated performance controls

Click and hold over the step grid, then drag across pads to toggle each visited pad once per gesture. Hi-hats retain the off/closed/open cycle. Thin white lines separate groups of four steps. Mouse-wheel up increases and down decreases knobs/ranges and tempo, clamped to their limits. Space toggles play/pause outside input fields, without restarting the position; Stop still resets. Mute/solo are live performance state and are not included in pattern files.

Run `node tests/controls.mjs` against the development server for the performance-control regression suite. See [sample-kit licensing research](docs/SAMPLE-KITS.md) before adding third-party factory kits.

## Original factory kits

Use **FACTORY KIT** in the upper-right header. The default remains **DS-9 ORIGINAL**. Four additional banks use original synthesis, without third-party recordings:

| Bank | General inspiration | Character |
|---|---|---|
| MEMORY 88 | Sound Master Memory Rhythm SR-88 | Short rounded kick, papery snare, fizzy hats, woody percussion |
| DEEP 08 | Roland TR-808 | Long sub kick, airy noise snare, resonant toms, cowbell-like percussion |
| DRIVE 09 | Roland TR-909 | Punchy kick with attack noise, bright snare, sharper clap and sizzling hats |
| RHYTHM 55 | Korg KR-55 | Warm compact rhythm-box voices, softer snare and dry woodblock |

These are stylistic approximations mapped to DS-9's nine tracks, not circuit models, factory recordings or manufacturer-endorsed products. Every track has a functional synthesis voice; the combined hat has both closed and open articulations with the existing choke behaviour.

Kit changes keep steps, lengths, slots, tempo, swing, levels, mute/solo states and imported sample buffers. They switch all voices to ANALOG and reset Tune/Decay/Tone to neutral. Select SAMPLE again to use a retained imported sound. Kit choice and edits are currently not saved in pattern JSON; reload restores DS-9 ORIGINAL. Run `node tests/kits.mjs` against Vite for 36-voice offline rendering, articulation, parameter and kit-switch checks.

The synthesized cymbals now use a softer, longer noise wash across all kits. See [cymbal sound revision](docs/CYMBAL-UPDATE.md) for decay ranges and comparison tests. Other drums and imported samples retain their existing sound paths.

Knobs use relative mouse, pen or finger dragging without jumping on touch. Up/right increases and down/left decreases; Shift slows mouse adjustment. Pointer capture keeps dragging active beyond the control. Touch sensitivity uses screen pixels, independent of canvas scaling. A temporary percentage readout appears during adjustment. Run `node tests/knobs.mjs` against Vite to validate actual touch events and the existing input methods.

## Track controls and fills

Each instrument has four live knobs after its step grid and its own Sample editor button. MIXER opens larger channel strips with level faders and the same sound controls, M/S and Sample access. Levels and mute/solo also affect already-ringing sounds. The full-width hardware grid preserves all sixteen steps and independent lane lengths. Sample windows retain each track’s own buffer/edit settings; they do not copy settings between instruments.

**FILL:** tap for a one-bar fill on an available bar boundary; hold for a temporary fill, then release to return. Fills honor mute/solo and do not rewrite stored patterns. Pause/Stop cancels the fill. See [track controls and fill notes](docs/TRACK-CONTROLS.md) for operation, persistence scope and tests.

## Song mode

Open SONG, select SONG playback, and build an ordered list of A–D patterns with a bar count for each row. LOOP SONG repeats the arrangement; otherwise playback ends after the last row and lets drum tails decay. PATTERN mode keeps the familiar selected-pattern loop. Lane lengths remain independent, continuing their phase across song rows and loops. Pause/Play resumes; Stop rewinds. Stop or pause before editing; arrangement edits rewind. SAVE includes the arrangement alongside A–D patterns. These files do not yet include live mixer settings, factory kit choice or imported sample assets.
