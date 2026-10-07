import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import SelectorContexto from "@/components/sesion/SelectorContexto";
import FotoCaptura from "@/components/sesion/FotoCaptura";
import { Camera, Loader2 } from "lucide-react";
import normalizeImage from "@/lib/normalizeImage";

export default function NuevaSesion() {
  const navigate = useNavigate();
  const [fincas, setFincas] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [variedades, setVariedades] = useState([]);
  const [fincaId, setFincaId] = useState("");
  const [bloqueId, setBloqueId] = useState("");
  const [muestreador, setMuestreador] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [finalizing, setFinalizing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [f, b, v] = await Promise.all([
        base44.entities.Finca.list(),
        base44.entities.Bloque.list(),
        base44.entities.Variedad.list(),
      ]);
      setFincas(f);
      setBloques(b);
      setVariedades(v);
    })();
  }, []);

  const bloque = bloques.find((b) => b.id === bloqueId);
  const variedadName = variedades.find((v) => v.id === bloque?.variedad_id)?.name;

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const s = await base44.entities.SesionMuestreo.create({
      bloque_id: bloqueId,
      muestreador_name: muestreador,
      started_at: new Date().toISOString(),
      status: "borrador",
      photo_count: 0,
      fruit_count: 0,
    });
    setSessionId(s.id);
    return s.id;
  };

  const handleFiles = async (fileList) => {
    const sid = await ensureSession();
    const files = await Promise.all(Array.from(fileList).map((f) => normalizeImage(f)));
    const newFotos = files.map((file) => ({
      tempId: Math.random().toString(36).slice(2),
      previewUrl: URL.createObjectURL(file),
      status: "procesando",
      fruit_count_estimate: null,
      file,
    }));
    setFotos((prev) => [...prev, ...newFotos]);

    for (const nf of newFotos) {
      try {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: nf.file });
        const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri });
        const analysis = await base44.functions.invoke("analyzePhoto", {
          signed_url,
          variedad_name: variedadName,
        });
        const fruits = analysis.data.fruits || [];
        await base44.entities.Foto.create({
          session_id: sid,
          captured_at: new Date().toISOString(),
          storage_uri: file_uri,
          status: "listo",
          fruit_count_estimate: analysis.data.fruit_count_estimate || fruits.length,
          avg_diameter_mm: fruits.length
            ? fruits.reduce((a, f) => a + f.diameter_mm, 0) / fruits.length
            : null,
          fruits,
        });
        setFotos((prev) =>
          prev.map((f) =>
            f.tempId === nf.tempId
              ? { ...f, status: "listo", fruits, fruit_count_estimate: analysis.data.fruit_count_estimate || fruits.length }
              : f
          )
        );
      } catch (err) {
        setFotos((prev) => prev.map((f) => (f.tempId === nf.tempId ? { ...f, status: "error" } : f)));
      }
    }
  };

  const frutosTotal = fotos.reduce((acc, f) => acc + (f.fruit_count_estimate || 0), 0);
  const fotosListas = fotos.filter((f) => f.status === "listo").length;
  const procesando = fotos.some((f) => f.status === "procesando");

  const finalizar = async () => {
    setFinalizing(true);
    const fotosDb = await base44.entities.Foto.filter({ session_id: sessionId });
    const allFruits = fotosDb.flatMap((f) => f.fruits || []);
    const fruitCount = allFruits.length;
    const avgDiam = fruitCount ? allFruits.reduce((a, f) => a + f.diameter_mm, 0) / fruitCount : null;
    const pct = (pred) => (fruitCount ? (allFruits.filter(pred).length / fruitCount) * 100 : 0);
    const redPct = pct((f) => f.color_category === "rojo" || f.color_category === "rojo_oscuro");
    const crackingPct = pct((f) => (f.defects || []).some((d) => d.type === "cracking"));
    const sunburnPct = pct((f) => (f.defects || []).some((d) => d.type === "sunburn"));
    const russetPct = pct((f) => (f.defects || []).some((d) => d.type === "russet"));

    await base44.entities.SesionMuestreo.update(sessionId, {
      ended_at: new Date().toISOString(),
      status: "listo",
      photo_count: fotosDb.length,
      fruit_count: fruitCount,
      avg_diameter_mm: avgDiam,
      red_pct: redPct,
      cracking_pct: crackingPct,
      sunburn_pct: sunburnPct,
      russet_pct: russetPct,
    });
    navigate(`/sesion/${sessionId}`);
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-8 md:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-[#2a1a1d] mb-1">Nuevo muestreo</h1>
        <p className="text-sm text-[#9b7f82] mb-6">Fotografiá las granadas del lote; la IA mide calibre, color y defectos.</p>

        <SelectorContexto
          fincas={fincas}
          bloques={bloques}
          fincaId={fincaId}
          bloqueId={bloqueId}
          onFincaChange={(v) => {
            setFincaId(v);
            setBloqueId("");
          }}
          onBloqueChange={setBloqueId}
          muestreador={muestreador}
          onMuestreadorChange={setMuestreador}
        />

        {bloqueId && (
          <div className="bg-white rounded-2xl border border-[#eee1dc] p-5 mt-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[#2a1a1d]">
                Fotos · {fotosListas}/{fotos.length} · ≈{frutosTotal} frutos
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-[#7a1f33] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#631a29] transition-colors"
              >
                <Camera className="w-4 h-4" /> Tomar / subir fotos
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
              />
            </div>

            {fotos.length === 0 ? (
              <p className="text-sm text-[#b79a9d] py-10 text-center">Todavía no hay fotos cargadas.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {fotos.map((f) => (
                  <FotoCaptura key={f.tempId} foto={f} />
                ))}
              </div>
            )}

            {fotos.length > 0 && (
              <button
                disabled={procesando || finalizing}
                onClick={finalizar}
                className="mt-6 w-full flex items-center justify-center gap-2 bg-[#2a1a1d] text-white text-sm font-medium py-3 rounded-xl disabled:opacity-50 hover:bg-black transition-colors"
              >
                {finalizing || procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {procesando ? "Procesando fotos..." : finalizing ? "Finalizando..." : "Finalizar muestreo"}
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}