-- 140_rel_consultas_recorrencia.sql
-- D3/X2 (item 8): relatorio de Consultas ganha recorrencia/presenca por paciente e totais:
--   presenca no periodo = realizadas / agendadas (agendadas = marcadas ate hoje, sem adiadas; inclui faltas e cancelamentos);
--   retornos = consultas realizadas alem da primeira realizada do paciente.
-- Mesma assinatura e mesmas colunas de antes; so acrescenta campos. Idempotente.

create or replace function public.rel_consultas(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ini date := nullif(p->>'inicio', '')::date;
  v_fim date := nullif(p->>'fim', '')::date;
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_prof uuid := nullif(p->>'profissional_id', '')::uuid;
  v_proc uuid := nullif(p->>'procedimento_id', '')::uuid;
  v_q text := nullif(trim(p->>'q'), '');
  v_conv text := nullif(p->>'convenio', '');
  v_sit text := coalesce(nullif(p->>'situacao', ''), 'todos');
  v_pag text := coalesce(nullif(p->>'pagamento', ''), 'todos');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_res jsonb;
begin
  with todos as (
    select a.id,
           a.data_agendamento as data,
           a.horario_inicio as hora,
           a.status::text as status,
           a.paciente_id,
           pa.nome as paciente,
           coalesce(nullif(pa.convenio, ''), 'Particular') as convenio,
           pr.nome as procedimento,
           us.nome as profissional,
           un.nome as unidade,
           coalesce(a.valor_procedimento, 0) as valor,
           coalesce(r.total_pago, 0) as pago,
           case when a.status::text in ('Cancelado', 'Disponível', 'Bloqueado') then 0
                else greatest(coalesce(a.valor_procedimento, 0) - coalesce(r.total_pago, 0), 0) end as aberto,
           case when a.status::text = 'Cancelado'
                then coalesce(nullif(trim(regexp_replace(coalesce(a.observacoes, ''), '^Cancelado(:|\s+—.*)?\s*', '')), ''), 'Não informado')
                when a.status::text = 'Faltou'
                then coalesce(nullif(trim(a.observacoes), ''), 'Não informado')
                else null end as justificativa
      from public.agendamentos a
      left join public.pacientes pa on pa.id = a.paciente_id
      left join public.procedimentos pr on pr.id = a.procedimento_id
      left join public.usuarios us on us.id = a.profissional_id
      left join public.unidades un on un.id = a.unidade_id
      left join public.v_agendamento_pagamento_resumo r on r.agendamento_id = a.id
     where (v_ini is null or a.data_agendamento >= v_ini)
       and (v_fim is null or a.data_agendamento <= v_fim)
       and (v_unid is null or a.unidade_id = v_unid)
       and (v_prof is null or a.profissional_id = v_prof)
       and (v_proc is null or a.procedimento_id = v_proc)
       and (v_q is null or pa.nome ilike '%' || v_q || '%')
       and (v_conv is null or coalesce(nullif(pa.convenio, ''), 'Particular') = v_conv)
       and (a.paciente_id is not null or a.status::text = 'Disponível')
  ),
  base as (
    select * from todos
     where (case v_sit
              when 'agendados' then status in ('Agendado', 'Confirmado', 'Check-in', 'Em Atendimento', 'Em Atraso', 'Adiado')
              when 'cancelados' then status = 'Cancelado'
              when 'faltas' then status = 'Faltou'
              when 'justificativas' then status in ('Cancelado', 'Faltou')
              when 'realizados' then status in ('Concluído', 'Check-out')
              when 'disponiveis' then status = 'Disponível'
              else status not in ('Bloqueado', 'Disponível')
            end)
  ),
  filt as (
    select * from base
     where (case v_pag
              when 'pago' then valor > 0 and aberto = 0 and pago > 0
              when 'aberto' then aberto > 0
              else true
            end)
  ),
  -- Recorrência/presença: por paciente, sobre as mesmas consultas do filtro (exceto a situação).
  --   agendadas  = marcadas que já deveriam ter acontecido (data até hoje, sem adiadas) ou já realizadas
  --   realizadas = Concluído/Check-out
  --   retornos   = realizadas que não são a primeira consulta realizada do paciente (histórico todo)
  ordem as (
    select a2.id,
           row_number() over (partition by a2.paciente_id order by a2.data_agendamento, a2.horario_inicio, a2.id) as rn
      from public.agendamentos a2
     where a2.status::text in ('Concluído', 'Check-out')
       and a2.paciente_id in (select distinct paciente_id from todos where paciente_id is not null)
  ),
  met as (
    select t.paciente_id,
           count(*) filter (where t.status in ('Concluído', 'Check-out')) as realizadas,
           count(*) filter (where t.status not in ('Disponível', 'Bloqueado', 'Adiado')
                              and (t.data <= v_hoje or t.status in ('Concluído', 'Check-out'))) as agendadas,
           count(*) filter (where t.status in ('Concluído', 'Check-out') and o.rn > 1) as retornos
      from todos t
      left join ordem o on o.id = t.id
     where t.paciente_id is not null
     group by t.paciente_id
  ),
  met_tot as (
    select coalesce(sum(m.realizadas), 0) as realizadas,
           coalesce(sum(m.agendadas), 0) as agendadas,
           coalesce(sum(m.retornos), 0) as retornos,
           count(*) as pacientes
      from met m
     where m.paciente_id in (select paciente_id from filt where paciente_id is not null)
  ),
  tot as (
    select count(*) as total,
           coalesce(sum(pago), 0) as recebido,
           coalesce(sum(aberto), 0) as aberto
      from filt
  ),
  pag as (
    select * from filt
     order by data desc, hora desc nulls last, id
     limit v_lim offset v_off
  ),
  hist as (
    select a2.paciente_id,
           count(*) filter (where a2.status::text in ('Concluído', 'Check-out')) as visitas,
           count(*) filter (where a2.status::text in ('Concluído', 'Check-out', 'Faltou', 'Cancelado')) as marcadas,
           string_agg(distinct u2.nome, ', ') filter (where a2.status::text in ('Concluído', 'Check-out')) as especialistas
      from public.agendamentos a2
      left join public.usuarios u2 on u2.id = a2.profissional_id
     where a2.paciente_id in (select paciente_id from pag where paciente_id is not null)
     group by a2.paciente_id
  ),
  pagto as (
    select ap.agendamento_id, string_agg(distinct ap.metodo, ', ') as formas
      from public.agendamentos_pagamentos ap
     where ap.agendamento_id in (select id from pag) and ap.status::text = 'Pago'
     group by ap.agendamento_id
  )
  select jsonb_build_object(
           'total', t.total,
           'totais', jsonb_build_object(
             'recebido', t.recebido, 'aberto', t.aberto,
             'realizadas', mt.realizadas, 'agendadas', mt.agendadas, 'retornos', mt.retornos, 'pacientes', mt.pacientes,
             'presencaPct', case when mt.agendadas > 0 then round(mt.realizadas::numeric * 100 / mt.agendadas, 1) else null end),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id,
                      'data', g.data,
                      'hora', to_char(g.hora, 'HH24:MI'),
                      'paciente', coalesce(g.paciente, '—'),
                      'procedimento', coalesce(g.procedimento, '—'),
                      'profissional', coalesce(g.profissional, '—'),
                      'unidade', coalesce(g.unidade, '—'),
                      'convenio', g.convenio,
                      'status', g.status,
                      'valor', g.valor,
                      'pago', g.pago,
                      'aberto', g.aberto,
                      'statusPagamento', case
                          when g.status in ('Cancelado', 'Disponível', 'Bloqueado') then '—'
                          when g.valor <= 0 then 'Sem valor'
                          when g.aberto = 0 then 'Pago'
                          when g.pago > 0 then 'Parcial'
                          else 'Em aberto' end,
                      'formaPagamento', coalesce(pt.formas, '—'),
                      'justificativa', g.justificativa,
                      'visitas', coalesce(h.visitas, 0),
                      'presencaPct', case when coalesce(h.marcadas, 0) > 0
                                          then round(h.visitas::numeric * 100 / h.marcadas, 0) else null end,
                      'especialistas', coalesce(h.especialistas, '—'),
                      'agendadasPeriodo', coalesce(m.agendadas, 0),
                      'realizadasPeriodo', coalesce(m.realizadas, 0),
                      'retornos', coalesce(m.retornos, 0),
                      'presencaPeriodoPct', case when coalesce(m.agendadas, 0) > 0
                                                 then round(m.realizadas::numeric * 100 / m.agendadas, 0) else null end
                    ) order by g.data desc, g.hora desc nulls last, g.id)
               from pag g
               left join hist h on h.paciente_id = g.paciente_id
               left join met m on m.paciente_id = g.paciente_id
               left join pagto pt on pt.agendamento_id = g.id
           ), '[]'::jsonb)
         )
    into v_res
    from tot t, met_tot mt;

  return v_res;
end;
$$;
