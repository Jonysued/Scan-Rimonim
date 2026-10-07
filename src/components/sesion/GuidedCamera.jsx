import React,{useEffect,useRef,useState} from 'react';
import {framing,createCaptureHold} from '@/lib/capture/framing';

export default function GuidedCamera({onCapture,onClose}){
  const video=useRef(null),stream=useRef(null),capturing=useRef(false);
  const callbacks=useRef({onCapture,onClose});
  const latestGuide=useRef({status:'search'});
  const active=useRef(null);
  const [error,setError]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
  const [guide,setGuide]=useState({status:'search',message:'Abriendo cámara…'});
  useEffect(()=>{callbacks.current={onCapture,onClose};},[onCapture,onClose]);

  async function take(automatic=false){
    const session=active.current;
    if(capturing.current||!session?.live||!video.current?.videoWidth)return;
    capturing.current=true;setBusy(true);
    try{
      const canvas=document.createElement('canvas');
      canvas.width=video.current.videoWidth;canvas.height=video.current.videoHeight;
      canvas.getContext('2d').drawImage(video.current,0,0);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
      if(!session.live)return;
      if(!blob)throw new Error('No se pudo guardar la foto. Tocá Capturar ahora para reintentar.');
      callbacks.current.onCapture(new File([blob],'captura.jpg',{type:'image/jpeg'}),{
        method:'web-framing',distanceM:null,guidance:latestGuide.current.status,automatic,
      });
      callbacks.current.onClose();
    }catch(e){
      if(session.live){setError(e.message);setBusy(false);capturing.current=false;}
    }
  }

  useEffect(()=>{
    const session={live:true};active.current=session;let timer;
    const hold=createCaptureHold();
    async function open(){
      try{
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('La cámara requiere conexión segura HTTPS.');
        const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}},audio:false});
        if(!session.live){s.getTracks().forEach(t=>t.stop());return;}
        stream.current=s;video.current.srcObject=s;await video.current.play();
        if(!session.live)return;
        setReady(true);
        const canvas=document.createElement('canvas');
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        timer=setInterval(()=>{
          if(!session.live||capturing.current||!video.current?.videoWidth)return;
          const scale=160/Math.max(video.current.videoWidth,video.current.videoHeight);
          canvas.width=Math.max(1,Math.round(video.current.videoWidth*scale));
          canvas.height=Math.max(1,Math.round(video.current.videoHeight*scale));
          ctx.drawImage(video.current,0,0,canvas.width,canvas.height);
          const next=framing(ctx.getImageData(0,0,canvas.width,canvas.height));
          latestGuide.current=next;setGuide(next);
          if(hold(next,performance.now()))void take(true);
        },250);
      }catch(e){if(session.live)setError(e.name==='NotAllowedError'?'Permití el acceso a la cámara para continuar.':e.message);}
    }
    void open();
    return()=>{session.live=false;clearInterval(timer);stream.current?.getTracks().forEach(t=>t.stop());};
  },[]);

  return <div role="dialog" aria-modal="true" aria-label="Captura guiada" className="fixed inset-0 z-50 bg-black text-white flex flex-col" style={{paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}}>
    <div className="p-4 flex justify-between"><span>Captura automática</span><button onClick={onClose}>Cerrar</button></div>
    <div className="relative flex-1 min-h-0 flex items-center justify-center">
      <video ref={video} muted playsInline className="w-full h-full object-contain"/>
      <div style={{width:'min(52vw, 40vh)',aspectRatio:'1'}} className={`pointer-events-none absolute rounded-full border-2 ${guide.status==='ready'?'border-green-400':'border-white'}`}/>
    </div>
    <div className="p-5 text-center space-y-3">
      <p aria-live="polite">{error||(busy?'Guardando foto…':guide.status==='ready'?'Mantené quieto: sacamos la foto automáticamente…':guide.message)}</p>
      <p className="text-sm text-gray-300">Una fruta completa en el centro. Si no la reconoce, tocá Capturar ahora.</p>
      <button disabled={busy||!ready} onClick={()=>take(false)} className="rounded-full bg-white text-black px-8 py-3 disabled:opacity-40">{busy?'Capturando…':'Capturar ahora'}</button>
      <p className="text-xs text-gray-400">Guía visual de encuadre; no mide centímetros.</p>
    </div>
  </div>;
}
