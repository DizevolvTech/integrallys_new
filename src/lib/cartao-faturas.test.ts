import { describe, expect, it } from 'vitest'
import { cicloDaCompra, montarFaturas, parcelasDoMovimento, resumoLimite } from './cartao-faturas'

const compra = (id: string, valor: number, parcelas: number, dataCompra: string) => ({
  id,
  descricao: `compra ${id}`,
  beneficiario: 'Fornecedor X',
  valor,
  parcelas,
  dataCompra,
})

describe('cicloDaCompra', () => {
  it('compra até o fechamento entra na fatura que fecha no mês; vence depois do fechamento', () => {
    // fecha 29, vence 13: compra dia 20/01 -> fecha 29/01, vence 13/02
    expect(cicloDaCompra('2026-01-20', 29, 13)).toEqual({ fechamento: '2026-01-29', vencimento: '2026-02-13' })
    // compra no próprio dia do fechamento ainda entra
    expect(cicloDaCompra('2026-01-29', 29, 13)).toEqual({ fechamento: '2026-01-29', vencimento: '2026-02-13' })
  })

  it('compra depois do fechamento vai para a fatura seguinte', () => {
    expect(cicloDaCompra('2026-01-30', 29, 13)).toEqual({ fechamento: '2026-02-28', vencimento: '2026-03-13' })
  })

  it('vencimento no mesmo mês do fechamento quando o dia de vencimento é maior', () => {
    expect(cicloDaCompra('2026-02-10', 14, 23)).toEqual({ fechamento: '2026-02-14', vencimento: '2026-02-23' })
  })

  it('sem fechamento cadastrado, assume 7 dias antes do vencimento', () => {
    expect(cicloDaCompra('2026-10-02', null, 10)).toEqual({ fechamento: '2026-10-03', vencimento: '2026-10-10' })
  })

  it('sem vencimento cadastrado, vence no mês seguinte no dia da compra', () => {
    expect(cicloDaCompra('2026-10-27', null, null)).toEqual({ fechamento: '2026-11-27', vencimento: '2026-11-27' })
  })
})

describe('parcelasDoMovimento', () => {
  it('distribui a compra parcelada, uma parcela por fatura', () => {
    const parcelas = parcelasDoMovimento(compra('a', 300, 3, '2026-10-27'), 10, 3)
    expect(parcelas.map((p) => p.vencimento)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10'])
    expect(parcelas.map((p) => p.fechamento)).toEqual(['2026-11-03', '2026-12-03', '2027-01-03'])
    expect(parcelas.map((p) => p.valor)).toEqual([100, 100, 100])
  })

  it('limita o dia ao último dia do mês e não perde centavos', () => {
    const parcelas = parcelasDoMovimento(compra('a', 100, 3, '2026-01-15'), 31, 25)
    expect(parcelas.map((p) => p.vencimento)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(parcelas.reduce((s, p) => s + p.valor, 0)).toBeCloseTo(100, 2)
  })
})

describe('faturas e limite', () => {
  const hoje = '2026-10-27'
  const parcelas = [
    ...parcelasDoMovimento(compra('a', 300, 3, '2026-10-27'), 10, 3),
    ...parcelasDoMovimento(compra('b', 90, 1, '2026-09-04'), 10, 3),
  ]

  it('totaliza por fatura e classifica fechada/aberta/paga', () => {
    const faturas = montarFaturas(parcelas, hoje)
    expect(faturas.map((f) => [f.mes, f.total, f.status])).toEqual([
      ['2026-10', 90, 'fechada'],
      ['2026-11', 100, 'aberta'],
      ['2026-12', 100, 'aberta'],
      ['2027-01', 100, 'aberta'],
    ])
    const pagas = montarFaturas(parcelas, hoje, new Set(['2026-10']))
    expect(pagas[0].status).toBe('paga')
  })

  it('limite usado soma tudo que não foi pago; a atual é a próxima a vencer', () => {
    const faturas = montarFaturas(parcelas, hoje)
    const resumo = resumoLimite(1000, faturas)
    expect(resumo).toMatchObject({ utilizado: 390, disponivel: 610, proximoVencimento: '2026-10-10' })
    expect(resumo.faturaAtual?.mes).toBe('2026-10')
  })

  it('pagar a fatura fechada libera o limite e passa a atual para a seguinte', () => {
    const faturas = montarFaturas(parcelas, hoje, new Set(['2026-10']))
    const resumo = resumoLimite(1000, faturas)
    expect(resumo).toMatchObject({ utilizado: 300, disponivel: 700, proximoVencimento: '2026-11-10' })
    expect(resumo.faturaAtual?.status).toBe('aberta')
  })

  it('fatura fecha só depois do dia de fechamento', () => {
    const doDia = montarFaturas(parcelasDoMovimento(compra('c', 50, 1, '2026-10-01'), 10, 3), '2026-10-03')
    expect(doDia[0].status).toBe('aberta')
    expect(montarFaturas(parcelasDoMovimento(compra('c', 50, 1, '2026-10-01'), 10, 3), '2026-10-04')[0].status).toBe('fechada')
  })

  it('sem faturas, nada em aberto', () => {
    expect(resumoLimite(500, [])).toEqual({ utilizado: 0, disponivel: 500, proximoVencimento: null, faturaAtual: null })
  })
})
