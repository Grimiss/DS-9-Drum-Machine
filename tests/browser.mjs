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
assert.equal(await page.locator(".step").count(), 144);
await page.locator('[data-step="3"][data-lane="0"]').click();
assert.equal(
  await page
    .locator('[data-step="3"][data-lane="0"]')
    .getAttribute("aria-pressed"),
  "true",
);
await page.locator('[data-slot="1"]').click();
assert.equal(
  await page
    .locator('[data-step="3"][data-lane="0"]')
    .getAttribute("aria-pressed"),
  "false",
);
await page.locator('[data-slot="0"]').click();
assert.equal(
  await page
    .locator('[data-step="3"][data-lane="0"]')
    .getAttribute("aria-pressed"),
  "true",
);
await page.locator("#length").click();
await page.locator('[data-step="6"][data-lane="0"]').click();
assert.equal(await page.locator('[data-length="0"]').textContent(), "7");
await page.locator("#length").click();
await page.locator("#play").click();
await page.waitForTimeout(400);
assert.ok((await page.locator(".playing").count()) > 0);
await page.locator("#stop").click();
const audio = await page.evaluate(async () => {
  const { Engine } = await import("/src/audio.ts");
  const { voices } = await import("/src/state.ts");
  const result = [];
  for (let i = 0; i < 9; i++) {
    const c = new OfflineAudioContext(1, 48000, 48000);
    const engine = new Engine();
    engine.trigger(i, 1, 0, voices[i], c, c.destination);
    const b = await c.startRendering();
    const d = b.getChannelData(0);
    result.push({
      voice: i,
      peak: Math.max(...d.map(Math.abs)),
      energy: d.reduce((a, x) => a + x * x, 0),
    });
  }
  return result;
});
assert.ok(
  audio.every((v) => v.energy > 0 && Number.isFinite(v.peak) && v.peak < 1),
);
// Exercise the real scheduler with an offline clock and captured trigger events.
const scheduler = await page.evaluate(async () => {
  const {Sequencer}=await import('/src/sequencer.ts');
  const {emptyPattern,voices}=await import('/src/state.ts');
  const p=emptyPattern();p[0].length=7;p[1].length=12;
  const events=[];const engine={context:{currentTime:0},silence(){},trigger(){}};
  const seq=new Sequencer(engine,()=>p,voices,Array(9).fill(false));
  seq.onEvent=e=>events.push(e);seq.next=0;
  for(let n=0;n<17;n++){engine.context.currentTime=n*.125;seq.schedule();}
  const zero=events.filter(e=>e.type==='trigger'&&e.lane===0);
  const one=events.filter(e=>e.type==='trigger'&&e.lane===1);
  return {zero:zero[16].step,one:one[16].step};
});
assert.deepEqual(scheduler,{zero:2,one:4});
// Upload a real PCM WAV, then exercise sample editing.
const wav=Buffer.alloc(44+9600);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(9600,40);for(let i=0;i<4800;i++)wav.writeInt16LE(Math.round(Math.sin(i*.06)*15000),44+i*2);
await page.locator('#sample-file').setInputFiles({name:'test.wav',mimeType:'audio/wav',buffer:wav});
await page.getByRole('status').filter({hasText:'LOADED: test.wav'}).waitFor();
await page.locator('#reverse').click();assert.ok((await page.locator('#reverse').getAttribute('class')).includes('amber'));
await page.locator('#sample-knobs input').first().fill('0.25');await page.locator('#trim').click();assert.equal(await page.locator('#notice').textContent(),'SAMPLE TRIMMED IN MEMORY');
await page.locator('#voice-knobs input').first().fill('0.2');
await page.locator('#play').click();await page.waitForTimeout(200);await page.locator('#pause').click();assert.equal(await page.locator('.playing').count(),0);await page.locator('#play').click();await page.waitForTimeout(150);await page.locator('#stop').click();
await page.reload();
await page.locator(".step").last().waitFor();
await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
await page.screenshot({ path: "docs/DS-9-screenshot.png" });
assert.deepEqual(errors, []);
console.log(
  JSON.stringify({ steps: 144, interaction: "passed", audio, errors }, null, 2),
);
await browser.close();
