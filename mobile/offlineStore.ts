import * as FS from 'expo-file-system/legacy';
import {requireNativeModule} from 'expo-modules-core';
export type Catalog = {user:{id:string;role:string;full_name?:string;email:string};fincas:{id:string;name:string}[];bloques:{id:string;name:string;finca_id:string;variedad_id?:string}[];variedades:{id:string;name:string}[];updated_at:string};
export type Photo = {id:string;uri:string;captured_at:string;metadata:unknown;synced?:boolean};
export type Sample = {id:string;ownerId:string;bloque_id:string;bloqueName:string;muestreador_name:string;variedadName?:string;started_at:string;ended_at?:string;photos:Photo[];completed?:boolean};
const root=FS.documentDirectory+'ScanOffline/';
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
    result.push(JSON.parse(await FS.readAsStringAsync(root+name)));
  }
  return result.filter(s=>!s.completed).sort((a,b)=>a.started_at.localeCompare(b.started_at));
}
export async function saveSample(sample:Sample){await writeJSON('sample-'+sample.id+'.json',sample);}
export async function saveCapture(sample:Sample,shot:{uri:string;depthCapture:unknown}):Promise<Sample>{
  const id=newId(); const uri=root+id+'.jpg';
  await FS.makeDirectoryAsync(root,{intermediates:true});
  // Copy first, then atomically commit the manifest. Never show "saved" before both succeed.
  await FS.copyAsync({from:shot.uri,to:uri});
  const updated={...sample,photos:[...sample.photos,{id,uri,captured_at:new Date().toISOString(),metadata:shot.depthCapture}]};
  await saveSample(updated);
  await FS.deleteAsync(shot.uri,{idempotent:true}).catch(()=>{});
  return updated;
}
export async function photoBase64(photo:Photo){return FS.readAsStringAsync(photo.uri,{encoding:FS.EncodingType.Base64});}
export async function completeSample(sample:Sample){
  // Commit the receipt before deleting local copies; a restart must not replay a completed sample.
  await saveSample({...sample,completed:true});
  for(const p of sample.photos) await FS.deleteAsync(p.uri,{idempotent:true}).catch(()=>{});
  await FS.deleteAsync(root+'sample-'+sample.id+'.json',{idempotent:true});
}
