import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import moment from "moment";

export default function CurvaCalibre({ sesiones }) {
  const data = sesiones
    .filter((s) => s.status === "listo")
    .sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
    .map((s) => ({
      fecha: moment(s.started_at).format("DD/MM"),
      mm: s.avg_diameter_mm ? Math.round(s.avg_diameter_mm * 10) / 10 : null,
    }));

  if (data.length === 0) {
    return <p className="text-sm text-[#b79a9d] py-10 text-center">Todavía no hay sesiones completadas.</p>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4e9e5" vertical={false} />
          <XAxis dataKey="fecha" tick={{ fontSize: 12, fill: "#9b7f82" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#9b7f82" }} axisLine={false} tickLine={false} unit="mm" />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #eee1dc", fontSize: 13 }} />
          <Line type="monotone" dataKey="mm" stroke="#7a1f33" strokeWidth={2.5} dot={{ r: 4, fill: "#7a1f33" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}