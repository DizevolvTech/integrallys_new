import { limparControles } from '@/features/relatorios/exportacao/xlsx'
import type { ResumoLista } from '@/features/relatorios/relatorio-config'

export interface TabelaPdf {
  titulo: string
  filtros: string[]
  cabecalho: string[]
  direita: boolean[]
  linhas: string[][]
  resumos: ResumoLista[]
  geradoEm: string
}

const MARGEM = 10
const TAMANHO = 8

/** PDF em paisagem (A4): título, filtros, data, tabela completa com cabeçalho repetido e resumos. */
export async function gerarPdf(tabela: TabelaPdf): Promise<Blob> {
  const { default: JsPdf } = await import('jspdf')
  const pdf = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const largura = pdf.internal.pageSize.getWidth()
  const altura = pdf.internal.pageSize.getHeight()
  const util = largura - MARGEM * 2
  const limpar = limparControles

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text(limpar(tabela.titulo), MARGEM, MARGEM + 5)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  let y = MARGEM + 11
  pdf.text(`Gerado em ${tabela.geradoEm}`, MARGEM, y)
  y += 5
  if (tabela.filtros.length > 0) {
    const linhasFiltro = pdf.splitTextToSize(`Filtros: ${limpar(tabela.filtros.join(' | '))}`, util) as string[]
    pdf.text(linhasFiltro, MARGEM, y)
    y += linhasFiltro.length * 4.2
  }
  y += 3

  // Larguras: proporcionais ao maior texto de cada coluna (amostra), limitadas e ajustadas ao papel.
  pdf.setFontSize(TAMANHO)
  const amostra = tabela.linhas.slice(0, 300)
  const desejadas = tabela.cabecalho.map((titulo, c) => {
    let maior = pdf.getTextWidth(titulo)
    for (const linha of amostra) maior = Math.max(maior, pdf.getTextWidth(linha[c] ?? ''))
    return Math.min(Math.max(maior + 3, 14), 70)
  })
  const soma = desejadas.reduce((a, b) => a + b, 0)
  const fator = util / soma
  const colunas = desejadas.map((l) => l * fator)
  const posicoes = colunas.map((_, i) => MARGEM + colunas.slice(0, i).reduce((a, b) => a + b, 0))

  const cabecalho = () => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFillColor(232, 238, 242)
    pdf.rect(MARGEM, y - 3.8, util, 6, 'F')
    tabela.cabecalho.forEach((t, c) => {
      const lados = tabela.direita[c]
      const texto = (pdf.splitTextToSize(limpar(t), colunas[c] - 2) as string[])[0] ?? ''
      pdf.text(texto, lados ? posicoes[c] + colunas[c] - 1 : posicoes[c] + 1, y, { align: lados ? 'right' : 'left' })
    })
    pdf.setFont('helvetica', 'normal')
    y += 4.5
  }
  const novaPagina = () => {
    pdf.addPage()
    y = MARGEM + 4
  }

  cabecalho()
  for (const linha of tabela.linhas) {
    const quebradas = linha.map((t, c) => pdf.splitTextToSize(limpar(t), colunas[c] - 2) as string[])
    const alturaLinha = Math.max(...quebradas.map((q) => q.length), 1) * 3.4 + 1.6
    if (y + alturaLinha > altura - MARGEM) {
      novaPagina()
      cabecalho()
    }
    quebradas.forEach((q, c) => {
      const lados = tabela.direita[c]
      pdf.text(q, lados ? posicoes[c] + colunas[c] - 1 : posicoes[c] + 1, y, { align: lados ? 'right' : 'left' })
    })
    y += alturaLinha
    pdf.setDrawColor(225, 230, 234)
    pdf.line(MARGEM, y - 2.6, MARGEM + util, y - 2.6)
  }
  if (tabela.linhas.length === 0) pdf.text('Nenhum registro encontrado para os filtros selecionados.', MARGEM + 1, y)

  for (const resumo of tabela.resumos) {
    if (y + 14 > altura - MARGEM) novaPagina()
    y += 8
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text(limpar(resumo.titulo), MARGEM, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(TAMANHO + 0.5)
    y += 5
    if (resumo.itens.length === 0 && resumo.vazio) {
      pdf.text(limpar(resumo.vazio), MARGEM + 2, y)
      y += 4
    }
    for (const item of resumo.itens) {
      if (y + 5 > altura - MARGEM) {
        novaPagina()
        y += 2
      }
      const nome = (pdf.splitTextToSize(limpar(item.nome), util - 50) as string[])[0] ?? ''
      pdf.text(nome, MARGEM + 2, y)
      pdf.text(limpar(item.valor), MARGEM + util, y, { align: 'right' })
      y += 4.2
    }
  }
  return pdf.output('blob')
}
