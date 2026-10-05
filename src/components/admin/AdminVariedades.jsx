import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2 } from "lucide-react";

export default function AdminVariedades({ variedades, onRefresh }) {
  const [name, setName] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    await base44.entities.Variedad.create({ name: name.trim() });
    setName("");
    onRefresh();
  };
  const remove = async (id) => {
    await base44.entities.Variedad.delete(id);
    onRefresh();
  };

  return (
    <div className="bg-white rounded-2xl border border-[#eee1dc] p-5 max-w-md">
      <p className="text-sm font-semibold text-[#2a1a1d] mb-3">Variedades</p>
      <div className="flex gap-2 mb-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Wonderful"
          className="flex-1 rounded-xl border border-[#eee1dc] px-3 py-2 text-sm"
        />
        <button onClick={add} className="bg-[#7a1f33] text-white px-3 rounded-xl">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        {variedades.map((v) => (
          <div key={v.id} className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-[#f4e9e5]">
            <span className="text-sm text-[#2a1a1d]">{v.name}</span>
            <button onClick={() => remove(v.id)}><Trash2 className="w-3.5 h-3.5 text-[#b79a9d]" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}