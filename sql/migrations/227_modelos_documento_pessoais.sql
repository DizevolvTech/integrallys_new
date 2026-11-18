-- 227_modelos_documento_pessoais.sql
-- #1073 W3: "Salvar modelo" no atendimento grava o modelo PESSOAL do especialista (um por slug),
-- sem tocar no modelo da clínica (Configurações > Templates e documentos). "Restaurar padrão" apaga
-- o pessoal e volta ao modelo da clínica. Acesso só pela API (service role); RLS ligada sem policy.
create table if not exists public.documento_modelos_pessoais (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  slug text not null,
  conteudo jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint documento_modelos_pessoais_usuario_slug_key unique (usuario_id, slug)
);

alter table public.documento_modelos_pessoais enable row level security;
revoke all on public.documento_modelos_pessoais from anon, authenticated;

drop trigger if exists documento_modelos_pessoais_set_updated_at on public.documento_modelos_pessoais;
create trigger documento_modelos_pessoais_set_updated_at
  before update on public.documento_modelos_pessoais
  for each row execute function set_updated_at();

-- Conserto: o antigo "Salvar modelo" do atendimento gravava {"corpo": "<json do modelo>"} por cima do
-- modelo da clínica (dieta/encaminhamento), quebrando o cadastro do gestor. Desembrulha o JSON de volta
-- para a estrutura (cabecalho/secoes/rodape). Só mexe em linha cujo "corpo" é um modelo válido; idempotente.
update public.documento_templates t
   set conteudo = (t.conteudo ->> 'corpo')::jsonb
 where jsonb_typeof(t.conteudo -> 'corpo') = 'string'
   and (t.conteudo ->> 'corpo') like '{%'
   and ((t.conteudo ->> 'corpo')::jsonb) ? 'secoes'
   and ((t.conteudo ->> 'corpo')::jsonb) ? 'cabecalho';
