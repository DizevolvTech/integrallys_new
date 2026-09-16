-- 101_tarefas_recorrencia.sql
-- Recorrência completa de tarefas (call 09/09):
-- diária, dias úteis, semanal, quinzenal, mensal, anual, dias específicos.
-- Ao concluir com recorrência, a API gera a próxima ocorrência.
-- Concluídas somem da lista operacional e permanecem no relatório.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tarefa_recorrencia') then
    create type public.tarefa_recorrencia as enum (
      'nenhuma',
      'diaria',
      'dias_uteis',
      'semanal',
      'quinzenal',
      'mensal',
      'anual',
      'dias_especificos'
    );
  end if;
end $$;

-- Se o enum já existia sem dias_especificos (deploy parcial), adiciona o valor.
alter type public.tarefa_recorrencia add value if not exists 'dias_especificos';

alter table public.tarefas
  add column if not exists recorrencia public.tarefa_recorrencia not null default 'nenhuma';

alter table public.tarefas
  add column if not exists dias_semana smallint[] null;

alter table public.tarefas
  add column if not exists alerta boolean not null default false;

alter table public.tarefas
  add column if not exists prioridade text null;

alter table public.tarefas
  add column if not exists categoria text null;

comment on column public.tarefas.recorrencia is
  'Frequência de repetição. Ao concluir, gera próxima ocorrência se <> nenhuma.';

comment on column public.tarefas.dias_semana is
  'Dias da semana (0=domingo .. 6=sábado) quando recorrencia = dias_especificos.';

comment on column public.tarefas.alerta is
  'Se true, a tarefa deve destacar alerta na lista operacional.';
