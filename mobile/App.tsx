import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Pressable,Text,View} from 'react-native';
import {WebView} from 'react-native-webview';
import Constants from 'expo-constants';
import {requireNativeModule} from 'expo-modules-core';
import * as FileSystem from 'expo-file-system/legacy';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import OfflineScreen from './OfflineScreen';
import * as Offline from './offlineStore';
import {createSyncQueue} from './syncQueue';
export default function App(){
 const ref=useRef<WebView>(null),busy=useRef(false);
 const [loadError,setLoadError]=useState(false),[offline,setOffline]=useState(false);
 const [catalog,setCatalog]=useState<Offline.Catalog|null>(null),[samples,setSamples]=useState<Offline.Sample[]>([]);
 const [syncIssue,setSyncIssue]=useState(false);
 const readyOwner=useRef<string|null>(null),failedLoad=useRef(false),generation=useRef(0);
 const mounted=useRef(true),draining=useRef(false),rerun=useRef(false);
 const replies=useRef(new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>());
 const url=Constants.expoConfig?.extra?.webUrl;
 const origin=typeof url==='string'&&url.startsWith('https://')?new URL(url).origin:'';
 async function refreshLocal(){const saved=await Offline.samples();if(mounted.current)setSamples(saved);}
 function interrupt(){
  generation.current++;readyOwner.current=null;
  for(const reply of replies.current.values()){clearTimeout(reply.timer);reply.reject(new Error('Conexión interrumpida. La muestra se conserva.'));}
  replies.current.clear();
 }
 async function send(operation:string,sample:Offline.Sample,photo?:unknown){
  if(!ref.current||!readyOwner.current)throw new Error('Sin conexión. La muestra se conserva.');
  const requestId=Offline.newId();
  const response=new Promise<any>((resolve,reject)=>{
   const timer=setTimeout(()=>{
    replies.current.delete(requestId);
    // A hung web request must not hold the queue forever. Reload its worker
    // before retrying the same stable IDs; late acknowledgements are ignored.
    failedLoad.current=true;interrupt();ref.current?.reload();
    reject(new Error('Conexión interrumpida. La muestra se conserva.'));
   },operation==='photo'?180000:30000);
   replies.current.set(requestId,{resolve,reject,timer});
  });
  const message={requestId,operation,ownerId:sample.ownerId,sample:{...sample,photos:undefined,photo_count:sample.photos.length},photo};
  try{ref.current.injectJavaScript(`if(window.scanOfflineSync){window.scanOfflineSync(${JSON.stringify(message)});}else{window.ReactNativeWebView.postMessage(${JSON.stringify(JSON.stringify({type:'offline-ack',requestId,status:'error',error:'Conexión no disponible.'}))});}true;`);}
  catch(error){const reply=replies.current.get(requestId);if(reply){clearTimeout(reply.timer);replies.current.delete(requestId);reply.reject(error instanceof Error?error:new Error('Sin conexión.'));}}
  return response;
 }
 const worker=useRef<ReturnType<typeof createSyncQueue>|null>(null);
 if(!worker.current)worker.current=createSyncQueue({owner:()=>readyOwner.current,generation:()=>generation.current,samples:Offline.samples,send,photoBase64:Offline.photoBase64,saveSample:Offline.saveSample,completeSample:Offline.completeSample,onChanged:refreshLocal});
 async function synchronize(){
  if(draining.current){rerun.current=true;return;}if(!readyOwner.current)return;draining.current=true;rerun.current=false;
  try{await worker.current!();if(mounted.current)setSyncIssue(false);}
  catch{if(mounted.current)setSyncIssue(true);}
  finally{draining.current=false;if(rerun.current&&mounted.current&&readyOwner.current)setTimeout(synchronize,0);}
 }
 useEffect(()=>{
  mounted.current=true;
  Offline.catalog().then(value=>{if(mounted.current)setCatalog(value);}).catch(()=>{});
  refreshLocal().then(synchronize).catch(()=>{if(mounted.current)setSyncIssue(true);});
  const recover=()=>{if(failedLoad.current)ref.current?.reload();else{
   ref.current?.injectJavaScript('window.scanOfflinePing?.();true;');synchronize();
  }};
  const timer=setInterval(recover,30000),subscription=AppState.addEventListener('change',state=>{if(state==='active')recover();});
  return()=>{mounted.current=false;clearInterval(timer);subscription.remove();interrupt();};
 },[]);
 async function onMessage(e:any){
  try{
   if(new URL(e.nativeEvent.url).origin!==origin)return;const msg=JSON.parse(e.nativeEvent.data);
   if(msg.type==='depth-capture')capture();
   if(msg.type==='offline-open')setOffline(true);
   if(msg.type==='offline-ready'){if(readyOwner.current&&readyOwner.current!==msg.ownerId)interrupt();readyOwner.current=msg.ownerId;failedLoad.current=false;synchronize();}
   if(msg.type==='offline-catalog'){await Offline.writeJSON('catalog.json',msg.catalog);setCatalog(msg.catalog);if(readyOwner.current&&readyOwner.current!==msg.catalog.user.id)interrupt();readyOwner.current=msg.catalog.user.id;synchronize();}
   if(msg.type==='offline-signed-out'){interrupt();setCatalog(null);await Offline.clearCatalog();}
   if(msg.type==='offline-ack'){const reply=replies.current.get(msg.requestId);if(reply){clearTimeout(reply.timer);replies.current.delete(msg.requestId);msg.status==='saved'?reply.resolve(msg):reply.reject(new Error(msg.error||'Sin conexión.'));}}
  }catch{setSyncIssue(true);}
 }
 async function capture(){if(busy.current)return;busy.current=true;let result:any;
  try{const shot=await requireNativeModule('ScanDepth').capture();if(!shot)result={cancelled:true};else{
   try{result={base64:await FileSystem.readAsStringAsync(shot.uri,{encoding:FileSystem.EncodingType.Base64}),depthCapture:shot.depthCapture};}
   finally{await FileSystem.deleteAsync(shot.uri,{idempotent:true}).catch(()=>{});}
  }}catch(e){result={error:e instanceof Error?e.message:'No se pudo tomar la foto.'};}finally{busy.current=false;}
  if(result)ref.current?.injectJavaScript(`window.scanDepthResult?.(${JSON.stringify(result)});true;`);
 }
 function online(){setOffline(false);setLoadError(false);if(failedLoad.current||!readyOwner.current)ref.current?.reload();else synchronize();}
 if(!origin)return <SafeAreaProvider><SafeAreaView><Text>Falta configurar la URL HTTPS de Scan Rimonim.</Text></SafeAreaView></SafeAreaProvider>;
 return <SafeAreaProvider><SafeAreaView style={{flex:1}}><View style={{flex:1}}>
  <View style={{padding:12,backgroundColor:'#f8fafc'}}><Pressable accessibilityRole="button" onPress={()=>offline?online():setOffline(true)}><Text style={{color:'#7a1f33',fontWeight:'600'}}>{offline?'Volver a la app':'Tomar un muestreo'}</Text></Pressable></View>
  <View style={{flex:1}}>
   {/* Keep WKWebView laid out while native sampling covers it. display:none
       removes its drawable surface and can suspend the JS sync worker. */}
   <WebView ref={ref} source={{uri:url}} originWhitelist={[origin]} javaScriptEnabled injectedJavaScriptBeforeContentLoaded="window.scanOfflineAvailable=true;true;" startInLoadingState renderLoading={()=> <ActivityIndicator style={{position:'absolute',alignSelf:'center',top:'50%'}} color="#8f1834"/>}
    accessibilityElementsHidden={offline} importantForAccessibility={offline?'no-hide-descendants':'auto'}
    onLoadStart={()=>{setLoadError(false);interrupt();}}
    onError={()=>{setLoadError(true);failedLoad.current=true;interrupt();setOffline(true);}}
    onHttpError={e=>{if(e.nativeEvent.statusCode>=400){setLoadError(true);failedLoad.current=true;interrupt();setOffline(true);}}}
    allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
    onShouldStartLoadWithRequest={r=>{try{return new URL(r.url).origin===origin;}catch{return false;}}} onMessage={onMessage}/>
   {offline&&<View style={{position:'absolute',inset:0,backgroundColor:'#fff'}}><OfflineScreen catalog={catalog} samples={samples} syncIssue={syncIssue} onChanged={async()=>{await refreshLocal();void synchronize();}} onOnline={online}/></View>}
   {loadError&&!offline&&<View style={{position:'absolute',inset:0,backgroundColor:'#fff',justifyContent:'center',alignItems:'center',padding:24,gap:20}}><Text style={{fontSize:18,textAlign:'center'}}>No pudimos conectar con Scan Rimonim.</Text><Pressable accessibilityRole="button" onPress={()=>{setLoadError(false);ref.current?.reload();}} style={{backgroundColor:'#8f1834',padding:16,borderRadius:12}}><Text style={{color:'#fff'}}>Reintentar</Text></Pressable></View>}
  </View>
 </View></SafeAreaView></SafeAreaProvider>;
}
