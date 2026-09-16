-- 106_onda4_estoque_call_0909.sql
-- Onda 4 · Call 09/09 — estoque:
--   1) Categorias CRUD (por unidade)
--   2) tipo_movimentacao = 'ajuste'
--   3) SKU único por unidade (quando preenchido)

create table if not exists public.estoque_categorias (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid references public.unidades (id) on delete set null,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists estoque_categorias_unidade_nome_uidx
  on public.estoque_categorias (coalesce(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));

create index if not exists estoque_categorias_unidade_idx
  on public.estoque_categorias (unidade_id);

-- Relaxa check de tipo_movimentacao para incluir 'ajuste'
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'movimentacoes_estoque'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%tipo_movimentacao%';

  if constraint_name is not null then
    execute format('alter table public.movimentacoes_estoque drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.movimentacoes_estoque
  add constraint movimentacoes_estoque_tipo_movimentacao_check
  check (tipo_movimentacao in ('saida', 'consumo_interno', 'entrada', 'ajuste'));

create unique index if not exists produtos_estoque_unidade_sku_uidx
  on public.produtos_estoque (coalesce(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(sku))
  where sku is not null and length(trim(sku)) > 0;

comment on table public.estoque_categorias is
  'Categorias de produtos de estoque (Onda 4 · Call 09/09).';
