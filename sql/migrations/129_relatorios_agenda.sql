-- 129_relatorios_agenda.sql
-- D3/W4: relatorios de Consultas/Agendamentos/Justificativas, Pacientes, Desempenho e Tarefas.
-- Cada funcao recebe os filtros em jsonb, pagina e totaliza NO BANCO e devolve
-- { total, totais, rows }. Escopo de unidade/profissional vem do servidor (nunca do navegador).

create or replace function public.rel_consultas(p jsonb)
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
  v_q text := nullif(trim(p->>'q'), '');
  v_conv text := nullif(p->>'convenio', '');
  v_sit text := coalesce(nullif(p->>'situacao', ''), 'todos');
  v_pag text := coalesce(nullif(p->>'pagamento', ''), 'todos');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with base as (
    select a.id,
           a.data_agendamento as data,
           a.horario_inicio as hora,
           a.status::text as status,
           a.paciente_id,
           pa.nome as paciente,
           coalesce(nullif(pa.convenio, ''), 'Particular') as convenio,
           pr.nome as procedimento,
           us.nome as profissional,
           un.nome as unidade,
           coalesce(a.valor_procedimento, 0) as valor,
           coalesce(r.total_pago, 0) as pago,
           case when a.status::text in ('Cancelado', 'Disponível', 'Bloqueado') then 0
                else greatest(coalesce(a.valor_procedimento, 0) - coalesce(r.total_pago, 0), 0) end as aberto,
           case when a.status::text = 'Cancelado'
                then coalesce(nullif(trim(regexp_replace(coalesce(a.observacoes, ''), '^Cancelado(:|\s+—.*)?\s*', '')), ''), 'Não informado')
                when a.status::text = 'Faltou'
                then coalesce(nullif(trim(a.observacoes), ''), 'Não informado')
                else null end as justificativa
      from public.agendamentos a
      left join public.pacientes pa on pa.id = a.paciente_id
      left join public.procedimentos pr on pr.id = a.procedimento_id
      left join public.usuarios us on us.id = a.profissional_id
      left join public.unidades un on un.id = a.unidade_id
      left join public.v_agendamento_pagamento_resumo r on r.agendamento_id = a.id
     where (v_ini is null or a.data_agendamento >= v_ini)
       and (v_fim is null or a.data_agendamento <= v_fim)
       and (v_unid is null or a.unidade_id = v_unid)
       and (v_prof is null or a.profissional_id = v_prof)
       and (v_proc is null or a.procedimento_id = v_proc)
       and (v_q is null or pa.nome ilike '%' || v_q || '%')
       and (v_conv is null or coalesce(nullif(pa.convenio, ''), 'Particular') = v_conv)
       and (a.paciente_id is not null or a.status::text = 'Disponível')
       and (case v_sit
              when 'agendados' then a.status::text in ('Agendado', 'Confirmado', 'Check-in', 'Em Atendimento', 'Em Atraso', 'Adiado')
              when 'cancelados' then a.status::text = 'Cancelado'
              when 'faltas' then a.status::text = 'Faltou'
              when 'justificativas' then a.status::text in ('Cancelado', 'Faltou')
              when 'realizados' then a.status::text in ('Concluído', 'Check-out')
              when 'disponiveis' then a.status::text = 'Disponível'
              else a.status::text not in ('Bloqueado', 'Disponível')
            end)
  ),
  filt as (
    select * from base
     where (case v_pag
              when 'pago' then valor > 0 and aberto = 0 and pago > 0
              when 'aberto' then aberto > 0
              else true
            end)
  ),
  tot as (
    select count(*) as total,
           coalesce(sum(pago), 0) as recebido,
           coalesce(sum(aberto), 0) as aberto
      from filt
  ),
  pag as (
    select * from filt
     order by data desc, hora desc nulls last, id
     limit v_lim offset v_off
  ),
  hist as (
    select a2.paciente_id,
           count(*) filter (where a2.status::text in ('Concluído', 'Check-out')) as visitas,
           count(*) filter (where a2.status::text in ('Concluído', 'Check-out', 'Faltou', 'Cancelado')) as marcadas,
           string_agg(distinct u2.nome, ', ') filter (where a2.status::text in ('Concluído', 'Check-out')) as especialistas
      from public.agendamentos a2
      left join public.usuarios u2 on u2.id = a2.profissional_id
     where a2.paciente_id in (select paciente_id from pag where paciente_id is not null)
     group by a2.paciente_id
  ),
  pagto as (
    select ap.agendamento_id, string_agg(distinct ap.metodo, ', ') as formas
      from public.agendamentos_pagamentos ap
     where ap.agendamento_id in (select id from pag) and ap.status::text = 'Pago'
     group by ap.agendamento_id
  )
  select jsonb_build_object(
           'total', t.total,
           'totais', jsonb_build_object('recebido', t.recebido, 'aberto', t.aberto),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id,
                      'data', g.data,
                      'hora', to_char(g.hora, 'HH24:MI'),
                      'paciente', coalesce(g.paciente, '—'),
                      'procedimento', coalesce(g.procedimento, '—'),
                      'profissional', coalesce(g.profissional, '—'),
                      'unidade', coalesce(g.unidade, '—'),
                      'convenio', g.convenio,
                      'status', g.status,
                      'valor', g.valor,
                      'pago', g.pago,
                      'aberto', g.aberto,
                      'statusPagamento', case
                          when g.status in ('Cancelado', 'Disponível', 'Bloqueado') then '—'
                          when g.valor <= 0 then 'Sem valor'
                          when g.aberto = 0 then 'Pago'
                          when g.pago > 0 then 'Parcial'
                          else 'Em aberto' end,
                      'formaPagamento', coalesce(pt.formas, '—'),
                      'justificativa', g.justificativa,
                      'visitas', coalesce(h.visitas, 0),
                      'presencaPct', case when coalesce(h.marcadas, 0) > 0
                                          then round(h.visitas::numeric * 100 / h.marcadas, 0) else null end,
                      'especialistas', coalesce(h.especialistas, '—')
                    ) order by g.data desc, g.hora desc nulls last, g.id)
               from pag g
               left join hist h on h.paciente_id = g.paciente_id
               left join pagto pt on pt.agendamento_id = g.id
           ), '[]'::jsonb)
         )
    into v_res
    from tot t;

  return v_res;
