import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export default function RoleRoute({ roles }) {
  const { user, isLoadingAuth } = useAuth();
  if (isLoadingAuth) {
    return <div className="py-24 text-center text-[#b79a9d]">Cargando...</div>;
  }
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}