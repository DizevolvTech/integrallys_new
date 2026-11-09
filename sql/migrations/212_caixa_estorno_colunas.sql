-- 212: base do estorno de movimentacao do Caixa (cartao #441, video v04: "Estornar" nao fazia nada).
-- Aditiva e idempotente:
--  * caixa_movimentos.prescricao_id: liga a venda de prescricao a sua prescricao (backfill pelo numero na descricao);
--  * caixa_movimentos.estornado_em/estorno_motivo/estorno_por: marca a movimentacao original como "Estornada";
--  * indice unico em estorno_de_id: uma movimentacao so pode ter UM estorno (protecao no banco);
--  * gatilho: toda saida/entrada de estorno (inclusive a da migracao 160) marca a original como estornada.

alter table public.caixa_movimentos
  add column if not exists prescricao_id uuid references public.prescricoes(id) on delete set null,
  add column if not exists estornado_em timestamptz,
  add column if not exists estorno_motivo text,
  add column if not exists estorno_por uuid references public.usuarios(id) on delete set null;

create index if not exists caixa_movimentos_prescricao_idx
  on public.caixa_movimentos (prescricao_id) where prescricao_id is not null;

-- Backfill: "Venda PRESC-1234 - Nome (Forma)" -> numero PRESC-1234 (numero e unico em prescricoes).
update public.caixa_movimentos cm
   set prescricao_id = p.id
  from public.prescricoes p
 where cm.origem = 'prescricao'
   and cm.prescricao_id is null
   and p.numero = substring(cm.descricao from '^Venda\s+(\S+)\s+-\s');

create or replace function public.caixa_movimento_marcar_estornado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estorno_de_id is not null then
    update public.caixa_movimentos
       set estornado_em = coalesce(estornado_em, new.data_movimento),
           estorno_por = coalesce(estorno_por, new.usuario_id)
     where id = new.estorno_de_id and estornado_em is null;
  end if;
  return new;
end;
$$;

drop trigger if exists caixa_movimentos_marcar_estornado on public.caixa_movimentos;
create trigger caixa_movimentos_marcar_estornado
  after insert on public.caixa_movimentos
  for each row when (new.estorno_de_id is not null)
  execute function public.caixa_movimento_marcar_estornado();

-- Estornos ja existentes (migracao 160): marca as originais.
update public.caixa_movimentos o
   set estornado_em = e.data_movimento,
       estorno_por = coalesce(o.estorno_por, e.usuario_id)
  from public.caixa_movimentos e
 where e.estorno_de_id = o.id and o.estornado_em is null;

-- Um estorno por movimentacao. So cria o indice se nao houver duplicidade antiga.
do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'caixa_movimentos_estorno_unico_idx') then
    return;
  end if;
  if exists (select 1 from public.caixa_movimentos where estorno_de_id is not null group by estorno_de_id having count(*) > 1) then
    raise notice 'caixa_movimentos_estorno_unico_idx nao criado: ha movimentacoes com mais de um estorno';
  else
    create unique index caixa_movimentos_estorno_unico_idx
      on public.caixa_movimentos (estorno_de_id) where estorno_de_id is not null;
  end if;
end $$;
