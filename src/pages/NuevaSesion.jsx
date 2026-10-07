import React, { useEffect, useRef, useState } from "react";
import { appClient } from "@/api/appClient";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import SelectorContexto from "@/components/sesion/SelectorContexto";
import GuidedCamera from "@/components/sesion/GuidedCamera";
import { Link } from "react-router-dom";
import FotoCaptura from "@/components/sesion/FotoCaptura";
import { Camera, Loader2 } from "lucide-react";
import normalizeImage from "@/lib/normalizeImage";
import { useAuth } from "@/lib/AuthContext";
import { savePhoto } from "@/lib/capture/savePhoto";

export default function NuevaSesion() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fincas, setFincas] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [variedades, setVariedades] = useState([]);
  const [fincaId, setFincaId] = useState("");
  const [bloqueId, setBloqueId] = useState("");
  const [muestreador, setMuestreador] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [finalizing, setFinalizing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState("");
  const sessionPromise = useRef(null);
  const processing = useRef(false);
  const fileInputRef = useRef(null);
  const previews = useRef([]);
  useEffect(()=>()=>previews.current.forEach(URL.revokeObjectURL),[]);

  useEffect(() => {
    setMuestreador(user?.full_name || user?.email || "");
  }, [user]);

  useEffect(() => {
    (async () => {
      const [f, b, v] = await Promise.all([
        appClient.entities.Finca.list(),
        appClient.entities.Bloque.list(),
        appClient.entities.Variedad.list(),
      ]);
      setFincas(f);
      setBloques(b);
      setVariedades(v);
    })().catch(e => setError(e.message));
  }, []);

  const bloque = bloques.find((b) => b.id === bloqueId);
  const variedadName = variedades.find((v) => v.id === bloque?.variedad_id)?.name;

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    if (!bloqueId) throw new Error("Elegí un lote antes de tomar fotos.");
    if (sessionPromise.current) return sessionPromise.current;
    sessionPromise.current = appClient.entities.SesionMuestreo.create({
      bloque_id: bloqueId,
      muestreador_name: muestreador,
      started_at: new Date().toISOString(),
      status: "borrador",
      photo_count: 0,
      fruit_count: 0,
    }).then(s => { setSessionId(s.id); return s.id; }).catch(e => { sessionPromise.current = null; throw e; });
    return sessionPromise.current;
  };

  const processPhoto = async (nf, sid) => {
      try {
        const result = await savePhoto(appClient, nf, sid, variedadName, saved => {
          setFotos(prev => prev.map(f => f.tempId === nf.tempId ? {...f, ...saved} : f));
        });
        setFotos(prev => prev.map(f => f.tempId === nf.tempId ? {...f, ...result} : f));
      } catch (err) {
        setError(err.message);
        setFotos((prev) => prev.map((f) => (f.tempId === nf.tempId ? { ...f, status: "error" } : f)));
      }
  };

  const retryPhoto = async (foto) => {
    if(processing.current) return;
    processing.current = true; setError("");
    setFotos(prev => prev.map(f => f.tempId === foto.tempId ? {...f,status:"procesando"} : f));
    try {await processPhoto(foto, await ensureSession());} catch(e) {setError(e.message);} finally {processing.current=false;}
  };

  const handleFiles = async (fileList, metadata = null) => {
    if (processing.current) return;
    processing.current = true; setError("");
    try {
    const sid = await ensureSession();
    const files = await Promise.all(Array.from(fileList).map((f) => normalizeImage(f)));
    const newFotos = files.map((file) => ({
      tempId: Math.random().toString(36).slice(2),
      previewUrl: URL.createObjectURL(file),
      status: "procesando",
      fruit_count_estimate: null,
      file, metadata,
    }));
    previews.current.push(...newFotos.map(f=>f.previewUrl));
    setFotos((prev) => [...prev, ...newFotos]);

    for (const nf of newFotos) await processPhoto(nf, sid);
    } catch(e) {setError(e.message);} finally {processing.current = false;}
  };

  useEffect(() => {
    window.scanDepthResult = (result) => {
      if (result.error) {setError(result.error);return;}
      if (!result.base64) return;
      const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));
      handleFiles([new File([bytes],"profundidad.jpg",{type:"image/jpeg"})],result.depthCapture);
    };
    return ()=>{delete window.scanDepthResult;};
  });

  const frutosTotal = fotos.reduce((acc, f) => acc + (f.fruit_count_estimate || 0), 0);
  const fotosListas = fotos.filter((f) => f.status === "listo").length;
  const fotosGuardadas = fotos.filter(f => f.status === "listo" || f.status === "guardado").length;
  const procesando = fotos.some((f) => f.status === "procesando");

  const finalizar = async () => {
    setFinalizing(true); setError("");
    try {
    const fotosDb = await appClient.entities.Foto.filter({ session_id: sessionId });
    const allFruits = fotosDb.flatMap((f) => f.fruits || []);
    const pending = fotosDb.some(f => f.status !== "listo");
    const fruitCount = allFruits.length;
    const measured = allFruits.filter(f => Number.isFinite(f.diameter_mm) && f.diameter_mm > 0);
    const avgDiam = measured.length ? measured.reduce((a,f)=>a+f.diameter_mm,0)/measured.length : null;
    const pct = (pred) => (fruitCount ? (allFruits.filter(pred).length / fruitCount) * 100 : 0);
    const redPct = pct((f) => f.color_category === "rojo" || f.color_category === "rojo_oscuro");
    const crackingPct = pct((f) => (f.defects || []).some((d) => d.type === "cracking"));
    const sunburnPct = pct((f) => (f.defects || []).some((d) => d.type === "sunburn"));
    const russetPct = pct((f) => (f.defects || []).some((d) => d.type === "russet"));

    await appClient.entities.SesionMuestreo.update(sessionId, {
      ended_at: new Date().toISOString(),
      status: pending ? "borrador" : "listo",
      photo_count: fotosDb.length,
      fruit_count: fruitCount,
      avg_diameter_mm: avgDiam,
      red_pct: pending ? null : redPct,
      cracking_pct: pending ? null : crackingPct,
      sunburn_pct: pending ? null : sunburnPct,
      russet_pct: pending ? null : russetPct,
    });
    navigate(`/sesion/${sessionId}`);
    } catch(e) {setError(e.message);} finally {setFinalizing(false);}
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-8 md:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-[#2a1a1d] mb-1">Nuevo muestreo</h1>
        <p className="text-sm text-[#9b7f82] mb-6">Elegí el lote, centrá una fruta y tomá la foto. El calibre requiere una escala validada.</p>

        {error && <p role="alert" className="p-3 bg-red-50 text-red-800 rounded-xl mb-4">{error}</p>}
        {!fincas.length || !bloques.length ? <p className="p-4 bg-white rounded-xl mb-4">Todavía no hay lotes configurados. {user?.role === "admin" && <Link to="/admin">Configurar finca y lote</Link>}</p> : null}
        {cameraOpen && <GuidedCamera onClose={()=>setCameraOpen(false)} onCapture={(file,metadata)=>handleFiles([file],metadata)}/>}
        <SelectorContexto
          fincas={fincas}
          bloques={bloques}
          fincaId={fincaId}
          bloqueId={bloqueId}
          onFincaChange={(v) => {
            if(sessionId) return;
            setFincaId(v);
            setBloqueId("");
          }}
          onBloqueChange={(v)=>{if(!sessionId)setBloqueId(v);}}
          muestreador={muestreador}
        />

        {bloqueId && (
          <div className="bg-white rounded-2xl border border-[#eee1dc] p-5 mt-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[#2a1a1d]">
                Fotos guardadas · {fotosGuardadas}/{fotos.length} · {fotosListas} analizadas · ≈{frutosTotal} frutos
              </p>
              <button
                disabled={procesando}
                onClick={() => {
                  if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:"depth-capture"}));
                  else setCameraOpen(true);
                }}
                className="flex items-center gap-2 bg-[#7a1f33] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#631a29] transition-colors"
              >
                <Camera className="w-4 h-4" /> Tomar foto
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"

                multiple
                className="hidden"
                onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
              />
            </div>

            <button onClick={()=>fileInputRef.current?.click()} disabled={procesando} className="text-sm underline mb-4">Subir desde galería</button>
            {fotos.length === 0 ? (
              <p className="text-sm text-[#b79a9d] py-10 text-center">Todavía no hay fotos cargadas.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {fotos.map((f) => (
                  <div key={f.tempId}><FotoCaptura foto={f} />{f.status === "guardado" && <p className="text-xs text-amber-800 mt-2">Foto guardada. Análisis pendiente: {f.analysisError}</p>}{(f.status === "error" || f.status === "guardado") && <div className="flex flex-wrap gap-2 mt-2 text-xs"><button disabled={procesando} onClick={()=>retryPhoto(f)} className="underline">{f.status === "guardado" ? "Reintentar análisis" : "Reintentar guardado"}</button>{!f.photoId && <button disabled={procesando} onClick={()=>{URL.revokeObjectURL(f.previewUrl);setFotos(prev=>prev.filter(p=>p.tempId!==f.tempId));}} className="underline">Descartar</button>}</div>}{f.metadata?.distanceM && <p className="text-xs mt-1">Distancia al centro: {Math.round(f.metadata.distanceM*100)} cm · experimental</p>}</div>
                ))}
              </div>
            )}

            {fotos.length > 0 && (
              <button
                disabled={procesando || finalizing || !fotosGuardadas || fotos.some(f=>f.status==="error")}
                onClick={finalizar}
                className="mt-6 w-full flex items-center justify-center gap-2 bg-[#2a1a1d] text-white text-sm font-medium py-3 rounded-xl disabled:opacity-50 hover:bg-black transition-colors"
              >
                {finalizing || procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {procesando ? "Guardando y analizando fotos..." : finalizing ? "Guardando muestreo..." : fotosGuardadas > fotosListas ? "Guardar muestreo · análisis pendiente" : "Finalizar muestreo"}
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
