import { describe, expect, it } from 'vitest'
import type { AnamneseData } from '@/contexts/atendimento-context'
import { camposPersonalizadosVisiveis, montarPayloadFinalizar } from './atendimento-finalizar-payload'

const base = (over: Partial<AnamneseData> = {}): AnamneseData => ({
  peso: '70,5', altura: '175', queixa: 'Dor', diagnostico: 'Dx', avaliacaoCliente: 'Melhor', resultados: 'R', indicacaoTratamento: 'I',
  historicos: new Set(['Tabagismo']), medicamentos: new Set(), condicoes: { 'historico:Tabagismo': '5 cigarros' },
  alergiasSim: true, alergiasTexto: 'Dipirona', medicamentosUsoSim: false, medicamentosUsoTexto: 'ignorado',
  camposPersonalizados: { peso_meta: '65,5', gestante: 'sim', obs: ' x ' }, camposAdicionais: [{ id: '1', label: ' Sono ', valor: ' ruim ' }, { id: '2', label: 'Vazio', valor: '' }],
  ...over,
})
const campos = [
  { id: 'alergias', label: 'Alergias', tipo: 'texto' as const },
  { id: 'medicamentos_uso', label: 'Medicamentos em uso', tipo: 'texto' as const },
  { id: 'peso_meta', label: 'Peso meta', tipo: 'numero' as const },
  { id: 'gestante', label: 'Gestante', tipo: 'booleano' as const },
  { id: 'obs', label: 'Obs', tipo: 'texto' as const },
]
const entrada = (tipo: 'consulta' | 'reconsulta', dados = base()) => ({
  tipo, dados, campos, historicosLista: ['Tabagismo', 'Etilismo'], medicamentosLista: ['Insulina'],
  evolucao: ' Evolução ', prescritos: [{ id: 'p1', nome: 'Prod', categoria: 'c', quantidade: 2, posologia: 'a\nb' }],
  observacoesGerais: '', observacoesFinais: 'fim', documentos: [{ tipo: 'laudo', categoria: 'Laudo', documento: 'texto' }],
})

describe('montarPayloadFinalizar', () => {
  it('consulta: fixos Sim/Não, personalizados tipados, sem duplicar alergias', () => {
    const p = montarPayloadFinalizar(entrada('consulta'))
    expect(p.anamnese.camposExtras).toMatchObject({
      alergias: 'Dipirona', medicamentos_uso: 'Não', peso_meta: 65.5, gestante: true, obs: 'x',
      campos_adicionais: [{ label: 'Sono', valor: 'ruim' }], diagnostico: 'Dx',
    })
    expect(p.anamnese.camposExtras.historicos_diarios).toEqual([
      { label: 'Tabagismo', resposta: 'Sim', detalhe: '5 cigarros' }, { label: 'Etilismo', resposta: 'Não', detalhe: '' },
    ])
    expect(p.anamnese.queixa).toBe('Dor')
    expect(p.prontuario.historicos).toEqual([{ label: 'Tabagismo', value: '5 cigarros' }])
    expect(p.prescricao.itens[0]).toEqual({ produtoId: 'p1', descricao: 'Prod', quantidade: 2, posologia: 'a\nb' })
    expect(p.documentos[0]).toEqual({ tipo: 'laudo', titulo: 'Laudo', texto: 'texto' })
  })
  it('Sim sem texto grava "Sim"', () => {
    const p = montarPayloadFinalizar(entrada('consulta', base({ medicamentosUsoSim: true, medicamentosUsoTexto: ' ' })))
    expect(p.anamnese.camposExtras.medicamentos_uso).toBe('Sim')
  })
  it('reconsulta usa avaliação como queixa e mantém personalizados com nome de fixo', () => {
    const p = montarPayloadFinalizar(entrada('reconsulta', base({ camposPersonalizados: { alergias: 'Nenhuma' } })))
    expect(p.anamnese.queixa).toBe('Melhor')
    expect(p.anamnese.camposExtras).toMatchObject({ alergias: 'Nenhuma', avaliacao_cliente: 'Melhor', resultados: 'R', indicacao_tratamento: 'I' })
    expect(p.anamnese.camposExtras.historicos_diarios).toBeUndefined()
  })
})

describe('camposPersonalizadosVisiveis', () => {
  it('esconde os que viraram fixos, por id ou rótulo', () => {
    const v = camposPersonalizadosVisiveis([...campos, { id: 'x', label: 'ALERGIAS ', tipo: 'texto' }], true)
    expect(v.map((c) => c.id)).toEqual(['peso_meta', 'gestante', 'obs'])
    expect(camposPersonalizadosVisiveis(campos, false)).toHaveLength(5)
  })
})
