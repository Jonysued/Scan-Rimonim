alter table public.profiles alter column role set default 'lector';
create or replace function private.new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,full_name,role)
  values(new.id,new.email,new.raw_user_meta_data->>'full_name','lector');
  return new;
end;
$$;
revoke all on function private.new_user() from public;
