import React, {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Pressable,Text,View} from 'react-native';
import {WebView} from 'react-native-webview';
import Constants from 'expo-constants';
import {requireNativeModule} from 'expo-modules-core';
import * as FileSystem from 'expo-file-system/legacy';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import OfflineScreen from './OfflineScreen';
import * as Offline from './offlineStore';
export default function App(){
 const ref=useRef<WebView>(null);const busy=useRef(false);
 const [loadError,setLoadError]=useState(false);
 const [offline,setOffline]=useState(false);const [catalog,setCatalog]=useState<Offline.Catalog|null>(null);const [samples,setSamples]=useState<Offline.Sample[]>([]);const [syncStatus,setSyncStatus]=useState('');
 const queue=useRef<Offline.Sample[]>([]);const syncing=useRef(false);const readyOwner=useRef<string|null>(null);const failedLoad=useRef(false);
 const replies=useRef(new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>());
 async function refreshLocal(){const saved=await Offline.samples();queue.current=saved;setSamples(saved);}
 async function send(operation:string,sample:Offline.Sample,photo?:any){
  const requestId=Offline.newId();
  const response=new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{replies.current.delete(requestId);reject(new Error('Conexión interrumpida. La muestra sigue guardada en el teléfono.'));},180000);replies.current.set(requestId,{resolve,reject,timer});});
  const message={requestId,operation,ownerId:sample.ownerId,sample:{...sample,photos:undefined,photo_count:sample.photos.length},photo};
  ref.current?.injectJavaScript(`if(window.scanOfflineSync){window.scanOfflineSync(${JSON.stringify(message)});}else{window.ReactNativeWebView.postMessage(${JSON.stringify(JSON.stringify({type:'offline-ack',requestId,status:'error',error:'La app online todavía no está lista. Volvé a la app con internet y reintentá.'}))});}true;`);
  return response;
 }
 async function syncStep(label:string,operation:string,sample:Offline.Sample,photo?:any){
  setSyncStatus(label);
  try{return await send(operation,sample,photo);}catch(error){throw new Error(label+' '+(error instanceof Error?error.message:'No se pudo completar.'));}
 }
 async function synchronize(){
  if(syncing.current||!readyOwner.current)return;syncing.current=true;
  try{
   for(let sample of queue.current.filter(s=>s.ended_at&&s.ownerId===readyOwner.current)){
    await syncStep('Creando muestra de '+sample.bloqueName+'…','session',sample);
    for(const photo of sample.photos){
     if(photo.synced)continue;
     const base64=await Offline.photoBase64(photo);await syncStep('Subiendo y analizando foto '+(sample.photos.findIndex(p=>p.id===photo.id)+1)+' de '+sample.photos.length+'…','photo',sample,{...photo,uri:undefined,base64});
     sample={...sample,photos:sample.photos.map(p=>p.id===photo.id?{...p,synced:true}:p)};await Offline.saveSample(sample);
    }
    await syncStep('Confirmando muestra de '+sample.bloqueName+'…','finish',sample);await Offline.completeSample(sample);await refreshLocal();
   }
   setSyncStatus(queue.current.some(s=>s.ended_at)?'Hay muestras pendientes en otra cuenta.':queue.current.some(s=>s.ownerId===readyOwner.current)?'Hay borradores: abrilos y tocá Finalizar y guardar muestra para sincronizarlos.':'Todo sincronizado.');
  }catch(e){setSyncStatus(e instanceof Error?e.message:'Sin conexión. Las muestras siguen en el teléfono.');}finally{syncing.current=false;}
 }
 useEffect(()=>{
  Offline.catalog().then(setCatalog).catch(()=>setSyncStatus('No se pudo leer el catálogo guardado.'));
  refreshLocal().catch(()=>setSyncStatus('No se pudieron leer las muestras locales.'));
  const recover=()=>{if(failedLoad.current)ref.current?.reload();else synchronize();};
  const timer=setInterval(recover,30000);const subscription=AppState.addEventListener('change',state=>{if(state==='active')recover();});
  return()=>{clearInterval(timer);subscription.remove();for(const reply of replies.current.values()){clearTimeout(reply.timer);reply.reject(new Error('La app se cerró. Tus muestras siguen guardadas.'));}replies.current.clear();};
 },[]);
 async function onMessage(e:any){
  try{
   if(new URL(e.nativeEvent.url).origin!==origin)return;const msg=JSON.parse(e.nativeEvent.data);
   if(msg.type==='depth-capture')capture();
   if(msg.type==='offline-open')setOffline(true);
   if(msg.type==='offline-ready'){readyOwner.current=msg.ownerId;failedLoad.current=false;synchronize();}
   if(msg.type==='offline-catalog'){await Offline.writeJSON('catalog.json',msg.catalog);setCatalog(msg.catalog);readyOwner.current=msg.catalog.user.id;synchronize();}
   if(msg.type==='offline-signed-out'){readyOwner.current=null;setCatalog(null);await Offline.clearCatalog();}
   if(msg.type==='offline-ack'){const reply=replies.current.get(msg.requestId);if(reply){clearTimeout(reply.timer);replies.current.delete(msg.requestId);msg.status==='saved'?reply.resolve(msg):reply.reject(new Error(msg.error||'Sincronización pendiente.'));}}
  }catch(e){setSyncStatus(e instanceof Error?e.message:'No se pudo preparar el modo sin conexión.');}
 }
 const url=Constants.expoConfig?.extra?.webUrl;
 if(!url||!url.startsWith('https://'))return <SafeAreaProvider><SafeAreaView><Text>Falta configurar la URL HTTPS de Scan Rimonim.</Text></SafeAreaView></SafeAreaProvider>;
 const origin=new URL(url).origin;
 async function capture(){if(busy.current)return;busy.current=true;let result:any;
  try{const native=requireNativeModule('ScanDepth');const shot=await native.capture();if(!shot){result={cancelled:true};}else{
   try{const base64=await FileSystem.readAsStringAsync(shot.uri,{encoding:FileSystem.EncodingType.Base64});result={base64,depthCapture:shot.depthCapture};}finally{
    // Cleanup must never discard a successfully captured photo or mask a read error.
    try{await FileSystem.deleteAsync(shot.uri,{idempotent:true});}catch{console.warn('No se pudo limpiar el archivo temporal de la captura.');}
   }}
  }catch(e){result={error:e instanceof Error?e.message:'No se pudo tomar la foto.'};}finally{busy.current=false;}
  if(result)ref.current?.injectJavaScript(`window.scanDepthResult?.(${JSON.stringify(result)});true;`);
 }
 return <SafeAreaProvider><SafeAreaView style={{flex:1}}><View style={{flex:1}}>
 <View style={{flexDirection:'row',justifyContent:'space-between',padding:10,backgroundColor:'#f8fafc'}}><Pressable accessibilityRole="button" onPress={()=>setOffline(v=>!v)}><Text style={{color:'#7a1f33',fontWeight:'600'}}>{offline?'Ver app online':'Muestrear / sin conexión'}</Text></Pressable><Text style={{fontSize:12,color:'#64748b'}}>{samples.filter(s=>s.ownerId===catalog?.user.id&&s.ended_at).length} pendientes · {samples.filter(s=>s.ownerId===catalog?.user.id&&!s.ended_at).length} borradores</Text></View>
 {!!syncStatus&&<View style={{padding:10,backgroundColor:'#fff7ed'}}><Text accessibilityRole="alert" style={{fontSize:12,color:'#9a3412'}}>{syncStatus}</Text><Pressable accessibilityRole="button" onPress={()=>{if(!readyOwner.current){setOffline(false);ref.current?.reload();}else synchronize();}}><Text style={{color:'#7a1f33',fontWeight:'600',marginTop:6}}>Reintentar sincronización</Text></Pressable></View>}
 <View style={{flex:1,display:offline?'none':'flex'}}><WebView ref={ref} source={{uri:url}} originWhitelist={[origin]} javaScriptEnabled injectedJavaScriptBeforeContentLoaded="window.scanOfflineAvailable=true;true;" startInLoadingState renderLoading={()=> <ActivityIndicator style={{position:"absolute",alignSelf:"center",top:"50%"}} color="#8f1834"/>}
 onLoadStart={()=>{setLoadError(false);readyOwner.current=null;}} onError={()=>{setLoadError(true);failedLoad.current=true;readyOwner.current=null;setOffline(true);}} onHttpError={e=>{if(e.nativeEvent.statusCode>=400){setLoadError(true);failedLoad.current=true;readyOwner.current=null;setOffline(true);}}} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
 onShouldStartLoadWithRequest={r=>{try{return new URL(r.url).origin===origin;}catch{return false;}}}
 onMessage={onMessage}/></View>
 {offline&&<OfflineScreen catalog={catalog} samples={samples} syncStatus={syncStatus} onChanged={async()=>{await refreshLocal();synchronize();}} onOnline={()=>{setOffline(false);setLoadError(false);ref.current?.reload();}}/>}
 {loadError&&!offline&&<View style={{position:"absolute",inset:0,backgroundColor:"#fff",justifyContent:"center",alignItems:"center",padding:24,gap:20}}><Text style={{fontSize:18,textAlign:"center"}}>No pudimos conectar con Scan Rimonim. Revisá tu conexión y reintentá.</Text><Pressable accessibilityRole="button" onPress={()=>{setLoadError(false);ref.current?.reload();}} style={{backgroundColor:"#8f1834",padding:16,borderRadius:12}}><Text style={{color:"#fff"}}>Reintentar</Text></Pressable></View>}</View></SafeAreaView></SafeAreaProvider>;
}
