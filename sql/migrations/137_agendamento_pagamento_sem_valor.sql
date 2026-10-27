-- 137_agendamento_pagamento_sem_valor.sql
-- Encaixe/consulta sem valor de procedimento cadastrado mostrava "Pendente" mesmo com
-- recebimento registrado. Agora: sem valor devido e com valor recebido = 'Pago'.
-- Mesmas colunas da view anterior (CREATE OR REPLACE compatível); idempotente.

create or replace view public.v_agendamento_pagamento_resumo as
select
  a.id as agendamento_id,
  coalesce(sum(case when p.status = 'Pago' then p.valor else 0 end), 0)::numeric(10,2) as total_pago,
  coalesce(a.valor_procedimento, 0)::numeric(10,2) as valor_devido,
  case
    when coalesce(sum(case when p.status = 'Pago' then p.valor else 0 end), 0) <= 0 then 'Pendente'
    when coalesce(a.valor_procedimento, 0) <= 0 then 'Pago'
    when coalesce(sum(case when p.status = 'Pago' then p.valor else 0 end), 0) >= a.valor_procedimento
      then 'Pago'
    else 'Parcial'
  end as situacao,
  max(case when p.status = 'Pago' then p.pago_em else null end)::date as data_ultimo_pagamento
from public.agendamentos a
left join public.agendamentos_pagamentos p on p.agendamento_id = a.id
group by a.id, a.valor_procedimento;
