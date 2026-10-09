import test from 'node:test';
import assert from 'node:assert/strict';
import handler, {localization} from '../api/analyzePhoto.js';
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
    if(url.includes('/storage/v1/object/sign/') && options.method==='POST'){
      assert.equal(new Headers(options.headers).get('Authorization'),'Bearer user-token');
      return Response.json({signedURL:'/object/sign/photos/owner/photo.jpg?token=test'});
    }
    if(url.includes('/object/sign/photos/')) return new Response(new Uint8Array([255,216,255,192,0,8,8,7,208,5,220,0]));
    assert.equal(url,'https://api.openai.com/v1/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer test-openai-key');
    const body=JSON.parse(options.body);
    assert.equal(body.model,'gpt-5.4-mini');
    assert.equal(body.reasoning_effort,'medium');
    assert.equal(body.max_completion_tokens,2000);
    assert.equal(body.store,false);
    assert.equal(body.messages[0].content[1].image_url.detail,'original');
    assert.match(body.messages[0].content[0].text,/sombra proyectada/);
    assert.doesNotMatch(body.messages[0].content[0].text,/defect|russet|cracking|sunburn|rajado|quemadura/i);
    assert.match(body.messages[0].content[0].text,/ancho=1500 píxeles; alto=2000 píxeles/);
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
  assert.equal(empty.avg_diameter_mm,null);
  assert.equal(samplingSummary([{status:'error',fruits:[]}]).red_pct,null);
  const s=samplingSummary([{status:'listo',fruits:[{color_category:'rojo',diameter_mm:null}]}]);
  assert.equal(s.status,'listo');assert.equal(s.red_pct,100);assert.equal(s.avg_diameter_mm,null);
});

test('visible red coverage preserves zero and never substitutes missing values',async()=>{
  for(const [input,expected] of [[0,0],[75,75],[null,null],[undefined,null],[101,null],["75",null]]){
    const {res}=await run({fruits:[{box_2d:[100,200,800,900],red_coverage_pct:input}]});
    assert.equal(res.data.fruits[0].red_coverage_pct,expected);
    assert.equal(res.data.fruits[0].color_analysis_version,2);
    assert.equal(res.data.fruits[0].diameter_mm,null);
  }
});

test('missing color is unknown rather than pink or zero intensity',async()=>{
  const {res}=await run({fruits:[{box_2d:[100,200,800,900]}]});
  assert.equal(res.data.fruits[0].color_category,null);
  assert.equal(res.data.fruits[0].color_score,null);
  assert.equal(samplingSummary([{status:'listo',fruits:res.data.fruits}]).red_pct,null);
});

test('AI identifies a seed, not a fabricated contour or circle',()=>{
  const f=localization({body_center:{x:400,y:400},localization_confidence:.95});
  assert.deepEqual(f.segmentation_seed,{x:.4,y:.4});
  assert.equal(f.localization_version,4);
  assert.equal(f.radius_pct,undefined);
  assert.equal(f.body_contour,undefined);
  assert.equal(f.localization_status,'seeded');
});
test('original pixel coordinates are scaled independently for portrait photos',()=>{
  const result=localization({body_center:{x:750,y:1100},localization_confidence:.95},{width:1500,height:2000});
  assert.deepEqual(result.segmentation_seed,{x:.5,y:.55});
});
test('uncertain, legacy, and malformed locations never receive drawable coordinates',()=>{
  for(const f of [
    {box_2d:[100,200,800,900]},
    {body_center:{x:400,y:400},localization_confidence:.6},
    {body_center:{x:'400',y:400},localization_confidence:.95},
    {body_center:{x:400,y:1001},localization_confidence:.95},
    {body_box:{left:200,top:300,right:600,bottom:500},localization_confidence:.6},
    {body_box:{left:600,top:300,right:200,bottom:500},localization_confidence:.95},
    {body_box:{left:200,top:300,right:600,bottom:1001},localization_confidence:.95},
    {body_box:{left:200,top:300,right:600,bottom:500},localization_confidence:2},
  ]){const result=localization(f);assert.equal(result.localization_status,'uncertain');assert.equal(result.center_x_pct,undefined);}
});
test('uncertain localization retains color analysis without claiming a circle or calibre',async()=>{
  const {res}=await run({fruits:[{body_box:null,localization_confidence:0,color_category:'rojo',red_coverage_pct:55}]});
  assert.equal(res.data.fruits[0].red_coverage_pct,55);
  assert.equal(res.data.fruits[0].localization_status,'uncertain');
  assert.equal(res.data.fruits[0].center_x_pct,undefined);
  assert.equal(res.data.fruits[0].diameter_mm,null);
});

test('analysis discards unsolicited fields while preserving color',async()=>{
  const {res}=await run({fruits:[{color_category:'rojo',red_coverage_pct:70,color_score:85,defects:[{type:'cracking',severity:'grave'}],russet_coverage_pct:30,defect_coverage_pct:{russet:30,sunburn:20,cracking:10}}]});
  const fruit=res.data.fruits[0];
  assert.equal(fruit.red_coverage_pct,70);
  assert.equal(fruit.color_category,'rojo');
  for(const field of ['defects','russet_coverage_pct','defect_coverage_pct','defect_coverage_version','russet_analysis_version']) assert.equal(Object.hasOwn(fruit,field),false);
});

test('historical results aggregate only color and calibre',()=>{
  const summary=samplingSummary([{status:'listo',fruits:[{color_category:'rojo',diameter_mm:80,defects:[{type:'cracking'}],russet_coverage_pct:30}]}]);
  assert.deepEqual(summary,{status:'listo',photo_count:1,fruit_count:1,avg_diameter_mm:80,red_pct:100});
});
