import React from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

export default function AlertasPanel({ alertas }) {
  return (
    <div className="bg-white rounded-2xl border border-[#eee1dc] p-5">
      <p className="text-sm font-semibold text-[#2a1a1d] mb-4">Alertas</p>
      {alertas.length === 0 ? (
        <p className="text-sm text-[#b79a9d]">Sin alertas activas.</p>
      ) : (
        <div className="space-y-2.5">
          {alertas.map((a, i) => (
            <Link
              to={`/bloque/${a.bloque_id}`}
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#f4e9e5] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#fbe9df] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#b4542a]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#2a1a1d]">{a.title}</p>
                <p className="text-xs text-[#9b7f82]">{a.bloque_name}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}