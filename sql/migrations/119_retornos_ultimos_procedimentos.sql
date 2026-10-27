-- 119_retornos_ultimos_procedimentos.sql
-- Lista de retornos: últimos 3 procedimentos atendidos de cada paciente da página,
-- numa única consulta (sem N+1). Função nova, somente leitura.
create or replace function public.retornos_ultimos_procedimentos(p_paciente_ids uuid[])
returns table (paciente_id uuid, data_agendamento date, procedimento_nome text)
language sql
stable
as $$
  select x.paciente_id, x.data_agendamento, x.nome
  from unnest(p_paciente_ids) as pid(id)
  cross join lateral (
    select a.paciente_id, a.data_agendamento, pr.nome, a.horario_inicio
    from public.agendamentos a
    join public.procedimentos pr on pr.id = a.procedimento_id
    where a.paciente_id = pid.id
      and a.status::text in ('Check-out', 'Concluído')
    order by a.data_agendamento desc, a.horario_inicio desc
    limit 3
  ) x
$$;

revoke all on function public.retornos_ultimos_procedimentos(uuid[]) from public;
grant execute on function public.retornos_ultimos_procedimentos(uuid[]) to service_role;

create index if not exists agendamentos_paciente_data_idx
  on public.agendamentos (paciente_id, data_agendamento desc);
