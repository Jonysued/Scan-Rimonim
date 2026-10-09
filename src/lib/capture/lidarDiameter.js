import {validatedContour} from './contourGeometry.js';

// Experimental spherical-body fit in camera coordinates, not a validated
// commercial calibre. Depth and normalized contour refer to the same JPEG.
function estimateSphereDiameter(metadata, contour) {
  const reject = reason => ({status:'unavailable',reason});
  const ring = validatedContour(contour);
  if(!ring || metadata?.source!=='arkit-scene-depth' || metadata.version!==1 || metadata.orientation!=='portrait-clockwise') return reject('missing_depth');
  const {width:w,height:h,depth_mm:depth,confidence,intrinsics:k}=metadata;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<16||h<16||w*h>100000 ||
     !Array.isArray(depth)||depth.length!==w*h||!Array.isArray(confidence)||confidence.length!==w*h ||
     !k||!['fx','fy','cx','cy'].every(key=>Number.isFinite(k[key]))||k.fx<=0||k.fy<=0||k.cx<0||k.cx>=w||k.cy<0||k.cy>=h ||
     !Number.isFinite(metadata.image_width)||!Number.isFinite(metadata.image_height)||
     Math.abs(metadata.image_width/metadata.image_height-w/h)>0.02) return reject('invalid_depth');
  const points=ring.map(p=>({x:p.x*w/1000,y:p.y*h/1000}));
  const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x));
  const top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
  if(right-left<16 || bottom-top<16) return reject('fruit_too_small');
  const inside=(x,y)=>{
    let hit=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++) {
      const a=points[i],b=points[j];
      if((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) hit=!hit;
    }
    return hit;
  };
  const cloud=[];let candidates=0;
  // Exclude the silhouette boundary where low-resolution depth mixes with background.
  for(let y=Math.ceil(top+(bottom-top)*.2);y<bottom-(bottom-top)*.2;y++) {
    for(let x=Math.ceil(left+(right-left)*.2);x<right-(right-left)*.2;x++) {
      if(!inside(x,y)) continue;
      candidates++;
      const i=y*w+x,z=depth[i];
      if(confidence[i]!==2 || !Number.isFinite(z)||z<150||z>800) continue;
      cloud.push([(x-k.cx)*z/k.fx,(y-k.cy)*z/k.fy,z]);
    }
  }
  if(cloud.length<100 || cloud.length/candidates<.8) return reject('insufficient_confidence');
  const mean=[0,1,2].map(i=>cloud.reduce((s,p)=>s+p[i],0)/cloud.length);
  const rows=cloud.map(p=>p.map((v,i)=>v-mean[i]));
  const matrix=Array.from({length:4},()=>Array(5).fill(0));
  for(const p of rows) {
    const a=[2*p[0],2*p[1],2*p[2],1],b=p.reduce((s,v)=>s+v*v,0);
    for(let i=0;i<4;i++){for(let j=0;j<4;j++)matrix[i][j]+=a[i]*a[j];matrix[i][4]+=a[i]*b;}
  }
  // Pivoted elimination rejects flat/degenerate depth, instead of inventing a radius.
  for(let col=0;col<4;col++) {
    let pivot=col;
    for(let row=col+1;row<4;row++) if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row;
    if(Math.abs(matrix[pivot][col])<1e-6) return reject('flat_depth');
    [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];
    const divisor=matrix[col][col];for(let j=col;j<=4;j++)matrix[col][j]/=divisor;
    for(let row=0;row<4;row++) if(row!==col) {
      const factor=matrix[row][col];for(let j=col;j<=4;j++)matrix[row][j]-=factor*matrix[col][j];
    }
  }
  const center=matrix.slice(0,3).map(r=>r[4]);
  const radius=Math.sqrt(matrix[3][4]+center.reduce((s,v)=>s+v*v,0));
  if(!Number.isFinite(radius)||radius<15||radius>75 || center[2]<5) return reject('implausible_shape');
  const residuals=rows.map(p=>Math.abs(Math.hypot(...p.map((v,i)=>v-center[i]))-radius)).sort((a,b)=>a-b);
  const residual=residuals[Math.floor(residuals.length*.9)];
  if(residual>3) return reject('irregular_depth');
  const z=mean[2]+center[2];
  const predictedWidth=2*radius*k.fx/Math.sqrt(z*z-radius*radius);
  const projectedCenter=k.cx+(mean[0]+center[0])*k.fx/z;
  if(Math.abs(predictedWidth/(right-left)-1)>.15 || Math.abs(projectedCenter-(left+right)/2)>(right-left)*.1) return reject('contour_depth_mismatch');
  return {status:'experimental',diameter_mm:Math.round(radius*20)/10,
    method:'lidar-sphere-fit-v1',assumption:'spherical-body',sample_count:cloud.length,
    residual_p90_mm:Math.round(residual*100)/100,validation:'pending-physical-comparison'};
}

