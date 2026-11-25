import { describe, expect, it } from 'vitest'
import {
  type ItemPrescritoBruto,
  inicioJanelaPosologia,
  itensMaisRecentesPorProduto,
} from './posologia-ajuste'

const item = (o: Partial<ItemPrescritoBruto>): ItemPrescritoBruto => ({
  id: 'i',
  prescricaoId: 'p',
  produtoId: null,
  descricao: 'Vitamina D',
  posologia: null,
  dataPrescricao: '2026-11-25',
  criadoEm: '2026-11-25T10:00:00Z',
  ...o,
})

describe('posologia-ajuste', () => {
  it('janela de 30 dias a partir de hoje (virada de mês e de ano)', () => {
    expect(inicioJanelaPosologia('2026-11-25')).toBe('2026-10-26')
    expect(inicioJanelaPosologia('2026-01-10')).toBe('2025-12-11')
  })

  it('um item por produto: o da prescrição mais recente', () => {
    const lista = itensMaisRecentesPorProduto([
      item({ id: 'a', posologia: 'antiga', dataPrescricao: '2026-11-20' }),
      item({ id: 'b', posologia: ' 1 cap. após café ', dataPrescricao: '2026-11-25' }),
      item({ id: 'c', descricao: 'Ômega 3', dataPrescricao: '2026-11-22' }),
    ])
    expect(lista.map((i) => [i.itemId, i.posologia])).toEqual([
      ['b', '1 cap. após café'],
      ['c', ''],
    ])
  })

  it('mesmo dia: vale a prescrição criada por último; produto pelo id quando houver', () => {
    const lista = itensMaisRecentesPorProduto([
      item({ id: 'a', produtoId: 'x', descricao: 'Nome velho', criadoEm: '2026-11-25T08:00:00Z' }),
      item({ id: 'b', produtoId: 'x', descricao: 'Nome novo', criadoEm: '2026-11-25T09:00:00Z' }),
    ])
    expect(lista).toHaveLength(1)
    expect(lista[0].itemId).toBe('b')
  })
})
