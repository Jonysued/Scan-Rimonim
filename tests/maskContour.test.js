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

test('excludes an attached crown in any orientation without changing the body mask',()=>{
  const body=mask();
  for(const side of ['top','right']){
    const values=Float32Array.from(body);
    const crown=side==='top'?[{x:70/w,y:35/h},{x:90/w,y:35/h},{x:90/w,y:59/h},{x:70/w,y:59/h}]:[{x:115/w,y:90/h},{x:140/w,y:90/h},{x:140/w,y:110/h},{x:115/w,y:110/h}];
    if(side==='top')for(let y=35;y<59;y++)for(let x=70;x<90;x++)values[y*w+x]=1;
    else for(let y=90;y<110;y++)for(let x=115;x<140;x++)values[y*w+x]=1;
    const original=Float32Array.from(values);
    assert.notDeepEqual(maskContour(values,w,h,seed),maskContour(body,w,h,seed));
    const clean=maskContour(values,w,h,seed,crown);
    assert.ok(validatedContour(clean));
    assert.ok(Math.min(...clean.map(p=>p.y))>=58*1000/h);
    assert.ok(Math.max(...clean.map(p=>p.x))<=116*1000/w);
    assert.ok(Math.abs(Math.max(...clean.map(p=>p.x))-Math.max(...maskContour(body,w,h,seed).map(p=>p.x)))<7);
    assert.deepEqual(values,original);
  }
});
test('invalid crown geometry is ignored and a crown covering the seed cannot invent a body',()=>{
  const values=mask();
  assert.deepEqual(maskContour(values,w,h,seed,[{x:NaN,y:0},{x:0,y:1},{x:1,y:1}]),maskContour(values,w,h,seed));
  assert.equal(maskContour(values,w,h,seed,[{x:.4,y:.4},{x:.6,y:.4},{x:.6,y:.6},{x:.4,y:.6}]),null);
});
