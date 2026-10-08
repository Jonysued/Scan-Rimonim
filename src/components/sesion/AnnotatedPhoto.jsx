import React, { useState } from "react";
import {validatedContour} from "@/lib/capture/contourGeometry";

export default function AnnotatedPhoto({ src, fruits = [] }) {
  const [dims, setDims] = useState(null);
  const located = fruits.filter(f => f.localization_version === 4 && f.segmentation_model === 'mediapipe-magic-touch-v2' && f.localization_status === 'located' && validatedContour(f.body_contour));

  return (
    <div className="relative rounded-xl overflow-hidden border border-[#eee1dc] bg-[#f4e9e5]">
      <img
        src={src}
        alt="Foto de muestreo"
        className="w-full block"
        onLoad={(e) => {
          const img=e.target;
          setDims({ w: img.naturalWidth, h: img.naturalHeight });
        }}
      />
      {dims && located.length > 0 && (
        <svg
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {located.map((f, i) => {
            const points=f.body_contour.map(p=>`${p.x*dims.w/1000},${p.y*dims.h/1000}`).join(' ');
            const left=Math.min(...f.body_contour.map(p=>p.x));
            const right=Math.max(...f.body_contour.map(p=>p.x));
            const top=Math.min(...f.body_contour.map(p=>p.y));
            return (
              <g key={i}>
                <polygon points={points} fill="none" stroke="#4ade80" strokeLinejoin="round" strokeWidth={Math.max(dims.w / 300, 2)} />
                <text
                  x={(left+right)*dims.w/2000}
                  y={Math.max(dims.h*.04,top*dims.h/1000-4)}
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
      {fruits.length > 0 && located.length === 0 && <p className="px-2 py-1 text-xs text-[#9b7f82]">Contorno no confirmado · volver a analizar</p>}
    </div>
  );
}
