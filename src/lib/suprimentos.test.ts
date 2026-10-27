import { describe, expect, it } from 'vitest'
import { mapSuprimento, resumirMovimentos } from './suprimentos'

describe('suprimentos', () => {
  it('mapeia o registro', () => {
    expect(mapSuprimento({ id: 'a', nome: 'Luva', quantidade: 5, estoque_minimo: 2, preco_custo: '1.5', validade: '2027-01-01T00:00:00Z' })).toMatchObject({
      nome: 'Luva',
      quantidade: 5,
      estoqueMinimo: 2,
      precoCusto: 1.5,
      validade: '2027-01-01',
      ativo: true,
    })
  })
  it('resume entradas, saídas, baixas de procedimento e custo', () => {
    const { porSuprimento, totais } = resumirMovimentos([
      { suprimento_id: 'a', tipo: 'entrada', origem: 'manual', quantidade: 10 },
      { suprimento_id: 'a', tipo: 'saida', origem: 'procedimento', quantidade: 2, custo: 3 },
      { suprimento_id: 'a', tipo: 'saida', origem: 'manual', quantidade: 1, custo: 3 },
    ])
    expect(totais).toEqual({ entradas: 10, saidas: 3, baixasProcedimento: 2, custoConsumido: 9 })
    expect(porSuprimento.get('a')).toEqual({ entradas: 10, saidas: 3, consumoProcedimentos: 2, custoConsumo: 9 })
  })
})
