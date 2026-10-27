-- 128_relatorios_base.sql
-- D3/W4 Relatorios: colunas e tabela que os relatorios novos precisam. Aditiva e idempotente.
--  * prescricoes.forma_pagamento: a venda por "Consumo" (preco de custo, fora do caixa) so existia
--    no texto da tela; agora o relatorio de Vendas consegue filtrar "Vendas por consumo".
--  * pacientes.convenio: filtro/coluna de plano-convenio (vazio = Particular).
--  * usuarios.comissao_percentual / is_vendedor: percentual cadastrado que a tela de usuario ja
--    pedia mas nao gravava; base de "Minhas comissoes" e do relatorio de Comissoes.
--  * aniversario_mensagens: "ok, mensagem enviada" por paciente e ano.

alter table public.prescricoes add column if not exists forma_pagamento text null;
alter table public.pacientes add column if not exists convenio text null;
alter table public.usuarios add column if not exists comissao_percentual numeric(5,2) null
  check (comissao_percentual is null or (comissao_percentual >= 0 and comissao_percentual <= 100));
alter table public.usuarios add column if not exists is_vendedor boolean not null default false;

create table if not exists public.aniversario_mensagens (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  ano integer not null check (ano between 2000 and 2200),
  enviado_por uuid null references public.usuarios(id) on delete set null,
  enviado_em timestamptz not null default timezone('utc', now()),
  unique (paciente_id, ano)
);

alter table public.aniversario_mensagens enable row level security;

create index if not exists aniversario_mensagens_ano_idx on public.aniversario_mensagens (ano);

-- Indices usados pelos filtros/ordenacao dos relatorios novos.
create index if not exists prescricoes_data_status_idx on public.prescricoes (data_prescricao desc, status);
create index if not exists prescricao_itens_prescricao_idx on public.prescricao_itens (prescricao_id);
create index if not exists movimentacoes_estoque_created_idx on public.movimentacoes_estoque (created_at desc);
create index if not exists caixa_movimentos_origem_data_idx on public.caixa_movimentos (origem, data_movimento desc);
create index if not exists agendamentos_pagamentos_pago_em_idx on public.agendamentos_pagamentos (pago_em);
create index if not exists tarefas_vencimento_idx on public.tarefas (vencimento_em desc);
