-- 108_estoque_movimentacao_atomica.sql
-- Atomicidade de estoque (P1-5): lock de produto + ledger + qty numa única transação.
-- Substitui o RMW best-effort nas rotas /api/estoque e /api/prescricoes.

create or replace function public.estoque_aplicar_movimentacao(
  produto_id uuid,
  usuario_id uuid,
  tipo text,
  quantidade integer,
  tipo_movimentacao text default null,
  observacoes text default null,
  vinculo_tipo text default null,
  vinculo_id uuid default null,
  vinculo_nome text default null,
  numero_nf text default null,
  cnpj_emitente text default null,
  quantidade_alvo integer default null,
  force_nf boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty integer;
  v_minimo integer;
  v_unidade uuid;
  v_delta integer;
  v_tipo text;
  v_tipo_mov text;
  v_nova integer;
  v_status text;
  v_mov_id uuid;
  v_existente record;
begin
  if tipo is null or tipo not in ('entrada', 'saida') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STOCK_MOVEMENT', 'message', 'Tipo inválido');
  end if;

  if quantidade_alvo is not null then
    -- Ajuste absoluto: quantidade = alvo; delta calculado sob lock.
    null;
  elsif quantidade is null or quantidade <= 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STOCK_MOVEMENT', 'message', 'Quantidade inválida');
  end if;

  select pe.quantidade, pe.estoque_minimo, pe.unidade_id
    into v_qty, v_minimo, v_unidade
  from public.produtos_estoque pe
  where pe.id = produto_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Produto não encontrado');
  end if;

  if quantidade_alvo is not null then
    if quantidade_alvo < 0 then
      return jsonb_build_object('ok', false, 'code', 'INVALID_STOCK_ADJUSTMENT', 'message', 'Quantidade inválida');
    end if;
    v_delta := quantidade_alvo - v_qty;
    if v_delta = 0 then
      return jsonb_build_object('ok', false, 'code', 'NO_STOCK_CHANGE', 'message', 'Quantidade já está no valor informado');
    end if;
    v_tipo := case when v_delta > 0 then 'entrada' else 'saida' end;
    v_tipo_mov := coalesce(nullif(trim(tipo_movimentacao), ''), 'ajuste');
    v_nova := quantidade_alvo;
    quantidade := abs(v_delta);
  else
    v_tipo := tipo;
    v_tipo_mov := coalesce(
      nullif(trim(tipo_movimentacao), ''),
      case when tipo = 'entrada' then 'entrada' else 'saida' end
    );
    v_nova := case when tipo = 'entrada' then v_qty + quantidade else v_qty - quantidade end;
    if v_nova < 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'INSUFFICIENT_STOCK',
        'message', 'Quantidade indisponível para saída'
      );
    end if;
  end if;

  if v_tipo = 'entrada'
     and numero_nf is not null and length(trim(numero_nf)) > 0
     and cnpj_emitente is not null and length(trim(cnpj_emitente)) > 0
     and force_nf is not true then
    select me.id, me.created_at
      into v_existente
    from public.movimentacoes_estoque me
    where me.numero_nf = trim(numero_nf)
      and me.cnpj_emitente = trim(cnpj_emitente)
    limit 1;

    if found then
      return jsonb_build_object(
        'ok', false,
        'code', 'NF_DUPLICADA',
        'message', format(
          'NF %s deste fornecedor já foi importada em %s',
          trim(numero_nf),
          to_char(v_existente.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')
        )
      );
    end if;
  end if;

  v_status := case when v_nova <= 0 then 'Indisponível' else 'Disponível' end;

  insert into public.movimentacoes_estoque (
    produto_id,
    usuario_id,
    tipo,
    tipo_movimentacao,
    quantidade,
    observacoes,
    vinculo_tipo,
    vinculo_id,
    vinculo_nome,
    numero_nf,
    cnpj_emitente,
    unidade_id
  ) values (
    produto_id,
    usuario_id,
    v_tipo::public.movimento_caixa_tipo,
    v_tipo_mov,
    quantidade,
    observacoes,
    vinculo_tipo,
    vinculo_id,
    vinculo_nome,
    nullif(trim(coalesce(numero_nf, '')), ''),
    nullif(trim(coalesce(cnpj_emitente, '')), ''),
    v_unidade
  )
  returning id into v_mov_id;

  update public.produtos_estoque
  set
    quantidade = v_nova,
    status = v_status,
    updated_at = timezone('utc', now())
  where id = produto_id;

  return jsonb_build_object(
    'ok', true,
    'movimentacao_id', v_mov_id,
    'quantidade', v_nova,
    'status', v_status
  );
end;
$$;

create or replace function public.estoque_estornar_movimentacao(
  movimentacao_id uuid,
  usuario_id uuid,
  motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orig record;
  v_qty integer;
  v_unidade uuid;
  v_comp text;
  v_nova integer;
  v_status text;
  v_comp_id uuid;
  v_motivo text;
begin
  v_motivo := trim(coalesce(motivo, ''));
  if length(v_motivo) < 10 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_ESTORNO_MOTIVO',
      'message', 'Motivo do estorno deve ter ao menos 10 caracteres'
    );
  end if;

  select me.id, me.produto_id, me.tipo::text as tipo, me.quantidade, me.estornada
    into v_orig
  from public.movimentacoes_estoque me
  where me.id = movimentacao_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'MOV_NOT_FOUND', 'message', 'Movimentação não encontrada');
  end if;

  if v_orig.estornada then
    return jsonb_build_object('ok', false, 'code', 'MOV_ALREADY_REVERSED', 'message', 'Movimentação já foi estornada');
  end if;

  select pe.quantidade, pe.unidade_id
    into v_qty, v_unidade
  from public.produtos_estoque pe
  where pe.id = v_orig.produto_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PRODUCT_NOT_FOUND', 'message', 'Produto não encontrado');
  end if;

  v_comp := case when v_orig.tipo = 'entrada' then 'saida' else 'entrada' end;
  v_nova := case when v_comp = 'entrada' then v_qty + v_orig.quantidade else v_qty - v_orig.quantidade end;

  if v_nova < 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INSUFFICIENT_STOCK_FOR_REVERSAL',
      'message', 'Estoque insuficiente para estornar a movimentação'
    );
  end if;

  update public.movimentacoes_estoque
  set
    estornada = true,
    estorno_motivo = v_motivo,
    estornada_em = timezone('utc', now()),
    estorno_por = usuario_id
  where id = movimentacao_id
    and estornada = false;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'MOV_ALREADY_REVERSED', 'message', 'Movimentação já foi estornada');
  end if;

  insert into public.movimentacoes_estoque (
    produto_id,
    usuario_id,
    tipo,
    tipo_movimentacao,
    quantidade,
    observacoes,
    movimentacao_origem_id,
    unidade_id
  ) values (
    v_orig.produto_id,
    usuario_id,
    v_comp::public.movimento_caixa_tipo,
    v_comp,
    v_orig.quantidade,
    'Estorno: ' || v_motivo,
    movimentacao_id,
    v_unidade
  )
  returning id into v_comp_id;

  v_status := case when v_nova <= 0 then 'Indisponível' else 'Disponível' end;

  update public.produtos_estoque
  set
    quantidade = v_nova,
    status = v_status,
    updated_at = timezone('utc', now())
  where id = v_orig.produto_id;

  return jsonb_build_object(
    'ok', true,
    'movimentacao_id', v_comp_id,
    'quantidade', v_nova,
    'status', v_status
  );
end;
$$;

revoke all on function public.estoque_aplicar_movimentacao(
  uuid, uuid, text, integer, text, text, text, uuid, text, text, text, integer, boolean
) from public;
revoke all on function public.estoque_estornar_movimentacao(uuid, uuid, text) from public;

grant execute on function public.estoque_aplicar_movimentacao(
  uuid, uuid, text, integer, text, text, text, uuid, text, text, text, integer, boolean
) to service_role;
grant execute on function public.estoque_estornar_movimentacao(uuid, uuid, text) to service_role;

comment on function public.estoque_aplicar_movimentacao is
  'Aplica entrada/saída/ajuste de estoque com FOR UPDATE (P1-5).';
comment on function public.estoque_estornar_movimentacao is
  'Estorna movimentação de estoque atomicamente (ledger + qty).';
