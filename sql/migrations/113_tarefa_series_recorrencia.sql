-- 113_tarefa_series_recorrencia.sql
-- Video da cliente (26/10): tarefa recorrente ("Somente dias uteis") criada hoje
-- nao aparecia nos proximos dias. Antes a proxima ocorrencia so nascia ao concluir.
-- Agora cada tarefa recorrente pertence a uma serie; a API gera as ocorrencias
-- ate alguns dias a frente e guarda ate onde ja gerou (gerada_ate), para nunca
-- recriar uma ocorrencia excluida. Idempotente.

create table if not exists public.tarefa_series (
  id uuid primary key default gen_random_uuid(),
  gerada_ate timestamptz not null,
  ativa boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.tarefa_series enable row level security;

alter table public.tarefas
  add column if not exists serie_id uuid null references public.tarefa_series(id) on delete set null;

-- Uma ocorrencia por serie e horario: protege contra geracao concorrente.
-- Sem predicado (serie_id nulo nunca conflita) para servir ao ON CONFLICT da API.
create unique index if not exists tarefas_serie_vencimento_uidx
  on public.tarefas (serie_id, vencimento_em);

create index if not exists tarefa_series_ativa_idx
  on public.tarefa_series (gerada_ate)
  where ativa;

-- Backfill: cada tarefa recorrente ainda aberta (com vencimento) vira o inicio de uma serie.
do $$
declare
  r record;
  nova uuid;
begin
  for r in
    select id, vencimento_em
    from public.tarefas
    where serie_id is null
      and recorrencia <> 'nenhuma'
      and vencimento_em is not null
      and status in ('Pendente', 'Em andamento')
  loop
    insert into public.tarefa_series (gerada_ate) values (r.vencimento_em) returning id into nova;
    update public.tarefas set serie_id = nova where id = r.id;
  end loop;
end $$;
