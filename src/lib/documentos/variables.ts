import type { ContextoVariaveis } from './types'

const TOKEN_REGEX = /#[A-Z_]+#/g

function formatCpf(cpf?: string): string {
  if (!cpf) return ''
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDate(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatDateHour(d: Date): string {
  return `${formatDate(d)} às ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function buildTokenMap(ctx: ContextoVariaveis): Record<string, string> {
  const agora = ctx.agora ?? new Date()
  const ah = ctx.agendamento?.data_hora
  const ahDate = ah instanceof Date ? ah : ah ? new Date(ah) : null

  return {
    '#CLIENTE_NOME#': ctx.cliente?.nome ?? '',
    '#CLIENTE_CPF#': formatCpf(ctx.cliente?.cpf),
    '#AGENDA_DATA_HORA#': ahDate && !Number.isNaN(ahDate.getTime()) ? formatDateHour(ahDate) : '',
    '#PROFISSIONAL_NOME#': ctx.profissional?.nome ?? '',
    '#PROFISSIONAL_CONSELHO#': ctx.profissional?.conselho ?? '',
    '#PROFISSIONAL_CPF#': formatCpf(ctx.profissional?.cpf ?? undefined),
    '#PROFISSIONAL_RG#': ctx.profissional?.rg ?? '',
    '#PROFISSIONAL_ENDERECO#': ctx.profissional?.endereco ?? '',
    '#PROFISSIONAL_ESTADO_CIVIL#': ctx.profissional?.estado_civil ?? '',
    '#REPASSE_PERCENTUAL#': ctx.repasse?.percentual != null ? `${ctx.repasse.percentual}%` : '',
    '#REPASSE_VALOR_FIXO#':
      ctx.repasse?.valor_fixo != null
        ? ctx.repasse.valor_fixo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '',
    '#DATA_ATUAL#': formatDate(agora),
    '#CLINICA_NOME#': ctx.clinica?.nome ?? '',
    '#CLINICA_CIDADE_UF#': ctx.clinica?.cidade_uf ?? '',
    '#CLINICA_ENDERECO#': ctx.clinica?.endereco ?? '',
    '#CLINICA_CEP#': ctx.clinica?.cep ?? '',
    '#CLINICA_TELEFONE#': ctx.clinica?.telefone ?? '',
  }
}

export function resolverVariaveisEmTexto(texto: string, ctx: ContextoVariaveis): string {
  if (!texto) return texto
  const map = buildTokenMap(ctx)
  return texto.replace(TOKEN_REGEX, (token) => (token in map ? map[token] : token))
}

export function resolverVariaveisEmTemplate<T>(template: T, ctx: ContextoVariaveis): T {
  const map = buildTokenMap(ctx)
  return walk(template, map) as T
}

function walk(node: unknown, map: Record<string, string>): unknown {
  if (typeof node === 'string') {
    return node.replace(TOKEN_REGEX, (token) => (token in map ? map[token] : token))
  }
  if (Array.isArray(node)) {
    return node.map((item) => walk(item, map))
  }
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node)) {
      out[key] = walk(value, map)
    }
    return out
  }
  return node
}
