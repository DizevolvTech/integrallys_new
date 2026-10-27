import { describe, expect, it } from 'vitest'
import { montarGrupos, totalDosGrupos } from './detalhe-util'

describe('montarGrupos', () => {
  it('agrupa por forma, soma e ordena pelo maior total', () => {
    const grupos = montarGrupos([
      { id: '1', titulo: 'A', valor: 10, grupo: 'PIX' },
      { id: '2', titulo: 'B', valor: 50, grupo: 'Dinheiro' },
      { id: '3', titulo: 'C', valor: 5.25, grupo: 'PIX' },
    ])
    expect(grupos.map((g) => [g.rotulo, g.total, g.linhas.length])).toEqual([
      ['Dinheiro', 50, 1],
      ['PIX', 15.25, 2],
    ])
    expect(totalDosGrupos(grupos)).toBe(65.25)
  })
})
