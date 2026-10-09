import React,{useEffect,useRef,useState} from 'react';

export default function GuidedCamera({onCapture,onClose}){
  const video=useRef(null),stream=useRef(null),capturing=useRef(false);
  const callbacks=useRef({onCapture,onClose});
  const active=useRef(null);
  const phoneCamera=useRef(null);
  const [error,setError]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{callbacks.current={onCapture,onClose};},[onCapture,onClose]);

  async function take(automatic=false){
    const session=active.current;
    if(capturing.current||!session?.live)return;
    if(!video.current?.videoWidth){phoneCamera.current?.click();return;}
    capturing.current=true;setBusy(true);
    try{
      const canvas=document.createElement('canvas');
      canvas.width=video.current.videoWidth;canvas.height=video.current.videoHeight;
      canvas.getContext('2d').drawImage(video.current,0,0);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
      if(!session.live)return;
      if(!blob)throw new Error('No se pudo guardar la foto. Tocá Tomar foto para reintentar.');
      callbacks.current.onCapture(new File([blob],'captura.jpg',{type:'image/jpeg'}),{
        method:'web-camera',distanceM:null,guidance:'manual',automatic,
      });
      callbacks.current.onClose();
    }catch(e){
      if(session.live){setError(e.message);setBusy(false);capturing.current=false;}
    }
  }

  useEffect(()=>{
    const session={live:true};active.current=session;
    async function open(){
      try{
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('La cámara requiere conexión segura HTTPS.');
        const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}},audio:false});
        if(!session.live){s.getTracks().forEach(t=>t.stop());return;}
        stream.current=s;video.current.srcObject=s;await video.current.play();
        if(!session.live)return;
        setReady(true);
      }catch(e){if(session.live)setError(e.name==='NotAllowedError'?'Permití el acceso a la cámara para continuar.':e.message);}
    }
    void open();
    return()=>{session.live=false;stream.current?.getTracks().forEach(t=>t.stop());};
  },[]);

  return <div role="dialog" aria-modal="true" aria-label="Captura guiada" className="fixed inset-0 z-50 bg-black text-white flex flex-col" style={{paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}}>
    <div className="p-4 flex justify-between"><span>Una fruta por foto</span><button onClick={onClose}>Cerrar</button></div>
    <div className="relative flex-1 min-h-0 flex items-center justify-center">
      <video ref={video} muted playsInline className="w-full h-full object-contain"/>
    </div>
    <div className="p-5 text-center space-y-3">
      <p aria-live="polite">{error||(busy?'Guardando foto…':ready?'Mostrá una fruta completa y enfocada.':'Abriendo cámara…')}</p>
      <p className="text-sm text-amber-200">Distancia: no disponible en esta cámara web. Esta foto no permite medir calibre en milímetros.</p>
      <button disabled={busy} onClick={()=>take(false)} className="rounded-full bg-white text-black px-8 py-3 disabled:opacity-40">{busy?'Capturando…':'Tomar foto'}</button>
      <button disabled={busy} onClick={()=>phoneCamera.current?.click()} className="block mx-auto text-sm underline">Usar cámara del teléfono</button>
      <input ref={phoneCamera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>{
        const file=e.target.files?.[0];if(!file)return;
        callbacks.current.onCapture(file,{method:'phone-camera',distanceM:null,guidance:'manual',automatic:false});
        callbacks.current.onClose();
      }}/>
    </div>
  </div>;
}
