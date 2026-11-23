import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/use-api', () => ({ useApi: () => ({}) }))

import { opcoesDoCampo } from './campo-texto-opcoes'

describe('opcoesDoCampo', () => {
  it('junta respostas prontas e profissionais, sem repetir', () => {
    const secao = {
      tipo: 'campo_texto' as const,
      label: 'Profissional recomendado',
      opcoes: ['À escolha do paciente'],
      opcoes_profissionais: true,
    }
    expect(opcoesDoCampo(secao, ['Dra. Ana', 'Dr. Bruno', 'Dra. Ana'], '')).toEqual([
      'À escolha do paciente',
      'Dra. Ana',
      'Dr. Bruno',
    ])
  })

  it('mantém o valor atual mesmo se não está mais na lista', () => {
    const secao = { tipo: 'campo_texto' as const, label: 'X', opcoes_profissionais: true }
    expect(opcoesDoCampo(secao, ['Dra. Ana'], 'Dr. Antigo')).toEqual(['Dra. Ana', 'Dr. Antigo'])
  })

  it('sem opcoes_profissionais ignora a lista de profissionais', () => {
    const secao = {
      tipo: 'campo_texto' as const,
      label: 'Especialidade',
      opcoes: ['Qualquer especialidade ', ' '],
    }
    expect(opcoesDoCampo(secao, ['Dra. Ana'], '')).toEqual(['Qualquer especialidade'])
  })
})
