# GRIMISS DS-9

Standalone nine-voice drum machine. TypeScript, Vite, native Web Audio; no UI framework. MIDI/session work is on `feature/midi-editor` for review; it is not published.

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

Click Play to unlock browser audio and start the demo in A. Click a voice name to select and audition it. Steps toggle off/on; hats cycle off/closed/open. M and S buttons precede the lane names. M lights red when muted; S lights green when soloed. Multiple solos form a group; mute takes priority. SET LENGTH enables choosing a lane's final step. Length displays also increment on click and decrement on right click. Each lane wraps independently. Pause preserves the next position; Stop returns the clock to zero and silences scheduled voices.

A–D retain separate step patterns and MIDI clips. Existing COPY/PASTE/CLEAR operate on step patterns; MIDI editing has its own undo/redo and delete controls. RESET ALL clears all step patterns and MIDI clips. SAVE/LOAD now exports/imports complete version-2 sessions, including embedded audio. Legacy version-1 pattern files still load. Reloading otherwise restores the demo, so save before closing.

Voice LEVEL, TUNE, DECAY, TONE control DSP. Knobs are accessible range inputs: drag horizontally or use arrow keys while focused. Select SAMPLE and LOAD audio (up to ten seconds) for the selected voice. START/END, PITCH and REV edit playback without modifying the imported file. TRIM crops the selected region in memory. Keep START below END. CLOSED/OPEN audition the two hi-hat articulations; subsequent hats choke the preceding hat.

## Architecture

- `src/state.ts`: pattern memory, voice settings, polymetric positions and swing intervals.
- `src/audio.ts`: oscillator/noise drum synthesis, sample playback, output gain and compressor.
- `src/sequencer.ts`: 20 ms lookahead scheduler; notes scheduled on AudioContext time, with a 120 ms horizon, independent of rendering.
- `src/main.ts`: hardware controls and UI bindings.
- `src/style.css`: fixed 1754 × 886 chassis, uniformly scaled to the viewport.

`Sequencer.onEvent` is the future GMC boundary: start/pause/stop and lane/step events carry AudioContext timestamps. A future adapter can translate these without importing the GMC repository. LINK, LAYER and REPLACE remain disabled. MIDI REC records live input; step-sequencer output is never captured. The UI's ALT legend describes a future articulation; this version implements only off/closed/open.

See [geometry](docs/GEOMETRY.md), [implementation report](docs/IMPLEMENTATION.md) and [screenshot](docs/DS-9-screenshot.png).

## Updated performance controls

Click and hold over the step grid, then drag across pads to toggle each visited pad once per gesture. Hi-hats retain the off/closed/open cycle. Thin white lines separate groups of four steps. Mouse-wheel up increases and down decreases knobs/ranges and tempo, clamped to their limits. Space toggles play/pause outside input fields, without restarting the position; Stop still resets. Mute/solo are included in complete sessions.

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

Kit changes keep steps, lengths, slots, tempo, swing, levels, mute/solo states and imported sample buffers. They switch all voices to ANALOG and reset Tune/Decay/Tone to neutral. Select SAMPLE again to use a retained imported sound. Kit choice and edits are included in complete sessions; an unsaved reload restores DS-9 ORIGINAL. Run `node tests/kits.mjs` against Vite for 36-voice offline rendering, articulation, parameter and kit-switch checks.

## MIDI recording and named-lane editing

DS-9 is independent of Microseq and GMC-9000. DM-848 is the future host, not Microseq. The reusable event library is under `src/events`; assumptions and integration interfaces were documented before implementation in [MIDI-CONTRACT.md](docs/MIDI-CONTRACT.md).

Click **MIDI EDIT** in the hardware header. The optional overlay has ten articulation rows backed by nine voices: separate Closed Hat/Open Hat rows share the hi-hat voice and choke behaviour. Click row labels to audition, double-click to rename, and edit the input MIDI note beside each label. Sample assignments use their sample names; changing back to analog/factory kits restores the factory voice labels. Notes retain stable assignment IDs.

- Choose **SEQ**, **MIDI** or **BOTH**. Source data stays separate. BOTH merges exact simultaneous duplicates and gives closed hats precedence over simultaneous open hats; intentional offsets and flams remain.
- Click **MIDI REC** to start live overdubbing (it starts FREE playback if stopped); click again, Pause or Stop to commit the pass. Play voice names on the hardware or row labels in the editor. To hear the recorded clip on following loops, select MIDI/BOTH. Monitoring sounds once and does not feed back into recording.
- For hardware input, click **CONNECT MIDI INPUT**, grant the browser permission, then select a device. Chrome/Edge over HTTPS or localhost are recommended. Input note-ons on all channels use editable General MIDI drum mappings by default. Velocity-zero notes and note-offs are ignored for one-shot recording. No MIDI output is opened. Device permissions cannot be saved; reconnect explicitly after a reload.
- **CLIP BEATS** sets each slot's MIDI loop independently (0.25–256 quarter-note beats). It never changes the step lane lengths or resets their phases.
- Click/drag empty cells to paint; Ctrl-click/drag to erase; drag a trigger to move it. Select a trigger to edit its exact beat position and velocity. The position inspector permits corrections without snap. Painting visits each cell once per gesture; separate off-grid clicks may form flams.
- SNAP / RECORD offers OFF, 1/4, 1/8, 1/16 and 1/32. OFF retains fractional positions; QUANTIZE CLIP is an explicit undoable operation. The current control links editing snap and recording quantization.
- UNDO/REDO (Ctrl-Z / Ctrl-Shift-Z outside inputs) treats each gesture or recording pass as one transaction. Editing/slot changes commit and stop an active recording pass safely.
- **FREE** uses DS-9's own BPM/swing/audio clock. **SYNC** requires a host adapter and explicitly waits without a host; it disables local transport/tempo controls. This build has no live DM-848 connection. Loading a SYNC session also waits for a new host clock; host anchors are not saved.

Save sessions with the existing SAVE button. They include A–D steps/lengths/clips, assignments and note mapping, kit/voice settings, PCM sample assets, tempo/swing, clock/playback mode, quantization, device selection and mute/solo. Samples are limited to ten seconds, eight channels, 192 kHz, with 64 MiB total decoded assets; input JSON is limited to 100 MiB. Session loading validates/prepares everything before changing running state. No automatic cloud upload or autosave is added.

Run `node tests/scheduler.mjs` and `node tests/midi.mjs` against the development server for timing, recording, editor and full-session regression tests. See [the implementation review](docs/MIDI-IMPLEMENTATION.md) and [editor screenshot](docs/MIDI-editor-screenshot.png).

The synthesized cymbals now use a softer, longer noise wash across all kits. See [cymbal sound revision](docs/CYMBAL-UPDATE.md) for decay ranges and comparison tests. Other drums and imported samples retain their existing sound paths.
