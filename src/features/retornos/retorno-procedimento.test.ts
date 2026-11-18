import { describe, expect, it } from 'vitest'
import {
  agendamentoEhRetorno,
  anamneseInicialDoAgendamento,
  prazoDentroDe30Dias,
  procedimentoRetornoSugerido,
} from './retorno-procedimento'

const procs = [
  { id: 'bio', nome: 'Bioressonância Quântica' },
  { id: 'ret-bio', nome: 'Retorno de Bioressonancia Quântica' },
  { id: 'cardio', nome: 'Consulta de Cardiologia' },
  { id: 'ret30', nome: 'Retorno (até 30 dias)' },
]

describe('procedimento do retorno pelo prazo', () => {
  it('até 30 dias usa o "Retorno de X"', () => {
    expect(procedimentoRetornoSugerido({ origemId: 'bio', procedimentos: procs, dentroDe30Dias: true })).toBe('ret-bio')
  })
  it('acima de 30 dias usa o procedimento normal, mesmo partindo do retorno', () => {
    expect(procedimentoRetornoSugerido({ origemId: 'bio', procedimentos: procs, dentroDe30Dias: false })).toBe('bio')
    expect(procedimentoRetornoSugerido({ origemId: 'ret-bio', procedimentos: procs, dentroDe30Dias: false })).toBe('bio')
    expect(procedimentoRetornoSugerido({ origemId: 'ret-bio', procedimentos: procs, dentroDe30Dias: true })).toBe('ret-bio')
  })
  it('sem par cadastrado ou origem desconhecida mantém o atual (null)', () => {
    expect(procedimentoRetornoSugerido({ origemId: 'cardio', procedimentos: procs, dentroDe30Dias: true })).toBeNull()
    expect(procedimentoRetornoSugerido({ origemId: 'x', procedimentos: procs, dentroDe30Dias: true })).toBeNull()
    expect(procedimentoRetornoSugerido({ origemId: null, procedimentos: procs, dentroDe30Dias: false })).toBeNull()
  })
})

describe('prazo dentro de 30 dias', () => {
  it('30 e personalizado até 30', () => {
    expect(prazoDentroDe30Dias({ tipo: '30', customDias: '' })).toBe(true)
    expect(prazoDentroDe30Dias({ tipo: 'custom', customDias: '30' })).toBe(true)
    expect(prazoDentroDe30Dias({ tipo: 'custom', customDias: '15' })).toBe(true)
  })
  it('acima de 30, 6 meses e liberado não', () => {
    for (const tipo of ['60', '90', '120', '6m', 'liberado']) {
      expect(prazoDentroDe30Dias({ tipo, customDias: '' })).toBe(false)
    }
    expect(prazoDentroDe30Dias({ tipo: 'custom', customDias: '31' })).toBe(false)
  })
})

describe('tipo de anamnese inicial', () => {
  it('retorno pelo tipo ou pelo nome do procedimento vira reconsulta', () => {
    expect(anamneseInicialDoAgendamento({ tipo: 'retorno' })).toBe('reconsulta')
    expect(anamneseInicialDoAgendamento({ tipo: 'Retorno' })).toBe('reconsulta')
    expect(anamneseInicialDoAgendamento({ tipo: 'Consulta', procedimento: 'Retorno de Bioressonância Quântica' })).toBe('reconsulta')
  })
  it('consulta nova segue como primeira vez', () => {
    expect(anamneseInicialDoAgendamento({ tipo: 'Consulta', procedimento: 'Bioressonância Quântica' })).toBe('consulta')
    expect(agendamentoEhRetorno({})).toBe(false)
  })
})
