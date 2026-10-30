-- D4 W6 (vídeo v11): saída manual pode vincular um colaborador (usuário do sistema) e o consumo
-- interno aceita "Outros" (texto livre com quem e por quê). Só amplia os valores aceitos em
-- movimentacoes_estoque.vinculo_tipo; dados existentes continuam válidos. Idempotente.
alter table public.movimentacoes_estoque
  drop constraint if exists movimentacoes_estoque_vinculo_tipo_check;

alter table public.movimentacoes_estoque
  add constraint movimentacoes_estoque_vinculo_tipo_check
  check (vinculo_tipo is null or vinculo_tipo in ('cliente', 'especialista', 'fornecedor', 'colaborador', 'outro'));
