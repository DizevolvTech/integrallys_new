import { describe, expect, it } from 'vitest'
import { erroFormaDetalhes } from './forma-detalhes-campos'
import { VINCULO_VAZIO, erroVinculo } from './vinculo-campo'

const base = { forma: 'dinheiro', bandeira: '', parcelas: '1', contaBancariaId: '' }

describe('erroFormaDetalhes', () => {
  it('PIX exige a conta; cartão exige a bandeira; dinheiro não exige nada', () => {
    expect(erroFormaDetalhes({ ...base, forma: 'pix' })).toBe('Escolha a conta do PIX.')
    expect(erroFormaDetalhes({ ...base, forma: 'pix', contaBancariaId: 'c1' })).toBeNull()
    expect(erroFormaDetalhes({ ...base, forma: 'cartao_credito' })).toBe('Informe a bandeira do cartão.')
    expect(erroFormaDetalhes({ ...base, forma: 'cartao_debito', bandeira: 'Elo' })).toBeNull()
    expect(erroFormaDetalhes(base)).toBeNull()
  })
})

describe('erroVinculo', () => {
  it('obrigatório: tipo e pessoa (ou nome em Outro)', () => {
    expect(erroVinculo(VINCULO_VAZIO, true)).toMatch(/Escolha a quem/)
    expect(erroVinculo(VINCULO_VAZIO, false)).toBeNull()
    expect(erroVinculo({ tipo: 'paciente', id: '', nome: '' }, true)).toBe('Escolha o paciente.')
    expect(erroVinculo({ tipo: 'fornecedor', id: '', nome: '' }, true)).toBe('Escolha o fornecedor.')
    expect(erroVinculo({ tipo: 'prestador', id: 'x', nome: 'A' }, true)).toBeNull()
    expect(erroVinculo({ tipo: 'outro', id: '', nome: ' ' }, true)).toBe('Informe o nome em "Outro".')
    expect(erroVinculo({ tipo: 'outro', id: '', nome: 'Moto-boy' }, true)).toBeNull()
  })
})
