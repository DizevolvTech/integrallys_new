-- 136_cartao_fechamento_pagamento_fatura.sql
-- D3 W6 (itens 27/49): dia de fechamento do cartão empresarial e registro de pagamento
-- de fatura (1 por cartão+mês, o que garante idempotência). Aditiva e idempotente.

alter table public.cartoes_empresariais
  add column if not exists dia_fechamento integer null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cartoes_empresariais_dia_fechamento_check'
  ) then
    alter table public.cartoes_empresariais
      add constraint cartoes_empresariais_dia_fechamento_check
      check (dia_fechamento is null or dia_fechamento between 1 and 31);
  end if;
end $$;

create table if not exists public.cartao_faturas_pagas (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid not null references public.cartoes_empresariais(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  valor numeric(12,2) not null check (valor > 0),
  lancamento_id uuid null references public.financeiro_lancamentos(id) on delete set null,
  usuario_id uuid null references public.usuarios(id) on delete set null,
  pago_em timestamptz not null default timezone('utc', now()),
  unique (cartao_id, mes)
);

create index if not exists cartao_faturas_pagas_lancamento_idx
  on public.cartao_faturas_pagas (lancamento_id) where lancamento_id is not null;

alter table public.cartao_faturas_pagas enable row level security;

drop policy if exists "cartao_faturas_pagas_all" on public.cartao_faturas_pagas;
create policy "cartao_faturas_pagas_all" on public.cartao_faturas_pagas for all using (true) with check (true);

grant select, insert, update, delete on public.cartao_faturas_pagas to service_role;
