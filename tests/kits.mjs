import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1754, height: 886 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173");
await page.locator(".step").last().waitFor();
const results = await page.evaluate(async () => {
  const { Engine } = await import("/src/audio.ts");
  const { voices } = await import("/src/state.ts");
  const { kits } = await import("/src/kits.ts");
  const results = [];
  for (const id of Object.keys(kits)) {
    const energy = [];
    for (let lane = 0; lane < 9; lane++) {
      const c = new OfflineAudioContext(1, 96000, 48000),
        e = new Engine();
      e.kit = id;
      e.trigger(lane, 1, 0, voices[lane], c, c.destination);
      const b = await c.startRendering(),
        data = b.getChannelData(0);
      let sum = 0,
        peak = 0;
      for (const x of data) {
        sum += x * x;
        peak = Math.max(peak, Math.abs(x));
        if (!Number.isFinite(x)) throw Error(`${id}/${lane} non-finite`);
      }
      energy.push(sum);
      if (sum <= 0.0001 || peak >= 1)
        throw Error(`${id}/${lane}: energy ${sum}, peak ${peak}`);
    }
    const render = async (state, patch = {}, rate = 48000) => {
      const c = new OfflineAudioContext(1, rate * 2, rate),
        e = new Engine();
      e.kit = id;
      e.trigger(5, state, 0, { ...voices[5], ...patch }, c, c.destination);
      const data = (await c.startRendering()).getChannelData(0);
      return data.reduce((a, x) => a + x * x, 0);
    };
    const closed = await render(1),
      open = await render(2);
    if (open <= closed) throw Error(`${id}: open hat should ring longer`);
    if ((await render(1, { level: 0 })) !== 0)
      throw Error("Level zero must be silent");
    await render(2, { tone: 1, tune: 1, decay: 1 }, 44100);
    results.push({ id, energy, closedHat: closed, openHat: open });
  }
  // Recipes must produce different audio, not renamed copies.
  for (let lane = 0; lane < 9; lane++)
    if (new Set(results.map((r) => r.energy[lane].toFixed(5))).size !== 4)
      throw Error(`lane ${lane} is not distinct across all kits`);
  // Verify editable parameters reach the factory DSP, using deterministic kick excitation.
  const renderKick = async (patch) => {
    const c = new OfflineAudioContext(1, 96000, 48000),
      e = new Engine();
    e.kit = "sr88";
    e.trigger(0, 1, 0, { ...voices[0], ...patch }, c, c.destination);
    return (await c.startRendering()).getChannelData(0);
  };
  const baseline = await renderKick({});
  for (const patch of [
    { level: 0.2 },
    { tune: 0.8 },
    { decay: 0.8 },
    { tone: 0.2 },
  ]) {
    const changed = await renderKick(patch);
    let difference = 0;
    for (let n = 0; n < baseline.length; n++)
      difference += Math.abs(baseline[n] - changed[n]);
    if (difference < 0.001)
      throw Error(`Unconnected parameter: ${JSON.stringify(patch)}`);
  }
  return results;
});
const before = await page.locator("#lanes").innerText();
await page.locator('[data-mute="2"]').click();
await page.locator('[data-solo="1"]').click();
for (const id of ["sr88", "808", "909", "kr55"]) {
  await page.locator("#kit").selectOption(id);
  assert.equal(await page.locator("#lanes").innerText(), before);
  assert.equal(
    await page.locator('[data-mute="2"]').getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page.locator('[data-solo="1"]').getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#play").click();
  await page.waitForTimeout(180);
  await page.locator("#stop").click();
}
await page.locator("#kit").selectOption("classic");
await page.locator("#sample").click();
await page.locator("#kit").selectOption("sr88");
assert.ok(
  (await page.locator("#analog").getAttribute("class")).includes("amber"),
);
await page.locator("#voice-knobs input").first().fill("0.4");
assert.equal(
  Number(await page.locator("#voice-knobs input").first().inputValue()),
  0.4,
);
await page.reload();
await page.waitForTimeout(200);
await page.screenshot({ path: "docs/DS-9-screenshot.png" });
assert.deepEqual(errors, []);
console.log(
  JSON.stringify(
    {
      kits: results,
      kitSwitch: "preserves patterns, mute/solo; returns to analog",
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
