import { describe, expect, it } from 'vitest'
import { lerRascunho, serializarRascunho, type RascunhoAtendimento } from './atendimento-rascunho'
import type { AnamneseData } from './atendimento-context'

const padrao = {
  peso: '', altura: '', queixa: '', diagnostico: '', avaliacaoCliente: '', resultados: '', indicacaoTratamento: '',
  historicos: new Set<string>(), medicamentos: new Set<string>(), condicoes: {},
  alergiasSim: false, alergiasTexto: '', medicamentosUsoSim: false, medicamentosUsoTexto: '',
  camposPersonalizados: {}, camposAdicionais: [],
} as AnamneseData

describe('rascunho do atendimento', () => {
  it('ida e volta preserva anamnese (com Sets), evolucao e prescricao', () => {
    const r: RascunhoAtendimento = {
      currentStep: 3,
      anamneseType: 'reconsulta',
      anamneseData: { ...padrao, queixa: 'dor', historicos: new Set(['diabetes']), alergiasSim: true, alergiasTexto: 'Penicilina' },
      evolucaoAtual: 'melhora',
      prescritos: [{ id: 'p1', nome: 'Magnésio', categoria: 'Suplemento', quantidade: 2, posologia: '1 cap. 08:00\n1 cap. 18:00' }],
      observacoesGerais: 'obs',
      observacoesFinais: 'fim',
    }
    const lido = lerRascunho(serializarRascunho(r), padrao)
    expect(lido?.currentStep).toBe(3)
    expect(lido?.anamneseType).toBe('reconsulta')
    expect(lido?.anamneseData.historicos.has('diabetes')).toBe(true)
    expect(lido?.anamneseData.alergiasTexto).toBe('Penicilina')
    expect(lido?.prescritos[0].posologia).toBe('1 cap. 08:00\n1 cap. 18:00')
    expect(lido?.evolucaoAtual).toBe('melhora')
  })

  it('ignora rascunho invalido ou de outra versao', () => {
    expect(lerRascunho('nao-json', padrao)).toBeNull()
    expect(lerRascunho(JSON.stringify({ v: 99 }), padrao)).toBeNull()
    expect(lerRascunho(null, padrao)).toBeNull()
  })
})
