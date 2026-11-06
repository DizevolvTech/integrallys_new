-- 200_rel_desempenho_detalhe.sql
-- Relatorio "Desempenho geral" (cartao #389, v12): cada cartao (Agendamentos, Realizados, Cancelados, Nao compareceram,
-- Pacientes atendidos, Taxa de conclusao) abre a lista dos registros que formam o numero. Mesma base e mesmos filtros de
-- rel_desempenho (periodo, unidade, profissional); p->>'metrica' escolhe o recorte:
--   agendamentos | taxa -> todos os agendamentos com paciente (taxa tambem devolve a conta realizados / agendamentos)
--   realizados -> Concluido/Check-out; cancelados -> Cancelado; faltas -> Faltou
--   pacientes -> um registro por paciente com atendimento realizado (ultimo atendimento + quantidade)
-- Paginado (limit/offset) com total. Idempotente.

create or replace function public.rel_desempenho_detalhe(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ini date := coalesce(nullif(p->>'inicio', '')::date, current_date - 30);
  v_fim date := coalesce(nullif(p->>'fim', '')::date, current_date);
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_prof uuid := nullif(p->>'profissional_id', '')::uuid;
  v_met text := coalesce(nullif(p->>'metrica', ''), 'agendamentos');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  if v_met not in ('agendamentos', 'taxa', 'realizados', 'cancelados', 'faltas', 'pacientes') then
    raise exception 'metrica invalida: %', v_met using errcode = '22023';
  end if;

  with a as (
    select ag.id, ag.data_agendamento as data, ag.horario_inicio as hora, ag.status::text as status, ag.paciente_id,
           pa.nome as paciente, us.nome as profissional, pr.nome as procedimento
      from public.agendamentos ag
      left join public.pacientes pa on pa.id = ag.paciente_id
      left join public.usuarios us on us.id = ag.profissional_id
      left join public.procedimentos pr on pr.id = ag.procedimento_id
     where ag.data_agendamento between v_ini and v_fim
       and ag.paciente_id is not null
       and (v_unid is null or ag.unidade_id = v_unid)
       and (v_prof is null or ag.profissional_id = v_prof)
  ),
  conta as (
    select count(*) as agendamentos,
           count(*) filter (where status in ('Concluído', 'Check-out')) as realizados,
           count(distinct paciente_id) filter (where status in ('Concluído', 'Check-out')) as pacientes
      from a
  ),
  base as (
    select * from a
     where case v_met
             when 'realizados' then status in ('Concluído', 'Check-out')
             when 'cancelados' then status = 'Cancelado'
             when 'faltas' then status = 'Faltou'
             when 'pacientes' then false
             else true
           end
    union all
    select x.id, x.data, x.hora, x.status, x.paciente_id, x.paciente, x.profissional, x.procedimento
      from (select distinct on (paciente_id) * from a
             where v_met = 'pacientes' and status in ('Concluído', 'Check-out')
             order by paciente_id, data desc, hora desc nulls last, id) x
  ),
  pag as (
    select b.*, case when v_met = 'pacientes'
                     then (select count(*) from a a2 where a2.paciente_id = b.paciente_id and a2.status in ('Concluído', 'Check-out'))
                     else null end as atendimentos
      from base b
     order by b.data desc, b.hora desc nulls last, b.id
     limit v_lim offset v_off
  )
  select jsonb_build_object(
           'total', (select count(*) from base),
           'totais', jsonb_build_object(
             'agendamentos', c.agendamentos, 'realizados', c.realizados, 'pacientes', c.pacientes,
             'taxaConclusaoPct', case when c.agendamentos > 0 then round(c.realizados::numeric * 100 / c.agendamentos, 1) else 0 end),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'data', g.data, 'hora', to_char(g.hora, 'HH24:MI'),
                      'paciente', coalesce(g.paciente, '—'), 'profissional', coalesce(g.profissional, '—'),
                      'procedimento', coalesce(g.procedimento, '—'), 'status', g.status, 'atendimentos', g.atendimentos
                    ) order by g.data desc, g.hora desc nulls last, g.id)
               from pag g), '[]'::jsonb)
         )
    into v_res
    from conta c;
  return v_res;
end;
$$;
