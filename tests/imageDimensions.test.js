import test from 'node:test';
import assert from 'node:assert/strict';
import {imageDimensions} from '../api/_imageDimensions.js';
test('reads portrait JPEG dimensions without assuming a square image',()=>{
  assert.deepEqual(imageDimensions(new Uint8Array([255,216,255,192,0,8,8,7,208,5,220,0])),{width:1500,height:2000});
});
test('reads PNG dimensions and rejects truncated headers',()=>{
  const bytes=new Uint8Array(24), v=new DataView(bytes.buffer);
  v.setUint32(0,0x89504e47);v.setUint32(4,0x0d0a1a0a);v.setUint32(16,1500);v.setUint32(20,2000);
  assert.deepEqual(imageDimensions(bytes),{width:1500,height:2000});
  assert.throws(()=>imageDimensions(bytes.slice(0,10)));
  assert.throws(()=>imageDimensions(new Uint8Array([255,216,255,192,255,255])));
});
