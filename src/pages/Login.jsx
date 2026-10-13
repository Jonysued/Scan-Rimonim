import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import {appClient} from '@/api/appClient';
import AuthLayout from '@/components/AuthLayout';
import {LogIn} from 'lucide-react';
export default function Login(){const [error,setError]=useState('');const [busy,setBusy]=useState(false);
async function submit(e){e.preventDefault();setBusy(true);setError('');const f=new FormData(e.currentTarget);try{await appClient.auth.loginViaEmailPassword(String(f.get('email')),String(f.get('password')));location.href='/';}catch(e){setError(e.message);}finally{setBusy(false);}}
return <AuthLayout icon={LogIn} title="Ingresar a Scan Rimonim" subtitle="Muestreos de fruta"><form onSubmit={submit} className="space-y-4"><label className="block">Correo<input className="w-full border rounded-xl p-3" name="email" type="email" autoComplete="email" required /></label><label className="block">Contraseña<input className="w-full border rounded-xl p-3" name="password" type="password" autoComplete="current-password" required /></label>{error&&<p role="alert">{error}</p>}<button className="w-full rounded-xl bg-[#7a1f33] p-3 text-white" disabled={busy}>{busy?'Ingresando…':'Ingresar'}</button><Link to="/register" className="block w-full rounded-xl border border-[#7a1f33] p-3 text-center font-medium text-[#7a1f33]">Crear usuario</Link><Link to="/forgot-password" className="block text-center">Olvidé mi contraseña</Link></form></AuthLayout>;}
