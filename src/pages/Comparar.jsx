import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import AppShell from "@/components/layout/AppShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Comparar() {
  const [bloques, setBloques] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");

  useEffect(() => {
    (async () => {
      const [b, s] = await Promise.all([
        base44.entities.Bloque.list(),
        base44.entities.SesionMuestreo.filter({ status: "listo" }, "-started_at"),
      ]);
      setBloques(b);
      setSesiones(s);
    })();
  }, []);

  const sesionA = sesiones.find((s) => s.id === idA);
  const sesionB = sesiones.find((s) => s.id === idB);
  const bloqueName = (bid) => bloques.find((b) => b.id === bid)?.name || "-";

  const Metric = ({ label, a, b, suffix }) => (
    <div className="grid grid-cols-3 items-center py-2.5 border-b border-[#f4e9e5] last:border-0">
      <span className="text-sm text-[#9b7f82]">{label}</span>
      <span className="text-sm font-medium text-[#2a1a1d] text-center">{a != null ? `${a.toFixed(1)}${suffix}` : "-"}</span>
      <span className="text-sm font-medium text-[#2a1a1d] text-center">{b != null ? `${b.toFixed(1)}${suffix}` : "-"}</span>
    </div>
  );

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-8 md:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-[#2a1a1d] mb-1">Comparar</h1>
        <p className="text-sm text-[#9b7f82] mb-6">Compará dos sesiones de muestreo para decidir manejo o negociación.</p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[{ val: idA, set: setIdA, label: "Sesión A" }, { val: idB, set: setIdB, label: "Sesión B" }].map((s) => (
            <div key={s.label}>
              <label className="text-xs text-[#9b7f82] mb-1.5 block">{s.label}</label>
              <Select value={s.val} onValueChange={s.set}>
                <SelectTrigger className="rounded-xl border-[#eee1dc] bg-white">
                  <SelectValue placeholder="Elegir sesión" />
                </SelectTrigger>
                <SelectContent>
                  {sesiones.map((ses) => (
                    <SelectItem key={ses.id} value={ses.id}>
                      {bloqueName(ses.bloque_id)} · {new Date(ses.started_at).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {sesionA && sesionB ? (
          <div className="bg-white rounded-2xl border border-[#eee1dc] p-5">
            <div className="grid grid-cols-3 pb-2.5 border-b border-[#eee1dc] mb-1">
              <span className="text-xs text-[#9b7f82] uppercase">Métrica</span>
              <span className="text-xs text-[#9b7f82] uppercase text-center">{bloqueName(sesionA.bloque_id)}</span>
              <span className="text-xs text-[#9b7f82] uppercase text-center">{bloqueName(sesionB.bloque_id)}</span>
            </div>
            <Metric label="Calibre medio" a={sesionA.avg_diameter_mm} b={sesionB.avg_diameter_mm} suffix=" mm" />
            <Metric label="% Rojo" a={sesionA.red_pct} b={sesionB.red_pct} suffix="%" />
            <Metric label="% Rajado" a={sesionA.cracking_pct} b={sesionB.cracking_pct} suffix="%" />
            <Metric label="% Sunburn" a={sesionA.sunburn_pct} b={sesionB.sunburn_pct} suffix="%" />
            <Metric label="% Russet" a={sesionA.russet_pct} b={sesionB.russet_pct} suffix="%" />
          </div>
        ) : (
          <p className="text-sm text-[#b79a9d] py-16 text-center">Elegí dos sesiones para comparar.</p>
        )}
      </div>
    </AppShell>
  );
}