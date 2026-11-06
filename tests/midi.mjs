import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1754, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const port = {
    id: "test-controller",
    name: "Test MIDI input",
    onmidimessage: null,
  };
  window.testPort = port;
  Object.defineProperty(navigator, "requestMIDIAccess", {
    value: async () => {if(window.denyMidi)throw Error("Input permission denied (test)");return ({
      inputs: new Map([[port.id, port]]),
      onstatechange: null,
    });},
  });
});
await page.goto("http://localhost:5173");
await page.locator(".step").last().waitFor();
await page.locator("#midi-edit").click();
assert.equal(await page.locator(".midi-label").count(), 10);
const grid = page.locator("#midi-notes");
const box = await grid.boundingBox();
const x = box.x,
  y = box.y,
  scale = box.width / 4;
await page.mouse.move(x + 3, y + 19);
await page.mouse.down();
await page.mouse.move(x + scale * 1.1, y + 19, { steps: 20 });
await page.mouse.up();
const painted = await page.locator(".midi-note").count();
assert.ok(painted >= 4);
await page.keyboard.down("Control");
await page.locator(".midi-note").first().click();
await page.keyboard.up("Control");
assert.equal(await page.locator(".midi-note").count(), painted - 1);
await page.locator("#midi-undo").click();
assert.equal(await page.locator(".midi-note").count(), painted);
const first = page.locator(".midi-note").first();
const pos = await first.boundingBox();
await page.mouse.move(pos.x + 4, pos.y + 8);
await page.mouse.down();
await page.mouse.move(x + scale * 2.5, y + 57, { steps: 15 });
await page.mouse.up();
await page.locator("#midi-velocity").fill("0.35");
assert.equal(await page.locator("#midi-velocity-value").textContent(), "44");
await page.locator("#midi-position").fill("2.123");
await page.locator("#midi-position").press("Tab");
assert.equal(Number(await page.locator("#midi-position").inputValue()), 2.123);
await page.locator("#midi-length").fill("9");
await page.locator("#midi-length").press("Tab");
assert.equal(Number(await page.locator("#midi-length").inputValue()), 9);
await page.locator("#midi-close").click();
await page.locator("#length").click();
await page.locator('[data-lane="0"][data-step="6"]').click();
await page.locator('[data-lane="1"][data-step="11"]').click();
await page.locator("#length").click();
await page.locator('[data-slot="1"]').click();
await page.locator("#midi-edit").click();
assert.equal(await page.locator(".midi-note").count(), 0);
await page.locator("#midi-mode").selectOption("BOTH");
await page.locator("#midi-quantize").selectOption("0");
await page.locator("#midi-length").fill("7");
await page.locator("#midi-length").press("Tab");
await page.locator("#midi-connect").click();
await page.locator("#midi-input").selectOption("test-controller");
await page.locator("#midi-arm").click();
await page.waitForTimeout(100);
await page.locator(".midi-label button").nth(0).click();
await page.waitForTimeout(25);
await page.locator(".midi-label button").nth(0).click();
await page.evaluate(() => {
  window.testPort.onmidimessage({
    data: new Uint8Array([0x90, 38, 100]),
    receivedTime: performance.now(),
  });
  window.testPort.onmidimessage({
    data: new Uint8Array([0x90, 38, 0]),
    receivedTime: performance.now(),
  });
});
await page.waitForTimeout(30);
await page.locator("#midi-arm").click();
assert.equal(await page.locator(".midi-note").count(), 3);
await page.locator("#midi-undo").click();
assert.equal(await page.locator(".midi-note").count(), 0);
await page.locator("#midi-redo").click();
assert.equal(await page.locator(".midi-note").count(), 3);
await page.locator("#midi-close").click();
await page.locator("#stop").click();
await page.locator("#kit").selectOption("sr88");
// Actual WAV import must survive full-session export and recall.
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
await page
  .locator("#sample-file")
  .setInputFiles({
    name: "session-test.wav",
    mimeType: "audio/wav",
    buffer: wav,
  });
