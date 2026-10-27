import { describe, expect, it } from 'vitest'
import {
  agruparPorForma,
  periodoEfetivo,
  resumirPeriodo,
  situacaoLancamento,
  type ItemResumivel,
} from './financeiro-situacao'

const hoje = '2026-10-27'

describe('situacaoLancamento', () => {
  it('pendente vira a vencer e, vencido, atrasado', () => {
    expect(situacaoLancamento({ status: 'Pendente', vencimento: '2026-10-27', hoje })).toBe('a_vencer')
    expect(situacaoLancamento({ status: 'Pendente', vencimento: null, hoje })).toBe('a_vencer')
    expect(situacaoLancamento({ status: 'Pendente', vencimento: '2026-10-26', hoje })).toBe('atrasado')
  })
  it('pago é liquidado mesmo vencido e cancelado sai das contas', () => {
    expect(situacaoLancamento({ status: 'Pago', vencimento: '2026-01-01', hoje })).toBe('liquidado')
    expect(situacaoLancamento({ status: 'Cancelado', vencimento: '2026-01-01', hoje })).toBe('cancelado')
  })
})

describe('periodoEfetivo', () => {
  it('sem filtro é hoje', () => {
    expect(periodoEfetivo(null, null, hoje)).toEqual({ de: hoje, ate: hoje })
    expect(periodoEfetivo('2026-10-01', null, hoje)).toEqual({ de: '2026-10-01', ate: '9999-12-31' })
  })
})

const itens: ItemResumivel[] = [
  { valor: 100, situacao: 'liquidado', forma: 'PIX', dataReferencia: '2026-10-27' },
  { valor: 50, situacao: 'liquidado', forma: 'PIX', dataReferencia: '2026-10-20' },
  { valor: 70, situacao: 'a_vencer', forma: 'Boleto', dataReferencia: '2026-10-27' },
  { valor: 30, situacao: 'a_vencer', forma: 'Boleto', dataReferencia: '2026-11-05' },
  { valor: 40, situacao: 'atrasado', forma: 'Boleto', dataReferencia: '2026-10-10' },
]

describe('resumirPeriodo', () => {
  it('sem filtro mostra o dia de hoje e todo o atrasado', () => {
    const resumo = resumirPeriodo(itens, periodoEfetivo(null, null, hoje), hoje, false)
    expect(resumo.liquidado).toBe(100)
    expect(resumo.atrasado).toBe(40)
  })
  it('sem filtro o a receber inclui tudo o que vence de hoje em diante (saldo de atendimento futuro)', () => {
    const futuros: ItemResumivel[] = [
      { valor: 70, situacao: 'a_vencer', forma: 'x', dataReferencia: hoje },
      { valor: 100, situacao: 'a_vencer', forma: 'x', dataReferencia: '2026-11-05' },
      { valor: 25, situacao: 'a_vencer', forma: 'x', dataReferencia: '2027-01-10' },
    ]
    expect(resumirPeriodo(futuros, periodoEfetivo(null, null, hoje), hoje, false).aVencer).toBe(195)
    // com período informado, só o que cai nele
    expect(resumirPeriodo(futuros, { de: '2026-10-01', ate: '2026-11-30' }, hoje, true).aVencer).toBe(170)
  })
  it('com período segue o filtro', () => {
    const resumo = resumirPeriodo(itens, { de: '2026-10-01', ate: '2026-11-30' }, hoje, true)
    expect(resumo).toEqual({ liquidado: 150, aVencer: 100, atrasado: 40 })
  })
})

describe('agruparPorForma', () => {
  it('soma por forma, maior primeiro', () => {
    const grupos = agruparPorForma([
      { valor: 10, forma: 'PIX' },
      { valor: 30, forma: 'Dinheiro' },
      { valor: 5.5, forma: 'PIX' },
    ])
    expect(grupos.map((g) => [g.forma, g.total])).toEqual([
      ['Dinheiro', 30],
      ['PIX', 15.5],
    ])
  })
})
