-- 141_rel_recebimentos_caixa_fuso_estoque.sql
-- D3/X2 (itens 3 e 6): (a) Relatorio de Recebimentos passa a incluir os recebimentos lancados no Caixa
-- (origem manual / pagamento online), sem duplicar agenda e vendas; (b) a Movimentacao diaria de estoque
-- filtra o periodo pelo dia de Brasilia (antes usava meia-noite UTC = 21h do dia anterior em Brasilia).
-- Mesmas assinaturas; so create or replace. Idempotente.

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
  ),
  filt as (
    select * from src
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

create or replace function public.rel_estoque_movimentacao(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ini date := nullif(p->>'inicio', '')::date;
  v_fim date := nullif(p->>'fim', '')::date;
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_usu uuid := nullif(p->>'usuario_id', '')::uuid;
  v_tipo text := coalesce(nullif(p->>'tipo', ''), 'todos');
  v_nf text := nullif(trim(p->>'nf'), '');
  v_q text := nullif(trim(p->>'q'), '');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with filt as (
    select m.id, (m.created_at at time zone 'America/Sao_Paulo')::date as dia, m.created_at,
           coalesce(m.tipo_movimentacao, m.tipo::text) as tipo,
           (case when m.tipo::text = 'entrada' then 'entrada' else 'saida' end) as sentido,
           pr.nome as produto, m.quantidade,
           coalesce(pr.preco_custo, 0) as custo, coalesce(pr.preco_venda, 0) as venda,
           m.numero_nf, m.vinculo_tipo, m.vinculo_nome, m.estornada,
           u.nome as usuario, un.nome as unidade
      from public.movimentacoes_estoque m
      join public.produtos_estoque pr on pr.id = m.produto_id
      left join public.usuarios u on u.id = m.usuario_id
      left join public.unidades un on un.id = coalesce(m.unidade_id, pr.unidade_id)
     where (v_ini is null or m.created_at >= (v_ini::timestamp at time zone 'America/Sao_Paulo'))
       and (v_fim is null or m.created_at < ((v_fim + 1)::timestamp at time zone 'America/Sao_Paulo'))
       and (v_unid is null or coalesce(m.unidade_id, pr.unidade_id) = v_unid)
       and (v_usu is null or m.usuario_id = v_usu)
       and (v_nf is null or m.numero_nf ilike '%' || v_nf || '%')
       and (v_q is null or pr.nome ilike '%' || v_q || '%' or coalesce(m.vinculo_nome, '') ilike '%' || v_q || '%')
       and (case v_tipo
              when 'entrada' then m.tipo::text = 'entrada'
              when 'saida' then m.tipo::text = 'saida' and coalesce(m.tipo_movimentacao, 'saida') <> 'consumo_interno'
              when 'consumo_interno' then m.tipo_movimentacao = 'consumo_interno'
              else true end)
  ),
  pag as (select * from filt order by created_at desc, id limit v_lim offset v_off)
  select jsonb_build_object(
           'total', (select count(*) from filt),
           'totais', jsonb_build_object(
             'entradas', (select jsonb_build_object('quantidade', coalesce(sum(quantidade), 0), 'custo', coalesce(sum(quantidade * custo), 0),
                                 'venda', coalesce(sum(quantidade * venda), 0), 'margem', coalesce(sum(quantidade * (venda - custo)), 0))
                            from filt where sentido = 'entrada' and not coalesce(estornada, false)),
             'saidas', (select jsonb_build_object('quantidade', coalesce(sum(quantidade), 0), 'custo', coalesce(sum(quantidade * custo), 0),
                                 'venda', coalesce(sum(quantidade * venda), 0), 'margem', coalesce(sum(quantidade * (venda - custo)), 0))
                          from filt where sentido = 'saida' and not coalesce(estornada, false)),
             'porDia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'entradas', e, 'saidas', s) order by dia desc)
                                   from (select dia,
                                                coalesce(sum(quantidade) filter (where sentido = 'entrada'), 0) as e,
                                                coalesce(sum(quantidade) filter (where sentido = 'saida'), 0) as s
                                           from filt where not coalesce(estornada, false)
                                          group by dia order by dia desc limit 31) x), '[]'::jsonb)),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'data', g.created_at, 'tipo', g.tipo, 'sentido', g.sentido, 'produto', g.produto,
                      'quantidade', g.quantidade, 'custo', g.custo, 'venda', g.venda,
                      'margem', g.quantidade * (g.venda - g.custo), 'totalCusto', g.quantidade * g.custo,
                      'nf', coalesce(g.numero_nf, '—'),
                      'vinculo', case when g.vinculo_nome is null then '—' else g.vinculo_nome end,
                      'usuario', coalesce(g.usuario, '—'), 'unidade', coalesce(g.unidade, '—'),
                      'estornada', coalesce(g.estornada, false)
                    ) order by g.created_at desc, g.id)
               from pag g), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;
