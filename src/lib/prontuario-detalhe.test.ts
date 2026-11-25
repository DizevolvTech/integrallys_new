import { describe, expect, it } from 'vitest'
import { mapProntuarioItem } from '@/lib/domain-mappers'

describe('mapProntuarioItem detalhe (#1645)', () => {
  it('traz queixa, diagnose, observações e histórico gravados no atendimento', () => {
    const item = mapProntuarioItem({
      id: 'p1',
      data_registro: '2026-11-25',
      anamnese_queixa: 'teste',
      anamnese_extras: { alergias: 'Não', medicamentos_uso: 'Não' },
      conteudo: {
        diagnose: 'teste',
        anotacoes: 'teste teste teste',
        observacoesFinais: 'teste teste',
        historicos: [{ label: 'Pratica atividade física', value: 'musculação' }],
      },
    })
    expect(item.detalhe).toMatchObject({
      queixa: 'teste',
      diagnostico: 'teste',
      observacoes: 'teste teste teste\n\nteste teste',
      alergias: 'Não',
      historicos: [{ label: 'Pratica atividade física', value: 'musculação' }],
    })
  })

  it('usa o diagnóstico da anamnese se o prontuário não tem e esconde "Não informada"', () => {
    const item = mapProntuarioItem({
      id: 'p2',
      anamnese_queixa: 'Não informada',
      anamnese_extras: { diagnostico: 'TESTE' },
      conteudo: { anotacoes: 'igual', observacoesFinais: 'igual' },
    })
    expect(item.detalhe.queixa).toBe('')
    expect(item.detalhe.diagnostico).toBe('TESTE')
    expect(item.detalhe.observacoes).toBe('igual')
  })

  it('prontuário criado à mão (sem conteúdo) fica com tudo vazio', () => {
    const item = mapProntuarioItem({ id: 'p3' })
    expect(item.detalhe).toMatchObject({ queixa: '', diagnostico: '', observacoes: '', historicos: [] })
  })
})
