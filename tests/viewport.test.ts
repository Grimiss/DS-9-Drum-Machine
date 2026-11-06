import {test} from 'node:test';import assert from 'node:assert/strict';import {fitHardware} from '../src/viewport.ts';
test('hardware fits landscape/portrait tablet and desktop viewports without reflow',()=>{
 for(const [width,height] of [[1280,638],[1024,600],[800,1280],[1754,886],[640,360]]){const f=fitHardware({width,height});assert.ok(f.left>=4&&f.top>=4);assert.ok(f.left+f.width<=width-4+1e-8);assert.ok(f.top+f.height<=height-4+1e-8);assert.ok(Math.abs(f.width/f.height-1754/886)<1e-10);}
});
test('fit respects browser viewport offsets and tablet safe areas',()=>{const f=fitHardware({width:1280,height:600,left:7,top:15,insetLeft:24,insetRight:8,insetTop:10,insetBottom:20});assert.ok(f.left>=35);assert.ok(f.top>=29);assert.ok(f.left+f.width<=7+1280-8-4+1e-8);assert.ok(f.top+f.height<=15+600-20-4+1e-8);});
