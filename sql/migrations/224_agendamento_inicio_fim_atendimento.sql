-- 224_agendamento_inicio_fim_atendimento.sql
-- Cartão 1073 (vídeo c09): "tempo em atendimento" no início do especialista.
-- Antes não havia registro de quando o status virou 'Em Atendimento' / 'Check-out'.
-- Gravado no servidor (trigger): vale para qualquer caminho que mude o status.
-- Atendimentos antigos ficam sem registro (null) e a tela mostra '—'.
alter table public.agendamentos
  add column if not exists atendimento_inicio_em timestamptz,
  add column if not exists atendimento_fim_em timestamptz;

create or replace function public.agendamentos_registrar_inicio_fim()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  if new.status::text = 'Em Atendimento' then
    -- (re)abertura: novo início, fim anterior deixa de valer
    new.atendimento_inicio_em := now();
    new.atendimento_fim_em := null;
  elsif new.status::text in ('Check-out', 'Concluído') then
    -- só mede quando o início foi registrado; fim fica uma única vez
    if new.atendimento_inicio_em is not null and new.atendimento_fim_em is null then
      new.atendimento_fim_em := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists agendamentos_inicio_fim_atendimento on public.agendamentos;
create trigger agendamentos_inicio_fim_atendimento
  before insert or update of status on public.agendamentos
  for each row execute function public.agendamentos_registrar_inicio_fim();
