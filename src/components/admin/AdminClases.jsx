import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2 } from "lucide-react";

export default function AdminClases({ clases, onRefresh }) {
  const [form, setForm] = useState({ name: "", min_mm: "", max_mm: "" });

  const add = async () => {
    if (!form.name.trim() || form.min_mm === "" || form.max_mm === "") return;
    await base44.entities.ClaseComercial.create({
      name: form.name.trim(),
      min_mm: Number(form.min_mm),
      max_mm: Number(form.max_mm),
    });
    setForm({ name: "", min_mm: "", max_mm: "" });
    onRefresh();
  };
  const remove = async (id) => {
    await base44.entities.ClaseComercial.delete(id);
    onRefresh();
  };

  return (
    <div className="bg-white rounded-2xl border border-[#eee1dc] p-5 max-w-md">
      <p className="text-sm font-semibold text-[#2a1a1d] mb-3">Clases comerciales</p>
      <div className="flex gap-2 mb-3">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nombre"
          className="flex-1 rounded-xl border border-[#eee1dc] px-3 py-2 text-sm"
        />
        <input
          value={form.min_mm}
          onChange={(e) => setForm({ ...form, min_mm: e.target.value })}
          placeholder="min mm"
          type="number"
          className="w-20 rounded-xl border border-[#eee1dc] px-2 py-2 text-sm"
        />
        <input
          value={form.max_mm}
          onChange={(e) => setForm({ ...form, max_mm: e.target.value })}
          placeholder="max mm"
          type="number"
          className="w-20 rounded-xl border border-[#eee1dc] px-2 py-2 text-sm"
        />
        <button onClick={add} className="bg-[#7a1f33] text-white px-3 rounded-xl">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        {clases.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-[#f4e9e5]">
            <span className="text-sm text-[#2a1a1d]">{c.name} · {c.min_mm}-{c.max_mm}mm</span>
            <button onClick={() => remove(c.id)}><Trash2 className="w-3.5 h-3.5 text-[#b79a9d]" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}