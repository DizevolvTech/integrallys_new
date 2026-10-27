import { describe, expect, it } from 'vitest'
import { lerSuprimentosProcedimento } from './suprimentos-input'

const ID = '11111111-1111-1111-1111-111111111111'
const ID2 = '22222222-2222-2222-2222-222222222222'

describe('lerSuprimentosProcedimento', () => {
  it('sem os campos não mexe no que existe', () => {
    expect(lerSuprimentosProcedimento({ nome: 'x' })).toEqual({ ok: true, baixa: undefined, itens: undefined })
  })
  it('baixa ligada exige ao menos um suprimento', () => {
    expect(lerSuprimentosProcedimento({ baixaSuprimentos: true, suprimentos: [] }).ok).toBe(false)
  })
  it('valida quantidade, id e repetição', () => {
    expect(lerSuprimentosProcedimento({ baixaSuprimentos: true, suprimentos: [{ suprimentoId: ID, quantidade: 0 }] }).ok).toBe(false)
    expect(lerSuprimentosProcedimento({ baixaSuprimentos: true, suprimentos: [{ suprimentoId: 'x', quantidade: 1 }] }).ok).toBe(false)
    expect(lerSuprimentosProcedimento({ baixaSuprimentos: true, suprimentos: [{ suprimentoId: ID, quantidade: 1 }, { suprimentoId: ID, quantidade: 2 }] }).ok).toBe(false)
  })
  it('aceita lista válida e limpa a lista quando a baixa é desligada', () => {
    const ok = lerSuprimentosProcedimento({ baixaSuprimentos: true, suprimentos: [{ suprimentoId: ID, quantidade: 2 }, { suprimentoId: ID2, quantidade: 1 }] })
    expect(ok).toMatchObject({ ok: true, baixa: true })
    const off = lerSuprimentosProcedimento({ baixaSuprimentos: false, suprimentos: [{ suprimentoId: ID, quantidade: 2 }] })
    expect(off).toEqual({ ok: true, baixa: false, itens: [] })
  })
})
