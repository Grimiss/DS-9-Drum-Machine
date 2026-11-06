import {mkdirSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
mkdirSync('test-results/cymbal-baseline',{recursive:true});for(const name of ['audio.ts','synthesis.ts','kits.ts','state.ts'])writeFileSync(`test-results/cymbal-baseline/${name}`,execFileSync('git',['show',`2290b4e:src/${name}`]));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage();await page.goto('http://localhost:5173');
const results=await page.evaluate(async()=>{
 const {Engine}=await import('/src/audio.ts');const {Engine:Old}=await import('/test-results/cymbal-baseline/audio.ts');const {voices}=await import('/src/state.ts');
 const check=(value,message)=>{if(!value)throw Error(message)};
 const render=async(Type,kit,lane,patch={},rate=48000)=>{const c=new OfflineAudioContext(1,rate*(lane===8?8:1),rate),e=new Type();e.kit=kit;if(patch.mode==='sample'){const sample=c.createBuffer(1,rate/10,rate);const data=sample.getChannelData(0);for(let n=0;n<data.length;n++)data[n]=Math.sin(n*.05)*.5;patch={...patch,sample};}const random=Math.random;let seed=1;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};try{e.trigger(lane,1,0,{...voices[lane],...patch},c,c.destination);}finally{Math.random=random;}return (await c.startRendering()).getChannelData(0)};
 const energy=(data,from,to,rate=48000)=>{let sum=0;for(let n=Math.floor(from*rate);n<Math.min(data.length,to*rate);n++)sum+=data[n]*data[n];return sum;};
 const spectrum=data=>{const n=1024,power=Array(n/2-1).fill(0);for(let frame=0;frame<4;frame++){const start=2400+frame*1536,one=[];for(let k=1;k<n/2;k++){let re=0,im=0;for(let j=0;j<n;j++){const x=data[start+j]*(.5-.5*Math.cos(2*Math.PI*j/(n-1)));re+=x*Math.cos(2*Math.PI*k*j/n);im-=x*Math.sin(2*Math.PI*k*j/n);}one.push(re*re+im*im);}const sum=one.reduce((a,b)=>a+b,0);one.forEach((p,k)=>power[k]+=p/sum/4);}let contrast=0;for(let k=32;k<210;k++){let neighbours=0;for(let j=-5;j<=5;j++)if(Math.abs(j)>1)neighbours+=power[k+j];contrast=Math.max(contrast,power[k]/(neighbours/8+1e-20));}return {high:power.reduce((a,p,k)=>a+((k+1)*48000/n>10000?p:0),0),tonalPeak:Math.max(...power),contrast};};
 const results=[];for(const kit of ['classic','sr88','808','909','kr55']){
  const before=await render(Old,kit,8),after=await render(Engine,kit,8),oldSpectrum=spectrum(before),newSpectrum=spectrum(after);let peak=0;for(const x of after){check(Number.isFinite(x),'Non-finite output');peak=Math.max(peak,Math.abs(x));}check(peak>0&&peak<1,`${kit}: peak ${peak}`);
  check(energy(after,1,2)>.001,`${kit}: no audible wash beyond one second`);check(newSpectrum.high<oldSpectrum.high,`${kit}: brittle upper energy not reduced`);check(newSpectrum.contrast<oldSpectrum.contrast,`${kit}: tonal ringing not reduced`);
  const short=await render(Engine,kit,8,{decay:0}),long=await render(Engine,kit,8,{decay:1});check(energy(long,1,3)>energy(short,1,3)+.001,'Decay does not lengthen tail');
  const dark=await render(Engine,kit,8,{tone:0}),bright=await render(Engine,kit,8,{tone:1});check(spectrum(bright).high>spectrum(dark).high,'Tone does not brighten cymbal');
  const extreme=await render(Engine,kit,8,{tune:1,tone:1,decay:1},44100);check(extreme.every(Number.isFinite),'44.1kHz extreme invalid');
  for(let lane=0;lane<8;lane++){const a=await render(Old,kit,lane),b=await render(Engine,kit,lane);let difference=0;for(let n=0;n<a.length;n++)difference=Math.max(difference,Math.abs(a[n]-b[n]));check(difference<1e-5,`${kit}: non-cymbal voice ${lane} changed by ${difference}`);}
  const sampleBefore=await render(Old,kit,8,{mode:'sample'}),sampleAfter=await render(Engine,kit,8,{mode:'sample'});check(sampleBefore.every((x,n)=>Math.abs(x-sampleAfter[n])<1e-5),'Imported cymbal sample changed');
  results.push({kit,peak,tailEnergy:energy(after,1,2),oldSpectrum,newSpectrum});
 }
 return results;
});console.log(JSON.stringify(results,null,2));assert.equal(results.length,5);await browser.close();
