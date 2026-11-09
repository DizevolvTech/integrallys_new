-- 218_rel_tarefas_indicador.sql
-- #441 D10: os cartoes de Relatorios > Tarefas (Pendentes, Concluidas, Atrasadas) abrem a lista dos
-- registros que formam o numero. Novo filtro 'indicador' (pendentes | concluidas | atrasadas), com a
-- MESMA regra dos totais, somado aos demais filtros da tela. Mesma assinatura e mesmas colunas de 129.
create or replace function public.rel_tarefas(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ini date := nullif(p->>'inicio', '')::date;
  v_fim date := nullif(p->>'fim', '')::date;
  v_resp uuid := nullif(p->>'responsavel_id', '')::uuid;
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_status text := nullif(p->>'status', '');
  v_ind text := nullif(p->>'indicador', '');
  v_q text := nullif(trim(p->>'q'), '');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with filt as (
    select t.id, t.titulo, t.status::text as status, t.vencimento_em, t.prioridade, t.categoria,
           r.nome as responsavel, c.nome as criador, t.motivo_cancelamento
      from public.tarefas t
      left join public.usuarios r on r.id = t.responsavel_id
      left join public.usuarios c on c.id = t.created_by_id
     where (v_ini is null or t.vencimento_em::date >= v_ini)
       and (v_fim is null or t.vencimento_em::date <= v_fim)
       and (v_resp is null or t.responsavel_id = v_resp)
       and (v_unid is null or r.unidade_id = v_unid or c.unidade_id = v_unid)
       and (v_status is null or t.status::text = v_status)
       and (v_q is null or t.titulo ilike '%' || v_q || '%')
       and (v_ind is null
            or (v_ind = 'pendentes' and t.status::text = 'Pendente')
            or (v_ind = 'concluidas' and t.status::text ilike 'Conclu%')
            or (v_ind = 'atrasadas' and t.status::text in ('Pendente', 'Em andamento') and t.vencimento_em < now()))
  ),
  pag as (select * from filt order by vencimento_em desc nulls last, id limit v_lim offset v_off)
  select jsonb_build_object(
           'total', (select count(*) from filt),
           'totais', jsonb_build_object(
             'pendentes', (select count(*) from filt where status = 'Pendente'),
             'concluidas', (select count(*) from filt where status ilike 'Conclu%'),
             'atrasadas', (select count(*) from filt where status in ('Pendente', 'Em andamento') and vencimento_em < now())),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id, 'titulo', g.titulo, 'status', g.status, 'vencimento', g.vencimento_em,
                      'prioridade', coalesce(g.prioridade, '—'), 'categoria', coalesce(g.categoria, '—'),
                      'responsavel', coalesce(g.responsavel, '—'), 'criador', coalesce(g.criador, '—'),
                      'motivo', g.motivo_cancelamento) order by g.vencimento_em desc nulls last, g.id)
               from pag g), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;

notify pgrst, 'reload schema';
