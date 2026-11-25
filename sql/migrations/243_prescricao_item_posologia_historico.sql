-- #1645: histórico de ajuste de posologia (antes/depois, quem e quando)
create table if not exists public.prescricao_item_posologia_historico (
  id uuid primary key default gen_random_uuid(),
  prescricao_item_id uuid not null references public.prescricao_itens(id) on delete cascade,
  prescricao_id uuid not null references public.prescricoes(id) on delete cascade,
  paciente_id uuid references public.pacientes(id) on delete cascade,
  posologia_anterior text,
  posologia_nova text,
  usuario_id uuid,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists prescricao_item_posologia_hist_item_idx
  on public.prescricao_item_posologia_historico (prescricao_item_id, created_at desc);
alter table public.prescricao_item_posologia_historico enable row level security;
