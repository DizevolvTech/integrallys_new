import { describe, expect, it } from 'vitest'
import { margemDaPrescricao, margemDoItem, podeVerCustoMargem } from './prescricao-margem'

describe('prescricao-margem', () => {
  it('só gestor, admin e master veem custo e margem', () => {
    expect(['gestor', 'admin', 'master'].every(podeVerCustoMargem)).toBe(true)
    expect(['recepcao', 'especialista', 'paciente', undefined, null].some((r) => podeVerCustoMargem(r))).toBe(false)
  })
  it('margem do item: custo 50, venda 150, qtd 2', () => {
    expect(margemDoItem({ quantity: 2, unitPrice: 150, custoUnitario: 50 })).toEqual({ custoUnitario: 50, custoTotal: 100, margem: 200, margemPercentual: 200 })
  })
  it('item sem custo conhecido não inventa margem', () => {
    expect(margemDoItem({ quantity: 1, unitPrice: 80 }).margem).toBeUndefined()
  })
  it('total considera o desconto (valor total final)', () => {
    const r = margemDaPrescricao([{ quantity: 2, unitPrice: 150, custoUnitario: 50 }], 270)
    expect(r).toEqual({ custoTotal: 100, margemTotal: 170, margemPercentual: 170 })
  })
  it('sem nenhum custo conhecido, sem totais', () => {
    expect(margemDaPrescricao([{ quantity: 1, unitPrice: 10 }], 10).custoTotal).toBeUndefined()
  })
})
