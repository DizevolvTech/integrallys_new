-- 117_retornos.sql
-- Itens 11 e 6 (Central de Feedbacks): prazo de retorno definido pelo especialista ao
-- finalizar o atendimento e retorno "Mais tarde" da venda da prescrição. Alimenta a
-- lista /retornos, o alerta da recepção e a tag "Retorno pendente".
-- Aditiva e idempotente.
create table if not exists public.retornos_pendentes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  profissional_id uuid null references public.usuarios(id) on delete set null,
  unidade_id uuid null references public.unidades(id) on delete set null,
  agendamento_id uuid null references public.agendamentos(id) on delete set null,
  procedimento_id uuid null references public.procedimentos(id) on delete set null,
  prescricao_id uuid null,
  origem text not null check (origem in ('atendimento', 'prescricao')),
  -- 30 | 60 | 90 | 120 | 6m | liberado | custom (dias digitados pelo especialista)
  prazo_tipo text not null check (prazo_tipo in ('30', '60', '90', '120', '6m', 'liberado', 'custom', 'sem_prazo')),
  prazo_dias int null check (prazo_dias is null or prazo_dias > 0),
  data_base date not null,
  data_prevista date null,
  status text not null default 'pendente' check (status in ('pendente', 'liberado', 'substituido')),
  criado_por_id uuid null references public.usuarios(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.retornos_pendentes enable row level security;

create index if not exists retornos_pendentes_status_prevista_idx
  on public.retornos_pendentes (status, data_prevista);
create index if not exists retornos_pendentes_paciente_idx
  on public.retornos_pendentes (paciente_id, status);
create index if not exists retornos_pendentes_profissional_idx
  on public.retornos_pendentes (profissional_id, status);
create index if not exists retornos_pendentes_unidade_idx
  on public.retornos_pendentes (unidade_id, status);

-- Retornos em aberto: pendentes e ainda SEM consulta de retorno marcada depois do atendimento.
-- situacao: vencido (data prevista passou), limite (faltam até 10 dias) ou no_prazo.
-- Sem data prevista (venda "Mais tarde" sem prazo definido) fica no_prazo.
create or replace view public.retornos_em_aberto as
select r.id, r.paciente_id, r.profissional_id, r.unidade_id, r.agendamento_id,
       r.procedimento_id, r.prescricao_id, r.origem, r.prazo_tipo, r.prazo_dias,
       r.data_base, r.data_prevista, r.created_at,
       case
         when r.data_prevista is null then 'no_prazo'
         when r.data_prevista < c.hoje then 'vencido'
         when r.data_prevista - c.hoje <= 10 then 'limite'
         else 'no_prazo'
       end as situacao
from public.retornos_pendentes r
cross join lateral (select (timezone('America/Sao_Paulo', now()))::date as hoje) c
where r.status = 'pendente'
  and not exists (
    select 1
    from public.agendamentos a
    where a.paciente_id = r.paciente_id
      and lower(btrim(coalesce(a.tipo, ''))) = 'retorno'
      and a.status::text <> 'Cancelado'
      and a.data_agendamento >= r.data_base
  );
