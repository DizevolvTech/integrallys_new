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

export type ClassePrescricao = 'ativa' | 'vencida' | 'concluida' | 'outra'

/** Converte "dd/mm/aaaa" ou "aaaa-mm-dd" em "aaaa-mm-dd"; null quando vazio/inválido. */
export function validadeParaIso(validade?: string | null): string | null {
  const texto = (validade ?? '').trim()
  if (!texto || texto === '-') return null
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(texto)
  return iso ? iso[1] : null
}

/**
 * Regra única dos cards Ativas / Vencidas / Concluídas (Prescrição/Vendas e Relatórios):
 * - concluída: status Convertida;
 * - ativa: status Ativa com validade de hoje em diante (ou sem validade);
 * - vencida: status Vencida, ou Ativa/Pendente com validade anterior a hoje;
 * - canceladas e demais ficam fora dos cards. O valor é sempre o valor total do registro.
 */
export function classificarPrescricao(status: string | null | undefined, validade: string | null | undefined, hojeIso: string): ClassePrescricao {
  const normalizado = normalizarStatusPrescricao(status)
  if (normalizado === 'Convertida') return 'concluida'
  if (normalizado === 'Vencida') return 'vencida'
  if (normalizado !== 'Ativa' && normalizado !== 'Pendente') return 'outra'
  const iso = validadeParaIso(validade)
  if (iso && iso < hojeIso) return 'vencida'
  return normalizado === 'Ativa' ? 'ativa' : 'outra'
}
