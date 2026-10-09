import { measuredMean } from "@/lib/capture/metrics";
import React, { useEffect, useState } from "react";
import { appClient } from "@/api/appClient";
import AppShell from "@/components/layout/AppShell";
import KpiCard from "@/components/dashboard/KpiCard";
import AlertasPanel from "@/components/dashboard/AlertasPanel";
import { Apple, Ruler, Camera } from "lucide-react";
import { Link } from "react-router-dom";
import moment from "moment";
import { useAuth } from "@/lib/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const puedeMuestrear = user?.role !== "lector";
  const [sesiones, setSesiones] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, b, m] = await Promise.all([
        appClient.entities.SesionMuestreo.list("-started_at", 50),
        appClient.entities.Bloque.list(),
        appClient.entities.MetaBloque.list(),
      ]);
      setSesiones(s);
      setBloques(b);
      setMetas(m);
      setLoading(false);
    })();
  }, []);

  const bloqueName = (id) => bloques.find((b) => b.id === id)?.name || "Bloque";

  const hoy = sesiones.filter((s) => moment(s.started_at).isSame(moment(), "day"));
  const listas = sesiones.filter((s) => s.status === "listo");
  const totalFrutos = listas.reduce((acc, s) => acc + (s.fruit_count || 0), 0);
  const avgCalibre = measuredMean(listas.map(s => s.avg_diameter_mm));

  const alertas = [];
  listas.forEach((s) => {
    const meta = metas.find((m) => m.bloque_id === s.bloque_id);
    if (!meta) return;
    if (meta.target_diameter_mm && Number.isFinite(s.avg_diameter_mm) && s.avg_diameter_mm < meta.target_diameter_mm - 3) {
      alertas.push({ title: "Calibre bajo vs. meta", bloque_id: s.bloque_id, bloque_name: bloqueName(s.bloque_id) });
    }
  });

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-5 md:px-8 pt-8 md:pt-10">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight text-[#2a1a1d]">Dashboard</h1>
            <p className="text-sm text-[#9b7f82] mt-1">Vista general de la operación de muestreo</p>
          </div>

        </div>

        {loading ? (
          <div className="py-24 text-center text-[#b79a9d]">Cargando...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <KpiCard label="Muestreos hoy" value={hoy.length} icon={Camera} />
              <KpiCard label="Frutos medidos" value={totalFrutos.toLocaleString()} icon={Apple} />
              <KpiCard label="Calibre medio" value={avgCalibre?.toFixed(0) ?? "—"} suffix="mm" icon={Ruler} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-[#eee1dc] p-5">
                <p className="text-sm font-semibold text-[#2a1a1d] mb-4">Últimos muestreos</p>
                {sesiones.length === 0 ? (
                  <p className="text-sm text-[#b79a9d] py-8 text-center">
                    Todavía no hay muestreos. {puedeMuestrear && <Link to="/nueva-sesion" className="text-[#7a1f33] underline">Crear el primero</Link>}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] text-[#9b7f82] uppercase tracking-wide">
                          <th className="pb-2 pr-4">Fecha</th>
                          <th className="pb-2 pr-4">Lote</th>
                          <th className="pb-2 pr-4">Frutos</th>
                          <th className="pb-2 pr-4">Media mm</th>
                          <th className="pb-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sesiones.slice(0, 10).map((s) => (
                          <tr
                            key={s.id}
                            className="border-t border-[#f4e9e5] hover:bg-[#faf5f3] cursor-pointer"
                            onClick={() => (window.location.href = `/sesion/${s.id}`)}
                          >
                            <td className="py-2.5 pr-4 text-[#5c4448]">{moment(s.started_at).format("DD/MM/YYYY")}</td>
                            <td className="py-2.5 pr-4 text-[#2a1a1d] font-medium">{bloqueName(s.bloque_id)}</td>
                            <td className="py-2.5 pr-4 text-[#5c4448]">{s.fruit_count || "-"}</td>
                            <td className="py-2.5 pr-4 text-[#5c4448]">{s.avg_diameter_mm ? Math.round(s.avg_diameter_mm) : "-"}</td>
                            <td className="py-2.5">
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  s.status === "listo"
                                    ? "bg-[#e6f0ea] text-[#2f6b4f]"
                                    : s.status === "procesando"
                                    ? "bg-[#fbf3df] text-[#8a6a1f]"
                                    : s.status === "error"
                                    ? "bg-[#fbe4e4] text-[#a33c3c]"
                                    : "bg-[#f0eceb] text-[#8a7577]"
                                }`}
                              >
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <AlertasPanel alertas={alertas} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}