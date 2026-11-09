/** Regras puras do estorno de movimentação do Caixa (a gravação atômica é a função SQL 213). */

import { MOTIVO_ESTORNO_MIN, respostaErroEstorno, validarMotivoEstorno } from '@/lib/estorno-recebimento'

export { MOTIVO_ESTORNO_MIN, validarMotivoEstorno }

export type AcaoPrescricaoEstorno = 'cancelar' | 'reabrir'

export interface EstornoCaixaInput {
  movimentoId: string
  motivo: string
  devolverEstoque: boolean
  prescricaoAcao: AcaoPrescricaoEstorno
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function idDeMovimentoValido(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id)
}

/** Lê o corpo do pedido: padrão = devolver ao estoque e cancelar a prescrição (as opções da janela). */
export function lerEstornoCaixa(body: Record<string, unknown> | null): { ok: true; value: EstornoCaixaInput } | { ok: false; message: string; code: string } {
  if (!idDeMovimentoValido(body?.id)) return { ok: false, message: 'Movimentação inválida.', code: 'INVALID_CAIXA_MOVIMENTO' }
  const motivo = validarMotivoEstorno(body?.motivo)
  if (!motivo.ok) return { ok: false, message: motivo.message, code: 'INVALID_ESTORNO_MOTIVO' }
  const acao = body?.prescricaoAcao === 'reabrir' ? 'reabrir' : body?.prescricaoAcao === undefined || body?.prescricaoAcao === 'cancelar' ? 'cancelar' : null
  if (!acao) return { ok: false, message: 'Escolha cancelar ou reabrir a prescrição.', code: 'INVALID_PRESCRICAO_ACAO' }
  return {
    ok: true,
    value: { movimentoId: body!.id as string, motivo: motivo.motivo, devolverEstoque: body?.devolverEstoque !== false, prescricaoAcao: acao },
  }
}

const MENSAGENS_CAIXA: Record<string, { status: number; message: string }> = {
  MOVIMENTO_NOT_FOUND: { status: 404, message: 'Movimentação não encontrada.' },
  MOVIMENTO_ALREADY_REVERSED: { status: 409, message: 'Esta movimentação já foi estornada.' },
  MOVIMENTO_E_ESTORNO: { status: 409, message: 'Esta movimentação já é um estorno e não pode ser estornada.' },
  INVALID_PRESCRICAO_ACAO: { status: 400, message: 'Escolha cancelar ou reabrir a prescrição.' },
  ESTORNO_AGENDAMENTO_SEM_PAGAMENTO: { status: 409, message: 'Não encontrei o recebimento do agendamento ligado a esta movimentação. Estorne pelo agendamento.' },
  ESTORNO_AGENDAMENTO_SEM_CAIXA: { status: 409, message: 'O recebimento do agendamento não está ligado a esta movimentação do caixa.' },
  INSUFFICIENT_STOCK_FOR_REVERSAL: { status: 409, message: 'Não foi possível devolver o produto ao estoque. Tente de novo sem devolver ao estoque.' },
}

/** Traduz o código devolvido pela função SQL em status HTTP e mensagem em português. */
export function respostaErroEstornoCaixa(code: unknown, fallback?: unknown): { status: number; code: string; message: string } {
  const chave = typeof code === 'string' ? code : 'ESTORNO_FALHOU'
  const conhecido = MENSAGENS_CAIXA[chave]
  if (conhecido) return { ...conhecido, code: chave }
  const geral = respostaErroEstorno(code, fallback)
  return geral.status === 500 && !fallback ? { ...geral, message: 'Não foi possível estornar a movimentação.' } : geral
}

export function mensagemEstornoCaixaConcluido(r: { produtosDevolvidos: number; prescricaoStatus: string | null }): string {
  const partes = ['Movimentação estornada.']
  if (r.produtosDevolvidos > 0) partes.push('Produtos devolvidos ao estoque.')
  if (r.prescricaoStatus === 'Cancelado') partes.push('Prescrição cancelada.')
  if (r.prescricaoStatus === 'Pendente') partes.push('Prescrição reaberta (voltou para Ativa).')
  return partes.join(' ')
}
