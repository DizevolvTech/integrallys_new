import { describe, expect, it } from 'vitest'
import { validarNovoLancamento } from './financeiro-lancamento-input'

const hoje = '2026-10-27'

describe('validarNovoLancamento', () => {
  it('emissão padrão é hoje e vencimento padrão é a emissão', () => {
    const r = validarNovoLancamento({ valor: 100 }, hoje)
    expect(r.ok && r.data.emissao).toBe(hoje)
    expect(r.ok && r.data.vencimento).toBe(hoje)
    expect(r.ok && r.data.parcelas).toHaveLength(1)
  })

  it('parcelamento divide o total e gera os vencimentos', () => {
    const r = validarNovoLancamento({ valor: 300, numeroParcelas: 3, vencimento: '2026-11-15', dataEmissao: '2026-10-01' }, hoje)
    expect(r.ok && r.data.parcelas.map((p) => [p.valor, p.vencimento])).toEqual([
      [100, '2026-11-15'],
      [100, '2026-12-15'],
      [100, '2027-01-15'],
    ])
  })

  it('rejeita data, parcelas e valor inválidos', () => {
    expect(validarNovoLancamento({ valor: 10, dataEmissao: '31/10/2026' }, hoje)).toMatchObject({ ok: false, code: 'INVALID_EMISSAO' })
    expect(validarNovoLancamento({ valor: 10, vencimento: '2026-13-01' }, hoje)).toMatchObject({ ok: false, code: 'INVALID_VENCIMENTO' })
    expect(validarNovoLancamento({ valor: 10, numeroParcelas: 0 }, hoje)).toMatchObject({ ok: false, code: 'INVALID_PARCELAS' })
    expect(validarNovoLancamento({ valor: 10, numeroParcelas: 61 }, hoje)).toMatchObject({ ok: false, code: 'INVALID_PARCELAS' })
    expect(validarNovoLancamento({ valor: 0 }, hoje)).toMatchObject({ ok: false, code: 'INVALID_FINANCEIRO_VALUE' })
  })

  it('ignora ids que não são uuid', () => {
    const r = validarNovoLancamento({ valor: 10, categoriaDreId: 'abc', pacienteId: '3f2b8f0e-7d1c-4c3a-9f55-0a1b2c3d4e5f' }, hoje)
    expect(r.ok && r.data.categoriaDreId).toBeNull()
    expect(r.ok && r.data.vinculos.pacienteId).toBe('3f2b8f0e-7d1c-4c3a-9f55-0a1b2c3d4e5f')
  })
})
