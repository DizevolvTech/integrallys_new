import { describe, expect, it } from 'vitest'
import { ANEXO_MAX_BYTES, caminhoAnexo, validarAnexo } from './financeiro-anexos'

describe('validarAnexo', () => {
  it('aceita pdf e imagem dentro do limite', () => {
    expect(validarAnexo({ type: 'application/pdf', size: 1000 })).toEqual({ ok: true })
    expect(validarAnexo({ type: 'image/jpeg', size: ANEXO_MAX_BYTES })).toEqual({ ok: true })
  })
  it('rejeita tipo, vazio e tamanho', () => {
    expect(validarAnexo({ type: 'text/html', size: 10 })).toMatchObject({ ok: false, code: 'INVALID_MIME' })
    expect(validarAnexo({ type: 'application/pdf', size: 0 })).toMatchObject({ ok: false, code: 'EMPTY_FILE' })
    expect(validarAnexo({ type: 'application/pdf', size: ANEXO_MAX_BYTES + 1 })).toMatchObject({ ok: false, code: 'FILE_TOO_LARGE' })
  })
})

describe('caminhoAnexo', () => {
  it('limpa o nome e fica dentro da pasta do lançamento', () => {
    expect(caminhoAnexo('abc', 'Nota fiscal nº 12 ../x.pdf', 5)).toBe('abc/5-Nota_fiscal_n_12_.._x.pdf')
  })
})
