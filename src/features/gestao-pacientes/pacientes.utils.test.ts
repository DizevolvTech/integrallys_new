import { describe, expect, it } from 'vitest'
import { isClientePaciente } from './pacientes.utils'

describe('isClientePaciente (multi-vínculo; exclui só quem é exclusivamente fornecedor/prestador)', () => {
  it('mantém cliente', () => {
    expect(isClientePaciente(['cliente'])).toBe(true)
  })

  it('mantém legados sem vínculo (undefined/null/lista vazia) — tratados como cliente', () => {
    expect(isClientePaciente(undefined)).toBe(true)
    expect(isClientePaciente(null)).toBe(true)
    expect(isClientePaciente([])).toBe(true)
  })

  it('exclui quem é EXCLUSIVAMENTE fornecedor ou prestador', () => {
    expect(isClientePaciente(['fornecedor'])).toBe(false)
    expect(isClientePaciente(['prestador'])).toBe(false)
    expect(isClientePaciente(['fornecedor', 'prestador'])).toBe(false)
  })

  it('mantém quem é cliente E fornecedor (multi-vínculo aparece nas duas telas)', () => {
    expect(isClientePaciente(['cliente', 'fornecedor'])).toBe(true)
    expect(isClientePaciente(['fornecedor', 'cliente'])).toBe(true)
  })

  it('normaliza caixa/espaços antes de comparar', () => {
    expect(isClientePaciente(['Fornecedor'])).toBe(false)
    expect(isClientePaciente(['  fornecedor  '])).toBe(false)
    expect(isClientePaciente(['PRESTADOR'])).toBe(false)
  })

  it('não exclui outros vínculos (ex.: profissional/usuario/outro)', () => {
    expect(isClientePaciente(['profissional'])).toBe(true)
    expect(isClientePaciente(['usuario'])).toBe(true)
    expect(isClientePaciente(['outro'])).toBe(true)
  })
})

describe('tomInadimplencia', () => {
  it('vencido fica vermelho, parcial amarelo (prevalece) e o resto neutro', async () => {
    const { tomInadimplencia } = await import('./pacientes.utils')
    expect(tomInadimplencia({ situacao: 'vencido', status: 'Pendente' })).toBe('vencido')
    expect(tomInadimplencia({ situacao: 'vencido', status: 'Parcial' })).toBe('parcial')
    expect(tomInadimplencia({ situacao: 'a_vencer', status: 'Parcial' })).toBe('parcial')
    expect(tomInadimplencia({ situacao: 'a_vencer', status: 'Pendente' })).toBe('pendente')
    expect(tomInadimplencia({ situacao: 'pendente', status: '' })).toBe('pendente')
  })
})
