import { describe, expect, it } from 'vitest'
import { caminhoDoExame, urlDeCaminho } from './exames-storage'

describe('exames-storage', () => {
  it('ida e volta do caminho guardado', () => {
    expect(caminhoDoExame(urlDeCaminho('abc/123-laudo.pdf'))).toBe('abc/123-laudo.pdf')
  })
  it('reconhece URL assinada antiga e ignora link externo', () => {
    expect(caminhoDoExame('http://x/storage/v1/object/sign/exames-pacientes/abc/1-a%20b.pdf?token=t')).toBe('abc/1-a b.pdf')
    expect(caminhoDoExame('https://drive.google.com/file/1')).toBeNull()
  })
})
