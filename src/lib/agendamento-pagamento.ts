import type { SupabaseClient } from '@supabase/supabase-js'

export type PagamentoAgendamentoInput = {
  agendamentoId: string
  valor: unknown
  metodo: unknown
  bandeira?: unknown
  parcelas?: unknown
  contaBancariaId?: unknown
  observacoes?: unknown
}

export type PagamentoAgendamentoResolved = {
  valor: number
  metodo: string
  bandeira: string | null
  parcelas: number | null
  contaBancariaId: string | null
  observacoes: string | null
}

function isCartao(metodo: string) {
  const m = metodo.toLowerCase()
  return m.includes('cartão') || m.includes('cartao') || m.includes('crédito') || m.includes('credito') || m.includes('débito') || m.includes('debito')
}

function isCredito(metodo: string) {
  const m = metodo.toLowerCase()
  return m.includes('crédito') || m.includes('credito')
}

function isPix(metodo: string) {
  return metodo.toLowerCase().includes('pix')
}

/**
 * Valida payload de pagamento de agendamento (checkout / entrada no novo agendamento).
 */
export function resolvePagamentoAgendamentoInput(
  input: PagamentoAgendamentoInput,
):
  | { ok: true; data: PagamentoAgendamentoResolved }
  | { ok: false; code: string; message: string } {
  const valor = Number(input.valor)
  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false, code: 'INVALID_VALOR', message: 'Informe um valor de pagamento maior que zero.' }
  }

  const metodo =
    typeof input.metodo === 'string' && input.metodo.trim() ? input.metodo.trim() : ''
  if (!metodo) {
    return { ok: false, code: 'INVALID_METODO', message: 'Selecione o método de pagamento.' }
  }

  const bandeira =
    typeof input.bandeira === 'string' && input.bandeira.trim() ? input.bandeira.trim() : null
  const contaBancariaId =
    typeof input.contaBancariaId === 'string' && input.contaBancariaId.trim()
      ? input.contaBancariaId.trim()
      : null
  const observacoes =
    typeof input.observacoes === 'string' && input.observacoes.trim()
      ? input.observacoes.trim()
      : null

  let parcelas: number | null = null
  if (input.parcelas != null && input.parcelas !== '') {
    const n = Number(input.parcelas)
    if (!Number.isFinite(n) || n < 1 || n > 24) {
      return { ok: false, code: 'INVALID_PARCELAS', message: 'Parcelas inválidas (1 a 24).' }
    }
    parcelas = Math.trunc(n)
  }

  if (isCartao(metodo) && !bandeira) {
    return {
      ok: false,
      code: 'BANDEIRA_OBRIGATORIA',
      message: 'Informe a bandeira do cartão.',
    }
  }

  if (isCredito(metodo) && !parcelas) {
    parcelas = 1
  }

  if (!isCredito(metodo)) {
    parcelas = null
  }

  if (isPix(metodo) && !contaBancariaId) {
    return {
      ok: false,
      code: 'CONTA_PIX_OBRIGATORIA',
      message: 'Selecione a conta bancária do PIX.',
    }
  }

  if (!input.agendamentoId.trim()) {
    return { ok: false, code: 'INVALID_AGENDAMENTO', message: 'agendamentoId obrigatório' }
  }

  return {
    ok: true,
    data: {
      valor: Number(valor.toFixed(2)),
      metodo,
      bandeira: isCartao(metodo) ? bandeira : null,
      parcelas,
      contaBancariaId: isPix(metodo) ? contaBancariaId : contaBancariaId,
      observacoes,
    },
  }
}

export function pagamentoAgendamentoRow(resolved: PagamentoAgendamentoResolved & { agendamentoId: string }) {
  return {
    agendamento_id: resolved.agendamentoId,
    valor: resolved.valor,
    metodo: resolved.metodo,
    bandeira: resolved.bandeira,
    parcelas: resolved.parcelas,
    conta_bancaria_id: resolved.contaBancariaId,
    status: 'Pago',
    pago_em: new Date().toISOString(),
    observacoes: resolved.observacoes,
  }
}

export async function insertPagamentoAgendamento(
  supabase: SupabaseClient,
  resolved: PagamentoAgendamentoResolved & { agendamentoId: string },
) {
  return supabase.from('agendamentos_pagamentos').insert(pagamentoAgendamentoRow(resolved))
}

export function buildMetodoLabel(resolved: PagamentoAgendamentoResolved) {
  const parts = [resolved.metodo]
  if (resolved.bandeira) parts.push(resolved.bandeira)
  if (resolved.parcelas && resolved.parcelas > 1) parts.push(`${resolved.parcelas}x`)
  return parts.join(' · ')
}

const moedaBR = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

/**
 * Cobrança não pode passar do saldo em aberto (valor do procedimento − já pago). Sem valor de procedimento
 * cadastrado não há saldo para comparar. Troco em dinheiro não é cobrança: o valor lançado é o devido, nunca o entregue.
 */
export function validarValorContraSaldo(params: {
  valorDevido: number
  totalPago: number
  valor: number
}): { ok: true } | { ok: false; code: 'VALOR_ACIMA_DO_SALDO'; message: string; saldo: number } {
  if (!(params.valorDevido > 0)) return { ok: true }
  const saldo = Math.max(0, Number((params.valorDevido - params.totalPago).toFixed(2)))
  if (params.valor - saldo > 0.005) {
    return {
      ok: false,
      code: 'VALOR_ACIMA_DO_SALDO',
      saldo,
      message: `O valor informado (${moedaBR(params.valor)}) é maior que o saldo em aberto (${moedaBR(saldo)}). Informe até ${moedaBR(saldo)}.`,
    }
  }
  return { ok: true }
}
