import { SongState } from "./song";
type Options = {
  song: SongState;
  playing: () => boolean;
  selected: () => number;
  reset: () => void;
  changed: () => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  mixer: () => void;
};
export class SongEditor {
  dialog = document.createElement("dialog");
  private body: HTMLElement;
  private wasPlaying = false;
  constructor(private options: Options) {
    const d = this.dialog;
    d.id = "song-dialog";
    d.setAttribute("aria-labelledby", "song-title");
    d.innerHTML = `<div class="window-heading"><strong id="song-title">SONG ARRANGEMENT</strong><button id="song-close">CLOSE</button></div><div class="song-tools"><label>PLAYBACK <select id="song-mode"><option value="PATTERN">PATTERN</option><option value="SONG">SONG</option></select></label><label><input id="song-loop" type="checkbox"> LOOP SONG</label><button id="song-add">ADD PATTERN</button><button id="song-play">PLAY</button><button id="song-pause">PAUSE</button><button id="song-stop">STOP</button><button id="song-mixer">MIXER</button></div><p class="window-help">Choose A–D and the number of bars for each row. Stop to edit the arrangement. Independent lane phases continue across song entries and loops. SAVE on the main panel saves patterns and the song together.</p><div id="song-rows"></div><p id="song-now"></p>`;
    document.body.append(d);
    this.body = d.querySelector("#song-rows")!;
    this.el("song-close").onclick = () => d.close();
    this.el("song-play").onclick = options.play;
    this.el("song-pause").onclick = options.pause;
    this.el("song-stop").onclick = options.stop;
    this.el("song-mixer").onclick = options.mixer;
    this.el("song-mode").onchange = () => {
      if (options.playing()) return;
      const mode = (this.el("song-mode") as HTMLSelectElement).value as
        | "PATTERN"
        | "SONG";
      options.reset();
      options.song.data.mode = mode;
      options.changed();
      this.refresh();
    };
    this.el("song-loop").onchange = () => {
      if (options.playing()) return;
      const loop = (this.el("song-loop") as HTMLInputElement).checked;
      options.reset();
      options.song.data.loop = loop;
      options.changed();
    };
    this.el("song-add").onclick = () => {
      if (options.playing() || options.song.data.entries.length >= 128) return;
      options.reset();
      options.song.data.entries.push({
        id: crypto.randomUUID(),
        pattern: options.selected(),
        bars: 1,
      });
      options.changed();
      this.refresh();
    };
    this.refresh();
  }
  private el(id: string) {
    return this.dialog.querySelector<HTMLElement>(`#${id}`)!;
  }
  open() {
    this.refresh();
    if (!this.dialog.open) this.dialog.showModal();
  }
  refresh() {
    const { song } = this.options;
    this.body.replaceChildren();
    song.data.entries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "song-row";
      row.dataset.songId = entry.id;
      const number = document.createElement("span");
      number.textContent = String(index + 1);
      const pattern = document.createElement("select");
      pattern.setAttribute("aria-label", `Song row ${index + 1} pattern`);
      for (let n = 0; n < 4; n++)
        pattern.append(new Option("ABCD"[n], String(n)));
      pattern.value = String(entry.pattern);
      pattern.onchange = () => {
        if (this.options.playing()) return;
        this.options.reset();
        entry.pattern = Number(pattern.value);
        this.options.changed();
      };
      const bars = document.createElement("input");
      bars.type = "number";
      bars.min = "1";
      bars.max = "64";
      bars.step = "1";
      bars.value = String(entry.bars);
      bars.setAttribute("aria-label", `Song row ${index + 1} bars`);
      bars.onchange = () => {
        const value = Number(bars.value);
        if (
          this.options.playing() ||
          !Number.isInteger(value) ||
          value < 1 ||
          value > 64
        ) {
          bars.value = String(entry.bars);
          return;
        }
        this.options.reset();
        entry.bars = value;
        this.options.changed();
      };
      const label = document.createElement("span");
      label.textContent = "BARS";
      const buttons = [
        ["UP", -1],
        ["DOWN", 1],
        ["REMOVE", 0],
      ] as const;
      row.append(number, pattern, bars, label);
      for (const [text, direction] of buttons) {
        const button = document.createElement("button");
        button.textContent = text;
        button.dataset.action = text;
        button.onclick = () => {
          if (this.options.playing()) return;
          this.options.reset();
          if (!direction) song.data.entries.splice(index, 1);
          else {
            const next = index + direction;
            if (next < 0 || next >= song.data.entries.length) return;
            [song.data.entries[index], song.data.entries[next]] = [
              song.data.entries[next],
              song.data.entries[index],
            ];
          }
          this.options.changed();
          this.refresh();
        };
        row.append(button);
      }
      this.body.append(row);
    });
    this.wasPlaying = !this.options.playing();
    this.position(0);
  }
  position(tick: number) {
    const playing = this.options.playing();
    if (playing !== this.wasPlaying) {
      this.wasPlaying = playing;
      this.dialog
        .querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLButtonElement
        >("#song-rows input,#song-rows select,#song-rows button,#song-add,#song-mode,#song-loop")
        .forEach((el) => (el.disabled = playing));
    }
    (this.el("song-mode") as HTMLSelectElement).value =
      this.options.song.data.mode;
    (this.el("song-loop") as HTMLInputElement).checked =
      this.options.song.data.loop;
    (this.el("song-play") as HTMLButtonElement).disabled =
      this.options.song.data.mode === "SONG" &&
      !this.options.song.data.entries.length;
    const current =
      this.options.song.data.mode === "SONG"
        ? this.options.song.position(tick)
        : undefined;
    this.body
      .querySelectorAll<HTMLElement>(".song-row")
      .forEach((row) =>
        row.classList.toggle(
          "active",
          playing && row.dataset.songId === current?.entry.id,
        ),
      );
    this.el("song-now").textContent =
      this.options.song.data.mode === "PATTERN"
        ? "Pattern mode: the selected A–D pattern loops normally"
        : !this.options.song.data.entries.length
          ? "Add a song row before playing"
          : playing && current
            ? `SONG · row ${current.index + 1}/${this.options.song.data.entries.length} · ${"ABCD"[current.entry.pattern]} · bar ${current.bar}/${current.entry.bars}`
            : "Song ready · Play starts at the current transport position; Stop rewinds";
  }
}
