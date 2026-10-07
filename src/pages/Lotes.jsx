import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AppShell from "@/components/layout/AppShell";
import { MapPin, ChevronRight, Ruler } from "lucide-react";

export default function Lotes() {
  const [fincas, setFincas] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [variedades, setVariedades] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [f, b, v, s] = await Promise.all([
        base44.entities.Finca.list(),
        base44.entities.Bloque.list(),
        base44.entities.Variedad.list(),
        base44.entities.SesionMuestreo.filter({ status: "listo" }, "-started_at"),
      ]);
      setFincas(f);
      setBloques(b);
      setVariedades(v);
      setSesiones(s);
      setLoading(false);
    })();
  }, []);

  const variedadName = (id) => variedades.find((v) => v.id === id)?.name || "-";
  const sesionesDe = (bloqueId) => sesiones.filter((s) => s.bloque_id === bloqueId);
  const ultimaMedicion = (bloqueId) => {
    const lista = sesionesDe(bloqueId);
    return lista.length ? lista.reduce((a, s) => a + (s.avg_diameter_mm || 0), 0) / lista.length : null;
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-5 md:px-8 pt-8 md:pt-10 pb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-[#2a1a1d] mb-1">Lotes</h1>
        <p className="text-sm text-[#9b7f82] mb-6">Explorá cada lote y consultá su calibre, color y fotos.</p>

        {loading ? (
          <div className="py-24 text-center text-sm text-[#b79a9d]">Cargando...</div>
        ) : bloques.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#eee1dc] py-16 text-center text-sm text-[#b79a9d]">
            Todavía no hay lotes cargados.
          </div>
        ) : (
          fincas.map((finca) => {
            const lotesFinca = bloques.filter((b) => b.finca_id === finca.id);
            if (!lotesFinca.length) return null;
            return (
              <div key={finca.id} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-[#7a1f33]" />
                  <p className="text-sm font-semibold text-[#2a1a1d]">{finca.name}</p>
                  {finca.region && <span className="text-xs text-[#9b7f82]">· {finca.region}</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lotesFinca.map((b) => {
                    const ses = sesionesDe(b.id);
                    const avg = ultimaMedicion(b.id);
                    return (
                      <Link
                        key={b.id}
                        to={`/bloque/${b.id}`}
                        className="bg-white rounded-xl border border-[#eee1dc] p-4 hover:border-[#7a1f33]/40 hover:shadow-sm transition-all flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#2a1a1d]">{b.name}</p>
                          <p className="text-xs text-[#9b7f82] mt-0.5">
                            {variedadName(b.variedad_id)}
                            {b.area_ha ? ` · ${b.area_ha} ha` : ""}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-[#9b7f82]">
                            <span>{ses.length} muestreos</span>
                            {avg && (
                              <span className="flex items-center gap-1">
                                <Ruler className="w-3 h-3" /> {avg.toFixed(1)} mm
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#b79a9d]" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}