import type { ClipStore } from "./events/clip-store";
import {
  quantizeBeat,
  type Assignment,
  type Quantize,
} from "./events/contract";
import type { Recorder } from "./events/recording";
import type { Sequencer } from "./sequencer";
import type { MidiInput } from "./events/midi-input";
type Options = {
  store: ClipStore;
  recorder: Recorder;
  seq: Sequencer;
  input: MidiInput;
  slot: () => number;
  assignments: () => Assignment[];
  audition: (a: Assignment) => void;
  record: () => Promise<void>;
  changed: () => void;
  message: (text: string) => void;
};
export class MidiEditor {
  dialog = document.createElement("dialog");
  private grid: HTMLElement;
  private notes: HTMLElement;
  private selected?: string;
  private inputError="";
  private pixelsPerBeat = 64;
  private gesture?: {
    kind: "paint" | "erase" | "move";
    pointer: number;
    id?: string;
    offset: number;
    x: number;
    y: number;
    visited: Set<string>;
  };
  constructor(private o: Options) {
    const d = this.dialog;
    d.id = "midi-editor";
    d.innerHTML = `<header class="midi-heading"><strong>DS-9 · NAMED-LANE MIDI EDITOR</strong><button id="midi-close" aria-label="Close MIDI editor">CLOSE</button></header><div class="midi-tools"><button id="midi-arm">MIDI REC</button><button id="midi-undo">UNDO</button><button id="midi-redo">REDO</button><label>PLAYBACK <select id="midi-mode"><option>SEQ</option><option>MIDI</option><option>BOTH</option></select></label><label>CLOCK <select id="midi-clock"><option>FREE</option><option>SYNC</option></select></label><label>CLIP BEATS <input id="midi-length" type="number" min="0.25" max="256" step="0.25"></label><label>SNAP / RECORD <select id="midi-quantize"><option value="0">OFF</option><option value="1">1/4</option><option value="2">1/8</option><option value="4">1/16</option><option value="8">1/32</option></select></label><button id="midi-quantize-notes">QUANTIZE CLIP</button></div><div class="midi-devices"><button id="midi-connect">CONNECT MIDI INPUT</button><select id="midi-input" aria-label="MIDI input"><option value="">On-screen only</option></select><span id="midi-status" role="status"></span></div><p class="midi-help">Click/drag empty cells: paint · Ctrl-click/drag: erase · Drag a note: move · Select a note: edit its position/velocity · Double-click a label to rename · Note numbers map MIDI input. Each pattern A–D has its own clip.</p><div class="midi-scroll"><div class="midi-canvas"><div id="midi-labels"></div><div id="midi-grid"><div id="midi-ruler"></div><div id="midi-notes"></div><div id="midi-playhead"></div></div></div></div><div class="midi-inspector"><label>TRIGGER POSITION (beats) <input id="midi-position" type="number" min="0" step="0.001"></label><label>VELOCITY <input id="midi-velocity" type="range" min="0.01" max="1" step="0.01"></label><span id="midi-velocity-value"></span><button id="midi-remove">DELETE TRIGGER</button><span id="midi-slot"></span></div>`;
    document.body.append(d);
    this.grid = this.el("midi-grid");
    this.notes = this.el("midi-notes");
    this.el("midi-close").onclick = () => d.close();
    this.el("midi-arm").onclick = () => {
      void o.record().catch(e=>{this.inputError=(e as Error).message;this.status();});
    };
    this.el("midi-undo").onclick = () => {
      o.recorder.stop();
      o.store.undo();
      o.seq.reconfigure();
    };
    this.el("midi-redo").onclick = () => {
      o.recorder.stop();
      o.store.redo();
      o.seq.reconfigure();
    };
    this.el("midi-mode").onchange = () => {
      o.seq.mode = this.select("midi-mode").value as typeof o.seq.mode;
      o.seq.reconfigure();
      o.changed();
    };
    this.el("midi-clock").onchange = () => {
      o.recorder.stop();
      o.seq.stop();
      o.seq.host = undefined;
      o.seq.clockMode = this.select("midi-clock")
        .value as typeof o.seq.clockMode;
      o.changed();
      this.status();
    };
    this.el("midi-quantize").onchange = () =>
      (o.recorder.quantize = Number(
        this.select("midi-quantize").value,
      ) as Quantize);
    this.el("midi-length").onchange = () => {
      const n = Number(this.input("midi-length").value);
      if (!Number.isFinite(n) || n < 0.25 || n > 256) {
        this.refresh();
        return;
      }
      o.recorder.stop();
      o.store.length(o.slot(), n);
      o.seq.reconfigure();
    };
    this.el("midi-quantize-notes").onclick = () => {
      if (!o.recorder.quantize) return;
      o.recorder.stop();
      o.store.begin();
      const clip = this.clip();
      const events = [...clip.events];
      clip.events = [];
      for (const e of events)
        o.store.add(
          o.slot(),
          e.assignmentId,
          e.positionBeats,
          e.velocity,
          o.recorder.quantize,
        );
      o.store.commit();
      o.seq.reconfigure();
    };
    this.el("midi-connect").onclick = async () => {
      try {
        await o.seq.engine.unlock();
        await o.input.connect();
        this.inputError="";this.status();
      } catch (e) {
        this.inputError=(e as Error).message;this.status();
      }
    };
    o.input.onDevices = (devices) => {
      const s = this.select("midi-input");
      s.replaceChildren(
        new Option("On-screen only", ""),
        ...devices.map((p) => new Option(p.name, p.id)),
      );
      s.value = o.input.selected;
    };
    this.el("midi-input").onchange = () =>
      o.input.select(this.select("midi-input").value);
    this.el("midi-remove").onclick = () => {
      if (!this.selected) return;
      o.recorder.stop();
      o.store.begin();
      o.store.remove(o.slot(), this.selected);
      o.store.commit();
      o.seq.reconfigure();
    };
    const edit = () => {
      const e = this.clip().events.find((e) => e.id === this.selected);
      if (!e) return;
      const p = Number(this.input("midi-position").value);
      if (!Number.isFinite(p) || p < 0 || p >= this.clip().lengthBeats) {
        this.refresh();
        return;
      }
      o.recorder.stop();
      o.store.begin();
      o.store.move(o.slot(), e.id, e.assignmentId, p, 0);
      e.velocity = Number(this.input("midi-velocity").value);
      o.store.commit();
      o.seq.reconfigure();
    };
    this.el("midi-position").onchange = edit;
    this.el("midi-velocity").onpointerdown = () => {
      o.recorder.stop();
      o.store.begin();
    };
    this.el("midi-velocity").oninput = () => {
      o.recorder.stop();
      o.store.begin();
      const e = this.clip().events.find((e) => e.id === this.selected);
      if (e) {
        e.velocity = Number(this.input("midi-velocity").value);
        this.el("midi-velocity-value").textContent = String(
          Math.round(e.velocity * 127),
        );
        this.drawNotes();
      }
    };
    this.el("midi-velocity").onchange = () => {
      o.store.commit();
      o.seq.reconfigure();
    };
    this.notes.onpointerdown = (e) => this.down(e);
    this.notes.onpointermove = (e) => this.move(e);
    this.notes.onpointerup = (e) => this.end(e);
    this.notes.onpointercancel = (e) => this.end(e);
    d.addEventListener(
      "wheel",
      (e) => {
        const input = e.target;
        if (
          !(input instanceof HTMLInputElement) ||
          !["number", "range"].includes(input.type) ||
          input.disabled ||
          !e.deltaY
        )
          return;
        e.preventDefault();
        const n =
          Number(input.value) +
          (e.deltaY < 0 ? 1 : -1) * Number(input.step || 1);
        input.value = String(
          Math.max(Number(input.min || 0), Math.min(Number(input.max || 1), n)),
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { passive: false },
    );
    d.addEventListener("keydown", (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.code === "KeyZ" &&
        !(e.target as HTMLElement).closest("input,select")
      ) {
        e.preventDefault();
        o.recorder.stop();
        if (e.shiftKey) o.store.redo();
        else o.store.undo();
        o.seq.reconfigure();
      }
    });
    d.addEventListener("close", () => {
      if (this.gesture) {
        o.store.commit();
        this.gesture = undefined;
      }
    });
    o.store.onChange = () => {
      this.refresh();
      o.changed();
    };
    this.refresh();
    const animate = () => {
      if (d.open) {
        const p = o.seq.positionBeats % this.clip().lengthBeats;
        this.el("midi-playhead").style.left = `${p * this.pixelsPerBeat}px`;
        this.status();
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
  private el(id: string) {
    return this.dialog.querySelector<HTMLElement>(`#${id}`)!;
  }
  private input(id: string) {
    return this.el(id) as HTMLInputElement;
  }
  private select(id: string) {
    return this.el(id) as HTMLSelectElement;
  }
  private clip() {
    return this.o.store.clips[this.o.slot()];
  }
  open() {
    if (!this.dialog.open) this.dialog.showModal();
    this.refresh();
  }
  status() {
    this.el("midi-status").textContent = this.inputError || (
      this.o.seq.clockMode === "SYNC"
        ? this.o.seq.host
          ? "Following external host clock"
          : "SYNC: waiting for DM-848 / host clock"
        : this.o.recorder.armed
          ? "Recording live input"
          : "Standalone FREE clock");
    this.el("midi-arm").classList.toggle("red", this.o.recorder.armed);
  }
  refresh() {
    this.select("midi-mode").value = this.o.seq.mode;
    this.select("midi-clock").value = this.o.seq.clockMode;
    this.input("midi-length").value = String(this.clip().lengthBeats);
    this.select("midi-quantize").value = String(this.o.recorder.quantize);
    this.select("midi-input").value = this.o.input.selected;
    this.pixelsPerBeat = Math.max(
      64,
      Math.min(
        256,
        ((this.dialog.clientWidth || 1480) - 260) / this.clip().lengthBeats,
      ),
    );
    this.grid.style.width = `${this.clip().lengthBeats * this.pixelsPerBeat}px`;
    this.notes.style.backgroundSize = `${this.pixelsPerBeat / (this.o.recorder.quantize || 4)}px 38px`;
    const labels = this.el("midi-labels");
    labels.replaceChildren();
    for (const a of this.o.assignments()) {
      const row = document.createElement("div");
      row.className = "midi-label";
      const button = document.createElement("button");
      button.textContent = a.name;
      button.title = "Click to audition; double click to rename";
      button.onclick = () => this.o.audition(a);
      button.ondblclick = () => {
        const n = prompt("Drum assignment name", a.name);
        if (n?.trim()) {
          a.name = n.trim().slice(0, 48);
          this.o.changed();
          this.refresh();
        }
      };
      const note = document.createElement("input");
      note.type = "number";
      note.min = "0";
      note.max = "127";
      note.value = String(a.note);
      note.setAttribute("aria-label", `${a.name} MIDI note`);
      note.onchange = () => {
        const n = Number(note.value);
        if (
          !Number.isInteger(n) ||
          n < 0 ||
          n > 127 ||
          this.o.assignments().some((b) => b.id !== a.id && b.note === n)
        ) {
          note.value = String(a.note);
          return;
        }
        a.note = n;
        this.o.changed();
      };
      row.append(button, note);
      labels.append(row);
    }
    const ruler = this.el("midi-ruler");
    ruler.replaceChildren();
    for (let n = 0; n < this.clip().lengthBeats; n++) {
      const span = document.createElement("span");
      span.style.left = `${n * this.pixelsPerBeat}px`;
      span.textContent = String(n + 1);
      ruler.append(span);
    }
    this.drawNotes();
    const selected = this.clip().events.find((e) => e.id === this.selected);
    this.input("midi-position").disabled = !selected;
    this.input("midi-velocity").disabled = !selected;
    if (selected) {
      this.input("midi-position").value = String(selected.positionBeats);
      this.input("midi-position").max = String(this.clip().lengthBeats);
      this.input("midi-velocity").value = String(selected.velocity);
      this.el("midi-velocity-value").textContent = String(
        Math.round(selected.velocity * 127),
      );
    } else {
      this.input("midi-position").value = "";
      this.el("midi-velocity-value").textContent = "";
    }
    this.el("midi-slot").textContent =
      `PATTERN ${"ABCD"[this.o.slot()]} · ${this.clip().events.length} MIDI triggers`;
    this.status();
  }
  private refreshInspector() {
    const e = this.clip().events.find((e) => e.id === this.selected);
    this.input("midi-position").disabled = !e;
    this.input("midi-velocity").disabled = !e;
    if (e) {
      this.input("midi-position").value = String(e.positionBeats);
      this.input("midi-velocity").value = String(e.velocity);
      this.el("midi-velocity-value").textContent = String(
        Math.round(e.velocity * 127),
      );
    }
  }
  private drawNotes() {
    this.notes.replaceChildren();
    for (const e of this.clip().events) {
      const row = this.o
        .assignments()
        .findIndex((a) => a.id === e.assignmentId);
      const n = document.createElement("button");
      n.type = "button";
      n.className = `midi-note ${e.id === this.selected ? "selected" : ""}`;
      n.dataset.id = e.id;
      n.style.left = `${e.positionBeats * this.pixelsPerBeat}px`;
      n.style.top = `${row * 38 + 4}px`;
      n.style.opacity = String(0.35 + e.velocity * 0.65);
      n.title = `${this.o.assignments()[row]?.name} · beat ${e.positionBeats.toFixed(3)} · velocity ${Math.round(e.velocity * 127)}`;
      n.setAttribute("aria-label", n.title);
      this.notes.append(n);
    }
  }
  private point(e: PointerEvent) {
    const r = this.notes.getBoundingClientRect();
    return {
      beat: Math.max(
        0,
        Math.min(
          this.clip().lengthBeats - 0.000001,
          (e.clientX - r.left) / this.pixelsPerBeat,
        ),
      ),
      row: Math.max(0, Math.min(9, Math.floor((e.clientY - r.top) / 38))),
    };
  }
  private down(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.o.recorder.stop();
    this.o.store.begin();
    const target = (e.target as HTMLElement).closest<HTMLElement>(".midi-note");
    this.selected = target?.dataset.id;
    this.gesture = {
      kind: e.ctrlKey ? "erase" : target ? "move" : "paint",
      pointer: e.pointerId,
      id: target?.dataset.id,
      offset: target
        ? this.point(e).beat -
          (this.clip().events.find((n) => n.id === target.dataset.id)
            ?.positionBeats ?? 0)
        : 0,
      x: e.clientX,
      y: e.clientY,
      visited: new Set(),
    };
    this.notes.setPointerCapture(e.pointerId);
    if (this.gesture.kind === "move") {
      this.drawNotes();
      this.refreshInspector();
    } else this.apply(e);
  }
  private apply(e: PointerEvent) {
    const g = this.gesture;
    if (!g) return;
    const p = this.point(e),
      a = this.o.assignments()[p.row];
    if (g.kind === "move") {
      if (g.id)
        this.o.store.move(
          this.o.slot(),
          g.id,
          a.id,
          Math.max(0, p.beat - g.offset),
          this.o.recorder.quantize,
        );
    } else if (g.kind === "erase") {
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>(".midi-note");
      if (target?.dataset.id)
        this.o.store.remove(this.o.slot(), target.dataset.id);
      else {
        const q = this.o.recorder.quantize || 8,
          cell = Math.floor(p.beat * q);
        this.clip().events = this.clip().events.filter(
          (n) =>
            n.assignmentId !== a.id || Math.floor(n.positionBeats * q) !== cell,
        );
      }
    } else {
      const q = this.o.recorder.quantize || 8,
        cell = Math.floor(p.beat * q),
        key = `${p.row}:${cell}`;
      if (g.visited.has(key)) return;
      g.visited.add(key);
      const added = this.o.store.add(
        this.o.slot(),
        a.id,
        this.o.recorder.quantize ? p.beat : p.beat,
        0.8,
        this.o.recorder.quantize,
      );
      if (added) this.selected = added.id;
    }
    this.drawNotes();
  }
  private move(e: PointerEvent) {
    const g = this.gesture;
    if (g?.pointer !== e.pointerId) return;
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(e.clientX - g.x, e.clientY - g.y) / 5),
    );
    for (let n = 1; n <= count; n++)
      this.apply(
        new PointerEvent("pointermove", {
          clientX: g.x + ((e.clientX - g.x) * n) / count,
          clientY: g.y + ((e.clientY - g.y) * n) / count,
        }),
      );
    g.x = e.clientX;
    g.y = e.clientY;
  }
  private end(e: PointerEvent) {
    if (this.gesture?.pointer !== e.pointerId) return;
    this.gesture = undefined;
    if (this.notes.hasPointerCapture(e.pointerId))
      this.notes.releasePointerCapture(e.pointerId);
    this.o.store.commit();
    this.o.seq.reconfigure();
  }
}
