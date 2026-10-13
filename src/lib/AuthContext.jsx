import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/api/supabase';
import { appClient } from '@/api/appClient';
const Context=createContext(null);
export function AuthProvider({children}) {
  const [user,setUser]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(null);
  const checkUserAuth=useCallback(async()=>{
    try { if(!supabase)throw new Error('Falta configurar la conexión de Scan Rimonim.');
      const {data,error:sessionError}=await supabase.auth.getSession(); if(sessionError)throw sessionError;
      setUser(data.session ? await appClient.auth.me() : null);setError(null);
    }catch(e){setError(e.message);setUser(null);}finally{setLoading(false);}
  },[]);
  useEffect(()=>{let live=true;checkUserAuth();const subscription=supabase?.auth.onAuthStateChange(()=>{setTimeout(()=>{if(live)checkUserAuth();},0);});return()=>{live=false;subscription?.data.subscription.unsubscribe();};},[checkUserAuth]);
  return <Context.Provider value={{user,isAuthenticated:!!user,isLoadingAuth:loading,isLoadingPublicSettings:false,authChecked:!loading,authError:error?{type:'connection',message:error}:null,checkUserAuth,checkAppState:checkUserAuth,logout:async()=>{await appClient.auth.logout();setUser(null);location.href='/login';}}}>{children}</Context.Provider>;
}
export function useAuth(){return useContext(Context);}
