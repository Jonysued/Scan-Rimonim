import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDefect, drawableDefect} from '../src/lib/capture/defectGeometry.js';

test('defect regions use original portrait dimensions and persist drawable geometry',()=>{
  const d=normalizeDefect({type:'russet',severity:'leve',confidence:.9,location_confidence:.95,region:{left:300,top:800,right:600,bottom:1000}},{width:1500,height:2000});
  assert.deepEqual(d.region,{left:200,top:400,right:400,bottom:500});
  assert.ok(drawableDefect(JSON.parse(JSON.stringify(d))));
});
test('uncertain, out-of-frame, reversed and missing boxes retain diagnosis without fabricated marks',()=>{
  for(const [region,location_confidence] of [[null,.95],[{left:300,top:800,right:600,bottom:1000},0],[{left:-1,top:0,right:600,bottom:1000},.95],[{left:600,top:800,right:300,bottom:1000},.95],[{left:300,top:800,right:1600,bottom:1000},.95]]) {
    const d=normalizeDefect({type:'cracking',severity:'grave',confidence:.9,location_confidence,region},{width:1500,height:2000});
    assert.equal(d.type,'cracking');assert.equal(d.region,null);assert.ok(!drawableDefect(d));
  }
  assert.ok(!drawableDefect({type:'sunburn',region:{left:1,top:2,right:3,bottom:4}}));
});

test('valid but uncertain AI proposals are drawn as tentative rather than confirmed',()=>{
  const d=normalizeDefect({type:'russet',severity:'leve',confidence:.9,location_confidence:.5,region:{left:300,top:800,right:600,bottom:1000}},{width:1500,height:2000});
  assert.equal(d.localization_status,'tentative');
  assert.ok(drawableDefect(d));
});
