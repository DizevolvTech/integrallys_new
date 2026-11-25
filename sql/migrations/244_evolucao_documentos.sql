-- 244 (#1645): documentos ligados a uma evolucao (lista ao clicar em DOCS + "Documento enviado").
-- O arquivo continua no bucket privado exames-pacientes (paciente_exames); aqui fica o vinculo e os dados do envio.
-- Aditiva e idempotente. A coluna evolucoes.docs_count segue como contagem dos registros antigos sem arquivo.

create table if not exists public.evolucao_documentos (
  id uuid primary key default gen_random_uuid(),
  evolucao_id uuid not null references public.evolucoes(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  exame_id uuid references public.paciente_exames(id) on delete set null,
  nome text not null,
  tipo text,
  meio text,
  data_envio date,
  recebido boolean not null default false,
  link text,
  observacoes text,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists evolucao_documentos_evolucao_idx on public.evolucao_documentos (evolucao_id, created_at desc);
create index if not exists evolucao_documentos_paciente_idx on public.evolucao_documentos (paciente_id);
alter table public.evolucao_documentos enable row level security;
