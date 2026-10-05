import React from "react";

export default function KpiCard({ label, value, suffix, icon: Icon, tone = "default" }) {
  const tones = {
    default: "text-[#2a1a1d]",
    good: "text-[#2f6b4f]",
    warn: "text-[#b4542a]",
  };
  return (
    <div className="bg-white rounded-2xl border border-[#eee1dc] p-5 flex items-center justify-between">
      <div>
        <p className="text-[12px] text-[#9b7f82] mb-1.5">{label}</p>
        <p className={`text-2xl font-semibold tracking-tight ${tones[tone]}`}>
          {value}
          {suffix && <span className="text-sm font-medium text-[#b79a9d] ml-1">{suffix}</span>}
        </p>
      </div>
      {Icon && (
        <div className="w-10 h-10 rounded-full bg-[#f4e9e5] flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#7a1f33]" />
        </div>
      )}
    </div>
  );
}