await page.waitForFunction(() =>
  document.querySelector("#notice").textContent.includes("LOADED"),
);
await page.locator("#midi-edit").click();
page.once("dialog", (d) => d.accept("Bass <x>"));
await page.locator(".midi-label button").first().dblclick();
assert.equal(
  await page.locator(".midi-label button").first().textContent(),
  "Bass <x>",
);
await page.locator(".midi-label input").first().fill("72");
await page.locator(".midi-label input").first().press("Tab");

await page.locator("#midi-close").click();
const downloadPromise = page.waitForEvent("download");
await page.locator("#save").click();
const download = await downloadPromise;
const text = await readFile(await download.path(), "utf8");
const session = JSON.parse(text);
assert.equal(session.version, 2);
assert.equal(session.assets.length, 1);
assert.equal(session.clips[1].events.length, 3);
assert.equal(session.clips[1].lengthBeats, 7);
assert.equal(session.patterns[0][0].length, 7);
assert.equal(session.patterns[0][1].length, 12);
assert.equal(session.kit, "sr88");
assert.equal(session.playback, "BOTH");
assert.equal(session.assignments[0].name, "Bass <x>");
assert.equal(session.assignments[0].note, 72);
await page.reload();
await page
  .locator("#pattern-file")
  .setInputFiles({
    name: "session.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
await page.waitForFunction(() =>
  document.querySelector("#notice").textContent.includes("Session loaded"),
);
assert.equal(await page.locator("#kit").inputValue(), "sr88");
assert.equal(
  await page.locator('[data-slot="1"]').getAttribute("class"),
  "amber",
);
await page.locator("#midi-edit").click();
assert.equal(await page.locator(".midi-note").count(), 3);
assert.equal(await page.locator("#midi-input").inputValue(), ""); // no permission/device is auto-opened
assert.equal(
  await page.locator(".midi-label button").first().textContent(),
  "Bass <x>",
);
await page.locator("#midi-close").click();
const recalledDownloadPromise=page.waitForEvent('download');await page.locator('#save').click();const recalledDownload=await recalledDownloadPromise;const recalled=JSON.parse(await readFile(await recalledDownload.path(),'utf8'));
assert.deepEqual(recalled.voices,session.voices);assert.deepEqual(recalled.assets,session.assets);assert.deepEqual(recalled.clips,session.clips);
// Invalid imports leave the loaded session intact.
await page
  .locator("#pattern-file")
  .setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":2}'),
  });
await page.waitForFunction(() =>
  document.querySelector("#notice").textContent.includes("Could not load"),
);
assert.equal(await page.locator("#kit").inputValue(), "sr88");
// SYNC never silently becomes a local master; host timestamps use local AudioContext time.
await page.locator("#midi-edit").click();
await page.locator("#midi-clock").selectOption("SYNC");
assert.ok(await page.locator("#play").isDisabled());
await page.locator("#midi-arm").click();
assert.equal(
  await page.locator("#record").getAttribute("aria-pressed"),
  "false",
);
await page.locator("#midi-close").click();
await page.evaluate(async () => {
  const entry=document.querySelector('script[src*="src/main.ts"]').src;const {instrumentAdapter}=await import(entry);
  const clock = instrumentAdapter.clockReference();
  await instrumentAdapter.followClock({
    version: 1,
    audioTime: clock.audioTime,
    positionBeats: 8,
    bpm: 120,
    swing: 0.2,
    playing: true,
    discontinuity: true,
  });
});
await page.waitForTimeout(180);
await page.evaluate(async () => {
  const entry=document.querySelector('script[src*="src/main.ts"]').src;const {instrumentAdapter}=await import(entry);
  instrumentAdapter.disconnect();
});
await page.locator('#midi-edit').click();const editorScreenshot=await page.screenshot();
await page.reload();await page.evaluate(()=>{window.denyMidi=true;});await page.locator('#midi-edit').click();await page.locator('#midi-connect').click();await page.waitForTimeout(150);assert.ok((await page.locator('#midi-status').textContent()).includes('Input permission denied'));
assert.deepEqual(errors, []);
console.log(
  "MIDI editor paint/erase/move/velocity, undo/redo, live/on-screen recording, complete session+audio recall, legacy foundation and SYNC boundary: passed",
);
await browser.close();await writeFile('docs/MIDI-editor-screenshot.png',editorScreenshot);
