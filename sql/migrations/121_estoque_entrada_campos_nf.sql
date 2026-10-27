-- 121_estoque_entrada_campos_nf.sql
-- D3 item 30: entrada de estoque com campos proprios (NF, fornecedor do cadastro, data da NF, custo,
-- lote, validade) e atualizacao do lote/validade/custo do produto na mesma transacao.
-- Aditiva e idempotente; usa estoque_aplicar_movimentacao (108) sem altera-la.

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
