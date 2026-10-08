import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { appClient } from "@/api/appClient";
import AppShell from "@/components/layout/AppShell";
import AnnotatedPhoto from "@/components/sesion/AnnotatedPhoto";
import { ArrowLeft, Trash2, ZoomIn } from "lucide-react";
import {AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel} from "@/components/ui/alert-dialog";
import {Dialog, DialogContent, DialogTitle, DialogDescription} from "@/components/ui/dialog";
import {toast} from "sonner";
import moment from "moment";
import {savePhoto,samplingSummary} from "@/lib/capture/savePhoto";
import {defectCoverage} from "@/lib/capture/defectGeometry";
import {useAuth} from "@/lib/AuthContext";

export default function SesionResultado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expandedPhotoId, setExpandedPhotoId] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const {user}=useAuth();
  const [sesion, setSesion] = useState(null);
  const [bloque, setBloque] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing,setAnalyzing]=useState(null);
  const [error,setError]=useState("");

  useEffect(() => {
    (async () => {
      const s = await appClient.entities.SesionMuestreo.get(id);
      setSesion(s);
      const [b, f] = await Promise.all([
        appClient.entities.Bloque.get(s.bloque_id),
        appClient.entities.Foto.filter({ session_id: id }),
      ]);
      setBloque(b);
      const withUrls = await Promise.all(
        f.map(async (foto) => {
          if (!foto.storage_uri) return foto;
          try {
            const { signed_url } = await appClient.integrations.Core.CreateFileSignedUrl({ file_uri: foto.storage_uri });
            return { ...foto, signed_url };
          } catch {
            return foto;
          }
        })
      );
      setFotos(withUrls);
      setLoading(false);
    })().catch(e=>{setError(e.message);setLoading(false);});
  }, [id]);

  async function retryAnalysis(foto) {
    if(analyzing)return;
    setAnalyzing(foto.id);setError("");
    try {
      const result=await savePhoto(appClient,{photoId:foto.id,storage_uri:foto.storage_uri,metadata:foto.capture_metadata},id);
      const updated=await appClient.entities.Foto.filter({session_id:id});
      setFotos(prev=>updated.map(f=>({...f,signed_url:prev.find(p=>p.id===f.id)?.signed_url})));
      const summary=samplingSummary(updated);
      setSesion(await appClient.entities.SesionMuestreo.update(id,summary));
      if(result.analysisError)setError(result.analysisError);
    } catch(e){setError(e.message);} finally{setAnalyzing(null);}
  }

  async function deleteSample() {
    if (user?.role !== 'admin' || deleting || analyzing) return;
    setDeleting(true); setError('');
    try {
      const result = await appClient.entities.SesionMuestreo.delete(id);
      if (result.cleanupWarning) toast.warning('Muestra eliminada. Algunas fotos almacenadas no pudieron borrarse.');
      else toast.success('Muestra eliminada.');
      navigate(bloque?.id ? `/bloque/${bloque.id}` : '/', {replace:true});
    } catch (e) { setError(e.message || 'No se pudo eliminar la muestra.'); }
    finally { setDeleting(false); setDeleteOpen(false); }
  }

  if (loading) return <AppShell><div className="py-24 text-center text-[#b79a9d]">Cargando...</div></AppShell>;
  if(!sesion)return <AppShell><p role="alert" className="p-6">{error||"No se pudo cargar el muestreo."}</p></AppShell>;

  const expandedPhoto = fotos.find(f => f.id === expandedPhotoId);
  const colorLabels = {verde: 'Verde', rosado: 'Rosado', rojo: 'Rojo', rojo_oscuro: 'Rojo oscuro'};
  const crackingSeverity = fruit => {
    const severities = (fruit.defects || []).filter(d => d.type === 'cracking').map(d => d.severity);
    return ['grave', 'media', 'leve'].find(level => severities.includes(level));
  };
  const percent = value => Number.isFinite(value) ? `${Math.round(value)}%` : '—';
  const fruitValues = (foto, render) => (foto.fruits || []).length
    ? foto.fruits.map((fruit, index) => <div key={index} className="py-0.5">{foto.fruits.length > 1 && <span className="text-[#9b7f82]">{index + 1}. </span>}{render(fruit)}</div>)
    : '—';

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-5 md:px-8 pt-8 md:pt-10">
        {error&&<p role="alert" className="p-3 mb-4 rounded-xl bg-red-50 text-red-800">{error}</p>}
        <Link to={`/bloque/${bloque?.id}`} className="flex items-center gap-1.5 text-sm text-[#9b7f82] mb-4 hover:text-[#7a1f33]">
          <ArrowLeft className="w-4 h-4" /> {bloque?.name}
        </Link>

        {user?.role === 'admin' && <div className="flex justify-end mb-4">
          <button type="button" disabled={Boolean(analyzing) || deleting} onClick={()=>setDeleteOpen(true)} className="flex items-center gap-2 text-sm text-red-700 border border-red-200 rounded-lg px-2 md:px-3 py-2 disabled:opacity-50"><Trash2 className="w-4 h-4" />Eliminar muestra</button>
        </div>}
        <AlertDialog open={deleteOpen} onOpenChange={open=>{if(!deleting)setDeleteOpen(open);}}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar esta muestra?</AlertDialogTitle>
              <AlertDialogDescription>Se eliminará el muestreo de {bloque?.name || 'este lote'} del {moment(sesion.started_at || sesion.created_date).format('DD/MM/YYYY HH:mm')}, con sus {fotos.length} fotos y resultados. Dejará de formar parte de los indicadores. Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <button type="button" disabled={deleting} onClick={deleteSample} className="bg-red-700 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50">{deleting ? 'Eliminando…' : 'Eliminar definitivamente'}</button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <div><h1 className="text-2xl font-semibold tracking-tight text-[#2a1a1d]">Muestra</h1><p className="text-sm text-[#9b7f82] mt-1">{moment(sesion.started_at || sesion.created_date).format('DD/MM/YYYY · HH:mm')}</p></div>
          <p className="text-sm text-[#9b7f82]">{fotos.length} fotos · {fotos.reduce((total, f) => total + (f.fruits || []).length, 0)} frutos</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#eee1dc] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <caption className="sr-only">Resultados por foto del muestreo</caption>
              <thead className="bg-[#faf5f2] text-[#63343b]">
                <tr>{['Foto', 'Rojo', 'Rajado', 'Russet / roña', 'Hora', 'Diámetro', 'Color', 'Quemadura de sol', 'Análisis'].map(label => <th key={label} scope="col" className="px-2 md:px-3 py-3 font-medium">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#eee1dc] text-[#2a1a1d]">
                {fotos.map((foto, index) => <tr key={foto.id} className="hover:bg-[#fdfaf8]">
                  <td className="px-2 md:px-3 py-2">
                    {foto.signed_url ? <button type="button" onClick={() => setExpandedPhotoId(foto.id)} aria-label={`Ampliar foto ${index + 1}`} className="relative block rounded-lg overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f33]">
                      <img src={foto.signed_url} alt={`Foto ${index + 1}`} className="w-14 h-14 object-cover" />
                      <span className="absolute bottom-0 right-0 bg-black/60 p-1 text-white"><ZoomIn className="w-3 h-3" /></span>
                    </button> : <span className="text-xs text-[#9b7f82]">Sin foto</span>}
                  </td>

                  <td className="px-2 md:px-3 py-2">{fruitValues(foto, f => percent(f.red_coverage_pct))}</td>

                  {['cracking', 'russet'].map(type => <td key={type} className="px-2 md:px-3 py-2">{fruitValues(foto, f => <>{percent(defectCoverage(f, type))}{type === 'cracking' && crackingSeverity(f) && <span className={`ml-1 text-xs rounded px-1.5 py-0.5 ${crackingSeverity(f) === 'grave' ? 'text-amber-800 bg-amber-50' : 'text-slate-600 bg-slate-100'}`}>{crackingSeverity(f)}</span>}</>)}</td>)}

                  <td className="px-2 md:px-3 py-2 text-[#9b7f82]">{foto.captured_at ? moment(foto.captured_at).format('HH:mm') : '—'}</td>
                  <td className="px-2 md:px-3 py-2">{fruitValues(foto, f => Number.isFinite(f.diameter_mm) ? `${Math.round(f.diameter_mm)} mm` : f.lidar_estimate?.status === 'experimental' && Number.isFinite(f.lidar_estimate.diameter_mm) ? <span title="LiDAR experimental">≈{Math.round(f.lidar_estimate.diameter_mm)} mm*</span> : '—')}</td>
                  <td className="px-2 md:px-3 py-2">{fruitValues(foto, f => colorLabels[f.color_category] || '—')}</td>
                  <td className="px-2 md:px-3 py-2">{fruitValues(foto, f => percent(defectCoverage(f, 'sunburn')))}</td>
                  <td className="px-2 md:px-3 py-2">
                    <div className="flex flex-col items-start gap-1">
                      {foto.status !== 'listo' && <span className="text-xs text-amber-800">Pendiente</span>}
                      {foto.status === 'listo' && !(foto.fruits || []).length && <span className="text-xs text-[#9b7f82]">Sin granadas</span>}
                      {(user?.role === 'admin' || foto.created_by === user?.id) && <button type="button" disabled={Boolean(analyzing)} onClick={() => retryAnalysis(foto)} className="text-xs text-[#7a1f33] underline py-2 disabled:opacity-50">{analyzing === foto.id ? 'Analizando…' : foto.status === 'listo' ? 'Reanalizar' : 'Reintentar'}</button>}
                    </div>
                  </td>
                </tr>)}
                {!fotos.length && <tr><td colSpan={9} className="p-6 text-center text-[#9b7f82]">Sin fotos registradas.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-[#9b7f82] border-t border-[#eee1dc]">Porcentajes sobre piel visible · — sin dato · * LiDAR experimental. Tocá la foto para ampliarla.</p>
        </div>
        <Dialog open={Boolean(expandedPhoto)} onOpenChange={open => {if (!open) setExpandedPhotoId(null);}}>
          <DialogContent className="w-[calc(100%-1rem)] max-w-3xl max-h-[92dvh] overflow-y-auto rounded-xl p-4">
            <DialogTitle>Foto {fotos.findIndex(f => f.id === expandedPhotoId) + 1}</DialogTitle>
            <DialogDescription className="sr-only">Foto ampliada con contorno y zonas de defectos.</DialogDescription>
            {expandedPhoto && <AnnotatedPhoto src={expandedPhoto.signed_url} fruits={expandedPhoto.fruits || []} showCoverage={false} />}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
