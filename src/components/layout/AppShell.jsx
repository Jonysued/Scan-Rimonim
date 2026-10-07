import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Camera, GitCompare, Settings2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const ALL_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/nueva-sesion", label: "Nuevo muestreo", icon: Camera, muestrear: true },
  { to: "/comparar", label: "Comparar", icon: GitCompare },
  { to: "/admin", label: "Administración", icon: Settings2, admin: true },
];

export default function AppShell({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role;
  const NAV = ALL_NAV.filter(
    (n) => (!n.admin || role === "admin") && (!n.muestrear || role !== "lector")
  );
  return (
    <div className="min-h-screen bg-[#faf7f5]">
      <div className="flex">
        <aside className="hidden md:flex md:w-60 md:flex-col h-screen sticky top-0 border-r border-[#eee1dc] bg-white">
          <div className="px-6 py-7 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#7a1f33] flex items-center justify-center">
              <span className="text-white text-sm font-semibold">G</span>
            </div>
            <div>
              <p className="font-semibold text-[15px] tracking-tight text-[#2a1a1d]">Granada Monitor</p>
              <p className="text-[11px] text-[#9b7f82] -mt-0.5">Muestreo de precisión</p>
            </div>
          </div>
          <nav className="flex-1 px-3 space-y-1 mt-2">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-[#7a1f33] text-white"
                      : "text-[#5c4448] hover:bg-[#f4e9e5]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="px-6 py-5 text-[11px] text-[#b79a9d]">MVP · estilo TrueFruit</div>
        </aside>

        <div className="flex-1 min-h-screen">
          <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#eee1dc] bg-white sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#7a1f33] flex items-center justify-center">
                <span className="text-white text-xs font-semibold">G</span>
              </div>
              <p className="font-semibold text-sm text-[#2a1a1d]">Granada Monitor</p>
            </div>
          </header>
          <main className="pb-24 md:pb-10">{children}</main>
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#eee1dc] flex justify-around py-2 z-10">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link key={to} to={to} className="flex flex-col items-center gap-0.5 px-2">
                  <Icon className={`w-5 h-5 ${active ? "text-[#7a1f33]" : "text-[#b79a9d]"}`} />
                  <span className={`text-[10px] ${active ? "text-[#7a1f33] font-medium" : "text-[#b79a9d]"}`}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}