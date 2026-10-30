import { addDaysIso, diffDiasCivis, parseLocalDate } from '@/lib/procedimento-retorno'

export const PRAZOS_RETORNO = [
  { id: '30', label: '30 dias' },
  { id: '60', label: '60 dias' },
  { id: '90', label: '90 dias' },
  { id: '120', label: '120 dias' },
  { id: '6m', label: '6 meses' },
  { id: 'liberado', label: 'Liberado' },
  { id: 'custom', label: 'Personalizado' },
] as const

export type PrazoRetornoTipo = (typeof PRAZOS_RETORNO)[number]['id']

export const PRAZO_TIPOS_VALIDOS: readonly string[] = PRAZOS_RETORNO.map((p) => p.id)

export type SituacaoRetorno = 'no_prazo' | 'limite' | 'vencido' | 'sem_prazo'
/** Situações dos cards clicáveis do topo (retorno sem prazo não entra neles). */
export const SITUACOES_RETORNO = ['no_prazo', 'limite', 'vencido'] as const satisfies readonly SituacaoRetorno[]
/** Situações aceitas no filtro da lista (inclui "Sem prazo"). */
export const SITUACOES_RETORNO_FILTRO: readonly SituacaoRetorno[] = [...SITUACOES_RETORNO, 'sem_prazo']

/** Dias de antecedência (antes do vencimento) em que o retorno entra em "limite". */
export const DIAS_LIMITE_RETORNO = 10

function addMonthsIso(isoDate: string, months: number): string | null {
  const date = parseLocalDate(isoDate)
  if (!date) return null
  const dia = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const ultimoDia = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(dia, ultimoDia))
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type PrazoCalculado =
  | { ok: true; dataPrevista: string | null; prazoDias: number | null }
  | { ok: false; message: string }

/** Data prevista do retorno a partir da data do atendimento. `liberado` não tem data. */
export function calcularPrazoRetorno(
  tipo: string,
  dataBaseIso: string,
  diasCustom?: number | null,
): PrazoCalculado {
  if (!PRAZO_TIPOS_VALIDOS.includes(tipo)) return { ok: false, message: 'Prazo de retorno inválido.' }
  if (!parseLocalDate(dataBaseIso)) return { ok: false, message: 'Data do atendimento inválida.' }
  if (tipo === 'liberado') return { ok: true, dataPrevista: null, prazoDias: null }
  if (tipo === '6m') return { ok: true, dataPrevista: addMonthsIso(dataBaseIso, 6), prazoDias: null }
  const dias =
    tipo === 'custom' ? Number(diasCustom) : Number(tipo)
  if (!Number.isInteger(dias) || dias <= 0 || dias > 3650) {
    return { ok: false, message: 'Informe um prazo válido em dias.' }
  }
  return { ok: true, dataPrevista: addDaysIso(dataBaseIso, dias), prazoDias: dias }
}

export function rotuloPrazoRetorno(tipo: string, dias: number | null): string {
  if (tipo === 'custom') return dias ? `${dias} dias` : 'Personalizado'
  if (tipo === 'sem_prazo') return 'Sem prazo definido'
  return PRAZOS_RETORNO.find((p) => p.id === tipo)?.label ?? tipo
}

export const ROTULO_SITUACAO_RETORNO: Record<SituacaoRetorno, string> = {
  no_prazo: 'No prazo',
  limite: 'Limite',
  vencido: 'Vencido',
  sem_prazo: 'Sem prazo',
}

export type UnidadePrazoRetorno = 'dias' | 'semanas' | 'meses'
export const UNIDADES_PRAZO_RETORNO: readonly UnidadePrazoRetorno[] = ['dias', 'semanas', 'meses']

export type DefinicaoPrazo =
  | { modo: 'data'; data: string }
  | { modo: 'em'; quantidade: number; unidade: UnidadePrazoRetorno }

export type PrazoDefinido =
  | { ok: true; dataPrevista: string; prazoTipo: 'custom'; prazoDias: number | null }
  | { ok: false; message: string }

/** Data prevista ao definir/editar o prazo de um retorno em aberto (a contagem "em N …" parte de `hojeIso`). */
export function resolverPrazoDefinido(
  definicao: DefinicaoPrazo,
  hojeIso: string,
  dataBaseIso: string,
): PrazoDefinido {
  let dataPrevista: string | null
  if (definicao.modo === 'data') {
    dataPrevista = parseLocalDate(definicao.data) ? definicao.data : null
    if (!dataPrevista) return { ok: false, message: 'Informe uma data válida.' }
  } else {
    const { quantidade, unidade } = definicao
    if (!Number.isInteger(quantidade) || quantidade <= 0 || quantidade > 120) {
      return { ok: false, message: 'Informe uma quantidade válida.' }
    }
    if (!UNIDADES_PRAZO_RETORNO.includes(unidade)) return { ok: false, message: 'Unidade de prazo inválida.' }
    dataPrevista =
      unidade === 'meses'
        ? addMonthsIso(hojeIso, quantidade)
        : addDaysIso(hojeIso, unidade === 'semanas' ? quantidade * 7 : quantidade)
    if (!dataPrevista) return { ok: false, message: 'Data de hoje inválida.' }
  }
  const dias = diffDiasCivis(dataBaseIso, dataPrevista)
  return { ok: true, dataPrevista, prazoTipo: 'custom', prazoDias: dias !== null && dias > 0 ? dias : null }
}
