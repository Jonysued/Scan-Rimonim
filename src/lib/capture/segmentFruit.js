import {validatedContour} from './contourGeometry.js';
let worker;
const pending=new Map();
let sequence=0;
export async function segmentFruit(client,storage_uri,seed) {
  const {signed_url}=await client.integrations.Core.CreateFileSignedUrl({file_uri:storage_uri});
  const response=await fetch(signed_url);
  if(!response.ok) throw new Error('No se pudo abrir la foto para detectar el contorno.');
  const bitmap=await createImageBitmap(await response.blob());
  if(!worker) {
    // Classic bundled worker supports MediaPipe's WASM importScripts loader.
    worker=new Worker(new URL('./fruitSegmentation.worker.js',import.meta.url));
    worker.onmessage=({data})=>{
      const request=pending.get(data.id);if(!request)return;
      pending.delete(data.id);clearTimeout(request.timer);
      if(data.error)request.reject(new Error(data.error));else request.resolve(validatedContour(data.points));
    };
    worker.onerror=()=>{
      for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('No se pudo cargar el modelo de contorno.'));}
      pending.clear();worker.terminate();worker=undefined;
    };
  }
  return new Promise((resolve,reject)=>{
    const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('La segmentación tardó demasiado. Reintentá el análisis.'));},90000);
    pending.set(id,{resolve,reject,timer});
    worker.postMessage({id,bitmap,seed},[bitmap]);
  });
}
