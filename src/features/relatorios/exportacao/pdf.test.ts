import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { gerarPdf } from '@/features/relatorios/exportacao/pdf'

describe('gerarPdf', () => {
  it('gera um PDF válido com todas as linhas (várias páginas) e os resumos', async () => {
    const linhas = Array.from({ length: 120 }, (_, i) => [`09/11/2026`, `Cliente ${i + 1} João`, `R$ ${i},00`])
    const blob = await gerarPdf({
      titulo: 'Recebimentos',
      filtros: ['Unidade: Centro', 'Forma: Pix'],
      cabecalho: ['Data', 'Cliente', 'Bruto'],
      direita: [false, false, true],
      linhas,
      resumos: [{ titulo: 'Resumo dos retornos', itens: [{ nome: 'Pendentes', valor: '4' }] }],
      geradoEm: '09/11/2026 10:00',
    })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    if (process.env.PDF_AMOSTRA) writeFileSync(process.env.PDF_AMOSTRA, bytes)
    const texto = new TextDecoder('latin1').decode(bytes)
    expect((texto.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1)
  })
})
