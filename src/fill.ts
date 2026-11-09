/** Temporary performance overlays. Never writes the saved step arrays. */
export class FillState {
  held = false;
  startTick: number | undefined;
  endTick: number | undefined;
  hold() {
    this.held = true;
    this.startTick = this.endTick = undefined;
  }
  release() {
    this.held = false;
  }
  queue(nextTick: number) {
    this.held = false;
    this.startTick = Math.ceil(nextTick / 16) * 16;
    this.endTick = this.startTick + 16;
  }
  reset() {
    this.held = false;
    this.startTick = this.endTick = undefined;
  }
  state(tick: number): "off" | "queued" | "active" {
    if (this.held) return "active";
    if (this.endTick === undefined || tick >= this.endTick) return "off";
    return tick < this.startTick! ? "queued" : "active";
  }
  step(voice: number, base: number, tick: number) {
    if (this.state(tick) !== "active") return base;
    const p = ((tick % 16) + 16) % 16;
    if (voice === 1 && (p % 2 === 0 || p >= 12)) return 1;
    if (voice === 3 && [8, 11, 14].includes(p)) return 1;
    if (voice === 4 && [9, 12, 15].includes(p)) return 1;
    if (voice === 5 && p % 2 === 1) return 1;
    if (voice === 6 && [7, 15].includes(p)) return 1;
    return base;
  }
}
export function attachFillButton(
  button: HTMLButtonElement,
  options: {
    fill: FillState;
    tick: () => number;
    playing: () => boolean;
    prepare: () => Promise<void>;
    start: () => void;
    message: (text: string) => void;
  },
) {
  let press:
    | { id: number; held: boolean; timer: ReturnType<typeof setTimeout> }
    | undefined;
  const tap = () => {
    if (button.disabled) return;
    options.fill.queue(options.tick());
    if (!options.playing()) options.start();
    options.message("One-bar fill requested; saved pattern stays unchanged");
  };
  button.title =
    "Tap for one bar on an available bar boundary. Hold for a temporary fill; release to return.";
  button.addEventListener("contextmenu", (e) => e.preventDefault());
  button.addEventListener("pointerdown", (e) => {
    if (button.disabled || press || !e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    void options
      .prepare()
      .catch((error) => options.message((error as Error).message));
    const timer = setTimeout(() => {
      if (!press || button.disabled) return;
      press.held = true;
      options.fill.hold();
      if (!options.playing()) options.start();
      options.message(
        "Temporary fill; release to return to the stored pattern",
      );
    }, 200);
    press = { id: e.pointerId, held: false, timer };
    button.setPointerCapture(e.pointerId);
  });
  const finish = (e: PointerEvent, cancel = false) => {
    if (!press || press.id !== e.pointerId) return;
    const held = press.held;
    clearTimeout(press.timer);
    press = undefined;
    if (button.hasPointerCapture(e.pointerId))
      button.releasePointerCapture(e.pointerId);
    if (held) {
      options.fill.release();
      options.message("Stored pattern resumed; temporary fill released");
    } else if (!cancel) tap();
  };
  button.addEventListener("pointerup", (e) => finish(e));
  button.addEventListener("pointercancel", (e) => finish(e, true));
  button.addEventListener("lostpointercapture", (e) => finish(e, true));
  button.addEventListener("click", (e) => {
    e.preventDefault();
    if (e.detail === 0) tap();
  });
  window.addEventListener("blur", () => {
    if (press) {
      clearTimeout(press.timer);
      press = undefined;
    }
    options.fill.release();
  });
  let previous = "";
  const update = () => {
    const state = options.fill.state(options.tick());
    if (state !== previous) {
      previous = state;
      button.dataset.state = state;
      button.setAttribute("aria-pressed", String(state === "active"));
      button.textContent =
        state === "queued"
          ? "FILL QUEUED"
          : state === "active"
            ? "FILL ON"
            : "FILL";
      button.setAttribute(
        "aria-label",
        state === "queued"
          ? "One-bar fill queued"
          : state === "active"
            ? "Fill playing"
            : "Fill: tap for one bar or hold for temporary fill",
      );
    }
    requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}
