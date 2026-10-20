/** Valores gravados no banco (enum) e rótulos mostrados ao usuário. "Em andamento" = "Fazendo". */
export const TAREFA_STATUS_VALUES = ['Pendente', 'Em andamento', 'Concluída', 'Cancelada'] as const

export function tarefaStatusLabel(status: string): string {
  return status === 'Em andamento' ? 'Fazendo' : status
}

export function validarCancelamento(status: unknown, motivo: unknown): string | null {
  if (status !== 'Cancelada') return null
  return typeof motivo === 'string' && motivo.trim().length > 0
    ? null
    : 'Informe o motivo do cancelamento.'
}
