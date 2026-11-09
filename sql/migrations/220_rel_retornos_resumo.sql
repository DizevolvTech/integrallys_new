-- 220_rel_retornos_resumo.sql
-- #441 D6: resumo de Relatorios > Retornos. Conta os retornos registrados (status 'pendente' em
-- retornos_pendentes) por andamento:
--   pendentes  = sem consulta de retorno marcada depois do atendimento (mesma regra da view retornos_em_aberto);
--   agendados  = ha consulta de retorno marcada (nao cancelada) e ainda nao realizada;
--   concluidos = ha consulta de retorno realizada (Concluido ou Check-out).
-- Filtros iguais aos da lista: unidade_id, profissional_id (especialista do retorno), procedimento_id,
-- de/ate (data do atendimento de origem) e q (nome do cliente).
create or replace function public.rel_retornos_resumo(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_prof uuid := nullif(p->>'profissional_id', '')::uuid;
  v_proc uuid := nullif(p->>'procedimento_id', '')::uuid;
  v_de date := nullif(p->>'de', '')::date;
  v_ate date := nullif(p->>'ate', '')::date;
  v_q text := nullif(trim(p->>'q'), '');
  v_res jsonb;
begin
  with base as (
    select r.id,
           (select max(case when a.status::text in ('Concluído', 'Check-out') then 2 else 1 end)
              from public.agendamentos a
             where a.paciente_id = r.paciente_id
               and lower(btrim(coalesce(a.tipo, ''))) = 'retorno'
               and a.status::text <> 'Cancelado'
               and a.data_agendamento >= r.data_base
               and a.created_at >= r.created_at) as marca
      from public.retornos_pendentes r
      left join public.pacientes pa on pa.id = r.paciente_id
     where r.status = 'pendente'
       and (v_unid is null or r.unidade_id = v_unid)
       and (v_prof is null or coalesce(r.especialista_retorno_id, r.profissional_id) = v_prof)
       and (v_proc is null or coalesce(r.procedimento_retorno_id, r.procedimento_id) = v_proc)
       and (v_de is null or r.data_base >= v_de)
       and (v_ate is null or r.data_base <= v_ate)
       and (v_q is null or pa.nome ilike '%' || v_q || '%')
  )
  select jsonb_build_object(
           'pendentes', count(*) filter (where marca is null),
           'agendados', count(*) filter (where marca = 1),
           'concluidos', count(*) filter (where marca = 2))
    into v_res
    from base;
  return v_res;
end;
$$;

do $$
begin
  revoke all on function public.rel_retornos_resumo(jsonb) from public, anon, authenticated;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.rel_retornos_resumo(jsonb) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
