-- 160: estorno de recebimento do agendamento (vídeo v01 da cliente: "baixei 240 e era pra baixar 120").
-- Modelo igual ao estorno de estoque (143): o registro original NÃO é apagado; ganha marca de estorno
-- (quem, quando, motivo) e o caixa recebe uma SAÍDA de contrapartida na sessão aberta.
-- Tudo numa função só (atômica): pagamento -> Cancelado (a view v_agendamento_pagamento_resumo só soma 'Pago',
-- então o saldo do agendamento volta a ficar em aberto), lançamento financeiro -> Cancelado e saída no caixa.
-- Somente aditiva e idempotente.

alter table public.agendamentos_pagamentos
  add column if not exists estornado_em timestamptz,
  add column if not exists estorno_motivo text,
  add column if not exists estorno_por uuid references public.usuarios(id) on delete set null;

alter table public.financeiro_lancamentos
  add column if not exists pagamento_agendamento_id uuid,
  add column if not exists estornado_em timestamptz,
  add column if not exists estorno_motivo text,
  add column if not exists estorno_por uuid references public.usuarios(id) on delete set null;

alter table public.caixa_movimentos
  add column if not exists pagamento_agendamento_id uuid,
  add column if not exists estorno_de_id uuid;

create index if not exists financeiro_lancamentos_pag_agendamento_idx
  on public.financeiro_lancamentos (pagamento_agendamento_id) where pagamento_agendamento_id is not null;
create index if not exists caixa_movimentos_pag_agendamento_idx
  on public.caixa_movimentos (pagamento_agendamento_id) where pagamento_agendamento_id is not null;
create index if not exists caixa_movimentos_estorno_de_idx
  on public.caixa_movimentos (estorno_de_id) where estorno_de_id is not null;

