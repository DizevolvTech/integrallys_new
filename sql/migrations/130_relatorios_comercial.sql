-- 130_relatorios_comercial.sql
-- D3/W4: Vendas (inclui "Vendas por consumo"), Comissoes, Repasse de atendimentos,
-- Financeiro (filtro por usuario) e Recebimentos. Filtros, paginacao e totais no banco.

create or replace function public.rel_forma_chave(p_forma text)
returns text
language sql
immutable
as $$
  select case
    when p_forma is null or btrim(p_forma) = '' then 'nao_informado'
    when p_forma ilike '%pix%' then 'pix'
    when p_forma ilike '%cr_dito%' then 'credito'
    when p_forma ilike '%d_bito%' then 'debito'
    when p_forma ilike '%transfer%' then 'transferencia'
    when p_forma ilike '%dinheiro%' then 'dinheiro'
    when p_forma ilike '%consumo%' then 'consumo'
    else 'outro'
  end
$$;

create or replace function public.rel_vendas(p jsonb)
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
  v_usu uuid := nullif(p->>'usuario_id', '')::uuid;
  v_prod text := nullif(trim(p->>'produto'), '');
  v_q text := nullif(trim(p->>'q'), '');
  v_forma text := coalesce(nullif(p->>'forma', ''), 'todas');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with filt as (
    select pr.id, pr.numero, pr.data_prescricao as data, pr.valor_total,
           public.rel_forma_chave(pr.forma_pagamento) as forma,
           pa.nome as cliente, prof.nome as profissional, vend.nome as usuario,
           un.nome as unidade
      from public.prescricoes pr
      join public.pacientes pa on pa.id = pr.paciente_id
      left join public.usuarios prof on prof.id = pr.profissional_id
      left join public.usuarios vend on vend.id = pr.vendedor_id
      left join public.unidades un on un.id = coalesce(prof.unidade_id, pa.unidade_id)
     where (pr.status = 'Convertida' or pr.tipo = 'Venda')
       and pr.status <> 'Cancelado'
       and (v_ini is null or pr.data_prescricao >= v_ini)
       and (v_fim is null or pr.data_prescricao <= v_fim)
       and (v_unid is null or coalesce(prof.unidade_id, pa.unidade_id) = v_unid)
       and (v_prof is null or pr.profissional_id = v_prof)
       and (v_usu is null or pr.vendedor_id = v_usu)
       and (v_q is null or pa.nome ilike '%' || v_q || '%')
       and (v_prod is null or exists (select 1 from public.prescricao_itens i where i.prescricao_id = pr.id and i.descricao ilike '%' || v_prod || '%'))
       and (v_forma = 'todas' or public.rel_forma_chave(pr.forma_pagamento) = v_forma)
  ),
  pag as (select * from filt order by data desc nulls last, numero desc limit v_lim offset v_off),
  itens as (
    select i.prescricao_id, i.produto_id, i.descricao, i.quantidade, i.valor_unitario
      from public.prescricao_itens i
     where i.prescricao_id in (select id from filt)
  )
  select jsonb_build_object(
           'total', (select count(*) from filt),
           'totais', jsonb_build_object(
             'vendido', (select coalesce(sum(valor_total), 0) from filt where forma <> 'consumo'),
             'consumo', (select coalesce(sum(valor_total), 0) from filt where forma = 'consumo'),
             'qtdVendas', (select count(*) from filt where forma <> 'consumo'),
             'qtdConsumo', (select count(*) from filt where forma = 'consumo'),
             'porForma', coalesce((select jsonb_agg(jsonb_build_object('forma', forma, 'qtd', c, 'valor', v) order by v desc)
                                     from (select forma, count(*) as c, sum(valor_total) as v from filt group by forma) x), '[]'::jsonb),
             'porProduto', coalesce((select jsonb_agg(jsonb_build_object('nome', n, 'quantidade', q, 'valor', v) order by q desc, n)
                                       from (select it.descricao as n, sum(it.quantidade) as q, sum(it.quantidade * coalesce(it.valor_unitario, 0)) as v
                                               from itens it group by it.descricao order by q desc limit 10) x), '[]'::jsonb)
           ),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'data', g.data, 'numero', g.numero, 'cliente', g.cliente,
                      'profissional', coalesce(g.profissional, '—'), 'usuario', coalesce(g.usuario, '—'),
                      'unidade', coalesce(g.unidade, '—'), 'forma', g.forma, 'valor', coalesce(g.valor_total, 0),
                      'consumo', g.forma = 'consumo',
                      'produtos', coalesce((select string_agg(it.descricao || ' x' || it.quantidade, ', ') from itens it where it.prescricao_id = g.id), '—')
                    ) order by g.data desc nulls last, g.numero desc)
               from pag g), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;

