import { defaultAssignments } from "./drum-assignments.ts";
import {
  newClip,
  type Assignment,
  type MidiClip,
  type PlaybackMode,
  type ClockMode,
  type Quantize,
} from "./events/contract.ts";
import type { Lane, Voice } from "./state";
import type { KitId } from "./kits";
export type Asset = {
  id: string;
  sampleRate: number;
  length: number;
  channels: string[];
};
export type SavedVoice = Omit<Voice, "sample"> & { assetId?: string };
export type Session = {
  version: 2;
  patterns: Lane[][];
  clips: MidiClip[];
  assignments: Assignment[];
  voices: SavedVoice[];
  assets: Asset[];
  kit: KitId;
  bpm: number;
  swing: number;
  clock: ClockMode;
  playback: PlaybackMode;
  slot: number;
  muted: boolean[];
  solo: boolean[];
  quantize: Quantize;
  inputId: string;
};
function ensure(yes: unknown, message = "Invalid session"): asserts yes {
  if (!yes) throw Error(message);
}
const finite = (n: unknown, min: number, max: number) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const voiceDefaults = (): SavedVoice[] =>
  Array.from({ length: 9 }, () => ({
    level: 0.7,
    tune: 0.5,
    decay: 0.4,
    tone: 0.5,
    mode: "analog",
    start: 0,
    end: 1,
    pitch: 0.5,
    reverse: false,
  }));
