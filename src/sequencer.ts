import { interval, position, type Lane, type Voice } from "./state";
import { Engine } from "./audio";
/** Integration boundary: time is AudioContext seconds; no GMC dependency. */
export interface TransportEvent {
  type: "start" | "pause" | "stop" | "trigger";
  time: number;
  lane?: number;
  step?: number;
}
export class Sequencer {
  tick = 0;
  next = 0;
  queued: { tick: number; time: number }[] = [];
  timer?: ReturnType<typeof setInterval>;
  bpm = 120;
  swing = 0;
  onEvent = (e: TransportEvent) => {};
  constructor(
    public engine: Engine,
    public pattern: () => Lane[],
    public voices: Voice[],
    public muted: boolean[],
  ) {}
  async play() {
    await this.engine.unlock();
    if (this.timer) return;
    this.next = this.engine.context!.currentTime + 0.05;
    this.onEvent({ type: "start", time: this.next });
    this.timer = setInterval(() => this.schedule(), 20);
  }
  schedule() {
    const c = this.engine.context!;
    while (this.next < c.currentTime + 0.12) {
      const t = this.next;
      this.queued = this.queued.filter((q) => q.time >= c.currentTime);
      this.queued.push({ tick: this.tick, time: t });
      this.pattern().forEach((l, i) => {
        const step = position(this.tick, l.length);
        if (l.steps[step] && !this.muted[i])
          this.engine.trigger(i, l.steps[step], t, this.voices[i]);
        this.onEvent({ type: "trigger", time: t, lane: i, step });
      });
      this.next += interval(this.tick, this.bpm, this.swing);
      this.tick++;
    }
  }
  pause() {
    const pending = this.queued.find(
      (q) => q.time > (this.engine.context?.currentTime ?? 0),
    );
    if (pending) this.tick = pending.tick;
    this.queued = [];
    this.engine.silence();
    clearInterval(this.timer);
    this.timer = undefined;
    this.onEvent({
      type: "pause",
      time: this.engine.context?.currentTime ?? 0,
    });
  }
  stop() {
    this.pause();
    this.tick = 0;
    this.onEvent({ type: "stop", time: this.engine.context?.currentTime ?? 0 });
  }
}
