-- Lista de espera: agendar a partir da fila sem apagar histórico.
-- 'aguardando' = na fila; 'agendado' = saiu da fila porque o agendamento foi concluído.
alter table public.lista_espera
  add column if not exists status text not null default 'aguardando',
  add column if not exists atendido_em timestamptz null;

create index if not exists lista_espera_status_entrada_idx
  on public.lista_espera (status, entrada_em);
