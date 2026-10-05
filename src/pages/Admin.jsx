import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import AppShell from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AdminFincasBloques from "@/components/admin/AdminFincasBloques";
import AdminVariedades from "@/components/admin/AdminVariedades";
import AdminClases from "@/components/admin/AdminClases";
import AdminMetas from "@/components/admin/AdminMetas";

export default function Admin() {
  const [data, setData] = useState({ fincas: [], bloques: [], variedades: [], clases: [], metas: [] });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [fincas, bloques, variedades, clases, metas] = await Promise.all([
      base44.entities.Finca.list(),
      base44.entities.Bloque.list(),
      base44.entities.Variedad.list(),
      base44.entities.ClaseComercial.list(),
      base44.entities.MetaBloque.list(),
    ]);
    setData({ fincas, bloques, variedades, clases, metas });
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <AppShell><div className="py-24 text-center text-[#b79a9d]">Cargando...</div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-5 md:px-8 pt-8 md:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-[#2a1a1d] mb-1">Administración</h1>
        <p className="text-sm text-[#9b7f82] mb-6">Fincas, bloques, variedades, clases comerciales y metas.</p>

        <Tabs defaultValue="fincas">
          <TabsList className="bg-white border border-[#eee1dc] rounded-xl p-1 mb-5">
            <TabsTrigger value="fincas" className="rounded-lg">Fincas / Bloques</TabsTrigger>
            <TabsTrigger value="variedades" className="rounded-lg">Variedades</TabsTrigger>
            <TabsTrigger value="clases" className="rounded-lg">Clases comerciales</TabsTrigger>
            <TabsTrigger value="metas" className="rounded-lg">Metas</TabsTrigger>
          </TabsList>
          <TabsContent value="fincas">
            <AdminFincasBloques fincas={data.fincas} bloques={data.bloques} variedades={data.variedades} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="variedades">
            <AdminVariedades variedades={data.variedades} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="clases">
            <AdminClases clases={data.clases} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="metas">
            <AdminMetas metas={data.metas} bloques={data.bloques} onRefresh={refresh} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}