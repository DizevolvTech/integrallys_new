import { describe, expect, it } from 'vitest'
import { caminhoDoExame, mimeDoExame, urlDeAberturaExame, urlDeCaminho } from './exames-storage'

describe('exames-storage', () => {
  it('ida e volta do caminho guardado', () => {
    expect(caminhoDoExame(urlDeCaminho('abc/123-laudo.pdf'))).toBe('abc/123-laudo.pdf')
  })
  it('reconhece URL assinada antiga e ignora link externo', () => {
    expect(caminhoDoExame('http://x/storage/v1/object/sign/exames-pacientes/abc/1-a%20b.pdf?token=t')).toBe('abc/1-a b.pdf')
    expect(caminhoDoExame('https://drive.google.com/file/1')).toBeNull()
  })
  it('abre arquivos guardados pela API e deixa link externo como está', () => {
    expect(urlDeAberturaExame({ id: 'x1', url: urlDeCaminho('p/a.pdf') }).url).toBe('/api/pacientes/exames/x1/arquivo')
    expect(urlDeAberturaExame({ id: 'x2', url: 'https://externo/a' }).url).toBe('https://externo/a')
  })
  it('tipo do arquivo pela extensão', () => {
    expect(mimeDoExame('p/a.PDF')).toBe('application/pdf')
    expect(mimeDoExame('p/a.bin')).toBe('application/octet-stream')
  })
})
