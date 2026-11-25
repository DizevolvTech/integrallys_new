-- 246_rel_repasse_situacao.sql
-- #1645 (item 14): Relatorios > Meus repasses / Repasse.
-- Causa do "—" e R$ 0,00: o percentual vem de regras_repasse (Profissionais > editar > Repasse); profissional sem regra ativa
-- ficava com percentual nulo e o repasse virava 0 (coalesce). Agora:
--   - sem regra: percentual e repasse voltam NULOS (a tela diz "Percentual não cadastrado"), nunca 0 inventado;
--   - nova coluna situacaoRepasse (so atendidos): Pago = repasse Pago do modulo Repasse cobrindo a data do atendimento
--     (mesmo profissional; unidade igual ou geral); Pendente = paciente ainda nao pagou o atendimento todo; Em aberto =
--     paciente pagou e o repasse nao foi pago. "Em atraso" nao existe: o modulo Repasse nao tem data prevista de pagamento;
--   - linha traz tambem pago (recebido do paciente) e semRegra; totais ganham jaRecebido, faltaReceber e semPercentual;
--   - filtro 'repasse' (recebido | falta) para a lista do cartao clicado.
-- Mesma assinatura. Idempotente.

create or replace function public.rel_repasse_atendimentos(p jsonb)
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
  v_sit text := coalesce(nullif(p->>'situacao', ''), 'todos');
  v_rep text := coalesce(nullif(p->>'repasse', ''), 'todos');
  v_q text := nullif(trim(p->>'q'), '');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with calc as (
    select a.id, a.data_agendamento as data, pa.nome as paciente, pc.nome as procedimento,
           u.nome as profissional, un.nome as unidade,
           (a.status::text in ('Concluído', 'Check-out')) as atendido,
           coalesce(a.valor_procedimento, 0) as valor,
           coalesce(rs.total_pago, 0) as pago,
           rg.percentual as pct,
           exists (
             select 1 from public.repasses rp
              where rp.profissional_id = a.profissional_id and rp.status::text = 'Pago'
                and a.data_agendamento between rp.periodo_inicio and rp.periodo_fim
                and (rp.unidade_id is null or rp.unidade_id = a.unidade_id)) as repasse_pago
      from public.agendamentos a
      join public.pacientes pa on pa.id = a.paciente_id
      join public.usuarios u on u.id = a.profissional_id
      left join public.procedimentos pc on pc.id = a.procedimento_id
      left join public.unidades un on un.id = a.unidade_id
      left join public.v_agendamento_pagamento_resumo rs on rs.agendamento_id = a.id
      left join lateral (
        select r.percentual from public.regras_repasse r
         where r.profissional_id = a.profissional_id and r.ativo and r.percentual is not null
           and (r.unidade_id is null or r.unidade_id = a.unidade_id)
         order by (r.unidade_id is null), r.created_at desc limit 1) rg on true
     where a.status::text in ('Concluído', 'Check-out', 'Cancelado')
       and (v_ini is null or a.data_agendamento >= v_ini)
       and (v_fim is null or a.data_agendamento <= v_fim)
       and (v_unid is null or a.unidade_id = v_unid)
       and (v_prof is null or a.profissional_id = v_prof)
       and (v_proc is null or a.procedimento_id = v_proc)
       and (v_q is null or pa.nome ilike '%' || v_q || '%')
       and (case v_sit when 'atendido' then a.status::text in ('Concluído', 'Check-out')
                       when 'cancelado' then a.status::text = 'Cancelado' else true end)
  ),
  base as (
    select c.*,
           case when c.pct is null then null else round(c.valor * c.pct / 100, 2) end as repasse,
           case when not c.atendido then null
                when c.repasse_pago then 'Pago'
                when c.valor > 0 and c.pago < c.valor then 'Pendente'
                else 'Em aberto' end as sit_repasse
      from calc c
  ),
  filt as (
    select * from base
     where case v_rep
             when 'recebido' then sit_repasse = 'Pago'
             when 'falta' then sit_repasse in ('Em aberto', 'Pendente')
             else true end
  ),
  pag as (select * from filt order by data desc, id limit v_lim offset v_off)
  select jsonb_build_object(
           'total', (select count(*) from filt),
           'totais', jsonb_build_object(
             'atendimentos', (select count(*) from filt where atendido),
             'valor', (select coalesce(sum(valor), 0) from filt where atendido),
             'repasse', (select coalesce(sum(repasse), 0) from filt where atendido),
             'jaRecebido', (select coalesce(sum(repasse), 0) from filt where sit_repasse = 'Pago'),
             'faltaReceber', (select coalesce(sum(repasse), 0) from filt where sit_repasse in ('Em aberto', 'Pendente')),
             'qtdRecebido', (select count(*) from filt where sit_repasse = 'Pago'),
             'qtdFalta', (select count(*) from filt where sit_repasse in ('Em aberto', 'Pendente')),
             'semPercentual', (select count(*) from filt where atendido and pct is null)),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'data', g.data, 'paciente', g.paciente,
                      'procedimento', coalesce(g.procedimento, '—'), 'profissional', g.profissional,
                      'unidade', coalesce(g.unidade, '—'),
                      'situacao', case when g.atendido then 'Atendido' else 'Cancelado' end,
                      'valor', g.valor, 'pago', g.pago, 'percentual', g.pct,
                      'semRegra', g.atendido and g.pct is null,
                      'repasse', case when g.atendido then g.repasse else null end,
                      'situacaoRepasse', g.sit_repasse
                    ) order by g.data desc, g.id)
               from pag g), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;
