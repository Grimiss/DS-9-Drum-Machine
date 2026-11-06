# Instrument-independent event and transport contract — revision 1

Written before implementing the integration layer. DS-9, Microseq and GMC-9000 are separate standalone instruments. DM-848 is the eight-track host (tracks 1–4 tape loops; tracks 5–8 instruments or external audio). No runtime or source dependency on any other project is introduced. Only DS-9 is modified.

## Proposed reusable boundary

`src/events/contract.ts` defines stable instrument/voice/articulation IDs, velocity (0–1), musical positions in quarter-note beats (finite fractional values), clips with independent lengths, SEQ/MIDI/BOTH modes, FREE/SYNC clocks and host snapshots. Audio scheduling always uses AudioContext seconds, never animation frames. An adapter maps a future host clock to the local audio context; the contract carries an already-mapped local `audioTime`, absolute `positionBeats`, BPM, transport status, and swing ownership. Host snapshots are transport anchors, not MIDI clock bytes. A single clock conversion applies swing once to both event sources. FREE uses DS-9's transport. SYNC requires an attached host snapshot; absence is explicit and must not silently start a local master. A seek/discontinuity flushes old scheduled audio and reschedules from the supplied position.

`Sequencer.followHost(snapshot)` is the DS-9 adapter entry point. `disconnectHost()` stops SYNC without changing FREE settings. Host transport state is authoritative while synchronized; DS-9's local play/pause controls are disabled in SYNC. Host output routing, discovery, iframe messaging, security/origin checks, device permissions and latency calibration remain adapter responsibilities. Nothing attaches to a global Microseq object.

## Unverified assumptions

Other repositories were not inspected or modified. Their PPQ, event schema, transport/seek protocol, asset formats, AudioContext ownership, host embedding model, message authentication and clock-offset estimator are unknown. This is a versioned proposal plus local implementation, not a claim of tested cross-instrument interoperability. The host must periodically refresh anchors and flag discontinuities; independent contexts require measured timestamp translation. This phase does not implement a DM-848 connection or external MIDI output.

## DS-9 semantics

Nine voice IDs remain stable, with ten articulation rows (closed/open hats share voice `hat`). Default General MIDI note mappings are configurable, stored in sessions, and input-only. Labels derive from assignment names. A–D each hold separate step patterns and MIDI clips; a clip's loop is independent of every step lane's modulo length. Clip looping never resets step phases. MIDI REC is overdub while transport runs, monitoring live input once. Recorded events first join playback on their next clip occurrence, so lookahead cannot echo the monitored hit.

Recording and editing snap use OFF / quarter / eighth / sixteenth / thirty-second note divisions. OFF retains fractional musical positions. Quantization is explicit and undoable; editing can move notes with snap OFF. Each paint/erase/move/velocity gesture and recording pass is one undo transaction. Painting revisits a cell at most once; editor-generated same-articulation/onset collisions are not added. Imported/recorded intentionally offset flams remain distinct. BOTH merges only equal musical onsets for the same articulation, choosing the higher velocity, and gives simultaneous closed hats precedence over open hats. No near-hit tolerance suppresses flams. Mute/solo applies after source merge; sequencer output is never routed into the recorder.

## Persistence

Version 2 portable DS-9 JSON sessions embed planar Float32 PCM assets as base64 with sample rate/channel metadata. They preserve A–D steps/lengths, MIDI clips, kit/voice parameters, assignments/names/MIDI mapping, samples, mute/solo, FREE timing, clock selection and playback mode. Active host anchors and MIDI permissions are intentionally not serialized. Load validates everything before replacing running state. Legacy `{version:1,patterns}` files load with default additional state. The future shared library may replace the container with a binary archive while preserving semantic fields. No dependency on a Microseq persistence format is assumed.

## Validation gates

Round-trip sessions including stereo PCM and legacy migration; reject malformed/unbounded assets and nonfinite timing without modifying the current session. Test MIDI loops against 7/12-step lanes, swing round trips, exact collisions versus flams, input timestamps/velocity-zero messages, undo transactions, and host/free transport transitions. Browser tests cover painting, erasing, moving, velocity, record monitoring, reload and existing controls/audio. Real hardware MIDI input and actual DM-848 interoperability require separate integration testing.
