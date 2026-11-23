import { describe, expect, it } from 'vitest'
import { conteudoDoEmitido, nomeArquivoDocumento, valoresDoEmitido } from './emitido'

describe('nomeArquivoDocumento', () => {
  it('monta título - paciente - data no fuso da clínica', () => {
    expect(nomeArquivoDocumento('Encaminhamento', 'NAYADE CRISTALDO', '2026-11-24T01:30:00Z')).toBe(
      'Encaminhamento - NAYADE CRISTALDO - 23-11-2026.pdf',
    )
  })
  it('remove caracteres inválidos e usa nome padrão sem título', () => {
    expect(nomeArquivoDocumento('Laudo: A/B?', 'Ana', '2026-11-23T15:00:00Z')).toBe('Laudo A B - Ana - 23-11-2026.pdf')
    expect(nomeArquivoDocumento('', '', 'x')).toBe('Documento.pdf')
  })
})

describe('conteudoDoEmitido', () => {
  it('formato do atendimento (texto) vira título + parágrafos', () => {
    const c = conteudoDoEmitido({ texto: 'ENCAMINHAMENTO\n\nCorpo um\n\nCorpo dois', cabecalho: { titulo: 'x' } })
    expect(c?.cabecalho.titulo).toBe('ENCAMINHAMENTO')
    expect(c?.secoes).toHaveLength(2)
  })
  it('formato do modelo preenchido mantém seções e rodapé', () => {
    const c = conteudoDoEmitido({
      cabecalho: { titulo: 'T' },
      secoes: [{ tipo: 'paragrafo', conteudo: 'a' }],
      rodape: { assinatura: true },
    })
    expect(c?.secoes).toHaveLength(1)
    expect(c?.rodape.assinatura).toBe(true)
  })
  it('sem conteúdo devolve null', () => {
    expect(conteudoDoEmitido({})).toBeNull()
    expect(conteudoDoEmitido(null)).toBeNull()
  })
})

describe('valoresDoEmitido', () => {
  it('indexa o valor de cada seção pela posição', () => {
    expect(valoresDoEmitido({ secoes: [{ tipo: 'paragrafo' }, { tipo: 'campo_texto', valor: 'x' }] })).toEqual({ 1: 'x' })
  })
})
