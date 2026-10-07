import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2 } from "lucide-react";

export default function AdminFincasBloques({ fincas, bloques, variedades, onRefresh }) {
  const [newFinca, setNewFinca] = useState("");
  const [newBloque, setNewBloque] = useState({ finca_id: "", name: "", variedad_id: "", area_ha: "" });

  const addFinca = async () => {
    if (!newFinca.trim()) return;
    await base44.entities.Finca.create({ name: newFinca.trim() });
    setNewFinca("");
    onRefresh();
  };

  const addBloque = async () => {
    if (!newBloque.name.trim() || !newBloque.finca_id) return;
    await base44.entities.Bloque.create({
      finca_id: newBloque.finca_id,
      name: newBloque.name.trim(),
      variedad_id: newBloque.variedad_id || undefined,
      area_ha: newBloque.area_ha ? Number(newBloque.area_ha) : undefined,
    });
    setNewBloque({ finca_id: "", name: "", variedad_id: "", area_ha: "" });
    onRefresh();
  };

  const removeFinca = async (id) => {
    await base44.entities.Finca.delete(id);
    onRefresh();
  };
  const removeBloque = async (id) => {
    await base44.entities.Bloque.delete(id);
    onRefresh();
  };

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <div className="bg-white rounded-2xl border border-[#eee1dc] p-5">
        <p className="text-sm font-semibold text-[#2a1a1d] mb-3">Fincas</p>
        <div className="flex gap-2 mb-3">
          <input
            value={newFinca}
            onChange={(e) => setNewFinca(e.target.value)}
            placeholder="Nombre de la finca"
            className="flex-1 rounded-xl border border-[#eee1dc] px-3 py-2 text-sm"
          />
          <button onClick={addFinca} className="bg-[#7a1f33] text-white px-3 rounded-xl">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {fincas.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-[#f4e9e5]">
              <span className="text-sm text-[#2a1a1d]">{f.name}</span>
              <button onClick={() => removeFinca(f.id)}><Trash2 className="w-3.5 h-3.5 text-[#b79a9d]" /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#eee1dc] p-5">
        <p className="text-sm font-semibold text-[#2a1a1d] mb-3">Lotes</p>
        <div className="space-y-2 mb-3">
          <select
            value={newBloque.finca_id}
            onChange={(e) => setNewBloque({ ...newBloque, finca_id: e.target.value })}
            className="w-full rounded-xl border border-[#eee1dc] px-3 py-2 text-sm bg-white"
          >
            <option value="">Finca...</option>
            {fincas.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input
              value={newBloque.name}
              onChange={(e) => setNewBloque({ ...newBloque, name: e.target.value })}
              placeholder="Nombre del lote"
              className="flex-1 rounded-xl border border-[#eee1dc] px-3 py-2 text-sm"
            />
            <select
              value={newBloque.variedad_id}
              onChange={(e) => setNewBloque({ ...newBloque, variedad_id: e.target.value })}
              className="rounded-xl border border-[#eee1dc] px-2 py-2 text-sm bg-white"
            >
              <option value="">Variedad...</option>
              {variedades.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <button onClick={addBloque} className="w-full flex items-center justify-center gap-1.5 bg-[#7a1f33] text-white text-sm py-2 rounded-xl">
            <Plus className="w-4 h-4" /> Agregar bloque
          </button>
        </div>
        <div className="space-y-1.5">
          {bloques.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-[#f4e9e5]">
              <span className="text-sm text-[#2a1a1d]">
                {b.name} <span className="text-[#9b7f82]">· {fincas.find((f) => f.id === b.finca_id)?.name}</span>
              </span>
              <button onClick={() => removeBloque(b.id)}><Trash2 className="w-3.5 h-3.5 text-[#b79a9d]" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}