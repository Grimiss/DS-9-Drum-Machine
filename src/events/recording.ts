import type { Assignment, Quantize } from "./contract.ts";
import type { ClipStore } from "./clip-store";
export class Recorder {
  armed = false;
  quantize: Quantize = 4;
  slot?: number;
  private store: ClipStore;
  private getSlot: () => number;
  constructor(store: ClipStore, getSlot: () => number) {
    this.store = store;
    this.getSlot = getSlot;
  }
  start() {
    if (this.armed) return;
    this.armed = true;
    this.slot = this.getSlot();
    this.store.begin();
  }
  stop() {
    if (!this.armed) return;
    this.armed = false;
    this.slot = undefined;
    this.store.commit();
  }
  record(assignment: Assignment, beat: number, velocity: number) {
    if (!this.armed) return;
    return this.store.add(
      this.slot!,
      assignment.id,
      beat,
      velocity,
      this.quantize,
    );
  }
}
/** Translate Web MIDI performance timestamps to the same local audio clock as playback. */
export const midiAudioTime = (
  receivedTime: number,
  performanceNow: number,
  audioNow: number,
) => audioNow + (receivedTime - performanceNow) / 1000;
export function midiNote(data: ArrayLike<number>, assignments: Assignment[]) {
  if (data.length < 3 || (data[0] & 0xf0) !== 0x90 || data[2] === 0) return;
  const assignment = assignments.find((a) => a.note === data[1]);
  if (assignment) return { assignment, velocity: data[2] / 127 };
}
