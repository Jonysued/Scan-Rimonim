import {FilesetResolver,InteractiveSegmenter} from '@mediapipe/tasks-vision';
import {maskContour} from './maskContour.js';
let modelPromise;
function model() {
  if(!modelPromise) modelPromise=(async()=>{
    const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm');
    return InteractiveSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/latest/interactive_segmentation.task',delegate:'CPU'}});
  })();
  return modelPromise;
}
self.onmessage=async ({data:{id,bitmap,seed}})=>{
  let mask;
  try {
    const segmenter=await model();
    segmenter.setImage(bitmap);
    // 1 = BrushMode.POSITIVE in the pinned SDK's public type declaration.
    mask=segmenter.segment([{brushMode:1,point:[seed],isCompleted:true}]);
    const points=maskContour(mask.getAsFloat32Array(),mask.width,mask.height,seed);
    self.postMessage({id,points});
  } catch { self.postMessage({id,error:'No se pudo ejecutar la segmentación de la fruta en este dispositivo.'}); }
  finally {mask?.close();bitmap.close();}
};
