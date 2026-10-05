import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AppShell from "@/components/layout/AppShell";
import CurvaCalibre from "@/components/bloque/CurvaCalibre";
import { ArrowLeft, Download } from "lucide-react";
import moment from "moment";

export default function BloqueDetalle() {
  const { id } = useParams();
  const [bloque, setBloque] = useState(null);
  const [finca, setFinca] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const b = await base44.entities.Bloque.get(id);
      setBloque(b);
      const [f, s] = await Promise.all([
        base44.entities.Finca.get(b.finca_id),
        base44.entities.SesionMuestreo.filter({ bloque_id: id }, "-started_at"),
      ]);
      setFinca(f);
      setSesiones(s);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <AppShell><div className="py-24 text-center text-[#b79a9d]">Cargando...</div></AppShell>;

  const listas = sesiones.filter((s) => s.status === "listo");
  const avgDiam = listas.length ? listas.reduce((a, s) => a + (s.avg_diameter_mm || 0), 0) / listas.length : null;

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

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-5 md:px-8 pt-8 md:pt-10">
        <Link to="/" className="flex items-center gap-1.5 text-sm text-[#9b7f82] mb-4 hover:text-[#7a1f33]">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#2a1a1d]">{bloque.name}</h1>
            <p className="text-sm text-[#9b7f82] mt-1">{finca?.name}</p>
          </div>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 bg-white border border-[#eee1dc] text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#f4e9e5] transition-colors text-[#2a1a1d]"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-[#eee1dc] p-4 text-center">
            <p className="text-lg font-semibold text-[#2a1a1d]">{sesiones.length}</p>
            <p className="text-[11px] text-[#9b7f82]">Sesiones</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#eee1dc] p-4 text-center">
            <p className="text-lg font-semibold text-[#2a1a1d]">{avgDiam ? Math.round(avgDiam) : "-"} mm</p>
            <p className="text-[11px] text-[#9b7f82]">Calibre medio</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#eee1dc] p-4 text-center">
            <p className="text-lg font-semibold text-[#2a1a1d]">{bloque.area_ha || "-"}</p>
            <p className="text-[11px] text-[#9b7f82]">Hectáreas</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#eee1dc] p-5 mb-5">
          <p className="text-sm font-semibold text-[#2a1a1d] mb-3">Calibre medio en el tiempo</p>
          <CurvaCalibre sesiones={sesiones} />
        </div>

        <div className="bg-white rounded-2xl border border-[#eee1dc] p-5">
          <p className="text-sm font-semibold text-[#2a1a1d] mb-3">Sesiones</p>
          {sesiones.length === 0 ? (
            <p className="text-sm text-[#b79a9d] py-6 text-center">Sin sesiones todavía.</p>
          ) : (
            <div className="space-y-1">
              {sesiones.map((s) => (
                <Link
                  to={`/sesion/${s.id}`}
                  key={s.id}
                  className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-[#f4e9e5] border-b border-[#f4e9e5] last:border-0"
                >
                  <span className="text-sm text-[#5c4448]">{moment(s.started_at).format("DD/MM/YYYY")}</span>
                  <span className="text-sm text-[#2a1a1d] font-medium">{s.fruit_count || 0} frutos</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}