create or replace function public.agendamento_estornar_pagamento(
  p_pagamento_id uuid,
  p_usuario_id uuid,
  p_motivo text,
  p_operador_nome text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_pag record;
  v_lanc_id uuid;
  v_mov record;
  v_sessao record;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_gaveta numeric;
  v_paciente text;
  v_saida_id uuid;
begin
  if length(v_motivo) < 10 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_ESTORNO_MOTIVO',
      'message', 'Informe o motivo do estorno (mínimo de 10 caracteres).');
  end if;

  select ap.id, ap.agendamento_id, ap.valor, ap.metodo, ap.status::text as status, ap.pago_em, ap.estornado_em
    into v_pag
    from public.agendamentos_pagamentos ap
   where ap.id = p_pagamento_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'PAGAMENTO_NOT_FOUND', 'message', 'Recebimento não encontrado.');
  end if;
  if v_pag.estornado_em is not null then
    return jsonb_build_object('ok', false, 'code', 'PAGAMENTO_ALREADY_REVERSED', 'message', 'Este recebimento já foi estornado.');
  end if;
  if v_pag.status <> 'Pago' then
    return jsonb_build_object('ok', false, 'code', 'PAGAMENTO_NOT_PAID', 'message', 'Só é possível estornar um recebimento pago.');
  end if;

  -- Lançamento financeiro: vínculo direto (novos) ou, nos antigos, o pago do mesmo agendamento e valor mais próximo.
  select fl.id into v_lanc_id
    from public.financeiro_lancamentos fl
   where fl.tipo::text = 'receita' and fl.estornado_em is null and lower(fl.status) = 'pago'
     and (fl.pagamento_agendamento_id = v_pag.id
          or (fl.pagamento_agendamento_id is null and fl.agendamento_id = v_pag.agendamento_id and fl.valor = v_pag.valor))
   order by (fl.pagamento_agendamento_id = v_pag.id) desc nulls last,
            abs(extract(epoch from (fl.data_lancamento - coalesce(v_pag.pago_em, fl.data_lancamento)))) asc
   limit 1
   for update;

  -- Entrada de caixa original (se o recebimento passou pelo caixa aberto).
  select cm.id, cm.unidade_id, cm.forma, cm.valor, cm.bandeira, cm.parcelas, cm.descricao
    into v_mov
    from public.caixa_movimentos cm
   where cm.tipo::text = 'entrada' and cm.origem = 'agendamento'
     and not exists (select 1 from public.caixa_movimentos e where e.estorno_de_id = cm.id)
     and (cm.pagamento_agendamento_id = v_pag.id
          or (cm.pagamento_agendamento_id is null and cm.valor = v_pag.valor
              and v_pag.pago_em is not null
              and abs(extract(epoch from (cm.data_movimento - v_pag.pago_em))) < 120))
   order by (cm.pagamento_agendamento_id = v_pag.id) desc nulls last,
            abs(extract(epoch from (cm.data_movimento - coalesce(v_pag.pago_em, cm.data_movimento)))) asc
   limit 1
   for update;

  if found then
    select cs.id, cs.saldo_inicial, cs.aberto_em into v_sessao
      from public.caixa_sessoes cs
     where cs.unidade_id is not distinct from v_mov.unidade_id
       and cs.data_operacao = v_hoje and cs.status = 'aberto'
     order by cs.aberto_em desc limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'CAIXA_FECHADO',
        'message', 'O caixa de hoje não está aberto. Abra o caixa para registrar a saída do estorno.');
    end if;

    if coalesce(v_mov.forma, 'dinheiro') = 'dinheiro' then
      select v_sessao.saldo_inicial
             + coalesce(sum(case when m.tipo::text = 'entrada' then m.valor else -m.valor end), 0)
        into v_gaveta
        from public.caixa_movimentos m
       where m.unidade_id is not distinct from v_mov.unidade_id
         and m.data_movimento >= v_sessao.aberto_em
         and coalesce(m.forma, 'dinheiro') = 'dinheiro';
      if v_gaveta < v_pag.valor then
        return jsonb_build_object('ok', false, 'code', 'CAIXA_SALDO_INSUFICIENTE',
          'message', 'Não há dinheiro suficiente no caixa para devolver este valor (já foi transferido ao cofre ou retirado).');
      end if;
    end if;
  end if;

  update public.agendamentos_pagamentos
     set status = 'Cancelado', estornado_em = now(), estorno_motivo = v_motivo, estorno_por = p_usuario_id
   where id = v_pag.id and estornado_em is null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'PAGAMENTO_ALREADY_REVERSED', 'message', 'Este recebimento já foi estornado.');
  end if;

  if v_lanc_id is not null then
    update public.financeiro_lancamentos
       set status = 'Cancelado', estornado_em = now(), estorno_motivo = v_motivo, estorno_por = p_usuario_id,
           pagamento_agendamento_id = v_pag.id
     where id = v_lanc_id;
  end if;

  if v_mov.id is not null then
    select pa.nome into v_paciente
      from public.agendamentos a left join public.pacientes pa on pa.id = a.paciente_id
     where a.id = v_pag.agendamento_id;
    insert into public.caixa_movimentos (
      unidade_id, usuario_id, operador_id, sessao_id, descricao, tipo, valor, forma, origem,
      operador_nome, data_movimento, bandeira, parcelas, pagamento_agendamento_id, estorno_de_id
    ) values (
      v_mov.unidade_id, p_usuario_id, p_usuario_id, v_sessao.id,
      'Estorno de recebimento' || coalesce(' – ' || v_paciente, '') || ' (' || v_motivo || ')',
      'saida', v_pag.valor, v_mov.forma, 'estorno', p_operador_nome, now(),
      v_mov.bandeira, v_mov.parcelas, v_pag.id, v_mov.id
    ) returning id into v_saida_id;
  end if;

  return jsonb_build_object('ok', true, 'pagamento_id', v_pag.id, 'valor', v_pag.valor,
    'lancamento_estornado', v_lanc_id is not null, 'caixa_movimento_id', v_saida_id);
end;
$$;

revoke all on function public.agendamento_estornar_pagamento(uuid, uuid, text, text) from public;
grant execute on function public.agendamento_estornar_pagamento(uuid, uuid, text, text) to service_role;
