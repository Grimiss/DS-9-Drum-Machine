import {
  newClip,
  quantizeBeat,
  wrapBeat,
  type MidiClip,
  type Quantize,
  type TriggerEvent,
} from "./contract.ts";
const copy = <T>(v: T): T => structuredClone(v);
export class ClipStore {
  clips: MidiClip[];
  constructor(count = 4) {
    this.clips = Array.from({ length: count }, newClip);
  }
  private undoStack: MidiClip[][] = [];
  private redoStack: MidiClip[][] = [];
  private before?: MidiClip[];
  onChange = () => {};
  begin() {
    this.before ??= copy(this.clips);
  }
  commit() {
    if (
      this.before &&
      JSON.stringify(this.before) !== JSON.stringify(this.clips)
    ) {
      this.undoStack.push(this.before);
      this.undoStack = this.undoStack.slice(-100);
      this.redoStack = [];
    }
    this.before = undefined;
    this.onChange();
  }
  undo() {
    this.commit();
    const previous = this.undoStack.pop();
    if (previous) {
      this.redoStack.push(copy(this.clips));
      this.clips = previous;
      this.onChange();
    }
  }
  redo() {
    const next = this.redoStack.pop();
    if (next) {
      this.undoStack.push(copy(this.clips));
      this.clips = next;
      this.onChange();
    }
  }
  replace(clips: MidiClip[]) {
    this.clips = copy(clips);
    this.undoStack = [];
    this.redoStack = [];
    this.before = undefined;
    this.onChange();
  }
  add(
    slot: number,
    assignmentId: string,
    beat: number,
    velocity: number,
    q: Quantize,
  ): TriggerEvent | undefined {
    const clip = this.clips[slot],
      positionBeats = wrapBeat(quantizeBeat(beat, q), clip.lengthBeats);
    if (
      clip.events.some(
        (e) =>
          e.assignmentId === assignmentId && e.positionBeats === positionBeats,
      )
    )
      return;
    const e = {
      id: crypto.randomUUID(),
      assignmentId,
      positionBeats,
      velocity: Math.max(0.01, Math.min(1, velocity)),
    };
    clip.events.push(e);
    return e;
  }
  remove(slot: number, id: string) {
    this.clips[slot].events = this.clips[slot].events.filter(
      (e) => e.id !== id,
    );
  }
  move(
    slot: number,
    id: string,
    assignmentId: string,
    beat: number,
    q: Quantize,
  ) {
    const clip = this.clips[slot],
      event = clip.events.find((e) => e.id === id);
    if (!event) return;
    const p = wrapBeat(quantizeBeat(beat, q), clip.lengthBeats);
    if (
      clip.events.some(
        (e) =>
          e.id !== id &&
          e.assignmentId === assignmentId &&
          e.positionBeats === p,
      )
    )
      return;
    Object.assign(event, { assignmentId, positionBeats: p });
  }
  length(slot: number, length: number) {
    this.begin();
    const clip = this.clips[slot];
    clip.lengthBeats = length;
    clip.events = clip.events.filter((e) => e.positionBeats < length);
    this.commit();
  }
}
