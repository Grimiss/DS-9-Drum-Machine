import {
  defaultAssignments,
  resolveDrumTriggers,
} from "../src/drum-assignments.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quantizeBeat,
  swingBeat,
  unswingBeat,
  newClip,
} from "../src/events/contract.ts";
import { ClipStore } from "../src/events/clip-store.ts";
import { Recorder, midiNote, midiAudioTime } from "../src/events/recording.ts";
import { validateSession, packVoices, restoreVoices } from "../src/session.ts";
import { emptyPattern } from "../src/state.ts";
test("swing belongs to one clock and round trips fractional beats", () => {
  for (const swing of [0, 0.3, 0.65])
    for (const beat of [0, 0.125, 0.25, 0.49, 0.5, 7.123])
      assert.ok(
        Math.abs(unswingBeat(swingBeat(beat, swing), swing) - beat) < 1e-10,
      );
});
test("exact duplicates merge but flams remain; closed beats simultaneous open hat", () => {
  const a = defaultAssignments(),
    events = [
      { beat: 0, assignmentId: "kick", velocity: 0.3, source: "SEQ" as const },
      { beat: 0, assignmentId: "kick", velocity: 0.9, source: "MIDI" as const },
      {
        beat: 0.00001,
        assignmentId: "kick",
        velocity: 0.8,
        source: "MIDI" as const,
      },
      {
        beat: 1,
        assignmentId: "closed-hat",
        velocity: 1,
        source: "SEQ" as const,
      },
      {
        beat: 1,
        assignmentId: "open-hat",
        velocity: 1,
        source: "MIDI" as const,
      },
    ];
  const out = resolveDrumTriggers(events, a);
  assert.equal(out.length, 3);
  assert.equal(out[0].velocity, 0.9);
  assert.equal(out[1].beat, 0.00001);
  assert.equal(out[2].assignmentId, "closed-hat");
});
test("record quantization, clip wrapping and transactional undo/redo", () => {
  const s = new ClipStore(),
    r = new Recorder(s, () => 0);
  r.quantize = 0;
  r.start();
  r.record(defaultAssignments()[0], 4.123, 0.7);
  r.record(defaultAssignments()[0], 4.124, 0.5);
  r.stop();
  assert.equal(s.clips[0].events.length, 2);
  assert.ok(Math.abs(s.clips[0].events[0].positionBeats - 0.123) < 1e-10);
  s.undo();
  assert.equal(s.clips[0].events.length, 0);
  s.redo();
  assert.equal(s.clips[0].events.length, 2);
  s.begin();
  s.add(0, "snare", 1.13, 0.8, 4);
  s.add(0, "snare", 1.13, 0.8, 4);
  s.commit();
  assert.equal(s.clips[0].events.length, 3);
  assert.equal(s.clips[0].events[2].positionBeats, 1.25);
  assert.equal(quantizeBeat(0.37, 8), 0.375);
});
test("MIDI input ignores note-offs, zero velocities and unrelated data", () => {
  const a = defaultAssignments();
  assert.equal(midiNote([0x90, 36, 127], a)?.velocity, 1);
  assert.equal(midiNote([0x91, 46, 64], a)?.assignment.id, "open-hat");
  for (const data of [[0x90, 36, 0], [0x80, 36, 127], [0xb0, 36, 127], []])
    assert.equal(midiNote(data, a), undefined);
  assert.equal(midiAudioTime(1200, 1000, 5), 5.2);
});
function legacy() {
  return { version: 1, patterns: Array.from({ length: 4 }, emptyPattern) };
}
test("legacy patterns migrate; session round-trip includes stereo PCM and sound settings", () => {
  const base = validateSession(legacy());
  base.kit = "sr88";
  base.clock = "SYNC";
  base.playback = "BOTH";
  base.patterns[0][0].length = 7;
  base.patterns[0][1].length = 12;
  base.clips[0] = {
    lengthBeats: 9,
    events: [
      { id: "flam", assignmentId: "kick", positionBeats: 0.001, velocity: 0.6 },
    ],
  };
  const channels = [
    new Float32Array([0, 0.5, -0.25, 1]),
    new Float32Array([1, -0.5, 0.2, 0]),
  ];
  const fake = {
    sampleRate: 48000,
    length: 4,
    numberOfChannels: 2,
    getChannelData: (n: number) => channels[n],
  } as AudioBuffer;
  const runtime = base.voices.map((v) => ({
    ...v,
    sample: undefined as AudioBuffer | undefined,
  }));
  runtime[0].sample = fake;
  runtime[0].mode = "sample";
  runtime[0].tone = 0.17;
  Object.assign(base, packVoices(runtime));
  const saved = validateSession(JSON.parse(JSON.stringify(base)));
  const context = {
    createBuffer: (count: number, length: number, rate: number) => {
      const data = Array.from(
        { length: count },
        () => new Float32Array(length),
      );
      return {
        numberOfChannels: count,
        length,
        sampleRate: rate,
        getChannelData: (n: number) => data[n],
      };
    },
  } as BaseAudioContext;
  const restored = restoreVoices(saved, context);
  assert.deepEqual(restored[0].sample!.getChannelData(1), channels[1]);
  assert.equal(restored[0].tone, 0.17);
  assert.equal(saved.patterns[0][1].length, 12);
  assert.equal(saved.clips[0].lengthBeats, 9);
  assert.equal(saved.clock, "SYNC");
  assert.equal(saved.playback, "BOTH");
});
test("reject malformed sessions before application state changes", () => {
  for (const mutate of [
    (s: any) => (s.patterns[0][0].length = 0),
    (s: any) => (s.bpm = Infinity),
    (s: any) =>
      (s.clips[0].events = [
        { id: "x", assignmentId: "bad", velocity: 1, positionBeats: 0 },
      ]),
    (s: any) => (s.assignments[1].note = 36),
    (s: any) => (s.voices[0].assetId = "missing"),
    (s: any) => (s.voices[0].end = 0),
    (s: any) => (s.patterns[0] = null),
    (s: any) => (s.clips[0].lengthBeats = 0),
  ]) {
    const s = validateSession(legacy());
    mutate(s);
    assert.throws(() => validateSession(s));
  }
});

test("shared audio-time mapping and half-open independent clip windows", async () => {
  const { audioTimeForBeat, beatForAudioTime, clipOccurrences } = await import(
    "../src/events/timing.ts"
  );
  const a = { audioTime: 10, positionBeats: 3.2, bpm: 137, swing: 0.4 };
  for (const beat of [0, 3.2, 7.123, 19])
    assert.ok(
      Math.abs(beatForAudioTime(audioTimeForBeat(beat, a), a) - beat) < 1e-10,
    );
  const clip = {
    lengthBeats: 3,
    events: [
      { id: "a", assignmentId: "x", positionBeats: 0, velocity: 1 },
      { id: "b", assignmentId: "x", positionBeats: 0.005, velocity: 1 },
    ],
  };
  const events = [
    ...clipOccurrences(clip, 0, 3),
    ...clipOccurrences(clip, 3, 6),
  ];
  assert.deepEqual(
    events.map((e) => e.beat),
    [0, 0.005, 3, 3.005],
  );
});

test("legacy non-hat state 2 migrates to the equivalent audible on state", () => {
  const old = legacy();
  old.patterns[0][1].steps[0] = 2;
  assert.equal(validateSession(old).patterns[0][1].steps[0], 1);
});
