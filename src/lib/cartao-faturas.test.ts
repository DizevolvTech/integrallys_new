import { describe, expect, it } from 'vitest'
import { montarFaturas, parcelasDoMovimento, resumoLimite } from './cartao-faturas'

const compra = (id: string, valor: number, parcelas: number, dataCompra: string) => ({
  id,
  descricao: `compra ${id}`,
  beneficiario: 'Fornecedor X',
  valor,
  parcelas,
  dataCompra,
})

describe('parcelasDoMovimento', () => {
  it('distribui a compra parcelada nos meses seguintes, no dia do vencimento do cartão', () => {
    const parcelas = parcelasDoMovimento(compra('a', 300, 3, '2026-10-27'), 10)
    expect(parcelas.map((p) => p.vencimento)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10'])
    expect(parcelas.map((p) => p.valor)).toEqual([100, 100, 100])
  })

  it('limita o dia ao último dia do mês', () => {
    const parcelas = parcelasDoMovimento(compra('a', 200, 2, '2026-01-15'), 31)
    expect(parcelas.map((p) => p.vencimento)).toEqual(['2026-02-28', '2026-03-31'])
  })
})

describe('faturas e limite', () => {
  const hoje = '2026-10-27'
  const parcelas = [
    ...parcelasDoMovimento(compra('a', 300, 3, '2026-10-27'), 10),
    ...parcelasDoMovimento(compra('b', 90, 1, '2026-09-01'), 10),
  ]
  const faturas = montarFaturas(parcelas, hoje)

  it('totaliza por fatura e marca abertas', () => {
    expect(faturas.map((f) => [f.mes, f.total, f.aberta])).toEqual([
      ['2026-10', 90, false],
      ['2026-11', 100, true],
      ['2026-12', 100, true],
      ['2027-01', 100, true],
    ])
  })

  it('limite usado soma só faturas em aberto', () => {
    expect(resumoLimite(1000, faturas)).toEqual({ utilizado: 300, disponivel: 700, proximoVencimento: '2026-11-10' })
  })

  it('fatura que vence hoje ainda está em aberto', () => {
    const doDia = montarFaturas(parcelasDoMovimento(compra('c', 50, 1, '2026-09-27'), 27), '2026-10-27')
    expect(doDia[0]).toMatchObject({ vencimento: '2026-10-27', aberta: true })
  })
})
