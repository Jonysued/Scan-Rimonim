import test from 'node:test';
import assert from 'node:assert/strict';
import {validatedContour} from '../src/lib/capture/contourGeometry.js';
const contour=Array.from({length:16},(_,i)=>({x:500+200*Math.cos(i*Math.PI/8),y:400+100*Math.sin(i*Math.PI/8)}));
test('keeps AI contour geometry irrespective of background colour',()=>{
  assert.deepEqual(validatedContour(contour),contour);
});
test('rejects missing, short, out of bounds, non-numeric and duplicate points',()=>{
  for(const points of [null,[],contour.slice(0,4),contour.map((p,i)=>i? p:{x:1001,y:400}),contour.map((p,i)=>i?p:{x:'500',y:400}),[contour[0],...contour]]) assert.equal(validatedContour(points),null);
});
test('rejects a self-intersecting polygon instead of drawing a misleading outline',()=>{
  const crossed=[...contour];[crossed[2],crossed[10]]=[crossed[10],crossed[2]];
  assert.equal(validatedContour(crossed),null);
});
