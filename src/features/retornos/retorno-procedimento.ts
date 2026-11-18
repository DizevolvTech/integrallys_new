import type { PrazoRetornoValor } from './prazo-retorno-selector'

interface ProcedimentoNome {
  id: string
  nome: string
}

/** Minúsculas, sem acento e sem espaços repetidos: "Bioressonância" e "Bioressonancia" são o mesmo nome. */
function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const PREFIXO_RETORNO = /^retorno de /

export function ehProcedimentoRetorno(nome: string | null | undefined): boolean {
  return PREFIXO_RETORNO.test(normalizarNome(nome ?? ''))
}

/** O agendamento é um retorno (tipo "retorno" ou procedimento "Retorno de X")? */
export function agendamentoEhRetorno(item: { tipo?: string | null; procedimento?: string | null }): boolean {
  return normalizarNome(item.tipo ?? '') === 'retorno' || ehProcedimentoRetorno(item.procedimento)
}

/** Valor inicial do "Tipo de Anamnese" ao iniciar o atendimento. */
export function anamneseInicialDoAgendamento(item: {
  tipo?: string | null
  procedimento?: string | null
}): 'consulta' | 'reconsulta' {
  return agendamentoEhRetorno(item) ? 'reconsulta' : 'consulta'
}

/** Retorno em até 30 dias (inclusive) continua acompanhamento; "Liberado" e prazos maiores viram consulta nova. */
export function prazoDentroDe30Dias(valor: PrazoRetornoValor): boolean {
  if (valor.tipo === 'custom') {
    const dias = Number(valor.customDias)
    return Number.isInteger(dias) && dias > 0 && dias <= 30
  }
  return valor.tipo === '30'
}

/**
 * Procedimento sugerido para o retorno, pelo par de nomes "Retorno de X" <-> "X".
 * Até 30 dias: "Retorno de X"; acima disso: "X". Sem par cadastrado devolve null (mantém o atual).
 */
export function procedimentoRetornoSugerido(params: {
  origemId: string | null | undefined
  procedimentos: ProcedimentoNome[]
  dentroDe30Dias: boolean
}): string | null {
  const origem = params.procedimentos.find((p) => p.id === params.origemId)
  if (!origem) return null
  const nome = normalizarNome(origem.nome)
  const base = nome.replace(PREFIXO_RETORNO, '')
  const alvo = params.dentroDe30Dias ? `retorno de ${base}` : base
  return params.procedimentos.find((p) => normalizarNome(p.nome) === alvo)?.id ?? null
}
