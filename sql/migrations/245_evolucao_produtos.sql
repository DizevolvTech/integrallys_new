-- 245 (#1645): produtos adicionados a uma evolucao (Evolucoes > ... > Adicionar produto), escolhidos do Estoque.
-- Aditiva e idempotente.

create table if not exists public.evolucao_produtos (
  id uuid primary key default gen_random_uuid(),
  evolucao_id uuid not null references public.evolucoes(id) on delete cascade,
  produto_id uuid references public.produtos_estoque(id) on delete set null,
  nome text not null,
  tipo text,
  modo_uso text,
  frequencia text,
  horario_ideal text,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists evolucao_produtos_evolucao_idx on public.evolucao_produtos (evolucao_id, created_at desc);
alter table public.evolucao_produtos enable row level security;
