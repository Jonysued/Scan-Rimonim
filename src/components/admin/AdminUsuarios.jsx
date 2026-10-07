import React, { useEffect, useState } from "react";
import { appClient } from "@/api/appClient";
import { UserPlus, Loader2 } from "lucide-react";

const PERFILES = [
  { value: "admin", label: "Administrador", desc: "Gestiona todo y usuarios" },
  { value: "muestreador", label: "Muestreador", desc: "Puede tomar muestras" },
  { value: "lector", label: "Solo lectura", desc: "Solo consulta datos" },
];

export default function AdminUsuarios() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState("muestreador");
  const [invitando, setInvitando] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const u = await appClient.entities.User.list();
    setUsers(u);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const cambiarPerfil = async (id, role) => {
    await appClient.entities.User.update(id, { role });
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, role } : u)));
  };

  const invitar = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInvitando(true);
    setError("");
    try {
      await appClient.users.inviteUser(email.trim(), perfil);
      setEmail("");
      await refresh();
    } catch (err) {
      setError(err.message || "No se pudo invitar al usuario");
    }
    setInvitando(false);
  };

  return (
    <div className="space-y-5">
      {/* Invitar usuario */}
      <div className="bg-white rounded-xl border border-[#e5e7eb] p-5">
        <p className="text-sm font-semibold text-[#1f2937] mb-4">Invitar usuario</p>
        <form onSubmit={invitar} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            className="flex-1 border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#7a1f33]"
          />
          <select
            value={perfil}
            onChange={(e) => setPerfil(e.target.value)}
            className="border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#7a1f33]"
          >
            {PERFILES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={invitando}
            className="flex items-center justify-center gap-2 bg-[#7a1f33] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#631a29] disabled:opacity-50"
          >
            {invitando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Invitar
          </button>
        </form>
        {error && <p className="text-xs text-[#a33c3c] mt-2">{error}</p>}
      </div>

      {/* Lista de usuarios */}
      <div className="bg-white rounded-xl border border-[#e5e7eb] p-5">
        <p className="text-sm font-semibold text-[#1f2937] mb-4">Usuarios</p>
        {loading ? (
          <div className="py-8 text-center text-sm text-[#9b7f82]">Cargando...</div>
        ) : (
          <div className="space-y-1">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 py-2.5 px-2 rounded-lg border-b border-[#f3f4f6] last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1f2937] truncate">{u.full_name || u.email}</p>
                  <p className="text-xs text-[#9b7f82] truncate">{u.email}</p>
                </div>
                <select
                  value={PERFILES.some((p) => p.value === u.role) ? u.role : "lector"}
                  onChange={(e) => cambiarPerfil(u.id, e.target.value)}
                  className="border border-[#e5e7eb] rounded-lg px-2 py-1.5 text-xs bg-white shrink-0 focus:outline-none focus:ring-1 focus:ring-[#7a1f33]"
                >
                  {PERFILES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leyenda de perfiles */}
      <div className="bg-white rounded-xl border border-[#e5e7eb] p-5">
        <p className="text-sm font-semibold text-[#1f2937] mb-3">Perfiles disponibles</p>
        <div className="space-y-2">
          {PERFILES.map((p) => (
            <div key={p.value} className="flex items-center gap-2 text-sm">
              <span className="font-medium text-[#374151] w-32">{p.label}</span>
              <span className="text-[#9b7f82]">{p.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}