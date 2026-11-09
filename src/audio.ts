import { synthesizeCymbal } from "./cymbal";
import { kits, type KitId } from "./kits";
import { synthesizeKit } from "./synthesis";
import { isAudible, type Voice } from "./state";
export class Engine {
  kit: KitId = "classic";
  context?: AudioContext;
  master?: DynamicsCompressorNode;
  hat?: GainNode;
  active = new Set<GainNode>();
  private trackLevels = Array(9).fill(0.7) as number[];
  private trackAudible = Array(9).fill(true) as boolean[];
  private trackBuses: GainNode[] = [];
  setTrackLevel(index: number, level: number) {
    if (!Number.isFinite(level)) return;
    level = Math.max(0, Math.min(1, level));
    if (level === this.trackLevels[index]) return;
    this.trackLevels[index] = level;
    this.updateBus(index);
  }
  setAudibility(muted: boolean[], solo: boolean[]) {
    for (let i = 0; i < 9; i++) {
      const audible = isAudible(i, muted, solo);
      if (audible !== this.trackAudible[i]) {
        this.trackAudible[i] = audible;
        this.updateBus(i);
      }
    }
  }
  private updateBus(index: number) {
    const bus = this.trackBuses[index],
      c = this.context;
    if (!bus || !c) return;
    bus.gain.cancelScheduledValues(c.currentTime);
    bus.gain.setTargetAtTime(
      this.trackAudible[index] ? this.trackLevels[index] : 0,
      c.currentTime,
      0.006,
    );
  }
  silence() {
    const t = this.context?.currentTime ?? 0;
    for (const g of this.active) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(0, t);
    }
    this.active.clear();
  }
  async unlock() {
    this.context ??= new AudioContext();
    if (!this.master) {
      this.master = this.context.createDynamicsCompressor();
      this.master.threshold.value = -12;
      this.master.ratio.value = 8;
      const gain = this.context.createGain();
      gain.gain.value = 0.45;
      this.master.connect(gain).connect(this.context.destination);
    }
    if (!this.trackBuses.length)
      this.trackBuses = Array.from({ length: 9 }, (_, i) => {
        const bus = this.context!.createGain();
        bus.gain.setValueAtTime(
          this.trackAudible[i] ? this.trackLevels[i] : 0,
          this.context!.currentTime,
        );
        bus.connect(this.master!);
        return bus;
      });
    await this.context.resume();
  }
  trigger(
    i: number,
    state: number,
    time: number,
    v: Voice,
    context: BaseAudioContext = this.context!,
    output: AudioNode = this.master!,
  ) {
    if (v.level <= 0) return;
    // Normalize the per-hit level into the live channel bus. Offline renders keep
    // the original direct path; event velocity remains relative to the track level.
    if (
      context === this.context &&
      output === this.master &&
      this.trackBuses[i]
    ) {
      v = {
        ...v,
        level: Math.min(1, v.level / Math.max(0.000001, this.trackLevels[i])),
      };
      output = this.trackBuses[i];
    }
    const recipe = this.kit === "classic" ? undefined : kits[this.kit];
    const c = context,
      g = c.createGain(),
      dur =
        (i === 8 && v.mode === "sample"
          ? 0.65
          : recipe && v.mode === "analog"
            ? i === 5 && state === 2
              ? recipe.openHat
              : recipe.durations[i]
            : i === 5
              ? state === 2
                ? 0.45
                : 0.065
              : [0.4, 0.17, 0.16, 0.3, 0.22, 0.1, 0.13, 0.08, 2.8][i]) *
        (0.3 + v.decay * 2),
      pitch = 2 ** ((v.tune - 0.5) * 2);
    g.gain.setValueAtTime(Math.max(0.001, v.level * 0.18), time);
    if (i === 8 && v.mode === "analog") g.gain.setValueAtTime(0, time + dur);
    else g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    g.connect(output);
    if (context === this.context) {
      this.active.add(g);
      setTimeout(
        () => this.active.delete(g),
        (time - c.currentTime + dur + 1) * 1000,
      );
    }
    if (i === 5) {
      if (this.hat && context === this.context) {
        this.hat.gain.cancelScheduledValues(time);
        this.hat.gain.setTargetAtTime(0.0001, time, 0.004);
      }
      if (context === this.context) this.hat = g;
    }
    if (v.mode === "sample") {
      if (!v.sample) return;
      const s = c.createBufferSource();
      let b = v.sample;
      if (v.reverse) {
        b = c.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
        for (let ch = 0; ch < b.numberOfChannels; ch++)
          b.copyToChannel(v.sample.getChannelData(ch).slice().reverse(), ch);
      }
      s.buffer = b;
      s.playbackRate.value = pitch * 2 ** ((v.pitch - 0.5) * 2);
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 200 + v.tone * 18000;
      s.connect(filter).connect(g);
      const start = v.start * b.duration,
        end = Math.max(start + 0.001, v.end * b.duration);
      s.start(time, start, end - start);
      return;
    }
    if (i === 8 && !recipe) {
      synthesizeCymbal(c, g, time, dur, v);
      return;
    }
    if (recipe) {
      synthesizeKit(c, g, i, time, dur, v, recipe);
      return;
    }
    const tone = c.createBiquadFilter();
    tone.type =
      i === 0 || i === 3 || i === 4 || i === 7 ? "lowpass" : "highpass";
    tone.frequency.value = i === 5 ? 4000 + v.tone * 7000 : 150 + v.tone * 6500;
    tone.connect(g);
    const osc = (freq: number, type: OscillatorType = "sine", drop = false) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq * pitch, time);
      if (drop)
        o.frequency.exponentialRampToValueAtTime(
          Math.max(25, freq * 0.22 * pitch),
          time + dur * 0.8,
        );
      o.connect(tone);
      o.start(time);
      o.stop(time + dur);
    };
    const noise = () => {
      const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate),
        a = b.getChannelData(0);
      for (let n = 0; n < a.length; n++) a[n] = Math.random() * 2 - 1;
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(tone);
      s.start(time);
      s.stop(time + dur);
    };
    if (i === 0) osc(175, "sine", true);
    else if (i === 1) {
      osc(180, "triangle");
      noise();
    } else if (i === 2) {
      noise();
      for (let n = 1; n < 4; n++) {
        g.gain.setValueAtTime(v.level * 0.18, time + n * 0.012);
        g.gain.exponentialRampToValueAtTime(0.02, time + n * 0.012 + 0.009);
      }
    } else if (i === 3 || i === 4) osc(i === 3 ? 150 : 260, "sine", true);
    else if (i === 5 || i === 8) {
      noise();
      [317, 521, 843, 1171].forEach((f) =>
        osc(f * (i === 5 ? 8 : 4), "square"),
      );
    } else if (i === 6) {
      osc(680, "triangle", true);
      noise();
    } else osc(2100, "sine");
  }
}
