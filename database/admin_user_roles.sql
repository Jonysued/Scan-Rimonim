-- Only this narrow operation may update profiles; direct updates stay forbidden.
create or replace function private.set_user_role(target_user_id uuid, new_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles%rowtype;
begin
  -- Serialize role changes so concurrent demotions cannot remove the last admin.
  perform pg_catalog.pg_advisory_xact_lock(6820333119::bigint);
  if auth.uid() is null or not private.has_role(array['admin']) then
    raise exception 'Solo los administradores pueden cambiar perfiles.' using errcode = '42501';
  end if;
  if new_role is null or new_role not in ('admin', 'muestreador', 'lector') then
    raise exception 'Perfil inválido.' using errcode = '22023';
  end if;
  select * into target from public.profiles where id = target_user_id for update;
  if not found then
    raise exception 'Usuario no encontrado.' using errcode = 'P0002';
  end if;
  if target.role = 'admin' and new_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Debe quedar al menos un administrador.' using errcode = '23514';
  end if;
  update public.profiles set role = new_role where id = target_user_id returning * into target;
  return pg_catalog.to_jsonb(target);
end;
$$;
revoke all on function private.set_user_role(uuid, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.set_user_role(uuid, text) to authenticated;

create or replace function public.set_user_role(target_user_id uuid, new_role text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.set_user_role(target_user_id, new_role); $$;
revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
