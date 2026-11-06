# Cymbal sound revision

All five synthesized cymbals now use a broadband, diffused noise wash instead of a sustained square-wave bank. Two smooth low-pass stages reduce brittle highs; a gentle high-pass removes rumble. A softened attack and one long envelope replace the previous doubled decay. Cymbals bypass kit saturation; other voices keep their original synthesis paths.

Default full envelope lengths (Decay at 0.4): DS-9 Original / DEEP 08 ≈3.08 s, MEMORY 88 ≈2.2 s, DRIVE 09 ≈3.52 s, RHYTHM 55 ≈2.53 s. Decay extends or shortens these; Tune shifts the wash's spectral colour, and Tone adjusts brightness. The last part of the envelope is a quiet fade, not a constant-level sustain. Noise excitation is shared per audio context/kit to avoid allocating a long buffer for every overlapping hit. No third-party recordings are used.

Imported samples keep their original playback envelopes. The other eight voices, hi-hat choke rules, interface and sequencer are unchanged.

Validation: TypeScript/Vite build and unit tests pass. `node tests/cymbals.mjs` renders before/after spectra, measures tail energy and default peak levels, checks Decay/Tone and 44.1 kHz extremes, and compares the other voices and imported sample playback with a 1e-5 float tolerance. It reconstructs comparison fixtures from Git revision `2290b4e`; that revision must be available in local history. Run against Vite on port 5173. Factory-kit regression tests also pass. Sound quality remains subject to user listening feedback.
