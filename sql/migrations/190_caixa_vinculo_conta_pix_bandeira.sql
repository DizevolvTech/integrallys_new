-- 190: base comum dos ajustes dos videos de 03/11 (cartao #389)
-- Caixa: conta do PIX, vinculo (de quem recebe / para quem paga).
-- Prescricoes/Vendas: bandeira do cartao e conta do PIX da venda.
-- Normaliza a forma das vendas convertidas que entravam como 'credito'/'debito'
-- (o resumo do caixa so conta 'cartao_credito'/'cartao_debito').

alter table public.caixa_movimentos
  add column if not exists conta_bancaria_id uuid references public.contas_bancarias(id) on delete set null,
  add column if not exists vinculo_tipo text,
  add column if not exists vinculo_id uuid,
  add column if not exists vinculo_nome text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'caixa_movimentos_vinculo_tipo_check') then
    alter table public.caixa_movimentos
      add constraint caixa_movimentos_vinculo_tipo_check
      check (vinculo_tipo is null or vinculo_tipo in ('paciente', 'fornecedor', 'prestador', 'colaborador', 'outro'));
  end if;
end $$;

alter table public.prescricoes
  add column if not exists bandeira text,
  add column if not exists conta_bancaria_id uuid references public.contas_bancarias(id) on delete set null;

update public.caixa_movimentos set forma = 'cartao_credito' where forma = 'credito';
update public.caixa_movimentos set forma = 'cartao_debito' where forma = 'debito';

create index if not exists caixa_movimentos_data_idx on public.caixa_movimentos (data_movimento desc);

notify pgrst, 'reload schema';
