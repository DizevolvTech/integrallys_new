import { describe, expect, it } from 'vitest'
import { montarCadastroPortal } from './portal-cadastro'

describe('montarCadastroPortal', () => {
  it('exige responsável para menor de idade', () => {
    const r = montarCadastroPortal({}, '2015-01-01')
    expect(r.ok).toBe(false)
    const ok = montarCadastroPortal({ responsible: { name: 'Ana', relationship: 'Mãe' } }, '2015-01-01')
    expect(ok.ok).toBe(true)
  })
  it('maior de idade não exige responsável e grava null', () => {
    const r = montarCadastroPortal({}, '1990-05-05')
    expect(r.ok && r.colunas.responsavel).toBeNull()
  })
  it('rejeita origem fora da lista e CPF de responsável inválido', () => {
    expect(montarCadastroPortal({ indicacao: 'tv' }, '1990-01-01').ok).toBe(false)
    expect(montarCadastroPortal({ responsible: { name: 'A', cpf: '111.111.111-11' } }, '1990-01-01').ok).toBe(false)
  })
  it('NF com outros dados exige endereço; sem NF limpa financeiro', () => {
    const faltando = montarCadastroPortal({ precisaNf: true, financial: { requiresReceipt: 'sim', receiptData: { useProfileData: 'adicionar', taxId: '12345678909', name: 'X' } } }, '1990-01-01')
    expect(faltando.ok).toBe(false)
    const sem = montarCadastroPortal({ precisaNf: false, financial: { receiptData: { x: 1 } } }, '1990-01-01')
    expect(sem.ok && sem.colunas.financeiro).toEqual({ requiresReceipt: 'nao' })
  })
  it('filtra categorias de necessidade especial', () => {
    const r = montarCadastroPortal({ specialNeeds: { hasNeeds: 'sim', categories: ['Visual', 'Xyz'], details: 'ok' } }, '1990-01-01')
    expect(r.ok && r.colunas.necessidades_especiais).toEqual({ hasNeeds: true, categories: ['Visual'], details: 'ok' })
  })
})
