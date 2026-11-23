-- 230_agendamento_checkin_espera.sql
-- Cartão 1427 (vídeo 23/11): cronômetro de espera do paciente na agenda + relatório "Tempo de espera".
-- checkin_em é gravado no servidor (trigger) quando o status vira 'Check-in': vale para qualquer caminho que mude o status.
-- Voltar para Agendado/Confirmado limpa; novo Check-in regrava. Registros antigos ficam null (a tela não mostra nada).
-- Espera = atendimento_inicio_em - checkin_em (colunas da migração 224). Aditiva e idempotente.
alter table public.agendamentos
  add column if not exists checkin_em timestamptz;

create index if not exists idx_agendamentos_espera_data
  on public.agendamentos (data_agendamento)
  where checkin_em is not null;

create or replace function public.agendamentos_registrar_inicio_fim()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  if new.status::text = 'Check-in' then
    -- chegada (ou nova chegada): a espera conta a partir de agora
    new.checkin_em := now();
  elsif new.status::text in ('Agendado', 'Confirmado') then
    new.checkin_em := null;
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

-- Relatório "Tempo de espera": só atendimentos com check-in e início registrados (início >= check-in).
-- rows = uma linha por paciente (média e maior espera, em minutos), paginada; totais = média geral e por especialista.
create or replace function public.rel_tempo_espera(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ini date := coalesce(nullif(p->>'inicio', '')::date, current_date - 30);
  v_fim date := coalesce(nullif(p->>'fim', '')::date, current_date);
  v_unid uuid := nullif(p->>'unidade_id', '')::uuid;
  v_prof uuid := nullif(p->>'profissional_id', '')::uuid;
  v_q text := nullif(trim(p->>'q'), '');
  v_lim int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 20), 1), 200);
  v_off int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_res jsonb;
begin
  with e as (
    select ag.paciente_id, pa.nome as paciente, ag.profissional_id,
           extract(epoch from (ag.atendimento_inicio_em - ag.checkin_em)) / 60.0 as min
      from public.agendamentos ag
      join public.pacientes pa on pa.id = ag.paciente_id
     where ag.checkin_em is not null
       and ag.atendimento_inicio_em is not null
       and ag.atendimento_inicio_em >= ag.checkin_em
       and ag.data_agendamento between v_ini and v_fim
       and (v_unid is null or ag.unidade_id = v_unid)
       and (v_prof is null or ag.profissional_id = v_prof)
       and (v_q is null or pa.nome ilike '%' || v_q || '%')
  ),
  pac as (
    select paciente_id, paciente, count(*) as qtd,
           round(avg(min)::numeric, 1) as media, round(max(min)::numeric, 1) as maior
      from e group by paciente_id, paciente
  ),
  esp as (
    select coalesce(us.nome, 'Sem especialista') as nome, count(*) as qtd, round(avg(e.min)::numeric, 1) as media
      from e left join public.usuarios us on us.id = e.profissional_id
     group by us.nome
  )
  select jsonb_build_object(
           'total', (select count(*) from pac),
           'totais', jsonb_build_object(
             'qtd', (select count(*) from e),
             'mediaMin', (select round(avg(min)::numeric, 1) from e),
             'maiorMin', (select round(max(min)::numeric, 1) from e),
             'porEspecialista', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'qtd', qtd, 'mediaMin', media)
                                                    order by media desc, nome) from esp), '[]'::jsonb)),
           'rows', coalesce((
             select jsonb_agg(jsonb_build_object('id', x.paciente_id::text, 'paciente', x.paciente,
                                                 'atendimentos', x.qtd, 'mediaMin', x.media, 'maiorMin', x.maior)
                              order by x.media desc, x.paciente)
               from (select * from pac order by media desc, paciente limit v_lim offset v_off) x), '[]'::jsonb)
         )
    into v_res;
  return v_res;
end;
$$;
