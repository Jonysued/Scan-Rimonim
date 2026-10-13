import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { appClient } from "@/api/appClient";
import { Image } from "@/components/ui/image";

const PAGE_SIZE = 12;

export default function FotosGrid({ fotos }) {
  const [page, setPage] = useState(0);
  const [urls, setUrls] = useState({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setPage(0);
  }, [fotos]);

  const pageFotos = showAll ? fotos : fotos.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    let alive = true;
    (async () => {
      const missing = pageFotos.filter((f) => f.storage_uri && !urls[f.id]);
      if (!missing.length) return;
      const signed = await Promise.all(
        missing.map((f) => appClient.integrations.Core.CreateFileSignedUrl({ file_uri: f.storage_uri }))
      );
      if (!alive) return;
      setUrls((prev) => {
        const next = { ...prev };
        missing.forEach((f, i) => (next[f.id] = signed[i].signed_url));
        return next;
      });
    })();
    return () => { alive = false; };
  }, [pageFotos.map((f) => f.id).join(",")]);

  if (fotos.length === 0) {
    return <p className="text-sm text-[#9ca3af] py-12 text-center">Sin fotos de muestreo en esta semana.</p>;
  }

  const pages = Math.ceil(fotos.length / PAGE_SIZE);
  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {pageFotos.map((f) => (
          <div key={f.id} className="relative aspect-square rounded-lg overflow-hidden border border-[#e5e7eb] bg-[#f9fafb]">
            {urls[f.id] ? (
              <Image src={urls[f.id]} alt="Foto de muestreo" fittingType="fill" className="w-full h-full" />
            ) : (
              <div className="w-full h-full animate-pulse bg-[#f3f4f6]" />
            )}
            {f.fruit_count_estimate != null && (
              <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                {Number.isFinite(f.avg_diameter_mm) ? `${Math.round(f.avg_diameter_mm)} mm` : "Sin calibre medido"}
              </span>
            )}
          </div>
        ))}
      </div>

      {pages > 1 && !showAll && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1.5 rounded-md hover:bg-[#f3f4f6] disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4 text-[#6b7280]" />
          </button>
          {pageNumbers.map((n) => (
            <button
              key={n}
              onClick={() => setPage(n - 1)}
              className={`w-8 h-8 text-xs rounded-md ${n === page + 1 ? "bg-[#3b82f6] text-white font-medium" : "text-[#6b7280] hover:bg-[#f3f4f6]"}`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page === pages - 1}
            className="p-1.5 rounded-md hover:bg-[#f3f4f6] disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4 text-[#6b7280]" />
          </button>
        </div>
      )}

      {pages > 1 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="flex items-center gap-1.5 mx-auto mt-3 text-xs text-[#3b82f6] hover:underline"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {showAll ? "Ver por página" : "Ver todas"}
        </button>
      )}
    </div>
  );
}