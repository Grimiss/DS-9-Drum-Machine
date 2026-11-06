import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.goto("http://localhost:5173");
const result = await page.evaluate(async () => {
  const { Sequencer } = await import("/src/sequencer.ts");
  const { emptyPattern, voices } = await import("/src/state.ts");
  const assert = (yes, message) => {
    if (!yes) throw Error(message);
  };
  const calls = [];
  const clock = { currentTime: 0 };
  const engine = {
    context: clock,
    unlock: async () => {},
    silence() {},
    trigger(lane, state, time, voice) {
      calls.push({ lane, state, time, level: voice.level });
    },
  };
  const p = emptyPattern();
  p[0].length = 7;
  p[1].length = 12;
  p[0].steps[0] = p[1].steps[0] = 1;
  const s = new Sequencer(engine, () => p, voices, Array(9).fill(false));
  s.mode = "BOTH";
  s.clip = () => ({
    lengthBeats: 3,
    events: [
      { id: "one", assignmentId: "kick", positionBeats: 0, velocity: 0.9 },
      { id: "flam", assignmentId: "kick", positionBeats: 0.01, velocity: 0.5 },
    ],
  });
  s.next = 0;
  for (let i = 0; i <= 48; i++) {
    clock.currentTime = i * 0.125;
    s.schedule();
  }
  const kick = calls.filter((c) => c.lane === 0),
    snare = calls.filter((c) => c.lane === 1);
  assert(
    kick.filter((c) => c.time === 0).length === 1,
    "BOTH duplicate at zero",
  );
  assert(
    kick.some((c) => Math.abs(c.time - 0.005) < 1e-8),
    "Flam was suppressed",
  );
  for (const time of [0.875, 1.75, 2.625])
    assert(
      kick.some((c) => Math.abs(c.time - time) < 1e-8),
      "Seven-step kick phase reset at clip wrap",
    );
  for (const time of [1.5, 3, 4.5])
    assert(
      snare.some((c) => Math.abs(c.time - time) < 1e-8),
      "Twelve-step snare phase reset",
    );
  s.stop();
  calls.length = 0;
  clock.currentTime = 0;
  s.mode = "MIDI";
  s.clip = () => ({
    lengthBeats: 4,
    events: [
      { id: "hat1", assignmentId: "open-hat", positionBeats: 0, velocity: 1 },
      {
        id: "hat2",
        assignmentId: "closed-hat",
        positionBeats: 0,
        velocity: 0.5,
      },
    ],
  });
  s.schedule();
  assert(calls.length === 1 && calls[0].state === 1, "Hat arbitration failed");
  s.stop();
  clock.currentTime = 0;
  s.mode = "MIDI";
  s.clip = () => ({
    lengthBeats: 4,
    events: [
      {
        id: "monitor",
        assignmentId: "kick",
        positionBeats: 0.125,
        velocity: 1,
      },
    ],
  });
  s.deferRecorded("monitor", 0.125 + 1e-10);
  calls.length = 0;
  s.schedule();
  assert(calls.length === 0, "Lookahead echoed live recording");
  s.stop();
  clock.currentTime = 10;
  s.clockMode = "SYNC";
  await s.play();
  assert(!s.timer, "SYNC started a local master without host");
  await s.followHost({
    version: 1,
    audioTime: 10,
    positionBeats: 8,
    bpm: 100,
    swing: 0.3,
    playing: true,
  });
  assert(
    s.timer && Math.abs(s.positionBeats - 8) < 1e-9,
    "Host anchor incorrect",
  );
  clock.currentTime = 10.6;
  const beat = s.positionBeats;
  assert(beat > 8, "Host clock did not advance");
  await s.followHost({
    version: 1,
    audioTime: 10.6,
    positionBeats: 2,
    bpm: 90,
    swing: 0.2,
    playing: true,
    discontinuity: true,
  });
  assert(Math.abs(s.positionBeats - 2) < 1e-8, "Host seek incorrect");
  await s.followHost({
    version: 1,
    audioTime: 10.6,
    positionBeats: 2,
    bpm: 90,
    swing: 0.2,
    playing: false,
  });
  assert(!s.timer, "Host pause ignored");
  s.disconnectHost();
  assert(!s.host && !s.timer, "Host disconnect ignored");
  let rejected = false;
  try {
    await s.followHost({
      version: 1,
      audioTime: 0,
      positionBeats: 0,
      bpm: NaN,
      swing: 0,
      playing: true,
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "Invalid host snapshot accepted");
  s.clockMode = "FREE";
  s.stop();
  clock.currentTime = 0;
  await s.play();
  clock.currentTime = 0.8;
  const before = s.positionBeats;
  s.setTiming(180, 0.4);
  assert(
    Math.abs(s.positionBeats - before) < 0.04,
    "Tempo change jumps position",
  );
  s.pause();
  const paused = s.positionBeats;
  clock.currentTime = 1.8;
  assert(s.positionBeats === paused, "Pause clock drift");
  await s.play();
  assert(Math.abs(s.positionBeats - paused) < 0.2, "Resume lost phase");
  s.stop();
  const {Engine}=await import('/src/audio.ts');
  async function hatTail(choked,reverseOrder){
    const c=new OfflineAudioContext(1,96000,48000),e=new Engine();e.context=c;
    const v={...voices[5],decay:.7};
    if(choked&&reverseOrder)e.trigger(5,1,.14,v,c,c.destination);
    e.trigger(5,2,.02,v,c,c.destination);
    if(choked&&!reverseOrder)e.trigger(5,1,.14,v,c,c.destination);
    const data=(await c.startRendering()).getChannelData(0);let tail=0;for(let n=14400;n<28800;n++)tail+=data[n]*data[n];return tail;
  }
  const tail=await hatTail(false,false);assert(tail>0,'Open hat has no tail');
  assert(await hatTail(true,false)<tail*.05,'Closed hat did not choke open hat');
  assert(await hatTail(true,true)<tail*.05,'Live hat ignored queued future choke');
  return {
    hats:"rendered choke verified in chronological and live/queued order",
    polymeters: "7/12 steps against a 3-beat MIDI loop",
    collisions: "exact merged; 5 ms flam preserved",
    host: "start, seek, pause, disconnect, malformed snapshot",
    monitor: "no same-cycle playback echo",
    timing: "tempo, swing, pause/resume",
  };
});
console.log(result);
await browser.close();
