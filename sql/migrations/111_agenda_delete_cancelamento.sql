-- 111_agenda_delete_cancelamento.sql
-- Desmarcar/cancelar consulta chama DELETE /api/agenda, que exige agenda.delete.
-- Só o master tinha essa ação, então recepção e gestor recebiam "Acesso negado".
-- Concede agenda.delete a recepcao, gestor e admin. Idempotente.
insert into public.perfil_permissoes (perfil, recurso_id, acao)
select v.perfil::public.user_role, r.id, 'delete'
from (values ('recepcao'), ('gestor'), ('admin')) as v(perfil)
join public.recursos r on r.codigo = 'agenda'
where not exists (
  select 1
  from public.perfil_permissoes pp
  where pp.perfil = v.perfil::public.user_role
    and pp.recurso_id = r.id
    and pp.acao = 'delete'
    and pp.unidade_id is null
);
