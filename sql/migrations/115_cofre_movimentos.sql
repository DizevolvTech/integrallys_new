-- 115_cofre_movimentos.sql
-- Video da cliente (26/10): o gestor precisa ver no caixa a transferencia do
-- dinheiro do caixa para o cofre. Antes o valor ficava so na sessao do caixa
-- (caixa_sessoes.valor_transferido) e se perdia ao reabrir o caixa no mesmo dia.
-- Agora cada fechamento com transferencia gera um registro proprio do cofre. Idempotente.

create table if not exists public.cofre_movimentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid null references public.unidades(id) on delete set null,
  sessao_id uuid null references public.caixa_sessoes(id) on delete set null,
  tipo text not null default 'entrada' check (tipo in ('entrada', 'saida')),
  valor numeric(12,2) not null check (valor > 0),
  descricao text not null,
  usuario_id uuid null references public.usuarios(id) on delete set null,
  operador_nome text null,
  data_movimento timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.cofre_movimentos enable row level security;

create index if not exists cofre_movimentos_unidade_data_idx
  on public.cofre_movimentos (unidade_id, data_movimento desc);

-- Backfill: fechamentos ja feitos com transferencia ao cofre.
insert into public.cofre_movimentos (unidade_id, sessao_id, tipo, valor, descricao, usuario_id, operador_nome, data_movimento)
select s.unidade_id,
       s.id,
       'entrada',
       s.valor_transferido,
       'Transferência do caixa (fechamento)',
       s.closed_by_id,
       u.nome,
       coalesce(s.fechado_em, s.updated_at, s.created_at)
from public.caixa_sessoes s
left join public.usuarios u on u.id = s.closed_by_id
where s.status = 'fechado'
  and coalesce(s.valor_transferido, 0) > 0
  and not exists (select 1 from public.cofre_movimentos c where c.sessao_id = s.id);
