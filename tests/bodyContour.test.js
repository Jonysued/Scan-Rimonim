import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyContour} from '../src/lib/capture/bodyContour.js';
function scene({fruit=true,hand=false}={}){
  const width=120,height=180,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let color=[42,38,36];
    if(((x-60)/25)**2+((y-115)/23)**2<1)color=[15,13,12]; // projected shadow
    if(fruit&&((x-60)/24)**2+((y-80)/23)**2<1)color=[190,90,70];
    if(hand&&x<35&&y>65&&y<115)color=[200,140,110];
    data.set([...color,255],(y*width+x)*4);
  }
  return {width,height,data};
}
const prior={localization_status:'located',center_x_pct:50,center_y_pct:60,radius_pct:24,radius_y_pct:16};
test('visible skin moves a displaced AI circle from shadow onto the fruit',()=>{
  const f=bodyContour(scene(),prior);assert.ok(f);
  assert.ok(Math.abs(f.center_x_pct-50)<1);
  assert.ok(Math.abs(f.center_y_pct-80/180*100)<1);
});
test('shadow alone and rectangular hand do not get a circle',()=>{
  assert.equal(bodyContour(scene({fruit:false}),prior),null);
  assert.equal(bodyContour(scene({fruit:false,hand:true}),prior),null);
});
test('unlocated AI output never invents a fruit contour',()=>{
  assert.equal(bodyContour(scene(),{localization_status:'uncertain'}),null);
});
