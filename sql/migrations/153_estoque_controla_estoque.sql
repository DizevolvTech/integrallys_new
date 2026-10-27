-- 153: itens de catalogo (consulta, procedimento, exame) nao tem controle de estoque.
-- O seed antigo os gravou em produtos_estoque com qtd 997-999 e custo 0, inflando venda/margem.
-- Nada e apagado: a coluna controla_estoque separa o que e produto fisico; prescricoes e
-- movimentacoes que apontam para esses ids continuam validas.
alter table public.produtos_estoque add column if not exists controla_estoque boolean not null default true;

update public.produtos_estoque
   set controla_estoque = false
 where controla_estoque
   and lower(categoria) in ('consulta', 'procedimento', 'exame', 'servico', 'serviço');

create index if not exists produtos_estoque_controla_idx on public.produtos_estoque (unidade_id) where controla_estoque;

create or replace function public.rel_estoque_posicao(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_q text := nullif(trim(p->>'q'), '');
  v_cat text := nullif(p->>'categoria', '');
  v_sit text := coalesce(nullif(p->>'situacao', ''), 'todas');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with filt as (
    select e.id, e.nome, e.categoria, e.sku, e.lote, e.validade,
           e.quantidade, e.estoque_minimo,
           coalesce(e.preco_custo, 0) as custo, coalesce(e.preco_venda, 0) as venda,
           un.nome as unidade
      from public.produtos_estoque e
      left join public.unidades un on un.id = e.unidade_id
     where e.controla_estoque
       and (v_unid is null or e.unidade_id = v_unid)
       and (v_q is null or e.nome ilike '%' || v_q || '%' or coalesce(e.lote, '') ilike '%' || v_q || '%')
       and (v_cat is null or e.categoria = v_cat)
       and (case v_sit
              when 'abaixo_minimo' then e.quantidade <= coalesce(e.estoque_minimo, 0)
              when 'vencido' then e.validade is not null and e.validade < current_date
              when 'vence_30' then e.validade is not null and e.validade between current_date and current_date + 30
              when 'zerado' then e.quantidade <= 0
              else true end)
  ),
  pag as (select * from filt order by nome, id limit v_lim offset v_off)
  select jsonb_build_object(
           'total', (select count(*) from filt),
           'totais', jsonb_build_object(
             'produtos', (select count(*) from filt),
             'quantidade', (select coalesce(sum(quantidade), 0) from filt),
             'custo', (select coalesce(sum(quantidade * custo), 0) from filt),
             'venda', (select coalesce(sum(quantidade * venda), 0) from filt),
             'margem', (select coalesce(sum(quantidade * (venda - custo)), 0) from filt),
             'margemPct', (select case when coalesce(sum(quantidade * custo), 0) > 0
                                  then round(sum(quantidade * (venda - custo)) * 100 / sum(quantidade * custo), 1) else null end from filt)),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'nome', g.nome, 'categoria', coalesce(g.categoria, '—'), 'unidade', coalesce(g.unidade, '—'),
                      'lote', coalesce(g.lote, '—'), 'validade', g.validade, 'quantidade', g.quantidade,
                      'minimo', coalesce(g.estoque_minimo, 0), 'custo', g.custo, 'venda', g.venda,
                      'margem', g.venda - g.custo,
                      'margemPct', case when g.custo > 0 then round((g.venda - g.custo) * 100 / g.custo, 1) else null end
                    ) order by g.nome, g.id)
               from pag g), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;

notify pgrst, 'reload schema';
