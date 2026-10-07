import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AppShell from "@/components/layout/AppShell";
import EstructuraCalibre from "@/components/bloque/EstructuraCalibre";
import ColorHistograma from "@/components/bloque/ColorHistograma";
import FotosGrid from "@/components/bloque/FotosGrid";
import { ArrowLeft, Download, Link2, BarChart3, ChevronLeft, ChevronRight, Check } from "lucide-react";
import moment from "moment";

const weekKey = (s) => `${moment(s.started_at).isoWeekYear()}-W${String(moment(s.started_at).isoWeek()).padStart(2, "0")}`;

export default function BloqueDetalle() {
  const { id } = useParams();
  const [bloque, setBloque] = useState(null);
  const [variedad, setVariedad] = useState(null);
  const [finca, setFinca] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekIdx, setWeekIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const b = await base44.entities.Bloque.get(id);
      setBloque(b);
      const [f, s, v] = await Promise.all([
        base44.entities.Finca.get(b.finca_id),
        base44.entities.SesionMuestreo.filter({ bloque_id: id }, "-started_at"),
        b.variedad_id ? base44.entities.Variedad.get(b.variedad_id) : Promise.resolve(null),
      ]);
      setFinca(f);
      setSesiones(s);
      setVariedad(v);
      const fotosPorSesion = await Promise.all(
        s.map((ses) => base44.entities.Foto.filter({ session_id: ses.id }))
      );
      setFotos(fotosPorSesion.flat());
      setLoading(false);
    })();
  }, [id]);

  const listas = useMemo(() => sesiones.filter((s) => s.status === "listo"), [sesiones]);
  // Semanas con muestreos completados (asc)
  const semanas = useMemo(() => [...new Set(listas.map(weekKey))].sort(), [listas]);

  if (loading) return <AppShell><div className="py-24 text-center text-[#b79a9d]">Cargando...</div></AppShell>;

  const exportCsv = () => {
    const rows = [["Fecha", "Frutos", "Media mm", "% Rojo", "% Rajado", "% Sunburn", "% Russet"]];
    listas.forEach((s) =>
      rows.push([
        moment(s.started_at).format("YYYY-MM-DD"),
        s.fruit_count || 0,
        (s.avg_diameter_mm || 0).toFixed(1),
        (s.red_pct || 0).toFixed(1),
        (s.cracking_pct || 0).toFixed(1),
        (s.sunburn_pct || 0).toFixed(1),
        (s.russet_pct || 0).toFixed(1),
      ])
    );
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bloque.name}-export.csv`;
    a.click();
  };

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const semanaActual = semanas[Math.min(weekIdx, semanas.length - 1)] || null;

  const sesionesSemana = semanaActual ? listas.filter((s) => weekKey(s) === semanaActual) : [];
  const idsSemana = new Set(sesionesSemana.map((s) => s.id));
  const fotosSemana = fotos.filter((f) => idsSemana.has(f.session_id));
  const frutosSemana = fotosSemana.flatMap((f) => f.fruits || []);
  const avgDiamSemana = frutosSemana.length
    ? frutosSemana.reduce((a, f) => a + f.diameter_mm, 0) / frutosSemana.length
    : sesionesSemana.reduce((a, s) => a + (s.avg_diameter_mm || 0), 0) / (sesionesSemana.length || 1);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-5 md:px-8 pt-8 md:pt-10 pb-10">
        <Link to="/lotes" className="flex items-center gap-1.5 text-sm text-[#9ca3af] mb-4 hover:text-[#3b82f6]">
          <ArrowLeft className="w-4 h-4" /> Lotes
        </Link>

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1f2937]">{bloque.name}</h1>
            <p className="text-sm text-[#6b7280] mt-0.5">{finca?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 bg-white border border-[#e5e7eb] text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#f9fafb] text-[#374151]"
            >
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span>
            </button>
            <button
              onClick={share}
              className="flex items-center gap-2 bg-white border border-[#e5e7eb] text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-[#f9fafb] text-[#374151]"
            >
              {copied ? <Check className="w-4 h-4 text-[#2f6b4f]" /> : <Link2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? "Copiado" : "Compartir"}</span>
            </button>
          </div>
        </div>

        {/* Barra resumen del lote */}
        <div className="bg-white rounded-xl border border-[#e5e7eb] px-4 py-3.5 mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1f2937]">
            <BarChart3 className="w-4 h-4 text-[#6b7280]" /> {bloque.name}
          </div>
          <div className="text-xs text-[#6b7280]">
            Cultivar: <span className="font-medium text-[#374151]">{variedad?.name || "-"}</span>
          </div>
          <div className="text-xs text-[#6b7280]">
            Hectáreas: <span className="font-medium text-[#374151]">{bloque.area_ha || "-"}</span>
          </div>
          <div className="text-xs text-[#6b7280]">
            Semana: <span className="font-medium text-[#374151]">{semanaActual || "-"}</span>
          </div>
          <div className="text-xs text-[#6b7280]">
            Frutos medidos: <span className="font-medium text-[#374151]">{frutosSemana.length}</span>
          </div>
          <div className="text-xs text-[#6b7280]">
            Muestreos: <span className="font-medium text-[#374151]">{sesionesSemana.length}</span>
          </div>
          {semanas.length > 0 && (
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
                disabled={weekIdx === 0}
                className="p-1 rounded-md hover:bg-[#f3f4f6] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4 text-[#6b7280]" />
              </button>
              <span className="text-xs font-medium text-[#374151] min-w-[64px] text-center">Semana {semanaActual?.split("W")[1] || "-"}</span>
              <button
                onClick={() => setWeekIdx((i) => Math.min(semanas.length - 1, i + 1))}
                disabled={weekIdx >= semanas.length - 1}
                className="p-1 rounded-md hover:bg-[#f3f4f6] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4 text-[#6b7280]" />
              </button>
            </div>
          )}
        </div>

        {/* Estructura de calibre + Color */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2 bg-white rounded-xl border border-[#e5e7eb] p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[#1f2937]">Estructura de calibre</p>
              <p className="text-xs text-[#6b7280]">
                Calibre promedio: <span className="font-semibold text-[#374151]">{avgDiamSemana ? avgDiamSemana.toFixed(1) : "-"} mm</span>
              </p>
            </div>
            <EstructuraCalibre fruits={frutosSemana} />
          </div>
          <div className="bg-white rounded-xl border border-[#e5e7eb] p-5">
            <p className="text-sm font-semibold text-[#1f2937] mb-4">Color</p>
            <ColorHistograma fruits={frutosSemana} />
          </div>
        </div>

        {/* Imágenes de frutas */}
        <div className="bg-white rounded-xl border border-[#e5e7eb] p-5 mb-4">
          <p className="text-sm font-semibold text-[#1f2937] mb-4">Imágenes de frutas</p>
          <FotosGrid fotos={fotosSemana} />
        </div>

        {/* Sesiones */}
        <div className="bg-white rounded-xl border border-[#e5e7eb] p-5">
          <p className="text-sm font-semibold text-[#1f2937] mb-2">Sesiones</p>
          {sesiones.length === 0 ? (
            <p className="text-sm text-[#9ca3af] py-6 text-center">Sin sesiones todavía.</p>
          ) : (
            <div className="space-y-1">
              {sesiones.map((s) => (
                <Link
                  to={`/sesion/${s.id}`}
                  key={s.id}
                  className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-[#f9fafb] border-b border-[#f3f4f6] last:border-0"
                >
                  <span className="text-sm text-[#6b7280]">
                    {moment(s.started_at).format("DD/MM/YYYY")} · {weekKey(s)}
                  </span>
                  <span className="text-sm text-[#1f2937] font-medium">{s.fruit_count || 0} frutos</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}