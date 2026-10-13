import test from 'node:test';import assert from 'node:assert/strict';import {framing} from '../src/lib/capture/framing.js';
function image(radius,cx=80,cy=60){const width=160,height=120,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=(y*width+x)*4;const fruit=(x-cx)**2+(y-cy)**2<=radius**2;data[p]=fruit?190:20;data[p+1]=fruit?50:110;data[p+2]=fruit?40:20;data[p+3]=255;}return {width,height,data};}
test('blank foliage never claims distance or ready',()=>assert.deepEqual(framing(image(0)),{status:'search',message:'Centrar una sola fruta y buscar buena luz'}));
test('small, centered fruit asks to approach',()=>assert.equal(framing(image(10)).status,'closer'));
test('suitable framing',()=>assert.equal(framing(image(24)).status,'ready'));
test('cropped/large fruit asks to move back',()=>assert.equal(framing(image(48)).status,'farther'));
test('off-center fruit asks to center',()=>assert.equal(framing(image(23,125)).status,'center'));
test('web never emits metric distance',()=>assert.equal('distanceM' in framing(image(24)),false));
function recolor(frame,color){for(let i=0;i<frame.data.length;i+=4)if(frame.data[i]===190)frame.data.set(color,i);return frame;}
test('pink skin is recognized',()=>assert.equal(framing(recolor(image(24),[180,160,145,255])).status,'ready'));
test('yellow skin is recognized',()=>assert.equal(framing(recolor(image(24),[190,180,80,255])).status,'ready'));
test('shaded red skin is recognized',()=>assert.equal(framing(recolor(image(24),[60,36,26,255])).status,'ready'));
test('green round fruit with background contrast has usable framing',()=>assert.equal(framing(recolor(image(24),[130,160,70,255])).status,'ready'));
test('pale round fruit has usable framing without a red mask',()=>assert.equal(framing(recolor(image(24),[170,168,165,255])).status,'ready'));
test('detection coordinates match portrait and landscape video geometry',()=>{
  const box=framing(image(24)).box;assert.ok(Math.abs(box.x-.35)<.01);assert.ok(Math.abs(box.y-.3)<.01);
  assert.ok(Math.abs(box.width-49/160)<.01);assert.ok(Math.abs(box.height-49/120)<.01);
});
test('narrow highlights do not split the fruit into tiny fragments',()=>{
  const frame=image(24);for(let y=0;y<120;y++)for(let x=60;x<104;x+=4){const p=(y*160+x)*4;if(frame.data[p]===190)frame.data.set([230,230,230,255],p);}
  assert.equal(framing(frame).status,'ready');
});
test('portrait camera frames retain the same circular fruit geometry',()=>{
  const source=image(24),frame={width:120,height:160,data:new Uint8ClampedArray(source.data.length)};
  for(let y=0;y<120;y++)for(let x=0;x<160;x++)frame.data.set(source.data.subarray((y*160+x)*4,(y*160+x)*4+4),(x*120+y)*4);
  assert.equal(framing(frame).status,'ready');
});