-- Comissao por Prescricao/Venda: base = valor bruto vendido (valor_bruto, senao valor_total),
-- percentual = usuarios.comissao_percentual do vendedor (ou do profissional quando nao ha vendedor).
-- Venda por consumo (preco de custo) nao gera comissao.
create or replace function public.rel_comissoes(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ini date := nullif(p->>'inicio', '')::date;
  v_fim date := nullif(p->>'fim', '')::date;
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_vend uuid := nullif(p->>'profissional_id', '')::uuid;
  v_q text := nullif(trim(p->>'q'), '');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with filt as (
    select pr.id, pr.numero, pr.data_prescricao as data, pa.nome as cliente,
           coalesce(pr.valor_bruto, pr.valor_total, 0) as bruto,
           u.id as vendedor_id, u.nome as vendedor, u.comissao_percentual as pct
      from public.prescricoes pr
      join public.pacientes pa on pa.id = pr.paciente_id
      join public.usuarios u on u.id = coalesce(pr.vendedor_id, pr.profissional_id)
     where (pr.status = 'Convertida' or pr.tipo = 'Venda')
       and pr.status <> 'Cancelado'
       and public.rel_forma_chave(pr.forma_pagamento) <> 'consumo'
       and (v_ini is null or pr.data_prescricao >= v_ini)
       and (v_fim is null or pr.data_prescricao <= v_fim)
       and (v_unid is null or u.unidade_id = v_unid)
       and (v_vend is null or u.id = v_vend)
       and (v_q is null or pa.nome ilike '%' || v_q || '%')
  ),
  pag as (select * from filt order by data desc nulls last, numero desc limit v_lim offset v_off)
  select jsonb_build_object(
           'total', (select count(*) from filt),
           'totais', jsonb_build_object(
             'bruto', (select coalesce(sum(bruto), 0) from filt),
             'comissao', (select coalesce(round(sum(bruto * coalesce(pct, 0) / 100), 2), 0) from filt)),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'data', g.data, 'numero', g.numero, 'cliente', g.cliente,
                      'vendedor', g.vendedor, 'bruto', g.bruto, 'percentual', g.pct,
                      'comissao', round(g.bruto * coalesce(g.pct, 0) / 100, 2),
                      'itens', coalesce((select jsonb_agg(jsonb_build_object(
                                  'descricao', i.descricao, 'quantidade', i.quantidade,
                                  'valorUnitario', coalesce(i.valor_unitario, 0),
                                  'total', i.quantidade * coalesce(i.valor_unitario, 0)) order by i.created_at)
                                  from public.prescricao_itens i where i.prescricao_id = g.id), '[]'::jsonb)
                    ) order by g.data desc nulls last, g.numero desc)
               from pag g), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;

-- Repasse de atendimentos: valor do atendimento x percentual da regra de repasse do profissional.
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
  v_q text := nullif(trim(p->>'q'), '');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with base as (
    select a.id, a.data_agendamento as data, pa.nome as paciente, pc.nome as procedimento,
           u.nome as profissional, un.nome as unidade,
           (a.status::text in ('Concluído', 'Check-out')) as atendido,
           coalesce(a.valor_procedimento, 0) as valor,
           rg.percentual as pct
      from public.agendamentos a
      join public.pacientes pa on pa.id = a.paciente_id
      join public.usuarios u on u.id = a.profissional_id
      left join public.procedimentos pc on pc.id = a.procedimento_id
      left join public.unidades un on un.id = a.unidade_id
      left join lateral (
        select r.percentual from public.regras_repasse r
         where r.profissional_id = a.profissional_id and r.ativo
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
  pag as (select * from base order by data desc, id limit v_lim offset v_off)
  select jsonb_build_object(
           'total', (select count(*) from base),
           'totais', jsonb_build_object(
             'atendimentos', (select count(*) from base where atendido),
             'valor', (select coalesce(sum(valor), 0) from base where atendido),
             'repasse', (select coalesce(round(sum(valor * coalesce(pct, 0) / 100), 2), 0) from base where atendido)),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'data', g.data, 'paciente', g.paciente,
                      'procedimento', coalesce(g.procedimento, '—'), 'profissional', g.profissional,
                      'unidade', coalesce(g.unidade, '—'),
                      'situacao', case when g.atendido then 'Atendido' else 'Cancelado' end,
                      'valor', g.valor, 'percentual', g.pct,
                      'repasse', case when g.atendido then round(g.valor * coalesce(g.pct, 0) / 100, 2) else 0 end
                    ) order by g.data desc, g.id)
               from pag g), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;

create or replace function public.rel_financeiro(p jsonb)
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
  v_tipo text := nullif(p->>'tipo', '');
  v_q text := nullif(trim(p->>'q'), '');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with filt as (
    select f.id, f.data_lancamento, f.descricao, f.categoria, f.tipo::text as tipo, f.metodo, f.status,
           f.valor, u.nome as usuario, un.nome as unidade
      from public.financeiro_lancamentos f
      left join public.usuarios u on u.id = f.usuario_id
      left join public.unidades un on un.id = f.unidade_id
     where (v_ini is null or f.data_lancamento >= v_ini::timestamptz)
       and (v_fim is null or f.data_lancamento < (v_fim + 1)::timestamptz)
       and (v_unid is null or f.unidade_id = v_unid)
       and (v_usu is null or f.usuario_id = v_usu)
       and (v_tipo is null or f.tipo::text = v_tipo)
       and (v_q is null or f.descricao ilike '%' || v_q || '%')
  ),
  pag as (select * from filt order by data_lancamento desc, id limit v_lim offset v_off)
  select jsonb_build_object(
           'total', (select count(*) from filt),
           'totais', jsonb_build_object(
             'receitas', (select coalesce(sum(valor), 0) from filt where tipo = 'receita'),
             'despesas', (select coalesce(sum(valor), 0) from filt where tipo = 'despesa')),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'data', g.data_lancamento, 'descricao', g.descricao,
                      'categoria', coalesce(g.categoria, '—'), 'tipo', g.tipo,
                      'usuario', coalesce(g.usuario, '—'), 'unidade', coalesce(g.unidade, '—'),
                      'metodo', coalesce(g.metodo, '—'), 'status', coalesce(g.status, '—'), 'valor', g.valor
                    ) order by g.data_lancamento desc, g.id)
               from pag g), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;

-- Recebimentos: liquidado (ja entrou) x a receber (pagamento pendente ou saldo de agendamento com
-- pagamento antecipado). Taxa de cartao/compensacao sao calculadas no servidor a partir da
-- configuracao; aqui saem as linhas e os agrupamentos (situacao, forma, parcelas) para os totais.
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
