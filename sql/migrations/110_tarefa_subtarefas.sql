-- 110_tarefa_subtarefas.sql
-- Feedback item 1 (lista de tarefas estilo Planko): subtarefas com progresso por tarefa.
-- Idempotente.
create table if not exists public.tarefa_subtarefas (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas(id) on delete cascade,
  titulo text not null,
  concluida boolean not null default false,
  posicao integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists tarefa_subtarefas_tarefa_idx on public.tarefa_subtarefas (tarefa_id, posicao);

alter table public.tarefa_subtarefas enable row level security;
