import test from 'node:test';import assert from 'node:assert/strict';import {framing} from '../src/lib/capture/framing.js';
function image(radius,cx=80,cy=60){const width=160,height=120,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=(y*width+x)*4;const fruit=(x-cx)**2+(y-cy)**2<=radius**2;data[p]=fruit?190:20;data[p+1]=fruit?50:110;data[p+2]=fruit?40:20;data[p+3]=255;}return {width,height,data};}
test('blank foliage never claims distance or ready',()=>assert.deepEqual(framing(image(0)),{status:'search',message:'Centrar una sola fruta y buscar buena luz'}));
test('small, centered fruit asks to approach',()=>assert.equal(framing(image(10)).status,'closer'));
test('suitable framing',()=>assert.equal(framing(image(24)).status,'ready'));
test('cropped/large fruit asks to move back',()=>assert.equal(framing(image(48)).status,'farther'));
test('off-center fruit asks to center',()=>assert.equal(framing(image(23,125)).status,'center'));
test('web never emits metric distance',()=>assert.equal('distanceM' in framing(image(24)),false));
