import type { AnamneseData, GeneratedDoc, ItemPrescrito } from '@/contexts/atendimento-context'

export interface CampoPersonalizadoDef {
  id: string
  label: string
  tipo: 'texto' | 'numero' | 'booleano'
}

/** Campos fixos do atendimento (Sim/Não + texto) que substituem os personalizados de mesmo nome. */
export const CAMPOS_FIXOS_ANAMNESE = [
  { id: 'alergias', label: 'Alergias' },
  { id: 'medicamentos_uso', label: 'Medicamentos em uso' },
] as const

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/** Personalizados que ainda precisam aparecer: some o que já é fixo (mesmo id ou rótulo). */
export function camposPersonalizadosVisiveis(campos: CampoPersonalizadoDef[], fixosVisiveis: boolean) {
  if (!fixosVisiveis) return campos
  return campos.filter(
    (campo) =>
      !CAMPOS_FIXOS_ANAMNESE.some(
        (fixo) => normalizar(fixo.id) === normalizar(campo.id) || normalizar(fixo.label) === normalizar(campo.label),
      ),
  )
}

function textoDoFixo(sim: boolean, texto: string) {
  return sim ? texto.trim() || 'Sim' : 'Não'
}

function numeroOuNulo(raw: string) {
  const n = Number(raw.replace(',', '.'))
  return raw.trim() !== '' && Number.isFinite(n) ? n : null
}

function respostasDoGrupo(itens: string[], marcados: Set<string>, prefixo: 'historico' | 'medicamento', condicoes: Record<string, string>) {
  return itens.map((label) => {
    const sim = marcados.has(label)
    return { label, resposta: sim ? 'Sim' : 'Não', detalhe: sim ? (condicoes[`${prefixo}:${label}`] ?? '').trim() : '' }
  })
}

export interface MontarAnamneseEntrada {
  tipo: 'consulta' | 'reconsulta'
  dados: AnamneseData
  campos: CampoPersonalizadoDef[]
  historicosLista: string[]
  medicamentosLista: string[]
}

export function montarCamposExtras({ tipo, dados, campos, historicosLista, medicamentosLista }: MontarAnamneseEntrada) {
  const extras: Record<string, unknown> = {}
  const consulta = tipo === 'consulta'

  const personalizados: { label: string; valor: string }[] = []
  for (const campo of camposPersonalizadosVisiveis(campos, consulta)) {
    const raw = (dados.camposPersonalizados[campo.id] ?? '').trim()
    if (campo.tipo === 'numero') {
      const n = numeroOuNulo(raw)
      if (n != null) {
        extras[campo.id] = n
        personalizados.push({ label: campo.label, valor: String(n) })
      }
    } else if (campo.tipo === 'booleano') {
      if (raw) {
        extras[campo.id] = raw === 'sim'
        personalizados.push({ label: campo.label, valor: raw === 'sim' ? 'Sim' : 'Não' })
      }
    } else if (raw) {
      extras[campo.id] = raw
      personalizados.push({ label: campo.label, valor: raw })
    }
  }
  // Rótulos junto dos valores: a visualização da anamnese não precisa reler o cadastro dos campos.
  if (personalizados.length) extras.campos_personalizados = personalizados

  const adicionais = dados.camposAdicionais
    .map((c) => ({ label: c.label.trim(), valor: c.valor.trim() }))
    .filter((c) => c.label && c.valor)
  if (adicionais.length) extras.campos_adicionais = adicionais

  if (consulta) {
    extras.alergias = textoDoFixo(dados.alergiasSim, dados.alergiasTexto)
    extras.medicamentos_uso = textoDoFixo(dados.medicamentosUsoSim, dados.medicamentosUsoTexto)
    extras.historicos_diarios = respostasDoGrupo(historicosLista, dados.historicos, 'historico', dados.condicoes)
    extras.medicamentos_lista = respostasDoGrupo(medicamentosLista, dados.medicamentos, 'medicamento', dados.condicoes)
    if (dados.diagnostico.trim()) extras.diagnostico = dados.diagnostico.trim()
  } else {
    if (dados.avaliacaoCliente.trim()) extras.avaliacao_cliente = dados.avaliacaoCliente.trim()
    if (dados.resultados.trim()) extras.resultados = dados.resultados.trim()
    if (dados.indicacaoTratamento.trim()) extras.indicacao_tratamento = dados.indicacaoTratamento.trim()
  }
  return extras
}

export interface FinalizarEntrada extends MontarAnamneseEntrada {
  evolucao: string
  prescritos: ItemPrescrito[]
  observacoesGerais: string
  observacoesFinais: string
  documentos: GeneratedDoc[]
}

export function montarPayloadFinalizar(entrada: FinalizarEntrada) {
  const { tipo, dados } = entrada
  const consulta = tipo === 'consulta'
  const camposExtras = montarCamposExtras(entrada)
  const respondidos = [
    ...((camposExtras.historicos_diarios as { label: string; resposta: string; detalhe: string }[] | undefined) ?? []),
    ...((camposExtras.medicamentos_lista as { label: string; resposta: string; detalhe: string }[] | undefined) ?? []),
  ].filter((r) => r.resposta === 'Sim')

  return {
    anamnese: {
      tipo,
      queixa: consulta ? dados.queixa.trim() : dados.avaliacaoCliente.trim(),
      peso: dados.peso,
      altura: dados.altura,
      camposExtras,
    },
    evolucao: entrada.evolucao.trim(),
    prontuario: {
      anotacoes: entrada.evolucao.trim(),
      diagnose: consulta ? dados.diagnostico.trim() : '',
      plano: consulta ? '' : dados.indicacaoTratamento.trim(),
      historicos: respondidos.map((r) => ({ label: r.label, value: r.detalhe || 'Sim' })),
      observacoesFinais: entrada.observacoesFinais.trim(),
    },
    prescricao: {
      observacoes: entrada.observacoesGerais.trim(),
      itens: entrada.prescritos.map((p) => ({
        produtoId: p.id,
        descricao: p.nome,
        quantidade: p.quantidade,
        posologia: p.posologia,
      })),
    },
    documentos: entrada.documentos.map((d) => ({ tipo: d.tipo, titulo: d.categoria, texto: d.documento })),
  }
}

export type PayloadFinalizar = ReturnType<typeof montarPayloadFinalizar>
