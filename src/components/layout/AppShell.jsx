import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Camera, GitCompare, Settings2, Map, LogOut, ScanLine } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const ALL_NAV = [
  { to: "/", label: "Inicio", icon: LayoutDashboard },
  { to: "/lotes", label: "Lotes", icon: Map },
  { to: "/nueva-sesion", label: "Muestrear", icon: Camera, muestrear: true },
  { to: "/comparar", label: "Comparar", icon: GitCompare },
  { to: "/admin", label: "Ajustes", icon: Settings2, admin: true },
];

function BrandMark() {
  return <svg viewBox="0 0 32 32" className="w-8 h-8 text-[#7a1f33]" aria-hidden="true"><path fill="currentColor" d="M11 8 8 3l6 3 2-5 2 5 6-3-3 5c5 2 8 6 8 11 0 7-5 12-13 12S3 26 3 19c0-5 3-9 8-11Z"/><path d="M9 14c-2 3-2 7 0 10" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>;
}

export default function AppShell({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const role = user?.role;
  const NAV = ALL_NAV.filter(
    (n) => (!n.admin || role === "admin") && (!n.muestrear || role !== "lector")
  );
  return (
    <div className="scan-app min-h-screen bg-white">
      <div className="flex">
        <aside className="hidden md:flex md:w-60 md:flex-col h-screen fixed top-0 left-0 border-r border-[#eee1dc] bg-white">
          <div className="px-6 py-7 flex items-center gap-2.5">
            <BrandMark />
            <div>
              <p className="font-semibold text-[15px] tracking-tight text-[#2a1a1d]">Scan Rimonim</p>
              <p className="text-[11px] text-[#9b7f82] -mt-0.5">Muestreo de precisión</p>
            </div>
          </div>
          <nav className="flex-1 px-3 space-y-1 mt-2">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to || (to === "/lotes" && location.pathname.startsWith("/bloque/"));
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={event=>{if(to==='/nueva-sesion' && window.scanOfflineAvailable && window.ReactNativeWebView){event.preventDefault();window.ReactNativeWebView.postMessage(JSON.stringify({type:'offline-open'}));}}}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-[#f8eef1] text-[#7a1f33] font-semibold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <button onClick={logout} className="px-6 py-5 text-sm text-left text-slate-500 flex items-center gap-2 hover:text-[#7a1f33]"><LogOut className="w-4 h-4" />Cerrar sesión</button>
        </aside>

        <div className="flex-1 min-h-screen min-w-0 md:ml-60">
          <header className="md:hidden flex items-center justify-between px-4 py-4 border-b border-[#eee1dc] bg-white sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <BrandMark />
              <p className="font-semibold text-sm text-[#2a1a1d]">Scan Rimonim</p>
            </div>
          </header>
          <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10">{children}</main>
          <nav aria-label="Navegación principal" className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around pt-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] z-10 shadow-[0_-4px_20px_rgba(15,23,42,0.03)]">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to || (to === "/lotes" && location.pathname.startsWith("/bloque/"));
              return (
                <Link key={to} to={to} onClick={event=>{if(to==='/nueva-sesion' && window.scanOfflineAvailable && window.ReactNativeWebView){event.preventDefault();window.ReactNativeWebView.postMessage(JSON.stringify({type:'offline-open'}));}}}
                  aria-current={active ? 'page' : undefined} className={`flex flex-1 min-w-0 flex-col items-center justify-end gap-1 px-1 min-h-12 ${to === '/nueva-sesion' ? '-mt-5' : ''}`}>
                  {to === '/nueva-sesion' ? <span className="w-12 h-12 rounded-full bg-[#7a1f33] text-white flex items-center justify-center shadow-md border-4 border-white"><ScanLine className="w-6 h-6" /></span> : <Icon className={`w-5 h-5 ${active ? 'text-[#7a1f33]' : 'text-slate-500'}`} />}
                  <span className={`text-[10px] leading-tight ${active || to === '/nueva-sesion' ? 'text-[#7a1f33] font-semibold' : 'text-slate-500'}`}>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}