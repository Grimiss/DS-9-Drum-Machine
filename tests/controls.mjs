import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1754,height:886}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5173');await page.locator('.step').last().waitFor();
assert.equal(await page.locator('.led').count(),0);assert.equal(await page.locator('[data-mute]').count(),9);assert.equal(await page.locator('[data-solo]').count(),9);
await page.locator('[data-mute="0"]').click();assert.equal(await page.locator('[data-mute="0"]').getAttribute('aria-pressed'),'true');
for(const i of [0,2])await page.locator(`[data-solo="${i}"]`).click();for(const i of [0,2])assert.equal(await page.locator(`[data-solo="${i}"]`).getAttribute('aria-pressed'),'true');
const triggered=await page.evaluate(async()=>{
 const {Sequencer}=await import('/src/sequencer.ts');const {emptyPattern,voices}=await import('/src/state.ts');const p=emptyPattern();p.forEach(l=>l.steps[0]=1);const calls=[];const engine={context:{currentTime:0},trigger(i){calls.push(i)},silence(){}};
 const mute=Array(9).fill(false),solo=Array(9).fill(false);solo[0]=solo[2]=true;mute[0]=true;
 const s=new Sequencer(engine,()=>p,voices,mute,solo);s.next=0;s.schedule();return calls;
});assert.deepEqual(triggered,[2]);
// Toggle each visited pad once, even when crossing it again during one gesture.
const step=n=>page.locator(`[data-lane="2"][data-step="${n}"]`);const center=async n=>{const b=await step(n).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2}};
let a=await center(0),b=await center(3);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:20});await page.mouse.move(a.x,a.y,{steps:20});await page.mouse.up();
for(let n=0;n<4;n++)assert.equal(await step(n).getAttribute('aria-pressed'),'true');
await step(0).click();assert.equal(await step(0).getAttribute('aria-pressed'),'false');
// Hat drag preserves the three-state cycle.
const hat=page.locator('[data-lane="5"][data-step="1"]');await hat.click();await hat.click();assert.ok((await hat.getAttribute('class')).includes('red'));
for(const id of ['voice-knobs','sample-knobs','swing-knob']){
 const input=page.locator(`#${id} input`).first();await input.fill('0.5');const before=Number(await input.inputValue());await input.locator("..").hover();await page.mouse.wheel(0,-100);assert.ok(Number(await input.inputValue())>before);
 await input.fill('1');await page.mouse.wheel(0,-100);assert.equal(Number(await input.inputValue()),1);
}
await page.locator('#bpm').hover();await page.mouse.wheel(0,-100);assert.equal(Number(await page.locator('#bpm').inputValue()),121);
await page.locator('#voice-name').click();await page.keyboard.press('Space');await page.waitForTimeout(200);assert.ok((await page.locator('#play').getAttribute('class')).includes('active'));await page.keyboard.press('Space');assert.equal(await page.locator('.playing').count(),0);assert.ok(!(await page.locator('#play').getAttribute('class')).includes('active'));
await page.locator('#bpm').focus();await page.keyboard.press('Space');assert.ok(!(await page.locator('#play').getAttribute('class')).includes('active'));
const separator=await page.locator('.step').nth(3).evaluate(e=>getComputedStyle(e,'::after').width);assert.equal(separator,'1px');
await page.reload();await page.waitForTimeout(150);await page.screenshot({path:'docs/DS-9-screenshot.png'});assert.deepEqual(errors,[]);console.log('M/S, scheduler solo routing, drag/revisit, hats, wheel bounds, tempo, Space, separators: passed');await browser.close();
