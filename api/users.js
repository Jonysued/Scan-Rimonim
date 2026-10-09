import {authenticate,fail} from './_shared.js';
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).end();
  try{const {admin}=await authenticate(req,['admin']);const {action,id,email,role}=req.body||{};
    if(!['admin','muestreador','lector'].includes(role))return res.status(400).json({error:'Perfil inválido.'});
    if(action==='role'){
      const {data:target}=await admin.from('profiles').select('role').eq('id',id).single();
      if(target?.role==='admin'&&role!=='admin'){const {count}=await admin.from('profiles').select('id',{count:'exact',head:true}).eq('role','admin');if(count<=1)return res.status(409).json({error:'Debe quedar al menos un administrador.'});}
      const {data,error}=await admin.from('profiles').update({role}).eq('id',id).select().single();if(error)throw error;return res.json(data);
    }
    if(action!=='invite'||!email||email.length>254)return res.status(400).json({error:'Correo inválido.'});
    const {data:existing}=await admin.from('profiles').select('id').eq('email',email.toLowerCase()).maybeSingle();
    let userId=existing?.id;
    if(!userId){const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:process.env.APP_ORIGIN+'/reset-password'});if(error)throw error;userId=data.user.id;}
    const {error}=await admin.from('profiles').update({role}).eq('id',userId);if(error)throw error;
    return res.json({ok:true});
  }catch(e){fail(res,e);}
}
