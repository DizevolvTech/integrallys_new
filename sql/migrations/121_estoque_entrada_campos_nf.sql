-- 121_estoque_entrada_campos_nf.sql
-- D3 item 30: entrada de estoque com campos proprios (NF, fornecedor do cadastro, data da NF, custo,
-- lote, validade) e atualizacao do lote/validade/custo do produto na mesma transacao.
-- Aditiva e idempotente.
--
-- Correcao compativel: estoque_aplicar_movimentacao (108) falhava com 'column reference "numero_nf" is
-- ambiguous' quando a entrada trazia NF + CNPJ (parametro com o mesmo nome da coluna). A assinatura e o
-- comportamento nao mudam; so a resolucao do nome passa a preferir a variavel.

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
#variable_conflict use_variable
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

alter table public.movimentacoes_estoque add column if not exists data_nf date null;
alter table public.movimentacoes_estoque add column if not exists fornecedor_id uuid null references public.pacientes(id) on delete set null;
alter table public.movimentacoes_estoque add column if not exists preco_custo numeric(10,2) null;
alter table public.movimentacoes_estoque add column if not exists lote text null;
alter table public.movimentacoes_estoque add column if not exists validade date null;

create index if not exists movimentacoes_estoque_fornecedor_idx
  on public.movimentacoes_estoque (fornecedor_id) where fornecedor_id is not null;

create or replace function public.estoque_registrar_entrada(
  p_produto_id uuid,
  p_usuario_id uuid,
  p_quantidade integer,
  p_numero_nf text default null,
  p_cnpj_emitente text default null,
  p_fornecedor_id uuid default null,
  p_fornecedor_nome text default null,
  p_data_nf date default null,
  p_preco_custo numeric default null,
  p_lote text default null,
  p_validade date default null,
  p_observacoes text default null,
  p_force_nf boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb;
  v_mov uuid;
begin
  if p_preco_custo is not null and p_preco_custo < 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CUSTO', 'message', 'Preço de custo inválido');
  end if;

  v_res := public.estoque_aplicar_movimentacao(
    produto_id := p_produto_id,
    usuario_id := p_usuario_id,
    tipo := 'entrada',
    quantidade := p_quantidade,
    tipo_movimentacao := 'entrada',
    observacoes := p_observacoes,
    vinculo_tipo := case when p_fornecedor_id is not null then 'fornecedor' else null end,
    vinculo_id := p_fornecedor_id,
    vinculo_nome := nullif(trim(coalesce(p_fornecedor_nome, '')), ''),
    numero_nf := p_numero_nf,
    cnpj_emitente := p_cnpj_emitente,
    force_nf := coalesce(p_force_nf, false)
  );

  if coalesce((v_res ->> 'ok')::boolean, false) is not true then
    return v_res;
  end if;

  v_mov := (v_res ->> 'movimentacao_id')::uuid;

  update public.movimentacoes_estoque
     set data_nf = p_data_nf,
         fornecedor_id = p_fornecedor_id,
         preco_custo = p_preco_custo,
         lote = nullif(trim(coalesce(p_lote, '')), ''),
         validade = p_validade
   where id = v_mov;

  update public.produtos_estoque
     set preco_custo = coalesce(p_preco_custo, preco_custo),
         lote = coalesce(nullif(trim(coalesce(p_lote, '')), ''), lote),
         validade = coalesce(p_validade, validade),
         updated_at = timezone('utc', now())
   where id = p_produto_id;

  return v_res;
end;
$$;
