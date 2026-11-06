import {
  audioTimeForBeat,
  beatForAudioTime,
  clipOccurrences,
} from "./events/timing.ts";
import { defaultAssignments, resolveDrumTriggers } from "./drum-assignments.ts";
import { position, isAudible, type Lane, type Voice } from "./state";
import { Engine } from "./audio";
import {
  newClip,
  swingBeat,
  unswingBeat,
  type Assignment,
  type MidiClip,
  type PlaybackMode,
  type ClockMode,
  type HostClockSnapshot,
  type ScheduledTrigger,
} from "./events/contract";
export interface TransportEvent {
  type: "start" | "pause" | "stop" | "trigger";
  time: number;
  lane?: number;
  step?: number;
}
export class Sequencer {
  tick = 0;
  next = 0;
  timer?: ReturnType<typeof setInterval>;
  bpm = 120;
  swing = 0;
  mode: PlaybackMode = "SEQ";
  clockMode: ClockMode = "FREE";
  host?: HostClockSnapshot;
  assignments: () => Assignment[] = defaultAssignments;
  clip: () => MidiClip = newClip;
  onEvent = (e: TransportEvent) => {};
  private anchorTime = 0;
  private anchorBeat = 0;
  private cursor = 0;
  private pausedBeat = 0;
  private initialized = false;
  private generation = 0;
  private skipUntil = new Map<string, number>();
  constructor(
    public engine: Engine,
    public pattern: () => Lane[],
    public voices: Voice[],
    public muted: boolean[],
    public solo: boolean[] = [],
  ) {}
  private timing() {
    return this.clockMode === "SYNC" && this.host
      ? this.host
      : { bpm: this.bpm, swing: this.swing };
  }
  private clockAnchor() {
    return {
      audioTime: this.anchorTime,
      positionBeats: this.anchorBeat,
      ...this.timing(),
    };
  }
  beatAt(time: number) {
    return beatForAudioTime(time, this.clockAnchor());
  }
  timeAt(beat: number) {
    return audioTimeForBeat(beat, this.clockAnchor());
  }
  get positionBeats() {
    return this.timer
      ? this.engine.context!.currentTime < this.anchorTime
        ? this.anchorBeat
        : Math.max(0, this.beatAt(this.engine.context!.currentTime))
      : this.pausedBeat;
  }
  deferRecorded(id: string, untilBeat: number) {
    this.skipUntil.set(id, untilBeat);
  }
  async play() {
    if (this.clockMode === "SYNC") return;
    await this.engine.unlock();
    if (this.timer) return;
    this.start(this.pausedBeat, this.engine.context!.currentTime + 0.05);
  }
  private start(beat: number, time: number) {
    this.anchorBeat = beat;
    this.anchorTime = time;
    this.cursor = beat;
    this.next = time;
    this.initialized = true;
    this.generation++;
    this.onEvent({ type: "start", time });
    this.timer = setInterval(() => this.schedule(), 20);
  }
  /** Future DM-848 adapter calls with a validated anchor in DS-9 AudioContext seconds. */
  async followHost(snapshot: HostClockSnapshot) {
    if (
      snapshot.version !== 1 ||
      typeof snapshot.playing !== "boolean" ||
      (snapshot.discontinuity !== undefined &&
        typeof snapshot.discontinuity !== "boolean") ||
      ![
        snapshot.audioTime,
        snapshot.positionBeats,
        snapshot.bpm,
        snapshot.swing,
      ].every(Number.isFinite) ||
      snapshot.bpm < 30 ||
      snapshot.bpm > 300 ||
      snapshot.positionBeats < 0 ||
      snapshot.swing < 0 ||
      snapshot.swing > 0.65
    )
      throw Error("Invalid host clock");
    if (this.clockMode !== "SYNC") return;
    await this.engine.unlock();
    const now = this.engine.context!.currentTime;
    const previous = this.timer ? this.beatAt(now) : this.pausedBeat;
    const expected = unswingBeat(
      swingBeat(snapshot.positionBeats, snapshot.swing) +
        ((now - snapshot.audioTime) * snapshot.bpm) / 60,
      snapshot.swing,
    );
    const changed =
      !this.host ||
      snapshot.discontinuity ||
      !snapshot.playing ||
      !this.timer ||
      Math.abs(previous - expected) > 0.02 ||
      this.host.bpm !== snapshot.bpm ||
      this.host.swing !== snapshot.swing;
    this.host = { ...snapshot };
    if (snapshot.discontinuity) this.skipUntil.clear();
    if (changed) {
      this.pause();
      this.anchorBeat = snapshot.positionBeats;
      this.anchorTime = snapshot.audioTime;
      this.pausedBeat = Math.max(0, expected);
      if (snapshot.playing)
        this.start(
          snapshot.audioTime > now ? snapshot.positionBeats : this.pausedBeat,
          Math.max(now, snapshot.audioTime),
        );
    }
  }
  disconnectHost() {
    this.pause();
    this.host = undefined;
  }
  setTiming(bpm: number, swing: number) {
    const beat = this.positionBeats,
      playing = !!this.timer;
    this.pause();
    this.bpm = bpm;
    this.swing = swing;
    this.pausedBeat = beat;
    if (playing) this.start(beat, this.engine.context!.currentTime + 0.01);
  }
  reconfigure() {
    if (this.timer) {
      const beat = this.positionBeats;
      this.pause();
      this.start(beat, this.engine.context!.currentTime + 0.01);
    }
  }
  schedule() {
    const c = this.engine.context!;
    // Keep the existing direct scheduler-test entry point usable without starting a timer.
    if (!this.initialized) {
      this.anchorTime = this.next;
      this.anchorBeat = this.tick / 4;
      this.cursor = this.anchorBeat;
      this.initialized = true;
    }
    const now = c.currentTime,
      end = Math.max(this.cursor, this.beatAt(now + 0.12));
    const start = this.cursor,
      events: ScheduledTrigger[] = [],
      assignments = this.assignments();
    const currentGeneration = this.generation;
    for (let tick = Math.ceil(start * 4); tick / 4 < end; tick++) {
      const beat = tick / 4,
        time = this.timeAt(beat);
      if (time < now - 0.002) continue;
      this.pattern().forEach((l, i) => {
        const step = position(tick, l.length),
          state = l.steps[step];
        if (this.mode !== "MIDI" && state) {
          const a = assignments.find(
            (a) => a.voice === i && (i !== 5 || a.articulation === state),
          );
          if (a)
            events.push({
              beat,
              assignmentId: a.id,
              velocity: 1,
              source: "SEQ",
            });
        }
        if (this.timer)
          setTimeout(
            () => {
              if (currentGeneration === this.generation && this.timer)
                this.onEvent({ type: "trigger", time, lane: i, step });
            },
            Math.max(0, (time - now) * 1000),
          );
        else this.onEvent({ type: "trigger", time, lane: i, step });
      });
      this.tick = tick + 1;
    }
    if (this.mode !== "SEQ") {
      const clip = this.clip();
      for (const { event: e, beat } of clipOccurrences(clip, start, end)) {
        if (
          beat > (this.skipUntil.get(e.id) ?? -Infinity) &&
          this.timeAt(beat) >= now - 0.002
        )
          events.push({
            beat,
            assignmentId: e.assignmentId,
            velocity: e.velocity,
            source: "MIDI",
          });
      }
    }
    for (const e of resolveDrumTriggers(events, assignments)) {
      const a = assignments.find((a) => a.id === e.assignmentId);
      if (!a || !isAudible(a.voice, this.muted, this.solo)) continue;
      const voice = this.voices[a.voice];
      this.engine.trigger(
        a.voice,
        a.articulation,
        Math.max(now, this.timeAt(e.beat)),
        { ...voice, level: voice.level * e.velocity },
      );
    }
    this.cursor = end;
    this.next = this.timeAt(end);
  }
  pause() {
    this.pausedBeat = this.timer
      ? this.engine.context!.currentTime < this.anchorTime
        ? this.anchorBeat
        : Math.max(0, this.beatAt(this.engine.context!.currentTime))
      : this.pausedBeat;
    clearInterval(this.timer);
    this.timer = undefined;
    this.generation++;
    this.engine.silence();
    this.onEvent({
      type: "pause",
      time: this.engine.context?.currentTime ?? 0,
    });
  }
  stop() {
    this.pause();
    this.tick = 0;
    this.next = 0;
    this.cursor = 0;
    this.anchorBeat = 0;
    this.anchorTime = 0;
    this.pausedBeat = 0;
    this.initialized = false;
    this.skipUntil.clear();
    this.onEvent({ type: "stop", time: this.engine.context?.currentTime ?? 0 });
  }
}
