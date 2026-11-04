import { test } from "node:test";
import assert from "node:assert/strict";
import { demo, emptyPattern, clone, position, interval } from "../src/state.ts";
test("144 independently editable steps and lengths", () => {
  const p = emptyPattern();
  assert.equal(p.flatMap((l) => l.steps).length, 144);
  p[0].steps[3] = 1;
  assert.equal(p[1].steps[3], 0);
  for (let length = 1; length <= 16; length++) {
    assert.equal(position(length, length), 0);
    assert.equal(position(length + 1, length), 1 % length);
  }
});
test("polymetric lane positions diverge", () => {
  assert.equal(position(16, 7), 2);
  assert.equal(position(16, 16), 0);
});
test("pattern switching and copying preserve independent memory", () => {
  const patterns = [demo(), emptyPattern(), emptyPattern(), emptyPattern()];
  const original = clone(patterns[0]);
  patterns[1] = clone(patterns[0]);
  patterns[1][0].steps[0] = 0;
  patterns[1][0].length = 3;
  assert.deepEqual(patterns[0], original);
});
test("swing preserves pair duration", () => {
  assert.equal(interval(0, 120, 0.5), 0.1875);
  assert.equal(interval(1, 120, 0.5), 0.0625);
  assert.equal(interval(0, 120, 0.5) + interval(1, 120, 0.5), 0.25);
});
