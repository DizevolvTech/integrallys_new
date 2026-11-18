import type { ContextoVariaveis, Secao, TemplateConteudo } from './types'
import { buildTokenMap, resolverVariaveisEmTemplate, resolverVariaveisEmTexto } from './variables'

/**
 * Documentos do atendimento (#1073 W3): o texto inicial é o modelo que a clínica cadastrou
 * (Configurações > Templates e documentos); só cai no texto padrão se a clínica não tiver modelo.
 */

/** Documento da lista do atendimento → slug do modelo da clínica (documento_templates.slug). */
export const SLUG_MODELO_POR_DOCUMENTO: Record<string, string[]> = {
  atestado: ['atestado'],
  dieta: ['dieta'],
  encaminhamento: ['encaminhamento'],
  laudo: ['laudo_editavel', 'laudo'],
  declaracao: ['declaracao_comparecimento'],
  fototerapy: ['procedimento_fototerapy'],
  biomodular: ['procedimento_biomodulador'],
}

export type ValoresDocumento = Record<number, unknown>

const RODAPE_PADRAO = { assinatura: true, conselho: true, dados_clinica: true }

function ehConteudoEstruturado(valor: unknown): valor is TemplateConteudo {
  if (!valor || typeof valor !== 'object') return false
  const c = valor as Record<string, unknown>
  return Array.isArray(c.secoes) && !!c.cabecalho && typeof c.cabecalho === 'object'
}

/** Texto livre → modelo estruturado: 1ª linha vira o título; cada bloco separado por linha em branco, um parágrafo. */
export function conteudoDeTexto(texto: string): TemplateConteudo {
  const linhas = texto.replace(/\r\n/g, '\n').trim().split('\n')
  const titulo = (linhas.shift() ?? '').trim()
  const blocos = linhas
    .join('\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  return {
    cabecalho: { titulo, logo: true },
    secoes: blocos.map((conteudo) => ({ tipo: 'paragrafo', conteudo })),
    rodape: { ...RODAPE_PADRAO },
  }
}

/**
 * `conteudo` de documento_templates pode ser: a estrutura (cabecalho/secoes/rodape), `{ corpo: <JSON da estrutura> }`
 * (gravado pelo antigo "Salvar modelo" do atendimento) ou `{ corpo: <texto livre> }`. Devolve sempre a estrutura.
 */
export function normalizarConteudo(raw: unknown): TemplateConteudo | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const texto = raw.trim()
    if (!texto) return null
    if (texto.startsWith('{')) {
      try {
        return normalizarConteudo(JSON.parse(texto))
      } catch {
        /* texto livre que começa com "{" */
      }
    }
    return conteudoDeTexto(texto)
  }
  if (typeof raw !== 'object') return null
  if (ehConteudoEstruturado(raw)) return { ...raw, rodape: raw.rodape ?? {} }
  const corpo = (raw as Record<string, unknown>).corpo
  return typeof corpo === 'string' ? normalizarConteudo(corpo) : null
}

export function conteudoAtestado(dias: string, motivo: string): TemplateConteudo {
  const afastamento = dias.trim() ? ` por ${dias.trim()} dia(s)` : ''
  const secoes: Secao[] = [
    {
      tipo: 'paragrafo',
      conteudo: `Atesto, para os devidos fins, que o(a) paciente #CLIENTE_NOME# esteve em atendimento em #DATA_ATUAL# e necessita de afastamento${afastamento}.`,
    },
  ]
  if (motivo.trim()) secoes.push({ tipo: 'paragrafo', conteudo: `Motivo: ${motivo.trim()}` })
  return { cabecalho: { titulo: 'ATESTADO MÉDICO', logo: true }, secoes, rodape: { ...RODAPE_PADRAO } }
}

export function resolverConteudo(conteudo: TemplateConteudo, ctx: ContextoVariaveis): TemplateConteudo {
  return resolverVariaveisEmTemplate(conteudo, ctx)
}

/**
 * Operação inversa da resolução: troca os dados do paciente/profissional/clínica/data de volta pelas variáveis,
 * para o modelo pessoal valer para o próximo paciente (nunca guardar o nome do paciente do atendimento).
 */
export function tokenizarConteudo(conteudo: TemplateConteudo, ctx: ContextoVariaveis): TemplateConteudo {
  const pares = Object.entries(buildTokenMap(ctx))
    .filter(([, valor]) => valor.trim().length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
  const trocar = (texto: string) => pares.reduce((acc, [token, valor]) => acc.split(valor).join(token), texto)
  const andar = (no: unknown): unknown => {
    if (typeof no === 'string') return trocar(no)
    if (Array.isArray(no)) return no.map(andar)
    if (no && typeof no === 'object') {
      return Object.fromEntries(Object.entries(no).map(([k, v]) => [k, andar(v)]))
    }
    return no
  }
  return andar(conteudo) as TemplateConteudo
}

const marca = (marcado: boolean) => (marcado ? '☒' : '☐')

/** Versão em texto puro do documento preenchido (resumo da conclusão e histórico). */
export function conteudoParaTexto(
  conteudo: TemplateConteudo,
  valores: ValoresDocumento,
  ctx: ContextoVariaveis = {},
): string {
  const r = (t: string) => resolverVariaveisEmTexto(t, ctx)
  const blocos: string[] = [r(conteudo.cabecalho.titulo)]
  conteudo.secoes.forEach((secao, i) => {
    const valor = valores[i]
    switch (secao.tipo) {
      case 'paragrafo':
        blocos.push(r(secao.conteudo))
        break
      case 'campo_data':
      case 'campo_texto':
      case 'campo_numero':
      case 'campo_texto_longo': {
        const padrao = 'valor_padrao' in secao && secao.valor_padrao ? r(secao.valor_padrao) : ''
        const texto = typeof valor === 'string' && valor.trim() ? valor : padrao
        blocos.push(`${secao.label}: ${texto}`.trim())
        break
      }
      case 'checkbox_lista': {
        const marcados = new Set((valor as number[] | undefined) ?? [])
        blocos.push([`${secao.label}:`, ...secao.itens.map((item, k) => `${marca(marcados.has(k))} ${item}`)].join('\n'))
        break
      }
      case 'checkbox_grupo': {
        const marcados = new Set((valor as number[] | undefined) ?? [])
        blocos.push(`${secao.label}: ${secao.opcoes.map((o, k) => `${marca(marcados.has(k))} ${o}`).join('   ')}`)
        break
      }
      case 'checklist': {
        const respostas = (valor as Record<number, { sim: boolean; obs: string }> | undefined) ?? {}
        const linhas = secao.itens.map((item, k) => {
          const resp = respostas[k]
          const obs = item.com_obs && resp?.obs ? ` (${resp.obs})` : ''
          return `${item.label}: ${resp?.sim ? 'Sim' : 'Não'}${obs}`
        })
        blocos.push([`${secao.label}:`, ...linhas].join('\n'))
        break
      }
    }
  })
  if (conteudo.rodape.texto_fixo) blocos.push(r(conteudo.rodape.texto_fixo))
  return blocos.filter((b) => b.trim()).join('\n\n')
}
