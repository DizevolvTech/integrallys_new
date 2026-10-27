-- 125_documento_tipos.sql
-- D3 W3 (item 25): tipos de documento (atestado, laudo, encaminhamento...) com cadastro
-- próprio. `base` é o tipo de renderização já aceito por documento_templates.tipo; o modelo
-- de documento passa a apontar para o tipo cadastrado (tipo_documento_id). Aditiva e idempotente.

create table if not exists public.documento_tipos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  base text not null default 'declaracao'
    check (base in ('formulario', 'declaracao', 'laudo', 'encaminhamento', 'procedimento', 'dieta', 'contrato')),
  ordem integer not null default 100,
  ativo boolean not null default true,
  sistema boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists documento_tipos_nome_idx on public.documento_tipos (lower(nome));
alter table public.documento_tipos enable row level security;
revoke all on public.documento_tipos from anon, authenticated;

insert into public.documento_tipos (nome, base, ordem, sistema) values
  ('Atestado', 'declaracao', 10, true),
  ('Declaração', 'declaracao', 20, true),
  ('Laudo', 'laudo', 30, true),
  ('Encaminhamento', 'encaminhamento', 40, true),
  ('Formulário', 'formulario', 50, true),
  ('Procedimento', 'procedimento', 60, true),
  ('Dieta', 'dieta', 70, true),
  ('Contrato', 'contrato', 80, true)
on conflict do nothing;

alter table public.documento_templates
  add column if not exists tipo_documento_id uuid null references public.documento_tipos(id) on delete set null;
create index if not exists documento_templates_tipo_documento_idx on public.documento_templates (tipo_documento_id);