end;
$$;

create or replace function public.rel_pacientes(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_prof uuid := nullif(p->>'profissional_id', '')::uuid;
  v_proc uuid := nullif(p->>'procedimento_id', '')::uuid;
  v_q text := nullif(trim(p->>'q'), '');
  v_midia text := nullif(p->>'midia', '');
  v_cidade text := nullif(p->>'cidade', '');
  v_conv text := nullif(p->>'convenio', '');
  v_sexo text := nullif(p->>'sexo', '');
  v_mes int := nullif(p->>'mes_nascimento', '')::int;
  v_nasc date := nullif(p->>'nascimento', '')::date;
  v_falta text := coalesce(nullif(p->>'nao_comparecimento', ''), 'todos');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with filt as (
    select pa.id, pa.nome, pa.telefone, pa.sexo, pa.cidade, pa.data_nascimento, pa.unidade_id,
           coalesce(nullif(pa.origem, ''), 'Não informado') as midia,
           coalesce(nullif(pa.convenio, ''), 'Particular') as convenio,
           coalesce(nullif(pa.cidade, ''), 'Não informada') as cidade_grupo
      from public.pacientes pa
     where pa.status::text <> 'Óbito'
       and (v_unid is null or pa.unidade_id = v_unid)
       and (v_q is null or pa.nome ilike '%' || v_q || '%')
       and (v_midia is null or lower(coalesce(nullif(pa.origem, ''), 'Não informado')) = lower(v_midia))
       and (v_cidade is null or pa.cidade ilike v_cidade)
       and (v_conv is null or coalesce(nullif(pa.convenio, ''), 'Particular') = v_conv)
       and (v_sexo is null or lower(coalesce(pa.sexo, '')) = lower(v_sexo))
       and (v_mes is null or extract(month from pa.data_nascimento) = v_mes)
       and (v_nasc is null or pa.data_nascimento = v_nasc)
       and (v_prof is null or exists (
              select 1 from public.agendamentos a
               where a.paciente_id = pa.id and a.profissional_id = v_prof and a.status::text in ('Concluído', 'Check-out')))
       and (v_proc is null or exists (
              select 1 from public.agendamentos a
               where a.paciente_id = pa.id and a.procedimento_id = v_proc and a.status::text in ('Concluído', 'Check-out')))
       and (case v_falta
              when 'sim' then exists (select 1 from public.agendamentos a where a.paciente_id = pa.id and a.status::text = 'Faltou')
              when 'nao' then not exists (select 1 from public.agendamentos a where a.paciente_id = pa.id and a.status::text = 'Faltou')
              else true
            end)
  ),
  pag as (
    select * from filt order by nome, id limit v_lim offset v_off
  )
  select jsonb_build_object(
           'total', (select count(*) from filt),
           'totais', jsonb_build_object(
             'porMidia', coalesce((select jsonb_agg(jsonb_build_object('nome', n, 'qtd', c) order by c desc, n)
                                     from (select midia as n, count(*) as c from filt group by midia order by c desc limit 8) x), '[]'::jsonb),
             'porCidade', coalesce((select jsonb_agg(jsonb_build_object('nome', n, 'qtd', c) order by c desc, n)
                                      from (select cidade_grupo as n, count(*) as c from filt group by cidade_grupo order by c desc limit 8) x), '[]'::jsonb),
             'porConvenio', coalesce((select jsonb_agg(jsonb_build_object('nome', n, 'qtd', c) order by c desc, n)
                                        from (select convenio as n, count(*) as c from filt group by convenio order by c desc limit 8) x), '[]'::jsonb)
           ),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', g.id,
                      'nome', g.nome,
                      'telefone', coalesce(g.telefone, '—'),
                      'sexo', coalesce(g.sexo, '—'),
                      'cidade', coalesce(nullif(g.cidade, ''), '—'),
                      'nascimento', g.data_nascimento,
                      'midia', g.midia,
                      'convenio', g.convenio,
                      'visitas', coalesce(h.visitas, 0),
                      'faltas', coalesce(h.faltas, 0),
                      'ultimaVisita', h.ultima,
                      'diasSemVisita', case when h.ultima is null then null else (current_date - h.ultima) end,
                      'profissionalMaisAtendido', coalesce(tp.nome, '—'),
                      'procedimentos', coalesce(pr.nomes, '—')
                    ) order by g.nome, g.id)
               from pag g
               left join lateral (
                 select max(a.data_agendamento) filter (where a.status::text in ('Concluído', 'Check-out')) as ultima,
                        count(*) filter (where a.status::text in ('Concluído', 'Check-out')) as visitas,
                        count(*) filter (where a.status::text = 'Faltou') as faltas
                   from public.agendamentos a where a.paciente_id = g.id) h on true
               left join lateral (
                 select u.nome from public.agendamentos a join public.usuarios u on u.id = a.profissional_id
                  where a.paciente_id = g.id and a.status::text in ('Concluído', 'Check-out')
                  group by u.nome order by count(*) desc, u.nome limit 1) tp on true
               left join lateral (
                 select string_agg(x.nome, ', ') as nomes
                   from (select distinct pc.nome from public.agendamentos a join public.procedimentos pc on pc.id = a.procedimento_id
                          where a.paciente_id = g.id and a.status::text in ('Concluído', 'Check-out') limit 3) x) pr on true
           ), '[]'::jsonb)
         )
    into v_res;

  return v_res;
