-- 211: relatorio de Pacientes conta so cadastros de cliente (fornecedor/prestador ficam fora). Cartao #389.
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
  v_faixa text := nullif(p->>'faixa_etaria', '');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes int := nullif(p->>'mes_nascimento', '')::int;
  v_nasc date := nullif(p->>'nascimento', '')::date;
  v_falta text := coalesce(nullif(p->>'nao_comparecimento', ''), 'todos');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with filt as (
    select pa.id, pa.nome, pa.telefone, pa.sexo, pa.cidade, pa.data_nascimento, pa.unidade_id,
           public.rel_sexo_chave(pa.sexo) as sexo_chave,
           public.rel_faixa_etaria_chave(pa.data_nascimento, v_hoje) as faixa_chave,
           coalesce(nullif(pa.origem, ''), 'Não informado') as midia,
           coalesce(nullif(pa.convenio, ''), 'Particular') as convenio,
           coalesce(nullif(pa.cidade, ''), 'Não informada') as cidade_grupo
      from public.pacientes pa
     where pa.status::text <> 'Óbito'
       and 'cliente' = any(pa.vinculo_tipos)
       and (v_unid is null or pa.unidade_id = v_unid)
       and (v_q is null or pa.nome ilike '%' || v_q || '%')
       and (v_midia is null or lower(coalesce(nullif(pa.origem, ''), 'Não informado')) = lower(v_midia))
       and (v_cidade is null or pa.cidade ilike v_cidade)
       and (v_conv is null or coalesce(nullif(pa.convenio, ''), 'Particular') = v_conv)
       and (v_sexo is null or public.rel_sexo_chave(pa.sexo) = lower(v_sexo))
       and (v_faixa is null or public.rel_faixa_etaria_chave(pa.data_nascimento, v_hoje) = lower(v_faixa))
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
                                        from (select convenio as n, count(*) as c from filt group by convenio order by c desc limit 8) x), '[]'::jsonb),
             'porSexo', coalesce((select jsonb_agg(jsonb_build_object('nome', public.rel_sexo_rotulo(k), 'qtd', c) order by o)
                                    from (select sexo_chave as k, count(*) as c,
                                                 array_position(array['feminino','masculino','nao_informado'], sexo_chave) as o
                                            from filt group by sexo_chave) x), '[]'::jsonb),
             'porFaixaEtaria', coalesce((select jsonb_agg(jsonb_build_object('nome', public.rel_faixa_etaria_rotulo(k), 'qtd', c,
                                                'pct', round(c * 100.0 / nullif((select count(*) from filt), 0), 1)) order by o)
                                    from (select faixa_chave as k, count(*) as c,
                                                 array_position(array['ate_14','15_24','25_34','35_44','45_54','55_64','65_mais','nao_informado'], faixa_chave) as o
                                            from filt group by faixa_chave) x), '[]'::jsonb)
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

notify pgrst, 'reload schema';
