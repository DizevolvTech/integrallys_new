-- 122_suprimentos.sql
-- D3 item 24: cadastro de suprimentos (insumos de procedimento), separado dos produtos de venda,
-- com o mesmo controle de estoque (quantidade, minimo, lote, validade, custo) e livro de
-- movimentacoes. Aditiva e idempotente.

create table if not exists public.suprimentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid null references public.unidades(id) on delete set null,
  nome text not null,
  categoria text not null default 'Suprimento',
  sku text null,
  quantidade integer not null default 0 check (quantidade >= 0),
  estoque_minimo integer not null default 0 check (estoque_minimo >= 0),
  status text not null default 'Disponível',
  lote text null,
  validade date null,
  preco_custo numeric(10,2) null check (preco_custo is null or preco_custo >= 0),
  unidade_medida text null,
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.suprimentos enable row level security;

create unique index if not exists suprimentos_unidade_nome_uidx
  on public.suprimentos (coalesce(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));
create index if not exists suprimentos_unidade_ativo_idx on public.suprimentos (unidade_id, ativo);

create table if not exists public.suprimentos_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  suprimento_id uuid not null references public.suprimentos(id) on delete cascade,
  usuario_id uuid null references public.usuarios(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  origem text not null default 'manual' check (origem in ('manual', 'ajuste', 'procedimento')),
  quantidade integer not null check (quantidade > 0),
  saldo_apos integer not null,
  motivo text null,
  agendamento_id uuid null references public.agendamentos(id) on delete set null,
  procedimento_id uuid null references public.procedimentos(id) on delete set null,
  lote text null,
  validade date null,
  preco_custo numeric(10,2) null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.suprimentos_movimentacoes enable row level security;

create index if not exists suprimentos_mov_suprimento_created_idx
  on public.suprimentos_movimentacoes (suprimento_id, created_at desc);
create index if not exists suprimentos_mov_created_idx
  on public.suprimentos_movimentacoes (created_at desc);

create or replace function public.suprimento_aplicar_movimentacao(
  p_suprimento_id uuid,
  p_usuario_id uuid,
  p_tipo text,
  p_quantidade integer,
  p_motivo text default null,
  p_origem text default 'manual',
  p_lote text default null,
  p_validade date default null,
  p_preco_custo numeric default null,
  p_quantidade_alvo integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty integer;
  v_nova integer;
  v_delta integer;
  v_tipo text := p_tipo;
  v_quant integer := p_quantidade;
  v_origem text := coalesce(p_origem, 'manual');
begin
  select s.quantidade into v_qty from public.suprimentos s where s.id = p_suprimento_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'SUPRIMENTO_NOT_FOUND', 'message', 'Suprimento não encontrado');
  end if;

  if p_quantidade_alvo is not null then
    if p_quantidade_alvo < 0 then
      return jsonb_build_object('ok', false, 'code', 'INVALID_QUANTITY', 'message', 'Quantidade inválida');
    end if;
    v_delta := p_quantidade_alvo - v_qty;
    if v_delta = 0 then
      return jsonb_build_object('ok', false, 'code', 'NO_STOCK_CHANGE', 'message', 'Quantidade já está no valor informado');
    end if;
    v_tipo := case when v_delta > 0 then 'entrada' else 'saida' end;
    v_quant := abs(v_delta);
    v_nova := p_quantidade_alvo;
    v_origem := 'ajuste';
  else
    if v_tipo is null or v_tipo not in ('entrada', 'saida') then
      return jsonb_build_object('ok', false, 'code', 'INVALID_MOVEMENT', 'message', 'Tipo inválido');
    end if;
    if v_quant is null or v_quant <= 0 then
      return jsonb_build_object('ok', false, 'code', 'INVALID_QUANTITY', 'message', 'Quantidade inválida');
    end if;
    v_nova := case when v_tipo = 'entrada' then v_qty + v_quant else v_qty - v_quant end;
    if v_nova < 0 then
      return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_STOCK', 'message', 'Quantidade indisponível para saída');
    end if;
  end if;

  insert into public.suprimentos_movimentacoes
    (suprimento_id, usuario_id, tipo, origem, quantidade, saldo_apos, motivo, lote, validade, preco_custo)
  values
    (p_suprimento_id, p_usuario_id, v_tipo, v_origem, v_quant, v_nova, nullif(trim(coalesce(p_motivo, '')), ''),
     nullif(trim(coalesce(p_lote, '')), ''), p_validade, p_preco_custo);

  update public.suprimentos
     set quantidade = v_nova,
         status = case when v_nova <= 0 then 'Indisponível' else 'Disponível' end,
         lote = case when v_tipo = 'entrada' then coalesce(nullif(trim(coalesce(p_lote, '')), ''), lote) else lote end,
         validade = case when v_tipo = 'entrada' then coalesce(p_validade, validade) else validade end,
         preco_custo = case when v_tipo = 'entrada' then coalesce(p_preco_custo, preco_custo) else preco_custo end,
         updated_at = timezone('utc', now())
   where id = p_suprimento_id;

  return jsonb_build_object('ok', true, 'quantidade', v_nova);
end;
$$;
