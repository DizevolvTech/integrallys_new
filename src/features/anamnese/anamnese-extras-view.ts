export interface RespostaAtendimento {
  label: string
  resposta: string
  detalhe: string
}

export interface ParRotuloValor {
  label: string
  valor: string
}

export interface ExtrasLegiveis {
  alergias: string
  medicamentosUso: string
  respostas: RespostaAtendimento[]
  textos: ParRotuloValor[]
  personalizados: ParRotuloValor[]
}

function lista<T>(valor: unknown, ok: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(valor)) return []
  return valor
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(ok)
    .filter((item): item is T => item !== null)
}

const texto = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '')

/** Lê campos_extras da anamnese (gravado pelo atendimento ou pela tela Anamnese) para a visualização. */
export function extrasLegiveis(extras: Record<string, unknown> | undefined): ExtrasLegiveis {
  const e = extras ?? {}
  const textos: ParRotuloValor[] = [
    ['Diagnóstico', e.diagnostico],
    ['Avaliação do cliente', e.avaliacao_cliente],
    ['Resultados', e.resultados],
    ['Indicação para os próximos tratamentos', e.indicacao_tratamento],
  ]
    .map(([label, valor]) => ({ label: String(label), valor: texto(valor) }))
    .filter((t) => t.valor)

  const respostas = [
    ...lista(e.historicos_diarios, respostaDe),
    ...lista(e.medicamentos_lista, respostaDe),
  ]
  const personalizados = [
    ...lista(e.campos_personalizados, parDe),
    ...lista(e.campos_adicionais, parDe),
  ]
  return { alergias: texto(e.alergias), medicamentosUso: texto(e.medicamentos_uso), respostas, textos, personalizados }
}

function respostaDe(item: Record<string, unknown>): RespostaAtendimento | null {
  const label = texto(item.label)
  return label ? { label, resposta: texto(item.resposta), detalhe: texto(item.detalhe) } : null
}

function parDe(item: Record<string, unknown>): ParRotuloValor | null {
  const label = texto(item.label)
  return label ? { label, valor: texto(item.valor) } : null
}
