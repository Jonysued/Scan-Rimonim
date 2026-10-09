import React,{useEffect,useState} from 'react';
import {ScrollView,View,Text,Pressable,Image,StyleSheet} from 'react-native';
import {requireNativeModule} from 'expo-modules-core';
import {Catalog,Sample,newId,saveSample,saveCapture,photoUri} from './offlineStore';
type Props={catalog:Catalog|null;samples:Sample[];onChanged:()=>Promise<void>;onOnline:()=>void;syncIssue:boolean;};
export default function OfflineScreen({catalog,samples,onChanged,onOnline,syncIssue}:Props){
 const [active,setActive]=useState<Sample|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState<Sample|null>(null);const [help,setHelp]=useState(false);
 useEffect(()=>{setActive(null);setSaved(null);setHelp(false);},[catalog?.user.id]);
 const writable=catalog && ['admin','muestreador'].includes(catalog.user.role);
 const owned=samples.filter(s=>s.ownerId===catalog?.user.id);
 async function start(b:Catalog['bloques'][number]){
  if(!catalog||busy)return;setBusy(true);setError('');setSaved(null);
  try{const sample:Sample={id:newId(),ownerId:catalog.user.id,bloque_id:b.id,bloqueName:b.name,muestreador_name:catalog.user.full_name||catalog.user.email,variedadName:catalog.variedades.find(v=>v.id===b.variedad_id)?.name,started_at:new Date().toISOString(),photos:[]};await saveSample(sample);setActive(sample);await onChanged();}catch{setError('No se pudo guardar el muestreo. Reintentá; las fotos se conservan.');}finally{setBusy(false);}
 }
 async function take(){if(!active||busy||!writable||active.ownerId!==catalog?.user.id)return;setBusy(true);setError('');try{const shot=await requireNativeModule('ScanDepth').capture();if(shot){const next=await saveCapture(active,shot);setActive(next);await onChanged();}}catch{setError('No se pudo guardar la foto. Reintentá la captura.');}finally{setBusy(false);}}
 async function finish(){if(!active||busy||!active.photos.length||!writable||active.ownerId!==catalog?.user.id)return;setBusy(true);setError('');try{const done={...active,ended_at:new Date().toISOString()};await saveSample(done);setSaved(done);setActive(null);await onChanged();}catch{setError('No se pudo guardar el muestreo. Reintentá; las fotos se conservan.');}finally{setBusy(false);}}
 return <ScrollView contentContainerStyle={s.page}>
  <Text style={s.title}>{saved?'Muestreo guardado':'Muestreo'}</Text>
  {saved?<View style={s.success} accessibilityRole="alert"><Text style={s.heading}>{saved.bloqueName}</Text><Text style={s.muted}>{saved.photos.length} {saved.photos.length===1?'foto guardada':'fotos guardadas'}</Text><Text style={s.muted}>Podés continuar con otro muestreo.</Text><Pressable accessibilityRole="button" style={s.primary} onPress={()=>setSaved(null)}><Text style={s.white}>Nuevo muestreo</Text></Pressable><Pressable accessibilityRole="button" style={s.secondary} onPress={onOnline}><Text style={s.accent}>Volver a la app</Text></Pressable></View>:null}
  {!catalog&&<Text style={s.warning}>Ingresá una vez con internet para descargar los lotes antes de salir al campo.</Text>}

  {catalog&&!writable&&<Text style={s.warning}>Tu perfil no permite tomar muestras.</Text>}
  {!!error&&<Text accessibilityRole="alert" style={s.warning}>{error}</Text>}
  {!saved&&(active?<View>
   <Text style={s.heading}>{active.bloqueName}</Text><Text style={s.muted}>{active.photos.length} fotos guardadas</Text>
   <Pressable accessibilityRole="button" disabled={busy} style={s.primary} onPress={take}><Text style={s.white}>{busy?'Guardando…':'Tomar foto'}</Text></Pressable>
   <View style={s.photos}>{active.photos.map(p=><Image key={p.id} source={{uri:photoUri(p)}} style={s.photo} accessibilityLabel="Foto guardada"/>)}</View>
   <Pressable accessibilityRole="button" disabled={busy||!active.photos.length} style={s.primary} onPress={finish}><Text style={s.white}>Finalizar y guardar muestra</Text></Pressable>
   <Pressable accessibilityRole="button" disabled={busy} style={s.secondary} onPress={()=>setActive(null)}><Text style={s.accent}>Volver · conservar borrador</Text></Pressable>
  </View>:<View>
   {owned.some(sample=>!sample.ended_at)&&<Text style={s.heading}>Muestreos sin finalizar</Text>}
   {owned.filter(sample=>!sample.ended_at).map(sample=><View key={sample.id} style={s.row}><Text style={s.heading}>{sample.bloqueName}</Text><Text style={s.muted}>{sample.photos.length} fotos guardadas</Text>{!sample.ended_at&&<Pressable accessibilityRole="button" disabled={busy||!writable} style={s.secondary} onPress={()=>setActive(sample)}><Text style={s.accent}>Continuar muestra</Text></Pressable>}</View>)}
   {writable&&<Text style={s.heading}>Elegí un lote</Text>}
   {writable&&catalog.bloques.map(b=><Pressable accessibilityRole="button" disabled={busy} key={b.id} style={s.row} onPress={()=>start(b)}><Text style={s.heading}>{b.name}</Text><Text style={s.muted}>{catalog.fincas.find(f=>f.id===b.finca_id)?.name}</Text></Pressable>)}
  </View>)}
  {!saved&&!active&&<Pressable accessibilityRole="button" onPress={()=>setHelp(v=>!v)}><Text style={s.accent}>{help?'Cerrar ayuda':'Ayuda'}</Text></Pressable>}
  {help&&!saved&&!active&&<View><Text style={s.muted}>{syncIssue?'Tus fotos están guardadas en este teléfono. Conectá el iPhone a internet y mantené la app abierta para enviarlas.':'Podés muestrear sin internet. Las fotos se guardan en este teléfono y se envían automáticamente cuando hay conexión y la app está abierta.'}</Text><Pressable accessibilityRole="button" style={s.secondary} onPress={onOnline}><Text style={s.accent}>Volver a la app</Text></Pressable></View>}
 </ScrollView>;
}
const s=StyleSheet.create({success:{padding:18,backgroundColor:'#f0fdf4',borderRadius:16,gap:8},page:{padding:20,paddingBottom:50,gap:12,backgroundColor:'#fff',flexGrow:1},title:{fontSize:24,fontWeight:'600',color:'#2a1a1d'},heading:{fontSize:16,fontWeight:'600',color:'#2a1a1d',marginVertical:6},muted:{fontSize:14,color:'#64748b',lineHeight:21},warning:{color:'#9a3412',padding:12,backgroundColor:'#fff7ed',borderRadius:10},primary:{backgroundColor:'#7a1f33',padding:16,borderRadius:12,alignItems:'center',marginVertical:10},white:{color:'#fff',fontSize:16,fontWeight:'600'},secondary:{padding:14,borderRadius:10,backgroundColor:'#f8fafc',marginVertical:6},accent:{color:'#7a1f33',fontWeight:'600'},row:{padding:14,borderWidth:1,borderColor:'#e2e8f0',borderRadius:12,marginVertical:4},photos:{flexDirection:'row',flexWrap:'wrap',gap:8},photo:{width:90,height:100,borderRadius:10}});
