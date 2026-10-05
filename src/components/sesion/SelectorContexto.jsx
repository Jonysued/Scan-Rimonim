import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SelectorContexto({ fincas, bloques, fincaId, bloqueId, onFincaChange, onBloqueChange, muestreador, onMuestreadorChange }) {
  const bloquesFinca = bloques.filter((b) => b.finca_id === fincaId);
  return (
    <div className="bg-white rounded-2xl border border-[#eee1dc] p-5 space-y-4">
      <p className="text-sm font-semibold text-[#2a1a1d]">Contexto de la sesión</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-[#9b7f82] mb-1.5 block">Finca</label>
          <Select value={fincaId} onValueChange={onFincaChange}>
            <SelectTrigger className="rounded-xl border-[#eee1dc]">
              <SelectValue placeholder="Elegir finca" />
            </SelectTrigger>
            <SelectContent>
              {fincas.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-[#9b7f82] mb-1.5 block">Bloque</label>
          <Select value={bloqueId} onValueChange={onBloqueChange} disabled={!fincaId}>
            <SelectTrigger className="rounded-xl border-[#eee1dc]">
              <SelectValue placeholder="Elegir bloque" />
            </SelectTrigger>
            <SelectContent>
              {bloquesFinca.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-[#9b7f82] mb-1.5 block">Muestreador</label>
          <input
            value={muestreador}
            onChange={(e) => onMuestreadorChange(e.target.value)}
            placeholder="Nombre"
            className="w-full rounded-xl border border-[#eee1dc] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1f33]/20"
          />
        </div>
      </div>
    </div>
  );
}