-- 103_onda0_acessos_call_0909.sql
-- Onda 0 · Call 09/09 — "Acesso negado" em fluxos básicos:
--   1) Recepção deve cadastrar produto (estoque:create)
--   2) Gestor deve criar/editar usuários e resetar senha em /usuarios
--      (profissionais já tem create/update via 079; Usuários usava só read)
--
-- Idempotente (mesmo padrão de 094 / 049).

with novas (perfil, recurso, acao) as (
  values
    ('recepcao'::public.user_role, 'estoque', 'create'),
    ('recepcao'::public.user_role, 'estoque', 'update'),
    ('gestor'::public.user_role, 'usuarios', 'create'),
    ('gestor'::public.user_role, 'usuarios', 'update'),
    -- Garante gestor estoque:create mesmo se 094 não tiver sido aplicada
    ('gestor'::public.user_role, 'estoque', 'create')
),
expandido as (
  select n.perfil, r.id as recurso_id, n.acao
  from novas n
  join public.recursos r on r.codigo = n.recurso
)
insert into public.perfil_permissoes (perfil, recurso_id, acao)
select e.perfil, e.recurso_id, e.acao
from expandido e
where not exists (
  select 1
  from public.perfil_permissoes pp
  where pp.perfil = e.perfil
    and pp.recurso_id = e.recurso_id
    and pp.acao = e.acao
);

comment on table public.perfil_permissoes is
  'Permissões por perfil. Onda 0 (103): recepção estoque create/update; gestor usuarios create/update.';
