import { describe, expect, it } from 'vitest'
import { filtrarOpcoes, normalizarBusca } from './busca-opcoes'

const opcoes = [
  { value: '1', label: 'OMG Ômega 3 60 cáps' },
  { value: '2', label: 'Vitamina D', hint: 'Suplemento' },
  { value: '3', label: 'Magnésio omg' },
  { value: '4', label: 'Colágeno' },
]

describe('filtrarOpcoes', () => {
  it('digitar OMG traz só os produtos com OMG no nome', () => {
    expect(filtrarOpcoes(opcoes, 'OMG').map((o) => o.value)).toEqual(['1', '3'])
  })
  it('ignora acento e caixa', () => {
    expect(filtrarOpcoes(opcoes, 'omega').map((o) => o.value)).toEqual(['1'])
    expect(filtrarOpcoes(opcoes, 'COLAGENO').map((o) => o.value)).toEqual(['4'])
  })
  it('exige todos os termos, em qualquer ordem, e busca na dica', () => {
    expect(filtrarOpcoes(opcoes, '3 omg').map((o) => o.value)).toEqual(['1'])
    expect(filtrarOpcoes(opcoes, 'suplem').map((o) => o.value)).toEqual(['2'])
  })
  it('sem termo devolve tudo; sem acerto devolve vazio', () => {
    expect(filtrarOpcoes(opcoes, '  ')).toHaveLength(4)
    expect(filtrarOpcoes(opcoes, 'zzz')).toEqual([])
  })
  it('normaliza', () => expect(normalizarBusca(' Ação ')).toBe('acao'))
})
