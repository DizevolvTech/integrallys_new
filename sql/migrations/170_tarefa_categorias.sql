-- 170_tarefa_categorias.sql
-- D4/T1: categorias de tarefa pré-definidas (cadastro único da clínica).
-- tarefas.categoria continua texto (guarda o nome); tarefas antigas não mudam.
-- Remover categoria = desativar (ativa=false); nunca apaga tarefa. Idempotente e aditiva.
create table if not exists public.tarefa_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativa boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tarefa_categorias_nome_chk check (length(btrim(nome)) between 1 and 60)
);

create unique index if not exists tarefa_categorias_nome_uidx
  on public.tarefa_categorias (lower(btrim(nome)));

alter table public.tarefa_categorias enable row level security;

-- Categorias iniciais: valores de texto já usados nas tarefas existentes.
insert into public.tarefa_categorias (nome)
select distinct on (lower(btrim(categoria))) btrim(categoria)
from public.tarefas
where categoria is not null and btrim(categoria) <> ''
order by lower(btrim(categoria)), btrim(categoria)
on conflict do nothing;

-- Acesso só pelo servidor (service_role), como as demais tabelas (migração 072).
revoke all on public.tarefa_categorias from anon, authenticated;
