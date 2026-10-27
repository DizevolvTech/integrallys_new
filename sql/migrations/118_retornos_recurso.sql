-- 118_retornos_recurso.sql
-- Recurso de feature 'retornos' (página /retornos e API /api/retornos).
-- Espelha 082: idempotente (NOT EXISTS no recurso e nos grants).
--   master, admin, gestor, recepcao, especialista -> read, create
--   master, admin, gestor, recepcao               -> update
begin;

insert into public.recursos (codigo, descricao)
select 'retornos', 'Controle de retornos (prazo de retorno e retornos a agendar)'
where not exists (select 1 from public.recursos where codigo = 'retornos');

insert into public.perfil_permissoes (perfil, recurso_id, acao)
select g.perfil::public.user_role, r.id, g.acao
from public.recursos r
cross join (values
  ('master', 'read'), ('master', 'create'), ('master', 'update'),
  ('admin', 'read'), ('admin', 'create'), ('admin', 'update'),
  ('gestor', 'read'), ('gestor', 'create'), ('gestor', 'update'),
  ('recepcao', 'read'), ('recepcao', 'create'), ('recepcao', 'update'),
  ('especialista', 'read'), ('especialista', 'create')
) as g(perfil, acao)
where r.codigo = 'retornos'
  and not exists (
    select 1 from public.perfil_permissoes pp
    where pp.perfil = g.perfil::public.user_role
      and pp.recurso_id = r.id
      and pp.acao = g.acao
      and pp.unidade_id is null
  );

commit;
