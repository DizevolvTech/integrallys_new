-- 109_recepcao_agenda_pessoal_permitidos.sql
-- Feedback item 1: a recepcionista só vê compromissos pessoais (sem paciente) dos
-- especialistas liberados nesta lista. NULL/vazio = nenhuma agenda pessoal visível.
-- Idempotente.
alter table public.usuarios
  add column if not exists agenda_pessoal_permitidos uuid[] null;

comment on column public.usuarios.agenda_pessoal_permitidos is
  'Para perfil recepcao: profissional_ids cuja agenda pessoal esta recepcionista pode ver. NULL = nenhuma.';
