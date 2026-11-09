import { test } from "node:test";
import assert from "node:assert/strict";
import { SongState, validateSong, defaultSong } from "../src/song.ts";
test("song entries use bar counts, end naturally, and loop without changing global tick", () => {
  const s = new SongState();
  s.data = {
    mode: "SONG",
    loop: false,
    entries: [
      { id: "a", pattern: 0, bars: 2 },
      { id: "b", pattern: 1, bars: 1 },
    ],
  };
  assert.equal(s.position(0)?.entry.pattern, 0);
  assert.equal(s.position(16)?.bar, 2);
  assert.equal(s.position(31)?.entry.pattern, 0);
  assert.equal(s.position(32)?.entry.pattern, 1);
  assert.equal(s.position(48), undefined);
  s.data.loop = true;
  assert.equal(s.position(48)?.entry.pattern, 0);
  assert.equal(s.position(48)?.iteration, 1);
  assert.equal(s.position(48)?.bar, 1);
});
test("empty songs and malformed arrangement imports are handled safely", () => {
  const s = new SongState();
  s.data.entries = [];
  assert.equal(s.position(0), undefined);
  for (const bad of [
    null,
    { ...defaultSong(), mode: "BAD" },
    { ...defaultSong(), entries: [{ id: "a", pattern: 5, bars: 1 }] },
    { ...defaultSong(), entries: [{ id: "a", pattern: 0, bars: 0 }] },
    {
      ...defaultSong(),
      entries: [
        { id: "a", pattern: 0, bars: 1 },
        { id: "a", pattern: 1, bars: 1 },
      ],
    },
  ])
    assert.throws(() => validateSong(bad));
  const a = defaultSong(),
    copy = validateSong(a);
  copy.entries[0].bars = 4;
  assert.equal(a.entries[0].bars, 1);
});
