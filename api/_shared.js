import { createClient } from '@supabase/supabase-js';
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
