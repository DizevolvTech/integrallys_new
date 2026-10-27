-- 132_dashboard_indices.sql
-- D3 itens 38/41/47/52 (início por perfil): índices para as consultas agregadas do
-- dashboard (retornos por paciente, performance do especialista, faturamento por unidade).
-- Somente aditiva e idempotente.

create index if not exists evolucoes_retorno_paciente_data_idx
  on public.evolucoes (paciente_id, data_evolucao desc)
  where retorno_recepcao is not null;

create index if not exists evolucoes_profissional_data_idx
  on public.evolucoes (profissional_id, data_evolucao desc);

create index if not exists agendamentos_profissional_data_status_idx
  on public.agendamentos (profissional_id, data_agendamento, status);

create index if not exists agendamentos_unidade_data_idx
  on public.agendamentos (unidade_id, data_agendamento);

create index if not exists agendamentos_paciente_futuro_idx
  on public.agendamentos (data_agendamento, paciente_id)
  where paciente_id is not null;

create index if not exists prescricoes_profissional_data_idx
  on public.prescricoes (profissional_id, data_prescricao);

create index if not exists financeiro_lancamentos_unidade_data_idx
  on public.financeiro_lancamentos (unidade_id, data_lancamento desc);

analyze public.evolucoes;
analyze public.agendamentos;
analyze public.prescricoes;
analyze public.financeiro_lancamentos;
