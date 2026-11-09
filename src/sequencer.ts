import { FillState } from "./fill";
import { interval, position, isAudible, type Lane, type Voice } from "./state";
import { Engine } from "./audio";
/** Integration boundary: time is AudioContext seconds; no GMC dependency. */
export interface TransportEvent {
  type: "start" | "pause" | "stop" | "trigger" | "end";
  time: number;
  lane?: number;
  step?: number;
  tick?: number;
  generation?: number;
}
export class Sequencer {
  fill = new FillState();
  patternAtTick?: (tick: number) => Lane[] | null;
  generation = 0;
  private endTimer?: ReturnType<typeof setTimeout>;
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
    public solo: boolean[] = [],
  ) {}
  async play() {
    await this.engine.unlock();
    if (this.timer) return;
    this.next = this.engine.context!.currentTime + 0.05;
    this.generation++;
    this.timer = setInterval(() => this.schedule(), 20);
    this.onEvent({ type: "start", time: this.next });
  }
  schedule() {
    const c = this.engine.context!;
    if (this.endTimer) return;
    while (this.next < c.currentTime + 0.12) {
      const t = this.next;
      this.queued = this.queued.filter((q) => q.time >= c.currentTime);
      this.queued.push({ tick: this.tick, time: t });
      const pattern = this.patternAtTick
        ? this.patternAtTick(this.tick)
        : this.pattern();
      if (!pattern) {
        this.endTimer = setTimeout(
          () => {
            clearInterval(this.timer);
            this.timer = undefined;
            this.endTimer = undefined;
            this.tick = 0;
            this.queued = [];
            this.fill.reset();
            this.generation++;
            this.onEvent({ type: "end", time: t });
          },
          Math.max(0, (t - c.currentTime) * 1000),
        );
        return;
      }
      pattern.forEach((l, i) => {
        const step = position(this.tick, l.length);
        const state = this.fill.step(i, l.steps[step], this.tick);
        if (state && isAudible(i, this.muted, this.solo))
          this.engine.trigger(i, state, t, this.voices[i]);
        this.onEvent({
          type: "trigger",
          time: t,
          lane: i,
          step,
          tick: this.tick,
          generation: this.generation,
        });
      });
      this.next += interval(this.tick, this.bpm, this.swing);
      this.tick++;
    }
  }
  pause() {
    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = undefined;
    }
    this.generation++;
    this.fill.reset();
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
