import React from "react";

const labels = { verde: "Verde", rosado: "Rosado", rojo: "Rojo", rojo_oscuro: "Rojo oscuro" };

export default function ColorResultado({ fruits = [] }) {
  if (!fruits.length) return null;
  return <div className="mt-2 space-y-1 text-xs text-[#5c4448]">
    {fruits.map((fruit, index) => <div key={index}>
      <p><strong>Color:</strong> {labels[fruit.color_category] || "Sin clasificación"}</p>
      <p>Rojo: {Number.isFinite(fruit.red_coverage_pct) ? `${Math.round(fruit.red_coverage_pct)}%` : "Sin dato"}</p>
    </div>)}
  </div>;
}
