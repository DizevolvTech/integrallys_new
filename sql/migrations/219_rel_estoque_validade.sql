-- 219_rel_estoque_validade.sql
-- #441 D9: resumo de validade em Relatorios > Estoque (Posicao): vencidos, vencem em ate 60 dias,
-- validade acima de 60 dias e sem validade, com a quantidade de produtos e QUAIS sao (produto, lote,
-- validade, quantidade). So produto fisico (controla_estoque) com saldo > 0. Respeita unidade, busca e
-- categoria da tela (nao a situacao). Ate 500 itens por grupo; 'total' e sempre o numero real.
create or replace function public.rel_estoque_validade(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_q text := nullif(trim(p->>'q'), '');
  v_cat text := nullif(p->>'categoria', '');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_res jsonb;
begin
  with base as (
    select e.id, e.nome, e.lote, e.validade, e.quantidade,
           case when e.validade is null then 'sem_validade'
                when e.validade < v_hoje then 'vencidos'
                when e.validade <= v_hoje + 60 then 'ate_60'
                else 'acima_60' end as grupo
      from public.produtos_estoque e
     where e.controla_estoque
       and coalesce(e.quantidade, 0) > 0
       and (v_unid is null or e.unidade_id = v_unid)
       and (v_q is null or e.nome ilike '%' || v_q || '%' or coalesce(e.lote, '') ilike '%' || v_q || '%')
       and (v_cat is null or e.categoria = v_cat)
  ),
  num as (
    select b.*, row_number() over (partition by grupo order by validade nulls last, nome, id) as rn
      from base b
  ),
  agg as (
    select grupo, count(*) as total,
           jsonb_agg(jsonb_build_object('id', id, 'produto', nome, 'lote', coalesce(lote, '—'),
                                        'validade', validade, 'quantidade', quantidade) order by rn)
             filter (where rn <= 500) as itens
      from num group by grupo
  )
  select jsonb_build_object('grupos', coalesce(
           jsonb_object_agg(grupo, jsonb_build_object('total', total, 'itens', itens)), '{}'::jsonb))
    into v_res
    from agg;
  return v_res;
end;
$$;

do $$
begin
  revoke all on function public.rel_estoque_validade(jsonb) from public, anon, authenticated;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.rel_estoque_validade(jsonb) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
