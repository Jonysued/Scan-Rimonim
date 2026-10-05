import React, { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Image as ImageIcon } from "lucide-react";

export default function FotoCaptura({ foto }) {
  const [dims, setDims] = useState(null);

  return (
    <div className="relative rounded-xl overflow-hidden border border-[#eee1dc] bg-[#f4e9e5]">
      {foto.previewUrl ? (
        <img
          src={foto.previewUrl}
          alt="Foto de muestreo"
          className="w-full block"
          onLoad={(e) => setDims({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
        />
      ) : (
        <div className="w-full aspect-square flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-[#c9adb0]" />
        </div>
      )}

      {dims && foto.fruits?.length > 0 && (
        <svg
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {foto.fruits.map((f, i) => {
            const cx = (f.center_x_pct / 100) * dims.w;
            const cy = (f.center_y_pct / 100) * dims.h;
            const r = (f.radius_pct / 100) * dims.w;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4ade80" strokeWidth={Math.max(dims.w / 300, 2)} />
                <text
                  x={cx}
                  y={cy - r - 4}
                  fill="#166534"
                  fontSize={Math.max(dims.w / 25, 14)}
                  fontWeight="600"
                  textAnchor="middle"
                  stroke="#ffffff"
                  strokeWidth={Math.max(dims.w / 200, 2)}
                  paintOrder="stroke"
                >
                  {Math.round(f.diameter_mm)} mm
                </text>
              </g>
            );
          })}
        </svg>
      )}

      <div className="absolute bottom-1.5 right-1.5">
        {foto.status === "procesando" && (
          <div className="bg-white/90 rounded-full p-1">
            <Loader2 className="w-4 h-4 text-[#7a1f33] animate-spin" />
          </div>
        )}
        {foto.status === "listo" && (
          <div className="bg-white/90 rounded-full p-1">
            <CheckCircle2 className="w-4 h-4 text-[#2f6b4f]" />
          </div>
        )}
        {foto.status === "error" && (
          <div className="bg-white/90 rounded-full p-1">
            <XCircle className="w-4 h-4 text-[#a33c3c]" />
          </div>
        )}
      </div>
      {foto.status === "listo" && (
        <div className="absolute top-1.5 left-1.5 bg-white/90 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#2a1a1d]">
          {foto.fruit_count_estimate} frutos
        </div>
      )}
    </div>
  );
}