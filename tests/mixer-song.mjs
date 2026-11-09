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
try {
  await page.goto("http://localhost:5173");
  await page.locator(".track-knobs").last().waitFor();
  // Song changes and song loops preserve each lane's global polymetric phase.
  const phases = await page.evaluate(async () => {
    const { Sequencer } = await import("/src/sequencer.ts");
    const { SongState } = await import("/src/song.ts");
    const { emptyPattern, voices } = await import("/src/state.ts");
    const a = emptyPattern(),
      b = emptyPattern();
    for (const p of [a, b]) {
      p[0].length = 7;
      p[1].length = 12;
    }
    const song = new SongState();
    song.data = {
      mode: "SONG",
      loop: true,
      entries: [
        { id: "a", pattern: 0, bars: 1 },
        { id: "b", pattern: 1, bars: 1 },
      ],
    };
    const clock = { currentTime: 0 };
    const engine = { context: clock, trigger() {}, silence() {} };
    const seq = new Sequencer(engine, () => a, voices, Array(9).fill(false));
    seq.patternAtTick = (t) => [a, b][song.position(t).entry.pattern];
    const events = [];
    seq.onEvent = (e) => events.push(e);
    for (let t = 0; t < 48; t++) {
      clock.currentTime = t * 0.125;
      seq.schedule();
    }
    return [16, 32].map((t) =>
      events.filter((e) => e.tick === t && e.lane < 2).map((e) => e.step),
    );
  });
  assert.deepEqual(phases, [
    [2, 4],
    [4, 8],
  ]);
  const grid = await page.locator(".steps").first().boundingBox(),
    knobs = await page.locator(".track-knobs").first().boundingBox();
  assert(knobs.x >= grid.x + grid.width);
  await page.screenshot({ path: "test-results/arrange-tablet.png" });
  await page.locator("#mixer-open").click();
  assert.equal(await page.locator("#mixer-dialog input").count(), 36);
  const fader = page.locator(
    '#mixer-dialog input[data-control-voice="0"][data-param="level"]',
  );
  await fader.fill("0.24");
  assert.equal(
    await page.locator("#track-knobs-0 input").first().inputValue(),
    "0.24",
  );
  await fader.hover();
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(50);
  assert.equal(await fader.inputValue(), "0.25");
  await page.locator('[data-mixer-solo="0"]').click();
  await page.locator('[data-mixer-solo="1"]').click();
  assert.equal(await page.locator(".mixer-switches .soloed").count(), 2);
  await page.locator('[data-mixer-mute="0"]').click();
  assert.equal(
    await page.locator('[data-mute="0"]').getAttribute("aria-pressed"),
    "true",
  );
  await page.screenshot({ path: "test-results/mixer-tablet.png" });
  await page.locator('[data-mixer-sample="2"]').click();
  assert.match(await page.locator("#sample-dialog-title").innerText(), /CLAP/);
  await page.locator("#sample-close").click();
  await page.waitForTimeout(30);
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.mixerSample),
    "2",
  );
  await page.locator("#mixer-close").click();
  await page.locator("#track-knobs-0 input").first().fill("0.65");
  await page.locator("#mixer-open").click();
  assert.equal(await fader.inputValue(), "0.65");
  await page.locator("#mixer-close").click();
  // Song UI: A followed by B, naturally ending after two bars.
  await page.locator("#bpm").fill("300");
  await page.locator("#bpm").dispatchEvent("change");
  await page.locator("#song-open").click();
  await page.locator("#song-mode").selectOption("SONG");
  await page.locator("#song-add").click();
  await page
    .getByLabel("Song row 2 pattern", { exact: true })
    .selectOption("1");
  assert.equal(await page.locator("#song-mode").inputValue(), "SONG");
  await page.screenshot({ path: "test-results/song-tablet.png" });
  await page.locator("#song-play").click();
  await page.waitForTimeout(250);
  assert(await page.locator("#song-mode").isDisabled());
  await page.waitForFunction(
    () => document.querySelector("#pattern-name").textContent === "B",
  );
  await page.waitForFunction(
    () => !document.querySelector("#play").classList.contains("active"),
  );
  assert(await page.locator("#song-mode").isEnabled());
  await page.locator("#song-loop").check();
  await page.locator("#song-play").click();
  await page.waitForTimeout(1900);
  assert(
    await page
      .locator("#play")
      .evaluate((el) => el.classList.contains("active")),
  );
  await page.locator("#song-pause").click();
  assert(await page.locator("#song-mode").isEnabled());
  await page.locator("#song-play").click();
  await page.waitForTimeout(100);
  await page.locator("#song-stop").click();
  await page.locator("#song-close").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#save").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let json = "";
  for await (const chunk of stream) json += chunk;
  const saved = JSON.parse(json);
  assert.equal(saved.arrangement.mode, "SONG");
  assert.equal(saved.arrangement.loop, true);
  assert.equal(saved.arrangement.entries[1].pattern, 1);
  await page
    .locator("#pattern-file")
    .setInputFiles({
      name: "legacy.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ version: 1, patterns: saved.patterns }),
      ),
    });
  await page.waitForTimeout(80);
  await page.locator("#song-open").click();
  assert.equal(await page.locator("#song-mode").inputValue(), "PATTERN");
  await page.locator("#song-close").click();
  await page
    .locator("#pattern-file")
    .setInputFiles({
      name: "song.json",
      mimeType: "application/json",
      buffer: Buffer.from(json),
    });
  await page.waitForTimeout(80);
  await page.locator("#song-open").click();
  assert.equal(await page.locator("#song-mode").inputValue(), "SONG");
  assert.equal(await page.locator(".song-row").count(), 2);
  assert(await page.locator("#song-loop").isChecked());
  await page.locator("#song-close").click();
  // Actual ringing audio responds to live gain and mute, without retriggering.
  const levels = await page.evaluate(async () => {
    const { Engine } = await import("/src/audio.ts");
    const { voices } = await import("/src/state.ts");
    const e = new Engine();
    await e.unlock();
    const a = e.context.createAnalyser();
    a.fftSize = 2048;
    e.master.connect(a);
    e.setTrackLevel(8, 0.7);
    e.trigger(8, 1, e.context.currentTime, {
      ...voices[8],
      level: 0.7,
      decay: 1,
      mode: "analog",
    });
    const rms = async () => {
      await new Promise((r) => setTimeout(r, 110));
      const f = new Float32Array(a.fftSize);
      a.getFloatTimeDomainData(f);
      return Math.sqrt(f.reduce((s, v) => s + v * v, 0) / f.length);
    };
    const before = await rms();
    e.setTrackLevel(8, 0);
    const down = await rms();
    e.setTrackLevel(8, 0.7);
    const restored = await rms();
    e.setAudibility(
      Array.from({ length: 9 }, (_, i) => i === 8),
      Array(9).fill(false),
    );
    const muted = await rms();
    e.silence();
    await e.context.close();
    return { before, down, restored, muted };
  });
  assert(levels.before > 0.00001, JSON.stringify(levels));
  assert(levels.down < levels.before * 0.05, JSON.stringify(levels));
  assert(levels.restored > levels.down * 10, JSON.stringify(levels));
  assert(levels.muted < levels.restored * 0.05, JSON.stringify(levels));
  assert.deepEqual(errors, []);
  console.log(
    "PASS: grid order, mixer sync/multi-solo/nested sample, song end/loop/pause/save/legacy recall, live audio tail gain/mute",
    levels,
  );
} finally {
  await browser.close();
}
