// Persist the image record before optional analysis. Retry updates the same record.
import {segmentFruit} from './segmentFruit.js';
import {estimateLidarDiameter} from './lidarDiameter.js';
export async function savePhoto(client, foto, sessionId, variedadName, onSaved = () => {}) {
  const storage_uri = foto.storage_uri || (await client.integrations.Core.UploadPrivateFile({file: foto.file})).file_uri;
  foto.storage_uri = storage_uri;
  const photo = foto.photoId ? {id: foto.photoId} : await client.entities.Foto.create({
    session_id: sessionId, captured_at: new Date().toISOString(), storage_uri,
    capture_metadata: foto.metadata, measurement_status: 'unmeasured',
    status: 'procesando', fruit_count_estimate: null, avg_diameter_mm: null, fruits: [],
  });
  foto.photoId = photo.id;
  onSaved({photoId: photo.id, storage_uri});
  try {
    const {data} = await client.functions.invoke('analyzePhoto', {storage_uri, variedad_name: variedadName});
    const fruits = data.fruits || [];
    let segmentationError;
    for(const fruit of fruits) {
      if(fruit.localization_version!==4 || fruit.localization_status!=='seeded') continue;
      try {
        const points=await segmentFruit(client,storage_uri,fruit.segmentation_seed);
        Object.assign(fruit,{localization_status:points?'located':'uncertain',body_contour:points,segmentation_model:'mediapipe-magic-touch-v2'});
      } catch(error) {fruit.localization_status='uncertain';segmentationError=error.message;}
    }
    for(const fruit of fruits) {
      fruit.lidar_estimate=estimateLidarDiameter(foto.metadata,fruit.body_contour);
      // Experimental results never enter validated calibre aggregates.
      fruit.diameter_mm=null;
      fruit.measurement_status='unmeasured';
    }
    const values = {status: 'listo', fruits, fruit_count_estimate: data.fruit_count_estimate ?? fruits.length};
    await client.entities.Foto.update(photo.id, values);
    return {...values, photoId: photo.id, storage_uri,analysisError:segmentationError};
  } catch (error) {
    // 'procesando' or 'error' both mean not analyzed; the saved record survives.
    await client.entities.Foto.update(photo.id, {status: 'error'}).catch(() => {});
    return {status: 'guardado', photoId: photo.id, storage_uri, analysisError: error.message};
  }
}

export function samplingSummary(photos) {
  const pending=photos.some(p=>p.status!=='listo');
  const fruits=photos.flatMap(p=>p.fruits||[]);
  const measured=fruits.filter(f=>Number.isFinite(f.diameter_mm)&&f.diameter_mm>0);
  const pct=pred=>pending||!fruits.length?null:100*fruits.filter(pred).length/fruits.length;
  return {
    status:pending?'borrador':'listo',photo_count:photos.length,fruit_count:fruits.length,
    avg_diameter_mm:measured.length?measured.reduce((sum,f)=>sum+f.diameter_mm,0)/measured.length:null,
    red_pct:fruits.some(f=>!['verde','rosado','rojo','rojo_oscuro'].includes(f.color_category))?null:pct(f=>f.color_category==='rojo'||f.color_category==='rojo_oscuro'),
  };
}
