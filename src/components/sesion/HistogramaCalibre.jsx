import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function HistogramaCalibre({ fruits }) {
  fruits = fruits.filter(f=>Number.isFinite(f.diameter_mm) && f.diameter_mm > 0);
  if(!fruits.length) return <p className="py-8 text-center text-sm">Sin calibre medido.</p>;
  const buckets = [
    { label: "<60", min: -Infinity, max: 60 },
    { label: "60-70", min: 60, max: 70 },
    { label: "70-80", min: 70, max: 80 },
    { label: "80-90", min: 80, max: 90 },
    { label: "90+", min: 90, max: Infinity },
  ];
  const data = buckets.map((b) => ({
    label: b.label,
    frutos: fruits.filter((f) => f.diameter_mm >= b.min && f.diameter_mm < b.max).length,
  }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4e9e5" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#9b7f82" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#9b7f82" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #eee1dc", fontSize: 13 }}
            cursor={{ fill: "#f4e9e5" }}
          />
          <Bar dataKey="frutos" fill="#7a1f33" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}