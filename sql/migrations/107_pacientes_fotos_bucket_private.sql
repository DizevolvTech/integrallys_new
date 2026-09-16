-- 107_pacientes_fotos_bucket_private.sql
-- Fecha bucket de fotos se 104 já tiver sido aplicado com public=true.

do $$
begin
  if exists (select 1 from pg_catalog.pg_namespace where nspname = 'storage')
     and exists (
       select 1 from pg_catalog.pg_tables
       where schemaname = 'storage' and tablename = 'buckets'
     ) then
    update storage.buckets
    set public = false
    where id = 'pacientes-fotos';
  end if;
end $$;
