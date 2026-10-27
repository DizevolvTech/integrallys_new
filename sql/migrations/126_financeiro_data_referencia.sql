-- 126_financeiro_data_referencia.sql
-- D3 W3 (itens 18/19): colunas calculadas para filtrar contas a receber/pagar por período
-- (liquidado conta pela data de liquidação; em aberto, pelo vencimento) e formas de
-- pagamento genéricas que faltavam (boleto, cartão de débito/crédito). Aditiva e idempotente.

alter table public.financeiro_lancamentos
  add column if not exists liquidado boolean generated always as (lower(status) in ('pago', 'quitado', 'liquidado')) stored,
  add column if not exists cancelado boolean generated always as (lower(status) like 'cancel%') stored,
  add column if not exists data_referencia date generated always as (
    case
      when lower(status) in ('pago', 'quitado', 'liquidado')
        then coalesce(data_liquidacao, (data_lancamento at time zone 'America/Sao_Paulo')::date)
      else coalesce(vencimento, (data_lancamento at time zone 'America/Sao_Paulo')::date)
    end
  ) stored;

create index if not exists financeiro_lancamentos_tipo_ref_idx
  on public.financeiro_lancamentos (tipo, data_referencia desc);
create index if not exists financeiro_lancamentos_aberto_idx
  on public.financeiro_lancamentos (tipo, data_referencia) where liquidado = false and cancelado = false;

insert into public.formas_pagamento (nome, tipo) values
  ('Boleto', 'outro'),
  ('Cartão de débito', 'cartao_debito'),
  ('Cartão de crédito', 'cartao_credito')
on conflict do nothing;

-- Recebimentos antigos da agenda: liga ao paciente quando o nome é único.
update public.financeiro_lancamentos l
set paciente_id = p.id
from (
  select min(id::text)::uuid as id, nome from public.pacientes group by nome having count(*) = 1
) p
where l.paciente_id is null and l.tipo = 'receita' and l.beneficiario is not null and l.beneficiario = p.nome;
