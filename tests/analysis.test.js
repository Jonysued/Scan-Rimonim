import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/analyzePhoto.js';
import {samplingSummary} from '../src/lib/capture/savePhoto.js';

async function run({role='muestreador',storage='owner/photo.jpg',aiStatus=200,fruits=[]}={}) {
  const oldFetch=globalThis.fetch;
  const names=['SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','OPENAI_API_KEY'];
  const env=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  process.env.SUPABASE_URL='https://test.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
  process.env.OPENAI_API_KEY='test-openai-key';
  const calls=[];
  globalThis.fetch=async (input,options={})=>{
    const url=String(input);calls.push(url);
    if(url.includes('/auth/v1/user'))return Response.json({id:'owner'});
    if(url.includes('/rest/v1/profiles'))return Response.json({role});
    if(url.includes('/storage/v1/object/sign/')){
      assert.equal(new Headers(options.headers).get('Authorization'),'Bearer user-token');
      return Response.json({signedURL:'/object/sign/photos/owner/photo.jpg?token=test'});
    }
    assert.equal(url,'https://api.openai.com/v1/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer test-openai-key');
    const body=JSON.parse(options.body);
    assert.equal(body.model,'gpt-4.1-mini');
    assert.equal(body.store,false);
    return Response.json({choices:[{message:{content:JSON.stringify({fruits})}}]},{status:aiStatus});
  };
  const res={code:200,status(n){this.code=n;return this;},json(data){this.data=data;return this;}};
  try{await handler({method:'POST',headers:{authorization:'Bearer user-token'},body:{storage_uri:storage}},res);return {res,calls};}
  finally{globalThis.fetch=oldFetch;for(const n of names){if(env[n]===undefined)delete process.env[n];else process.env[n]=env[n];}}
}

test('OpenAI vision runs with caller RLS permissions and never invents metric sizing',async()=>{
  const {res}=await run({fruits:[{box_2d:[100,200,800,900],diameter_mm:90,color_category:'rojo',color_score:80}]});
  assert.equal(res.code,200);assert.equal(res.data.fruit_count_estimate,1);
  assert.equal(res.data.fruits[0].diameter_mm,null);
});
test('pending role is denied before storage or paid inference',async()=>{
  const {res,calls}=await run({role:'pendiente'});assert.equal(res.code,403);assert.equal(calls.length,2);
});
test('another owner image is rejected before inference',async()=>{
  const {res,calls}=await run({storage:'other/photo.jpg'});assert.equal(res.code,400);assert.equal(calls.length,2);
});
test('unactivated credits returns actionable error instead of implying a background queue',async()=>{
  const {res}=await run({aiStatus:402});assert.equal(res.code,503);assert.match(res.data.error,/saldo/);
});
test('retry summary reports missing analysis and missing scale without zero measurements',()=>{
  const empty=samplingSummary([{status:'listo',fruits:[]}]);
  assert.equal(empty.red_pct,null);
  assert.equal(empty.cracking_pct,null);
  assert.equal(empty.avg_diameter_mm,null);
  assert.equal(samplingSummary([{status:'error',fruits:[]}]).red_pct,null);
  const s=samplingSummary([{status:'listo',fruits:[{color_category:'rojo',diameter_mm:null}]}]);
  assert.equal(s.status,'listo');assert.equal(s.red_pct,100);assert.equal(s.avg_diameter_mm,null);
});
