import { getClient, unwrap } from './supabase';
const tables = { Finca:'fincas', Bloque:'bloques', Variedad:'variedades', ClaseComercial:'clases_comerciales', MetaBloque:'metas_bloque', SesionMuestreo:'sesiones', Foto:'fotos', User:'profiles' };
function entity(table) {
  const read = (filters={},sort='created_date',limit=1000) => {
    let q=getClient().from(table).select('*');
    for (const [k,v] of Object.entries(filters)) q=v===null ? q.is(k,null) : q.eq(k,v);
    return unwrap(q.order(sort.replace(/^-/,''),{ascending:!sort.startsWith('-')}).limit(limit));
  };
  return { list:(sort,limit)=>read({},sort,limit), filter:read,
    get:id=>unwrap(getClient().from(table).select('*').eq('id',id).single()),
    create:data=>unwrap(getClient().from(table).insert(data).select().single()),
    update:(id,data)=> table==='profiles' ? request('users',{action:'role',id,role:data.role}) : unwrap(getClient().from(table).update(data).eq('id',id).select().single()),
    delete:id=>table==='sesiones' ? deleteSample(id) : unwrap(getClient().from(table).delete().eq('id',id)) };
}
async function deleteSample(id) {
  const result = await unwrap(getClient().rpc('delete_sample', {sample_id:id}));
  const paths = result.storage_uris || [];
  let cleanupWarning = false;
  if (paths.length) {
    try {
      for (let offset=0; offset<paths.length; offset+=100) {
        const {error} = await getClient().storage.from('photos').remove(paths.slice(offset,offset+100));
        if (error) cleanupWarning = true;
      }
    } catch { cleanupWarning = true; }
  }
  return {deleted_id:result.deleted_id, cleanupWarning};
}
async function request(action,body) {
  const session=await unwrap(getClient().auth.getSession());
  if (!session?.session) throw new Error('Iniciá sesión para continuar.');
  const response=await fetch('/api/'+action,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.session.access_token},body:JSON.stringify(body)});
  const data=await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.'); return data;
}
export const appClient={
  entities:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,entity(v)])),
  auth:{
    me:async()=>{const {user}=await unwrap(getClient().auth.getUser());if(!user)throw new Error('Sesión vencida');return unwrap(getClient().from('profiles').select('*').eq('id',user.id).single());},
    loginViaEmailPassword:(email,password)=>unwrap(getClient().auth.signInWithPassword({email,password})),
    register:({email,password})=>unwrap(getClient().auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/login'}})),
    resetPasswordRequest:email=>unwrap(getClient().auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/reset-password'})),
    resetPassword:({newPassword})=>unwrap(getClient().auth.updateUser({password:newPassword})),
    logout:()=>unwrap(getClient().auth.signOut()),
  },
  users:{inviteUser:(email,role)=>request('users',{action:'invite',email,role})},
  functions:{invoke:async(name,body)=>({data:await request(name,body)})},
  integrations:{Core:{
    UploadPrivateFile:async({file,stableId})=>{const {user}=await unwrap(getClient().auth.getUser());if(!user)throw new Error('Iniciá sesión');if(stableId && !/^[0-9a-f-]{36}$/i.test(stableId))throw new Error('Identificador de foto inválido');const path=user.id+'/'+(stableId || crypto.randomUUID())+'.jpg';const {error}=await getClient().storage.from('photos').upload(path,file,{contentType:'image/jpeg',upsert:false});if(error){if(!stableId)throw error;const existing=await getClient().storage.from('photos').download(path);if(existing.error)throw error;}return {file_uri:path};},
    CreateFileSignedUrl:async({file_uri})=>{const data=await unwrap(getClient().storage.from('photos').createSignedUrl(file_uri,300));return {signed_url:data.signedUrl};},
  }}
};
