import { TIPOS_DO_PROPRIO_ESPECIALISTA, type RelatorioTipo } from '@/lib/relatorios/registry'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATA = /^\d{4}-\d{2}-\d{2}$/
const SEGURO = /^[\p{L}\p{N} ._\-/@:,()]{1,80}$/u

export function ehUuid(valor: string): boolean {
  return UUID.test(valor)
}

type Regra = 'uuid' | 'data' | 'texto' | 'inteiro'

/** Filtros que o navegador pode enviar por relatório; qualquer outra chave é descartada. */
const CHAVES: Record<RelatorioTipo, Record<string, Regra>> = {
  consultas: {
    q: 'texto', inicio: 'data', fim: 'data', procedimento_id: 'uuid', profissional_id: 'uuid',
    convenio: 'texto', unidade_id: 'uuid', situacao: 'texto', pagamento: 'texto',
  },
  agendamentos: {
    q: 'texto', inicio: 'data', fim: 'data', procedimento_id: 'uuid', profissional_id: 'uuid',
    convenio: 'texto', unidade_id: 'uuid', situacao: 'texto',
  },
  justificativas: {
    q: 'texto', inicio: 'data', fim: 'data', procedimento_id: 'uuid', profissional_id: 'uuid',
    unidade_id: 'uuid', situacao: 'texto',
  },
  pacientes: {
    q: 'texto', midia: 'texto', cidade: 'texto', convenio: 'texto', sexo: 'texto', mes_nascimento: 'inteiro',
    nascimento: 'data', profissional_id: 'uuid', procedimento_id: 'uuid', unidade_id: 'uuid',
    nao_comparecimento: 'texto',
  },
  vendas: {
    q: 'texto', inicio: 'data', fim: 'data', unidade_id: 'uuid', produto: 'texto',
    profissional_id: 'uuid', usuario_id: 'uuid', forma: 'texto',
  },
  recebimentos: { q: 'texto', inicio: 'data', fim: 'data', unidade_id: 'uuid', forma: 'texto', situacao: 'texto' },
  'estoque-posicao': { q: 'texto', unidade_id: 'uuid', categoria: 'texto', situacao: 'texto' },
  'estoque-movimentacao': {
    q: 'texto', inicio: 'data', fim: 'data', unidade_id: 'uuid', usuario_id: 'uuid', tipo: 'texto', nf: 'texto',
  },
  repasse: {
    q: 'texto', inicio: 'data', fim: 'data', unidade_id: 'uuid', profissional_id: 'uuid',
    procedimento_id: 'uuid', situacao: 'texto',
  },
  financeiro: { q: 'texto', inicio: 'data', fim: 'data', unidade_id: 'uuid', usuario_id: 'uuid', tipo: 'texto' },
  comissoes: { q: 'texto', inicio: 'data', fim: 'data', unidade_id: 'uuid', profissional_id: 'uuid' },
  tarefas: { q: 'texto', inicio: 'data', fim: 'data', unidade_id: 'uuid', responsavel_id: 'uuid', status: 'texto' },
  aniversariantes: { q: 'texto', data: 'data', modo: 'texto', unidade_id: 'uuid', enviado: 'texto' },
  desempenho: { inicio: 'data', fim: 'data', unidade_id: 'uuid', profissional_id: 'uuid' },
}

export interface EscopoRelatorio {
  perfil: string
  userId: string
  /** Unidade do usuário quando o perfil é restrito à unidade; null para admin/master. */
  unidadeId: string | null
  perfilRestritoPorUnidade: boolean
}

function valido(valor: string, regra: Regra): boolean {
  if (regra === 'uuid') return UUID.test(valor)
  if (regra === 'data') return DATA.test(valor) && !Number.isNaN(Date.parse(valor))
  if (regra === 'inteiro') return /^\d{1,2}$/.test(valor)
  return SEGURO.test(valor)
}

/** Converte a query string em filtros seguros do RPC; escopo (unidade/profissional) vem do servidor. */
export function montarFiltros(
  tipo: RelatorioTipo,
  query: URLSearchParams,
  escopo: EscopoRelatorio,
): Record<string, string | number> {
  const permitidas = CHAVES[tipo]
  const filtros: Record<string, string | number> = {}
  for (const [chave, regra] of Object.entries(permitidas)) {
    const valor = query.get(chave)?.trim()
    if (valor && valido(valor, regra)) filtros[chave] = valor
  }

  const pagina = Math.max(1, Number.parseInt(query.get('pagina') ?? '1', 10) || 1)
  const maximo = tipo === 'aniversariantes' ? 500 : 100
  const porPagina = Math.min(maximo, Math.max(1, Number.parseInt(query.get('porPagina') ?? '20', 10) || 20))
  filtros.limit = porPagina
  filtros.offset = (pagina - 1) * porPagina

  if (escopo.perfilRestritoPorUnidade && escopo.unidadeId) filtros.unidade_id = escopo.unidadeId
  if (escopo.perfil === 'especialista' && TIPOS_DO_PROPRIO_ESPECIALISTA.includes(tipo)) {
    filtros.profissional_id = escopo.userId
  }
  return filtros
}
