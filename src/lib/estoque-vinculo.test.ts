import { describe, expect, it } from 'vitest'
import { normalizarVinculo, vinculoValido } from './estoque-vinculo'

const ID = '3f0c1a52-1b7e-4c58-9d5f-0a1b2c3d4e5f'

describe('normalizarVinculo', () => {
  it('colaborador guarda o id do usuário', () => {
    expect(normalizarVinculo({ vinculoTipo: 'colaborador', vinculoId: ID, vinculoNome: ' Ana ' })).toEqual({ tipo: 'colaborador', id: ID, nome: 'Ana' })
  })
  it('outro não guarda id e mantém o texto livre', () => {
    expect(normalizarVinculo({ vinculoTipo: 'outro', vinculoId: ID, vinculoNome: 'Limpeza, derramou' })).toEqual({ tipo: 'outro', id: null, nome: 'Limpeza, derramou' })
  })
  it('tipo desconhecido ou id inválido são descartados', () => {
    expect(normalizarVinculo({ vinculoTipo: 'admin' }).tipo).toBeNull()
    expect(normalizarVinculo({ vinculoTipo: 'cliente', vinculoId: 'x' }).id).toBeNull()
  })
  it('limita o texto a 200 caracteres', () => {
    expect(normalizarVinculo({ vinculoTipo: 'outro', vinculoNome: 'a'.repeat(500) }).nome).toHaveLength(200)
  })
})

describe('vinculoValido', () => {
  it('outro exige texto; colaborador exige id', () => {
    expect(vinculoValido({ tipo: 'outro', id: null, nome: null })).toBe(false)
    expect(vinculoValido({ tipo: 'outro', id: null, nome: 'Zeladora' })).toBe(true)
    expect(vinculoValido({ tipo: 'colaborador', id: null, nome: 'Ana' })).toBe(false)
    expect(vinculoValido({ tipo: null, id: null, nome: null })).toBe(true)
  })
})
