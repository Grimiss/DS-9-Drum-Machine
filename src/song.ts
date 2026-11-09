export type SongEntry = { id: string; pattern: number; bars: number };
export type SongData = {
  mode: "PATTERN" | "SONG";
  loop: boolean;
  entries: SongEntry[];
};
export const defaultSong = (): SongData => ({
  mode: "PATTERN",
  loop: false,
  entries: [{ id: "first", pattern: 0, bars: 1 }],
});
export function validateSong(value: unknown): SongData {
  const data = value as SongData;
  if (
    !data ||
    !["PATTERN", "SONG"].includes(data.mode) ||
    typeof data.loop !== "boolean" ||
    !Array.isArray(data.entries) ||
    data.entries.length > 128
  )
    throw Error("Invalid song arrangement");
  const ids = new Set<string>();
  for (const e of data.entries) {
    if (
      !e ||
      typeof e.id !== "string" ||
      !e.id.length ||
      e.id.length > 100 ||
      ids.has(e.id) ||
      !Number.isInteger(e.pattern) ||
      e.pattern < 0 ||
      e.pattern > 3 ||
      !Number.isInteger(e.bars) ||
      e.bars < 1 ||
      e.bars > 64
    )
      throw Error("Invalid song row");
    ids.add(e.id);
  }
  return structuredClone(data);
}
export class SongState {
  data: SongData = defaultSong();
  position(tick: number) {
    const total = this.data.entries.reduce((sum, e) => sum + e.bars * 16, 0);
    if (!total || tick < 0 || (!this.data.loop && tick >= total)) return;
    const local = ((tick % total) + total) % total;
    let start = 0;
    for (let index = 0; index < this.data.entries.length; index++) {
      const entry = this.data.entries[index],
        end = start + entry.bars * 16;
      if (local < end)
        return {
          index,
          entry,
          bar: Math.floor((local - start) / 16) + 1,
          iteration: Math.floor(tick / total),
        };
      start = end;
    }
  }
}
