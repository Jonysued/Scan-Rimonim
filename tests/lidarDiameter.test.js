import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateLidarDiameter,photoWithDiameterEstimates} from '../src/lib/capture/lidarDiameter.js';
import {savePhoto,samplingSummary} from '../src/lib/capture/savePhoto.js';

function sphere({radius=40,z=500,confidenceLevel=2,portrait=true}={}) {
  const w=portrait?192:256,h=portrait?256:192,fx=220,fy=220,cx=w/2,cy=h/2;
  const depth_mm=Array(w*h).fill(1000),confidence=Array(w*h).fill(confidenceLevel);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    const q=((x-cx)/fx)**2+((y-cy)/fy)**2+1;
    const disc=z*z-q*(z*z-radius*radius);
    if(disc>=0) depth_mm[y*w+x]=Math.round((z-Math.sqrt(disc))/q);
  }
  const projected=radius*fx/Math.sqrt(z*z-radius*radius);
  const contour=Array.from({length:160},(_,i)=>({x:(cx+projected*Math.cos(i*Math.PI/80))*1000/w,y:(cy+projected*Math.sin(i*Math.PI/80))*1000/h}));
  return {metadata:{version:1,source:'arkit-scene-depth',orientation:'portrait-clockwise',width:w,height:h,image_width:w*6,image_height:h*6,depth_mm,confidence,intrinsics:{fx,fy,cx,cy}},contour};
}
test('same-frame sphere depth recovers an experimental 80 mm body at different distances',()=>{
  for(const z of [350,500,700]) {
    const {metadata,contour}=sphere({z});const result=estimateLidarDiameter(metadata,contour);
    assert.equal(result.status,'experimental');assert.ok(Math.abs(result.diameter_mm-80)<4,JSON.stringify(result));
    assert.equal(result.validation,'pending-physical-comparison');
  }
});
test('intrinsics and grid aspect changes preserve metric scale',()=>{
  const {metadata,contour}=sphere({portrait:false});
  assert.ok(Math.abs(estimateLidarDiameter(metadata,contour).diameter_mm-80)<4);
});
test('20 and 40 cm surface capture uses measured depth, not a fixed diameter or nominal distance',()=>{
  for(const radius of [30,40,55])for(const surfaceDistance of [190,200,210,390,400,410]){
    const {metadata,contour}=sphere({radius,z:surfaceDistance+radius});
    metadata.distanceM=surfaceDistance/1000;
    metadata.capture_protocol={id:surfaceDistance<300?'lidar-front-20cm-v1':'lidar-front-40cm-v1',target_distance_m:surfaceDistance<300?.2:.4,tolerance_m:.01,measured_distance_m:metadata.distanceM};
    const result=estimateLidarDiameter(metadata,contour);
    assert.equal(result.status,'experimental');
    assert.ok(Math.abs(result.diameter_mm-radius*2)<4,JSON.stringify(result));
    assert.equal(result.validation,'pending-physical-comparison');
  }
});
test('weak confidence, missing data and contour mismatch never produce diameter',()=>{
  const {metadata,contour}=sphere();
  for(const m of [null,
    {...metadata,confidence:metadata.confidence.map(()=>1)}, {...metadata,intrinsics:{...metadata.intrinsics,fx:0}},
    {...metadata,image_width:100}, {...metadata,depth_mm:[]}]) {
    assert.equal(estimateLidarDiameter(m,contour).status,'unavailable');
  }
  assert.equal(estimateLidarDiameter(metadata,contour.map(p=>({x:p.x+100,y:p.y}))).status,'unavailable');
});
test('background outside the fruit does not become part of its sphere',()=>{
  const {metadata,contour}=sphere();
  metadata.depth_mm=metadata.depth_mm.map(z=>z===1000?3000:z);
  assert.equal(estimateLidarDiameter(metadata,contour).status,'experimental');
});
test('saving keeps experimental diameter separate from validated calibre summaries',async()=>{
  const {metadata,contour}=sphere();let saved;
  const client={integrations:{Core:{UploadPrivateFile:async()=>({file_uri:'owner/lidar.jpg'})}},
    entities:{Foto:{create:async value=>{saved=value;return {id:'photo'};},update:async(_,value)=>{saved={...saved,...value};}}},
    functions:{invoke:async()=>({data:{fruits:[{localization_status:'located',body_contour:contour,color_category:'rojo'}]}})}};
  const result=await savePhoto(client,{file:{},metadata},'session');
  assert.equal(result.status,'listo');assert.equal(saved.capture_metadata,metadata);
  assert.equal(saved.fruits[0].lidar_estimate.status,'experimental');
  assert.equal(saved.fruits[0].diameter_mm,null);assert.equal(saved.avg_diameter_mm,null);
  assert.equal(samplingSummary([saved]).avg_diameter_mm,null);
});

test('smoothed fruit depth uses the existing contour and actual surface distance',()=>{
  for(const radius of [30,40,55])for(const surface of [190,200,210,390,400,410]){
    const {metadata,contour}=sphere({radius,z:surface+radius});
    metadata.depth_mm=metadata.depth_mm.map(z=>z===1000?1000:surface);
    const before=structuredClone(contour),result=estimateLidarDiameter(metadata,contour);
    assert.equal(result.status,'experimental');assert.equal(result.method,'lidar-contour-width-v2');
    assert.ok(Math.abs(result.diameter_mm-radius*2)<4,JSON.stringify(result));
    assert.deepEqual(contour,before);assert.equal(result.validation,'pending-physical-comparison');
  }
});
test('width estimates reject mixed surfaces, invalid sizes and clipped silhouettes',()=>{
  const {metadata,contour}=sphere();
  metadata.depth_mm=metadata.depth_mm.map(()=>500);
  const mixed={...metadata,depth_mm:metadata.depth_mm.map((z,i)=>i%2?z:600)};
  assert.equal(estimateLidarDiameter(mixed,contour).status,'unavailable');
  const clipped=contour.map(p=>({x:p.x-420,y:p.y}));
  assert.equal(estimateLidarDiameter(metadata,clipped).status,'unavailable');
});
test('historical display recalculates from stored depth without changing contours, measurements or averages',()=>{
  const {metadata,contour}=sphere();metadata.depth_mm=metadata.depth_mm.map(z=>z===1000?1000:460);
  const fruit={localization_version:4,localization_status:'located',segmentation_model:'mediapipe-magic-touch-v2',body_contour:contour,diameter_mm:null,lidar_estimate:{status:'unavailable',reason:'implausible_shape'}};
  const photo={capture_metadata:metadata,fruits:[fruit],avg_diameter_mm:null};const before=structuredClone(photo);
  const displayed=photoWithDiameterEstimates(photo);
  assert.equal(displayed.fruits[0].lidar_estimate.status,'experimental');assert.deepEqual(photo,before);
  assert.deepEqual(displayed.fruits[0].body_contour,contour);assert.equal(displayed.fruits[0].diameter_mm,null);
  assert.equal(samplingSummary([displayed]).avg_diameter_mm,null);
  assert.equal(photoWithDiameterEstimates({...photo,fruits:[{...fruit,diameter_mm:82}]}).fruits[0].diameter_mm,82);
});
