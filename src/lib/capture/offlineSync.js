import {savePhoto, samplingSummary} from './savePhoto.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function createOnce(entity, data, ownerId) {
  let existing = (await entity.filter({id:data.id}))[0];
  if (!existing) {
    try {existing=await entity.create(data);} catch(error) {
      // A lost response or two simultaneous retries may have inserted this UUID.
      if (error.code !== '23505') throw error;
      existing=(await entity.filter({id:data.id}))[0];
      if (!existing) throw error;
    }
  }
  if(existing.created_by!==ownerId) throw new Error('La muestra pertenece a otra cuenta.');
  return existing;
}
export async function syncOfflineOperation(client, user, message) {
  if (!user || !['admin','muestreador'].includes(user.role) || message.ownerId!==user.id) throw new Error('Ingresá con la cuenta que tomó estas fotos.');
  const sample=message.sample;
  if(!sample || !uuid.test(sample.id) || !uuid.test(sample.bloque_id)) throw new Error('Muestra local inválida.');
  const existing = await createOnce(client.entities.SesionMuestreo, {
    id:sample.id, bloque_id:sample.bloque_id, created_by:user.id,
    muestreador_name:sample.muestreador_name, started_at:sample.started_at,
    status:'borrador', photo_count:0, fruit_count:0,
  }, user.id);
  if(existing.bloque_id!==sample.bloque_id) throw new Error('El lote de la muestra no coincide.');
  if(message.operation==='session') return {status:'saved'};
  if(message.operation==='photo') {
    const p=message.photo;
    if(!p || !uuid.test(p.id) || typeof p.base64!=='string' || p.base64.length>22000000) throw new Error('Foto local inválida.');
    const previous=(await client.entities.Foto.filter({id:p.id}))[0];
    if(previous && (previous.created_by!==user.id || previous.session_id!==sample.id)) throw new Error('La foto pertenece a otra muestra.');
    if(previous?.status==='listo') return {status:'saved'};
    const file=new Blob([Uint8Array.from(atob(p.base64), c=>c.charCodeAt(0))], {type:'image/jpeg'});
    const storage_uri=previous?.storage_uri || (await client.integrations.Core.UploadPrivateFile({file, stableId:p.id})).file_uri;
    const record=previous || await createOnce(client.entities.Foto, {
      id:p.id, created_by:user.id,session_id:sample.id,captured_at:p.captured_at,
      storage_uri,capture_metadata:p.metadata,measurement_status:'unmeasured',
      status:'procesando',fruits:[],fruit_count_estimate:null,
    }, user.id);
    const result=await savePhoto(client,{file,storage_uri,photoId:record.id,metadata:p.metadata}, sample.id, sample.variedadName);
    if(result.status!=='listo') throw new Error(result.analysisError || 'Análisis pendiente. Se reintentará con conexión.');
    return {status:'saved'};
  }
  if(message.operation==='finish') {
    const photos=await client.entities.Foto.filter({session_id:sample.id});
    if(photos.length!==sample.photo_count || photos.some(p=>p.status!=='listo')) throw new Error('Todavía hay fotos pendientes de sincronizar.');
    await client.entities.SesionMuestreo.update(sample.id,{...samplingSummary(photos),ended_at:sample.ended_at});
    return {status:'saved'};
  }
  throw new Error('Operación de sincronización inválida.');
}
