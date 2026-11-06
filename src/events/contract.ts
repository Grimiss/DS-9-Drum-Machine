/** Portable proposal: no instrument/application/runtime imports. Quarter-note beats. */
export const EVENT_CONTRACT_VERSION = 1;
export type PlaybackMode = "SEQ" | "MIDI" | "BOTH";
export type ClockMode = "FREE" | "SYNC";
export type Quantize = 0 | 1 | 2 | 4 | 8; // subdivisions of a quarter note
export type TriggerEvent = {
  id: string;
  assignmentId: string;
  positionBeats: number;
  velocity: number;
};
export type MidiClip = { lengthBeats: number; events: TriggerEvent[] };
export type Assignment = {
  id: string;
  voice: number;
  articulation: number;
  name: string;
  note: number;
};
export type HostClockSnapshot = {
  version: 1;
  audioTime: number;
  positionBeats: number;
  bpm: number;
  playing: boolean;
  swing: number;
  discontinuity?: boolean;
};
export type ScheduledTrigger = {
  beat: number;
  assignmentId: string;
  velocity: number;
  source: "SEQ" | "MIDI";
};
export const newClip = (): MidiClip => ({ lengthBeats: 4, events: [] });
export const quantizeBeat = (beat: number, q: Quantize) =>
  q ? Math.round(beat * q) / q : beat;
export const wrapBeat = (beat: number, length: number) =>
  ((beat % length) + length) % length;
/** Musical swing warping is owned here; sources must not apply it separately. */
export function swingBeat(beat: number, swing: number) {
  const pair = Math.floor(beat / 0.5) * 0.5,
    p = beat - pair;
  return (
    pair +
    (p <= 0.25
      ? p * (1 + swing)
      : 0.25 * (1 + swing) + (p - 0.25) * (1 - swing))
  );
}
export function unswingBeat(beat: number, swing: number) {
  const pair = Math.floor(beat / 0.5) * 0.5,
    p = beat - pair,
    edge = 0.25 * (1 + swing);
  return pair + (p <= edge ? p / (1 + swing) : 0.25 + (p - edge) / (1 - swing));
}
export function mergeTriggers(events: ScheduledTrigger[]): ScheduledTrigger[] {
  const unique = new Map<string, ScheduledTrigger>();
  for (const e of events) {
    const key = `${e.beat}:${e.assignmentId}`;
    const old = unique.get(key);
    if (!old || e.velocity > old.velocity) unique.set(key, e);
  }
  return [...unique.values()].sort((a, b) => a.beat - b.beat);
}
