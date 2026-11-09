import { describe, expect, it } from 'vitest'
import { celulaDoExcel, planilhasDoRelatorio, textoDaCelula } from '@/features/relatorios/exportar-relatorio'
import type { ColunaRelatorio } from '@/features/relatorios/relatorio-config'

const colunas: ColunaRelatorio[] = [
  { key: 'data', label: 'Data', tipo: 'data' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'forma', label: 'Forma', tipo: 'forma' },
  { key: 'bruto', label: 'Bruto', tipo: 'dinheiro', direita: true },
  { key: 'taxaPct', label: 'Taxa', tipo: 'pct', direita: true },
  { key: 'situacao', label: 'Situação', tipo: 'badge' },
]

describe('exportação de relatório', () => {
  it('texto da célula igual ao da tela', () => {
    expect(textoDaCelula(colunas[0], '2026-11-09')).toBe('09/11/2026')
    expect(textoDaCelula(colunas[2], 'credito')).toBe('Cartão de crédito')
    expect(textoDaCelula(colunas[5], 'a_receber')).toBe('A receber')
    expect(textoDaCelula(colunas[1], null)).toBe('')
  })

  it('dinheiro e % vão como número no Excel; o resto como texto', () => {
    expect(celulaDoExcel(colunas[3], '10.5')).toEqual({ valor: 10.5, estilo: 'dinheiro' })
    expect(celulaDoExcel(colunas[4], 3.2)).toEqual({ valor: 3.2, estilo: 'pct' })
    expect(celulaDoExcel(colunas[0], '2026-11-09')).toEqual({ valor: '09/11/2026' })
    expect(celulaDoExcel(colunas[3], null)).toEqual({ valor: null })
  })

  it('exporta TODAS as linhas recebidas e põe os resumos numa segunda aba', () => {
    const linhas = Array.from({ length: 250 }, (_, i) => ({ id: String(i), data: '2026-11-09', cliente: `C${i}`, bruto: i }))
    const sem = planilhasDoRelatorio({ titulo: 'Recebimentos', nomeArquivo: 'x', filtros: [], colunas, linhas, resumos: [] })
    expect(sem).toHaveLength(1)
    expect(sem[0].linhas).toHaveLength(251)
    const com = planilhasDoRelatorio({
      titulo: 'Recebimentos',
      nomeArquivo: 'x',
      filtros: ['Unidade: Centro'],
      colunas,
      linhas,
      resumos: [{ titulo: 'Total', itens: [{ nome: 'Pix', valor: 'R$ 1,00' }] }],
    })
    expect(com.map((p) => p.nome)).toEqual(['Recebimentos', 'Resumo'])
    expect(com[1].linhas.flat().map((c) => c.valor)).toContain('Unidade: Centro')
  })
})
