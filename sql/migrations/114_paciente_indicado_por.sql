-- 114_paciente_indicado_por.sql
-- Video da cliente (26/10): no campo "Quem indicou?" a recepcao digita o nome e
-- escolhe um paciente/cliente ja cadastrado, ficando o vinculo entre os dois.
-- O nome continua em origem_detalhe (texto exibido); o vinculo fica aqui. Idempotente.
alter table public.pacientes
  add column if not exists indicado_por_id uuid null references public.pacientes(id) on delete set null;

create index if not exists pacientes_indicado_por_idx
  on public.pacientes (indicado_por_id)
  where indicado_por_id is not null;

-- Busca por nome no "Quem indicou?" (ilike '%termo%').
create extension if not exists pg_trgm;
create index if not exists pacientes_nome_trgm_idx
  on public.pacientes using gin (nome gin_trgm_ops);
