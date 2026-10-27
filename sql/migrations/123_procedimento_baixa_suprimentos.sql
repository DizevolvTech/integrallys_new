-- 123_procedimento_baixa_suprimentos.sql
-- D3 item 24: o cadastro de procedimento escolhe se baixa suprimentos ao pagamento e quais/quanto.
-- A baixa e idempotente por (agendamento, suprimento): pagamento repetido nao baixa de novo.
-- Aditiva e idempotente.

alter table public.procedimentos
  add column if not exists baixa_suprimentos boolean not null default false;

create table if not exists public.procedimento_suprimentos (
  procedimento_id uuid not null references public.procedimentos(id) on delete cascade,
  suprimento_id uuid not null references public.suprimentos(id) on delete cascade,
  quantidade integer not null check (quantidade > 0),
  primary key (procedimento_id, suprimento_id)
);

alter table public.procedimento_suprimentos enable row level security;
create index if not exists procedimento_suprimentos_suprimento_idx
  on public.procedimento_suprimentos (suprimento_id);

-- Idempotencia: no maximo uma baixa automatica por agendamento e suprimento.
create unique index if not exists suprimentos_mov_baixa_agendamento_uidx
  on public.suprimentos_movimentacoes (agendamento_id, suprimento_id)
  where origem = 'procedimento' and agendamento_id is not null;

create or replace function public.suprimentos_baixar_agendamento(
  p_agendamento_id uuid,
  p_usuario_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proc uuid;
  v_baixa boolean;
  v_item record;
  v_disp integer;
  v_baixar integer;
  v_inserted uuid;
  v_nova integer;
  v_baixados jsonb := '[]'::jsonb;
  v_faltas jsonb := '[]'::jsonb;
begin
  select a.procedimento_id into v_proc from public.agendamentos a where a.id = p_agendamento_id;
  if v_proc is null then
    return jsonb_build_object('ok', true, 'baixados', v_baixados, 'faltas', v_faltas);
  end if;
  select p.baixa_suprimentos into v_baixa from public.procedimentos p where p.id = v_proc;
  if coalesce(v_baixa, false) is not true then
    return jsonb_build_object('ok', true, 'baixados', v_baixados, 'faltas', v_faltas);
  end if;

  for v_item in
    select ps.suprimento_id, ps.quantidade, s.nome
      from public.procedimento_suprimentos ps
      join public.suprimentos s on s.id = ps.suprimento_id
     where ps.procedimento_id = v_proc
     order by ps.suprimento_id
  loop
    -- trava o suprimento antes de decidir a quantidade
    select s.quantidade into v_disp from public.suprimentos s where s.id = v_item.suprimento_id for update;
    if exists (
      select 1 from public.suprimentos_movimentacoes m
       where m.agendamento_id = p_agendamento_id and m.suprimento_id = v_item.suprimento_id and m.origem = 'procedimento'
    ) then
      continue;
    end if;

    v_baixar := least(v_item.quantidade, greatest(v_disp, 0));
    if v_baixar < v_item.quantidade then
      v_faltas := v_faltas || jsonb_build_object('suprimentoId', v_item.suprimento_id, 'nome', v_item.nome,
                                                 'necessario', v_item.quantidade, 'baixado', v_baixar);
    end if;
    if v_baixar <= 0 then
      continue;
    end if;

    v_nova := v_disp - v_baixar;
    insert into public.suprimentos_movimentacoes
      (suprimento_id, usuario_id, tipo, origem, quantidade, saldo_apos, motivo, agendamento_id, procedimento_id)
    values
      (v_item.suprimento_id, p_usuario_id, 'saida', 'procedimento', v_baixar, v_nova,
       case when v_baixar < v_item.quantidade
            then format('Baixa automática do procedimento pago (faltaram %s: estoque insuficiente)', v_item.quantidade - v_baixar)
            else 'Baixa automática do procedimento pago' end,
       p_agendamento_id, v_proc)
    on conflict do nothing
    returning id into v_inserted;

    if v_inserted is not null then
      update public.suprimentos
         set quantidade = v_nova,
             status = case when v_nova <= 0 then 'Indisponível' else 'Disponível' end,
             updated_at = timezone('utc', now())
       where id = v_item.suprimento_id;
      v_baixados := v_baixados || jsonb_build_object('suprimentoId', v_item.suprimento_id, 'nome', v_item.nome, 'quantidade', v_baixar);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'baixados', v_baixados, 'faltas', v_faltas);
end;
$$;

-- Gatilho: qualquer caminho que registre pagamento de consulta (agenda, financeiro, novo agendamento)
-- dispara a baixa quando o procedimento fica quitado (pago >= valor). A baixa e idempotente; uma falha
-- nunca bloqueia o pagamento.
create or replace function public.trg_baixa_suprimentos_pagamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valor numeric;
  v_pago numeric;
begin
  if new.status::text <> 'Pago' then
    return new;
  end if;
  select a.valor_procedimento into v_valor from public.agendamentos a where a.id = new.agendamento_id;
  if coalesce(v_valor, 0) <= 0 then
    return new;
  end if;
  select coalesce(sum(p.valor), 0) into v_pago
    from public.agendamentos_pagamentos p
   where p.agendamento_id = new.agendamento_id and p.status::text = 'Pago';
  if v_pago + 0.005 >= v_valor then
    begin
      perform public.suprimentos_baixar_agendamento(new.agendamento_id, null);
    exception when others then
      raise warning 'baixa de suprimentos falhou para o agendamento %: %', new.agendamento_id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists agendamentos_pagamentos_baixa_suprimentos on public.agendamentos_pagamentos;
create trigger agendamentos_pagamentos_baixa_suprimentos
  after insert or update of status, valor on public.agendamentos_pagamentos
  for each row execute function public.trg_baixa_suprimentos_pagamento();
