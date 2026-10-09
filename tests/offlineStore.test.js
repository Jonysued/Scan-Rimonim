import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function fixture(){
 const files=new Map([['file://cache/shot.jpg','JPEG']]);let failWrite=false;let nextId=0;
 const fs={documentDirectory:'file://documents/',EncodingType:{Base64:'base64'},getInfoAsync:async path=>({exists:files.has(path)||[...files.keys()].some(k=>k.startsWith(path))}),readAsStringAsync:async path=>{if(!files.has(path))throw new Error('missing');return files.get(path);},readDirectoryAsync:async root=>[...files.keys()].filter(p=>p.startsWith(root)).map(p=>p.slice(root.length)),deleteAsync:async path=>{files.delete(path);},makeDirectoryAsync:async()=>{},copyAsync:async({from,to})=>{if(!files.has(from))throw new Error('missing source');files.set(to,files.get(from));}};
 const native={newId:()=>`photo-${++nextId}`,writeOfflineJSON:async(name,data)=>{if(failWrite)throw new Error('disk full');files.set('file://documents/ScanOffline/'+name,data);}};
 let source=await readFile(new URL('../mobile/offlineStore.ts',import.meta.url),'utf8');
 source=source.replace("import * as FS from 'expo-file-system/legacy';",'const FS=globalThis.__offlineTest.fs;').replace("import {requireNativeModule} from 'expo-modules-core';",'const requireNativeModule=()=>globalThis.__offlineTest.native;');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 globalThis.__offlineTest={fs,native};
 const store=await import('data:text/javascript;base64,'+Buffer.from(code+'\n//'+Math.random()).toString('base64'));
 return {store,files,fail:()=>{failWrite=true;},recover:()=>{failWrite=false;}};
}
const sample={id:'sample-id',ownerId:'owner',bloque_id:'lot',bloqueName:'Lot',muestreador_name:'Tester',started_at:'2026-10-09T00:00:00Z',photos:[]};
test('captured photo and LiDAR survive closing/reopening through durable manifests',async()=>{
 const f=await fixture();await f.store.saveSample(sample);
 const saved=await f.store.saveCapture(sample,{uri:'file://cache/shot.jpg',depthCapture:{distanceM:.4}});
 const reopened=await f.store.samples();assert.deepEqual(reopened,[saved]);
 assert.equal(f.files.get(saved.photos[0].uri),'JPEG');assert.equal(f.files.has('file://cache/shot.jpg'),false);
 assert.deepEqual(reopened[0].photos[0].metadata,{distanceM:.4});
});
test('failed manifest write does not claim a saved photo or destroy the source and old draft',async()=>{
 const f=await fixture();await f.store.saveSample(sample);f.fail();
 await assert.rejects(f.store.saveCapture(sample,{uri:'file://cache/shot.jpg',depthCapture:null}),/disk full/);
 assert.deepEqual(await f.store.samples(),[sample]);assert.equal(f.files.has('file://cache/shot.jpg'),true);
});
test('local copies are preserved until a durable sync receipt commits',async()=>{
 const f=await fixture();const saved=await f.store.saveCapture(sample,{uri:'file://cache/shot.jpg',depthCapture:null});
 f.fail();await assert.rejects(f.store.completeSample(saved),/disk full/);assert.equal(f.files.has(saved.photos[0].uri),true);
 f.recover();await f.store.completeSample(saved);assert.deepEqual(await f.store.samples(),[]);assert.equal(f.files.has(saved.photos[0].uri),false);
});
