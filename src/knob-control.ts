/** Relative pointer dragging in screen pixels, independent of hardware-canvas scaling. */
export function attachKnobDrag(wrap: HTMLElement, input: HTMLInputElement) {
  let drag: {id:number;type:string;startX:number;startY:number;x:number;y:number;raw:number;initial:string;axis?:'x'|'y'} | undefined;
  const display = () => {wrap.dataset.value=`${Math.round(Number(input.value)*100)}%`;};
  input.addEventListener('input',display);display();
  wrap.title='Drag up or right to increase; down or left to decrease. Hold Shift for fine adjustment.';
  wrap.addEventListener('pointerdown',event=>{
    if(input.disabled || drag || !event.isPrimary || event.button!==0)return;
    event.preventDefault();input.focus({preventScroll:true});
    drag={id:event.pointerId,type:event.pointerType,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,raw:Number(input.value),initial:input.value};
    wrap.classList.add('adjusting');wrap.setPointerCapture(event.pointerId);
  });
  wrap.addEventListener('pointermove',event=>{
    if(!drag || drag.id!==event.pointerId)return;
    event.preventDefault();
    if(input.disabled){finish(event);return;}
    if(!drag.axis){const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;if(Math.max(Math.abs(dx),Math.abs(dy))<2)return;drag.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';}
    const delta=drag.axis==='x'?event.clientX-drag.x:drag.y-event.clientY;
    drag.x=event.clientX;drag.y=event.clientY;
    const min=Number(input.min||0),max=Number(input.max||1),step=Number(input.step)||.01;
    const distance=drag.type==='mouse'?150:110;
    drag.raw=Math.max(min,Math.min(max,drag.raw+delta/distance*(max-min)*(event.shiftKey?.2:1)));
    const value=Number(Math.max(min,Math.min(max,min+Math.round((drag.raw-min)/step)*step)).toFixed(6));
    if(Number(input.value)!==value){input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));}
  });
  const finish=(event:PointerEvent)=>{
    if(!drag||drag.id!==event.pointerId)return;
    const changed=drag.initial!==input.value;drag=undefined;wrap.classList.remove('adjusting');
    if(wrap.hasPointerCapture(event.pointerId))wrap.releasePointerCapture(event.pointerId);
    if(changed)input.dispatchEvent(new Event('change',{bubbles:true}));
  };
  wrap.addEventListener('pointerup',finish);wrap.addEventListener('pointercancel',finish);wrap.addEventListener('lostpointercapture',finish);
  // Suppress label/native-range click positioning: touching a knob must not jump its value.
  wrap.addEventListener('click',event=>event.preventDefault());
}