// LiDAR may smooth the shallow curvature of a fruit. In that case use its
// unchanged image silhouette and central surface depth instead of fitting the
// depth curvature. Approximate the silhouette plane half a diameter behind the
// front surface: D = angularWidth * (surfaceZ + D/2). This is an experimental
// rounded-body assumption, not a calibrated measurement or commercial count.
export function estimateLidarDiameter(metadata, contour) {
  const fitted=estimateSphereDiameter(metadata,contour);
  if(fitted.status==='experimental' || !['flat_depth','implausible_shape','irregular_depth'].includes(fitted.reason)) return fitted;
  const ring=validatedContour(contour),{width:w,height:h,depth_mm:depth,confidence,intrinsics:k}=metadata;
  const left=Math.min(...ring.map(p=>p.x))*w/1000,right=Math.max(...ring.map(p=>p.x))*w/1000;
  const top=Math.min(...ring.map(p=>p.y))*h/1000,bottom=Math.max(...ring.map(p=>p.y))*h/1000;
  if(left<=1||right>=w-1||top<=1||bottom>=h-1)return {status:'unavailable',reason:'clipped_contour'};
  const inside=(x,y)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j],px=x*1000/w,py=y*1000/h;
    if((a.y>py)!==(b.y>py)&&px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }return hit;};
  const values=[];let candidates=0;
  for(let y=Math.ceil(top+(bottom-top)*.3);y<bottom-(bottom-top)*.3;y++){
    for(let x=Math.ceil(left+(right-left)*.3);x<right-(right-left)*.3;x++){
      if(!inside(x,y))continue;candidates++;
      const i=y*w+x,z=depth[i];
      if(confidence[i]===2&&Number.isFinite(z)&&z>=150&&z<=800)values.push(z);
    }
  }
  if(values.length<25||values.length/candidates<.8)return {status:'unavailable',reason:'insufficient_confidence'};
  values.sort((a,b)=>a-b);
  const q=fraction=>values[Math.floor((values.length-1)*fraction)];
  if(q(.9)-q(.1)>35)return {status:'unavailable',reason:'mixed_surface_depth'};
  const surfaceZ=q(.5),angularWidth=(right-left)/k.fx;
  const diameter=angularWidth*surfaceZ/(1-angularWidth/2);
  if(!Number.isFinite(diameter)||diameter<30||diameter>150)return {status:'unavailable',reason:'implausible_size'};
  return {status:'experimental',diameter_mm:Math.round(diameter*10)/10,
    method:'lidar-contour-width-v2',assumption:'rounded-body-silhouette-plane',
    surface_depth_mm:surfaceZ,sample_count:values.length,
    depth_spread_p10_p90_mm:q(.9)-q(.1),validation:'pending-physical-comparison'};
}

// Recalculate for display from stored depth and the original confirmed contour.
// Do not resegment the photo, overwrite manual measurements, or turn estimates
// into validated calibre averages. Old photos can benefit without new AI calls.
export function photoWithDiameterEstimates(photo){
  return {...photo,fruits:(photo.fruits||[]).map(fruit=>{
    if(Number.isFinite(fruit.diameter_mm)&&fruit.diameter_mm>0)return fruit;
    if(fruit.localization_version!==4||fruit.localization_status!=='located'||fruit.segmentation_model!=='mediapipe-magic-touch-v2')return fruit;
    return {...fruit,lidar_estimate:estimateLidarDiameter(photo.capture_metadata,fruit.body_contour)};
  })};
}
