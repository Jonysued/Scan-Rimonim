import test from 'node:test';
import assert from 'node:assert/strict';
import {maskContour} from '../src/lib/capture/maskContour.js';
import {validatedContour} from '../src/lib/capture/contourGeometry.js';
const w=160,h=200,seed={x:.5,y:.5};
function mask() {
  const values=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(((x-80)/35)**2+((y-100)/42)**2<=1)values[y*w+x]=.98;
  return values;
}
test('learned mask produces actual foreground boundary, independent of RGB',()=>{
  const points=maskContour(mask(),w,h,seed);
  assert.ok(validatedContour(points));
  assert.ok(Math.abs(Math.max(...points.map(p=>p.x))-115.5*1000/w)<10);
  assert.ok(Math.abs(Math.max(...points.map(p=>p.y))-142.5*1000/h)<10);
});
test('background, missing seed and edge-clipped masks do not receive contours',()=>{
  assert.equal(maskContour(new Float32Array(w*h),w,h,seed),null);
  assert.equal(maskContour(new Float32Array(w*h).fill(1),w,h,seed),null);
  assert.equal(maskContour(mask(),w,h,{x:0,y:.5}),null);
});
test('ignores disconnected foreground objects instead of merging them into the fruit',()=>{
  const values=mask();values[5*w+5]=1;
  assert.deepEqual(maskContour(values,w,h,seed),maskContour(mask(),w,h,seed));
});