end;
$$;

create or replace function public.rel_desempenho(p jsonb)
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
  v_res jsonb;
begin
  with a as (
    select ag.id, ag.status::text as status, ag.paciente_id, ag.procedimento_id
      from public.agendamentos ag
     where ag.data_agendamento between v_ini and v_fim
       and ag.paciente_id is not null
       and (v_unid is null or ag.unidade_id = v_unid)
       and (v_prof is null or ag.profissional_id = v_prof)
  )
  select jsonb_build_object(
           'total', (select count(*) from a),
           'totais', jsonb_build_object(
             'agendamentos', (select count(*) from a),
             'realizados', (select count(*) from a where status in ('Concluído', 'Check-out')),
             'cancelados', (select count(*) from a where status = 'Cancelado'),
             'faltas', (select count(*) from a where status = 'Faltou'),
             'pacientesUnicos', (select count(distinct paciente_id) from a where status in ('Concluído', 'Check-out')),
             'taxaConclusaoPct', (select case when count(*) > 0
                                   then round(count(*) filter (where status in ('Concluído', 'Check-out'))::numeric * 100 / count(*), 1) else 0 end from a)
           ),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object('id', coalesce(x.pid::text, 'sem'), 'procedimento', x.nome, 'realizados', x.qtd) order by x.qtd desc, x.nome)
               from (select pr.id as pid, coalesce(pr.nome, 'Sem procedimento') as nome, count(*) as qtd
                       from a left join public.procedimentos pr on pr.id = a.procedimento_id
                      where a.status in ('Concluído', 'Check-out')
                      group by pr.id, pr.nome order by qtd desc limit 10) x
           ), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;

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
