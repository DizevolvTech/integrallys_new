import { conteudoDeTexto, normalizarConteudo } from './atendimento'
import type { TemplateConteudo } from './types'

/**
 * Documento emitido → estrutura para o mesmo renderizador do preview. Há dois formatos gravados:
 * o do modelo preenchido (cabecalho/secoes/rodape) e o do atendimento ({ texto, cabecalho.titulo }).
 */
export function conteudoDoEmitido(raw: unknown): TemplateConteudo | null {
  if (!raw || typeof raw !== 'object') return null
  const estruturado = normalizarConteudo(raw)
  if (estruturado) return estruturado
  const { texto } = raw as { texto?: unknown }
  return typeof texto === 'string' && texto.trim() ? conteudoDeTexto(texto) : null
}

/** Valores preenchidos (chave `valor` de cada seção gravada) indexados pela posição da seção. */
export function valoresDoEmitido(raw: unknown): Record<number, unknown> {
  const secoes = (raw as { secoes?: unknown })?.secoes
  const valores: Record<number, unknown> = {}
  if (!Array.isArray(secoes)) return valores
  secoes.forEach((secao, i) => {
    if (secao && typeof secao === 'object' && 'valor' in secao && secao.valor !== undefined) valores[i] = secao.valor
  })
  return valores
}

/** 'Encaminhamento - NAYADE ... - 23-11-2026.pdf': sem caracteres que o sistema de arquivos não aceita. */
export function nomeArquivoDocumento(titulo: string, paciente: string, geradoEm: string | Date): string {
  const data = new Date(geradoEm)
  const dia = Number.isNaN(data.getTime())
    ? ''
    : new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
        .format(data)
        .replace(/\//g, '-')
  const limpar = (t: string) => t.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim()
  const partes = [limpar(titulo) || 'Documento', limpar(paciente), dia].filter(Boolean)
  return `${partes.join(' - ').slice(0, 150)}.pdf`
}
