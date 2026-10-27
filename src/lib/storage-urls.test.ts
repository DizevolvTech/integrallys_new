import { describe, expect, it } from 'vitest'
import { caminhoSeguro, urlParaNavegador } from './storage-urls'

describe('urls de arquivos para o navegador', () => {
  it('troca o link interno do storage da foto do paciente pela rota do app', () => {
    expect(
      urlParaNavegador('http://127.0.0.1:4064/storage/v1/object/public/pacientes-fotos/abc/foto-1.jpg'),
    ).toBe('/api/pacientes/foto/arquivo?caminho=abc%2Ffoto-1.jpg')
  })
  it('avatar vai pela rota pública; outros links ficam iguais', () => {
    expect(urlParaNavegador('http://x/storage/v1/object/public/avatares/u/a.png')).toBe('/api/arquivos-publicos/avatares/u/a.png')
    expect(urlParaNavegador('https://cdn.exemplo.com/a.png')).toBe('https://cdn.exemplo.com/a.png')
    expect(urlParaNavegador(null)).toBe('')
  })
  it('recusa caminho que sobe diretório', () => {
    expect(caminhoSeguro('a/../b')).toBeNull()
    expect(caminhoSeguro('abc/foto.jpg')).toBe('abc/foto.jpg')
  })
})
