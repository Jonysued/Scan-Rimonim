import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { appClient } from "@/api/appClient";
import AppShell from "@/components/layout/AppShell";
import HistogramaCalibre from "@/components/sesion/HistogramaCalibre";
import AnnotatedPhoto from "@/components/sesion/AnnotatedPhoto";
import { ArrowLeft, Apple, Ruler, Droplets, AlertTriangle, Camera } from "lucide-react";
import moment from "moment";

export default function SesionResultado() {
  const { id } = useParams();
  const [sesion, setSesion] = useState(null);
  const [bloque, setBloque] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await appClient.entities.SesionMuestreo.get(id);
      setSesion(s);
      const [b, f] = await Promise.all([
        appClient.entities.Bloque.get(s.bloque_id),
        appClient.entities.Foto.filter({ session_id: id }),
      ]);
      setBloque(b);
      const withUrls = await Promise.all(
        f.map(async (foto) => {
          if (!foto.storage_uri) return foto;
          try {
            const { signed_url } = await appClient.integrations.Core.CreateFileSignedUrl({ file_uri: foto.storage_uri });
            return { ...foto, signed_url };
          } catch {
            return foto;
          }
        })
      );
      setFotos(withUrls);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <AppShell><div className="py-24 text-center text-[#b79a9d]">Cargando...</div></AppShell>;

  const allFruits = fotos.flatMap((f) => f.fruits || []);
  const pending = fotos.some(f => f.status !== "listo");
  const defectCounts = {};
  allFruits.forEach((f) => (f.defects || []).forEach((d) => {
    defectCounts[d.type] = (defectCounts[d.type] || 0) + 1;
  }));
  const topDefects = Object.entries(defectCounts).sort((a, b) => b[1] - a[1]);
  const labels = { sunburn: "Golpe de sol", cracking: "Rajado", russet: "Russet" };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-8 md:pt-10">
        <Link to={`/bloque/${bloque?.id}`} className="flex items-center gap-1.5 text-sm text-[#9b7f82] mb-4 hover:text-[#7a1f33]">
          <ArrowLeft className="w-4 h-4" /> {bloque?.name}
        </Link>

        <div className="bg-white rounded-2xl border border-[#eee1dc] p-6 mb-5">
          <p className="text-sm text-[#9b7f82] mb-1">{pending ? "Muestreo guardado · análisis pendiente" : "Resultado del muestreo"}</p>
          <p className="text-4xl font-semibold tracking-tight text-[#2a1a1d]">{pending ? `${fotos.length} fotos guardadas` : `${sesion.fruit_count || 0} frutos`}</p>
          {pending && <p className="text-sm text-amber-800 mt-3">Las fotos están guardadas. El análisis todavía no está completo; no hay resultados validados de calibre, color o defectos.</p>}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-[#eee1dc] p-4 text-center">
            <Ruler className="w-4 h-4 text-[#7a1f33] mx-auto mb-1.5" />
            <p className="text-lg font-semibold text-[#2a1a1d]">{sesion.avg_diameter_mm ? Math.round(sesion.avg_diameter_mm) : "-"} mm</p>
            <p className="text-[11px] text-[#9b7f82]">Media</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#eee1dc] p-4 text-center">
            <AlertTriangle className="w-4 h-4 text-[#b4542a] mx-auto mb-1.5" />
            <p className="text-lg font-semibold text-[#2a1a1d]">{pending ? "—" : `${(sesion.cracking_pct || 0).toFixed(0)}%`}</p>
            <p className="text-[11px] text-[#9b7f82]">Rajado</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#eee1dc] p-4 text-center">
            <Droplets className="w-4 h-4 text-[#7a1f33] mx-auto mb-1.5" />
            <p className="text-lg font-semibold text-[#2a1a1d]">{pending ? "—" : `${(sesion.red_pct || 0).toFixed(0)}%`}</p>
            <p className="text-[11px] text-[#9b7f82]">Rojo</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#eee1dc] p-5 mb-5">
          <p className="text-sm font-semibold text-[#2a1a1d] mb-3">Distribución de calibre (mm)</p>
          <HistogramaCalibre fruits={allFruits} />
        </div>

        <div className="bg-white rounded-2xl border border-[#eee1dc] p-5">
          <p className="text-sm font-semibold text-[#2a1a1d] mb-3 flex items-center gap-1.5">
            <Apple className="w-4 h-4 text-[#7a1f33]" /> Top defectos
          </p>
          {topDefects.length === 0 ? (
            <p className="text-sm text-[#b79a9d]">{pending ? "Análisis de defectos pendiente." : "Sin defectos detectados."}</p>
          ) : (
            <div className="space-y-2">
              {topDefects.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between py-1.5 border-b border-[#f4e9e5] last:border-0">
                  <span className="text-sm text-[#5c4448]">{labels[type] || type}</span>
                  <span className="text-sm font-medium text-[#2a1a1d]">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#eee1dc] p-5">
          <p className="text-sm font-semibold text-[#2a1a1d] mb-4 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-[#7a1f33]" /> Fotos del muestreo ({fotos.length})
          </p>
          {fotos.length === 0 ? (
            <p className="text-sm text-[#b79a9d] py-6 text-center">Sin fotos registradas.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {fotos.map((f) => (
                <div key={f.id}>
                  {f.signed_url ? (
                    <AnnotatedPhoto src={f.signed_url} fruits={f.fruits || []} />
                  ) : (
                    <div className="aspect-square rounded-xl bg-[#f4e9e5] flex items-center justify-center text-xs text-[#b79a9d]">
                      No disponible
                    </div>
                  )}
                  <p className="text-[11px] text-[#9b7f82] mt-1.5">
                    {f.captured_at ? moment(f.captured_at).format("HH:mm") : ""} · {f.status !== "listo" ? "Guardada · análisis pendiente" : `${f.fruit_count_estimate || 0} frutos`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
