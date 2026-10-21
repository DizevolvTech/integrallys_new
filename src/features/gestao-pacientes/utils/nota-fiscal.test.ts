import { describe, expect, it } from 'vitest'
import { NOTA_FISCAL_VAZIA, notaFiscalFromFinancial, notaFiscalToFinancial, validarNotaFiscal } from './nota-fiscal'

describe('nota fiscal do paciente', () => {
  it('"mesmos" não exige dados extras', () => {
    expect(validarNotaFiscal(true, NOTA_FISCAL_VAZIA)).toBeNull()
    expect(notaFiscalToFinancial(true, NOTA_FISCAL_VAZIA)).toEqual({ requiresReceipt: 'sim', receiptData: { useProfileData: 'mesmos' } })
  })
  it('sem NF ignora tudo', () => {
    expect(validarNotaFiscal(false, { modo: 'adicionar', documento: '1', nome: '', endereco: '' })).toBeNull()
    expect(notaFiscalToFinancial(false, NOTA_FISCAL_VAZIA)).toEqual({ requiresReceipt: 'nao' })
  })
  it('"adicionar" exige CPF/CNPJ válido e nome', () => {
    expect(validarNotaFiscal(true, { modo: 'adicionar', documento: '', nome: 'X', endereco: '' })).toMatch(/CPF ou CNPJ/)
    expect(validarNotaFiscal(true, { modo: 'adicionar', documento: '111.111.111-11', nome: 'X', endereco: '' })).toMatch(/inválido/)
    expect(validarNotaFiscal(true, { modo: 'adicionar', documento: '529.982.247-25', nome: '', endereco: '' })).toMatch(/nome/)
    expect(validarNotaFiscal(true, { modo: 'adicionar', documento: '529.982.247-25', nome: 'João Produtor', endereco: '' })).toBeNull()
    expect(validarNotaFiscal(true, { modo: 'adicionar', documento: '11.222.333/0001-81', nome: 'Fazenda', endereco: '' })).toBeNull()
  })
  it('vai e volta pelo JSON salvo', () => {
    const f = notaFiscalToFinancial(true, { modo: 'adicionar', documento: '529.982.247-25', nome: ' João ', endereco: 'Sítio' })
    expect(f.receiptData).toMatchObject({ useProfileData: 'adicionar', taxId: '52998224725', name: 'João', address: 'Sítio' })
    expect(notaFiscalFromFinancial(f)).toEqual({ modo: 'adicionar', documento: '529.982.247-25', nome: 'João', endereco: 'Sítio' })
    expect(notaFiscalFromFinancial(undefined)).toEqual(NOTA_FISCAL_VAZIA)
  })
})
