import { describe, expect, it } from 'vitest'
import { emLotes } from './em-lotes'

describe('emLotes', () => {
  it('divide em lotes de 150 por padrão', () => {
    const lotes = emLotes(Array.from({ length: 320 }, (_, i) => i))
    expect(lotes.map((l) => l.length)).toEqual([150, 150, 20])
  })
  it('lista vazia gera nenhum lote', () => {
    expect(emLotes([])).toEqual([])
  })
})
