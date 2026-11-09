import type { Voice } from "./state";
type Param = "level" | "tune" | "decay" | "tone";
type Options = {
  names: string[];
  voices: Voice[];
  muted: boolean[];
  solo: boolean[];
  knob: (
    container: string,
    label: string,
    value: number,
    change: (n: number) => void,
    binding: { voice: number; key: Param },
  ) => void;
  set: (voice: number, key: Param, value: number) => void;
  mute: (voice: number) => void;
  soloToggle: (voice: number) => void;
  sample: (voice: number, button: HTMLButtonElement) => void;
};
export class Mixer {
  dialog = document.createElement("dialog");
  constructor(private options: Options) {
    const d = this.dialog;
    d.id = "mixer-dialog";
    d.setAttribute("aria-labelledby", "mixer-title");
    d.innerHTML =
      '<div class="window-heading"><strong id="mixer-title">DS-9 · MIXER</strong><button id="mixer-close">CLOSE</button></div><div class="mixer-scroll"><div id="mixer-channels"></div></div><p class="window-help">Mixer and main-lane controls share the same sound settings. Mute overrides solo; multiple solos can be active. SAMPLE opens that instrument’s file editor.</p>';
    document.body.append(d);
    d.querySelector<HTMLElement>("#mixer-close")!.onclick = () => d.close();
    const channels = d.querySelector("#mixer-channels")!;
    options.voices.forEach((voice, index) => {
      const channel = document.createElement("section");
      channel.className = "mixer-channel";
      const title = document.createElement("strong");
      title.textContent = options.names[index];
      title.dataset.mixerName = String(index);
      const buttons = document.createElement("div");
      buttons.className = "mixer-switches";
      for (const kind of ["mute", "solo"] as const) {
        const b = document.createElement("button");
        b.textContent = kind === "mute" ? "M" : "S";
        b.dataset[kind === "mute" ? "mixerMute" : "mixerSolo"] = String(index);
        b.setAttribute("aria-label", `${kind} ${options.names[index]}`);
        b.onclick = () =>
          kind === "mute" ? options.mute(index) : options.soloToggle(index);
        buttons.append(b);
      }
      const fader = document.createElement("label");
      fader.className = "mixer-fader";
      const caption = document.createElement("span");
      caption.textContent = "LEVEL";
      const input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = "1";
      input.step = ".01";
      input.value = String(voice.level);
      input.dataset.controlVoice = String(index);
      input.dataset.param = "level";
      input.setAttribute("aria-label", `${options.names[index]} mixer level`);
      input.oninput = () => options.set(index, "level", Number(input.value));
      const output = document.createElement("output");
      output.textContent = `${Math.round(voice.level * 100)}%`;
      fader.append(caption, input, output);
      const controls = document.createElement("div");
      controls.className = "mixer-knobs";
      controls.id = `mixer-knobs-${index}`;
      const sample = document.createElement("button");
      sample.className = "mixer-sample";
      sample.dataset.mixerSample = String(index);
      sample.textContent = "SAMPLE";
      sample.onclick = () => options.sample(index, sample);
      channel.append(title, buttons, fader, controls, sample);
      channels.append(channel);
      for (const key of ["tune", "decay", "tone"] as const)
        options.knob(
          controls.id,
          key.toUpperCase(),
          voice[key],
          (n) => options.set(index, key, n),
          { voice: index, key },
        );
    });
    this.sync();
  }
  sync() {
    this.options.voices.forEach((voice, index) => {
      const muted = this.dialog.querySelector<HTMLElement>(
          `[data-mixer-mute="${index}"]`,
        )!,
        solo = this.dialog.querySelector<HTMLElement>(
          `[data-mixer-solo="${index}"]`,
        )!;
      muted.classList.toggle("muted", this.options.muted[index]);
      solo.classList.toggle("soloed", this.options.solo[index]);
      muted.setAttribute("aria-pressed", String(this.options.muted[index]));
      solo.setAttribute("aria-pressed", String(this.options.solo[index]));
      this.dialog
        .querySelector(`[data-mixer-sample="${index}"]`)
        ?.classList.toggle("amber", voice.mode === "sample");
    });
  }
  open() {
    this.sync();
    if (!this.dialog.open) this.dialog.showModal();
  }
}
