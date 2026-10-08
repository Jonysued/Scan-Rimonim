import React, { useState } from "react";

export default function AnnotatedPhoto({ src, fruits = [] }) {
  const [dims, setDims] = useState(null);
  const located = fruits.filter(f => f.localization_version === 2 && f.localization_status === 'located' &&
    ['center_x_pct', 'center_y_pct', 'radius_pct', 'radius_y_pct'].every(k => Number.isFinite(f[k]) && f[k] >= 0 && f[k] <= 100));

  return (
    <div className="relative rounded-xl overflow-hidden border border-[#eee1dc] bg-[#f4e9e5]">
      <img
        src={src}
        alt="Foto de muestreo"
        className="w-full block"
        onLoad={(e) => setDims({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
      />
      {dims && located.length > 0 && (
        <svg
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {located.map((f, i) => {
            const cx = (f.center_x_pct / 100) * dims.w;
            const cy = (f.center_y_pct / 100) * dims.h;
            const rx = (f.radius_pct / 100) * dims.w;
            const ry = f.radius_y_pct != null ? (f.radius_y_pct / 100) * dims.h : rx;
            return (
              <g key={i}>
                <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#4ade80" strokeWidth={Math.max(dims.w / 300, 2)} />
                <text
                  x={cx}
                  y={cy - ry - 4}
                  fill="#166534"
                  fontSize={Math.max(dims.w / 25, 14)}
                  fontWeight="600"
                  textAnchor="middle"
                  stroke="#ffffff"
                  strokeWidth={Math.max(dims.w / 200, 2)}
                  paintOrder="stroke"
                >
                  {Number.isFinite(f.diameter_mm) ? `${Math.round(f.diameter_mm)} mm` : "Sin calibre medido"}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {fruits.length > 0 && located.length === 0 && <p className="px-2 py-1 text-xs text-[#9b7f82]">Contorno sin validar · volver a analizar</p>}
    </div>
  );
}
