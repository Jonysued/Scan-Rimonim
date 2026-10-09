import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../mobile/syncQueue.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createSyncQueue}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const sample=(id,ownerId='owner',ended_at='2026-10-09')=>({id,ownerId,ended_at,photos:[{id:id+'-photo',uri:id+'.jpg'}]});
function fixture(initial){
 const saved=new Map(initial.map(s=>[s.id,structuredClone(s)])),calls=[];let owner='owner',generation=0,handler=async()=>{};
 const drain=createSyncQueue({owner:()=>owner,generation:()=>generation,samples:async()=>[...saved.values()].map(s=>structuredClone(s)),send:async(op,s,p)=>{calls.push([op,s.id,p?.id]);await handler(op,s);},photoBase64:async()=> 'JPEG',saveSample:async s=>saved.set(s.id,structuredClone(s)),completeSample:async s=>saved.delete(s.id),onChanged:async()=>{}});
 return {drain,saved,calls,sendWith:fn=>{handler=fn;},switchOwner:()=>{owner='other';generation++;},reload:()=>{generation++;}};
}
test('saving another sample during an upload drains it immediately, drafts and other owners stay untouched',async()=>{
 const f=fixture([sample('first'),sample('draft','owner',null),sample('foreign','other')]);
 f.sendWith(async(op,s)=>{if(op==='photo'&&s.id==='first')f.saved.set('second',sample('second'));});
 await f.drain();assert.deepEqual([...f.saved.keys()],['draft','foreign']);
 assert.deepEqual(f.calls.map(c=>c.slice(0,2)),[['session','first'],['photo','first'],['finish','first'],['session','second'],['photo','second'],['finish','second']]);
});
test('single-flight requests do not duplicate uploads or receipts',async()=>{
 const f=fixture([sample('one')]);let release;
 const gate=new Promise(resolve=>{release=resolve;});
 f.sendWith(async op=>{if(op==='session')await gate;});
 const a=f.drain(),b=f.drain();assert.equal(a,b);release();await Promise.all([a,b]);
 assert.equal(f.calls.filter(c=>c[0]==='photo').length,1);assert.equal(f.saved.size,0);
});
test('a failed photo remains locally queued, and a later attempt finishes the same sample',async()=>{
 const f=fixture([sample('one')]);f.sendWith(async op=>{if(op==='photo')throw new Error('offline');});
 await assert.rejects(f.drain(),/offline/);assert.equal(f.saved.get('one').photos[0].synced,undefined);
 f.sendWith(async()=>{});await f.drain();assert.equal(f.saved.size,0);
});
test('a lost finish receipt retries without uploading an acknowledged photo again',async()=>{
 const f=fixture([sample('one')]);f.sendWith(async op=>{if(op==='finish')throw new Error('lost receipt');});
 await assert.rejects(f.drain(),/lost receipt/);assert.equal(f.saved.get('one').photos[0].synced,true);
 f.sendWith(async()=>{});await f.drain();assert.equal(f.calls.filter(c=>c[0]==='photo').length,1);assert.equal(f.saved.size,0);
});
test('a reload or account switch during an upload cannot acknowledge/delete local photos',async()=>{
 for(const interrupt of ['reload','switchOwner']){
  const f=fixture([sample('one')]);f.sendWith(async op=>{if(op==='photo')f[interrupt]();});
  await assert.rejects(f.drain(),/interrumpida/);assert.equal(f.saved.size,1);assert.equal(f.saved.get('one').photos[0].synced,undefined);
  assert.equal(f.calls.some(c=>c[0]==='finish'),false);
 }
});
