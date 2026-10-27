import { describe, expect, it } from 'vitest'
import { validarCadastro } from './cadastros'

describe('validarCadastro', () => {
  it('banco exige nome e aceita código', () => {
    expect(validarCadastro('bancos', { nome: ' ' }, false)).toMatchObject({ ok: false, code: 'INVALID_NOME' })
    expect(validarCadastro('bancos', { nome: 'Banco X', codigo: '999' }, false)).toEqual({
      ok: true,
      data: { nome: 'Banco X', codigo: '999' },
    })
  })

  it('categoria de DRE: linha precisa combinar com receita/despesa', () => {
    expect(validarCadastro('categorias-dre', { nome: 'Aluguel', tipo: 'despesa', linhaDre: 'despesa_fixa' }, false)).toEqual({
      ok: true,
      data: { nome: 'Aluguel', tipo: 'despesa', linha_dre: 'despesa_fixa' },
    })
    expect(validarCadastro('categorias-dre', { nome: 'X', tipo: 'receita', linhaDre: 'despesa_fixa' }, false)).toMatchObject({
      ok: false,
      code: 'INVALID_LINHA_DRE',
    })
    expect(validarCadastro('categorias-dre', { nome: 'X', tipo: 'outro', linhaDre: 'outros' }, false)).toMatchObject({ ok: false, code: 'INVALID_TIPO' })
  })

  it('edição parcial só valida o que veio (inativar)', () => {
    expect(validarCadastro('categorias-dre', { ativo: false }, true)).toEqual({ ok: true, data: { ativo: false } })
  })

  it('tipo de documento exige modelo base válido', () => {
    expect(validarCadastro('tipos-documento', { nome: 'Atestado', base: 'x' }, false)).toMatchObject({ ok: false, code: 'INVALID_BASE' })
    expect(validarCadastro('tipos-documento', { nome: 'Atestado', base: 'declaracao' }, false)).toMatchObject({ ok: true })
  })
})
