-- 143: estorno de movimentacao de estoque falhava com 'column reference "usuario_id" is ambiguous'
-- (parametro com o mesmo nome da coluna). Mesma correcao aplicada a entrada na 121: a funcao
-- prefere a variavel em caso de conflito. Assinatura e comportamento iguais.
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
#variable_conflict use_variable
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
