import { describe, expect, it } from 'vitest'
import { totaisLiquidados } from './financeiro.utils'

describe('totaisLiquidados', () => {
  it('entradas e saídas contam só o liquidado; o pendente fica de fora', () => {
    const t = totaisLiquidados([
      { tipo: 'receita', valor: 100, status: 'Pago' },
      { tipo: 'receita', valor: 90, status: 'Pendente' },
      { tipo: 'receita', valor: 20, status: 'Vencido' },
      { tipo: 'despesa', valor: 40, status: 'Pago' },
      { tipo: 'despesa', valor: 70, status: 'Pendente' },
    ])
    expect(t).toEqual({ entradas: 100, saidas: 40, saldo: 60 })
  })
})
