import type {Sample,Photo} from './offlineStore';
type Dependencies={
 owner:()=>string|null;
 generation:()=>number;
 samples:()=>Promise<Sample[]>;
 send:(operation:string,sample:Sample,photo?:unknown)=>Promise<unknown>;
 photoBase64:(photo:Photo)=>Promise<string>;
 saveSample:(sample:Sample)=>Promise<void>;
 completeSample:(sample:Sample)=>Promise<void>;
 onChanged:()=>Promise<void>;
};
// Read the durable queue again after each receipt, including samples saved while
// another upload was in flight. Never upload drafts or cross an account/reload.
export function createSyncQueue(d:Dependencies){
 let running:Promise<void>|null=null;
 return function drain():Promise<void>{
  if(running)return running;
  const run=async()=>{
   const owner=d.owner(),generation=d.generation();if(!owner)return;
   const check=()=>{if(d.owner()!==owner||d.generation()!==generation)throw new Error('Conexión interrumpida. La muestra se conserva.');};
   while(true){
    const saved=await d.samples();check();
    let sample=saved.find(s=>s.ownerId===owner&&s.ended_at&&!s.completed);
    if(!sample)return;
    await d.send('session',sample);check();
    for(const photo of sample.photos){
     if(photo.synced)continue;
     const base64=await d.photoBase64(photo);check();
     await d.send('photo',sample,{...photo,uri:undefined,base64});check();
     sample={...sample,photos:sample.photos.map(p=>p.id===photo.id?{...p,synced:true}:p)};
     await d.saveSample(sample);check();
    }
    await d.send('finish',sample);check();
    await d.completeSample(sample);
    await d.onChanged();
   }
  };
  running=run().finally(()=>{running=null;});return running;
 };
}
