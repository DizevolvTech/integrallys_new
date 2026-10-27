import { SITUACAO_LABEL, situacaoLancamento, type SituacaoFinanceira } from './financeiro-situacao'
import { isIsoDate } from './financeiro-parcelas'

/** Uma linha de contas a receber ou a pagar (lançamento ou saldo de agendamento). */
export type ContaItem = {
  id: string
  origem: 'lancamento' | 'agendamento'
  descricao: string
  pessoa: string | null
  numeroDocumento: string | null
  parcela: string | null
  forma: string
  emissao: string | null
  vencimento: string | null
  dataReferencia: string
  valor: number
  situacao: SituacaoFinanceira
  situacaoLabel: string
  categoria: string
  dreCategoriaId: string | null
  formaPagamentoId: string | null
  profissionalId: string | null
  procedimentoId: string | null
  anexos: number
  somenteLeitura: boolean
}

export type FiltrosContas = {
  tipo: 'receita' | 'despesa'
  de: string | null
  ate: string | null
  pessoa: string
  produto: string
  formaId: string
  situacao: '' | SituacaoFinanceira
  categoriaId: string
  profissionalId: string
  procedimentoId: string
}

function texto(params: URLSearchParams, chave: string, max = 80) {
  return (params.get(chave) ?? '').trim().slice(0, max)
}

function uuid(params: URLSearchParams, chave: string) {
  const valor = texto(params, chave, 40)
  return /^[0-9a-f-]{36}$/i.test(valor) ? valor : ''
}

export function lerFiltrosContas(params: URLSearchParams): FiltrosContas | null {
  const tipo = params.get('tipo')
  if (tipo !== 'receita' && tipo !== 'despesa') return null
  const data = (chave: string) => {
    const valor = params.get(chave)
    return valor && isIsoDate(valor) ? valor : null
  }
  const situacao = texto(params, 'situacao', 20)
  return {
    tipo,
    de: data('de'),
    ate: data('ate'),
    pessoa: texto(params, 'pessoa'),
    produto: texto(params, 'produto'),
    formaId: uuid(params, 'formaId'),
    situacao: situacao === 'liquidado' || situacao === 'a_vencer' || situacao === 'atrasado' ? situacao : '',
    categoriaId: uuid(params, 'categoriaId'),
    profissionalId: uuid(params, 'profissionalId'),
    procedimentoId: uuid(params, 'procedimentoId'),
  }
}

function dia(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length >= 10 ? valor.slice(0, 10) : null
}

export type LancamentoRow = Record<string, unknown>

export function mapLancamentoConta(
  row: LancamentoRow,
  ctx: { hoje: string; formas: Map<string, string>; anexos: Map<string, number> },
): ContaItem {
  const referencia = dia(row.data_referencia) ?? dia(row.data_lancamento) ?? ctx.hoje
  const situacao = situacaoLancamento({
    status: row.status as string | null,
    vencimento: referencia,
    hoje: ctx.hoje,
  })
  const total = Number(row.parcelas ?? 1)
  const formaId = row.forma_pagamento_id ? String(row.forma_pagamento_id) : null
  const id = String(row.id)
  return {
    id,
    origem: 'lancamento',
    descricao: String(row.descricao ?? ''),
    pessoa: row.beneficiario ? String(row.beneficiario) : null,
    numeroDocumento: row.numero_documento ? String(row.numero_documento) : null,
    parcela: total > 1 ? `${Number(row.parcela_atual ?? 1)}/${total}` : null,
    forma: (formaId && ctx.formas.get(formaId)) || (row.metodo ? String(row.metodo) : 'Não informada'),
    emissao: dia(row.data_emissao) ?? dia(row.data_lancamento),
    vencimento: dia(row.vencimento),
    dataReferencia: referencia,
    valor: Number(row.valor ?? 0),
    situacao,
    situacaoLabel: SITUACAO_LABEL[situacao],
    categoria: String(row.categoria ?? ''),
    dreCategoriaId: row.dre_categoria_id ? String(row.dre_categoria_id) : null,
    formaPagamentoId: formaId,
    profissionalId: row.profissional_id ? String(row.profissional_id) : null,
    procedimentoId: row.procedimento_id ? String(row.procedimento_id) : null,
    anexos: ctx.anexos.get(id) ?? 0,
    somenteLeitura: false,
  }
}

/** Saldo que falta receber de um agendamento com pagamento antecipado ou parcial. */
export function saldoAgendamentoConta(params: {
  agendamentoId: string
  paciente: string | null
  procedimento: string | null
  procedimentoId: string | null
  profissionalId: string | null
  dataAgendamento: string
  valorDevido: number
  totalPago: number
  hoje: string
}): ContaItem | null {
  const saldo = Math.round((params.valorDevido - params.totalPago) * 100) / 100
  if (saldo <= 0) return null
  const situacao = situacaoLancamento({ status: 'Pendente', vencimento: params.dataAgendamento, hoje: params.hoje })
  return {
    id: `ag:${params.agendamentoId}`,
    origem: 'agendamento',
    descricao: `Saldo do atendimento${params.procedimento ? ` — ${params.procedimento}` : ''}`,
    pessoa: params.paciente,
    numeroDocumento: null,
    parcela: null,
    forma: 'A definir no atendimento',
    emissao: null,
    vencimento: params.dataAgendamento,
    dataReferencia: params.dataAgendamento,
    valor: saldo,
    situacao,
    situacaoLabel: SITUACAO_LABEL[situacao],
    categoria: 'Consultas',
    dreCategoriaId: null,
    formaPagamentoId: null,
    profissionalId: params.profissionalId,
    procedimentoId: params.procedimentoId,
    anexos: 0,
    somenteLeitura: true,
  }
}

/** Aplica os filtros às linhas que não vêm do banco (saldo de agendamentos). */
export function filtrarSaldos(itens: ContaItem[], filtros: FiltrosContas): ContaItem[] {
  if (filtros.formaId || filtros.categoriaId || filtros.produto) return []
  const busca = filtros.pessoa.toLowerCase()
  return itens.filter((item) => {
    if (filtros.de && item.dataReferencia < filtros.de) return false
    if (filtros.ate && item.dataReferencia > filtros.ate) return false
    if (busca && !(item.pessoa ?? '').toLowerCase().includes(busca)) return false
    if (filtros.situacao && item.situacao !== filtros.situacao) return false
    if (filtros.profissionalId && item.profissionalId !== filtros.profissionalId) return false
    if (filtros.procedimentoId && item.procedimentoId !== filtros.procedimentoId) return false
    return true
  })
}
