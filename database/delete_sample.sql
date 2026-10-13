-- Atomic deletion under the caller's RLS permissions; no SECURITY DEFINER.
create or replace function public.delete_sample(sample_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  paths jsonb;
begin
  if not private.has_role(array['admin']) then
    raise exception 'Sólo el administrador puede eliminar muestras.' using errcode = '42501';
  end if;
  perform 1 from public.sesiones where id = sample_id for update;
  if not found then
    raise exception 'La muestra no existe o ya fue eliminada.' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(storage_uri) filter (where storage_uri is not null), '[]'::jsonb)
    into paths from public.fotos where session_id = sample_id;
  delete from public.fotos where session_id = sample_id;
  delete from public.sesiones where id = sample_id;
  if not found then
    raise exception 'No se pudo eliminar la muestra.';
  end if;
  return jsonb_build_object('deleted_id', sample_id, 'storage_uris', paths);
end;
$$;
revoke all on function public.delete_sample(uuid) from public, anon;
grant execute on function public.delete_sample(uuid) to authenticated;
create policy delete_sample_photos_admin on storage.objects for delete to authenticated
using (bucket_id = 'photos' and private.has_role(array['admin']));
