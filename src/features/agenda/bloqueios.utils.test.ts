import { describe, expect, it } from 'vitest'
import { bloqueiosDoDia, corDoTipoBloqueio, textoDoBloqueio } from './bloqueios.utils'
import type { AgendaBloqueio } from './hooks/use-agenda-bloqueios'

const b = (over: Partial<AgendaBloqueio>): AgendaBloqueio => ({
  id: 'x', profissionalId: null, unidadeId: null, dataInicio: '2026-11-02', dataFim: '2026-11-02',
  horarioInicio: null, horarioFim: null, diaInteiro: true, tipo: 'Férias', justificativa: null,
  createdBy: null, createdAt: '', ...over,
})

describe('bloqueiosDoDia', () => {
  const nomes = new Map([['p1', 'Dr. Adelmo'], ['p2', 'Dr. Diego']])
  it('inclui bloqueios de intervalo no dia e exclui fora dele', () => {
    const lista = [b({ id: 'a', dataInicio: '2026-11-01', dataFim: '2026-11-05' }), b({ id: 'c', dataInicio: '2026-11-10', dataFim: '2026-11-10' })]
    expect(bloqueiosDoDia(lista, '2026-11-03', 'todos', nomes).map((x) => x.id)).toEqual(['a'])
  })
  it('filtra por profissional mas mantém bloqueios da clínica toda', () => {
    const lista = [b({ id: 'p1', profissionalId: 'p1' }), b({ id: 'p2', profissionalId: 'p2' }), b({ id: 'all' })]
    expect(bloqueiosDoDia(lista, '2026-11-02', 'Dr. Adelmo', nomes).map((x) => x.id)).toEqual(['p1', 'all'])
  })
})

describe('corDoTipoBloqueio', () => {
  it('é estável por tipo e ignora caixa', () => {
    expect(corDoTipoBloqueio('Dentista')).toBe(corDoTipoBloqueio(' dentista '))
  })
  it('tipos diferentes comuns têm cores distintas', () => {
    const cores = new Set(['Férias', 'Folga', 'Reunião', 'Outro', 'Dentista', 'Produção de marketing'].map((t) => corDoTipoBloqueio(t).chip))
    expect(cores.size).toBe(6)
  })
})

describe('textoDoBloqueio', () => {
  it('esconde o id interno de bloqueios antigos de compromisso', () => {
    expect(textoDoBloqueio('Compromisso:8a6901e8-f4df-4154-a70e-79ad7fec2652|DENTISTA')).toBe('DENTISTA')
    expect(textoDoBloqueio('Compromisso: DENTISTA')).toBe('Compromisso: DENTISTA')
    expect(textoDoBloqueio(null)).toBe('')
  })
})
