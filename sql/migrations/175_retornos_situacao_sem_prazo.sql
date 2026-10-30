-- 175_retornos_situacao_sem_prazo.sql
-- D4 R1: retorno sem data prevista deixa de contar como "no_prazo" e passa a ter
-- situacao 'sem_prazo' (neutra). Mesmas colunas e mesma ordem; só muda o CASE.
-- Idempotente (create or replace view).
create or replace view public.retornos_em_aberto as
select r.id, r.paciente_id, r.profissional_id, r.unidade_id, r.agendamento_id,
       r.procedimento_id, r.prescricao_id, r.origem, r.prazo_tipo, r.prazo_dias,
       r.data_base, r.data_prevista, r.created_at,
       case
         when r.data_prevista is null then 'sem_prazo'
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
