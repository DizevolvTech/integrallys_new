import { formatData, formatDataHora, ROTULO_FORMA } from '@/features/relatorios/format'
import { gerarPdf } from '@/features/relatorios/exportacao/pdf'
import { gerarXlsx, type CelulaXlsx, type PlanilhaXlsx } from '@/features/relatorios/exportacao/xlsx'
import type { ColunaRelatorio, ResumoLista } from '@/features/relatorios/relatorio-config'

export type FormatoExportacao = 'xlsx' | 'pdf'

export interface DadosExportacao {
  titulo: string
  /** Nome do arquivo sem extensão. */
  nomeArquivo: string
  /** Frases "Filtro: valor" dos filtros ativos. */
  filtros: string[]
  colunas: ColunaRelatorio[]
  linhas: Array<Record<string, unknown>>
  resumos: ResumoLista[]
}

const ROTULO_BADGE: Record<string, string> = { a_receber: 'A receber', atrasado: 'Atrasado', liquidado: 'Liquidado', entrada: 'Entrada', saida: 'Saída' }
const NUMERICOS = new Set(['dinheiro', 'pct', 'numero'])

/** Texto da célula como aparece na tela (PDF e células de texto do Excel). */
export function textoDaCelula(coluna: ColunaRelatorio, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return ''
  switch (coluna.tipo) {
    case 'data':
      return formatData(valor)
    case 'dataHora':
      return formatDataHora(valor)
    case 'forma':
      return ROTULO_FORMA[String(valor)] ?? String(valor)
    case 'badge':
      return ROTULO_BADGE[String(valor)] ?? String(valor)
    case 'dias':
      return `${Number(valor)} d`
    case 'dinheiro':
      return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    case 'pct':
      return `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    case 'numero':
      return Number(valor).toLocaleString('pt-BR')
    default:
      return String(valor)
  }
}

/** Excel: dinheiro, % e quantidades vão como número (somam e ordenam); o resto como texto. */
export function celulaDoExcel(coluna: ColunaRelatorio, valor: unknown): CelulaXlsx {
  if (valor === null || valor === undefined || valor === '') return { valor: null }
  if (coluna.tipo && NUMERICOS.has(coluna.tipo) && Number.isFinite(Number(valor))) {
    return { valor: Number(valor), estilo: coluna.tipo === 'dinheiro' ? 'dinheiro' : coluna.tipo === 'pct' ? 'pct' : 'padrao' }
  }
  return { valor: textoDaCelula(coluna, valor) }
}

export function planilhasDoRelatorio(dados: DadosExportacao): PlanilhaXlsx[] {
  const cabecalho: CelulaXlsx[] = dados.colunas.map((c) => ({ valor: c.label, estilo: 'cabecalho' }))
  const corpo = dados.linhas.map((linha) => dados.colunas.map((c) => celulaDoExcel(c, linha[c.key])))
  const larguras = dados.colunas.map((c, i) => {
    const maior = Math.max(c.label.length, ...dados.linhas.slice(0, 300).map((l) => textoDaCelula(c, l[c.key]).length))
    return Math.min(Math.max(maior + 2, i === 0 ? 12 : 10), 60)
  })
  const planilhas: PlanilhaXlsx[] = [{ nome: dados.titulo, linhas: [cabecalho, ...corpo], larguras }]

  if (dados.resumos.length > 0) {
    const linhas: CelulaXlsx[][] = [[{ valor: dados.titulo, estilo: 'titulo' }]]
    for (const f of dados.filtros) linhas.push([{ valor: f }])
    for (const resumo of dados.resumos) {
      linhas.push([])
      linhas.push([{ valor: resumo.titulo, estilo: 'cabecalho' }, { valor: '', estilo: 'cabecalho' }])
      if (resumo.itens.length === 0 && resumo.vazio) linhas.push([{ valor: resumo.vazio }])
      for (const item of resumo.itens) linhas.push([{ valor: item.nome }, { valor: item.valor }])
    }
    planilhas.push({ nome: 'Resumo', linhas, larguras: [60, 28] })
  }
  return planilhas
}

function baixar(blob: Blob, nome: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

const dataHoraAgora = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
const dataArquivo = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

/** Baixa o relatório (todas as linhas do filtro) em Excel (.xlsx) ou PDF. */
export async function exportarRelatorio(formato: FormatoExportacao, dados: DadosExportacao): Promise<void> {
  const nome = `${dados.nomeArquivo}-${dataArquivo()}`
  if (formato === 'xlsx') {
    const bytes = gerarXlsx(planilhasDoRelatorio(dados))
    baixar(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${nome}.xlsx`)
    return
  }
  const pdf = await gerarPdf({
    titulo: dados.titulo,
    filtros: dados.filtros,
    cabecalho: dados.colunas.map((c) => c.label),
    direita: dados.colunas.map((c) => Boolean(c.direita)),
    linhas: dados.linhas.map((l) => dados.colunas.map((c) => textoDaCelula(c, l[c.key]))),
    resumos: dados.resumos,
    geradoEm: dataHoraAgora(),
  })
  baixar(pdf, `${nome}.pdf`)
}
