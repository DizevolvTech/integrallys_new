import { describe, expect, it } from 'vitest'
import { normalizarFormaCaixa, resumoPorForma, vinculoTexto } from './resumo-caixa'

describe('normalizarFormaCaixa', () => {
  it.each([
    ['credito', 'cartao_credito'],
    ['Cartão de crédito', 'cartao_credito'],
    ['debito', 'cartao_debito'],
    ['cartao_debito', 'cartao_debito'],
    ['PIX', 'pix'],
    ['Dinheiro', 'dinheiro'],
    [null, 'dinheiro'],
    ['', 'dinheiro'],
    ['transferencia', 'transferencia'],
  ])('%s -> %s', (entrada, esperado) => {
    expect(normalizarFormaCaixa(entrada)).toBe(esperado)
  })
})

describe('resumoPorForma', () => {
  const movimentos = [
    { tipo: 'entrada', valor: 100, forma: 'dinheiro' },
    { tipo: 'entrada', valor: 50, forma: null },
    { tipo: 'entrada', valor: 200, forma: 'pix', contaBancariaNome: 'Sicredi' },
    { tipo: 'entrada', valor: 80, forma: 'pix', contaBancariaNome: 'Bradesco' },
    { tipo: 'entrada', valor: 20, forma: 'pix', contaBancariaNome: 'Sicredi' },
    { tipo: 'entrada', valor: 10, forma: 'pix' },
    { tipo: 'entrada', valor: 300, forma: 'cartao_credito' },
    { tipo: 'entrada', valor: 40, forma: 'credito' },
    { tipo: 'entrada', valor: 60, forma: 'debito' },
    { tipo: 'entrada', valor: 25.5, forma: 'transferencia' },
    { tipo: 'saida', valor: 999, forma: 'dinheiro' },
  ]

  it('soma cada forma, inclusive os valores antigos credito/debito', () => {
    const { linhas } = resumoPorForma(movimentos)
    const por = Object.fromEntries(linhas.map((l) => [l.forma, l.value]))
    expect(por).toEqual({
      dinheiro: 150,
      pix: 310,
      cartao_credito: 340,
      cartao_debito: 60,
      transferencia: 25.5,
    })
  })

  it('total de entradas é a soma das formas e ignora saídas', () => {
    const { linhas, totalEntradas } = resumoPorForma(movimentos)
    expect(totalEntradas).toBe(885.5)
    expect(linhas.reduce((s, l) => s + l.value, 0)).toBeCloseTo(totalEntradas, 2)
  })

  it('quebra o PIX por conta, sem conta por último', () => {
    const pix = resumoPorForma(movimentos).linhas.find((l) => l.forma === 'pix')
    expect(pix?.contas).toEqual([
      { label: 'PIX · Bradesco', value: 80 },
      { label: 'PIX · Sicredi', value: 220 },
      { label: 'PIX · Sem conta informada', value: 10 },
    ])
  })

  it('sem conta nenhuma não abre quebra; sem transferência não mostra a linha', () => {
    const { linhas } = resumoPorForma([{ tipo: 'entrada', valor: 10, forma: 'pix' }])
    expect(linhas.map((l) => l.forma)).toEqual(['dinheiro', 'pix', 'cartao_credito', 'cartao_debito'])
    expect(linhas[1].contas).toBeUndefined()
  })

  it('sem movimentos: tudo zero', () => {
    const r = resumoPorForma([])
    expect(r.totalEntradas).toBe(0)
    expect(r.linhas.every((l) => l.value === 0)).toBe(true)
  })
})

describe('vinculoTexto', () => {
  it('monta "Paciente: Maria Silva"', () => {
    expect(vinculoTexto({ vinculoTipo: 'paciente', vinculoNome: 'Maria Silva' })).toBe('Paciente: Maria Silva')
    expect(vinculoTexto({ vinculoTipo: 'prestador', vinculoNome: 'Ana' })).toBe('Prestador de serviço: Ana')
    expect(vinculoTexto({})).toBe('')
  })
})
