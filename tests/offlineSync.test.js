import test from 'node:test';
import assert from 'node:assert/strict';
import {syncOfflineOperation} from '../src/lib/capture/offlineSync.js';
const user={id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',role:'muestreador'};
const sample={id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',bloque_id:'cccccccc-cccc-4ccc-cccc-cccccccccccc',photo_count:1,started_at:'2026-10-09T00:00:00Z',ended_at:'2026-10-09T01:00:00Z'};
const photo={id:'dddddddd-dddd-4ddd-dddd-dddddddddddd',base64:'YWJj',captured_at:'2026-10-09T00:01:00Z',metadata:{source:'lidar',distanceM:.4}};
function fixture(){
 const sessions=new Map(),photos=new Map(),uploads=new Set();let analyzeCalls=0,failAnalysis=false,lostPhotoResponse=false;
 const entity=map=>({filter:async filters=>[...map.values()].filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v)),create:async row=>{if(map.has(row.id))throw Object.assign(new Error('duplicate'),{code:'23505'});map.set(row.id,{...row});if(map===photos&&lostPhotoResponse){lostPhotoResponse=false;throw new Error('lost response');}return {...row};},update:async(id,values)=>{map.set(id,{...map.get(id),...values});return map.get(id);}});
 const client={entities:{SesionMuestreo:entity(sessions),Foto:entity(photos)},integrations:{Core:{UploadPrivateFile:async({stableId})=>{uploads.add(stableId);return {file_uri:user.id+'/'+stableId+'.jpg'};}}},functions:{invoke:async()=>{analyzeCalls++;if(failAnalysis)throw new Error('sin conexión');return {data:{fruits:[],fruit_count_estimate:0}};}}};
 return {client,sessions,photos,uploads,get analyzeCalls(){return analyzeCalls;},fail:()=>{failAnalysis=true;},recover:()=>{failAnalysis=false;},loseResponse:()=>{lostPhotoResponse=true;}};
}
const op=(operation,extra={})=>({operation,ownerId:user.id,sample,...extra});
test('offline sample sync survives retries without duplicate samples/photos and retains capture metadata',async()=>{
 const f=fixture();f.loseResponse();
 await assert.rejects(syncOfflineOperation(f.client,user,op('photo',{photo})),/lost response/);
 await syncOfflineOperation(f.client,user,op('photo',{photo}));
 await syncOfflineOperation(f.client,user,op('photo',{photo}));
 await syncOfflineOperation(f.client,user,op('finish'));
 assert.equal(f.sessions.size,1);assert.equal(f.photos.size,1);assert.equal(f.uploads.size,1);assert.equal(f.analyzeCalls,1);
 assert.deepEqual(f.photos.get(photo.id).capture_metadata,photo.metadata);
 assert.equal(f.photos.get(photo.id).captured_at,photo.captured_at);
 assert.equal(f.sessions.get(sample.id).ended_at,sample.ended_at);
});
test('a network/analysis failure is never acknowledged as synced, and finishing is blocked until recovery',async()=>{
 const f=fixture();f.fail();await assert.rejects(syncOfflineOperation(f.client,user,op('photo',{photo})),/sin conexión/);
 assert.equal(f.photos.size,1);await assert.rejects(syncOfflineOperation(f.client,user,op('finish')),/pendientes/);
 f.recover();await syncOfflineOperation(f.client,user,op('photo',{photo}));await syncOfflineOperation(f.client,user,op('finish'));
 assert.equal(f.photos.size,1);assert.equal(f.sessions.get(sample.id).status,'listo');
});
test('another account and a read-only profile cannot replay a queued sample',async()=>{
 const f=fixture();for(const person of [{...user,role:'lector'},{...user,id:'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee'}]){
  await assert.rejects(syncOfflineOperation(f.client,person,op('photo',{photo})),/cuenta/);
 }
 assert.equal(f.sessions.size,0);assert.equal(f.uploads.size,0);
});
test('existing UUIDs cannot attach a photo to another owner or lot',async()=>{
 const f=fixture();f.sessions.set(sample.id,{...sample,created_by:user.id,bloque_id:'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee'});
 await assert.rejects(syncOfflineOperation(f.client,user,op('photo',{photo})),/lote/);
 assert.equal(f.uploads.size,0);
});
