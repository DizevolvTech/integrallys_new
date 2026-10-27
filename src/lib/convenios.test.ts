import { describe, expect, it } from 'vitest'
import { listarConveniosEmUso } from './convenios'

describe('listarConveniosEmUso', () => {
  it('une variações de caixa, ordena por uso e omite Particular', () => {
    expect(listarConveniosEmUso(['Unimed', ' unimed ', 'Bradesco', 'Particular', '', 'Bradesco', 'Bradesco'])).toEqual(['Bradesco', 'Unimed'])
  })
})
