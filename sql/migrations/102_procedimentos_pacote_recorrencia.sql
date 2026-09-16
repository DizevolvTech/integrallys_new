-- 102_procedimentos_pacote_recorrencia.sql
-- Call 09/09 · Procedimentos:
--   - pacote/recorrência de consultas (ex.: psicanálise a cada 15 dias)
--   - prazo padrão de retorno permanece em prazo_retorno_dias (UI default 35)

alter table public.procedimentos
  add column if not exists tem_pacote boolean not null default false;

alter table public.procedimentos
  add column if not exists intervalo_recorrencia_dias integer null;

alter table public.procedimentos
  add column if not exists quantidade_sugerida_pacote integer null;

alter table public.procedimentos
  drop constraint if exists procedimentos_pacote_coerente;

alter table public.procedimentos
  add constraint procedimentos_pacote_coerente check (
    tem_pacote = false
    or (
      intervalo_recorrencia_dias is not null
      and intervalo_recorrencia_dias > 0
      and (
        quantidade_sugerida_pacote is null
        or quantidade_sugerida_pacote > 0
      )
    )
  );

comment on column public.procedimentos.tem_pacote is
  'Se true, o procedimento pode gerar série de agendamentos (pacote).';
comment on column public.procedimentos.intervalo_recorrencia_dias is
  'Intervalo em dias entre sessões do pacote (ex.: 15).';
comment on column public.procedimentos.quantidade_sugerida_pacote is
  'Quantidade sugerida de sessões ao gerar o pacote na agenda.';
