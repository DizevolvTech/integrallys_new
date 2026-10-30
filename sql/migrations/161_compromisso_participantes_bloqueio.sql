-- 161: compromisso pessoal com participantes (vídeos v04/v05 da cliente).
--  * agendamentos.compromisso_grupo_id: todas as cópias de um mesmo compromisso (uma por participante, na agenda
--    Pessoal de cada um) apontam para o id da cópia do organizador; editar/excluir age no grupo inteiro.
--  * agenda_bloqueios.agendamento_id: bloqueio ligado à cópia do compromisso (some junto, em cascata). Antes o
--    vínculo era um texto "Compromisso:<id>|<título>" na justificativa, que aparecia cru para a cliente.
-- Somente aditiva e idempotente.

alter table public.agendamentos
  add column if not exists compromisso_grupo_id uuid;

create index if not exists agendamentos_compromisso_grupo_idx
  on public.agendamentos (compromisso_grupo_id) where compromisso_grupo_id is not null;

alter table public.agenda_bloqueios
  add column if not exists agendamento_id uuid references public.agendamentos(id) on delete cascade;

create index if not exists agenda_bloqueios_agendamento_idx
  on public.agenda_bloqueios (agendamento_id) where agendamento_id is not null;

-- Bloqueios antigos de compromisso: liga ao agendamento e deixa só o título na justificativa.
update public.agenda_bloqueios b
   set agendamento_id = a.id,
       justificativa = nullif(btrim(substring(b.justificativa from '^Compromisso:[0-9a-fA-F-]{36}\|(.*)$')), '')
  from public.agendamentos a
 where b.agendamento_id is null
   and b.justificativa ~ '^Compromisso:[0-9a-fA-F-]{36}\|'
   and a.id = substring(b.justificativa from '^Compromisso:([0-9a-fA-F-]{36})\|')::uuid;
