import { describe, expect, it } from 'vitest'
import { adicionarMeses, gerarParcelas, isIsoDate } from './financeiro-parcelas'

describe('gerarParcelas', () => {
  it('divide em centavos sem perder dinheiro e com vencimentos mensais', () => {
    const parcelas = gerarParcelas({ valorTotal: 100, parcelas: 3, primeiroVencimento: '2026-11-10' })
    expect(parcelas.map((p) => p.valor)).toEqual([33.33, 33.33, 33.34])
    expect(parcelas.map((p) => p.vencimento)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10'])
    expect(parcelas.map((p) => `${p.numero}/${p.total}`)).toEqual(['1/3', '2/3', '3/3'])
    expect(parcelas.reduce((s, p) => s + Math.round(p.valor * 100), 0)).toBe(10000)
  })

  it('uma parcela devolve o valor cheio', () => {
    expect(gerarParcelas({ valorTotal: 80.5, parcelas: 1, primeiroVencimento: '2026-10-27' })).toEqual([
      { numero: 1, total: 1, valor: 80.5, vencimento: '2026-10-27' },
    ])
  })

  it('limita a quantidade de parcelas', () => {
    expect(gerarParcelas({ valorTotal: 100, parcelas: 500, primeiroVencimento: '2026-01-01' })).toHaveLength(60)
    expect(gerarParcelas({ valorTotal: 100, parcelas: 0, primeiroVencimento: '2026-01-01' })).toHaveLength(1)
  })
})

describe('adicionarMeses', () => {
  it('usa o último dia do mês quando o dia não existe', () => {
    expect(adicionarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(adicionarMeses('2028-01-31', 1)).toBe('2028-02-29')
    expect(adicionarMeses('2026-12-15', 2)).toBe('2027-02-15')
  })
})

describe('isIsoDate', () => {
  it('rejeita datas inexistentes', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('27/10/2026')).toBe(false)
    expect(isIsoDate('2026-10-27')).toBe(true)
  })
})
