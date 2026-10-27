-- 006_retorno_demo.sql
-- Seed FICTÍCIO para testar o agendamento de retorno (duração de retorno do profissional).
-- Maria Silva teve atendimento concluído em 26/10/2026 com a Dra. Maria Santos
-- (grade de segunda: 1ª consulta 60 min, retorno 45 min). Vagas de 02/11/2026 (segunda) abertas
-- para marcar o retorno "Retorno (até 30 dias)" ou tipo Retorno. Idempotente.
begin;

insert into public.agendamentos (
  id, unidade_id, paciente_id, profissional_id, procedimento_id, data_agendamento,
  horario_inicio, horario_fim, status, tipo, valor_procedimento, criado_por_id
)
select
  'a0000000-0000-4000-8000-000000000a26'::uuid,
  p.unidade_id, p.id, m.id,
  (select id from public.procedimentos where nome = 'Consulta Clínica Geral' limit 1),
  date '2026-10-26', time '09:00', time '10:00', 'Concluído', 'Consulta', 180, m.id
from public.pacientes p
join public.usuarios m on m.nome = 'Dra. Maria Santos' and m.perfil = 'especialista'
where p.nome = 'Maria Silva'
on conflict (id) do nothing;

insert into public.agendamentos (
  id, unidade_id, profissional_id, data_agendamento, horario_inicio, horario_fim, status, criado_por_id
)
select v.id::uuid, p.unidade_id, m.id, date '2026-11-02', v.ini::time, v.fim::time, 'Disponível', m.id
from (values
  ('a0000000-0000-4000-8000-000000000b01', '08:00', '09:00'),
  ('a0000000-0000-4000-8000-000000000b02', '09:00', '10:00'),
  ('a0000000-0000-4000-8000-000000000b03', '10:00', '11:00')
) as v(id, ini, fim)
join public.usuarios m on m.nome = 'Dra. Maria Santos' and m.perfil = 'especialista'
join public.pacientes p on p.nome = 'Maria Silva'
where not exists (
  select 1 from public.agendamentos a
  where a.profissional_id = m.id and a.data_agendamento = date '2026-11-02'
)
on conflict (id) do nothing;

commit;
