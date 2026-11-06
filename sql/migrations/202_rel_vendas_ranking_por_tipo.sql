-- 202_rel_vendas_ranking_por_tipo.sql
-- Relatorio de Vendas (cartao #389, v12): o ranking por quantidade deixa de misturar tudo e passa a vir em tres:
-- rankProdutos, rankConsultas e rankProcedimentos (mais vendido primeiro). O tipo do item vem da categoria do
-- cadastro do item (produtos_estoque.categoria, ligado por prescricao_itens.produto_id): 'Consulta' e 'Procedimento'
-- tem ranking proprio; qualquer outra categoria (Produto, Insumo, Exame...) ou item sem cadastro conta como produto.
-- porProduto continua no retorno por compatibilidade. Idempotente.

create or replace function public.rel_venda_tipo_item(p_categoria text)
returns text language sql immutable as $$
  select case
    when lower(btrim(coalesce(p_categoria, ''))) in ('consulta', 'consultas') then 'consulta'
    when lower(btrim(coalesce(p_categoria, ''))) in ('procedimento', 'procedimentos') then 'procedimento'
    else 'produto'
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
    select i.prescricao_id, i.produto_id, i.descricao, i.quantidade, i.valor_unitario,
           public.rel_venda_tipo_item(pe.categoria) as tipo
      from public.prescricao_itens i
      left join public.produtos_estoque pe on pe.id = i.produto_id
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
                                               from itens it group by it.descricao order by q desc limit 10) x), '[]'::jsonb),
             'rankProdutos', coalesce((select jsonb_agg(jsonb_build_object('nome', n, 'quantidade', q, 'valor', v) order by q desc, n)
                                    from (select it.descricao as n, sum(it.quantidade) as q, sum(it.quantidade * coalesce(it.valor_unitario, 0)) as v
                                            from itens it where it.tipo = 'produto'
                                           group by it.descricao order by q desc, n limit 20) x), '[]'::jsonb),
             'rankConsultas', coalesce((select jsonb_agg(jsonb_build_object('nome', n, 'quantidade', q, 'valor', v) order by q desc, n)
                                    from (select it.descricao as n, sum(it.quantidade) as q, sum(it.quantidade * coalesce(it.valor_unitario, 0)) as v
                                            from itens it where it.tipo = 'consulta'
                                           group by it.descricao order by q desc, n limit 20) x), '[]'::jsonb),
             'rankProcedimentos', coalesce((select jsonb_agg(jsonb_build_object('nome', n, 'quantidade', q, 'valor', v) order by q desc, n)
                                    from (select it.descricao as n, sum(it.quantidade) as q, sum(it.quantidade * coalesce(it.valor_unitario, 0)) as v
                                            from itens it where it.tipo = 'procedimento'
                                           group by it.descricao order by q desc, n limit 20) x), '[]'::jsonb)
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