export function validateSession(input: unknown): Session {
  ensure(record(input));
  const s = input as unknown as Session;
  ensure(
    (s.version as number) === 1 || s.version === 2,
    "Unsupported session version",
  );
  ensure(Array.isArray(s.patterns) && s.patterns.length === 4);
  ensure(
    s.patterns.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 9 &&
        p.every(
          (l, i) =>
            record(l) &&
            Number.isInteger(l.length) &&
            l.length >= 1 &&
            l.length <= 16 &&
            Array.isArray(l.steps) &&
            l.steps.length === 16 &&
            l.steps.every(
              (n) =>
                Number.isInteger(n) &&
                n >= 0 &&
                n <= ((s.version as number) === 1 || i === 5 ? 2 : 1),
            ),
        ),
    ),
  );
  if ((s.version as number) === 1)
    return validateSession({
      ...s,
      version: 2,
      patterns: s.patterns.map((p) =>
        p.map((l, i) => ({
          length: l.length,
          steps: l.steps.map((n) => (i === 5 ? n : n ? 1 : 0)),
        })),
      ),
      clips: Array.from({ length: 4 }, newClip),
      assignments: defaultAssignments(),
      voices: voiceDefaults(),
      assets: [],
      kit: "classic",
      bpm: 120,
      swing: 0,
      clock: "FREE",
      playback: "SEQ",
      slot: 0,
      muted: Array(9).fill(false),
      solo: Array(9).fill(false),
      quantize: 4,
      inputId: "",
    });
  ensure(["classic", "sr88", "808", "909", "kr55"].includes(s.kit));
  ensure(finite(s.bpm, 30, 300) && finite(s.swing, 0, 0.65));
  ensure(
    ["FREE", "SYNC"].includes(s.clock) &&
      ["SEQ", "MIDI", "BOTH"].includes(s.playback),
  );
  ensure(Number.isInteger(s.slot) && s.slot >= 0 && s.slot < 4);
  ensure([0, 1, 2, 4, 8].includes(s.quantize));
  ensure(typeof s.inputId === "string" && s.inputId.length <= 256);
  for (const key of ["muted", "solo"] as const)
    ensure(
      Array.isArray(s[key]) &&
        s[key].length === 9 &&
        s[key].every((v) => typeof v === "boolean"),
    );
  const expected = defaultAssignments();
  ensure(Array.isArray(s.assignments) && s.assignments.length === 10);
  ensure(
    s.assignments.every(
      (a, i) =>
        record(a) &&
        a.id === expected[i].id &&
        a.voice === expected[i].voice &&
        a.articulation === expected[i].articulation &&
        typeof a.name === "string" &&
        a.name.trim().length > 0 &&
        a.name.length <= 48 &&
        Number.isInteger(a.note) &&
        a.note >= 0 &&
        a.note <= 127,
    ),
  );
  ensure(
    new Set(s.assignments.map((a) => a.note)).size === 10,
    "MIDI note assignments must be unique",
  );
  const ids = new Set(s.assignments.map((a) => a.id));
  ensure(Array.isArray(s.clips) && s.clips.length === 4);
  for (const clip of s.clips) {
    ensure(
      record(clip) &&
        finite(clip.lengthBeats, 0.25, 256) &&
        Array.isArray(clip.events) &&
        clip.events.length <= 50000,
    );
    const eventIds = new Set<string>();
    for (const e of clip.events) {
      ensure(
        record(e) &&
          typeof e.id === "string" &&
          e.id.length > 0 &&
          e.id.length <= 100 &&
          !eventIds.has(e.id) &&
          ids.has(e.assignmentId) &&
          finite(e.positionBeats, 0, clip.lengthBeats) &&
          e.positionBeats < clip.lengthBeats &&
          finite(e.velocity, 0.001, 1),
      );
      eventIds.add(e.id);
    }
  }
  ensure(Array.isArray(s.assets) && s.assets.length <= 9);
  let bytes = 0;
  const assetIds = new Set<string>();
  for (const a of s.assets) {
    ensure(
      record(a) &&
        typeof a.id === "string" &&
        a.id.length <= 100 &&
        !assetIds.has(a.id) &&
        finite(a.sampleRate, 8000, 192000) &&
        Number.isInteger(a.length) &&
        a.length > 0 &&
        a.length <= a.sampleRate * 10 &&
        Array.isArray(a.channels) &&
        a.channels.length > 0 &&
        a.channels.length <= 8,
    );
    assetIds.add(a.id);
    for (const ch of a.channels) {
      ensure(
        typeof ch === "string" &&
          ch.length === 4 * Math.ceil((a.length * 4) / 3) &&
          /^[A-Za-z0-9+/]*={0,2}$/.test(ch),
      );
      bytes += a.length * 4;
      ensure(bytes <= 64 * 1024 * 1024, "Audio assets exceed 64 MiB");
    }
  }
  ensure(Array.isArray(s.voices) && s.voices.length === 9);
  for (const v of s.voices) {
    ensure(record(v));
    for (const k of [
      "level",
      "tune",
      "decay",
      "tone",
      "start",
      "end",
      "pitch",
    ] as const)
      ensure(finite(v[k], 0, 1));
    ensure(
      ["analog", "sample"].includes(v.mode) && typeof v.reverse === "boolean",
    );
    ensure(v.assetId === undefined || assetIds.has(v.assetId));
    ensure(
      v.sampleName === undefined ||
        (typeof v.sampleName === "string" && v.sampleName.length <= 80),
    );
    ensure(v.start < v.end, "Sample start must precede end");
  }
  return structuredClone(s);
}
function encode(data: Float32Array) {
  const bytes = new Uint8Array(data.length * 4),
    view = new DataView(bytes.buffer);
  for (let i = 0; i < data.length; i++) view.setFloat32(i * 4, data[i], true);
  let text = "";
  for (let i = 0; i < bytes.length; i += 32768)
    text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text);
}
export function packVoices(voices: Voice[]) {
  let size = 0;
  for (const v of voices) {
    if (v.sample) {
      ensure(
        v.sample.numberOfChannels <= 8 &&
          v.sample.sampleRate <= 192000 &&
          v.sample.length / v.sample.sampleRate <= 10,
        "Unsupported sample size",
      );
      size += v.sample.numberOfChannels * v.sample.length * 4;
    }
  }
  ensure(size <= 64 * 1024 * 1024, "Audio assets exceed 64 MiB");
  const assets: Asset[] = [];
  const saved = voices.map((v, i) => {
    const { sample, ...settings } = v;
    if (!sample) return settings;
    const id = `voice-${i}`;
    assets.push({
      id,
      sampleRate: sample.sampleRate,
      length: sample.length,
      channels: Array.from({ length: sample.numberOfChannels }, (_, ch) =>
        encode(sample.getChannelData(ch)),
      ),
    });
    return { ...settings, assetId: id };
  });
  return { voices: saved, assets };
}
/** Prepare every asset before touching the application; malformed audio cannot half-load. */
export function restoreVoices(
  session: Session,
  context: BaseAudioContext,
): Voice[] {
  const buffers = new Map<string, AudioBuffer>();
  for (const a of session.assets) {
    const b = context.createBuffer(a.channels.length, a.length, a.sampleRate);
    a.channels.forEach((ch, n) => {
      const raw = atob(ch);
      ensure(raw.length === a.length * 4);
      const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0)),
        view = new DataView(bytes.buffer),
        out = b.getChannelData(n);
      for (let i = 0; i < out.length; i++) {
        const f = view.getFloat32(i * 4, true);
        ensure(Number.isFinite(f), "Nonfinite sample data");
        out[i] = f;
      }
    });
    buffers.set(a.id, b);
  }
  return session.voices.map((v) => {
    const { assetId, ...settings } = v;
    return { ...settings, sample: assetId ? buffers.get(assetId) : undefined };
  });
}
