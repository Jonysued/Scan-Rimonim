import { createClient } from '@supabase/supabase-js';
// Photo analysis needs only the caller's permissions, never an admin key.
export async function authenticateScoped(req, roles) {
  const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if(!token)throw Object.assign(new Error('Iniciá sesión.'),{status:401});
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw Object.assign(new Error('Falta configurar el acceso del servidor a Supabase.'),{status:503});
  const client=createClient(url,key,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await client.auth.getUser(token);
  if(error||!user)throw Object.assign(new Error('Sesión vencida.'),{status:401});
  const {data:profile,error:profileError}=await client.from('profiles').select('role').eq('id',user.id).single();
  if(profileError||!profile||!roles.includes(profile.role))throw Object.assign(new Error('Sin permiso para esta operación.'),{status:403});
  return {client,user,profile};
}
export async function authenticate(req, roles) {
  const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if(!token)throw Object.assign(new Error('Iniciá sesión.'),{status:401});
  const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await admin.auth.getUser(token);
  if(error||!user)throw Object.assign(new Error('Sesión vencida.'),{status:401});
  const {data:profile}=await admin.from('profiles').select('role').eq('id',user.id).single();
  if(!profile||!roles.includes(profile.role))throw Object.assign(new Error('Sin permiso para esta operación.'),{status:403});
  return {admin,user,profile};
}
export function fail(res,e){res.status(e.status||500).json({error:e.status?e.message:'No se pudo completar la operación. Revisá la configuración del servidor.'});}
