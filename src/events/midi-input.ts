import { midiNote, midiAudioTime } from "./recording";
import type { Assignment } from "./contract";
type Port = {
  id: string;
  name?: string;
  onmidimessage:
    | ((e: { data: Uint8Array; receivedTime: number }) => void)
    | null;
};
type Access = { inputs: Map<string, Port>; onstatechange: (() => void) | null };
export class MidiInput {
  private access?: Access;
  selected = "";
  onDevices = (_: { id: string; name: string }[]) => {};
  constructor(
    private assignments: () => Assignment[],
    private audioNow: () => number,
    private hit: (a: Assignment, v: number, t: number) => void,
  ) {}
  async connect() {
    const nav = navigator as unknown as {
      requestMIDIAccess?: (options: { sysex: boolean }) => Promise<Access>;
    };
    if (!nav.requestMIDIAccess)
      throw Error(
        "Web MIDI input is unavailable here. Use Chrome/Edge over HTTPS, or record on-screen.",
      );
    this.access ??= await nav.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => this.refresh();
    this.refresh();
  }
  select(id: string) {
    this.selected = id;
    this.refresh();
  }
  private refresh() {
    if (!this.access) return;
    const ports = [...this.access.inputs.values()];
    for (const port of ports) {
      port.onmidimessage =
        port.id === this.selected
          ? (e) => {
              const note = midiNote(e.data, this.assignments());
              if (note)
                this.hit(
                  note.assignment,
                  note.velocity,
                  midiAudioTime(
                    e.receivedTime,
                    performance.now(),
                    this.audioNow(),
                  ),
                );
            }
          : null;
    }
    this.onDevices(
      ports.map((p) => ({ id: p.id, name: p.name ?? "MIDI input" })),
    );
  }
}
