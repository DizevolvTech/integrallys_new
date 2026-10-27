-- 124_financeiro_cadastros_anexos.sql
-- D3 W3 (itens 18, 19, 25, 50): cadastros editáveis (bancos, categorias de DRE),
-- campos novos do lançamento (emissão, nº do documento, categoria de DRE, grupo de
-- parcelas, vínculos para filtros), anexos de despesa em Storage privado e
-- recurso de permissão `cadastros`. Somente aditiva e idempotente.

-- ---------------------------------------------------------------------------
-- Bancos (cadastro editável; contas bancárias passam a escolher daqui)
-- ---------------------------------------------------------------------------
create table if not exists public.bancos (
  id uuid primary key default gen_random_uuid(),
  codigo text null,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists bancos_nome_unique_idx on public.bancos (lower(nome));
alter table public.bancos enable row level security;

insert into public.bancos (codigo, nome) values
  ('001', 'Banco do Brasil'), ('033', 'Santander'), ('077', 'Banco Inter'),
  ('104', 'Caixa Econômica Federal'), ('208', 'BTG Pactual'), ('237', 'Bradesco'),
  ('260', 'Nubank'), ('336', 'C6 Bank'), ('341', 'Itaú Unibanco'),
  ('422', 'Banco Safra'), ('748', 'Sicredi'), ('756', 'Sicoob')
on conflict do nothing;

alter table public.contas_bancarias
  add column if not exists banco_id uuid null references public.bancos(id) on delete set null;
create index if not exists contas_bancarias_banco_idx on public.contas_bancarias (banco_id);

-- Liga contas já cadastradas (texto livre) ao banco de mesmo nome, quando existir.
update public.contas_bancarias c
set banco_id = b.id
from public.bancos b
where c.banco_id is null
  and c.banco is not null
  and lower(btrim(c.banco)) = lower(b.nome);

-- ---------------------------------------------------------------------------
-- Categorias de DRE (antes fixas no código)
-- `linha_dre` diz em qual linha do DRE a categoria entra (valor do enum legado
-- `dre_categoria`, que o /api/dre continua lendo em financeiro_lancamentos.categoria_dre).
-- ---------------------------------------------------------------------------
create table if not exists public.dre_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  linha_dre text not null,
  ordem integer not null default 100,
  ativo boolean not null default true,
  sistema boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists dre_categorias_nome_tipo_idx on public.dre_categorias (lower(nome), tipo);
alter table public.dre_categorias enable row level security;

insert into public.dre_categorias (nome, tipo, linha_dre, ordem, sistema) values
  ('Consultas', 'receita', 'receita_consultas', 10, true),
  ('Procedimentos', 'receita', 'receita_consultas', 20, true),
  ('Venda de produtos', 'receita', 'receita_produtos', 30, true),
  ('Outras receitas', 'receita', 'receita_outros', 40, true),
  ('Despesas fixas', 'despesa', 'despesa_fixa', 10, true),
  ('Despesas variáveis', 'despesa', 'outros', 20, true),
  ('Despesas operacionais', 'despesa', 'outros', 30, true),
  ('Despesas não operacionais', 'despesa', 'outros', 40, true),
  ('Despesas administrativas', 'despesa', 'despesa_administrativa', 50, true),
  ('Despesas financeiras', 'despesa', 'despesa_administrativa', 60, true)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Lançamentos: emissão, nº do documento, categoria de DRE, parcelas e vínculos
-- ---------------------------------------------------------------------------
alter table public.financeiro_lancamentos
  add column if not exists data_emissao date null,
  add column if not exists numero_documento text null,
  add column if not exists dre_categoria_id uuid null references public.dre_categorias(id) on delete set null,
  add column if not exists grupo_parcelas uuid null,
  add column if not exists data_liquidacao date null,
  add column if not exists paciente_id uuid null references public.pacientes(id) on delete set null,
  add column if not exists profissional_id uuid null references public.usuarios(id) on delete set null,
  add column if not exists procedimento_id uuid null references public.procedimentos(id) on delete set null,
  add column if not exists agendamento_id uuid null references public.agendamentos(id) on delete set null;

create index if not exists financeiro_lancamentos_grupo_parcelas_idx
  on public.financeiro_lancamentos (grupo_parcelas) where grupo_parcelas is not null;
create index if not exists financeiro_lancamentos_paciente_idx
  on public.financeiro_lancamentos (paciente_id) where paciente_id is not null;
create index if not exists financeiro_lancamentos_profissional_idx
  on public.financeiro_lancamentos (profissional_id) where profissional_id is not null;
create index if not exists financeiro_lancamentos_agendamento_idx
  on public.financeiro_lancamentos (agendamento_id) where agendamento_id is not null;
create index if not exists financeiro_lancamentos_tipo_venc_idx
  on public.financeiro_lancamentos (tipo, vencimento);
create index if not exists financeiro_lancamentos_dre_categoria_idx
  on public.financeiro_lancamentos (dre_categoria_id) where dre_categoria_id is not null;

-- Lançamentos já pagos: a liquidação é a data do lançamento.
update public.financeiro_lancamentos
set data_liquidacao = (data_lancamento at time zone 'America/Sao_Paulo')::date
where data_liquidacao is null and lower(status) in ('pago', 'quitado', 'liquidado');

-- ---------------------------------------------------------------------------
-- Anexos de despesa (nota, cupom, recibo) — arquivo em Storage privado
-- ---------------------------------------------------------------------------
create table if not exists public.financeiro_anexos (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references public.financeiro_lancamentos(id) on delete cascade,
  nome text not null,
  tipo_documento text null,
  mime text not null,
  tamanho integer not null default 0,
  storage_path text not null,
  enviado_por uuid null references public.usuarios(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists financeiro_anexos_lancamento_idx on public.financeiro_anexos (lancamento_id);
alter table public.financeiro_anexos enable row level security;

do $$
begin
  if exists (select 1 from pg_catalog.pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_catalog.pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public)
    values ('financeiro-anexos', 'financeiro-anexos', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Permissões: recurso `cadastros` (admin/gestor/master) e gestor passa a
-- lançar recebimentos/despesas (itens 18 e 19 são do gestor).
-- ---------------------------------------------------------------------------
insert into public.recursos (codigo, descricao)
select 'cadastros', 'Cadastros editáveis (bancos, categorias de DRE, tipos de documento)'
where not exists (select 1 from public.recursos where codigo = 'cadastros');

insert into public.perfil_permissoes (perfil, recurso_id, acao)
select p.perfil::public.user_role, r.id, a.acao
from (values ('master'), ('admin'), ('gestor')) as p(perfil)
cross join (values ('read'), ('create'), ('update'), ('delete')) as a(acao)
join public.recursos r on r.codigo = 'cadastros'
where not exists (
  select 1 from public.perfil_permissoes x
  where x.perfil = p.perfil::public.user_role and x.recurso_id = r.id and x.acao = a.acao and x.unidade_id is null
);

insert into public.perfil_permissoes (perfil, recurso_id, acao)
select 'gestor'::public.user_role, r.id, a.acao
from (values ('create'), ('update')) as a(acao)
join public.recursos r on r.codigo = 'financeiro'
where not exists (
  select 1 from public.perfil_permissoes x
  where x.perfil = 'gestor'::public.user_role and x.recurso_id = r.id and x.acao = a.acao and x.unidade_id is null
);

-- Tabelas novas só são acessadas pela API (service_role).
revoke all on public.bancos, public.dre_categorias, public.financeiro_anexos from anon, authenticated;
