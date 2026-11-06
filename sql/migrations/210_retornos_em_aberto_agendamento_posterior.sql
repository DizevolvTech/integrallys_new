-- 210_retornos_em_aberto_agendamento_posterior.sql
-- #389 r2: "Mais tarde" apos a venda nao criava o selo "Retorno pendente" quando o paciente ja tinha um
-- retorno agendado ANTES de o retorno pendente ser registrado. Agora so esconde o retorno pendente o
-- agendamento de retorno criado depois (ou junto) do registro do pendente. Mesmas colunas, mesma ordem (205).
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
      and a.created_at >= r.created_at
  );
