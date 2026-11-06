-- 206_estoque_movimentos_paciente.sql
-- #389 X3: coluna "Paciente" em Estoque > Movimentos. A saida por venda/conversao de prescricao
-- grava "... prescrição <numero>" em observacoes (src/app/api/prescricoes/route.ts); esta view liga
-- o movimento ao paciente da prescricao pelo numero (unico), inclusive para os movimentos antigos.
-- Movimento sem prescricao ligada nao aparece aqui (a tela mostra "—"). Aditiva e idempotente.
create or replace view public.movimentacoes_estoque_paciente as
select m.id as movimentacao_id,
       p.id as prescricao_id,
       p.numero as prescricao_numero,
       pa.id as paciente_id,
       pa.nome as paciente_nome
from public.movimentacoes_estoque m
join public.prescricoes p
  on p.numero = substring(m.observacoes from 'prescri[çc][ãa]o[[:space:]]+([^[:space:]]+)[[:space:]]*$')
join public.pacientes pa on pa.id = p.paciente_id
where m.observacoes is not null;
