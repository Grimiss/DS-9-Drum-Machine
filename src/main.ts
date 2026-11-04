import { kits, type KitId } from "./kits";
import "./style.css";
import { names, voices, demo, emptyPattern, clone } from "./state";
import { Engine } from "./audio";
import { Sequencer } from "./sequencer";
let patterns = [demo(), emptyPattern(), emptyPattern(), emptyPattern()],
  slot = 0,
  selected = 5,
  lengthMode = false,
  clipboard = emptyPattern();
const muted = names.map(() => false),
  solo = names.map(() => false),
  engine = new Engine(),
  seq = new Sequencer(engine, () => patterns[slot], voices, muted, solo);
const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = `<div class="machine"><header><b>GRIMISS <em>DS-9</em></b><i>Analog Drum Machine / Sample Sequencer</i><div class="kit-bank"><label for="kit">FACTORY KIT</label><select id="kit" aria-label="Factory kit"><option value="classic">DS-9 ORIGINAL</option>${Object.entries(kits).map(([id,k])=>`<option value="${id}">${k.label}</option>`).join("")}</select></div></header><section class="sequencer"><div class="numbers"><span>STEP</span>${Array.from({ length: 16 }, (_, i) => `<span>${i + 1}</span>`).join("")}<span>LEN</span></div><div id="lanes"></div><div class="legend"><b class="key"></b> = OFF <b class="key amber"></b> = CLOSED HI-HAT (CH) <b class="key red"></b> = OPEN HI-HAT (OH) <b class="key alt"></b> = CH → OH (ALT)</div></section><section class="editor"><div class="voice-heading"><button id="prev">◀︎</button><div class="display" id="voice-name"></div><button id="next">▶︎</button></div><div class="modes"><button id="analog">ANALOG</button><button id="sample">SAMPLE</button><button id="load-sample">LOAD</button></div><div class="knobs" id="voice-knobs"></div><div class="hat-controls"><fieldset><legend>HI-HAT MODE</legend><button id="closed">CLOSED</button><button id="open">OPEN</button></fieldset><fieldset><legend>CHOKE</legend><button class="amber" disabled title="Closed hi-hats always choke open hats">OH → CH</button></fieldset></div><fieldset class="sample-edit"><legend>SAMPLE EDIT</legend><canvas id="wave" width="310" height="80"></canvas><button id="trim">TRIM</button><button id="reverse">REV</button><div class="knobs" id="sample-knobs"></div></fieldset><div id="notice" role="status">SELECT A VOICE • CLICK ITS NAME TO AUDITION</div></section><footer><div class="transport"><button id="play" class="green">▶︎</button><button id="stop">■</button><button id="record" disabled title="Live recording is planned">●</button><button id="pause">Ⅱ</button></div><div class="tempo"><label>TEMPO</label><div><button id="slower">◀︎</button><input id="bpm" class="display" type="number" min="30" max="300" value="120.0"><button id="faster">▶︎</button></div></div><div class="swing"><label>SWING</label><div id="swing-knob"></div></div><div class="pattern"><label>PATTERN</label><div><button id="pattern-prev">◀︎</button><span class="display" id="pattern-name">A</span><button id="pattern-next">▶︎</button></div></div><div id="slots">${["A", "B", "C", "D"].map((n, i) => `<button data-slot="${i}">${n}</button>`).join("")}</div><button id="length">SET<br>LENGTH</button><div class="link"><span>○ LINK GMC-9000</span><div><button disabled title="Future GMC integration">LAYER</button><button disabled title="Future GMC integration">REPLACE</button></div></div><button id="reset">RESET<br>ALL</button><div class="files"><button id="load">LOAD</button><button id="save">SAVE</button><button id="copy">COPY</button><button id="paste">PASTE</button></div><button id="clear">CLEAR</button></footer>${[0, 1, 2, 3, 4, 5].map((i) => `<span class="screw s${i}">✦</span>`).join("")}</div><input id="sample-file" type="file" accept="audio/wav,audio/*" hidden><input id="pattern-file" type="file" accept="application/json" hidden>`;
const $ = (id: string) => document.getElementById(id)!;
const click = (id: string, fn: () => void) =>
  $(id).addEventListener("click", fn);
