-- 131_relatorios_estoque_aniversarios.sql
-- D3/W4: Estoque (posicao com custo/venda/margem e movimentacao diaria), Aniversariantes
-- e permissoes de execucao das funcoes de relatorio (somente service_role, via API).

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
     where (v_unid is null or e.unidade_id = v_unid)
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
             'margemPct', (select case when coalesce(sum(quantidade * venda), 0) > 0
                                  then round(sum(quantidade * (venda - custo)) * 100 / sum(quantidade * venda), 1) else 0 end from filt)),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'nome', g.nome, 'categoria', coalesce(g.categoria, '—'), 'unidade', coalesce(g.unidade, '—'),
                      'lote', coalesce(g.lote, '—'), 'validade', g.validade, 'quantidade', g.quantidade,
                      'minimo', coalesce(g.estoque_minimo, 0), 'custo', g.custo, 'venda', g.venda,
                      'margem', g.venda - g.custo,
                      'margemPct', case when g.venda > 0 then round((g.venda - g.custo) * 100 / g.venda, 1) else null end
                    ) order by g.nome, g.id)
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
     where (v_ini is null or m.created_at >= v_ini::timestamptz)
       and (v_fim is null or m.created_at < (v_fim + 1)::timestamptz)
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

-- Aniversariantes do dia ou do mes, com o "ok, mensagem enviada" gravado por paciente e ano.
create or replace function public.rel_aniversariantes(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_data date := coalesce(nullif(p->>'data', '')::date, (now() at time zone 'America/Sao_Paulo')::date);
  v_modo text := coalesce(nullif(p->>'modo', ''), 'dia');
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_q text := nullif(trim(p->>'q'), '');
  v_env text := coalesce(nullif(p->>'enviado', ''), 'todos');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 50), 1), 500);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_ano int := extract(year from v_data)::int;
  v_res jsonb;
begin
  with filt as (
    select pa.id, pa.nome, pa.telefone, pa.data_nascimento,
           (v_ano - extract(year from pa.data_nascimento)::int) as idade,
           am.enviado_em
      from public.pacientes pa
      left join public.aniversario_mensagens am on am.paciente_id = pa.id and am.ano = v_ano
     where pa.data_nascimento is not null
       and pa.status::text <> 'Óbito'
       and extract(month from pa.data_nascimento) = extract(month from v_data)
       and (v_modo = 'mes' or extract(day from pa.data_nascimento) = extract(day from v_data))
       and (v_unid is null or pa.unidade_id = v_unid)
       and (v_q is null or pa.nome ilike '%' || v_q || '%')
       and (case v_env when 'sim' then am.id is not null when 'nao' then am.id is null else true end)
  ),
  pag as (
    select * from filt order by extract(day from data_nascimento), nome, id limit v_lim offset v_off
  )
  select jsonb_build_object(
           'total', (select count(*) from filt),
           'totais', jsonb_build_object('enviados', (select count(*) from filt where enviado_em is not null)),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'nome', g.nome, 'telefone', coalesce(g.telefone, '—'),
                      'nascimento', g.data_nascimento, 'idade', g.idade,
                      'enviado', g.enviado_em is not null, 'enviadoEm', g.enviado_em
                    ) order by extract(day from g.data_nascimento), g.nome, g.id)
               from pag g), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;

-- Funcoes de relatorio so executam pela API (service_role); nunca por anon/authenticated.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'rel_forma_chave(text)', 'rel_consultas(jsonb)', 'rel_pacientes(jsonb)', 'rel_desempenho(jsonb)',
    'rel_tarefas(jsonb)', 'rel_vendas(jsonb)', 'rel_comissoes(jsonb)', 'rel_repasse_atendimentos(jsonb)',
    'rel_financeiro(jsonb)', 'rel_recebimentos(jsonb)', 'rel_estoque_posicao(jsonb)',
    'rel_estoque_movimentacao(jsonb)', 'rel_aniversariantes(jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', fn);
    end if;
  end loop;
end $$;
