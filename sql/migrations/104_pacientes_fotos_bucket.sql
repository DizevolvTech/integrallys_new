-- 104_pacientes_fotos_bucket.sql
-- Call 09/09 · Foto do paciente precisa persistir (não blob: local).
-- Bucket PRIVADO — upload/leitura via API com service role (JWT).
-- Se o bucket já existir como public, rode também 107_pacientes_fotos_bucket_private.sql.

do $$
begin
  if exists (select 1 from pg_catalog.pg_namespace where nspname = 'storage')
     and exists (
       select 1 from pg_catalog.pg_tables
       where schemaname = 'storage' and tablename = 'buckets'
     ) then
    insert into storage.buckets (id, name, public)
    values ('pacientes-fotos', 'pacientes-fotos', false)
    on conflict (id) do update set public = excluded.public;
  end if;
end $$;
