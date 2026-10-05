import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Cell } from "recharts";

const TEAL = "#5eead4";

export default function EstructuraCalibre({ fruits }) {
  const buckets = [];
  buckets.push({ label: "<55", min: -Infinity, max: 55 });
  for (let m = 55; m < 110; m += 5) buckets.push({ label: `${m}-${m + 5}`, min: m, max: m + 5 });
  buckets.push({ label: ">110", min: 110, max: Infinity });

  const total = fruits.length;
  const data = buckets.map((b) => {
    const count = fruits.filter((f) => f.diameter_mm >= b.min && f.diameter_mm < b.max).length;
    return { label: b.label, frutos: count, pct: total ? Math.round((count / total) * 100) : 0 };
  });

  if (total === 0) return <p className="text-sm text-[#9ca3af] py-12 text-center">Sin frutos medidos en esta semana.</p>;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, left: -18, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            angle={-45}
            textAnchor="end"
            height={48}
          />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v) => [`${v} frutos`, "Cantidad"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
            cursor={{ fill: "#f9fafb" }}
          />
          <Bar dataKey="frutos" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={TEAL} />
            ))}
            <LabelList dataKey="pct" position="top" formatter={(v) => (v > 0 ? `${v}%` : "")} style={{ fontSize: 10, fill: "#374151" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-[#6b7280] text-center mt-1">Rangos de calibre (5 mm)</p>
    </div>
  );
}