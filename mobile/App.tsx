import React, {useRef} from 'react';
import {Text,View} from 'react-native';
import {WebView} from 'react-native-webview';
import Constants from 'expo-constants';
import {requireNativeModule} from 'expo-modules-core';
import * as FileSystem from 'expo-file-system/legacy';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
export default function App(){
 const ref=useRef<WebView>(null);const busy=useRef(false);
 const url=Constants.expoConfig?.extra?.webUrl;
 if(!url||!url.startsWith('https://'))return <SafeAreaProvider><SafeAreaView><Text>Falta configurar la URL HTTPS de Scan Rimonim.</Text></SafeAreaView></SafeAreaProvider>;
 const origin=new URL(url).origin;
 async function capture(){if(busy.current)return;busy.current=true;let result:any;
  try{const native=requireNativeModule('ScanDepth');const shot=await native.capture();if(!shot)return;
   try{const base64=await FileSystem.readAsStringAsync(shot.uri,{encoding:FileSystem.EncodingType.Base64});result={base64,depthCapture:shot.depthCapture};}finally{await FileSystem.deleteAsync(shot.uri,{idempotent:true});}
  }catch(e){result={error:e instanceof Error?e.message:'No se pudo medir la distancia.'};}finally{busy.current=false;}
  if(result)ref.current?.injectJavaScript(`window.scanDepthResult?.(${JSON.stringify(result)});true;`);
 }
 return <SafeAreaProvider><SafeAreaView style={{flex:1}}><View style={{flex:1}}><WebView ref={ref} source={{uri:url}} originWhitelist={[origin]} javaScriptEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
 onShouldStartLoadWithRequest={r=>{try{return new URL(r.url).origin===origin;}catch{return false;}}}
 onMessage={e=>{try{if(new URL(e.nativeEvent.url).origin!==origin)return;const msg=JSON.parse(e.nativeEvent.data);if(msg.type==='depth-capture')capture();}catch{/* Ignore unrelated messages. */}}}/></View></SafeAreaView></SafeAreaProvider>;
}