$("kit").addEventListener('change',()=>{
  engine.silence();
  engine.kit=($("kit") as HTMLSelectElement).value as KitId;
  // Keep the sequence, mix levels, mute/solo and imported buffers intact.
  voices.forEach(v=>{v.mode='analog';v.tune=.5;v.decay=.4;v.tone=.5;});
  render();controls();
  $("notice").textContent=engine.kit==='classic'?'DS-9 ORIGINAL SYNTHESIS':kits[engine.kit].description;
  $("kit").title=$("notice").textContent!;
});
function render() {
  $("lanes").innerHTML = patterns[slot]
    .map(
      (l, i) =>
        `<div class="lane ${i === selected ? "selected" : ""}"><div class="track-switches"><button class="mute ${muted[i] ? 'engaged' : ''}" data-mute="${i}" aria-label="Mute ${names[i]}" aria-pressed="${muted[i]}">M</button><button class="solo ${solo[i] ? 'engaged' : ''}" data-solo="${i}" aria-label="Solo ${names[i]}" aria-pressed="${solo[i]}">S</button></div><button class="display name" data-voice="${i}">${names[i]}</button><div class="steps">${l.steps.map((s, n) => `<button aria-label="${names[i]} step ${n + 1}" aria-pressed="${!!s}" data-lane="${i}" data-step="${n}" class="step ${s === 2 ? "red" : s ? "amber" : ""} ${n >= l.length ? "outside" : ""}"></button>`).join("")}</div><button class="length" data-length="${i}" title="Click to increase; right click to decrease">${l.length}</button></div>`,
    )
    .join("");
  $("voice-name").textContent = `VOICE: ${names[selected]}`;
  $("pattern-name").textContent = "ABCD"[slot];
  document
    .querySelectorAll("[data-slot]")
    .forEach((b) =>
      b.classList.toggle("amber", +(b as HTMLElement).dataset.slot! === slot),
    );
  $("length").classList.toggle("amber", lengthMode);
  $("analog").classList.toggle("amber", voices[selected].mode === "analog");
  $("sample").classList.toggle("amber", voices[selected].mode === "sample");
  $("reverse").classList.toggle("amber", voices[selected].reverse);
  drawWave();
}
function knob(
  container: string,
  label: string,
  value: number,
  change: (n: number) => void,
) {
  const wrap = document.createElement("label");
  wrap.className = "knob-wrap";
  wrap.innerHTML = `<span>${label}</span><input type="range" min="0" max="1" step="0.01" value="${value}" aria-label="${label}"><b class="knob"><i></i></b>`;
  const input = wrap.querySelector("input")!;
  const update = () => {
    wrap.style.setProperty("--angle", `${-135 + Number(input.value) * 270}deg`);
    change(Number(input.value));
  };
  input.oninput = update;
  wrap.style.setProperty("--angle", `${-135 + value * 270}deg`);
  $(container).append(wrap);
}
function controls() {
  $("voice-knobs").innerHTML = "";
  (["level", "tune", "decay", "tone"] as const).forEach((k) =>
    knob(
      "voice-knobs",
      k.toUpperCase(),
      voices[selected][k],
      (n) => (voices[selected][k] = n),
    ),
  );
  $("sample-knobs").innerHTML = "";
  (["start", "end", "pitch"] as const).forEach((k) =>
    knob("sample-knobs", k.toUpperCase(), voices[selected][k], (n) => {
      voices[selected][k] = n;
      drawWave();
    }),
  );
  knob(
    "sample-knobs",
    "DECAY",
    voices[selected].decay,
    (n) => (voices[selected].decay = n),
  );
}
function drawWave() {
  const c = ($("wave") as HTMLCanvasElement).getContext("2d")!;
  c.clearRect(0, 0, 310, 80);
  c.strokeStyle = "#d5e793";
  c.lineWidth = 1;
  c.beginPath();
  const sample = voices[selected].sample?.getChannelData(0);
  for (let x = 0; x < 310; x++) {
    const amplitude = sample
      ? sample[Math.floor((x / 310) * sample.length)] * 32
      : Math.sin(x * 2.8) * Math.exp(-x / 55) * 32;
    c.lineTo(x, 40 + amplitude);
  }
  c.stroke();
  if(!sample){c.font="10px monospace";c.fillStyle="#d5e793";c.fillText("ANALOG ENVELOPE PREVIEW",110,72);}
  c.fillStyle = "#d5e79311";
  c.fillRect(
    voices[selected].start * 310,
    0,
    (voices[selected].end - voices[selected].start) * 310,
    80,
  );
}
function select(i: number) {
  selected = (i + 9) % 9;
  render();
  controls();
}
function editStep(button: HTMLElement) {
  const lane=Number(button.dataset.lane), step=Number(button.dataset.step);
  const l=patterns[slot][lane];
  if(lengthMode) l.length=step+1;
  else l.steps[step]=(l.steps[step]+1)%(lane===5?3:2);
  // Preserve DOM nodes while dragging so pointer tracking and focus stay stable.
  const row=button.closest('.lane')!;
  row.querySelector('[data-length]')!.textContent=String(l.length);
  row.querySelectorAll<HTMLElement>('.step').forEach((b,n)=>{
    b.classList.toggle('amber',l.steps[n]===1);
    b.classList.toggle('red',l.steps[n]===2);
    b.classList.toggle('outside',n>=l.length);
    b.setAttribute('aria-pressed',String(!!l.steps[n]));
  });
}
let dragPointer: number | undefined;
const visited=new Set<string>();
function paintStep(target: Element | null) {
  const b=target?.closest<HTMLElement>('.step');
  if(!b)return;
  const key=`${b.dataset.lane}:${b.dataset.step}`;
  if(visited.has(key))return;
  visited.add(key);editStep(b);
}
root.addEventListener('pointerdown',e=>{
  if(e.button!==0 || !(e.target as Element).closest('.step'))return;
  e.preventDefault();dragPointer=e.pointerId;visited.clear();paintStep(e.target as Element);
  root.setPointerCapture(e.pointerId);
});
root.addEventListener('pointermove',e=>{
  if(e.pointerId!==dragPointer)return;
  // Sample the pointer path so fast drags cannot skip intermediate buttons.
  const distance=Math.hypot(e.movementX,e.movementY);
  const count=Math.max(1,Math.ceil(distance/6));
  for(let n=1;n<=count;n++)paintStep(document.elementFromPoint(e.clientX-e.movementX*(1-n/count),e.clientY-e.movementY*(1-n/count)));
});
function endDrag(e:PointerEvent){if(e.pointerId===dragPointer){dragPointer=undefined;visited.clear();if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);}}
root.addEventListener('pointerup',endDrag);
root.addEventListener('pointercancel',endDrag);
root.addEventListener('lostpointercapture',()=>{dragPointer=undefined;visited.clear()});
// All range controls, including future faders, share wheel adjustment and input bindings.
root.addEventListener('wheel',e=>{
  const el=(e.target as Element).closest('input, .knob-wrap');
  const input=el instanceof HTMLInputElement?el:el?.querySelector('input');
  if(!(input instanceof HTMLInputElement)||!['range','number'].includes(input.type)||e.deltaY===0)return;
  e.preventDefault();const min=Number(input.min||0),max=Number(input.max||1),step=Number(input.step==='any'?'0.01':input.step||1);
  input.value=String(Math.max(min,Math.min(max,Number(input.value)+(e.deltaY<0?step:-step))));
  input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
},{passive:false});
addEventListener('keydown',e=>{
  if(e.code!=='Space'||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
  const target=e.target as HTMLElement;
  if(target.closest('input,textarea,select,[contenteditable="true"]'))return;
  e.preventDefault();$(seq.timer?'pause':'play').click();
});
root.addEventListener("click", async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("button");
  if (!b) return;
  const d = b.dataset;
  if (d.step !== undefined && e.detail === 0) editStep(b);
  if (d.voice !== undefined) {
    select(+d.voice);
    await engine.unlock();
    engine.trigger(selected, 1, engine.context!.currentTime, voices[selected]);
  }
  if (d.mute !== undefined) {
    muted[+d.mute] = !muted[+d.mute];
    render();
  }
  if (d.solo !== undefined) {
    solo[+d.solo] = !solo[+d.solo];
    render();
  }
  if (d.length !== undefined) {
    const l = patterns[slot][+d.length];
    l.length = (l.length % 16) + 1;
    render();
  }
  if (d.slot !== undefined) {
    slot = +d.slot;
    render();
  }
});
$("lanes").addEventListener("contextmenu", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-length]");
  if (b) {
    e.preventDefault();
    const l = patterns[slot][+b.dataset.length!];
    l.length = ((l.length + 14) % 16) + 1;
    render();
  }
});
click("play", () => {
  void seq.play().catch((e) => ($("notice").textContent = e.message));
  $("play").classList.add("active");
});
click("pause", () => {
  seq.pause();
  $("play").classList.remove("active");
  document
    .querySelectorAll(".playing")
    .forEach((e) => e.classList.remove("playing"));
});
click("stop", () => {
  seq.stop();
  $("play").classList.remove("active");
  document
    .querySelectorAll(".playing")
    .forEach((e) => e.classList.remove("playing"));
});
seq.onEvent = (e) => {
  if (e.type === "trigger")
    setTimeout(
      () => {
        if (!seq.timer) return;
        document
          .querySelectorAll(`[data-lane="${e.lane}"].playing`)
          .forEach((n) => n.classList.remove("playing"));
        document
          .querySelector(`[data-lane="${e.lane}"][data-step="${e.step}"]`)
          ?.classList.add("playing");
      },
      Math.max(0, (e.time - engine.context!.currentTime) * 1000),
    );
};
const tempo = (delta: number) => {
  const input = $("bpm") as HTMLInputElement;
  seq.bpm = Math.max(30, Math.min(300, Number(input.value) + delta));
  input.value = seq.bpm.toFixed(1);
};
($("bpm") as HTMLInputElement).onchange = () => tempo(0);
click("slower", () => tempo(-1));
click("faster", () => tempo(1));
knob("swing-knob", "", 0, (n) => (seq.swing = n * 0.65));
click("prev", () => select(selected - 1));
click("next", () => select(selected + 1));
click("analog", () => {
  voices[selected].mode = "analog";
  render();
});
click("sample", () => {
  voices[selected].mode = "sample";
  render();
  $("notice").textContent = voices[selected].sample
    ? "SAMPLE READY"
    : "LOAD AN AUDIO FILE TO PLAY SAMPLE MODE";
});
click("load-sample", () => ($("sample-file") as HTMLInputElement).click());
($("sample-file") as HTMLInputElement).onchange = async (e) => {
  try {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await engine.unlock();
    const decoded = await engine.context!.decodeAudioData(
      await file.arrayBuffer(),
    );
    if (decoded.duration > 10) throw Error("Sample exceeds 10 seconds");
    voices[selected].sample = decoded;
    voices[selected].mode = "sample";
    render();
    $("notice").textContent = `LOADED: ${file.name}`;
  } catch {
    $("notice").textContent = "COULD NOT DECODE AUDIO FILE";
  }
};
click("trim", () => {
  const v=voices[selected];
  if(!v.sample || !engine.context){$("notice").textContent="LOAD A SAMPLE BEFORE TRIMMING";return;}
  const first=Math.floor(v.start*v.sample.length),last=Math.floor(v.end*v.sample.length);
  if(last<=first){$("notice").textContent="END MUST FOLLOW START";return;}
  const b=engine.context.createBuffer(v.sample.numberOfChannels,last-first,v.sample.sampleRate);
  for(let ch=0;ch<b.numberOfChannels;ch++)b.copyToChannel(v.sample.getChannelData(ch).slice(first,last),ch);
  v.sample=b;v.start=0;v.end=1;render();controls();$("notice").textContent="SAMPLE TRIMMED IN MEMORY";
});
click("reverse", () => {
  voices[selected].reverse = !voices[selected].reverse;
  render();
});
["closed", "open"].forEach((id, i) =>
  click(id, async () => {
    select(5);
    await engine.unlock();
    engine.trigger(5, i + 1, engine.context!.currentTime, voices[5]);
    $("notice").textContent = `AUDITION: ${id.toUpperCase()} HI-HAT`;
  }),
);
click("length", () => {
  lengthMode = !lengthMode;
  render();
  $("notice").textContent = lengthMode
    ? "CLICK A STEP TO SET ITS LANE LENGTH"
    : "STEP EDIT MODE";
});
click("pattern-prev", () => {
  slot = (slot + 3) % 4;
  render();
});
click("pattern-next", () => {
  slot = (slot + 1) % 4;
  render();
});
click("copy", () => {
  clipboard = clone(patterns[slot]);
  $("notice").textContent = "PATTERN COPIED";
});
click("paste", () => {
  patterns[slot] = clone(clipboard);
  render();
});
click("clear", () => {
  patterns[slot] = emptyPattern();
  render();
});
click("reset", () => {
  seq.stop();
  patterns = [emptyPattern(), emptyPattern(), emptyPattern(), emptyPattern()];
  render();
});
click("save", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify({ version: 1, patterns })], {
      type: "application/json",
    }),
  );
  a.download = "DS-9-patterns.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
click("load", () => ($("pattern-file") as HTMLInputElement).click());
($("pattern-file") as HTMLInputElement).onchange = async (e) => {
  try {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const p = JSON.parse(await f.text()).patterns;
    if (
      !Array.isArray(p) ||
      p.length !== 4 ||
      p.some(
        (p: unknown) =>
          !Array.isArray(p) ||
          p.length !== 9 ||
          p.some(
            (l: { length: number; steps: number[] }) =>
              !Number.isInteger(l.length) ||
              l.length < 1 ||
              l.length > 16 ||
              !Array.isArray(l.steps) ||
              l.steps.length !== 16 ||
              l.steps.some((s: number) => ![0, 1, 2].includes(s)),
          ),
      )
    )
      throw Error();
    patterns = p;
    render();
  } catch {
    $("notice").textContent = "INVALID PATTERN FILE";
  }
};
function resize() {
  const scale = Math.min(innerWidth / 1754, innerHeight / 886);
  root.style.width = `${1754 * scale}px`;
  root.style.height = `${886 * scale}px`;
  document.querySelector<HTMLElement>(".machine")!.style.transform =
    `scale(${scale})`;
}
addEventListener("resize", resize);
render();
controls();
resize();
