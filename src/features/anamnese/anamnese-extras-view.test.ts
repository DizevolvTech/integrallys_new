import { describe, expect, it } from 'vitest'
import { extrasLegiveis } from './anamnese-extras-view'

describe('extrasLegiveis', () => {
  it('lê o que o atendimento grava', () => {
    const r = extrasLegiveis({
      alergias: 'Dipirona', medicamentos_uso: 'Não', diagnostico: 'Dx',
      historicos_diarios: [{ label: 'Tabagismo', resposta: 'Sim', detalhe: '5/dia' }, { bad: true }],
      campos_personalizados: [{ label: 'Peso meta', valor: '65.5' }],
      campos_adicionais: [{ label: 'Sono', valor: 'Ruim' }],
    })
    expect(r.alergias).toBe('Dipirona')
    expect(r.medicamentosUso).toBe('Não')
    expect(r.respostas).toEqual([{ label: 'Tabagismo', resposta: 'Sim', detalhe: '5/dia' }])
    expect(r.textos).toEqual([{ label: 'Diagnóstico', valor: 'Dx' }])
    expect(r.personalizados.map((p) => p.label)).toEqual(['Peso meta', 'Sono'])
  })
  it('anamnese antiga (sem extras) não quebra', () => {
    expect(extrasLegiveis(undefined)).toEqual({ alergias: '', medicamentosUso: '', respostas: [], textos: [], personalizados: [] })
    expect(extrasLegiveis({ alergias: 3, historicos_diarios: 'x' }).alergias).toBe('3')
  })
})
