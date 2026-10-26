import { describe, expect, it } from 'vitest'
import {
  descreverNotaFiscal,
  ENDERECO_NF_VAZIO,
  NOTA_FISCAL_VAZIA,
  type NotaFiscalForm,
  notaFiscalFromFinancial,
  notaFiscalToFinancial,
  validarFinancialNotaFiscal,
  validarNotaFiscal,
} from './nota-fiscal'

const ENDERECO = {
  cep: '78635-000',
  logradouro: 'Rua 16',
  numero: '699',
  complemento: 'esq. com rua 7',
  bairro: 'Guarujá',
  cidade: 'Água Boa',
  uf: 'MT',
}
const nf = (patch: Partial<NotaFiscalForm>): NotaFiscalForm => ({
  modo: 'adicionar',
  documento: '11.222.333/0001-81',
  nome: 'Fazenda QA',
  endereco: { ...ENDERECO },
  ...patch,
})

describe('nota fiscal do paciente', () => {
  it('"mesmos" não exige dados extras', () => {
    expect(validarNotaFiscal(true, NOTA_FISCAL_VAZIA)).toBeNull()
    expect(notaFiscalToFinancial(true, NOTA_FISCAL_VAZIA)).toEqual({ requiresReceipt: 'sim', receiptData: { useProfileData: 'mesmos' } })
  })
  it('sem NF ignora tudo', () => {
    expect(validarNotaFiscal(false, nf({ documento: '1', nome: '' }))).toBeNull()
    expect(notaFiscalToFinancial(false, NOTA_FISCAL_VAZIA)).toEqual({ requiresReceipt: 'nao' })
  })
  it('"adicionar" exige CPF/CNPJ válido e nome', () => {
    expect(validarNotaFiscal(true, nf({ documento: '' }))).toMatch(/CPF ou CNPJ/)
    expect(validarNotaFiscal(true, nf({ documento: '111.111.111-11' }))).toMatch(/inválido/)
    expect(validarNotaFiscal(true, nf({ nome: '' }))).toMatch(/nome/)
    expect(validarNotaFiscal(true, nf({ documento: '529.982.247-25' }))).toBeNull()
    expect(validarNotaFiscal(true, nf({}))).toBeNull()
  })
  it('"adicionar" exige endereço completo (complemento opcional)', () => {
    expect(validarNotaFiscal(true, nf({ endereco: { ...ENDERECO_NF_VAZIO } }))).toMatch(/CEP/)
    expect(validarNotaFiscal(true, nf({ endereco: { ...ENDERECO, logradouro: '' } }))).toMatch(/logradouro/)
    expect(validarNotaFiscal(true, nf({ endereco: { ...ENDERECO, numero: ' ' } }))).toMatch(/número/)
    expect(validarNotaFiscal(true, nf({ endereco: { ...ENDERECO, bairro: '' } }))).toMatch(/bairro/)
    expect(validarNotaFiscal(true, nf({ endereco: { ...ENDERECO, cidade: '' } }))).toMatch(/cidade/)
    expect(validarNotaFiscal(true, nf({ endereco: { ...ENDERECO, uf: 'M' } }))).toMatch(/UF/)
    expect(validarNotaFiscal(true, nf({ endereco: { ...ENDERECO, complemento: '' } }))).toBeNull()
  })
  it('vai e volta pelo JSON salvo', () => {
    const f = notaFiscalToFinancial(true, nf({ documento: '529.982.247-25', nome: ' João ' }))
    expect(f.receiptData).toMatchObject({
      useProfileData: 'adicionar',
      taxId: '52998224725',
      name: 'João',
      addressDetails: { zipCode: '78635000', street: 'Rua 16', number: '699', city: 'Água Boa', state: 'MT' },
    })
    expect(notaFiscalFromFinancial(f)).toEqual(nf({ documento: '529.982.247-25', nome: 'João' }))
    expect(notaFiscalFromFinancial(undefined)).toEqual(NOTA_FISCAL_VAZIA)
  })
  it('cadastro antigo com endereço em texto livre abre no logradouro e passa a exigir o resto', () => {
    const antigo = { requiresReceipt: 'sim' as const, receiptData: { useProfileData: 'adicionar' as const, taxId: '52998224725', name: 'J', address: 'Sítio' } }
    expect(notaFiscalFromFinancial(antigo).endereco.logradouro).toBe('Sítio')
    expect(validarFinancialNotaFiscal(antigo)).toMatch(/CEP/)
  })
  it('servidor valida o JSON recebido', () => {
    expect(validarFinancialNotaFiscal(undefined)).toBeNull()
    expect(validarFinancialNotaFiscal({ requiresReceipt: 'nao' })).toBeNull()
    expect(validarFinancialNotaFiscal(notaFiscalToFinancial(true, NOTA_FISCAL_VAZIA))).toBeNull()
    expect(validarFinancialNotaFiscal(notaFiscalToFinancial(true, nf({})))).toBeNull()
    expect(validarFinancialNotaFiscal(notaFiscalToFinancial(true, nf({ endereco: { ...ENDERECO, numero: '' } })))).toMatch(/número/)
  })
  it('descreve a NF na visualização', () => {
    expect(descreverNotaFiscal(false, NOTA_FISCAL_VAZIA)).toBe('Não precisa')
    expect(descreverNotaFiscal(true, NOTA_FISCAL_VAZIA)).toMatch(/cadastro/)
    expect(descreverNotaFiscal(true, nf({ documento: '529.982.247-25', nome: 'João' }))).toBe(
      'Sim — João (529.982.247-25) · Rua 16, 699 — esq. com rua 7 — Guarujá — Água Boa/MT — CEP 78635-000',
    )
  })
})
