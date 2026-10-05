import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2 } from "lucide-react";

export default function AdminMetas({ metas, bloques, onRefresh }) {
  const [form, setForm] = useState({ bloque_id: "", target_diameter_mm: "", max_cracking_pct: "", max_sunburn_pct: "" });

  const add = async () => {
    if (!form.bloque_id) return;
    await base44.entities.MetaBloque.create({
      bloque_id: form.bloque_id,
      target_diameter_mm: form.target_diameter_mm ? Number(form.target_diameter_mm) : undefined,
      max_cracking_pct: form.max_cracking_pct ? Number(form.max_cracking_pct) : undefined,
      max_sunburn_pct: form.max_sunburn_pct ? Number(form.max_sunburn_pct) : undefined,
    });
    setForm({ bloque_id: "", target_diameter_mm: "", max_cracking_pct: "", max_sunburn_pct: "" });
    onRefresh();
  };
  const remove = async (id) => {
    await base44.entities.MetaBloque.delete(id);
    onRefresh();
  };

  return (
    <div className="bg-white rounded-2xl border border-[#eee1dc] p-5 max-w-lg">
      <p className="text-sm font-semibold text-[#2a1a1d] mb-3">Metas por bloque</p>
      <div className="space-y-2 mb-3">
        <select
          value={form.bloque_id}
          onChange={(e) => setForm({ ...form, bloque_id: e.target.value })}
          className="w-full rounded-xl border border-[#eee1dc] px-3 py-2 text-sm bg-white"
        >
          <option value="">Bloque...</option>
          {bloques.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="flex gap-2">
          <input
            value={form.target_diameter_mm}
            onChange={(e) => setForm({ ...form, target_diameter_mm: e.target.value })}
            placeholder="Calibre objetivo mm"
            type="number"
            className="flex-1 rounded-xl border border-[#eee1dc] px-3 py-2 text-sm"
          />
          <input
            value={form.max_cracking_pct}
            onChange={(e) => setForm({ ...form, max_cracking_pct: e.target.value })}
            placeholder="Máx rajado %"
            type="number"
            className="flex-1 rounded-xl border border-[#eee1dc] px-3 py-2 text-sm"
          />
          <input
            value={form.max_sunburn_pct}
            onChange={(e) => setForm({ ...form, max_sunburn_pct: e.target.value })}
            placeholder="Máx sunburn %"
            type="number"
            className="flex-1 rounded-xl border border-[#eee1dc] px-3 py-2 text-sm"
          />
        </div>
        <button onClick={add} className="w-full flex items-center justify-center gap-1.5 bg-[#7a1f33] text-white text-sm py-2 rounded-xl">
          <Plus className="w-4 h-4" /> Agregar meta
        </button>
      </div>
      <div className="space-y-1.5">
        {metas.map((m) => (
          <div key={m.id} className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-[#f4e9e5]">
            <span className="text-sm text-[#2a1a1d]">
              {bloques.find((b) => b.id === m.bloque_id)?.name || "-"} · {m.target_diameter_mm || "-"}mm
            </span>
            <button onClick={() => remove(m.id)}><Trash2 className="w-3.5 h-3.5 text-[#b79a9d]" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}