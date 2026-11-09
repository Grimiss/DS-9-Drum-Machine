import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 638 },
  hasTouch: true,
  isMobile: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173");
await page.locator(".step").last().waitFor();
const rendering = await page.evaluate(async () => {
  const { Sequencer } = await import("/src/sequencer.ts");
  const { emptyPattern, voices } = await import("/src/state.ts");
  const p = emptyPattern();
  p[0].length = 7;
  p[1].length = 12;
  p[0].steps[0] = 1;
  const before = JSON.stringify(p),
    calls = [],
    c = { currentTime: 0 };
  const engine = {
    context: c,
    silence() {},
    trigger(lane, state, time) {
      calls.push({ lane, state, time });
    },
  };
  const seq = new Sequencer(engine, () => p, voices, Array(9).fill(false));
  seq.fill.queue(0);
  for (let n = 0; n < 32; n++) {
    c.currentTime = n * 0.125;
    seq.schedule();
  }
  return {
    before,
    after: JSON.stringify(p),
    fillHits: calls.filter((h) => h.lane === 1),
    kick: calls.filter((h) => h.lane === 0),
  };
});
assert.equal(rendering.before, rendering.after);
assert.ok(rendering.fillHits.length > 0);
assert.ok(rendering.fillHits.every((h) => h.time < 2));
assert.ok(rendering.kick.some((h) => Math.abs(h.time - 0.875) < 1e-9));
const pattern = await page
  .locator(".step")
  .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-pressed")));
await page.locator("#bpm").fill("300");
await page.locator("#bpm").press("Tab");
await page.locator("#fill").tap();
await page.waitForFunction(
  () => document.querySelector("#fill").dataset.state === "active",
);
await page.waitForFunction(
  () => document.querySelector("#fill").dataset.state === "off",
);
assert.ok(
  (await page.locator("#play").getAttribute("class")).includes("active"),
);
assert.deepEqual(
  await page
    .locator(".step")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-pressed"))),
  pattern,
);
await page.locator("#stop").tap();
const b = await page.locator("#fill").boundingBox();
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await page.mouse.down();
await page.waitForFunction(
  () => document.querySelector("#fill").getAttribute("aria-pressed") === "true",
);
await page.mouse.move(1100, 600);
await page.mouse.up();
await page.waitForFunction(
  () => document.querySelector("#fill").dataset.state === "off",
);
assert.deepEqual(
  await page
    .locator(".step")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-pressed"))),
  pattern,
);
await page.locator("#stop").tap();
const cdp = await page.context().newCDPSession(page);
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [
    {
      x: b.x + b.width / 2,
      y: b.y + b.height / 2,
      id: 1,
      force: 1,
      radiusX: 9,
      radiusY: 9,
    },
  ],
});
await page.waitForFunction(
  () => document.querySelector("#fill").dataset.state === "active",
);
await page.waitForTimeout(700);
assert.equal(await page.locator("#fill").getAttribute("aria-pressed"), "true");
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchCancel",
  touchPoints: [],
});
await page.waitForFunction(
  () => document.querySelector("#fill").dataset.state === "off",
);
await page.locator("#stop").tap();
assert.deepEqual(errors, []);
console.log(
  "Tap one-bar fill, hold/release outside button, return to base pattern, unchanged data and polymetric phase: passed",
);
await browser.close();
