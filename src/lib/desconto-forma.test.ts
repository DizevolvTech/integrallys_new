import { describe, expect, it } from 'vitest'
import { calcularVenda, ehFormaComDesconto, normalizarDescontos, validarDescontos } from './desconto-forma'

const config = { pix: 5, dinheiro: 10, cartao_debito: 2.5, cartao_credito: 0 }
const itens = [
  { quantidade: 2, valorUnitario: 89.9 },
  { quantidade: 1, valorUnitario: 20 },
]

describe('calcularVenda', () => {
  it('aplica o percentual cadastrado da forma escolhida', () => {
    expect(calcularVenda(itens, 'pix', config)).toEqual({ subtotal: 199.8, percentual: 5, desconto: 9.99, total: 189.81 })
    expect(calcularVenda(itens, 'cartao_debito', config).percentual).toBe(2.5)
  })

  it('não dá desconto no crédito sem percentual, no consumo nem sem forma', () => {
    expect(calcularVenda(itens, 'cartao_credito', config).total).toBe(199.8)
    expect(calcularVenda(itens, 'consumo', config).desconto).toBe(0)
    expect(calcularVenda(itens, null, config).desconto).toBe(0)
  })

  it('item sem valor unitário conta zero', () => {
    expect(calcularVenda([{ quantidade: 3 }], 'pix', config).subtotal).toBe(0)
  })
})

describe('normalizarDescontos / validarDescontos', () => {
  it('ignora percentuais fora de 0–100 ao ler', () => {
    expect(normalizarDescontos({ pix: 150, dinheiro: -1, cartao_debito: 'x', cartao_credito: 7 })).toEqual({
      pix: 0,
      dinheiro: 0,
      cartao_debito: 0,
      cartao_credito: 7,
    })
  })

  it('rejeita gravação com forma ausente ou percentual inválido', () => {
    expect(validarDescontos(config)).toEqual(config)
    expect(validarDescontos({ ...config, pix: 101 })).toBeNull()
    expect(validarDescontos({ ...config, dinheiro: -2 })).toBeNull()
    expect(validarDescontos({ pix: 1, dinheiro: 1, cartao_debito: 1 })).toBeNull()
    expect(validarDescontos(null)).toBeNull()
  })

  it('reconhece só as quatro formas com desconto', () => {
    expect(ehFormaComDesconto('pix')).toBe(true)
    expect(ehFormaComDesconto('consumo')).toBe(false)
  })
})
