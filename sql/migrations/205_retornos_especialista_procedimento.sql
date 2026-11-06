-- 205_retornos_especialista_procedimento.sql
-- #389 X1: o retorno diz "de que e com quem": especialista e procedimento DO RETORNO
-- (pre-preenchidos com os do atendimento de origem, editaveis). Nulos = usa os da origem.
-- A view ganha, no FIM (create or replace exige ordem), as colunas efetivas
-- retorno_profissional_id / retorno_procedimento_id. Aditiva e idempotente.
alter table public.retornos_pendentes
  add column if not exists especialista_retorno_id uuid null references public.usuarios(id) on delete set null,
  add column if not exists procedimento_retorno_id uuid null references public.procedimentos(id) on delete set null;

create index if not exists retornos_pendentes_esp_retorno_idx
  on public.retornos_pendentes (especialista_retorno_id, status);

create or replace view public.retornos_em_aberto as
select r.id, r.paciente_id, r.profissional_id, r.unidade_id, r.agendamento_id,
       r.procedimento_id, r.prescricao_id, r.origem, r.prazo_tipo, r.prazo_dias,
       r.data_base, r.data_prevista, r.created_at,
       case
         when r.data_prevista is null then 'sem_prazo'
         when r.data_prevista < c.hoje then 'vencido'
         when r.data_prevista - c.hoje <= 10 then 'limite'
         else 'no_prazo'
       end as situacao,
       coalesce(r.especialista_retorno_id, r.profissional_id) as retorno_profissional_id,
       coalesce(r.procedimento_retorno_id, r.procedimento_id) as retorno_procedimento_id
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
