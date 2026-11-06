import { swingBeat, unswingBeat, type MidiClip } from "./contract.ts";
export type ClockAnchor = {
  audioTime: number;
  positionBeats: number;
  bpm: number;
  swing: number;
};
export const audioTimeForBeat = (beat: number, a: ClockAnchor) =>
  a.audioTime +
  ((swingBeat(beat, a.swing) - swingBeat(a.positionBeats, a.swing)) * 60) /
    a.bpm;
export const beatForAudioTime = (time: number, a: ClockAnchor) =>
  unswingBeat(
    swingBeat(a.positionBeats, a.swing) + ((time - a.audioTime) * a.bpm) / 60,
    a.swing,
  );
/** Half-open windows prevent duplicates between lookahead batches. No timing tolerance. */
export function* clipOccurrences(clip: MidiClip, from: number, to: number) {
  for (
    let loop = Math.floor(from / clip.lengthBeats);
    loop * clip.lengthBeats < to;
    loop++
  )
    for (const event of clip.events) {
      const beat = loop * clip.lengthBeats + event.positionBeats;
      if (beat >= from && beat < to) yield { event, beat };
    }
}
