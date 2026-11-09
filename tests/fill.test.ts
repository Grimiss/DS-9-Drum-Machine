import { test } from "node:test";
import assert from "node:assert/strict";
import { FillState } from "../src/fill.ts";
test("tap queues exactly one global bar and then returns to the base pattern", () => {
  const f = new FillState();
  f.queue(3);
  assert.equal(f.startTick, 16);
  assert.equal(f.endTick, 32);
  assert.equal(f.state(15), "queued");
  assert.equal(f.state(16), "active");
  assert.equal(f.state(31), "active");
  assert.equal(f.state(32), "off");
  assert.equal(f.step(1, 0, 16), 1);
  assert.equal(f.step(1, 0, 32), 0);
});
test("hold/release overrides a queued fill and never edits saved steps or lane phases", () => {
  const f = new FillState(),
    steps = Array(16).fill(0),
    before = [...steps];
  f.queue(4);
  f.hold();
  assert.equal(f.state(4), "active");
  for (let tick = 0; tick < 48; tick++) f.step(3, steps[tick % 7], tick);
  assert.deepEqual(steps, before);
  f.release();
  assert.equal(f.state(48), "off");
  for (const voice of [0, 2, 7, 8]) {
    f.hold();
    for (let n = 0; n < 16; n++) assert.equal(f.step(voice, 1, n), 1);
    f.release();
  }
  f.queue(0);
  f.reset();
  assert.equal(f.state(0), "off");
  assert.equal(f.step(1, 0, 14), 0);
});
