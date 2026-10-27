-- 148: Relatorio de Recebimentos usa a mesma regra de "A receber" do Financeiro: inclui as parcelas
-- lancadas no Financeiro, pendente de hoje em diante = a_receber e pendente ja vencido = atrasado.
-- Mesma assinatura; so create or replace. Idempotente.

create or replace function public.rel_recebimentos(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ini date := nullif(p->>'inicio', '')::date;
  v_fim date := nullif(p->>'fim', '')::date;
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_q text := nullif(trim(p->>'q'), '');
  v_forma text := coalesce(nullif(p->>'forma', ''), 'todas');
  v_sit text := coalesce(nullif(p->>'situacao', ''), 'todos');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with src as (
    -- pagamentos registrados na agenda (pagos e pendentes)
    select ap.id::text as id,
           case when ap.status::text = 'Pago' then (ap.pago_em at time zone 'America/Sao_Paulo')::date
                else a.data_agendamento end as data,
           'Agendamento'::text as origem,
           coalesce(pa.nome, '—') as cliente,
           public.rel_forma_chave(ap.metodo) as forma,
           ap.bandeira, ap.parcelas,
           ap.valor as bruto,
           case when ap.status::text = 'Pago' then 'liquidado' else 'a_receber' end as situacao,
           a.unidade_id
      from public.agendamentos_pagamentos ap
      join public.agendamentos a on a.id = ap.agendamento_id
      left join public.pacientes pa on pa.id = a.paciente_id
     where ap.status::text in ('Pago', 'Pendente')
       and not (ap.status::text = 'Pendente' and a.status::text in ('Cancelado', 'Disponível', 'Bloqueado'))
    union all
    -- saldo a receber de agendamentos que ja tiveram pagamento antecipado
    select 'saldo-' || a.id::text, a.data_agendamento, 'Saldo do agendamento', coalesce(pa.nome, '—'),
           'nao_informado', null, null,
           (coalesce(a.valor_procedimento, 0) - r.total_pago), 'a_receber', a.unidade_id
      from public.agendamentos a
      join public.v_agendamento_pagamento_resumo r on r.agendamento_id = a.id
      left join public.pacientes pa on pa.id = a.paciente_id
     where r.total_pago > 0 and coalesce(a.valor_procedimento, 0) > r.total_pago
       and a.status::text not in ('Cancelado', 'Disponível', 'Bloqueado')
    union all
    -- vendas de prescricao pagas no caixa
    select cm.id::text, (cm.data_movimento at time zone 'America/Sao_Paulo')::date, 'Venda',
           coalesce(nullif(cm.descricao, ''), 'Venda'), public.rel_forma_chave(cm.forma),
           cm.bandeira, cm.parcelas, cm.valor, 'liquidado', cm.unidade_id
      from public.caixa_movimentos cm
     where cm.origem = 'prescricao' and cm.tipo::text = 'entrada'
    union all
    -- recebimentos lancados direto no Caixa (manual / pagamento online). Os da agenda ja entram pelo
    -- pagamento do agendamento e os de venda pela origem 'prescricao': por isso ficam de fora (sem duplicar).
    -- Suprimento e reforco de troco, nao recebimento.
    select cm.id::text, (cm.data_movimento at time zone 'America/Sao_Paulo')::date, 'Caixa',
           coalesce(nullif(cm.descricao, ''), 'Recebimento no caixa'), public.rel_forma_chave(cm.forma),
           cm.bandeira, cm.parcelas, cm.valor, 'liquidado', cm.unidade_id
      from public.caixa_movimentos cm
     where cm.origem in ('manual', 'pagamento_online') and cm.tipo::text = 'entrada'
       and cm.descricao not ilike 'suprimento%'
    union all
    -- parcelas e recebimentos a receber lancados no Financeiro (mesma fonte do card "A receber" do Financeiro);
    -- os ligados a agendamento ja entram pelo pagamento do agendamento.
    select fl.id::text, fl.data_referencia, 'Lançamento'::text,
           coalesce(nullif(fl.beneficiario, ''), fl.descricao), public.rel_forma_chave(fl.metodo),
           null, fl.parcelas, fl.valor, 'a_receber', fl.unidade_id
      from public.financeiro_lancamentos fl
     where fl.tipo::text = 'receita' and not fl.liquidado and not fl.cancelado and fl.agendamento_id is null
  ),
  cls as (
    -- mesma regra do Financeiro: pendente com data de hoje em diante = a receber; ja vencido = atrasado
    select id, data, origem, cliente, forma, bandeira, parcelas, bruto, unidade_id,
           case when situacao = 'a_receber' and data < (now() at time zone 'America/Sao_Paulo')::date
                then 'atrasado' else situacao end as situacao
      from src
  ),
  filt as (
    select * from cls
     where (v_ini is null or data >= v_ini)
       and (v_fim is null or data <= v_fim)
       and (v_unid is null or unidade_id = v_unid)
       and (v_q is null or cliente ilike '%' || v_q || '%')
       and (v_forma = 'todas' or forma = v_forma)
       and (v_sit = 'todos' or situacao = v_sit)
  ),
  pag as (select * from filt order by data desc, id limit v_lim offset v_off)
  select jsonb_build_object(
           'total', (select count(*) from filt),
           'grupos', coalesce((
             select jsonb_agg(jsonb_build_object('situacao', situacao, 'forma', forma, 'parcelas', parcelas, 'bruto', b, 'qtd', c))
               from (select situacao, forma, coalesce(parcelas, 1) as parcelas, sum(bruto) as b, count(*) as c
                       from filt group by 1, 2, 3) x), '[]'::jsonb),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'data', g.data, 'origem', g.origem, 'cliente', g.cliente, 'forma', g.forma,
                      'bandeira', g.bandeira, 'parcelas', coalesce(g.parcelas, 1), 'bruto', g.bruto, 'situacao', g.situacao
                    ) order by g.data desc, g.id)
               from pag g), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;
