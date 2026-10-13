import {useEffect, useRef, useState} from 'react';
import {useAuth} from '@/lib/AuthContext';
import {appClient} from '@/api/appClient';
import {syncOfflineOperation} from '@/lib/capture/offlineSync';
const post = data => window.ReactNativeWebView?.postMessage(JSON.stringify(data));
export default function OfflineBridge() {
  const {user,isLoadingAuth,authError}=useAuth();
  const busy=useRef(false);
  const [syncError,setSyncError]=useState(false);
  const currentUser=useRef(user);currentUser.current=user;
  const ownerId=user?.id,role=user?.role,hasAuthError=!!authError;
  useEffect(()=>{
    if(!window.ReactNativeWebView || isLoadingAuth) return;
    const user=currentUser.current;
    if(!user) {if(!hasAuthError)post({type:'offline-signed-out'});return;}
    let alive=true;
    const refresh=async()=>{
      try {
        const [fincas,bloques,variedades]=await Promise.all(['Finca','Bloque','Variedad'].map(k=>appClient.entities[k].list()));
        if(alive) post({type:'offline-catalog',catalog:{user:{id:user.id,role:user.role,full_name:user.full_name,email:user.email},fincas,bloques,variedades,updated_at:new Date().toISOString()}});
      } catch { /* Keep the last complete catalog if the connection drops. */ }
    };
    window.scanOfflineSync=async message=>{
      if(busy.current){post({type:'offline-ack',requestId:message.requestId,status:'error',error:'Hay una sincronización en curso. Las fotos siguen guardadas; se reintentará.'});return;}
      busy.current=true;
      try {const result=await syncOfflineOperation(appClient,user,message);setSyncError(false);post({type:'offline-ack',requestId:message.requestId,...result});}
      catch(error){const stage={session:'crear la muestra',photo:'subir o analizar la foto',finish:'confirmar la muestra'}[message.operation]||'sincronizar';const detail=`No se pudo ${stage}: ${error.message || 'Error de conexión.'}`;setSyncError(true);post({type:'offline-ack',requestId:message.requestId,status:'error',error:detail});}
      finally{busy.current=false;}
    };
    window.scanOfflinePing=()=>post({type:'offline-ready',ownerId:user.id});
    window.scanOfflinePing();
    refresh();
    window.addEventListener('online',refresh);
    const timer=setInterval(refresh,60000);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('online',refresh);delete window.scanOfflineSync;delete window.scanOfflinePing;};
  },[ownerId,role,isLoadingAuth,hasAuthError]);
  if(!syncError)return null;
  return <div role="alert" className="fixed bottom-20 left-3 right-3 z-50 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-lg">
    <p>Tus fotos están guardadas en este teléfono. Revisá la conexión para enviarlas.</p>
    <button className="mt-2 underline font-semibold" onClick={()=>post({type:'offline-open'})}>Ver ayuda</button>
    <button aria-label="Cerrar aviso de sincronización" className="ml-4 underline" onClick={()=>setSyncError(false)}>Cerrar</button>
  </div>;
}
