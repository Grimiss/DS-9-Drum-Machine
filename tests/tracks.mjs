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
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  window.micRequests = 0;
  window.gainEvents = [];
  if (navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async () => {
      window.micRequests++;
      throw Error("Microphone must not be requested");
    };
  const create = AudioContext.prototype.createGain;
  AudioContext.prototype.createGain = function () {
    const g = create.call(this),
      set = g.gain.setValueAtTime.bind(g.gain);
    g.gain.setValueAtTime = (value, time) => {
      window.gainEvents.push(value);
      return set(value, time);
    };
    const target = g.gain.setTargetAtTime.bind(g.gain);
    g.gain.setTargetAtTime = (value, time, constant) => {
      window.gainEvents.push(value);
      return target(value, time, constant);
    };
    return g;
  };
  const decode = AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData = async function (data) {
    const result = await decode.call(this, data);
    if (window.delayDecode)
      await new Promise((r) => (window.releaseDecoded = r));
    return result;
  };
});
await page.goto("http://localhost:5173");
await page.locator(".track-knobs").last().waitFor();
assert.equal(await page.locator(".track-knobs input").count(), 36);
assert.equal(await page.locator("[data-sample]").count(), 9);
assert.equal(await page.locator(".step").count(), 144);
// Every parameter belongs to its own instrument and survives selecting another track.
for (let voice = 0; voice < 9; voice++)
  for (let parameter = 0; parameter < 4; parameter++)
    await page
      .locator(`#track-knobs-${voice} input`)
      .nth(parameter)
      .fill(String(Number((0.2 + voice * 0.05 + parameter * 0.03).toFixed(2))));
for (let voice = 0; voice < 9; voice++)
  for (let parameter = 0; parameter < 4; parameter++)
    assert.equal(
      Number(
        await page
          .locator(`#track-knobs-${voice} input`)
          .nth(parameter)
          .inputValue(),
      ),
      Number((0.2 + voice * 0.05 + parameter * 0.03).toFixed(2)),
    );
for (let voice = 0; voice < 9; voice++) {
  await page.locator(`[data-sample="${voice}"]`).tap();
  assert.ok(
    (await page.locator("#sample-dialog-title").textContent()).includes(
      [
        "KICK",
        "SNARE",
        "CLAP",
        "LOW TOM",
        "HIGH TOM",
        "HI-HAT",
        "PERCUSSION",
        "CLAVES",
        "CYMBAL",
      ][voice],
    ),
  );
  assert.equal(
    Number(
      await page
        .locator('#sample-knobs input[data-param="decay"]')
        .inputValue(),
    ),
    Number((0.26 + voice * 0.05).toFixed(2)),
  );
  const r = await page.locator("#sample-dialog").boundingBox();
  assert.ok(r.y >= 0 && r.y + r.height <= 638);
  await page.locator("#sample-close").tap();
}
// Black-box DSP check: each track's level reaches its live audio channel bus.
await page.locator('#track-knobs-0 input[data-param="level"]').fill("0.2");
await page.evaluate(() => (window.gainEvents = []));
await page.locator('[data-voice="0"]').tap();
assert.ok(
  await page.evaluate(() =>
    window.gainEvents.some((x) => Math.abs(x - 0.2) < 1e-9),
  ),
);
await page.evaluate(() => (window.gainEvents = []));
await page.locator('#track-knobs-1 input[data-param="level"]').fill("0.8");
await page.locator('[data-voice="1"]').tap();
assert.ok(
  await page.evaluate(() =>
    window.gainEvents.some((x) => Math.abs(x - 0.8) < 1e-9),
  ),
);
assert.equal(
  Number(
    await page.locator('#track-knobs-0 input[data-param="level"]').inputValue(),
  ),
  0.2,
);
await page.locator('[data-sample="0"]').tap();
await page.locator('#sample-knobs input[data-param="decay"]').fill("0.9");
await page.locator("#sample-close").tap();
assert.equal(
  Number(
    await page.locator('#track-knobs-0 input[data-param="decay"]').inputValue(),
  ),
  0.9,
);
assert.equal(
  Number(
    await page.locator('#track-knobs-1 input[data-param="decay"]').inputValue(),
  ),
  0.31,
);
const wav = Buffer.alloc(44 + 9600);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(48000, 24);
wav.writeUInt32LE(96000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(9600, 40);
for (let i = 0; i < 4800; i++)
  wav.writeInt16LE(Math.round(Math.sin(i * 0.06) * 15000), 44 + i * 2);
await page.locator('[data-sample="0"]').tap();
await page.evaluate(() => (window.delayDecode = true));
await page
  .locator("#sample-file")
  .setInputFiles({ name: "kick-test.wav", mimeType: "audio/wav", buffer: wav });
await page.waitForFunction(() => typeof window.releaseDecoded === "function");
await page.locator("#next").tap();
await page.evaluate(() => {
  window.releaseDecoded();
  window.delayDecode = false;
});
await page.waitForFunction(() =>
  document
    .querySelector("#notice")
    .textContent.includes("LOADED: kick-test.wav"),
);
assert.equal(await page.locator("#voice-name").textContent(), "VOICE: SNARE");
await page.locator("#sample-close").tap();
assert.ok(
  (await page.locator('[data-sample="0"]').getAttribute("class")).includes(
    "amber",
  ),
);
assert.ok(
  !(await page.locator('[data-sample="1"]').getAttribute("class")).includes(
    "amber",
  ),
);
await page.locator('[data-sample="0"]').tap();
await page.locator('#sample-knobs input[data-param="start"]').fill("0.25");
await page.locator('#sample-knobs input[data-param="end"]').fill("0.75");
await page.locator("#trim").tap();
assert.equal(
  await page.locator("#notice").textContent(),
  "SAMPLE TRIMMED IN MEMORY",
);
assert.equal(
  Number(
    await page.locator('#sample-knobs input[data-param="start"]').inputValue(),
  ),
  0,
);
assert.equal(
  Number(
    await page.locator('#sample-knobs input[data-param="end"]').inputValue(),
  ),
  1,
);
await page.locator("#reverse").tap();
assert.ok(
  (await page.locator("#reverse").getAttribute("class")).includes("amber"),
);
await page.locator("#sample-preview").tap();
await page.locator("#sample-close").tap();
await page.locator('[data-sample="1"]').tap();
assert.ok(
  !(await page.locator("#reverse").getAttribute("class")).includes("amber"),
);
await page.locator("#sample-close").tap();
assert.equal(await page.evaluate(() => window.micRequests), 0);
assert.deepEqual(errors, []);
await page.reload();
await page.waitForTimeout(100);
await page.screenshot({ path: "test-results/tracks-tablet.png" });
await page.locator('[data-sample="5"]').tap();
await page.screenshot({ path: "test-results/sample-dialog.png" });
console.log(
  "36 isolated track parameters, actual voice gain routing, nine sample dialogs, editing, preview, async target safety, tablet fit and no microphone requests: passed",
);
await browser.close();
