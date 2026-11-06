import { describe, expect, it } from 'vitest'
import { lerDetalhesMovimento } from './movimento-input'

const ID = '11111111-2222-4333-8444-555555555555'

describe('lerDetalhesMovimento', () => {
  it('PIX guarda a conta; outras formas descartam a conta', () => {
    const pix = lerDetalhesMovimento({ forma: 'pix', contaBancariaId: ID })
    expect(pix.ok && pix.value.contaBancariaId).toBe(ID)
    const din = lerDetalhesMovimento({ forma: 'dinheiro', contaBancariaId: ID })
    expect(din.ok && din.value.contaBancariaId).toBeNull()
  })

  it('rejeita conta do PIX que não é um id', () => {
    const r = lerDetalhesMovimento({ forma: 'pix', contaBancariaId: 'sicredi' })
    expect(r).toMatchObject({ ok: false, code: 'CAIXA_CONTA_PIX_INVALIDA' })
  })

  it('cartão: bandeira só no cartão, parcelas só no crédito (e valor legado "credito" vira cartão crédito)', () => {
    const r = lerDetalhesMovimento({ forma: 'credito', bandeira: ' Visa ', parcelas: 3, valorParcela: 33.333 })
    expect(r.ok && r.value).toMatchObject({ forma: 'cartao_credito', bandeira: 'Visa', parcelas: 3, valorParcela: 33.33 })
    const deb = lerDetalhesMovimento({ forma: 'cartao_debito', bandeira: 'Elo', parcelas: 3 })
    expect(deb.ok && deb.value).toMatchObject({ bandeira: 'Elo', parcelas: null })
    const pix = lerDetalhesMovimento({ forma: 'pix', bandeira: 'Visa' })
    expect(pix.ok && pix.value.bandeira).toBeNull()
  })

  it('vínculo: pessoa exige id; outro exige nome; sem tipo = sem vínculo', () => {
    expect(lerDetalhesMovimento({ vinculoTipo: 'paciente' })).toMatchObject({ ok: false, code: 'CAIXA_VINCULO_PESSOA_OBRIGATORIA' })
    expect(lerDetalhesMovimento({ vinculoTipo: 'outro', vinculoNome: '  ' })).toMatchObject({ ok: false, code: 'CAIXA_VINCULO_NOME_OBRIGATORIO' })
    expect(lerDetalhesMovimento({ vinculoTipo: 'dono' })).toMatchObject({ ok: false, code: 'CAIXA_VINCULO_INVALIDO' })
    const outro = lerDetalhesMovimento({ vinculoTipo: 'outro', vinculoNome: ' Moto-boy ' })
    expect(outro.ok && outro.value).toMatchObject({ vinculoTipo: 'outro', vinculoId: null, vinculoNome: 'Moto-boy' })
    const pac = lerDetalhesMovimento({ vinculoTipo: 'prestador', vinculoId: ID, vinculoNome: 'ignorado' })
    expect(pac.ok && pac.value).toMatchObject({ vinculoTipo: 'prestador', vinculoId: ID, vinculoNome: null })
    const nada = lerDetalhesMovimento({})
    expect(nada.ok && nada.value).toMatchObject({ forma: 'dinheiro', vinculoTipo: null })
  })
})
