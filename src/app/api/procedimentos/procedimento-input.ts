// Lógica pura (testável) do cadastro de Procedimentos — Item 8 + pacote/retorno call 09/09.

export const PRAZO_RETORNO_PADRAO_DIAS = 35

export interface ProcedimentoPayload {
  nome: string
  codigo: string | null
  descricao: string | null
  valor: number | null
  duracao_min: number | null
  tem_retorno: boolean
  prazo_retorno_dias: number | null
  valor_retorno: number | null
  tem_pacote: boolean
  intervalo_recorrencia_dias: number | null
  quantidade_sugerida_pacote: number | null
  ativo: boolean
}

export function generateCodigo(): string {
  return `PROC-${Date.now().toString().slice(-8)}`
}

export function parseNumeric(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseInteger(value: unknown): number | null {
  const parsed = parseNumeric(value)
  return parsed == null ? null : Math.trunc(parsed)
}

export function buildProcedimentoPayload(
  body: Record<string, unknown>,
  opts: { autoCodigo: boolean },
): ProcedimentoPayload {
  const codigoInformado = body.codigo ? String(body.codigo).trim() : ''
  const temRetorno = body.temRetorno === true
  const temPacote = body.temPacote === true

  const prazoInformado = parseInteger(body.prazoRetornoDias)
  const prazoRetorno =
    temRetorno ? (prazoInformado != null && prazoInformado > 0 ? prazoInformado : PRAZO_RETORNO_PADRAO_DIAS) : null

  return {
    nome: String(body.nome),
    codigo: codigoInformado || (opts.autoCodigo ? generateCodigo() : null),
    descricao: body.descricao ? String(body.descricao) : null,
    valor: parseNumeric(body.valor),
    duracao_min: parseInteger(body.duracaoMin),
    tem_retorno: temRetorno,
    prazo_retorno_dias: prazoRetorno,
    valor_retorno: temRetorno ? parseNumeric(body.valorRetorno) : null,
    tem_pacote: temPacote,
    intervalo_recorrencia_dias: temPacote ? parseInteger(body.intervaloRecorrenciaDias) : null,
    quantidade_sugerida_pacote: temPacote ? parseInteger(body.quantidadeSugeridaPacote) : null,
    ativo: body.ativo !== false,
  }
}
