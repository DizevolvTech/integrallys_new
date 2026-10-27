-- 116_profissional_duracao_retorno.sql
-- Item 9 (Gerar Agenda): tempo de atendimento do RETORNO por turno da grade do
-- profissional. duracao_min continua sendo a duração da 1ª consulta (e o passo dos
-- slots gerados); duracao_retorno_min NULL = retorno usa a mesma duração.
-- Aditiva e idempotente.
alter table public.profissional_horarios
  add column if not exists duracao_retorno_min int null;

alter table public.profissional_horarios
  drop constraint if exists profissional_horarios_duracao_retorno_check;
alter table public.profissional_horarios
  add constraint profissional_horarios_duracao_retorno_check
  check (duracao_retorno_min is null or duracao_retorno_min > 0);
