import type { KitRecipe } from "./kits";
import type { Voice } from "./state";

/** Native audio-rate oscillators, filters and envelopes; no third-party recordings. */
export function synthesizeKit(
  c: BaseAudioContext,
  output: GainNode,
  lane: number,
  time: number,
  duration: number,
  v: Voice,
  kit: KitRecipe,
) {
  const pitch = 2 ** ((v.tune - 0.5) * 2);
  const brightness = 2 ** ((v.tone - 0.5) * 2);
  const bus = c.createGain();
  bus.gain.value = 0.65;
  const colour = c.createBiquadFilter();
  colour.type = "lowpass";
  colour.frequency.value = Math.min(
    c.sampleRate * 0.45,
    (lane === 0 ? 2800 : 15000) * brightness,
  );
  bus.connect(colour);
  if (kit.drive > 1) {
    const shaper = c.createWaveShaper(),
      curve = new Float32Array(1024);
    for (let n = 0; n < curve.length; n++) {
      const x = (n / (curve.length - 1)) * 2 - 1;
      curve[n] = Math.tanh(x * kit.drive) / Math.tanh(kit.drive);
    }
    shaper.curve = curve;
    shaper.oversample = "2x";
    colour.connect(shaper).connect(output);
  } else colour.connect(output);
  const envelope = (level: number, decay: number, delay = 0) => {
    const gain = c.createGain(),
      start = time + delay,
      end = Math.min(time + duration, start + decay);
    gain.gain.setValueAtTime(0, time);
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(
      0.00001,
      Math.max(start + 0.001, end),
    );
    return gain;
  };
  const oscillator = (
    hz: number,
    type: OscillatorType,
    level: number,
    decay = duration,
    endHz = hz,
    fall = 0.04,
  ) => {
    const o = c.createOscillator(),
      amp = envelope(level, decay);
    o.type = type;
    o.frequency.setValueAtTime(hz * pitch, time);
    if (endHz !== hz)
      o.frequency.exponentialRampToValueAtTime(
        endHz * pitch,
        time + Math.min(fall, duration),
      );
    o.connect(amp).connect(bus);
    o.start(time);
    o.stop(time + duration);
  };
  const noise = (
    level: number,
    decay: number,
    cutoff: number,
    type: BiquadFilterType = "highpass",
    delay = 0,
  ) => {
    const source = c.createBufferSource(),
      length = Math.max(1, Math.ceil(c.sampleRate * duration));
    const buffer = c.createBuffer(1, length, c.sampleRate),
      data = buffer.getChannelData(0);
    // Repeatable excitation makes factory-kit renders stable for testing and auditioning.
    let seed = 7919 + lane * 3571 + Math.round(kit.kick[0]);
    for (let n = 0; n < length; n++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      data[n] = seed / 2147483648;
    }
    source.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = Math.min(c.sampleRate * 0.45, cutoff * brightness);
    filter.Q.value = 0.7;
    const amp = envelope(level, decay, delay);
    source.connect(filter).connect(amp).connect(bus);
    source.start(time + delay);
    source.stop(time + duration);
  };
  if (lane === 0) {
    oscillator(kit.kick[0], "sine", 1, duration, kit.kick[1], kit.kick[2]);
    noise(kit.drive > 2 ? 0.7 : 0.18, 0.012, 1800);
    if (kit.drive > 2)
      oscillator(kit.kick[0] * 1.8, "triangle", 0.2, 0.025, 70, 0.015);
  } else if (lane === 1) {
    oscillator(kit.snare[0], "triangle", 0.55, duration * 0.5);
    oscillator(kit.snare[1], "sine", 0.22, duration * 0.35);
    noise(0.9, duration, kit.noiseCutoff);
  } else if (lane === 2) {
    for (let n = 0; n < 3; n++)
      noise(2.4, 0.012, kit.noiseCutoff, "bandpass", n * kit.clapGap);
    noise(
      1.2,
      duration - 3 * kit.clapGap,
      kit.noiseCutoff,
      "bandpass",
      3 * kit.clapGap,
    );
  } else if (lane === 3 || lane === 4) {
    const hz = kit.toms[lane - 3];
    oscillator(hz * 1.5, "sine", 0.9, duration, hz, 0.035);
    oscillator(hz * 2.03, "sine", 0.16, duration * 0.35);
    noise(0.07, 0.018, 900, "lowpass");
  } else if (lane === 5 || lane === 8) {
    // Inharmonic square-wave bank and high-passed noise create metallic excitation.
    const metal = c.createBiquadFilter();
    metal.type = "highpass";
    metal.frequency.value = Math.min(
      c.sampleRate * 0.45,
      kit.hatCutoff * brightness * (lane === 8 ? 0.55 : 1),
    );
    const amp = envelope(lane === 5 ? 0.25 : 0.2, duration);
    metal.connect(amp).connect(bus);
    for (const hz of kit.metal) {
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.value = Math.min(
        c.sampleRate * 0.45,
        hz * pitch * (lane === 5 ? 4 : 2),
      );
      o.connect(metal);
      o.start(time);
      o.stop(time + duration);
    }
    noise(lane === 5 ? 0.4 : 0.55, duration, kit.hatCutoff * 0.8);
    if (lane === 8) noise(0.2, 0.012, 2300);
  } else if (lane === 6) {
    if (kit.label === "DEEP 08") {
      oscillator(540, "square", 0.3, duration);
      oscillator(800, "square", 0.25, duration);
    } else {
      oscillator(kit.wood * 0.65, "sine", 0.8, duration, kit.wood * 0.5, 0.018);
      oscillator(kit.wood * 1.13, "triangle", 0.2, duration * 0.4);
    }
  } else {
    oscillator(kit.wood, "sine", 0.85, duration);
    oscillator(kit.wood * 1.47, "sine", 0.18, duration * 0.45);
  }
}
