import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Cell, ReferenceLine } from "recharts";

// Escala 1 (verde) a 6 (rojo oscuro)
const CATEGORY_LEVEL = { verde: 1, rosado: 3, rojo: 5, rojo_oscuro: 6 };
const COLORS = ["#84cc16", "#a3e635", "#fbbf24", "#fb923c", "#ef4444", "#b91c1c"];

const intensityOf = (f) => {
  if (f.color_score != null) return Math.min(6, Math.max(1, Math.ceil(f.color_score * 6 / 100)));
  return CATEGORY_LEVEL[f.color_category] || 1;
};

export default function ColorHistograma({ fruits }) {
  fruits = fruits.filter(f => Number.isFinite(f.color_score) || CATEGORY_LEVEL[f.color_category]);
  const total = fruits.length;
  const data = [1, 2, 3, 4, 5, 6].map((lvl) => {
    const count = fruits.filter((f) => intensityOf(f) === lvl).length;
    return { nivel: String(lvl), frutos: count, pct: total ? Math.round((count / total) * 100) : 0 };
  });

  if (total === 0) return <p className="text-sm text-[#9ca3af] py-12 text-center">Sin frutos medidos en esta semana.</p>;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="nivel" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v) => [`${v} frutos`, "Cantidad"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
            cursor={{ fill: "#f9fafb" }}
          />
          <ReferenceLine x="2" stroke="#9ca3af" strokeDasharray="4 4" label={{ value: "Quiebre de color", position: "top", fontSize: 10, fill: "#6b7280" }} />
          <ReferenceLine x="6" stroke="#9ca3af" strokeDasharray="4 4" label={{ value: "Rojo intenso", position: "top", fontSize: 10, fill: "#6b7280" }} />
          <Bar dataKey="frutos" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
            <LabelList dataKey="pct" position="top" formatter={(v) => (v > 0 ? `${v}%` : "")} style={{ fontSize: 10, fill: "#374151" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-[#6b7280] text-center mt-1">Intensidad visual de color (estimación)</p>
    </div>
  );
}
