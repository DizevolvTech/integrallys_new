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
 * - ativa: status Ativa ou Pendente (orçamento ainda não fechado) com validade de hoje em diante (ou sem validade);
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
  return 'ativa'
}

export type TomStatusPrescricao = 'ativa' | 'vencida' | 'concluida' | 'cancelada' | 'neutro'

/**
 * Rótulo e cor do status na lista, nos cards e no filtro: Ativa verde, Vencida amarela,
 * Convertida (Concluída) azul, Cancelada vermelha. Ativa/Pendente com validade passada aparece como Vencida.
 */
export function statusExibicaoPrescricao(
  status: string | null | undefined,
  validade: string | null | undefined,
  hojeIso: string,
): { rotulo: string; tom: TomStatusPrescricao } {
  const normalizado = normalizarStatusPrescricao(status)
  const classe = classificarPrescricao(status, validade, hojeIso)
  if (classe === 'vencida') return { rotulo: 'Vencida', tom: 'vencida' }
  if (classe === 'concluida') return { rotulo: 'Convertida', tom: 'concluida' }
  if (classe === 'ativa') return { rotulo: normalizado === 'Pendente' ? 'Pendente' : 'Ativa', tom: 'ativa' }
  if (normalizado === 'Cancelada') return { rotulo: 'Cancelada', tom: 'cancelada' }
  return { rotulo: status ?? '-', tom: 'neutro' }
}

/** Classes de cor (claro/escuro) de cada tom, para selo, ponto do filtro e cards. */
export const CLASSE_TOM_STATUS: Record<TomStatusPrescricao, string> = {
  ativa: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
  vencida: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300',
  concluida: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300',
  cancelada: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300',
  neutro: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
}
