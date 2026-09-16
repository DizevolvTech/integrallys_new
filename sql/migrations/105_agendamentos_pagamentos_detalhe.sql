-- 105_agendamentos_pagamentos_detalhe.sql
-- Call 09/09 · 1.7 — bandeira (cartão), parcelas e conta Pix no recebimento.

alter table public.agendamentos_pagamentos
  add column if not exists bandeira text null;

alter table public.agendamentos_pagamentos
  add column if not exists parcelas integer null;

alter table public.agendamentos_pagamentos
  add column if not exists conta_bancaria_id uuid null
    references public.contas_bancarias(id) on delete set null;

alter table public.agendamentos_pagamentos
  drop constraint if exists agendamentos_pagamentos_parcelas_check;

alter table public.agendamentos_pagamentos
  add constraint agendamentos_pagamentos_parcelas_check
  check (parcelas is null or (parcelas >= 1 and parcelas <= 24));

create index if not exists agendamentos_pagamentos_conta_idx
  on public.agendamentos_pagamentos (conta_bancaria_id);
