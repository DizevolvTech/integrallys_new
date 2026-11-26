-- 248_pagamento_resumo_data_fuso_clinica.sql
-- #1645: "Recebido em" mostrava o dia seguinte para pagamentos lançados depois das 21h de Brasília:
-- data_ultimo_pagamento convertia timestamptz para date no fuso do banco (UTC). Agora usa o fuso da clínica.
-- Mesmas colunas e tipos da view anterior (create or replace, idempotente).
create or replace view public.v_agendamento_pagamento_resumo as
select a.id as agendamento_id,
       coalesce(sum(case when p.status = 'Pago'::pagamento_status then p.valor else 0::numeric end), 0::numeric)::numeric(10,2) as total_pago,
       coalesce(a.valor_procedimento, 0::numeric)::numeric(10,2) as valor_devido,
       case
         when coalesce(sum(case when p.status = 'Pago'::pagamento_status then p.valor else 0::numeric end), 0::numeric) <= 0::numeric then 'Pendente'::text
         when coalesce(a.valor_procedimento, 0::numeric) <= 0::numeric then 'Pago'::text
         when coalesce(sum(case when p.status = 'Pago'::pagamento_status then p.valor else 0::numeric end), 0::numeric) >= a.valor_procedimento then 'Pago'::text
         else 'Parcial'::text
       end as situacao,
       (max(case when p.status = 'Pago'::pagamento_status then p.pago_em else null::timestamptz end) at time zone 'America/Sao_Paulo')::date as data_ultimo_pagamento
  from public.agendamentos a
  left join public.agendamentos_pagamentos p on p.agendamento_id = a.id
 group by a.id, a.valor_procedimento;
