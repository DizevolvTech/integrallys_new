import type { NextResponse } from 'next/server'
import { getAppSupabase, serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { faturasDoCartao } from '@/lib/cartao-faturas'
import { hojeClinica } from '@/lib/recebimento-agendamento'
import type { getRequestAuth } from '@/lib/request-auth'

type Session = NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>

const MES = /^\d{4}-\d{2}$/

/**
 * Registra o pagamento da fatura fechada: grava (cartão, mês) como paga e gera a despesa
 * paga no financeiro com o valor total da fatura. A chave única (cartão, mês) torna a
 * operação idempotente: repetir devolve sucesso sem gerar nova despesa.
 * Retorna uma resposta só em caso de erro; `null` significa que a lista deve ser recarregada.
 */
export async function pagarFatura(session: Session, body: Record<string, unknown>): Promise<NextResponse | null> {
  const cartaoId = typeof body.cartaoId === 'string' ? body.cartaoId : ''
  const mes = typeof body.mes === 'string' ? body.mes : ''
  if (!cartaoId || !MES.test(mes)) {
    return serverErrorResponse('Informe o cartão e o mês da fatura', 'INVALID_FATURA_REF', 400)
  }

  const supabase = getAppSupabase()
  const [cartaoResult, movResult, pagaResult] = await Promise.all([
    supabase
      .from('cartoes_empresariais')
      .select('id,nome,unidade_id,dia_vencimento,dia_fechamento,conta_bancaria_id,ativo')
      .eq('id', cartaoId)
      .maybeSingle(),
    supabase.from('cartao_movimentos').select('id,descricao,beneficiario,valor,parcelas,data_compra').eq('cartao_id', cartaoId),
    supabase.from('cartao_faturas_pagas').select('mes').eq('cartao_id', cartaoId),
  ])
  if (cartaoResult.error) return supabaseErrorResponse(cartaoResult.error, 'Falha ao localizar cartão')
  if (movResult.error) return supabaseErrorResponse(movResult.error, 'Falha ao carregar compras do cartão')
  if (pagaResult.error) return supabaseErrorResponse(pagaResult.error, 'Falha ao carregar faturas pagas')
  const cartao = cartaoResult.data
  if (!cartao?.ativo) return serverErrorResponse('Cartão não encontrado', 'CARTAO_NOT_FOUND', 404)

  const mesesPagos = new Set((pagaResult.data ?? []).map((row) => String(row.mes)))
  if (mesesPagos.has(mes)) return null

  const compras = (movResult.data ?? [])
    .filter((mov) => mov.data_compra)
    .map((mov) => ({
      id: String(mov.id),
      descricao: String(mov.descricao),
      beneficiario: mov.beneficiario ? String(mov.beneficiario) : null,
      valor: Number(mov.valor ?? 0),
      parcelas: Number(mov.parcelas ?? 1),
      dataCompra: String(mov.data_compra),
    }))
  const hoje = hojeClinica()
  const fatura = faturasDoCartao(
    compras,
    { diaVencimento: cartao.dia_vencimento, diaFechamento: cartao.dia_fechamento },
    hoje,
    mesesPagos,
  ).find((item) => item.mes === mes)
  if (!fatura || fatura.total <= 0) {
    return serverErrorResponse('Esta fatura não tem valor a pagar', 'FATURA_SEM_VALOR', 400)
  }
  if (fatura.status !== 'fechada') {
    return serverErrorResponse('Só é possível registrar o pagamento de fatura fechada', 'FATURA_NAO_FECHADA', 409)
  }

  const { data: reserva, error: reservaError } = await supabase
    .from('cartao_faturas_pagas')
    .insert({ cartao_id: cartaoId, mes, valor: fatura.total, usuario_id: session.userId })
    .select('id')
    .single()
  if (reservaError) {
    // Outra requisição já registrou este pagamento: tratar como sucesso (idempotência).
    if (reservaError.code === '23505') return null
    return supabaseErrorResponse(reservaError, 'Falha ao registrar pagamento da fatura')
  }

  const { data: categoria } = await supabase
    .from('dre_categorias')
    .select('id,linha_dre')
    .eq('nome', 'Despesas financeiras')
    .eq('tipo', 'despesa')
    .maybeSingle()

  const [ano, numeroMes] = mes.split('-')
  const { data: lancamento, error: lancamentoError } = await supabase
    .from('financeiro_lancamentos')
    .insert({
      unidade_id: cartao.unidade_id,
      usuario_id: session.userId,
      descricao: `Fatura ${cartao.nome} ${numeroMes}/${ano}`,
      categoria: 'Fatura de cartão empresarial',
      categoria_dre: categoria?.linha_dre ?? null,
      dre_categoria_id: categoria?.id ?? null,
      valor: fatura.total,
      tipo: 'despesa',
      data_lancamento: new Date().toISOString(),
      data_emissao: hoje,
      data_liquidacao: hoje,
      competencia: fatura.vencimento,
      vencimento: fatura.vencimento,
      status: 'Pago',
      beneficiario: cartao.nome,
      conta_bancaria_id: cartao.conta_bancaria_id,
    })
    .select('id')
    .single()
  if (lancamentoError || !lancamento?.id) {
    await supabase.from('cartao_faturas_pagas').delete().eq('id', reserva.id)
    return lancamentoError
      ? supabaseErrorResponse(lancamentoError, 'Falha ao gerar a despesa da fatura')
      : serverErrorResponse('Falha ao gerar a despesa da fatura', 'FATURA_LANCAMENTO_FAILED', 500)
  }

  await supabase.from('cartao_faturas_pagas').update({ lancamento_id: lancamento.id }).eq('id', reserva.id)
  return null
}
