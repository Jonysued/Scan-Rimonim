import React, { useState } from "react";
import {validatedContour} from "@/lib/capture/contourGeometry";
import {defectLabels, drawableDefect} from "@/lib/capture/defectGeometry";

export default function AnnotatedPhoto({ src, fruits = [] }) {
  const [dims, setDims] = useState(null);
  const located = fruits.filter(f => f.localization_version === 4 && f.segmentation_model === 'mediapipe-magic-touch-v2' && f.localization_status === 'located' && validatedContour(f.body_contour));
  const defects = fruits.flatMap(f => (f.defects || []).filter(d => defectLabels[d.type]));
  const marked = defects.map((d, i) => ({...d, number:i+1})).filter(drawableDefect);

  return (
    <div className="rounded-xl overflow-hidden border border-[#eee1dc] bg-[#f4e9e5]">
      <div className="relative">
      <img
        src={src}
        alt="Foto de muestreo"
        className="w-full block"
        onLoad={(e) => {
          const img=e.target;
          setDims({ w: img.naturalWidth, h: img.naturalHeight });
        }}
      />
      {dims && (located.length > 0 || marked.length > 0) && (
        <svg
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
          role="img"
          aria-label="Contorno de la fruta en verde y zonas de defectos estimadas por OpenAI en naranja"
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
                  {Number.isFinite(f.diameter_mm) ? `${Math.round(f.diameter_mm)} mm` : f.lidar_estimate?.status==='experimental' ? `≈${Math.round(f.lidar_estimate.diameter_mm)} mm · experimental` : "Sin calibre medido"}
                </text>
              </g>
            );
          })}
          {marked.map(d => {
            const b=d.region;
            const x=b.left*dims.w/1000, y=b.top*dims.h/1000;
            const r=Math.max(dims.w/45, 10);
            return <g key={d.number}>
              <title>{d.number}. {defectLabels[d.type]} · {d.severity}</title>
              <rect x={x} y={y} width={(b.right-b.left)*dims.w/1000} height={(b.bottom-b.top)*dims.h/1000} rx={r/3} fill="#f97316" fillOpacity="0.12" stroke="#f97316" strokeWidth={Math.max(dims.w/250,2)} strokeDasharray={d.localization_status==='tentative' ? `${r/2} ${r/3}` : undefined} />
              <circle cx={x+r} cy={y+r} r={r} fill="#c2410c" stroke="white" strokeWidth={Math.max(dims.w/500,1)} />
              <text x={x+r} y={y+r} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={r*1.3} fontWeight="700">{d.number}</text>
            </g>;
          })}
        </svg>
      )}
      </div>
      {fruits.length > 0 && <div className="px-3 py-2 text-xs text-[#63343b]">
        {fruits.map((f,i) => <p key={i}><strong>Russet / roña:</strong> {Number.isFinite(f.russet_coverage_pct) ? `${Math.round(f.russet_coverage_pct)}% de la superficie visible (estimado)` : 'Sin estimación de superficie · volver a analizar'}</p>)}
        <p className="mt-1 text-[#9b7f82]">Suma de las zonas afectadas sobre toda la piel visible. La cara oculta no se evalúa.</p>
      </div>}
      {defects.length > 0 && <div className="px-3 py-2 space-y-1 text-xs text-[#63343b]">
        <p className="font-medium">Defectos detectados por OpenAI · zonas aproximadas</p>
        {defects.map((d,i) => <p key={i}><span className="font-semibold text-orange-700">{i+1}.</span> {defectLabels[d.type]} · {d.severity}{d.localization_status==='tentative' && ' · ubicación incierta (línea punteada)'}{!drawableDefect(d) && ' · ubicación no confirmada'}</p>)}
        {defects.some(d=>!drawableDefect(d)) && <p className="text-[#9b7f82]">Volvé a analizar para intentar ubicar los defectos sobre la foto.</p>}
      </div>}
      {fruits.length > 0 && located.length === 0 && <p className="px-2 py-1 text-xs text-[#9b7f82]">Contorno no confirmado · volver a analizar</p>}
      {fruits.some(f=>f.lidar_estimate?.status==='experimental') && <p className="px-2 py-1 text-xs text-[#9b7f82]">Estimación LiDAR del cuerpo aproximado como esfera. Pendiente de comparar con calibre físico.</p>}
      {fruits.some(f=>f.lidar_estimate?.status==='unavailable' && f.lidar_estimate.reason!=='missing_depth') && <p className="px-2 py-1 text-xs text-[#9b7f82]">Profundidad insuficiente para estimar el diámetro. Acercá la fruta, mejorá la luz y volvé a capturar.</p>}
    </div>
  );
}
