-- 213: estorno de movimentacao do Caixa numa funcao so (atomica) - cartao #441, video v04.
-- Antes o botao "Estornar" chamava DELETE /api/caixa (apagava o lancamento e a recepcao levava 403 calado).
-- Agora a movimentacao original NAO e apagada: ganha marca de estorno (migracao 212) e o caixa de hoje recebe a
-- contrapartida ligada pela coluna estorno_de_id (entrada estornada -> saida; saida estornada -> entrada).
--  * venda de prescricao: opcionalmente devolve o estoque (reusa estoque_estornar_movimentacao, 143) e cancela
--    ou reabre a prescricao (status Pendente = "Ativa");
--  * pagamento de agendamento: reusa agendamento_estornar_pagamento (160);
--  * lancamento manual / online: so a contrapartida.
-- Qualquer falha desfaz tudo (bloco interno com excecao) e devolve {ok:false, code, message}.
-- Idempotente (create or replace).

create or replace function public.caixa_estornar_movimento(
  p_movimento_id uuid,
  p_usuario_id uuid,
  p_motivo text,
  p_devolver_estoque boolean default false,
  p_prescricao_acao text default 'cancelar',
  p_operador_nome text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_acao text := lower(coalesce(nullif(trim(p_prescricao_acao), ''), 'cancelar'));
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_orig record;
  v_sessao record;
  v_gaveta numeric;
  v_pag_id uuid;
  v_presc record;
  v_mov record;
  v_res jsonb;
  v_saida_id uuid;
  v_tipo_contra text;
  v_estoque_qtd integer := 0;
  v_status_presc text := null;
  v_paciente text;
begin
  if length(v_motivo) < 10 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_ESTORNO_MOTIVO',
      'message', 'Informe o motivo do estorno (mínimo de 10 caracteres).');
  end if;
  v_motivo := left(v_motivo, 300);
  if v_acao not in ('cancelar', 'reabrir') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PRESCRICAO_ACAO',
      'message', 'Escolha cancelar ou reabrir a prescrição.');
  end if;

  select cm.* into v_orig from public.caixa_movimentos cm where cm.id = p_movimento_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'MOVIMENTO_NOT_FOUND', 'message', 'Movimentação não encontrada.');
  end if;
  if v_orig.origem = 'estorno' or v_orig.estorno_de_id is not null then
    return jsonb_build_object('ok', false, 'code', 'MOVIMENTO_E_ESTORNO',
      'message', 'Esta movimentação já é um estorno e não pode ser estornada.');
  end if;
  if v_orig.estornado_em is not null
     or exists (select 1 from public.caixa_movimentos e where e.estorno_de_id = v_orig.id) then
    return jsonb_build_object('ok', false, 'code', 'MOVIMENTO_ALREADY_REVERSED',
      'message', 'Esta movimentação já foi estornada.');
  end if;

  select cs.id, cs.saldo_inicial, cs.aberto_em into v_sessao
    from public.caixa_sessoes cs
   where cs.unidade_id is not distinct from v_orig.unidade_id
     and cs.data_operacao = v_hoje and cs.status = 'aberto'
   order by cs.aberto_em desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'CAIXA_FECHADO',
      'message', 'O caixa de hoje não está aberto. Abra o caixa para registrar o estorno.');
  end if;

  -- Devolver dinheiro: a gaveta precisa ter o valor (igual a migracao 160).
  if v_orig.tipo::text = 'entrada' and coalesce(v_orig.forma, 'dinheiro') = 'dinheiro' then
    select v_sessao.saldo_inicial
           + coalesce(sum(case when m.tipo::text = 'entrada' then m.valor else -m.valor end), 0)
      into v_gaveta
      from public.caixa_movimentos m
     where m.unidade_id is not distinct from v_orig.unidade_id
       and m.data_movimento >= v_sessao.aberto_em
       and coalesce(m.forma, 'dinheiro') = 'dinheiro';
    if v_gaveta < v_orig.valor then
      return jsonb_build_object('ok', false, 'code', 'CAIXA_SALDO_INSUFICIENTE',
        'message', 'Não há dinheiro suficiente no caixa para devolver este valor (já foi transferido ao cofre ou retirado).');
    end if;
  end if;

  v_tipo_contra := case when v_orig.tipo::text = 'entrada' then 'saida' else 'entrada' end;

  -- Bloco interno: se algo falhar, o que ele fez volta (estoque, prescricao, pagamento, caixa).
  begin
    if v_orig.origem = 'agendamento' then
      v_pag_id := v_orig.pagamento_agendamento_id;
      if v_pag_id is null then
        -- Recebimento antigo sem ligacao direta: mesmo criterio da 160 (valor e horario do pagamento).
        select ap.id into v_pag_id
          from public.agendamentos_pagamentos ap
         where ap.status::text = 'Pago' and ap.estornado_em is null and ap.valor = v_orig.valor
           and ap.pago_em is not null
           and abs(extract(epoch from (v_orig.data_movimento - ap.pago_em))) < 120
         order by abs(extract(epoch from (v_orig.data_movimento - ap.pago_em))) asc
         limit 1;
      end if;
      if v_pag_id is null then
        raise exception 'ESTORNO_AGENDAMENTO_SEM_PAGAMENTO|Não encontrei o recebimento do agendamento ligado a esta movimentação. Estorne pelo agendamento.';
      end if;
      v_res := public.agendamento_estornar_pagamento(v_pag_id, p_usuario_id, v_motivo, p_operador_nome);
      if coalesce((v_res->>'ok')::boolean, false) is not true then
        raise exception '%|%', coalesce(v_res->>'code', 'ESTORNO_FALHOU'), coalesce(v_res->>'message', 'Não foi possível estornar o recebimento.');
      end if;
      v_saida_id := nullif(v_res->>'caixa_movimento_id', '')::uuid;
      if v_saida_id is null then
        raise exception 'ESTORNO_AGENDAMENTO_SEM_CAIXA|O recebimento do agendamento não está ligado a esta movimentação do caixa.';
      end if;
    else
      if v_orig.origem = 'prescricao' and v_orig.prescricao_id is not null then
        select pr.id, pr.numero, pr.status, pr.tipo into v_presc
          from public.prescricoes pr where pr.id = v_orig.prescricao_id for update;
        if found then
          if p_devolver_estoque then
            for v_mov in
              select me.id
                from public.movimentacoes_estoque me
               where me.tipo::text = 'saida' and me.estornada = false
                 and me.observacoes in ('Saída por conversão de prescrição ' || v_presc.numero,
                                        'Saída por venda de prescrição ' || v_presc.numero)
               order by me.created_at
            loop
              v_res := public.estoque_estornar_movimentacao(
                v_mov.id, p_usuario_id, 'Estorno da venda ' || v_presc.numero || ': ' || v_motivo);
              if coalesce((v_res->>'ok')::boolean, false) is not true then
                raise exception '%|%', coalesce(v_res->>'code', 'ESTOQUE_ESTORNO_FALHOU'),
                  coalesce(v_res->>'message', 'Não foi possível devolver o produto ao estoque.');
              end if;
              v_estoque_qtd := v_estoque_qtd + 1;
            end loop;
          end if;

          if v_presc.status = 'Convertida' then
            if v_acao = 'reabrir' then
              update public.prescricoes
                 set status = 'Pendente',
                     tipo = case when tipo = 'Venda' then 'Prescrição' else tipo end
               where id = v_presc.id;
              v_status_presc := 'Pendente';
            else
              update public.prescricoes set status = 'Cancelado' where id = v_presc.id;
              v_status_presc := 'Cancelado';
            end if;
          else
            v_status_presc := v_presc.status;
          end if;
        end if;
      end if;

      insert into public.caixa_movimentos (
        unidade_id, usuario_id, operador_id, sessao_id, descricao, tipo, valor, forma, origem,
        operador_nome, data_movimento, bandeira, parcelas, valor_parcela, forma_pagamento_id,
        conta_bancaria_id, pagamento_agendamento_id, prescricao_id,
        vinculo_tipo, vinculo_id, vinculo_nome, estorno_de_id
      ) values (
        v_orig.unidade_id, p_usuario_id, p_usuario_id, v_sessao.id,
        left('Estorno: ' || v_orig.descricao || ' (' || v_motivo || ')', 500),
        v_tipo_contra::public.movimento_caixa_tipo, v_orig.valor, v_orig.forma, 'estorno',
        p_operador_nome, now(), v_orig.bandeira, v_orig.parcelas, v_orig.valor_parcela, v_orig.forma_pagamento_id,
        v_orig.conta_bancaria_id, v_orig.pagamento_agendamento_id, v_orig.prescricao_id,
        v_orig.vinculo_tipo, v_orig.vinculo_id, v_orig.vinculo_nome, v_orig.id
      ) returning id into v_saida_id;
    end if;

    update public.caixa_movimentos
       set estornado_em = coalesce(estornado_em, now()), estorno_motivo = v_motivo, estorno_por = p_usuario_id
     where id = v_orig.id;
  exception when raise_exception then
    return jsonb_build_object('ok', false,
      'code', coalesce(nullif(split_part(sqlerrm, '|', 1), ''), 'ESTORNO_FALHOU'),
      'message', coalesce(nullif(split_part(sqlerrm, '|', 2), ''), 'Não foi possível estornar a movimentação.'));
  end;

  return jsonb_build_object('ok', true, 'movimento_id', v_orig.id, 'caixa_movimento_id', v_saida_id,
    'valor', v_orig.valor, 'tipo_estorno', v_tipo_contra, 'produtos_devolvidos', v_estoque_qtd,
    'prescricao_status', v_status_presc);
end;
$$;

revoke all on function public.caixa_estornar_movimento(uuid, uuid, text, boolean, text, text) from public;
grant execute on function public.caixa_estornar_movimento(uuid, uuid, text, boolean, text, text) to service_role;

notify pgrst, 'reload schema';
