import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:638},hasTouch:true,isMobile:true,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173');await page.locator('.step').last().waitFor();const cdp=await page.context().newCDPSession(page);
const center=async input=>{const b=await input.locator('..').locator('.knob').boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2}};
const touch=async(type,x,y)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1,radiusX:9,radiusY:9,force:1}]});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
// All nine knobs respond to finger movement, rather than native slider thumb positioning.
const knobs=page.locator('.knob-wrap input');assert.equal(await knobs.count(),9);
for(let n=0;n<9;n++){
 const input=knobs.nth(n);await input.fill('0.5');const p=await center(input);await touch('touchStart',p.x,p.y);assert.equal(Number(await input.inputValue()),.5,'Touching a knob jumped its value');await touch('touchMove',p.x,p.y-22);await touch('touchEnd');assert.equal(Number(await input.inputValue()),.7,`Unresponsive touch knob ${n}`);assert.equal(await input.locator('..').evaluate(e=>e.classList.contains('adjusting')),false);
}
const input=knobs.first();await input.fill('0.5');let p=await center(input);await touch('touchStart',p.x,p.y);await touch('touchMove',p.x+44,p.y);await touch('touchEnd');assert.equal(Number(await input.inputValue()),.9);
// Pointer capture keeps adjustment working outside the knob, clamped at either end.
await touch('touchStart',p.x,p.y);await touch('touchMove',p.x,p.y-150);assert.equal(Number(await input.inputValue()),1);await touch('touchMove',p.x,p.y+150);assert.equal(Number(await input.inputValue()),0);await touch('touchCancel');assert.equal(await input.locator('..').evaluate(e=>e.classList.contains('adjusting')),false);
// Screen-pixel sensitivity stays consistent when the hardware is scaled down further.
await page.setViewportSize({width:1024,height:600});await page.waitForTimeout(100);await input.fill('0.5');p=await center(input);await touch('touchStart',p.x,p.y);await touch('touchMove',p.x,p.y-22);await touch('touchEnd');assert.equal(Number(await input.inputValue()),.7);
// Mouse drag, fine adjustment, wheel, keyboard and disabled controls.
await input.fill('0.5');p=await center(input);await page.mouse.move(p.x,p.y);await page.keyboard.down('Shift');await page.mouse.down();await page.mouse.move(p.x,p.y-75,{steps:15});await page.mouse.up();await page.keyboard.up('Shift');assert.equal(Number(await input.inputValue()),.6);
await input.focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await input.inputValue()),.61);await input.locator('..').hover();await page.mouse.wheel(0,-100);assert.equal(Number(await input.inputValue()),.62);
await input.evaluate(e=>e.disabled=true);p=await center(input);await touch('touchStart',p.x,p.y);await touch('touchMove',p.x,p.y-30);await touch('touchEnd');assert.equal(Number(await input.inputValue()),.62);await input.evaluate(e=>e.disabled=false);
assert.deepEqual(errors,[]);console.log('Nine knobs: real touch drag, no initial jump, horizontal/vertical adjustment, capture, limits, cancellation, scale independence, fine mouse, wheel and keyboard passed');await browser.close();
