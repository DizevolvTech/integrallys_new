-- 112_tarefa_motivo_cancelamento.sql
-- Tarefa cancelada (sem excluir) guarda o motivo do cancelamento. Idempotente.
alter table public.tarefas
  add column if not exists motivo_cancelamento text null;
