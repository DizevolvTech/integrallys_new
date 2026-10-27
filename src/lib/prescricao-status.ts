// Item 55: os dados trazem 'Ativo'/'Cancelado' (fluxo do especialista) e 'Ativa'/'Cancelada' (venda);
// a lista e os cards usam um conjunto único de status.
export type StatusPrescricao = 'Pendente' | 'Ativa' | 'Vencida' | 'Convertida' | 'Cancelada' | 'Rascunho' | 'Outro'

export function normalizarStatusPrescricao(status?: string | null): StatusPrescricao {
  const s = (status ?? '').trim().toLowerCase()
  if (s.startsWith('pendent')) return 'Pendente'
  if (s.startsWith('ativ')) return 'Ativa'
  if (s.startsWith('venc')) return 'Vencida'
  if (s.startsWith('convert') || s.startsWith('conclu') || s.startsWith('finaliz')) return 'Convertida'
  if (s.startsWith('cancel')) return 'Cancelada'
  if (s.startsWith('rascunho')) return 'Rascunho'
  return 'Outro'
}

export const FILTROS_STATUS_PRESCRICAO = ['Pendente', 'Ativa', 'Vencida', 'Convertida', 'Cancelada'] as const
