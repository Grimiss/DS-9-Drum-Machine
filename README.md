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

Click Play to unlock browser audio and start the demo in A. Click a voice name to select and audition it. Steps toggle off/on; hats cycle off/closed/open. Mute buttons precede the lane names. SET LENGTH enables choosing a lane's final step. Length displays also increment on click and decrement on right click. Each lane wraps independently. Pause preserves the next position; Stop returns the clock to zero and silences scheduled voices.

A–D retain separate steps and lengths in memory. COPY/PASTE copies a pattern; CLEAR clears the current slot; RESET ALL clears all four. SAVE/LOAD exports/imports the four patterns as JSON. Reloading the page restores the demo, so save work before closing.

Voice LEVEL, TUNE, DECAY, TONE control DSP. Knobs are accessible range inputs: drag horizontally or use arrow keys while focused. Select SAMPLE and LOAD audio (up to ten seconds) for the selected voice. START/END, PITCH and REV edit playback without modifying the imported file. TRIM crops the selected region in memory. Keep START below END. CLOSED/OPEN audition the two hi-hat articulations; subsequent hats choke the preceding hat.

## Architecture

- `src/state.ts`: pattern memory, voice settings, polymetric positions and swing intervals.
- `src/audio.ts`: oscillator/noise drum synthesis, sample playback, output gain and compressor.
- `src/sequencer.ts`: 20 ms lookahead scheduler; notes scheduled on AudioContext time, with a 120 ms horizon, independent of rendering.
- `src/main.ts`: hardware controls and UI bindings.
- `src/style.css`: fixed 1754 × 886 chassis, uniformly scaled to the viewport.

`Sequencer.onEvent` is the future GMC boundary: start/pause/stop and lane/step events carry AudioContext timestamps. A future adapter can translate these without importing the GMC repository. LINK, LAYER, REPLACE and recording are explicitly disabled. The UI's ALT legend describes a future articulation; this version implements only off/closed/open.

See [geometry](docs/GEOMETRY.md), [implementation report](docs/IMPLEMENTATION.md) and [screenshot](docs/DS-9-screenshot.png).
