import {useEffect, useRef} from 'react';
import {useAuth} from '@/lib/AuthContext';
import {appClient} from '@/api/appClient';
import {syncOfflineOperation} from '@/lib/capture/offlineSync';
const post = data => window.ReactNativeWebView?.postMessage(JSON.stringify(data));
export default function OfflineBridge() {
  const {user,isLoadingAuth,authError}=useAuth();
  const busy=useRef(false);
  useEffect(()=>{
    if(!window.ReactNativeWebView || isLoadingAuth) return;
    if(!user) {if(!authError)post({type:'offline-signed-out'});return;}
    let alive=true;
    const refresh=async()=>{
      try {
        const [fincas,bloques,variedades]=await Promise.all(['Finca','Bloque','Variedad'].map(k=>appClient.entities[k].list()));
        if(alive) post({type:'offline-catalog',catalog:{user:{id:user.id,role:user.role,full_name:user.full_name,email:user.email},fincas,bloques,variedades,updated_at:new Date().toISOString()}});
      } catch { /* Keep the last complete catalog if the connection drops. */ }
    };
    window.scanOfflineSync=async message=>{
      if(busy.current)return;
      busy.current=true;
      try {const result=await syncOfflineOperation(appClient,user,message);post({type:'offline-ack',requestId:message.requestId,...result});}
      catch(error){post({type:'offline-ack',requestId:message.requestId,status:'error',error:error.message});}
      finally{busy.current=false;}
    };
    post({type:'offline-ready',ownerId:user.id});
    refresh();
    window.addEventListener('online',refresh);
    const timer=setInterval(refresh,60000);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('online',refresh);delete window.scanOfflineSync;};
  },[user,isLoadingAuth,authError]);
  return null;
}
