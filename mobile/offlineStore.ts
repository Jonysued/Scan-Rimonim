import * as FS from 'expo-file-system/legacy';
import {requireNativeModule} from 'expo-modules-core';
export type Catalog = {user:{id:string;role:string;full_name?:string;email:string};fincas:{id:string;name:string}[];bloques:{id:string;name:string;finca_id:string;variedad_id?:string}[];variedades:{id:string;name:string}[];updated_at:string};
export type Photo = {id:string;uri:string;captured_at:string;metadata:unknown;synced?:boolean};
export type Sample = {id:string;ownerId:string;bloque_id:string;bloqueName:string;muestreador_name:string;variedadName?:string;started_at:string;ended_at?:string;photos:Photo[];completed?:boolean};
const root=FS.documentDirectory+'ScanOffline/';
// iOS can move the Documents container after an update. Persist only a filename;
// resolve both old absolute manifests and new captures against today's container.
export function photoUri(photo:Photo):string{
  if(!/^[a-zA-Z0-9-]+$/.test(photo.id))throw new Error('Identificador de foto local inválido. La muestra se conserva.');
  return root+photo.id+'.jpg';
}
function portableSample(sample:Sample):Sample{
  return {...sample,photos:sample.photos.map(photo=>{photoUri(photo);return {...photo,uri:photo.id+'.jpg'};})};
}
export function newId():string{return requireNativeModule('ScanDepth').newId();}
export async function writeJSON(name:string,data:unknown){await requireNativeModule('ScanDepth').writeOfflineJSON(name,JSON.stringify(data));}
export async function catalog():Promise<Catalog|null>{
  const path=root+'catalog.json';if(!(await FS.getInfoAsync(path)).exists)return null;
  return JSON.parse(await FS.readAsStringAsync(path));
}
export async function clearCatalog(){await FS.deleteAsync(root+'catalog.json',{idempotent:true});}
export async function samples():Promise<Sample[]>{
  if(!(await FS.getInfoAsync(root)).exists)return [];
  const result:Sample[]=[];
  for(const name of await FS.readDirectoryAsync(root)){
    if(!name.startsWith('sample-') || !name.endsWith('.json'))continue;
    result.push(portableSample(JSON.parse(await FS.readAsStringAsync(root+name))));
  }
  return result.filter(s=>!s.completed).sort((a,b)=>a.started_at.localeCompare(b.started_at));
}
export async function saveSample(sample:Sample){await writeJSON('sample-'+sample.id+'.json',portableSample(sample));}
export async function saveCapture(sample:Sample,shot:{uri:string;depthCapture:unknown}):Promise<Sample>{
  const id=newId(); const uri=root+id+'.jpg';
  await FS.makeDirectoryAsync(root,{intermediates:true});
  // Copy first, then atomically commit the manifest. Never show "saved" before both succeed.
  await FS.copyAsync({from:shot.uri,to:uri});
  const updated=portableSample({...sample,photos:[...sample.photos,{id,uri,captured_at:new Date().toISOString(),metadata:shot.depthCapture}]});
  await saveSample(updated);
  await FS.deleteAsync(shot.uri,{idempotent:true}).catch(()=>{});
  return updated;
}
export async function photoBase64(photo:Photo){
  const uri=photoUri(photo);
  if(!(await FS.getInfoAsync(uri)).exists)throw new Error('No se encontró la foto pendiente en este iPhone. La muestra se conserva; no desinstales la app ni la descartes.');
  try{return await FS.readAsStringAsync(uri,{encoding:FS.EncodingType.Base64});}
  catch{throw new Error('No se pudo leer la foto guardada en este iPhone. La muestra se conserva. Desbloqueá el teléfono y reintentá la sincronización.');}
}
export async function completeSample(sample:Sample){
  // Commit the receipt before deleting local copies; a restart must not replay a completed sample.
  await saveSample({...sample,completed:true});
  for(const p of sample.photos) await FS.deleteAsync(photoUri(p),{idempotent:true}).catch(()=>{});
  await FS.deleteAsync(root+'sample-'+sample.id+'.json',{idempotent:true});
}
