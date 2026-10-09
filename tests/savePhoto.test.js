import test from 'node:test';
import assert from 'node:assert/strict';
import {savePhoto} from '../src/lib/capture/savePhoto.js';

function setup() {
  const events = [], rows = new Map();
  let failAnalysis = true;
  const client = {
    integrations: {Core: {UploadPrivateFile: async () => {events.push('upload');return {file_uri:'owner/photo.jpg'};}}},
    entities: {Foto: {
      create: async value => {events.push('create');rows.set('photo-1',value);return {id:'photo-1'};},
      update: async (id,value) => {events.push('update');assert.ok(rows.has(id));rows.set(id,{...rows.get(id),...value});},
    }},
    functions: {invoke: async () => {events.push('analyze');assert.equal(rows.size,1);if(failAnalysis)throw new Error('Servicio no disponible');return {data:{fruits:[],fruit_count_estimate:0}};}},
  };
  return {client, events, rows, enableAnalysis: () => {failAnalysis=false;}};
}

test('analysis failure preserves a saved photo without invented fruit or diameter',async () => {
  const {client,events,rows}=setup();
  const result=await savePhoto(client,{file:{},metadata:{guidance:'search'}},'session-1','Wonderful');
  assert.deepEqual(events,['upload','create','analyze','update']);
  assert.equal(result.status,'guardado');
  assert.equal(rows.get('photo-1').avg_diameter_mm,null);
  assert.equal(rows.get('photo-1').fruit_count_estimate,null);
  assert.equal(rows.get('photo-1').capture_metadata.guidance,'search');
});

test('retry analyzes the existing record without duplicate upload or photo',async () => {
  const s=setup(), foto={file:{}};
  await savePhoto(s.client,foto,'session-1');
  s.enableAnalysis();
  const result=await savePhoto(s.client,foto,'session-1');
  assert.equal(result.status,'listo');
  assert.equal(result.fruit_count_estimate,0);
  assert.equal(s.events.filter(x=>x==='upload').length,1);
  assert.equal(s.events.filter(x=>x==='create').length,1);
});

test('storage failure is a real save failure and never invokes analysis',async () => {
  const s=setup();
  s.client.integrations.Core.UploadPrivateFile=async()=>{throw new Error('Sin conexión');};
  await assert.rejects(savePhoto(s.client,{file:{}},'session-1'),/Sin conexión/);
  assert.equal(s.rows.size,0);
  assert.equal(s.events.length,0);
});


test('a failed reanalysis keeps an already analyzed photo intact',async()=>{
  const s=setup();
  const prior={status:'listo',fruits:[{body_contour:[{x:1,y:2}],color_category:'rojo'}],fruit_count_estimate:1};
  s.rows.set('photo-1',structuredClone(prior));
  const result=await savePhoto(s.client,{photoId:'photo-1',storage_uri:'owner/photo.jpg'},'session-1');
  assert.equal(result.analysisError,'Servicio no disponible');
  assert.deepEqual(s.rows.get('photo-1'),prior);
  assert.deepEqual(s.events,['analyze']);
});
