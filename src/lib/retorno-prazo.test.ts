import { describe, expect, it } from 'vitest'
import { resolverPrazoDefinido } from './retorno-prazo'

const HOJE = '2026-10-30'
const BASE = '2026-10-01'

describe('resolverPrazoDefinido', () => {
  it('data prevista informada é mantida e calcula dias desde o atendimento', () => {
    expect(resolverPrazoDefinido({ modo: 'data', data: '2026-12-01' }, HOJE, BASE)).toEqual({
      ok: true, dataPrevista: '2026-12-01', prazoTipo: 'custom', prazoDias: 61,
    })
  })
  it('em N dias/semanas/meses conta a partir de hoje', () => {
    const r = (quantidade: number, unidade: 'dias' | 'semanas' | 'meses') =>
      resolverPrazoDefinido({ modo: 'em', quantidade, unidade }, HOJE, BASE)
    expect(r(10, 'dias')).toMatchObject({ ok: true, dataPrevista: '2026-11-09' })
    expect(r(2, 'semanas')).toMatchObject({ ok: true, dataPrevista: '2026-11-13' })
    expect(r(3, 'meses')).toMatchObject({ ok: true, dataPrevista: '2027-01-30' })
  })
  it('mês curto limita ao último dia', () => {
    expect(resolverPrazoDefinido({ modo: 'em', quantidade: 4, unidade: 'meses' }, '2026-10-31', BASE))
      .toMatchObject({ dataPrevista: '2027-02-28' })
  })
  it('data anterior ao atendimento não gera prazo_dias', () => {
    expect(resolverPrazoDefinido({ modo: 'data', data: '2026-09-20' }, HOJE, BASE))
      .toMatchObject({ ok: true, prazoDias: null })
  })
  it('rejeita data inválida, quantidade zero/fracionada e unidade desconhecida', () => {
    expect(resolverPrazoDefinido({ modo: 'data', data: 'ontem' }, HOJE, BASE).ok).toBe(false)
    expect(resolverPrazoDefinido({ modo: 'em', quantidade: 0, unidade: 'dias' }, HOJE, BASE).ok).toBe(false)
    expect(resolverPrazoDefinido({ modo: 'em', quantidade: 1.5, unidade: 'dias' }, HOJE, BASE).ok).toBe(false)
    expect(resolverPrazoDefinido({ modo: 'em', quantidade: 2, unidade: 'anos' as never }, HOJE, BASE).ok).toBe(false)
  })
})
