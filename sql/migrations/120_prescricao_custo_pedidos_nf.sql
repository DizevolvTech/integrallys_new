-- 120_prescricao_custo_pedidos_nf.sql
-- D3 itens 15 e 6/28: (a) custo unitario gravado no item da prescricao/venda (margem do gestor nao
-- muda quando o custo do produto muda depois); (b) pedidos de nota fiscal feitos a partir do recibo
-- (venda ou consulta). Aditiva e idempotente.

alter table public.prescricao_itens
  add column if not exists custo_unitario numeric(12,2) null check (custo_unitario is null or custo_unitario >= 0);

create table if not exists public.pedidos_nf (
  id uuid primary key default gen_random_uuid(),
  origem text not null check (origem in ('prescricao', 'agendamento')),
  origem_id uuid not null,
  paciente_id uuid null references public.pacientes(id) on delete set null,
  valor numeric(12,2) null,
  observacao text null,
  status text not null default 'pendente' check (status in ('pendente', 'emitida', 'cancelada')),
  solicitado_por uuid null references public.usuarios(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.pedidos_nf enable row level security;

-- Um unico pedido pendente por venda/consulta (clique repetido nao duplica).
create unique index if not exists pedidos_nf_origem_pendente_uidx
  on public.pedidos_nf (origem, origem_id) where status = 'pendente';
create index if not exists pedidos_nf_paciente_idx on public.pedidos_nf (paciente_id);
create index if not exists pedidos_nf_status_created_idx on public.pedidos_nf (status, created_at desc);
