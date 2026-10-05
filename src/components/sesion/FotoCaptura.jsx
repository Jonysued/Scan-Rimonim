import React from "react";
import { Loader2, CheckCircle2, XCircle, Image as ImageIcon } from "lucide-react";
import { Image } from "@/components/ui/image";

export default function FotoCaptura({ foto }) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-[#eee1dc] bg-[#f4e9e5] aspect-square">
      {foto.previewUrl ? (
        <Image src={foto.previewUrl} className="w-full h-full" fittingType="fill" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-[#c9adb0]" />
        </div>
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